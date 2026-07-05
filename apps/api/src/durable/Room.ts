import type {
  DeckCard,
  RoomCardResult,
  RoomClientMessage,
  RoomMode,
  RoomServerMessage,
  RoomState,
  Side,
} from '@cdgodd/shared';
import type { Env } from '../env';

interface RoomConfig {
  code: string;
  mode: RoomMode;
  cards: DeckCard[];
}

/**
 * One Durable Object instance per room short-code.
 *
 * Lifecycle: /create deals random approved cards from D1 and persists the
 * config (survives DO eviction); players join over WebSocket; the host
 * starts the round; everyone votes on the same card. When every connected
 * player has voted, the room advances. Live mode broadcasts each card's
 * tally as it completes; batch mode reveals everything at the end.
 *
 * Vote validity is enforced here — one vote per player per card — which
 * makes multiplayer results immune to external stuffing. Votes live in
 * memory only (room results are ephemeral by design; global item stats
 * come from solo votes).
 */
export class Room implements DurableObject {
  private config: RoomConfig | null = null;
  private loaded = false;

  private phase: RoomState['phase'] = 'lobby';
  private currentCardIndex = 0;
  private hostId: string | null = null;
  /** ws -> sessionId of connected players. */
  private players = new Map<WebSocket, string>();
  /** cardIndex -> sessionId -> side. */
  private votes = new Map<number, Map<string, Side>>();

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.config = (await this.ctx.storage.get<RoomConfig>('config')) ?? null;
    this.loaded = true;
  }

  private get state(): RoomState {
    return {
      code: this.config?.code ?? '',
      mode: this.config?.mode ?? 'batch',
      phase: this.phase,
      roundSize: this.config?.cards.length ?? 0,
      playerCount: new Set(this.players.values()).size,
      currentCardIndex: this.currentCardIndex,
      hostId: this.hostId,
    };
  }

  async fetch(request: Request): Promise<Response> {
    await this.load();
    const url = new URL(request.url);

    if (url.pathname.endsWith('/create') && request.method === 'POST') {
      return this.create(url);
    }

    if (!this.config) {
      return Response.json({ error: 'room not found' }, { status: 404 });
    }

    if (request.headers.get('upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      this.accept(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return Response.json({ room: this.state });
  }

  private async create(url: URL): Promise<Response> {
    if (this.config) {
      return Response.json({ error: 'room already exists' }, { status: 409 });
    }
    const code = url.searchParams.get('code') ?? '';
    const mode = (url.searchParams.get('mode') === 'live' ? 'live' : 'batch') as RoomMode;
    const roundSize = Math.min(
      Math.max(Number(url.searchParams.get('roundSize')) || 10, 1),
      50,
    );

    const { results } = await this.env.DB.prepare(
      `SELECT i.id, t.label, i.image_key, cat.key AS category_key
         FROM items i
         JOIN item_translations t ON t.item_id = i.id AND t.lang = 'fr'
         LEFT JOIN categories cat ON cat.id = i.category_id
        WHERE i.status = 'approved'
        ORDER BY RANDOM()
        LIMIT ?1`,
    )
      .bind(roundSize)
      .all<{
        id: number;
        label: string;
        image_key: string | null;
        category_key: string | null;
      }>();

    if (results.length === 0) {
      return Response.json({ error: 'no items available' }, { status: 503 });
    }

    const cards: DeckCard[] = results.map((r) => ({
      id: r.id,
      label: r.label,
      categoryKey: r.category_key,
      imageUrl: r.image_key ? `${this.env.CDN_BASE}/${r.image_key}` : null,
    }));

    this.config = { code, mode, cards };
    await this.ctx.storage.put('config', this.config);
    // Rooms are ephemeral: self-destruct after 24h so codes can be reused.
    await this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);

    return Response.json({ room: this.state });
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
    this.config = null;
    this.phase = 'lobby';
    for (const ws of this.players.keys()) ws.close(1000, 'room expired');
    this.players.clear();
    this.votes.clear();
  }

  private accept(ws: WebSocket) {
    ws.accept();

    ws.addEventListener('message', (event) => {
      let msg: RoomClientMessage;
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        this.send(ws, { type: 'error', message: 'bad message' });
        return;
      }
      this.handle(ws, msg);
    });

    const drop = () => {
      const wasPlayer = this.players.delete(ws);
      if (!wasPlayer) return;
      this.broadcast({ type: 'state', room: this.state });
      // Don't deadlock a round on someone who left mid-card.
      if (this.phase === 'playing') this.maybeAdvance();
    };
    ws.addEventListener('close', drop);
    ws.addEventListener('error', drop);
  }

  private handle(ws: WebSocket, msg: RoomClientMessage) {
    switch (msg.type) {
      case 'join': {
        if (typeof msg.sessionId !== 'string' || msg.sessionId.length > 64) {
          this.send(ws, { type: 'error', message: 'bad session id' });
          return;
        }
        this.players.set(ws, msg.sessionId);
        this.hostId ??= msg.sessionId;
        this.broadcast({ type: 'state', room: this.state });
        // Late joiner during a round: catch them up on the current card.
        if (this.phase === 'playing') this.sendCurrentCard(ws);
        if (this.phase === 'results') this.send(ws, this.revealMessage());
        break;
      }

      case 'start': {
        if (this.players.get(ws) !== this.hostId) {
          this.send(ws, { type: 'error', message: 'host only' });
          return;
        }
        if (this.phase !== 'lobby') return;
        this.phase = 'playing';
        this.currentCardIndex = 0;
        this.broadcast({ type: 'state', room: this.state });
        this.broadcastCurrentCard();
        break;
      }

      case 'vote': {
        const sessionId = this.players.get(ws);
        if (!sessionId || this.phase !== 'playing') return;
        if (msg.cardIndex !== this.currentCardIndex) return; // stale vote
        if (msg.side !== 'left' && msg.side !== 'right') return;

        let cardVotes = this.votes.get(this.currentCardIndex);
        if (!cardVotes) {
          cardVotes = new Map();
          this.votes.set(this.currentCardIndex, cardVotes);
        }
        if (cardVotes.has(sessionId)) return; // one vote per player per card
        cardVotes.set(sessionId, msg.side);
        this.maybeAdvance();
        break;
      }
    }
  }

  /** Advance when every currently-connected player has voted the card. */
  private maybeAdvance() {
    const sessions = new Set(this.players.values());
    if (sessions.size === 0) return;
    const cardVotes = this.votes.get(this.currentCardIndex);
    const votedCount = [...sessions].filter((s) => cardVotes?.has(s)).length;
    if (votedCount < sessions.size) return;

    if (this.config?.mode === 'live') {
      const { votesLeft, votesRight } = this.tallyOf(this.currentCardIndex);
      this.broadcast({
        type: 'tally',
        cardIndex: this.currentCardIndex,
        votesLeft,
        votesRight,
      });
    }

    this.currentCardIndex += 1;
    if (this.currentCardIndex >= (this.config?.cards.length ?? 0)) {
      this.phase = 'results';
      this.broadcast({ type: 'state', room: this.state });
      this.broadcast(this.revealMessage());
    } else {
      this.broadcast({ type: 'state', room: this.state });
      this.broadcastCurrentCard();
    }
  }

  private tallyOf(index: number): { votesLeft: number; votesRight: number } {
    const cardVotes = this.votes.get(index);
    let votesLeft = 0;
    let votesRight = 0;
    for (const side of cardVotes?.values() ?? []) {
      if (side === 'left') votesLeft += 1;
      else votesRight += 1;
    }
    return { votesLeft, votesRight };
  }

  private revealMessage(): RoomServerMessage {
    const results: RoomCardResult[] = (this.config?.cards ?? []).map(
      (card, i) => ({ card, ...this.tallyOf(i) }),
    );
    return { type: 'reveal', results };
  }

  private sendCurrentCard(ws: WebSocket) {
    const card = this.config?.cards[this.currentCardIndex];
    if (card) {
      this.send(ws, { type: 'card', cardIndex: this.currentCardIndex, card });
    }
  }

  private broadcastCurrentCard() {
    const card = this.config?.cards[this.currentCardIndex];
    if (card) {
      this.broadcast({
        type: 'card',
        cardIndex: this.currentCardIndex,
        card,
      });
    }
  }

  private send(ws: WebSocket, msg: RoomServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket already gone */
    }
  }

  private broadcast(msg: RoomServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.players.keys()) {
      try {
        ws.send(data);
      } catch {
        /* socket already gone */
      }
    }
  }
}

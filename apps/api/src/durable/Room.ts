import type {
  CategoryMatch,
  DeckCard,
  RoomCardResult,
  RoomClientMessage,
  RoomMode,
  RoomPlayer,
  RoomServerMessage,
  RoomState,
  Side,
} from '@cdgodd/shared';
import type { Env } from '../env';
import { categoryExcludeSql, categoryFilterSql } from '../routes/items';

interface RoomConfig {
  code: string;
  mode: RoomMode;
  cards: DeckCard[];
  /** Category filter the cards are dealt from; empty = all categories. */
  categoryKeys: string[];
  /** 'all' = cards must belong to every key; absent (pre-existing rooms) = 'any'. */
  categoryMatch?: CategoryMatch;
  /** Categories never dealt from; absent (pre-existing rooms) = none. */
  excludeKeys?: string[];
}

const CATEGORY_KEY_RE = /^[a-z0-9-]{1,50}$/;

/** Keep only well-formed category keys (defense in depth; API validates too). */
function sanitizeCategoryKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  return keys
    .filter((k): k is string => typeof k === 'string' && CATEGORY_KEY_RE.test(k))
    .slice(0, 20);
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
  /** Results phase: index of the card currently revealed (host-paced). */
  private revealIndex = 0;
  private hostId: string | null = null;
  /** ws -> sessionId of connected players. */
  private players = new Map<WebSocket, string>();
  /** sessionId -> chosen nickname (ephemeral, in-memory like votes). */
  private names = new Map<string, string>();
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
    const sessions = new Set(this.players.values());
    const players: RoomPlayer[] = [...sessions].map((id) => ({
      id,
      name: this.names.get(id) ?? 'Joueur',
    }));
    return {
      code: this.config?.code ?? '',
      mode: this.config?.mode ?? 'batch',
      phase: this.phase,
      roundSize: this.config?.cards.length ?? 0,
      categoryKeys: this.config?.categoryKeys ?? [],
      categoryMatch: this.config?.categoryMatch ?? 'any',
      excludeKeys: this.config?.excludeKeys ?? [],
      playerCount: sessions.size,
      players,
      currentCardIndex: this.currentCardIndex,
      revealIndex: this.revealIndex,
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
      Math.max(Number(url.searchParams.get('roundSize')) || 10, 5),
      50,
    );
    const categoryKeys = sanitizeCategoryKeys(
      (url.searchParams.get('categories') ?? '').split(',').filter(Boolean),
    );
    const categoryMatch: CategoryMatch =
      url.searchParams.get('match') === 'all' ? 'all' : 'any';
    const excludeKeys = sanitizeCategoryKeys(
      (url.searchParams.get('exclude') ?? '').split(',').filter(Boolean),
    );

    const cards = await this.dealCards(
      roundSize,
      categoryKeys,
      categoryMatch,
      excludeKeys,
    );
    if (cards.length === 0) {
      return Response.json({ error: 'no items available' }, { status: 503 });
    }

    this.config = { code, mode, cards, categoryKeys, categoryMatch, excludeKeys };
    await this.ctx.storage.put('config', this.config);
    // Rooms are ephemeral: self-destruct after 24h so codes can be reused.
    await this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);

    return Response.json({ room: this.state });
  }

  /** Draw a fresh random hand of approved cards from D1. */
  private async dealCards(
    roundSize: number,
    categoryKeys: string[],
    categoryMatch: CategoryMatch = 'any',
    excludeKeys: string[] = [],
  ): Promise<DeckCard[]> {
    // roundSize is ?1; include keys bind from ?2, exclude keys right after.
    const { results } = await this.env.DB.prepare(
      `SELECT i.id, t.label, i.image_key, i.image_author, i.image_license,
              i.image_source_url, i.votes_left, i.votes_right,
              (SELECT GROUP_CONCAT(c.key)
                 FROM item_categories ic
                 JOIN categories c ON c.id = ic.category_id
                WHERE ic.item_id = i.id) AS category_keys
         FROM items i
         JOIN item_translations t ON t.item_id = i.id AND t.lang = 'fr'
        WHERE i.status = 'approved'
        ${categoryFilterSql(categoryKeys, 2, categoryMatch === 'all')}
        ${categoryExcludeSql(excludeKeys, 2 + categoryKeys.length)}
        ORDER BY RANDOM()
        LIMIT ?1`,
    )
      .bind(roundSize, ...categoryKeys, ...excludeKeys)
      .all<{
        id: number;
        label: string;
        image_key: string | null;
        image_author: string | null;
        image_license: string | null;
        image_source_url: string | null;
        votes_left: number;
        votes_right: number;
        category_keys: string | null;
      }>();

    return results.map((r) => ({
      id: r.id,
      label: r.label,
      categoryKeys: r.category_keys ? r.category_keys.split(',') : [],
      imageUrl: r.image_key ? `${this.env.CDN_BASE}/${r.image_key}` : null,
      imageAttribution: r.image_license
        ? {
            author: r.image_author,
            license: r.image_license,
            sourceUrl: r.image_source_url,
          }
        : null,
      votesLeft: r.votes_left,
      votesRight: r.votes_right,
    }));
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
    this.config = null;
    this.phase = 'lobby';
    this.revealIndex = 0;
    for (const ws of this.players.keys()) ws.close(1000, 'room expired');
    this.players.clear();
    this.names.clear();
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
      void this.handle(ws, msg);
    });

    const drop = () => {
      const wasPlayer = this.players.delete(ws);
      if (!wasPlayer) return;
      this.broadcast({ type: 'state', room: this.state });
      // Someone leaving may be the last vote we were waiting on.
      if (this.phase === 'playing') this.maybeReveal();
    };
    ws.addEventListener('close', drop);
    ws.addEventListener('error', drop);
  }

  private async handle(ws: WebSocket, msg: RoomClientMessage) {
    switch (msg.type) {
      case 'join': {
        if (typeof msg.sessionId !== 'string' || msg.sessionId.length > 64) {
          this.send(ws, { type: 'error', message: 'bad session id' });
          return;
        }
        // Nickname is display-only and ephemeral: trimmed, capped, never
        // persisted (dies with the room like votes).
        const name =
          typeof msg.name === 'string' ? msg.name.trim().slice(0, 24) : '';
        this.names.set(msg.sessionId, name || 'Joueur');
        this.players.set(ws, msg.sessionId);
        this.hostId ??= msg.sessionId;
        this.broadcast({ type: 'state', room: this.state });
        // Late/rejoining player during a round: hand them the whole deck so
        // they can swipe it at their own pace (already-cast votes are
        // ignored server-side, so re-swiping is harmless).
        if (this.phase === 'playing') this.sendDeck(ws);
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
        this.broadcast({ type: 'state', room: this.state });
        // Deal the full round to everyone; each player paces themselves.
        for (const player of this.players.keys()) this.sendDeck(player);
        break;
      }

      case 'vote': {
        const sessionId = this.players.get(ws);
        if (!sessionId || this.phase !== 'playing') return;
        const cardCount = this.config?.cards.length ?? 0;
        if (!Number.isInteger(msg.cardIndex)) return;
        if (msg.cardIndex < 0 || msg.cardIndex >= cardCount) return;
        if (msg.side !== 'left' && msg.side !== 'right') return;

        let cardVotes = this.votes.get(msg.cardIndex);
        if (!cardVotes) {
          cardVotes = new Map();
          this.votes.set(msg.cardIndex, cardVotes);
        }
        // One vote per player per card; a re-vote is ignored but must still
        // fall through to the completion check (e.g. a rejoined player's
        // final re-swipe).
        if (!cardVotes.has(sessionId)) cardVotes.set(sessionId, msg.side);

        // Live mode: give the voter the running tally for this card now —
        // no waiting for anyone else.
        if (this.config?.mode === 'live') {
          const { votesLeft, votesRight } = this.tallyOf(msg.cardIndex);
          this.send(ws, {
            type: 'tally',
            cardIndex: msg.cardIndex,
            votesLeft,
            votesRight,
          });
        }

        this.maybeReveal();
        break;
      }

      case 'next': {
        // Host paces the batch-mode reveal: everyone debates the same card,
        // the host moves the room to the next one.
        if (this.players.get(ws) !== this.hostId) {
          this.send(ws, { type: 'error', message: 'host only' });
          return;
        }
        if (this.phase !== 'results' || this.config?.mode !== 'batch') return;
        if (this.revealIndex >= this.config.cards.length) return;
        this.revealIndex += 1;
        this.broadcast({ type: 'state', room: this.state });
        break;
      }

      case 'restart': {
        // Room stays open after a round: from the results screen the host
        // can relaunch with the same players, a fresh random hand and,
        // optionally, new settings (validated like /create).
        if (this.players.get(ws) !== this.hostId) {
          this.send(ws, { type: 'error', message: 'host only' });
          return;
        }
        if (this.phase !== 'results' || !this.config) return;

        const mode: RoomMode =
          msg.mode === 'live' || msg.mode === 'batch'
            ? msg.mode
            : this.config.mode;
        const roundSize = Number.isInteger(msg.roundSize)
          ? Math.min(Math.max(msg.roundSize as number, 5), 50)
          : this.config.cards.length;
        const categoryKeys =
          msg.categoryKeys !== undefined
            ? sanitizeCategoryKeys(msg.categoryKeys)
            : (this.config.categoryKeys ?? []);
        const categoryMatch: CategoryMatch =
          msg.categoryMatch === 'all' || msg.categoryMatch === 'any'
            ? msg.categoryMatch
            : (this.config.categoryMatch ?? 'any');
        const excludeKeys =
          msg.excludeKeys !== undefined
            ? sanitizeCategoryKeys(msg.excludeKeys)
            : (this.config.excludeKeys ?? []);

        const cards = await this.dealCards(
          roundSize,
          categoryKeys,
          categoryMatch,
          excludeKeys,
        );
        // Guard against a duplicate restart racing across the await.
        if (this.phase !== 'results') return;
        if (cards.length === 0) {
          this.send(ws, { type: 'error', message: 'no items available' });
          return;
        }
        this.config = {
          ...this.config,
          mode,
          cards,
          categoryKeys,
          categoryMatch,
          excludeKeys,
        };
        await this.ctx.storage.put('config', this.config);

        this.votes.clear();
        this.currentCardIndex = 0;
        this.revealIndex = 0;
        this.phase = 'playing';
        this.broadcast({ type: 'state', room: this.state });
        for (const player of this.players.keys()) this.sendDeck(player);
        break;
      }
    }
  }

  /** Reveal once every connected player has voted on every card. */
  private maybeReveal() {
    if (this.phase !== 'playing') return;
    const sessions = new Set(this.players.values());
    if (sessions.size === 0) return;
    const cardCount = this.config?.cards.length ?? 0;

    for (const session of sessions) {
      for (let i = 0; i < cardCount; i++) {
        if (!this.votes.get(i)?.has(session)) return; // still voting
      }
    }

    // Batch mode walks the reveal card by card (host-paced, starts at 0);
    // live mode already showed tallies during play, so it jumps straight
    // past the walk to the summary.
    this.revealIndex = this.config?.mode === 'live' ? cardCount : 0;
    this.phase = 'results';
    this.broadcast({ type: 'state', room: this.state });
    this.broadcast(this.revealMessage());
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

  /** Nicknames of who voted each side of a card (for the reveal). */
  private votersOf(index: number): {
    votersLeft: string[];
    votersRight: string[];
  } {
    const votersLeft: string[] = [];
    const votersRight: string[] = [];
    for (const [sessionId, side] of this.votes.get(index) ?? []) {
      const name = this.names.get(sessionId) ?? 'Joueur';
      (side === 'left' ? votersLeft : votersRight).push(name);
    }
    return { votersLeft, votersRight };
  }

  private revealMessage(): RoomServerMessage {
    const results: RoomCardResult[] = (this.config?.cards ?? []).map(
      (card, i) => ({ card, ...this.tallyOf(i), ...this.votersOf(i) }),
    );
    return { type: 'reveal', results };
  }

  private sendDeck(ws: WebSocket) {
    this.send(ws, { type: 'deck', cards: this.config?.cards ?? [] });
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

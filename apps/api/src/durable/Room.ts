import type {
  RoomClientMessage,
  RoomServerMessage,
  RoomState,
} from '@cdgodd/shared';

/**
 * One Durable Object instance per room short-code.
 * M4 will implement full batch-mode play (deal cards, collect votes,
 * reveal). For now: lobby state + join/broadcast so the plumbing works.
 * Vote validity is enforced here (one vote per connected player per card),
 * which makes multiplayer stats immune to external stuffing.
 */
export class Room implements DurableObject {
  private sockets = new Set<WebSocket>();
  private state: RoomState = {
    code: '',
    mode: 'batch',
    phase: 'lobby',
    roundSize: 10,
    playerCount: 0,
    currentCardIndex: 0,
  };

  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.state.code = url.searchParams.get('code') ?? this.state.code;

    if (request.headers.get('upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      this.accept(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // GET /rooms/:code — room meta.
    return Response.json({ room: this.state });
  }

  private accept(ws: WebSocket) {
    ws.accept();
    this.sockets.add(ws);
    this.state.playerCount = this.sockets.size;

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

    ws.addEventListener('close', () => {
      this.sockets.delete(ws);
      this.state.playerCount = this.sockets.size;
      this.broadcast({ type: 'state', room: this.state });
    });

    this.broadcast({ type: 'state', room: this.state });
  }

  private handle(ws: WebSocket, msg: RoomClientMessage) {
    switch (msg.type) {
      case 'join':
        this.broadcast({ type: 'state', room: this.state });
        break;
      case 'start':
        // M4: deal cards from D1, move to 'playing', track votes per card.
        this.state.phase = 'playing';
        this.broadcast({ type: 'state', room: this.state });
        break;
      case 'vote':
        // M4: record vote (one per player per card), reveal when complete.
        this.send(ws, { type: 'error', message: 'not implemented yet' });
        break;
    }
  }

  private send(ws: WebSocket, msg: RoomServerMessage) {
    ws.send(JSON.stringify(msg));
  }

  private broadcast(msg: RoomServerMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.sockets) ws.send(data);
  }
}

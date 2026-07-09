import { env, runDurableObjectAlarm } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { DeckCard, RoomState } from '@cdgodd/shared';
import { api, jsonPost, wsMessages } from './helpers';

function roomStub(code: string): DurableObjectStub {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

function createRoom(
  code: string,
  params: Record<string, string> = {},
): Promise<Response> {
  const qs = new URLSearchParams({ code, ...params });
  return roomStub(code).fetch(`https://room.internal/create?${qs}`, {
    method: 'POST',
  });
}

async function openSocket(code: string): Promise<WebSocket> {
  const res = await roomStub(code).fetch('https://room.internal/ws', {
    headers: { upgrade: 'websocket' },
  });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  ws.accept();
  return ws;
}

function send(ws: WebSocket, msg: unknown): void {
  ws.send(JSON.stringify(msg));
}

describe('Room DO — creation', () => {
  it('creates a lobby with cards dealt from D1', async () => {
    const res = await createRoom('TESTAA', { mode: 'batch', roundSize: '5' });
    expect(res.status).toBe(200);
    const { room } = (await res.json()) as { room: RoomState };
    expect(room).toMatchObject({
      code: 'TESTAA',
      mode: 'batch',
      phase: 'lobby',
      roundSize: 5,
      playerCount: 0,
      hostId: null,
    });
  });

  it('409s on a second create', async () => {
    await createRoom('TESTAB');
    expect((await createRoom('TESTAB')).status).toBe(409);
  });

  it('deals only from the requested categories', async () => {
    const res = await createRoom('TESTAC', {
      roundSize: '5',
      categories: 'food',
    });
    const { room } = (await res.json()) as { room: RoomState };
    // Only 2 approved food items exist — the hand is capped by availability.
    expect(room.roundSize).toBe(2);
  });

  it('503s when no approved items are available', async () => {
    await env.DB.prepare(`UPDATE items SET status = 'pending'`).run();
    const res = await createRoom('TESTAD');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'no items available' });
  });

  it('404s before creation', async () => {
    const res = await roomStub('TESTAE').fetch('https://room.internal/');
    expect(res.status).toBe(404);
  });
});

describe('Room DO — websocket lifecycle (batch)', () => {
  it('join → host start → everyone votes → reveal → restart', async () => {
    await createRoom('TESTBA', { mode: 'batch', roundSize: '5' });

    const wsA = await openSocket('TESTBA');
    const a = wsMessages(wsA);
    send(wsA, { type: 'join', sessionId: 'sess-a', name: 'Alice' });
    let state = (await a.until('state')).room;
    expect(state).toMatchObject({ playerCount: 1, hostId: 'sess-a' });

    const wsB = await openSocket('TESTBA');
    const b = wsMessages(wsB);
    send(wsB, { type: 'join', sessionId: 'sess-b', name: 'Bob' });
    state = (await a.until('state')).room;
    expect(state.playerCount).toBe(2);
    expect(state.players.map((p) => p.name).sort()).toEqual(['Alice', 'Bob']);
    await b.until('state');

    // Guests cannot start the round.
    send(wsB, { type: 'start' });
    expect((await b.until('error')).message).toBe('host only');

    send(wsA, { type: 'start' });
    state = (await a.until('state')).room;
    expect(state.phase).toBe('playing');
    const deckA = (await a.until('deck')).cards as DeckCard[];
    const deckB = (await b.until('deck')).cards as DeckCard[];
    expect(deckA).toHaveLength(5);
    expect(deckA.map((c) => c.id)).toEqual(deckB.map((c) => c.id));

    // Both swipe the whole hand; Alice all left, Bob all right.
    for (let i = 0; i < 5; i++) {
      send(wsA, { type: 'vote', cardIndex: i, side: 'left' });
      send(wsB, { type: 'vote', cardIndex: i, side: 'right' });
    }

    state = (await a.until('state')).room;
    expect(state.phase).toBe('results');
    const reveal = await a.until('reveal');
    expect(reveal.results).toHaveLength(5);
    for (const result of reveal.results) {
      expect(result.votesLeft).toBe(1);
      expect(result.votesRight).toBe(1);
      expect(result.votersLeft).toEqual(['Alice']);
      expect(result.votersRight).toEqual(['Bob']);
    }
    await b.until('reveal');

    // Host restarts with a smaller hand; fresh deck, votes cleared.
    send(wsA, { type: 'restart', roundSize: 5 });
    state = (await a.until('state')).room;
    expect(state.phase).toBe('playing');
    const freshDeck = (await a.until('deck')).cards as DeckCard[];
    expect(freshDeck).toHaveLength(5);
    await b.until('deck');

    // Guests cannot restart either.
    wsA.close();
    wsB.close();
  });

  it('ignores duplicate votes from the same player', async () => {
    await createRoom('TESTBB', { mode: 'live', roundSize: '5' });
    const ws = await openSocket('TESTBB');
    const reader = wsMessages(ws);
    send(ws, { type: 'join', sessionId: 'sess-a', name: 'Solo' });
    await reader.until('state');
    send(ws, { type: 'start' });
    await reader.until('deck');

    // Live mode returns a running tally to the voter after each vote.
    send(ws, { type: 'vote', cardIndex: 0, side: 'left' });
    expect(await reader.until('tally')).toMatchObject({
      cardIndex: 0,
      votesLeft: 1,
      votesRight: 0,
    });
    // Re-vote (other side) is ignored: tally unchanged.
    send(ws, { type: 'vote', cardIndex: 0, side: 'right' });
    expect(await reader.until('tally')).toMatchObject({
      cardIndex: 0,
      votesLeft: 1,
      votesRight: 0,
    });
    ws.close();
  });
});

describe('Room DO — expiry alarm', () => {
  it('wipes the room and 404s afterwards', async () => {
    await createRoom('TESTCA');
    const ran = await runDurableObjectAlarm(roomStub('TESTCA'));
    expect(ran).toBe(true);
    const res = await roomStub('TESTCA').fetch('https://room.internal/');
    expect(res.status).toBe(404);
  });
});

describe('worker-level /rooms proxy', () => {
  it('POST /rooms allocates a valid short code', async () => {
    const res = await api('/rooms', jsonPost({ mode: 'batch', roundSize: 5 }));
    expect(res.status).toBe(200);
    const { room } = (await res.json()) as { room: RoomState };
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(room.phase).toBe('lobby');
  });

  it('GET /rooms/:code returns the room state, lowercase accepted', async () => {
    const created = await api('/rooms', jsonPost({ roundSize: 5 }));
    const { room } = (await created.json()) as { room: RoomState };

    const res = await api(`/rooms/${room.code.toLowerCase()}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { room: RoomState };
    expect(body.room.code).toBe(room.code);
  });

  it('400s on malformed codes', async () => {
    const res = await api('/rooms/BAD1');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid room code' });
  });
});

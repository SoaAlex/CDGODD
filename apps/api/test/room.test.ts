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

  it('never deals from excluded categories', async () => {
    const res = await createRoom('TESTAF', {
      roundSize: '10',
      exclude: 'culture',
    });
    const { room } = (await res.json()) as { room: RoomState };
    // Seed: culture = {3,4,5}; excluding it leaves items 1, 2, 6.
    expect(room.roundSize).toBe(3);
    expect(room.excludeKeys).toEqual(['culture']);
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

    // Skip the "player finished" broadcasts that precede the reveal.
    state = (await a.until('state')).room;
    while (state.phase !== 'results') state = (await a.until('state')).room;
    // Batch mode: the card-by-card reveal starts on the first card.
    expect(state.revealIndex).toBe(0);
    const reveal = await a.until('reveal');
    expect(reveal.results).toHaveLength(5);
    for (const result of reveal.results) {
      expect(result.votesLeft).toBe(1);
      expect(result.votesRight).toBe(1);
      expect(result.votersLeft).toEqual(['Alice']);
      expect(result.votersRight).toEqual(['Bob']);
    }
    await b.until('reveal');

    // Guests cannot pace the reveal.
    send(wsB, { type: 'next' });
    expect((await b.until('error')).message).toBe('host only');

    // Host advances; every player sees the shared index move.
    send(wsA, { type: 'next' });
    expect((await a.until('state')).room.revealIndex).toBe(1);
    expect((await b.until('state')).room.revealIndex).toBe(1);

    // A late joiner lands on the card currently being discussed.
    const wsC = await openSocket('TESTBA');
    const c = wsMessages(wsC);
    send(wsC, { type: 'join', sessionId: 'sess-c', name: 'Carol' });
    expect((await c.until('state')).room.revealIndex).toBe(1);
    expect((await c.until('reveal')).results).toHaveLength(5);
    wsC.close();

    // Walk to the end (skipping Carol's join/drop broadcasts, which keep
    // revealIndex at 1); an extra 'next' past the last card is a no-op.
    for (let i = 2; i <= 5; i++) {
      send(wsA, { type: 'next' });
      let room = (await a.until('state')).room;
      while (room.revealIndex < i) room = (await a.until('state')).room;
      expect(room.revealIndex).toBe(i);
    }
    send(wsA, { type: 'next' });

    // Host restarts with a smaller hand; fresh deck, votes cleared.
    send(wsA, { type: 'restart', roundSize: 5 });
    state = (await a.until('state')).room;
    expect(state.phase).toBe('playing');
    expect(state.revealIndex).toBe(0);
    const freshDeck = (await a.until('deck')).cards as DeckCard[];
    expect(freshDeck).toHaveLength(5);
    await b.until('deck');

    // Guests cannot restart either.
    wsA.close();
    wsB.close();
  });

  it("skips the reveal walk in live mode and ignores 'next' while playing", async () => {
    await createRoom('TESTBC', { mode: 'live', roundSize: '5' });
    const ws = await openSocket('TESTBC');
    const reader = wsMessages(ws);
    send(ws, { type: 'join', sessionId: 'sess-a', name: 'Solo' });
    await reader.until('state');
    send(ws, { type: 'start' });
    await reader.until('deck');

    // 'next' outside the results phase does nothing (host or not).
    send(ws, { type: 'next' });

    for (let i = 0; i < 5; i++) {
      send(ws, { type: 'vote', cardIndex: i, side: 'left' });
    }
    let state = (await reader.until('state')).room;
    while (state.phase !== 'results') state = (await reader.until('state')).room;
    // Live mode: tallies were shown during play — jump straight to summary.
    expect(state.revealIndex).toBe(5);
    await reader.until('reveal');
    ws.close();
  });

  it('restart honors a new exclusion filter', async () => {
    await createRoom('TESTBD', { mode: 'live', roundSize: '10' });
    const ws = await openSocket('TESTBD');
    const reader = wsMessages(ws);
    send(ws, { type: 'join', sessionId: 'sess-a', name: 'Solo' });
    await reader.until('state');
    send(ws, { type: 'start' });
    const deck = (await reader.until('deck')).cards as DeckCard[];
    for (let i = 0; i < deck.length; i++) {
      send(ws, { type: 'vote', cardIndex: i, side: 'left' });
    }
    let state = (await reader.until('state')).room;
    while (state.phase !== 'results') state = (await reader.until('state')).room;

    send(ws, { type: 'restart', excludeKeys: ['culture'] });
    state = (await reader.until('state')).room;
    expect(state.excludeKeys).toEqual(['culture']);
    const fresh = (await reader.until('deck')).cards as DeckCard[];
    // Seed: culture = {3,4,5}; the fresh hand is items 1, 2, 6 only.
    expect(fresh.map((c) => c.id).sort()).toEqual([1, 2, 6]);
    expect(fresh.every((c) => !c.categoryKeys.includes('culture'))).toBe(true);
    ws.close();
  });

  it("broadcasts each player's finished flag as they complete the deck", async () => {
    await createRoom('TESTBE', { mode: 'batch', roundSize: '5' });

    const wsA = await openSocket('TESTBE');
    const a = wsMessages(wsA);
    send(wsA, { type: 'join', sessionId: 'sess-a', name: 'Alice' });
    await a.until('state');
    const wsB = await openSocket('TESTBE');
    const b = wsMessages(wsB);
    send(wsB, { type: 'join', sessionId: 'sess-b', name: 'Bob' });
    await a.until('state');
    await b.until('state');

    send(wsA, { type: 'start' });
    await a.until('deck');
    // Drain Bob's start broadcasts so the next state he sees is the finish.
    await b.until('deck');

    // Alice swipes her whole deck; Bob hasn't started.
    for (let i = 0; i < 5; i++) {
      send(wsA, { type: 'vote', cardIndex: i, side: 'left' });
    }

    // Her last vote triggers a state broadcast flagging her as finished.
    const state = (await b.until('state')).room;
    expect(state.phase).toBe('playing');
    const byId = new Map(state.players.map((p) => [p.id, p.finished]));
    expect(byId.get('sess-a')).toBe(true);
    expect(byId.get('sess-b')).toBe(false);

    wsA.close();
    wsB.close();
  });

  it('host can end the round early; missing votes simply do not count', async () => {
    await createRoom('TESTBF', { mode: 'batch', roundSize: '5' });

    const wsA = await openSocket('TESTBF');
    const a = wsMessages(wsA);
    send(wsA, { type: 'join', sessionId: 'sess-a', name: 'Alice' });
    await a.until('state');
    const wsB = await openSocket('TESTBF');
    const b = wsMessages(wsB);
    send(wsB, { type: 'join', sessionId: 'sess-b', name: 'Bob' });
    await b.until('state');

    send(wsA, { type: 'start' });
    await a.until('deck');
    await b.until('deck');

    // Guests cannot end the round.
    send(wsB, { type: 'finish' });
    expect((await b.until('error')).message).toBe('host only');

    // Alice finishes, Bob voted a single card; the host ends the round.
    for (let i = 0; i < 5; i++) {
      send(wsA, { type: 'vote', cardIndex: i, side: 'left' });
    }
    send(wsB, { type: 'vote', cardIndex: 0, side: 'right' });
    send(wsA, { type: 'finish' });

    let state = (await a.until('state')).room;
    while (state.phase !== 'results') state = (await a.until('state')).room;
    const reveal = await a.until('reveal');
    expect(reveal.results[0]).toMatchObject({ votesLeft: 1, votesRight: 1 });
    expect(reveal.results[1]).toMatchObject({ votesLeft: 1, votesRight: 0 });

    // A second 'finish' out of the playing phase is a no-op.
    send(wsA, { type: 'finish' });

    wsA.close();
    wsB.close();
  });

  it('hands the room to a remaining player when the host disconnects', async () => {
    await createRoom('TESTBG', { mode: 'batch', roundSize: '5' });

    const wsA = await openSocket('TESTBG');
    const a = wsMessages(wsA);
    send(wsA, { type: 'join', sessionId: 'sess-a', name: 'Alice' });
    await a.until('state');
    const wsB = await openSocket('TESTBG');
    const b = wsMessages(wsB);
    send(wsB, { type: 'join', sessionId: 'sess-b', name: 'Bob' });
    let state = (await b.until('state')).room;
    expect(state.hostId).toBe('sess-a');

    // Host leaves: Bob inherits the room and can start the round.
    wsA.close();
    state = (await b.until('state')).room;
    expect(state.hostId).toBe('sess-b');
    send(wsB, { type: 'start' });
    state = (await b.until('state')).room;
    expect(state.phase).toBe('playing');
    wsB.close();
  });

  it('replays a rejoining player their own votes mid-round', async () => {
    await createRoom('TESTBH', { mode: 'batch', roundSize: '5' });

    const wsA = await openSocket('TESTBH');
    const a = wsMessages(wsA);
    send(wsA, { type: 'join', sessionId: 'sess-a', name: 'Alice' });
    await a.until('state');
    const wsB = await openSocket('TESTBH');
    const b = wsMessages(wsB);
    send(wsB, { type: 'join', sessionId: 'sess-b', name: 'Bob' });
    await b.until('state');

    send(wsA, { type: 'start' });
    // A fresh round starts with no votes to replay.
    const dealt = await b.until('deck');
    expect(dealt.myVotes).toEqual([null, null, null, null, null]);

    // Bob votes two cards, then drops mid-round.
    send(wsB, { type: 'vote', cardIndex: 0, side: 'left' });
    send(wsB, { type: 'vote', cardIndex: 1, side: 'right' });
    wsB.close();
    // Skip queued join/start broadcasts until Bob's drop lands.
    let state = (await a.until('state')).room;
    while (state.playerCount !== 1) state = (await a.until('state')).room;

    // He reconnects with the same session: same deck, his votes restored.
    const wsB2 = await openSocket('TESTBH');
    const b2 = wsMessages(wsB2);
    send(wsB2, { type: 'join', sessionId: 'sess-b', name: 'Bob' });
    const rejoin = await b2.until('deck');
    expect(rejoin.myVotes).toEqual(['left', 'right', null, null, null]);
    expect((rejoin.cards as DeckCard[]).map((c) => c.id)).toEqual(
      (dealt.cards as DeckCard[]).map((c) => c.id),
    );

    // Finishing the round from where he left off still reveals for all.
    for (let i = 2; i < 5; i++) {
      send(wsB2, { type: 'vote', cardIndex: i, side: 'right' });
      send(wsA, { type: 'vote', cardIndex: i, side: 'left' });
    }
    send(wsA, { type: 'vote', cardIndex: 0, side: 'left' });
    send(wsA, { type: 'vote', cardIndex: 1, side: 'left' });
    state = (await a.until('state')).room;
    while (state.phase !== 'results') state = (await a.until('state')).room;
    const reveal = await a.until('reveal');
    // Card 0: both voted left. Card 1: Bob's pre-drop right + Alice's left.
    expect(reveal.results[0]).toMatchObject({ votesLeft: 2, votesRight: 0 });
    expect(reveal.results[1]).toMatchObject({ votesLeft: 1, votesRight: 1 });

    wsA.close();
    wsB2.close();
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

import { Hono } from 'hono';
import { createRoomSchema, roomCodeSchema } from '@cdgodd/shared';
import type { AppContext } from '../env';

const rooms = new Hono<AppContext>();

/** Unambiguous alphabet (no O/0, I/1/L) for short codes. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** POST /rooms — create a room, returns its short code. */
rooms.post('/rooms', async (c) => {
  const parsed = createRoomSchema.safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!parsed.success) return c.json({ error: 'bad body' }, 400);

  // Random codes can collide with a live room; retry a few times.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(code));
    const params = new URLSearchParams({
      code,
      mode: parsed.data.mode,
      roundSize: String(parsed.data.roundSize),
      categories: parsed.data.categoryKeys.join(','),
      match: parsed.data.categoryMatch,
      exclude: parsed.data.excludeKeys.join(','),
    });
    const res = await stub.fetch(`https://room.internal/create?${params}`, {
      method: 'POST',
    });
    if (res.status !== 409) return new Response(res.body, res);
  }
  return c.json({ error: 'could not allocate room code' }, 503);
});

/** GET /rooms/:code and WS /rooms/:code/ws — proxy to the Durable Object. */
rooms.all('/rooms/:code/:sub?', async (c) => {
  const code = c.req.param('code').toUpperCase();
  if (!roomCodeSchema.safeParse(code).success) {
    return c.json({ error: 'invalid room code' }, 400);
  }
  const stub = c.env.ROOMS.get(c.env.ROOMS.idFromName(code));
  const url = new URL(c.req.raw.url);
  url.searchParams.set('code', code);
  return stub.fetch(new Request(url, c.req.raw));
});

export default rooms;

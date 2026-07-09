import { SELF } from 'cloudflare:test';
import type { RoomServerMessage } from '@cdgodd/shared';

/** Deterministic UUID-v4-shaped session ids for tests. */
export const SESSION_A = '11111111-1111-4111-8111-111111111111';
export const SESSION_B = '22222222-2222-4222-8222-222222222222';

export const ADMIN_HEADERS = { authorization: 'Bearer test-admin-token' };

/** Fetch against the worker under test. */
export function api(path: string, init?: RequestInit): Promise<Response> {
  return SELF.fetch(`https://test.local${path}`, init);
}

/** JSON POST init with an optional session header. */
export function jsonPost(
  body: unknown,
  headers: Record<string, string> = {},
): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

/** Cast a vote as a given session (turnstile bypassed: no secret in tests). */
export function vote(
  itemId: number,
  side: 'left' | 'right',
  sessionId: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return api(
    `/items/${itemId}/vote`,
    jsonPost(
      { side, turnstileToken: 'dev' },
      { 'x-session-id': sessionId, ...extraHeaders },
    ),
  );
}

/**
 * Ordered reader over a Room WebSocket: `next()` resolves the next server
 * message, `until(type)` skips ahead to the next message of that type.
 */
export function wsMessages(ws: WebSocket) {
  const queue: RoomServerMessage[] = [];
  const waiters: Array<(msg: RoomServerMessage) => void> = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(
      String((event as MessageEvent).data),
    ) as RoomServerMessage;
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else queue.push(msg);
  });
  return {
    next(): Promise<RoomServerMessage> {
      const queued = queue.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise((resolve) => waiters.push(resolve));
    },
    async until<T extends RoomServerMessage['type']>(
      type: T,
    ): Promise<Extract<RoomServerMessage, { type: T }>> {
      for (;;) {
        const msg = await this.next();
        if (msg.type === type) {
          return msg as Extract<RoomServerMessage, { type: T }>;
        }
      }
    },
  };
}

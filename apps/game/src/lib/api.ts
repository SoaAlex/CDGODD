import type {
  DeckResponse,
  Side,
  VoteResponse,
} from '@cdgodd/shared';
import { getSessionId } from './session';

/** Point at `wrangler dev` locally; set EXPO_PUBLIC_API_URL for prod builds. */
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionId = await getSessionId();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-session-id': sessionId,
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

export function fetchDeck(cursor?: number, limit = 25): Promise<DeckResponse> {
  const params = new URLSearchParams({ lang: 'fr', limit: String(limit) });
  if (cursor !== undefined) params.set('cursor', String(cursor));
  return request<DeckResponse>(`/deck?${params}`);
}

export function castVote(itemId: number, side: Side): Promise<VoteResponse> {
  return request<VoteResponse>(`/items/${itemId}/vote`, {
    method: 'POST',
    // Turnstile wiring lands in M5; the API skips verification in dev mode.
    body: JSON.stringify({ side, turnstileToken: 'dev' }),
  });
}

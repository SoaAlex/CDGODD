import type {
  CreateRoomResponse,
  DeckResponse,
  SearchResponse,
  Side,
  SubmissionResponse,
  VoteResponse,
} from '@cdgodd/shared';
import { getSessionId } from './session';
import { getTurnstileToken } from './turnstile';

/** Point at `wrangler dev` locally; set EXPO_PUBLIC_API_URL for prod builds. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

/** ws(s):// equivalent of API_BASE, for room WebSockets. */
export const WS_BASE = API_BASE.replace(/^http/, 'ws');

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

export async function castVote(
  itemId: number,
  side: Side,
): Promise<VoteResponse> {
  const turnstileToken = await getTurnstileToken();
  return request<VoteResponse>(`/items/${itemId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ side, turnstileToken }),
  });
}

export function searchItems(q: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ q, lang: 'fr' });
  return request<SearchResponse>(`/items/search?${params}`);
}

export async function submitItem(label: string): Promise<SubmissionResponse> {
  const turnstileToken = await getTurnstileToken();
  return request<SubmissionResponse>('/submissions', {
    method: 'POST',
    body: JSON.stringify({ label, lang: 'fr', turnstileToken }),
  });
}

export async function reportItem(
  itemId: number,
  reason?: string,
): Promise<void> {
  const turnstileToken = await getTurnstileToken();
  return request(`/items/${itemId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason, turnstileToken }),
  });
}

export function fetchTallies(
  ids: number[],
): Promise<{ tallies: VoteResponse['tally'][] }> {
  return request(`/items/tallies?ids=${ids.join(',')}`);
}

export function createRoom(
  mode: 'batch' | 'live',
  roundSize: number,
): Promise<CreateRoomResponse> {
  return request<CreateRoomResponse>('/rooms', {
    method: 'POST',
    body: JSON.stringify({ mode, roundSize }),
  });
}

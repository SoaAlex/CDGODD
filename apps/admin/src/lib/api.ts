// Prod builds point straight at the API worker; dev uses the Vite proxy.
export const API = import.meta.env.VITE_API_URL ?? '/api';

/** Bearer header for every authenticated admin call. */
export function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/** Public URL for an item's stored image. */
export function imageUrl(imageKey: string): string {
  return `${API}/img/${imageKey}`;
}

/** GET a JSON endpoint with the admin bearer token; throws on non-2xx. */
export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return (await res.json()) as T;
}

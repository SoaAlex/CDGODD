import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ids of cards already swiped in solo mode. Stored on-device only
 * (AsyncStorage) — the backend never tracks per-player history, in line
 * with the anonymous, GDPR-friendly design. The deck filters these out
 * client-side so a returning player only gets cards they haven't voted on.
 */
const KEY = 'cdgodd.seen_items';
/** Storage cap; oldest ids fall off first (ids are kept in insertion order). */
const MAX_IDS = 5000;

// Single in-memory set shared by all callers, loaded from storage once.
let cache: Promise<Set<number>> | null = null;

async function load(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

export function getSeen(): Promise<Set<number>> {
  cache ??= load();
  return cache;
}

/** Adds an id and persists. Best-effort: a write failure loses nothing vital. */
export async function markSeen(id: number): Promise<void> {
  const seen = await getSeen();
  if (seen.has(id)) return;
  seen.add(id);
  try {
    let ids = [...seen];
    if (ids.length > MAX_IDS) ids = ids.slice(ids.length - MAX_IDS);
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* seen tracking is best-effort */
  }
}

/** Forget everything — the player chose to replay the whole deck. */
export async function clearSeen(): Promise<void> {
  cache = Promise.resolve(new Set());
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}

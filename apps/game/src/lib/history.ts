import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Side } from '@cdgodd/shared';

/**
 * Local vote history. Stored on-device only (AsyncStorage) — the backend
 * never keeps per-player browsing history, in line with the anonymous,
 * GDPR-friendly design. Resetting the session does not clear it; it's
 * the player's own record.
 */
export interface HistoryEntry {
  itemId: number;
  side: Side;
  label: string;
  imageUrl: string | null;
  at: number; // epoch ms
}

const KEY = 'cdgodd.vote_history';
const MAX_ENTRIES = 200;

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Prepends a vote; an item re-voted moves to the top (single entry). */
export async function recordVote(entry: HistoryEntry): Promise<void> {
  try {
    const history = await getHistory();
    const rest = history.filter((h) => h.itemId !== entry.itemId);
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify([entry, ...rest].slice(0, MAX_ENTRIES)),
    );
  } catch {
    /* history is best-effort */
  }
}

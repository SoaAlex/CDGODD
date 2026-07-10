import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Anonymous device session id (UUID v4). Not tied to any account or
 * person — used only for vote dedupe server-side. Cycling it doesn't
 * grant extra votes: the API caps votes per item per ip_hash.
 */
const KEY = 'cdgodd.session_id';

let cached: string | null = null;

export async function getSessionId(): Promise<string> {
  if (cached) return cached;
  const stored = await AsyncStorage.getItem(KEY);
  if (stored) {
    cached = stored;
    return stored;
  }
  const fresh = crypto.randomUUID();
  await AsyncStorage.setItem(KEY, fresh);
  cached = fresh;
  return fresh;
}


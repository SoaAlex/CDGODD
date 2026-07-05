import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Anonymous, resettable device session id (UUID v4). Not tied to any
 * account or person — used only for vote dedupe server-side. Resetting
 * it (Settings) is always allowed; abuse is handled by IP rate limits.
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

export async function resetSessionId(): Promise<string> {
  cached = null;
  await AsyncStorage.removeItem(KEY);
  return getSessionId();
}

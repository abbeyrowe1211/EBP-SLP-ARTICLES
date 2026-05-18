// ─── Last Read Store ──────────────────────────────────────────────────────────
// Persists the most recently opened article ID + timestamp to AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ebp_last_read_article_v2';

interface LastReadEntry { id: string; ts: number; }

let _cached: LastReadEntry | null = null;
const _listeners: Set<(entry: LastReadEntry | null) => void> = new Set();

export async function loadLastRead(): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(KEY);
    if (!val) {
      // Migrate from old key format (just an id string)
      const legacy = await AsyncStorage.getItem('ebp_last_read_article_id');
      if (legacy) {
        _cached = { id: legacy, ts: Date.now() };
        await AsyncStorage.setItem(KEY, JSON.stringify(_cached));
      }
      return legacy;
    }
    _cached = JSON.parse(val) as LastReadEntry;
    return _cached.id;
  } catch {
    return null;
  }
}

export async function loadLastReadEntry(): Promise<LastReadEntry | null> {
  await loadLastRead();
  return _cached;
}

export async function setLastRead(id: string): Promise<void> {
  try {
    _cached = { id, ts: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(_cached));
    _listeners.forEach((fn) => fn(_cached));
  } catch {
    // ignore
  }
}

export function getLastReadCached(): string | null {
  return _cached?.id ?? null;
}

export function subscribeLastRead(fn: (entry: LastReadEntry | null) => void) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ─── Saved Articles Store ─────────────────────────────────────────────────────
// Persists bookmarked article IDs to AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ebp_slp_saved_articles_v1';

let _cached: Set<string> | null = null;
const _listeners: Set<() => void> = new Set();

async function load(): Promise<Set<string>> {
  if (_cached) return _cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    _cached = new Set(raw ? JSON.parse(raw) : []);
  } catch {
    _cached = new Set();
  }
  return _cached;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify([...(_cached ?? [])]));
    _listeners.forEach((fn) => fn());
  } catch { /* ignore */ }
}

export async function getSavedArticleIds(): Promise<Set<string>> {
  return load();
}

export async function isArticleSaved(id: string): Promise<boolean> {
  const saved = await load();
  return saved.has(id);
}

export async function toggleSavedArticle(id: string): Promise<boolean> {
  const saved = await load();
  if (saved.has(id)) {
    saved.delete(id);
  } else {
    saved.add(id);
  }
  await persist();
  return saved.has(id);
}

export function subscribeSavedArticles(fn: () => void) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ─── Recently Viewed Store ─────────────────────────────────────────────────────
// Tracks the last 5 articles the user has opened, newest first.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ebp_recently_viewed_v1';
const MAX = 5;

interface ViewedEntry { id: string; ts: number; }

let _cached: ViewedEntry[] = [];
const _listeners: Set<(ids: string[]) => void> = new Set();

export async function loadRecentlyViewed(): Promise<string[]> {
  try {
    const val = await AsyncStorage.getItem(KEY);
    if (!val) return [];
    _cached = JSON.parse(val) as ViewedEntry[];
    return _cached.map((e) => e.id);
  } catch {
    return [];
  }
}

export async function pushRecentlyViewed(id: string): Promise<void> {
  try {
    const val = await AsyncStorage.getItem(KEY);
    let entries: ViewedEntry[] = val ? JSON.parse(val) : [];
    // Remove existing entry for this id (de-duplicate)
    entries = entries.filter((e) => e.id !== id);
    // Prepend new entry
    entries.unshift({ id, ts: Date.now() });
    // Keep only MAX entries
    entries = entries.slice(0, MAX);
    _cached = entries;
    await AsyncStorage.setItem(KEY, JSON.stringify(entries));
    _listeners.forEach((fn) => fn(entries.map((e) => e.id)));
  } catch {
    // Silently fail
  }
}

export function getRecentlyViewedCached(): string[] {
  return _cached.map((e) => e.id);
}

export function subscribeRecentlyViewed(fn: (ids: string[]) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

// ─── Remote Articles Service ──────────────────────────────────────────────────
// Fetches the article list from GitHub and caches it in AsyncStorage.
// The app always starts with the bundled articles, then silently upgrades
// to the latest remote list in the background.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Article } from '@/data/articles';

const REMOTE_URL =
  'https://raw.githubusercontent.com/abbeyrowe1211/EBP-SLP-ARTICLES/main/articles.json';

const CACHE_KEY = 'ebp_slp_remote_articles_v2';

// ─── Get cached articles (fast, sync-ish) ────────────────────────────────────

export async function getCachedRemoteArticles(): Promise<Article[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as Article[];
  } catch {
    return null;
  }
}

// ─── Fetch from GitHub and update cache ──────────────────────────────────────

export async function fetchAndCacheRemoteArticles(): Promise<Article[] | null> {
  try {
    const res = await fetch(REMOTE_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return data as Article[];
  } catch {
    return null;
  }
}

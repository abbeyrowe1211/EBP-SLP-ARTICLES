// ─── Recently added articles tracking ─────────────────────────────────────────
// Automatically detects which articles are new since the app last checked in,
// by diffing the live (remote-synced) article list against the set of IDs
// we've seen before. Nothing to hand-maintain anymore — this updates itself
// the moment new articles are pushed to the GitHub article feed, no app
// update required. Drives the bell dot / "Recently added" panel on Home.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Article } from './articles';

const KEY_KNOWN_IDS = 'ebp_slp_known_article_ids_v1';
const KEY_PENDING_NEW_IDS = 'ebp_slp_pending_new_ids_v1';
export const NEW_ARTICLES_SEEN_KEY = 'ebp_slp_seen_articles_v2';

// Cap how many "new" articles stay queued at once so the panel never floods.
const MAX_PENDING = 30;

/**
 * Call whenever a fresh remote article list loads. Diffs it against the
 * previously known ID set and records any genuinely new IDs.
 *
 * Returns the newly-detected articles (empty on the very first run for a
 * given device — including right after this feature ships to existing
 * users — since there's nothing to compare against yet, and we don't want
 * to flag the entire existing catalog as "new").
 */
export async function detectNewArticles(articles: Article[]): Promise<Article[]> {
  try {
    const knownRaw = await AsyncStorage.getItem(KEY_KNOWN_IDS);
    const currentIds = articles.map((a) => a.id);

    if (!knownRaw) {
      // First time this device has run the detector — seed the known set
      // with everything currently in the library and stop there.
      await AsyncStorage.setItem(KEY_KNOWN_IDS, JSON.stringify(currentIds));
      return [];
    }

    const known = new Set<string>(JSON.parse(knownRaw));
    const newlyAppeared = articles.filter((a) => !known.has(a.id));
    if (newlyAppeared.length === 0) return [];

    currentIds.forEach((id) => known.add(id));
    await AsyncStorage.setItem(KEY_KNOWN_IDS, JSON.stringify([...known]));

    const pendingRaw = await AsyncStorage.getItem(KEY_PENDING_NEW_IDS);
    const pendingSet = new Set<string>(pendingRaw ? JSON.parse(pendingRaw) : []);
    newlyAppeared.forEach((a) => pendingSet.add(a.id));
    const nextPending = [...pendingSet].slice(-MAX_PENDING);
    await AsyncStorage.setItem(KEY_PENDING_NEW_IDS, JSON.stringify(nextPending));

    return newlyAppeared;
  } catch {
    return [];
  }
}

/** Current pending "new" article IDs — feeds the bell dot / panel. */
export async function getPendingNewArticleIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PENDING_NEW_IDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearAllPendingNewArticles(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PENDING_NEW_IDS, JSON.stringify([]));
  } catch {}
}

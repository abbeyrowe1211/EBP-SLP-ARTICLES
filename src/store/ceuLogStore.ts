// ─── CEU Reading Log Store ────────────────────────────────────────────────────
// Persists articles the clinician has explicitly marked for CEU credit.
// Each entry is manually added — nothing is auto-logged.

import AsyncStorage from '@react-native-async-storage/async-storage';

const CEU_LOG_KEY = 'ebp_slp_ceu_log_v1';

export interface CeuEntry {
  articleId: string;
  title: string;
  shortTitle: string;
  evidenceLevel: string;
  evidenceType: string;
  areas: string[];
  journal: string;
  year: number;
  markedAt: string; // ISO date string
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getCeuLog(): Promise<CeuEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(CEU_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isMarkedForCeu(articleId: string): Promise<boolean> {
  const log = await getCeuLog();
  return log.some((e) => e.articleId === articleId);
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Toggle CEU status for an article.
 * Returns `true` if the article is now marked, `false` if it was removed.
 */
export async function toggleCeuEntry(entry: CeuEntry): Promise<boolean> {
  const log = await getCeuLog();
  const exists = log.some((e) => e.articleId === entry.articleId);
  if (exists) {
    const updated = log.filter((e) => e.articleId !== entry.articleId);
    await AsyncStorage.setItem(CEU_LOG_KEY, JSON.stringify(updated));
    return false;
  } else {
    log.unshift(entry); // newest first
    await AsyncStorage.setItem(CEU_LOG_KEY, JSON.stringify(log));
    return true;
  }
}

export async function removeCeuEntry(articleId: string): Promise<void> {
  const log = await getCeuLog();
  const updated = log.filter((e) => e.articleId !== articleId);
  await AsyncStorage.setItem(CEU_LOG_KEY, JSON.stringify(updated));
}

export async function clearCeuLog(): Promise<void> {
  await AsyncStorage.removeItem(CEU_LOG_KEY);
}

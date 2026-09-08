// ─── Article of the Week Service ─────────────────────────────────────────────
// Schedules a weekly local notification every Monday at 9 AM featuring the
// same deterministic "article of the week" shown on the Home screen card, so
// the notification and the in-app card always agree on which article is
// featured that week. Both derive from getArticleOfWeek() below.
//
// Requires expo-notifications (already installed).

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Article } from '@/data/articles';
import { getArticles } from '@/context/ArticlesContext';
import { requestNotifPermission } from '@/services/notificationService';

const KEY_AOW_ENABLED = 'ebp_slp_aow_enabled_v1';
const KEY_AOW_DAY     = 'ebp_slp_aow_day_v1';  // 1=Sun, 2=Mon … 7=Sat (default 2 = Monday)
const KEY_AOW_HOUR    = 'ebp_slp_aow_hour_v1'; // 0–23 (default 9)
const AOW_BATCH       = 10; // weeks ahead to schedule
const AOW_REFILL_AT   = 3;  // refill when fewer than this remain queued

// ─── Deterministic article-of-the-week pick ──────────────────────────────────
// Same formula the Home screen card uses, so a scheduled notification for a
// given week always matches whatever the card will show that same week.
// weekOffset: 0 = this week, 1 = next week, etc.

export function getArticleOfWeek(articles: Article[], weekOffset: number = 0): Article | null {
  if (!articles.length) return null;
  const eligible = articles.filter((a) => a.isTreatmentFocused !== false);
  if (!eligible.length) return null;
  const evScore: Record<string, number> = { '1a': 4, '1b': 3, '2': 2, '3': 1 };
  const curYear = new Date().getFullYear();
  const scored = eligible.map((a) => ({
    article: a,
    score: (evScore[a.evidenceLevel] ?? 1) * 3
      + Math.max(0, 3 - Math.floor((curYear - a.year) / 5)),
  }));
  const top = scored.sort((a, b) => b.score - a.score).slice(0, 24);
  // Anchor week boundaries to Monday 00:00 UTC. Jan 1 1970 was a Thursday,
  // so a flat epoch-ms/week division rotates on Thursdays instead -- this
  // +3 day offset shifts the boundary to Monday.
  const daysSinceEpoch = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
 const weekIdx = Math.floor((daysSinceEpoch + 3) / 7) + weekOffset;
  return top[((weekIdx % top.length) + top.length) % top.length].article;
}

// ─── Getters / setters ────────────────────────────────────────────────────────

export async function getAowEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY_AOW_ENABLED);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function getAowDay(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_AOW_DAY);
    return raw ? parseInt(raw, 10) : 2; // default Monday
  } catch {
    return 2;
  }
}

export async function setAowDay(day: number): Promise<void> {
  await AsyncStorage.setItem(KEY_AOW_DAY, String(day));
  const enabled = await getAowEnabled();
  if (enabled) {
    await cancelAowNotifications();
    await scheduleAowBatch();
  }
}

export async function getAowHour(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_AOW_HOUR);
    return raw ? parseInt(raw, 10) : 9; // default 9 AM
  } catch {
    return 9;
  }
}

export async function setAowHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(KEY_AOW_HOUR, String(hour));
  const enabled = await getAowEnabled();
  if (enabled) {
    await cancelAowNotifications();
    await scheduleAowBatch();
  }
}

export async function setAowEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_AOW_ENABLED, enabled ? 'true' : 'false');
  if (enabled) {
    const granted = await requestNotifPermission();
    if (!granted) throw new Error('notification_permission_denied');
    await scheduleAowBatch();
  } else {
    await cancelAowNotifications();
  }
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelAowNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => (n.content.data as any)?.type === 'articleOfWeek')
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {}
}

// ─── Schedule batch ───────────────────────────────────────────────────────────

async function scheduleAowBatch(): Promise<void> {
  // Get stored day/hour preferences (day: 1=Sun … 7=Sat → JS weekday 0=Sun … 6=Sat)
  const [storedDay, storedHour] = await Promise.all([getAowDay(), getAowHour()]);
  const jsWeekday = storedDay - 1;

  const now = new Date();
  const daysUntilTarget = ((jsWeekday - now.getDay() + 7) % 7) || 7; // at least 1 day ahead
  const firstTarget = new Date(now);
  firstTarget.setDate(now.getDate() + daysUntilTarget);
  firstTarget.setHours(storedHour, 0, 0, 0);

  // Use whatever article list the Home screen card is currently showing
  // (bundled at first launch, then the live GitHub-synced list once it loads)
  // so the notification and the card can never point at different pools.
  const currentArticles = getArticles();

  for (let i = 0; i < AOW_BATCH; i++) {
    const article = getArticleOfWeek(currentArticles, i);
    if (!article) continue;

    const fireMs = firstTarget.getTime() + i * 7 * 24 * 60 * 60 * 1000;
    const secondsFromNow = Math.floor((fireMs - Date.now()) / 1000);
    if (secondsFromNow <= 0) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📖 Article of the Week',
        body: `${article.shortTitle} — ${article.areas[0]} · Open EBP-SLP to explore.`,
        data: { type: 'articleOfWeek', articleId: article.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
        repeats: false,
      },
    });
  }
}

// ─── Refill ───────────────────────────────────────────────────────────────────
// Call on every app open to keep the queue topped up.

export async function refillAowNotifications(): Promise<void> {
  try {
    const enabled = await getAowEnabled();
    if (!enabled) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const remaining = scheduled.filter(
      (n) => (n.content.data as any)?.type === 'articleOfWeek',
    ).length;
    if (remaining < AOW_REFILL_AT) {
      await scheduleAowBatch();
    }
  } catch {
    // Silently fail — don't disrupt app launch
  }
}

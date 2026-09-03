// ─── Notification Service ─────────────────────────────────────────────────────
// Schedules on-device local notifications for new article reminders
// and weekly motivation nudges. No backend required.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotifFrequency = 'off' | 'weekly' | 'monthly' | 'on-update';

const KEY_FREQ         = 'ebp_slp_notif_frequency_v2';
const KEY_DAY          = 'ebp_slp_notif_day_v1';        // 1–7 (1=Sun, 2=Mon … 7=Sat)
const KEY_HOUR         = 'ebp_slp_notif_hour_v1';       // 0–23
const KEY_MOTIV_HOUR   = 'ebp_slp_notif_motiv_hour_v1'; // separate hour for motivation nudges
const KEY_MOTIV_DAY    = 'ebp_slp_notif_motiv_day_v1';  // 1–7 (default 4 = Wednesday)
const KEY_MOTIVATION   = 'ebp_slp_notif_motivation_v1';
const KEY_MOTIV_IDX    = 'ebp_slp_notif_motivation_idx_v1';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CONTENT = {
  title: 'New research may be available',
  body: 'Tap to check the latest articles in EBP-SLP.',
};

const NEW_ARTICLES_CONTENT = {
  title: '📚 New articles added',
  body: 'New evidence-based articles are now available in EBP-SLP. Tap to explore.',
};

// ─── Motivation content pool ──────────────────────────────────────────────────
// Mix of: weekly nudges · motivational quotes · fun/sassy tips
// Rotates so users see something different each week.

const MOTIVATION_POOL: { title: string; body: string }[] = [
  // Nudges
  { title: '📚 Evidence check', body: "Evidence doesn't browse itself. Open EBP-SLP and see what's new." },
  { title: '🔍 Research corner', body: 'New articles might be waiting. Your clients will thank you for looking.' },
  { title: '📖 Quick EBP win', body: '5 minutes of research is worth an hour of guesswork.' },
  { title: 'Keep learning', body: 'The best SLPs never stop checking the evidence. Sound like anyone you know? 👀' },
  { title: 'Your clients are waiting', body: 'New research, stronger practice. Take a peek.' },
  { title: '✅ Weekly check-in', body: 'Review one article today. Your future self will thank you.' },
  // Motivational quotes / identity
  { title: 'EBP-SLP', body: 'The best SLPs rely on evidence, not instinct alone.' },
  { title: 'EBP-SLP', body: "EBP: because your clients deserve more than a hunch. 💜" },
  { title: 'EBP-SLP', body: 'Good clinicians learn. Great clinicians learn from research.' },
  { title: 'EBP-SLP', body: "Evidence-based practice isn't a bonus — it's the standard." },
  { title: 'EBP-SLP', body: "Your clients can't read the literature. That's what you're for." },
  { title: 'EBP-SLP', body: 'Know the evidence. Serve the patient.' },
  { title: 'EBP-SLP', body: 'Confidence is knowing the research backs you up. 💜' },
  { title: 'EBP-SLP', body: 'Clinical intuition is great. Clinical intuition + evidence is better.' },
  { title: 'EBP-SLP', body: 'Behind every great therapy session is a clinician who did their homework.' },
  // Fun / sassy
  { title: '🔥 Hot take', body: 'Reading one study per week makes you a better SLP. Science agrees.' },
  { title: '👀 Quick reminder', body: 'Asked your supervisor why? Now go look it up.' },
  { title: 'EBP-SLP', body: 'Treatment without evidence is just a really educated guess.' },
  { title: '📬 The evidence called', body: 'It wants to be applied. Open EBP-SLP.' },
  { title: 'EBP-SLP', body: 'Your patients deserve the best SLP — and the best SLP is you, with EBP.' },
  { title: 'EBP-SLP', body: "SLP fact: you're already excellent. EBP just proves it." },
  { title: '💜 For your clients', body: 'Great outcomes start with great evidence. Check yours.' },
  { title: 'Did you know?', body: 'The more you read the evidence, the easier it gets to explain your choices.' },
  { title: 'EBP-SLP', body: "You don't have to read every study. Just the right ones. We've curated them." },
];

const MOTIVATION_BATCH = 8; // weeks of notifications to schedule ahead
const MOTIVATION_REFILL_THRESHOLD = 3; // refill when fewer than this remain

// Handle foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotifPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Getters ──────────────────────────────────────────────────────────────────

export async function getNotifFrequency(): Promise<NotifFrequency> {
  try {
    const raw = await AsyncStorage.getItem(KEY_FREQ);
    return (raw as NotifFrequency) ?? 'off';
  } catch {
    return 'off';
  }
}

export async function getNotifDay(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_DAY);
    return raw ? parseInt(raw, 10) : 2; // default Monday (2)
  } catch {
    return 2;
  }
}

export async function getNotifHour(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_HOUR);
    return raw ? parseInt(raw, 10) : 9; // default 9 AM
  } catch {
    return 9;
  }
}

// ─── Setters & schedule ───────────────────────────────────────────────────────

export async function setNotifFrequency(freq: NotifFrequency): Promise<void> {
  // Cancel existing scheduled notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (freq === 'weekly' || freq === 'monthly') {
    const granted = await requestNotifPermission();
    if (!granted) throw new Error('notification_permission_denied');

    const [day, hour] = await Promise.all([getNotifDay(), getNotifHour()]);

    if (freq === 'weekly') {
      await Notifications.scheduleNotificationAsync({
        content: CONTENT,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day, // 1 = Sunday, 2 = Monday, etc.
          hour,
          minute: 0,
        },
      });
    } else {
      // Monthly on the 1st
      await Notifications.scheduleNotificationAsync({
        content: CONTENT,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
          day: 1,
          hour,
          minute: 0,
        },
      });
    }
  } else if (freq === 'on-update') {
    // "on-update" doesn't use a scheduled trigger — it fires via triggerOnUpdateNotification()
    const granted = await requestNotifPermission();
    if (!granted) throw new Error('notification_permission_denied');
  }

  await AsyncStorage.setItem(KEY_FREQ, freq);
}

export async function setNotifDay(day: number): Promise<void> {
  await AsyncStorage.setItem(KEY_DAY, String(day));
  // Reschedule if currently weekly
  const freq = await getNotifFrequency();
  if (freq === 'weekly') {
    await setNotifFrequency('weekly');
  }
}

export async function setNotifHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(KEY_HOUR, String(hour));
  // Reschedule if currently weekly or monthly
  const freq = await getNotifFrequency();
  if (freq === 'weekly' || freq === 'monthly') {
    await setNotifFrequency(freq);
  }
}

export async function getMotivHour(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_MOTIV_HOUR);
    return raw ? parseInt(raw, 10) : 9; // default 9 AM
  } catch {
    return 9;
  }
}

export async function setMotivHour(hour: number): Promise<void> {
  await AsyncStorage.setItem(KEY_MOTIV_HOUR, String(hour));
  // Reschedule motivation notifications at the new hour
  const enabled = await getMotivationNotifEnabled();
  if (enabled) {
    await cancelMotivationNotifications();
    await scheduleMotivationBatch();
  }
}

export async function getMotivDay(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY_MOTIV_DAY);
    return raw ? parseInt(raw, 10) : 4; // default Wednesday (4 in 1–7 convention)
  } catch {
    return 4;
  }
}

export async function setMotivDay(day: number): Promise<void> {
  await AsyncStorage.setItem(KEY_MOTIV_DAY, String(day));
  const enabled = await getMotivationNotifEnabled();
  if (enabled) {
    await cancelMotivationNotifications();
    await scheduleMotivationBatch();
  }
}

// ─── On-update trigger ────────────────────────────────────────────────────────
// Call this when new articles are fetched and the user has 'on-update' enabled.

export async function triggerOnUpdateNotification(): Promise<void> {
  try {
    const freq = await getNotifFrequency();
    if (freq !== 'on-update') return;
    const granted = await requestNotifPermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: NEW_ARTICLES_CONTENT,
      trigger: null, // fire immediately
    });
  } catch {
    // Silently fail — don't disrupt article loading
  }
}

// ─── Motivation notifications ─────────────────────────────────────────────────
// Weekly rotating quotes, nudges, and tips — independent of article reminders.
// Fires every Wednesday at the user's preferred notification hour.

export async function getMotivationNotifEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY_MOTIVATION);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function setMotivationNotifEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_MOTIVATION, enabled ? 'true' : 'false');
  if (enabled) {
    const granted = await requestNotifPermission();
    if (!granted) throw new Error('notification_permission_denied');
    await scheduleMotivationBatch();
  } else {
    await cancelMotivationNotifications();
  }
}

export async function cancelMotivationNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if ((n.content.data as any)?.type === 'motivation') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {}
}

async function nextMotivationContents(): Promise<{ title: string; body: string }[]> {
  let idx = 0;
  try {
    const raw = await AsyncStorage.getItem(KEY_MOTIV_IDX);
    idx = raw ? parseInt(raw, 10) : 0;
    if (isNaN(idx) || idx < 0) idx = 0;
  } catch { idx = 0; }

  const contents: { title: string; body: string }[] = [];
  for (let i = 0; i < MOTIVATION_BATCH; i++) {
    contents.push(MOTIVATION_POOL[(idx + i) % MOTIVATION_POOL.length]);
  }

  await AsyncStorage.setItem(KEY_MOTIV_IDX, String((idx + MOTIVATION_BATCH) % MOTIVATION_POOL.length));
  return contents;
}

async function scheduleMotivationBatch(): Promise<void> {
  const contents = await nextMotivationContents();
  const [hour, storedDay] = await Promise.all([getMotivHour(), getMotivDay()]);
  const jsWeekday = storedDay - 1; // convert 1–7 → 0–6

  const now = new Date();
  const daysUntilTarget = ((jsWeekday - now.getDay() + 7) % 7) || 7; // at least 1 day ahead
  const firstTarget = new Date(now);
  firstTarget.setDate(now.getDate() + daysUntilTarget);
  firstTarget.setHours(hour, 0, 0, 0);

  for (let i = 0; i < contents.length; i++) {
    const fireMs = firstTarget.getTime() + i * 7 * 24 * 60 * 60 * 1000;
    const secondsFromNow = Math.floor((fireMs - Date.now()) / 1000);
    if (secondsFromNow <= 0) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: contents[i].title,
        body: contents[i].body,
        data: { type: 'motivation' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
        repeats: false,
      },
    });
  }
}

// Call on every app open to keep the motivation queue topped up.
export async function refillMotivationNotifications(): Promise<void> {
  try {
    const enabled = await getMotivationNotifEnabled();
    if (!enabled) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const remaining = scheduled.filter(n => (n.content.data as any)?.type === 'motivation').length;
    if (remaining < MOTIVATION_REFILL_THRESHOLD) {
      await scheduleMotivationBatch();
    }
  } catch {
    // Silently fail — don't disrupt app launch
  }
}

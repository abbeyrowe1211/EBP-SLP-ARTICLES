// ─── Haptic helpers ───────────────────────────────────────────────────────────
// Thin wrappers so callers don't need to import ImpactFeedbackStyle everywhere.
// Requires: npx expo install expo-haptics

import * as Haptics from 'expo-haptics';

/** Light tap — saves, bookmarks, small confirmations */
export const hapticLight = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Medium tap — destructive actions, swipe dismissals */
export const hapticMedium = (): void => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

/** Success pattern — CEU marked, group created, note saved */
export const hapticSuccess = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

/** Warning pattern — errors, undo */
export const hapticWarning = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

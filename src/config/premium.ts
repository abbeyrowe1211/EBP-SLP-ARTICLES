// ─── Premium config ───────────────────────────────────────────────────────────
// RevenueCat powers all subscription logic.
// Replace REVENUECAT_API_KEY with your real appl_… key from
// app.revenuecat.com → API Keys → Apple public key.

import { CustomerInfo } from 'react-native-purchases';

export const REVENUECAT_API_KEY = 'appl_eTmAEYIMqRTdTlOsnieVKTQKPhG';
export const ENTITLEMENT_ID    = 'EBP SLP Pro';   // must match RevenueCat exactly

// ── Customer info cache ───────────────────────────────────────────────────────
// Set on app launch + after every purchase/restore. isPremium() reads this
// synchronously so any screen can call it without await.
let _customerInfo: CustomerInfo | null = null;

export function setCustomerInfo(info: CustomerInfo | null) {
  _customerInfo = info;
}

export function isPremium(): boolean {
  if (_customerInfo === null) return false;
  return !!_customerInfo.entitlements.active[ENTITLEMENT_ID];
}

// ─── Feature list shown on paywall ───────────────────────────────────────────
export const PREMIUM_FEATURES = [
  {
    icon: '🔍',
    title: 'My Patient search',
    body: 'Describe your patient and instantly surface the most relevant EBP articles for their profile.',
  },
  {
    icon: '⚡',
    title: 'AI session plan generator',
    body: "Build evidence-based session plans in seconds, tailored to your patient's severity, setting, and goals.",
  },
  {
    icon: '📊',
    title: 'Live data collection',
    body: 'Track trials, accuracy, and cueing level in real time during sessions.',
  },
  {
    icon: '📝',
    title: 'SOAP note builder',
    body: 'Auto-generate clinical documentation phrases from your session data.',
  },
  {
    icon: '📂',
    title: 'Article groups',
    body: 'Organize your saved articles into custom groups by diagnosis, caseload, or project.',
  },
];

// ─── Free features (shown on paywall for contrast) ────────────────────────────
export const FREE_FEATURES = [
  // No hardcoded article count here — it grows every week as new research
  // is added, so a fixed number goes stale fast. Onboarding shows the live
  // count (computed from the actual article list); this stays evergreen.
  'Full, growing library of EBP articles',
  'Browse & search by area, evidence level, or keyword',
  'Save articles & take clinical notes',
  'Export article summaries',
];

// ─── Premium config ───────────────────────────────────────────────────────────
// RevenueCat powers all subscription logic.
// Replace REVENUECAT_API_KEY with your real appl_… key from
// app.revenuecat.com → API Keys → Apple public key.

import { CustomerInfo } from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const REVENUECAT_API_KEY = 'appl_eTmAEYIMqRTdTlOsnieVKTQKPhG';
export const ENTITLEMENT_ID    = 'EBP SLP Pro';   // must match RevenueCat exactly

// ── Customer info cache ───────────────────────────────────────────────────────
// Set on app launch + after every purchase/restore. isPremium() reads this
// synchronously so any screen can call it without await.
let _customerInfo: CustomerInfo | null = null;

// RevenueCat's getCustomerInfo() call on launch is a network round trip —
// until it resolves, _customerInfo is null and isPremium() used to just
// say "false", i.e. indistinguishable from "not subscribed". That meant a
// paying clinician who tapped a Pro feature right after a cold launch (or
// on a slow connection) could get bounced to the paywall even though
// they're subscribed. _lastKnownPremium is a same-device fallback: the
// last entitlement state we actually confirmed, read from fast local
// storage (ready well before RevenueCat's network call returns) so that
// window has a real answer to fall back on instead of a hard "no".
const LAST_KNOWN_PREMIUM_KEY = 'ebp_slp_last_known_premium_v1';
let _lastKnownPremium: boolean | null = null;

AsyncStorage.getItem(LAST_KNOWN_PREMIUM_KEY)
  .then((v) => {
    _lastKnownPremium = v === '1';
    notifyPremiumListeners();
  })
  .catch(() => {});

// ── Reactive subscribers ──────────────────────────────────────────────────────
// Lets a screen re-render the instant we learn the real entitlement status
// (from the cache hydrating, or RevenueCat finally responding) instead of
// being stuck with whatever isPremium() returned at mount time. See
// src/hooks/useIsPremium.ts.
const _listeners = new Set<() => void>();

export function subscribePremium(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

function notifyPremiumListeners() {
  _listeners.forEach((fn) => fn());
}

export function setCustomerInfo(info: CustomerInfo | null) {
  _customerInfo = info;
  if (info) {
    const active = !!info.entitlements.active[ENTITLEMENT_ID];
    _lastKnownPremium = active;
    AsyncStorage.setItem(LAST_KNOWN_PREMIUM_KEY, active ? '1' : '0').catch(() => {});
  }
  notifyPremiumListeners();
}

export function isPremium(): boolean {
  if (_customerInfo === null) return _lastKnownPremium ?? false;
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

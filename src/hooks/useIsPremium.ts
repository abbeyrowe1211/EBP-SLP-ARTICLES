// ─── useIsPremium ─────────────────────────────────────────────────────────────
// Reactive view of config/premium's isPremium(). A plain isPremium() call
// only reflects whatever was true the instant it was called — if the real
// RevenueCat answer arrives a moment after a screen mounts (cold start,
// slow network), nothing re-renders to pick it up. This hook subscribes to
// premium.ts's listener set so any screen using it updates the moment the
// entitlement cache hydrates or RevenueCat responds, in either direction
// (grants access the instant it's confirmed, and revokes it just as fast
// if an entitlement actually lapsed).

import { useEffect, useState } from 'react';
import { isPremium, subscribePremium } from '@/config/premium';

export function useIsPremium(): boolean {
  const [premium, setPremium] = useState(isPremium);

  useEffect(() => {
    const unsubscribe = subscribePremium(() => setPremium(isPremium()));
    return unsubscribe;
  }, []);

  return premium;
}

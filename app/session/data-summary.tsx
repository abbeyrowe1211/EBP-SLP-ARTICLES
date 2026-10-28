import React, { useEffect } from 'react';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { DataSummaryScreen } from '@/screens/DataSummaryScreen';
import { useIsPremium } from '@/hooks/useIsPremium';

export default function DataSummary() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const premium = useIsPremium();

  useEffect(() => {
    if (!premium) {
      // Preserve this screen's own path + params so the paywall can send the
      // user straight back into what they were trying to do after they
      // subscribe, instead of dumping them wherever they came from.
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      const redirect = qs ? `${pathname}?${qs}` : pathname;
      router.replace({ pathname: '/paywall', params: { redirect } });
    }
  }, [premium]);

  if (!premium) return null;
  return <DataSummaryScreen />;
}

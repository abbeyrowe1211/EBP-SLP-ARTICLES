import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { DataSummaryScreen } from '@/screens/DataSummaryScreen';
import { isPremium } from '@/config/premium';

export default function DataSummary() {
  const router = useRouter();

  useEffect(() => {
    if (!isPremium()) {
      router.replace('/paywall');
    }
  }, []);

  if (!isPremium()) return null;
  return <DataSummaryScreen />;
}

import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { DataCollectionScreen } from '@/screens/DataCollectionScreen';
import { isPremium } from '@/config/premium';

export default function DataCollection() {
  const router = useRouter();

  useEffect(() => {
    if (!isPremium()) {
      router.replace('/paywall');
    }
  }, []);

  if (!isPremium()) return null;
  return <DataCollectionScreen />;
}

import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { PatientScenarioScreen } from '@/screens/PatientScenarioScreen';
import { isPremium } from '@/config/premium';

export default function PatientSearch() {
  const router = useRouter();

  useEffect(() => {
    if (!isPremium()) {
      router.replace('/paywall');
    }
  }, []);

  if (!isPremium()) return null;
  return <PatientScenarioScreen />;
}

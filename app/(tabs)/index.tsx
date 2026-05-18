import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeScreen } from '@/screens/HomeScreen';
import { ONBOARDING_DONE_KEY } from '@/screens/OnboardingScreen';
import { colors } from '@/theme/colors';

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_DONE_KEY).then((done) => {
      if (!done) {
        router.replace('/onboarding');
      } else {
        setReady(true);
      }
    });
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return <HomeScreen />;
}

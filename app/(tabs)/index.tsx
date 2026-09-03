import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeScreen } from '@/screens/HomeScreen';
import { WalkthroughModal } from '@/components/WalkthroughModal';
import { ONBOARDING_DONE_KEY } from '@/screens/OnboardingScreen';
import { colors } from '@/theme/colors';

const WALKTHROUGH_DONE_KEY = 'ebp_slp_walkthrough_done_v1';

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet([ONBOARDING_DONE_KEY, WALKTHROUGH_DONE_KEY]).then(([[, onboardDone], [, walkDone]]) => {
      if (!onboardDone) {
        router.replace('/onboarding');
      } else {
        setReady(true);
        if (!walkDone) {
          // Small delay so the home screen renders first
          setTimeout(() => setShowWalkthrough(true), 600);
        }
      }
    });
  }, []);

  const handleWalkthroughDone = async () => {
    await AsyncStorage.setItem(WALKTHROUGH_DONE_KEY, 'true');
    setShowWalkthrough(false);
  };

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <>
      <HomeScreen />
      <WalkthroughModal visible={showWalkthrough} onDone={handleWalkthroughDone} />
    </>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { View, Text, TextInput, Image, Animated, StyleSheet } from 'react-native';

// ── Global: disable system font-size scaling so large-text accessibility
//    settings don't break the app's fixed layouts.
//    Both allowFontScaling=false AND maxFontSizeMultiplier=1 are set because
//    some Expo/iOS versions respond to one but not the other.
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.allowFontScaling = false;
(Text as any).defaultProps.maxFontSizeMultiplier = 1;
if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(TextInput as any).defaultProps.allowFontScaling = false;
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1;

import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import { colors } from '@/theme/colors';
import { ArticlesProvider } from '@/context/ArticlesContext';
import { refillMotivationNotifications } from '@/services/notificationService';
import { REVENUECAT_API_KEY, setCustomerInfo } from '@/config/premium';

SplashScreen.preventAutoHideAsync();

// ── Quote of the day (same pool as HomeScreen nudges) ─────────────────────────
const NUDGES = [
  'Evidence makes the difference.',
  'Your patients are lucky to have you.',
  'Great clinicians never stop learning.',
  'Research-backed. Patient-centered.',
  'Small consistent gains compound.',
  'You showed up. That already matters.',
  "EBP isn't a box to check — it's a habit.",
  'Every session is a chance to improve.',
  'The best SLPs stay curious.',
  'Trust the process. Trust the evidence.',
];

// ── Loading splash component ──────────────────────────────────────────────────
function LoadingSplash({ opacity }: { opacity: Animated.Value }) {
  const quote = NUDGES[new Date().getDate() % NUDGES.length];
  return (
    <Animated.View style={[styles.splash, { opacity }]}>
      <View style={styles.logoWrap}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.appName}>EBP-SLP</Text>
      <View style={styles.divider} />
      <Text style={styles.quote}>{quote}</Text>
    </Animated.View>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  // showApp flips to true after the custom loading screen fades out
  const [showApp, setShowApp] = useState(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fontsLoaded) return;

    // Hide the native OS splash now that fonts are ready
    SplashScreen.hideAsync();
    refillMotivationNotifications();

    // ── RevenueCat ────────────────────────────────────────────────────────────
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    // Fetch latest entitlement status so isPremium() works synchronously
    Purchases.getCustomerInfo().then(setCustomerInfo).catch(() => {});
    // Keep status up to date whenever it changes (renewal, cancellation, etc.)
    Purchases.addCustomerInfoUpdateListener(setCustomerInfo);

    // Hold the custom loading screen for 1.2 s, then fade to app
    const hold = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }).start(() => setShowApp(true));
    }, 1200);

    return () => clearTimeout(hold);
  }, [fontsLoaded, splashOpacity]);

  // Show custom loading screen while fonts load OR while it's still fading out
  if (!fontsLoaded || !showApp) {
    return (
      <>
        <StatusBar style="light" />
        <LoadingSplash
          opacity={!fontsLoaded ? new Animated.Value(1) : splashOpacity}
        />
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <ArticlesProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="disclaimer" options={{ headerShown: false }} />
          <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
      </ArticlesProvider>
    </SafeAreaProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.primaryDeep, // matches native splash background
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoWrap: {
    width: 90,
    height: 90,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 20,
    // subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 90,
    height: 90,
  },
  appName: {
    fontSize: 22,
    fontFamily: 'Quicksand_700Bold',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginBottom: 20,
    opacity: 0.95,
  },
  divider: {
    width: 36,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 20,
  },
  quote: {
    fontSize: 15,
    fontFamily: 'Quicksand_500Medium',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
});

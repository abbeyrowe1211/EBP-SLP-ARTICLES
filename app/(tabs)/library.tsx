import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LibraryScreen } from '@/screens/LibraryScreen';
import { isPremium, PREMIUM_FEATURES } from '@/config/premium';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

// ─── Pro locked state for the Plans tab ──────────────────────────────────────

function PlansLocked() {
  const router = useRouter();

  const proFeatures = PREMIUM_FEATURES; // show all 4 pro features

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Plans</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.lockCard}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>Pro feature</Text>
          <Text style={styles.lockBody}>
            For only $9.99/month, unlock session plans, live data collection, SOAP note builder, and more.
          </Text>

          <Pressable
            style={styles.unlockBtn}
            onPress={() => router.push('/paywall')}
          >
            <Text style={styles.unlockBtnText}>Unlock EBP-SLP Pro</Text>
          </Pressable>
        </View>

        <Text style={styles.featuresLabel}>WHAT'S INCLUDED IN PRO</Text>
        {proFeatures.map((f) => (
          <View key={f.title} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureBody}>{f.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export default function Library() {
  const [premium, setPremium] = useState(isPremium());

  // Re-check on every focus so the screen updates immediately after purchase
  useFocusEffect(useCallback(() => {
    setPremium(isPremium());
  }, []));

  if (!premium) return <PlansLocked />;
  return <LibraryScreen />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  screenTitle: { ...text.h2, color: colors.text },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  lockCard: {
    backgroundColor: colors.primaryLighter,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  lockIcon: { fontSize: 36, marginBottom: 12 },
  lockTitle: {
    fontSize: 20,
    fontFamily: 'Quicksand_700Bold',
    color: colors.primaryDeep,
    marginBottom: 8,
  },
  lockBody: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  unlockBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  unlockBtnText: {
    fontSize: 15,
    fontFamily: 'Quicksand_700Bold',
    color: '#fff',
  },

  featuresLabel: {
    ...text.label,
    color: colors.textMuted,
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: 15,
    fontFamily: 'Quicksand_700Bold',
    color: colors.text,
    marginBottom: 2,
  },
  featureBody: {
    ...text.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
});

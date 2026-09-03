// ─── PaywallScreen ────────────────────────────────────────────────────────────
// Shown when a free user taps a Pro-gated feature.
// Powered by RevenueCat — real purchase & restore flow.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { setCustomerInfo, PREMIUM_FEATURES, FREE_FEATURES, ENTITLEMENT_ID } from '@/config/premium';

export const PaywallScreen: React.FC = () => {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);

  // Load available packages from RevenueCat on mount
  useEffect(() => {
    Purchases.getOfferings()
      .then((offerings) => {
        if (offerings.current?.availablePackages) {
          setPackages(offerings.current.availablePackages);
        }
      })
      .catch(() => {})
      .finally(() => setPackagesLoading(false));
  }, []);

  // Pull real prices from RevenueCat packages
  const annualPkg  = packages.find((p) => p.packageType === 'ANNUAL');
  const monthlyPkg = packages.find((p) => p.packageType === 'MONTHLY');
  const annualPrice  = annualPkg?.product.priceString  ?? '$99.99';
  const monthlyPrice = monthlyPkg?.product.priceString ?? '$9.99';
  // Derive a per-month cost for the annual plan for the "save X%" label
  const annualPerMonth = annualPkg
    ? `~$${(annualPkg.product.price / 12).toFixed(2)}/mo`
    : '~$8.33/mo';
  // Compute the real savings % from actual RevenueCat prices instead of a
  // hardcoded guess — stays accurate if prices ever change in the dashboard.
  const savingsPct =
    annualPkg && monthlyPkg && monthlyPkg.product.price > 0
      ? Math.round((1 - annualPkg.product.price / 12 / monthlyPkg.product.price) * 100)
      : 17;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Find the matching package (ANNUAL or MONTHLY)
      const pkg = packages.find((p) =>
        selectedPlan === 'annual'
          ? p.packageType === 'ANNUAL'
          : p.packageType === 'MONTHLY',
      );
      if (!pkg) {
        Alert.alert('Not available', 'Could not load subscription options. Please try again.');
        return;
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(customerInfo);
      router.back(); // success — close the paywall
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      setCustomerInfo(customerInfo);
      const isActive = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (isActive) {
        router.back();
      } else {
        Alert.alert('No purchases found', 'No active subscription was found for your Apple ID.');
      }
    } catch {
      Alert.alert('Error', 'Could not restore purchases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Close / back */}
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headline}>Unlock EBP-SLP Pro</Text>
          <Text style={styles.subheadline}>
            For only {monthlyPrice}/month, get the full clinical toolkit — evidence search, session plans, data collection, and more.
          </Text>
        </View>

        {/* Plan selector */}
        <View style={styles.planRow}>
          <Pressable
            style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('annual')}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={[styles.planPrice, selectedPlan === 'annual' && styles.planPriceSelected]}>
              {annualPrice}
            </Text>
            <Text style={[styles.planLabel, selectedPlan === 'annual' && styles.planLabelSelected]}>
              per year
            </Text>
            <Text style={[styles.planSub, selectedPlan === 'annual' && styles.planSubSelected]}>
              {annualPerMonth} · save {savingsPct}%
            </Text>
          </Pressable>

          <Pressable
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceSelected]}>
              {monthlyPrice}
            </Text>
            <Text style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelSelected]}>
              per month
            </Text>
            <Text style={[styles.planSub, selectedPlan === 'monthly' && styles.planSubSelected]}>
              billed monthly
            </Text>
          </Pressable>
        </View>

        {/* Subscribe button */}
        <Pressable
          style={[styles.subscribeBtn, (loading || packagesLoading) && { opacity: 0.7 }]}
          onPress={handleSubscribe}
          disabled={loading || packagesLoading}
        >
          {loading || packagesLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.subscribeBtnText}>
              {selectedPlan === 'annual' ? `Start for ${annualPrice}/year` : `Start for ${monthlyPrice}/month`}
            </Text>
          )}
        </Pressable>

        <Text style={styles.cancelNote}>Cancel anytime. No commitment.</Text>

        {/* Pro features */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EVERYTHING IN PRO</Text>
          {PREMIUM_FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Free features */}
        <View style={styles.freeSection}>
          <Text style={styles.sectionLabel}>ALWAYS FREE</Text>
          {FREE_FEATURES.map((f) => (
            <View key={f} style={styles.freeRow}>
              <Text style={styles.freeCheck}>✓</Text>
              <Text style={styles.freeText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Restore */}
        <Pressable onPress={handleRestore} style={styles.skipBtn} disabled={loading}>
          <Text style={styles.skipText}>Restore purchases</Text>
        </Pressable>

        <Text style={styles.legalText}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage subscriptions in your Apple ID settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  closeBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 12,
    paddingLeft: 16,
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.textMuted,
  },

  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 16,
  },
  headline: {
    fontSize: 26,
    fontFamily: 'Quicksand_700Bold',
    color: colors.primaryDeep,
    textAlign: 'center',
    marginBottom: 10,
  },
  subheadline: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  planRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  planCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.surface,
    position: 'relative',
    overflow: 'visible',
  },
  planCardSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryLighter,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -11,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  bestValueText: {
    fontSize: 10,
    fontFamily: 'Quicksand_700Bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  planPrice: {
    fontSize: 22,
    fontFamily: 'Quicksand_700Bold',
    color: colors.text,
    marginTop: 8,
  },
  planPriceSelected: {
    color: colors.primaryDeep,
  },
  planLabel: {
    ...text.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  planLabelSelected: {
    color: colors.primaryDark,
    fontFamily: 'Quicksand_600SemiBold',
  },
  planSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'Quicksand_500Medium',
    marginTop: 4,
    textAlign: 'center',
  },
  planSubSelected: {
    color: colors.primaryDark,
  },

  subscribeBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  subscribeBtnText: {
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
    color: '#fff',
  },
  cancelNote: {
    ...text.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 28,
  },

  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    ...text.label,
    color: colors.textMuted,
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  featureIcon: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
    marginTop: 1,
  },
  featureText: {
    flex: 1,
  },
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

  freeSection: {
    backgroundColor: colors.primaryLighter,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  freeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  freeCheck: {
    fontSize: 14,
    color: colors.primaryDark,
    fontFamily: 'Quicksand_700Bold',
    marginTop: 1,
  },
  freeText: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    flex: 1,
    lineHeight: 19,
  },

  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  skipText: {
    ...text.body,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },

  legalText: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    fontFamily: 'Quicksand_400Regular',
  },
});

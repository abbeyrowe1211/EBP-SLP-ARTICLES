import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  FlatList,
  Alert,
  ActivityIndicator,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { LinearGradient } from 'expo-linear-gradient';
import { useArticles } from '@/context/ArticlesContext';
import {
  type NotifFrequency,
  getNotifFrequency,
  setNotifFrequency,
} from '@/services/notificationService';

// Rounded down to the nearest 10 so the onboarding copy stays accurate as
// articles are added — computed from the live (remote-synced) article count
// so this doesn't go stale between app builds. Falls back gracefully if the
// live list hasn't loaded yet (context starts with the bundled count).
function articleCountLabel(count: number): string {
  return `${Math.floor(count / 10) * 10}+`;
}

export const ONBOARDING_DONE_KEY = 'ebp_slp_onboarding_done_v1';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Slide data ───────────────────────────────────────────────────────────────

const EVIDENCE_LEVELS = [
  {
    label: 'Level 1a',
    color: '#059669',
    bg: '#D1FAE5',
    title: 'Systematic reviews & meta-analyses',
    desc: 'The highest level. Multiple RCTs pooled together. Strongest confidence in the finding.',
  },
  {
    label: 'Level 1b',
    color: '#1D4ED8',
    bg: '#DBEAFE',
    title: 'Randomized controlled trials (RCTs)',
    desc: 'A single well-designed RCT. Random assignment, control group. High confidence.',
  },
  {
    label: 'Level 2',
    color: '#7E22CE',
    bg: '#E9D5FF',
    title: 'Cohort studies & expert tutorials',
    desc: 'Strong observational studies or authoritative clinical reviews. Good evidence base.',
  },
  {
    label: 'Level 3',
    color: '#C2410C',
    bg: '#FED7AA',
    title: 'Case studies & expert opinion',
    desc: 'Smaller or less controlled evidence. Still valuable — especially for rare conditions.',
  },
];

// ─── Individual slides ────────────────────────────────────────────────────────

const WelcomeSlide: React.FC<{ articleCount: number }> = ({ articleCount }) => (
  <ScrollView contentContainerStyle={styles.slideScroll} showsVerticalScrollIndicator={false}>
    <LinearGradient
      colors={[colors.pastelLavender, colors.primaryLight]}
      style={styles.iconCircle}
    >
      <Text style={styles.iconEmoji}>🧠</Text>
    </LinearGradient>
    <Text style={styles.slideTitle}>Welcome to EBP-SLP</Text>
    <Text style={styles.slideSubtitle}>Evidence-based practice, built for medical SLPs</Text>
    <Text style={styles.slideBody}>
      EBP-SLP puts peer-reviewed research directly into your clinical workflow. Browse articles by area, generate evidence-based session plans with AI, and track real session data — all in one place.
    </Text>
    <View style={styles.featureList}>
      {[
        ['📚', `Browse ${articleCountLabel(articleCount)} peer-reviewed articles across ASHA areas`],
        ['⚡', 'Generate session plans grounded in the research you select'],
        ['📊', 'Collect trial-by-trial data with cue tracking'],
        ['📁', 'Organize your plans and review session history'],
      ].map(([icon, desc]) => (
        <View key={desc} style={styles.featureRow}>
          <Text style={styles.featureIcon}>{icon}</Text>
          <Text style={styles.featureText}>{desc}</Text>
        </View>
      ))}
    </View>
  </ScrollView>
);

const PhiSlide: React.FC<{ acknowledged: boolean; onAcknowledge: () => void }> = ({
  acknowledged,
  onAcknowledge,
}) => (
  <ScrollView contentContainerStyle={styles.slideScroll} showsVerticalScrollIndicator={false}>
    <View style={styles.warningCircle}>
      <Text style={styles.iconEmoji}>🛡</Text>
    </View>
    <Text style={styles.slideTitle}>Important: PHI & Privacy</Text>
    <Text style={styles.slideSubtitle}>Please read carefully before using this app</Text>

    <View style={styles.alertBox}>
      <Text style={styles.alertTitle}>This app is NOT HIPAA-compliant software</Text>
      <Text style={styles.alertBody}>
        EBP-SLP does not meet the technical, administrative, or physical safeguard requirements of HIPAA. It is a clinical reference and session planning tool — not a medical record system or covered entity software.
      </Text>
    </View>

    <Text style={styles.sectionHeading}>What this means for you</Text>
    <Text style={styles.slideBody}>
      You must never enter any Protected Health Information (PHI) into this app. This includes:
    </Text>

    <View style={styles.phiList}>
      {[
        'Patient full names',
        'Dates of birth or ages',
        'Medical record numbers',
        'Diagnosis codes or specific diagnoses tied to an individual',
        'Any information that could identify a specific patient',
      ].map((item) => (
        <View key={item} style={styles.phiRow}>
          <View style={styles.phiBullet} />
          <Text style={styles.phiRowText}>{item}</Text>
        </View>
      ))}
    </View>

    <Text style={styles.sectionHeading}>Your responsibility</Text>
    <Text style={styles.slideBody}>
      EBP-SLP is not responsible for any PHI inadvertently entered into the app. It is solely your responsibility as the clinician to ensure no patient-identifying information is entered at any time. If PHI is entered, it remains on your device only — but compliance and risk remain with you.
    </Text>

    <Text style={styles.sectionHeading}>Naming your plans</Text>
    <Text style={styles.slideBody}>
      When saving a session plan, you will be asked to name it. Use a treatment approach, group name, or case code — do not use any patient identifiers. Keep any cross-reference between your plan labels and your actual patients in a separate, secure system.
    </Text>

    <Text style={styles.sectionHeading}>Your data stays on your device</Text>
    <Text style={styles.slideBody}>
      All session data and plan information is stored locally on this device only. Nothing is transmitted to any server, shared with any third party, or backed up to the cloud.
    </Text>

    <Pressable
      style={[styles.acknowledgeBtn, acknowledged && styles.acknowledgeBtnDone]}
      onPress={onAcknowledge}
    >
      <Text style={styles.acknowledgeBtnText}>
        {acknowledged ? '✓  I understand and agree' : 'Tap to acknowledge'}
      </Text>
    </Pressable>
  </ScrollView>
);

const EvidenceSlide: React.FC = () => (
  <ScrollView contentContainerStyle={styles.slideScroll} showsVerticalScrollIndicator={false}>
    <LinearGradient
      colors={[colors.pastelBlue, colors.pastelLavender]}
      style={styles.iconCircle}
    >
      <Text style={styles.iconEmoji}>📖</Text>
    </LinearGradient>
    <Text style={styles.slideTitle}>About the articles</Text>
    <Text style={styles.slideSubtitle}>Where they come from and how to read them</Text>

    <Text style={styles.sectionHeading}>Sources</Text>
    <Text style={styles.slideBody}>
      All articles are drawn from peer-reviewed journals indexed in PubMed, aligned with ASHA's scope of practice for adult medical speech-language pathology. Each article is selected for its direct clinical applicability — not just academic interest. Every article in the app has been personally reviewed by the creator, a licensed medical SLP, before being included.
    </Text>

    <Text style={styles.sectionHeading}>How summaries are written</Text>
    <Text style={styles.slideBody}>
      Every article includes a plain-language summary, key research findings, clinical application notes, and session parameters drawn directly from the source study. Summaries are written to reflect what the authors actually found — not generalized clinical advice.
    </Text>

    <Text style={styles.sectionHeading}>Evidence levels</Text>
    <Text style={styles.slideBody}>
      Articles are graded using a standard evidence hierarchy. Higher levels mean more confidence in the finding — but lower-level evidence is still valuable, especially in areas where RCTs are rare or impractical.
    </Text>

    <View style={styles.evidenceGrid}>
      {EVIDENCE_LEVELS.map((level) => (
        <View key={level.label} style={[styles.evidenceCard, { borderColor: level.color + '40' }]}>
          <View style={[styles.evidenceBadge, { backgroundColor: level.bg }]}>
            <Text style={[styles.evidenceBadgeText, { color: level.color }]}>{level.label}</Text>
          </View>
          <Text style={styles.evidenceCardTitle}>{level.title}</Text>
          <Text style={styles.evidenceCardDesc}>{level.desc}</Text>
        </View>
      ))}
    </View>

    <Text style={styles.sectionHeading}>How articles are sorted</Text>
    <Text style={styles.slideBody}>
      In Browse, articles default to newest publication year first, with stronger evidence ranked higher within the same year. You can filter by ASHA area or search by author, keyword, diagnosis, or treatment name.
    </Text>
  </ScrollView>
);

const MyPatientSlide: React.FC = () => (
  <ScrollView contentContainerStyle={styles.slideScroll} showsVerticalScrollIndicator={false}>
    <LinearGradient
      colors={[colors.pastelLavender, colors.pastelMint]}
      style={styles.iconCircle}
    >
      <Text style={styles.iconEmoji}>🔍</Text>
    </LinearGradient>
    <Text style={styles.slideTitle}>Find articles for your patient</Text>
    <Text style={styles.slideSubtitle}>Describe your patient — the app finds the evidence</Text>

    <Text style={styles.slideBody}>
      Instead of searching by keyword or scrolling through areas, you can describe your patient in plain clinical language and EBP-SLP will surface the most relevant articles automatically.
    </Text>

    <Text style={styles.sectionHeading}>How to use it</Text>
    <Text style={styles.slideBody}>
      Tap the <Text style={{ fontFamily: 'Quicksand_700Bold', color: colors.primaryDeep }}>🔍 My patient</Text> button in the Browse tab header. Type a description of your patient — diagnosis, deficits, presentation, or goals. The more detail, the better the match.
    </Text>

    <View style={styles.exampleBlock}>
      <Text style={styles.exampleBlockLabel}>EXAMPLE SEARCHES</Text>
      {[
        'Severe expressive aphasia post left hemisphere stroke',
        "Parkinson's disease with hypophonia and reduced intelligibility",
        'Adult TBI with attention, memory, and social communication deficits',
        'Dysphagia with silent aspiration risk on thin liquids',
        'Stuttering in adults with high social anxiety',
      ].map((ex) => (
        <View key={ex} style={styles.exampleRow}>
          <Text style={styles.exampleDot}>›</Text>
          <Text style={styles.exampleText}>{ex}</Text>
        </View>
      ))}
    </View>

    <Text style={styles.sectionHeading}>What you'll see</Text>
    <Text style={styles.slideBody}>
      Matched articles are ranked by relevance to your patient's presentation. Articles marked <Text style={{ fontFamily: 'Quicksand_700Bold', color: '#E65100' }}>⚡ Plan ready</Text> can generate a full evidence-based session plan directly — tap any result to read the article and get started.
    </Text>
  </ScrollView>
);

const NOTIF_OPTIONS: { value: NotifFrequency; icon: string; title: string; desc: string }[] = [
  { value: 'off', icon: '🔕', title: "Don't send reminders", desc: "I'll check in on my own." },
  { value: 'weekly', icon: '📅', title: 'Weekly', desc: 'A gentle nudge once a week.' },
  { value: 'monthly', icon: '🗓️', title: 'Monthly', desc: 'Just a once-a-month check-in.' },
  { value: 'on-update', icon: '📚', title: 'When new articles are added', desc: 'Only hear from us when there’s new research.' },
];

const NotificationsSlide: React.FC<{
  value: NotifFrequency;
  saving: boolean;
  onSelect: (freq: NotifFrequency) => void;
}> = ({ value, saving, onSelect }) => (
  <ScrollView contentContainerStyle={styles.slideScroll} showsVerticalScrollIndicator={false}>
    <LinearGradient
      colors={[colors.pastelBlue, colors.pastelMint]}
      style={styles.iconCircle}
    >
      <Text style={styles.iconEmoji}>🔔</Text>
    </LinearGradient>
    <Text style={styles.slideTitle}>Stay in the loop</Text>
    <Text style={styles.slideSubtitle}>Choose how often you'd like a reminder — you can always change this later in Profile</Text>

    <View style={styles.notifOptionList}>
      {NOTIF_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.notifOptionCard, active && styles.notifOptionCardActive]}
            onPress={() => onSelect(opt.value)}
            disabled={saving}
          >
            <Text style={styles.notifOptionIcon}>{opt.icon}</Text>
            <View style={styles.notifOptionTextWrap}>
              <Text style={[styles.notifOptionTitle, active && styles.notifOptionTitleActive]}>{opt.title}</Text>
              <Text style={styles.notifOptionDesc}>{opt.desc}</Text>
            </View>
            {saving && active ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <View style={[styles.notifRadio, active && styles.notifRadioActive]}>
                {active && <View style={styles.notifRadioDot} />}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  </ScrollView>
);

const GetStartedSlide: React.FC = () => (
  <ScrollView contentContainerStyle={styles.slideScroll} showsVerticalScrollIndicator={false}>
    <LinearGradient
      colors={[colors.pastelMint, colors.pastelBlue]}
      style={styles.iconCircle}
    >
      <Text style={styles.iconEmoji}>🚀</Text>
    </LinearGradient>
    <Text style={styles.slideTitle}>You're all set</Text>
    <Text style={styles.slideSubtitle}>A few tips to get the most out of EBP-SLP</Text>

    <View style={styles.tipList}>
      {[
        {
          icon: '📚',
          title: 'Start in Browse',
          body: 'Find an article relevant to a patient you\'re seeing. Tap it to read the full summary and research findings.',
        },
        {
          icon: '⚡',
          title: 'Generate a session plan',
          body: 'From any article, tap "Generate session plan" and fill in a few patient parameters. Claude will build a structured, evidence-faithful session in seconds.',
        },
        {
          icon: '📊',
          title: 'Collect data in the session',
          body: 'After saving a plan, tap "Start data collection" to track trials, accuracy, and cueing level in real time.',
        },
        {
          icon: '📁',
          title: 'Organize your article library',
          body: 'Save session plans to your Plans library, grouped by patient label. Review session history and track accuracy trends over time.',
        },
        {
          icon: '👤',
          title: 'Set up your profile',
          body: 'Add your name, credentials, and default session length in the Profile tab so the app is personalized from day one.',
        },
      ].map((tip) => (
        <View key={tip.title} style={styles.tipCard}>
          <Text style={styles.tipIcon}>{tip.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipBody}>{tip.body}</Text>
          </View>
        </View>
      ))}
    </View>

    {/* AI disclaimer */}
    <View style={styles.aiDisclaimer}>
      <Text style={styles.aiDisclaimerTitle}>⚠️  AI-generated content</Text>
      <Text style={styles.aiDisclaimerBody}>
        Session plans are generated by AI. AI can make mistakes. You are the licensed clinician — always review and adapt every plan before using it with a patient.
      </Text>
    </View>
  </ScrollView>
);

// ─── Onboarding Screen ────────────────────────────────────────────────────────

export const OnboardingScreen: React.FC = () => {
  const router = useRouter();
  const { review } = useLocalSearchParams<{ review?: string }>();
  const isReviewMode = review === 'true';
  const { articles } = useArticles();

  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // In review mode PHI is already acknowledged; don't gate the button
  const [phiAcknowledged, setPhiAcknowledged] = useState(isReviewMode);
  const [notifFreq, setNotifFreqState] = useState<NotifFrequency>('off');
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    getNotifFrequency().then(setNotifFreqState);
  }, []);

  const handleSelectNotifFreq = async (freq: NotifFrequency) => {
    setNotifSaving(true);
    try {
      await setNotifFrequency(freq);
      setNotifFreqState(freq);
    } catch (e: any) {
      if (e?.message === 'notification_permission_denied') {
        Alert.alert(
          'Notifications blocked',
          'You can enable notifications later in Settings → EBP-SLP → Notifications, or change this anytime in your Profile.'
        );
      } else {
        Alert.alert('Error', 'Could not save your notification preference. You can set this later in Profile.');
      }
    } finally {
      setNotifSaving(false);
    }
  };

  const slides = ['welcome', 'phi', 'evidence', 'mypatient', 'notifications', 'getstarted'];
  const isLast = currentIndex === slides.length - 1;
  const isPhiSlide = currentIndex === 1;
  const canAdvance = !isPhiSlide || phiAcknowledged;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setCurrentIndex(viewableItems[0].index ?? 0);
  }).current;

  const goNext = async () => {
    if (isLast) {
      if (isReviewMode) {
        router.back();
      } else {
        await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
        router.replace('/(tabs)');
      }
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const renderSlide = ({ item }: { item: string }) => {
    const inner = (() => {
      switch (item) {
        case 'welcome':    return <WelcomeSlide articleCount={articles.length} />;
        case 'phi':        return <PhiSlide acknowledged={phiAcknowledged} onAcknowledge={() => setPhiAcknowledged(true)} />;
        case 'evidence':   return <EvidenceSlide />;
        case 'mypatient':  return <MyPatientSlide />;
        case 'notifications': return (
          <NotificationsSlide
            value={notifFreq}
            saving={notifSaving}
            onSelect={handleSelectNotifFreq}
          />
        );
        case 'getstarted': return <GetStartedSlide />;
        default: return null;
      }
    })();
    return <View style={styles.slide}>{inner}</View>;
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={isReviewMode} // allow free swiping in review mode
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        {/* Next / Done / Get started button */}
        <Pressable
          style={[styles.nextBtn, !canAdvance && styles.nextBtnDisabled]}
          onPress={canAdvance ? goNext : undefined}
        >
          <Text style={styles.nextBtnText}>
            {isLast
              ? isReviewMode ? 'Done →' : 'Get started →'
              : isPhiSlide && !phiAcknowledged
              ? 'Acknowledge to continue'
              : 'Next →'}
          </Text>
        </Pressable>

        {/* Skip — only on non-PHI slides, not in review mode */}
        {!isReviewMode && !isPhiSlide && !isLast && (
          <Pressable
            onPress={async () => {
              await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
              router.replace('/(tabs)');
            }}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        )}

        {/* Close — review mode header-less dismiss */}
        {isReviewMode && isLast && (
          <Pressable onPress={() => router.back()}>
            <Text style={styles.skipText}>Close</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  slide: { width: SCREEN_WIDTH, flex: 1 },
  slideScroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },

  // ── Icons ──
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  warningCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconEmoji: { fontSize: 36 },

  // ── Text ──
  slideTitle: { ...text.h2, color: colors.text, textAlign: 'center', marginBottom: 6 },
  slideSubtitle: { ...text.body, color: colors.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  slideBody: { ...text.bodySmall, color: colors.text, lineHeight: 21, marginBottom: 16 },
  sectionHeading: {
    ...text.label,
    color: colors.primaryDeep,
    marginBottom: 6,
    marginTop: 4,
    fontFamily: 'Quicksand_700Bold',
  },

  // ── Welcome features ──
  featureList: { gap: 12, marginTop: 4 },
  featureRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  featureIcon: { fontSize: 20, width: 28 },
  featureText: { ...text.bodySmall, color: colors.text, flex: 1, lineHeight: 20 },

  // ── PHI alert ──
  alertBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  alertTitle: {
    ...text.h4,
    color: '#B91C1C',
    marginBottom: 8,
    fontFamily: 'Quicksand_700Bold',
  },
  alertBody: { ...text.bodySmall, color: '#7F1D1D', lineHeight: 20 },
  phiList: { gap: 8, marginBottom: 16, paddingLeft: 4 },
  phiRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  phiBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    marginTop: 7,
    flexShrink: 0,
  },
  phiRowText: { ...text.bodySmall, color: colors.text, flex: 1, lineHeight: 20 },

  // ── Acknowledge button ──
  acknowledgeBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 0,
  },
  acknowledgeBtnDone: {
    backgroundColor: '#16A34A',
  },
  acknowledgeBtnText: {
    ...text.h4,
    color: colors.surface,
    fontFamily: 'Quicksand_700Bold',
  },

  // ── Evidence levels ──
  evidenceGrid: { gap: 10, marginBottom: 16 },
  evidenceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  evidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  evidenceBadgeText: { ...text.badge, fontSize: 11, fontFamily: 'Quicksand_700Bold' },
  evidenceCardTitle: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_700Bold', marginBottom: 4 },
  evidenceCardDesc: { ...text.caption, color: colors.textMuted, lineHeight: 17 },

  // ── Get started tips ──
  tipList: { gap: 14, marginBottom: 20 },
  tipCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
  },
  tipIcon: { fontSize: 22, width: 30 },
  tipTitle: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_700Bold', marginBottom: 4 },
  tipBody: { ...text.caption, color: colors.textMuted, lineHeight: 17 },

  // ── AI disclaimer ──
  aiDisclaimer: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  aiDisclaimerTitle: {
    ...text.bodySmall,
    color: '#92400E',
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 6,
  },
  aiDisclaimerBody: {
    ...text.caption,
    color: '#78350F',
    lineHeight: 17,
  },

  // ── My patient slide ──
  exampleBlock: {
    backgroundColor: colors.primaryLighter,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  exampleBlockLabel: {
    ...text.label,
    color: colors.primaryDeep,
    marginBottom: 4,
  },
  exampleRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  exampleDot: {
    ...text.body,
    color: colors.primary,
    fontFamily: 'Quicksand_700Bold',
    lineHeight: 20,
  },
  exampleText: {
    ...text.caption,
    color: colors.primaryDeep,
    flex: 1,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // ── Notifications slide ──
  notifOptionList: { gap: 12, marginTop: 8 },
  notifOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  notifOptionCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLighter,
  },
  notifOptionIcon: { fontSize: 24, width: 30, textAlign: 'center' },
  notifOptionTextWrap: { flex: 1, gap: 2 },
  notifOptionTitle: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_700Bold' },
  notifOptionTitleActive: { color: colors.primaryDeep },
  notifOptionDesc: { ...text.caption, color: colors.textMuted, lineHeight: 16 },
  notifRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifRadioActive: { borderColor: colors.primary },
  notifRadioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },

  // ── Bottom bar ──
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  nextBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  nextBtnDisabled: {
    backgroundColor: colors.border,
  },
  nextBtnText: { ...text.h4, color: colors.surface },
  skipText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
});

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { getArticleById } from '@/data/articles';
import {
  SESSION_LENGTHS,
  SEVERITIES,
  SETTINGS,
  TIME_POST_ONSET,
  MATERIALS,
  getGoalsForAreas,
  profileSettingToBuilderSetting,
} from '@/data/sessionOptions';
import { generateSessionPlan, type SessionParams } from '@/services/claude';

// ─── Pill selector (single) ───────────────────────────────────────────────────
const PillGroup: React.FC<{
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}> = ({ options, selected, onSelect }) => (
  <View style={styles.pillGroup}>
    {options.map((opt) => (
      <Pressable
        key={opt}
        style={[styles.pill, selected === opt && styles.pillActive]}
        onPress={() => onSelect(opt)}
      >
        <Text style={[styles.pillText, selected === opt && styles.pillTextActive]}>
          {opt}
        </Text>
      </Pressable>
    ))}
  </View>
);

// ─── Multi-select pill group ──────────────────────────────────────────────────
const MultiPillGroup: React.FC<{
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}> = ({ options, selected, onToggle }) => (
  <View style={styles.pillGroup}>
    {options.map((opt) => {
      const active = selected.includes(opt);
      return (
        <Pressable
          key={opt}
          style={[styles.pill, active && styles.pillActive]}
          onPress={() => onToggle(opt)}
        >
          <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt}</Text>
        </Pressable>
      );
    })}
  </View>
);

// ─── Dropdown (simple scroll list) ───────────────────────────────────────────
const DropdownSelect: React.FC<{
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}> = ({ options, selected, onSelect }) => (
  <View style={styles.dropdownWrap}>
    {options.map((opt) => (
      <Pressable
        key={opt}
        style={[styles.dropdownRow, selected === opt && styles.dropdownRowActive]}
        onPress={() => onSelect(opt)}
      >
        <View style={[styles.radioCircle, selected === opt && styles.radioCircleActive]}>
          {selected === opt && <View style={styles.radioDot} />}
        </View>
        <Text style={[styles.dropdownText, selected === opt && styles.dropdownTextActive]}>
          {opt}
        </Text>
      </Pressable>
    ))}
  </View>
);

// ─── Progress bar (fake animated) ────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Reviewing the research…',
  'Tailoring to your settings…',
  'Building your session steps…',
  'Applying evidence-based protocol…',
  'Almost there…',
];

const GeneratingBar: React.FC<{ visible: boolean }> = ({ visible }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      setMsgIndex(0);
      return;
    }
    // Animate to ~85% over 14s, leaving room for the real finish
    Animated.timing(progress, {
      toValue: 0.85,
      duration: 14000,
      useNativeDriver: false,
    }).start();

    // Rotate messages every ~3s
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.progressWrapper}>
      <Text style={styles.progressMsg}>{LOADING_MESSAGES[msgIndex]}</Text>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
};

// ─── Session Builder Screen ───────────────────────────────────────────────────
export const SessionBuilderScreen: React.FC = () => {
  const router = useRouter();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const article = getArticleById(articleId);

  const goals = article ? getGoalsForAreas(article.areas) : [];

  const [sessionLength, setSessionLength] = useState('45 min');
  const [severity, setSeverity] = useState('Moderate');
  const [setting, setSetting] = useState('Outpatient');
  const [selectedGoals, setSelectedGoals] = useState<string[]>(goals[0] ? [goals[0]] : []);
  const [timePostOnset, setTimePostOnset] = useState('Chronic (>6 mo)');
  const [materials, setMaterials] = useState<string[]>(['Picture cards', 'Worksheets']);
  const [loading, setLoading] = useState(false);

  // Pull default session length + clinical setting from stored preferences / profile
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const [settingsRaw, profileRaw] = await Promise.all([
          AsyncStorage.getItem('ebp_slp_settings_v1'),
          AsyncStorage.getItem('ebp_slp_profile_v1'),
        ]);

        if (settingsRaw) {
          const s = JSON.parse(settingsRaw);
          if (s.defaultSessionLength) setSessionLength(s.defaultSessionLength);
        }

        if (profileRaw) {
          const p = JSON.parse(profileRaw);
          const mapped = profileSettingToBuilderSetting(p.setting);
          if (mapped) setSetting(mapped);
        }
      } catch {}
    };
    loadDefaults();
  }, []);

  const toggleMaterial = (m: string) => {
    setMaterials((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const toggleGoal = (g: string) => {
    setSelectedGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const handleGenerate = async () => {
    if (!article) return;
    if (selectedGoals.length === 0) {
      Alert.alert('Select a goal', 'Please select at least one functional goal target.');
      return;
    }

    const params: SessionParams = {
      sessionLength,
      severity,
      setting,
      functionalGoal: selectedGoals.join(', '),
      timePostOnset,
      materials,
    };

    setLoading(true);
    try {
      const plan = await generateSessionPlan(article, params);
      router.push({
        pathname: '/session/plan',
        params: {
          planJson: JSON.stringify(plan),
          articleId: article.id,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.startsWith('API_ERROR')) {
        Alert.alert('Connection Error', 'Could not reach the server. Please check your network and try again.');
      } else {
        Alert.alert('Error', 'Something went wrong generating the plan. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ padding: 24, color: colors.textMuted }}>Article not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Article</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Build session</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Citation banner */}
        <View style={styles.citationBanner}>
          <Text style={styles.citationText}>
            <Text style={styles.citationLabel}>Built on: </Text>
            {article.shortTitle} · {article.authorShort} ({article.year})
          </Text>
        </View>

        {/* PHI warning */}
        <View style={styles.phiBanner}>
          <Text style={styles.phiIcon}>🛡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.phiBold}>Do not enter patient information.</Text>
            <Text style={styles.phiBody}>
              No names, dates of birth, MRNs, or identifiers. EBP-SLP is a clinical reference tool, not a documentation system.
            </Text>
          </View>
        </View>

        {/* Session length */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Session length</Text>
          <PillGroup
            options={SESSION_LENGTHS}
            selected={sessionLength}
            onSelect={setSessionLength}
          />
        </View>

        {/* Severity */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Patient severity</Text>
          <PillGroup options={SEVERITIES} selected={severity} onSelect={setSeverity} />
        </View>

        {/* Setting */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Setting</Text>
          <PillGroup options={SETTINGS} selected={setting} onSelect={setSetting} />
        </View>

        {/* Functional goal — multi-select */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Functional goal targets</Text>
          <Text style={[styles.helperText, { marginBottom: 10 }]}>
            Select one or more goal areas for this session.
          </Text>
          <View style={styles.dropdownWrap}>
            {goals.map((g, i) => {
              const active = selectedGoals.includes(g);
              return (
                <Pressable
                  key={g}
                  style={[
                    styles.dropdownRow,
                    active && styles.dropdownRowActive,
                    i === goals.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => toggleGoal(g)}
                >
                  <View style={[styles.checkBox, active && styles.checkBoxActive]}>
                    {active && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={[styles.dropdownText, active && styles.dropdownTextActive]}>
                    {g}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helperText}>
            EBP-SLP never stores free-text patient details.
          </Text>
        </View>

        {/* Time post-onset */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Time post-onset</Text>
          <DropdownSelect
            options={TIME_POST_ONSET}
            selected={timePostOnset}
            onSelect={setTimePostOnset}
          />
        </View>

        {/* Materials */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Materials available</Text>
          <MultiPillGroup
            options={MATERIALS}
            selected={materials}
            onToggle={toggleMaterial}
          />
        </View>

        {/* AI disclaimer — always visible */}
        <View style={styles.aiDisclaimerBanner}>
          <Text style={styles.aiDisclaimerIcon}>⚠️</Text>
          <Text style={styles.aiDisclaimerText}>
            AI can make mistakes. As the licensed SLP, you are responsible for all clinical decisions. Always review the generated plan before use.
          </Text>
        </View>

        {/* Generate button */}
        <Pressable
          style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.surface} size="small" />
              <Text style={styles.generateBtnText}>Generating…</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>⚡  Generate session plan</Text>
          )}
        </Pressable>

        <GeneratingBar visible={loading} />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backText: { ...text.body, color: colors.primary, fontFamily: 'Quicksand_600SemiBold' },
  screenTitle: { ...text.h3, color: colors.text },
  scroll: { paddingHorizontal: 20 },
  citationBanner: {
    backgroundColor: colors.primaryLighter,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  citationLabel: { fontFamily: 'Quicksand_700Bold', color: colors.primaryDeep },
  citationText: { ...text.bodySmall, color: colors.primaryDeep, lineHeight: 18 },
  phiBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  phiIcon: { fontSize: 18 },
  phiBold: { ...text.bodySmall, fontFamily: 'Quicksand_700Bold', color: '#166534', marginBottom: 2 },
  phiBody: { ...text.bodySmall, color: '#166534', lineHeight: 17 },
  formGroup: { marginBottom: 24 },
  label: { ...text.label, color: colors.text, marginBottom: 10 },
  pillGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
  pillTextActive: { color: colors.surface },
  dropdownWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownRowActive: { backgroundColor: colors.primaryLighter },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: { borderColor: colors.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkBoxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkMark: {
    color: colors.surface,
    fontSize: 12,
    fontFamily: 'Quicksand_700Bold',
    lineHeight: 16,
  },
  dropdownText: { ...text.body, color: colors.textMuted, flex: 1 },
  dropdownTextActive: { color: colors.primaryDeep, fontFamily: 'Quicksand_600SemiBold' },
  helperText: { ...text.caption, color: colors.textMuted, marginTop: 8, lineHeight: 16 },
  generateBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  generateBtnDisabled: { backgroundColor: colors.textMuted },
  generateBtnText: { ...text.h4, color: colors.surface },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiDisclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  aiDisclaimerIcon: { fontSize: 16, marginTop: 1 },
  aiDisclaimerText: {
    flex: 1,
    ...text.caption,
    color: '#92400E',
    lineHeight: 18,
    fontFamily: 'Quicksand_500Medium',
  },

  // ── Progress bar ──
  progressWrapper: {
    marginTop: 16,
    gap: 8,
  },
  progressMsg: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_600SemiBold',
    textAlign: 'center',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.primaryLighter,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
});

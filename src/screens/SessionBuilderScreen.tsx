import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
} from '@/data/sessionOptions';
import { generateSessionPlan, hasApiKey, type SessionParams } from '@/services/claude';

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

// ─── Session Builder Screen ───────────────────────────────────────────────────
export const SessionBuilderScreen: React.FC = () => {
  const router = useRouter();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const article = getArticleById(articleId);

  const goals = article ? getGoalsForAreas(article.areas) : [];

  const [sessionLength, setSessionLength] = useState('45 min');
  const [severity, setSeverity] = useState('Moderate');
  const [setting, setSetting] = useState('Outpatient');
  const [goal, setGoal] = useState(goals[0] ?? '');
  const [timePostOnset, setTimePostOnset] = useState('Chronic (>6 mo)');
  const [materials, setMaterials] = useState<string[]>(['Picture cards', 'Worksheets']);
  const [loading, setLoading] = useState(false);

  // Pull default session length from Profile settings
  useEffect(() => {
    AsyncStorage.getItem('ebp_slp_settings_v1').then((raw) => {
      if (raw) {
        const s = JSON.parse(raw);
        if (s.defaultSessionLength) setSessionLength(s.defaultSessionLength);
      }
    });
  }, []);

  const toggleMaterial = (m: string) => {
    setMaterials((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleGenerate = async () => {
    if (!article) return;

    if (!(await hasApiKey())) {
      Alert.alert(
        'API Key Required',
        'To generate session plans, add your Anthropic API key in the Profile tab.\n\nGet your key at console.anthropic.com',
        [{ text: 'OK' }]
      );
      return;
    }

    const params: SessionParams = {
      sessionLength,
      severity,
      setting,
      functionalGoal: goal,
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
      if (message === 'NO_API_KEY') {
        Alert.alert('API Key Missing', 'Add your Anthropic API key to the .env file.');
      } else if (message.startsWith('API_ERROR')) {
        Alert.alert('API Error', 'Could not reach the Claude API. Check your key and network connection.');
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

        {/* Functional goal */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Functional goal target</Text>
          <DropdownSelect options={goals} selected={goal} onSelect={setGoal} />
          <Text style={styles.helperText}>
            Choose from clinical goal categories. EBP-SLP never stores free-text patient details.
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

        {/* Generate button */}
        <Pressable
          style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.surface} size="small" />
              <Text style={styles.generateBtnText}>Generating plan…</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>⚡  Generate session plan</Text>
          )}
        </Pressable>

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
});

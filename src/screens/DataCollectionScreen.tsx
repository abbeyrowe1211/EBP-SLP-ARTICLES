import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { type GeneratedPlan } from '@/services/claude';
import { getArticleById } from '@/data/articles';
import {
  CUE_ALL,
  CUE_LABELS,
  type CueLevel,
  type TrialEntry,
} from '@/types/sessionData';
import {
  saveSessionData,
  computeStepSummaries,
  computeOverallAccuracy,
} from '@/services/sessionDataStorage';

// ─── Accuracy display ─────────────────────────────────────────────────────────

const AccuracyDisplay: React.FC<{ correct: number; total: number }> = ({ correct, total }) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : null;
  const color =
    pct === null ? colors.textMuted
    : pct >= 80 ? '#16A34A'
    : pct >= 60 ? '#D97706'
    : '#DC2626';

  return (
    <View style={styles.accuracyBox}>
      <Text style={[styles.accuracyPct, { color: pct === null ? colors.textMuted : color }]}>
        {pct === null ? '—' : `${pct}%`}
      </Text>
      <Text style={styles.accuracyLabel}>
        {total === 0 ? 'No trials yet' : `${correct} / ${total} correct`}
      </Text>
    </View>
  );
};

// ─── Cue chip ─────────────────────────────────────────────────────────────────

const CueChip: React.FC<{
  level: CueLevel;
  selected: boolean;
  onPress: () => void;
}> = ({ level, selected, onPress }) => (
  <Pressable
    style={[styles.cueChip, selected && styles.cueChipActive]}
    onPress={onPress}
  >
    <Text style={[styles.cueChipLabel, selected && styles.cueChipLabelActive]} numberOfLines={2}>
      {CUE_LABELS[level]}
    </Text>
  </Pressable>
);

// ─── Data Collection Screen ───────────────────────────────────────────────────

export const DataCollectionScreen: React.FC = () => {
  const router = useRouter();
  const { planJson, articleId, savedPlanId, patientLabel } =
    useLocalSearchParams<{
      planJson: string;
      articleId: string;
      savedPlanId: string;
      patientLabel: string;
    }>();

  let plan: GeneratedPlan | null = null;
  try { plan = JSON.parse(planJson ?? ''); } catch {}

  const stepTitles = plan?.steps.map((s) => s.title) ?? [];

  // ── State ──
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCue, setSelectedCue] = useState<CueLevel>('Independent');
  const [otherCueText, setOtherCueText] = useState('');
  const [trials, setTrials] = useState<TrialEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const stepTrials = trials.filter((t) => t.stepIndex === currentStep);
  const stepCorrect = stepTrials.filter((t) => t.correct).length;

  const recordTrial = useCallback((correct: boolean) => {
    // If Other is selected, require text
    if (selectedCue === 'Other' && !otherCueText.trim()) {
      Alert.alert('Name this cue', 'Type what cue you used in the field below before recording.');
      return;
    }
    setTrials((prev) => [
      ...prev,
      {
        trialNumber: prev.filter((t) => t.stepIndex === currentStep).length + 1,
        stepIndex: currentStep,
        stepTitle: stepTitles[currentStep] ?? `Step ${currentStep + 1}`,
        correct,
        cueLevel: selectedCue,
        cueNote: selectedCue === 'Other' ? otherCueText.trim() : undefined,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [currentStep, selectedCue, otherCueText, stepTitles]);

  const undoLast = useCallback(() => {
    setTrials((prev) => {
      const idx = [...prev].map((t, i) => ({ t, i }))
        .filter(({ t }) => t.stepIndex === currentStep)
        .pop()?.i;
      return idx !== undefined ? prev.filter((_, i) => i !== idx) : prev;
    });
  }, [currentStep]);

  const handleEndSession = async () => {
    if (trials.length === 0) {
      Alert.alert('No data recorded', 'Record at least one trial before ending the session.');
      return;
    }
    Alert.alert(
      'End session?',
      `Save ${trials.length} trial${trials.length !== 1 ? 's' : ''} to "${patientLabel}"?`,
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'Save & end',
          onPress: async () => {
            setSaving(true);
            try {
              const stepSummaries = computeStepSummaries(trials, stepTitles);
              const overallAccuracy = computeOverallAccuracy(trials);
              await saveSessionData({
                patientLabel: patientLabel ?? 'Unknown',
                savedPlanId: savedPlanId ?? '',
                articleId: articleId ?? '',
                sessionTitle: plan?.sessionTitle ?? 'Session',
                date: new Date().toISOString(),
                trials,
                stepSummaries,
                totalTrials: trials.length,
                overallAccuracy,
              });
              router.replace({
                pathname: '/session/data-summary',
                params: {
                  summaryJson: JSON.stringify({ stepSummaries, overallAccuracy, totalTrials: trials.length }),
                  sessionTitle: plan?.sessionTitle ?? 'Session',
                  patientLabel: patientLabel ?? '',
                  articleId: articleId ?? '',
                  planJson: planJson ?? '',
                },
              });
            } catch {
              Alert.alert('Save failed', 'Something went wrong. Try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (!plan || stepTitles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Couldn't load session</Text>
          <Text style={styles.errorBody}>Go back and try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={styles.container}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => {
            if (trials.length > 0) {
              Alert.alert('Leave session?', 'Unsaved data will be lost.', [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: () => router.back() },
              ]);
            } else {
              router.back();
            }
          }}>
            <Text style={styles.backText}>← Plan</Text>
          </Pressable>
          <Text style={styles.screenTitle}>Data collection</Text>
          <Text style={styles.patientChip}>{patientLabel}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step selector ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CURRENT STEP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {stepTitles.map((title, idx) => {
                const hasData = trials.some((t) => t.stepIndex === idx);
                return (
                  <Pressable
                    key={idx}
                    style={[styles.stepChip, currentStep === idx && styles.stepChipActive]}
                    onPress={() => setCurrentStep(idx)}
                  >
                    <Text style={[styles.stepChipNum, currentStep === idx && styles.stepChipNumActive]}>
                      {idx + 1}
                    </Text>
                    <Text
                      style={[styles.stepChipText, currentStep === idx && styles.stepChipTextActive]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                    {hasData && (
                      <View style={[styles.hasDataDot, currentStep === idx && styles.hasDataDotActive]} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Current step name ── */}
          <View style={styles.currentStepBanner}>
            <Text style={styles.currentStepNum}>Step {currentStep + 1} of {stepTitles.length} · {plan.steps[currentStep]?.duration}</Text>
            <Text style={styles.currentStepTitle}>{stepTitles[currentStep]}</Text>
            {plan.steps[currentStep]?.instructions ? (
              <Text style={styles.currentStepInstructions} numberOfLines={3}>
                {plan.steps[currentStep].instructions}
              </Text>
            ) : null}
          </View>

          {/* ── Accuracy ── */}
          <AccuracyDisplay correct={stepCorrect} total={stepTrials.length} />

          {/* ── Cueing level ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CUEING LEVEL</Text>

            <View style={styles.cueGrid}>
              {CUE_ALL.map((level) => (
                <CueChip
                  key={level}
                  level={level}
                  selected={selectedCue === level}
                  onPress={() => setSelectedCue(level)}
                />
              ))}
            </View>

            {/* Free text — only shows when Other is selected */}
            {selectedCue === 'Other' && (
              <TextInput
                style={styles.otherInput}
                value={otherCueText}
                onChangeText={setOtherCueText}
                placeholder="Describe the cue used (e.g. written cue, repetition request…)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                returnKeyType="done"
              />
            )}
          </View>

          {/* ── Trial buttons ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECORD TRIAL</Text>
            <View style={styles.trialBtns}>
              <Pressable style={styles.incorrectBtn} onPress={() => recordTrial(false)}>
                <Text style={styles.trialBtnIcon}>✕</Text>
                <Text style={styles.trialBtnLabel}>Incorrect</Text>
              </Pressable>
              <Pressable style={styles.correctBtn} onPress={() => recordTrial(true)}>
                <Text style={styles.trialBtnIcon}>✓</Text>
                <Text style={styles.trialBtnLabel}>Correct</Text>
              </Pressable>
            </View>
            {stepTrials.length > 0 && (
              <Pressable style={styles.undoBtn} onPress={undoLast}>
                <Text style={styles.undoBtnText}>↩  Undo last trial</Text>
              </Pressable>
            )}
          </View>

          {/* ── Recent trial dots ── */}
          {stepTrials.length > 0 && (
            <View style={styles.recentPanel}>
              <Text style={styles.sectionLabel}>THIS STEP — RECENT TRIALS</Text>
              <View style={styles.trialDots}>
                {[...stepTrials].slice(-12).map((t, i) => (
                  <View key={i} style={[styles.trialDot, { backgroundColor: t.correct ? '#16A34A' : '#DC2626' }]}>
                    <Text style={styles.trialDotIcon}>{t.correct ? '✓' : '✕'}</Text>
                  </View>
                ))}
              </View>
              {/* Cue tally */}
              <View style={styles.cueTallyRow}>
                {Object.entries(
                  stepTrials.reduce<Partial<Record<string, number>>>((acc, t) => {
                    const key = t.cueLevel === 'Other' && t.cueNote ? t.cueNote : CUE_LABELS[t.cueLevel];
                    acc[key] = (acc[key] ?? 0) + 1;
                    return acc;
                  }, {})
                ).map(([label, count]) => (
                  <View key={label} style={styles.cueTallyPill}>
                    <Text style={styles.cueTallyText}>{label}: {count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Session totals ── */}
          {trials.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SESSION TOTALS</Text>
              <View style={styles.totalsRow}>
                <View style={styles.totalChip}>
                  <Text style={styles.totalChipValue}>{trials.length}</Text>
                  <Text style={styles.totalChipLabel}>Trials</Text>
                </View>
                <View style={styles.totalChip}>
                  <Text style={[styles.totalChipValue, { color: '#16A34A' }]}>
                    {computeOverallAccuracy(trials)}%
                  </Text>
                  <Text style={styles.totalChipLabel}>Accuracy</Text>
                </View>
                <View style={styles.totalChip}>
                  <Text style={styles.totalChipValue}>
                    {new Set(trials.map((t) => t.stepIndex)).size}
                  </Text>
                  <Text style={styles.totalChipLabel}>Steps</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── End session ── */}
          <Pressable
            style={[styles.endBtn, saving && { opacity: 0.6 }]}
            onPress={handleEndSession}
            disabled={saving}
          >
            <Text style={styles.endBtnText}>
              {saving ? 'Saving…' : '📊  End session & save data'}
            </Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
  patientChip: {
    ...text.caption,
    color: colors.primaryDeep,
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontFamily: 'Quicksand_600SemiBold',
    overflow: 'hidden',
  },
  scroll: { paddingHorizontal: 20 },
  section: { marginBottom: 20 },
  sectionLabel: { ...text.label, color: colors.textMuted, marginBottom: 10 },

  // ── Current step banner ──
  currentStepBanner: {
    backgroundColor: colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  currentStepNum: {
    ...text.label,
    color: colors.primaryDeep,
    marginBottom: 2,
    fontFamily: 'Quicksand_600SemiBold',
  },
  currentStepTitle: {
    ...text.h3,
    color: colors.primaryDeep,
    lineHeight: 22,
  },
  currentStepInstructions: {
    ...text.bodySmall,
    color: colors.primaryDark,
    marginTop: 6,
    lineHeight: 18,
    opacity: 0.85,
  },

  // ── Step chips ──
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
    marginRight: 8,
    maxWidth: 180,
  },
  stepChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepChipNum: { ...text.caption, color: colors.textMuted, fontFamily: 'Quicksand_700Bold', minWidth: 14 },
  stepChipNumActive: { color: colors.surface },
  stepChipText: { ...text.caption, color: colors.text, fontFamily: 'Quicksand_600SemiBold', flex: 1 },
  stepChipTextActive: { color: colors.surface },
  hasDataDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryDark },
  hasDataDotActive: { backgroundColor: colors.surface },

  // ── Accuracy ──
  accuracyBox: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  accuracyPct: { fontSize: 52, fontFamily: 'Quicksand_700Bold', lineHeight: 60 },
  accuracyLabel: { ...text.body, color: colors.textMuted, marginTop: 4 },

  // ── Cue chips ──
  cueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cueChip: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cueChipActive: { backgroundColor: colors.primaryLighter, borderColor: colors.primary },
  cueChipLabel: {
    ...text.bodySmall,
    color: colors.text,
    fontFamily: 'Quicksand_600SemiBold',
    textAlign: 'center',
    lineHeight: 17,
  },
  cueChipLabelActive: { color: colors.primaryDeep },

  otherInput: {
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...text.bodySmall,
    color: colors.text,
    backgroundColor: colors.surface,
  },

  // ── Trial buttons ──
  trialBtns: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  incorrectBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  correctBtn: {
    flex: 1,
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#86EFAC',
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  trialBtnIcon: { fontSize: 36, marginBottom: 6 },
  trialBtnLabel: { ...text.h4, color: colors.text },
  undoBtn: { alignItems: 'center', paddingVertical: 6 },
  undoBtnText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },

  // ── Recent trials ──
  recentPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  trialDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  trialDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialDotIcon: { color: '#fff', fontSize: 12, fontFamily: 'Quicksand_700Bold' },
  cueTallyRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cueTallyPill: {
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cueTallyText: { ...text.caption, color: colors.primaryDark, fontFamily: 'Quicksand_600SemiBold' },

  // ── Totals ──
  totalsRow: { flexDirection: 'row', gap: 10 },
  totalChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  totalChipValue: { ...text.h3, color: colors.text, marginBottom: 4 },
  totalChipLabel: { ...text.caption, color: colors.textMuted },

  // ── End ──
  endBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  endBtnText: { ...text.h4, color: colors.surface },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { ...text.h3, color: colors.textMuted, marginBottom: 8 },
  errorBody: { ...text.body, color: colors.textMuted, textAlign: 'center' },
});

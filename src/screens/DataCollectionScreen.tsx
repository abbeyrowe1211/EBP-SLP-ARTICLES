import React, { useState, useCallback, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { type GeneratedPlan } from '@/services/claude';
import { getArticleById } from '@/data/articles';
import {
  CUE_LABELS,
  type CueLevel,
  type TrialEntry,
} from '@/types/sessionData';

// ─── Cueing helpers ───────────────────────────────────────────────────────────

const VERBAL_LEVELS: CueLevel[] = ['Min Verbal', 'Mod Verbal', 'Max Verbal'];
const ADDITIONAL_LEVELS: CueLevel[] = ['Direct Model', 'Gestural', 'Tactile', 'Other'];
// Levels that are mutually exclusive (selecting one clears everything else)
const EXCLUSIVE_LEVELS: CueLevel[] = ['Independent', 'Dependent'];

// Priority order for picking the "primary" cue when multiple are selected
const CUE_PRIORITY: CueLevel[] = [
  'Dependent', 'Direct Model', 'Max Verbal', 'Mod Verbal', 'Min Verbal',
  'Tactile', 'Gestural', 'Other', 'Independent',
];

function getPrimaryCue(cues: Set<CueLevel>): CueLevel {
  for (const c of CUE_PRIORITY) {
    if (cues.has(c)) return c;
  }
  return 'Independent';
}

function toggleCue(prev: Set<CueLevel>, level: CueLevel): Set<CueLevel> {
  const next = new Set(prev);
  if (EXCLUSIVE_LEVELS.includes(level)) {
    // Independent and Dependent are exclusive — clear everything else
    return new Set<CueLevel>([level]);
  }
  // Any other cue clears exclusive levels
  EXCLUSIVE_LEVELS.forEach((l) => next.delete(l));
  if (next.has(level)) {
    next.delete(level);
    if (next.size === 0) next.add('Independent'); // fall back
  } else {
    if (VERBAL_LEVELS.includes(level)) {
      // Only one verbal level at a time
      VERBAL_LEVELS.forEach((v) => next.delete(v));
    }
    next.add(level);
  }
  return next;
}
import {
  saveSessionData,
  computeStepSummaries,
  computeOverallAccuracy,
} from '@/services/sessionDataStorage';
import {
  getDraft,
  saveDraft,
  clearDraft,
  type SessionDraft,
} from '@/services/sessionDraftStorage';

// ─── Relative-time helper for the resume prompt ───────────────────────────────
function formatRelativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diffMin = Math.round((Date.now() - then) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    const diffDay = Math.round(diffHr / 24);
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  } catch {
    return '';
  }
}

// ─── Accuracy display ─────────────────────────────────────────────────────────

const AccuracyDisplay: React.FC<{ correct: number; total: number }> = ({ correct, total }) => {
  const pct = total > 0 ? Math.round((correct / total) * 100) : null;
  // Accuracy is always shown in green (not red/orange) — the target % is
  // patient-specific, so a lower number can still mean the patient is
  // right on goal. Color-coding by an arbitrary threshold would be misleading.
  const color = pct === null ? colors.textMuted : '#16A34A';

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
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: any;
}> = ({ label, selected, onPress, style }) => (
  <Pressable
    style={[styles.cueChip, selected && styles.cueChipActive, style]}
    onPress={onPress}
  >
    <Text style={[styles.cueChipLabel, selected && styles.cueChipLabelActive]}>
      {label}
    </Text>
  </Pressable>
);

// ─── Data Collection Screen ───────────────────────────────────────────────────

function parsePlan(json: string | undefined): GeneratedPlan | null {
  try { return JSON.parse(json ?? '') as GeneratedPlan; } catch { return null; }
}

export const DataCollectionScreen: React.FC = () => {
  const router = useRouter();
  const {
    planJson: paramPlanJson,
    articleId: paramArticleId,
    savedPlanId: paramSavedPlanId,
    patientLabel: paramPatientLabel,
  } = useLocalSearchParams<{
    planJson: string;
    articleId: string;
    savedPlanId: string;
    patientLabel: string;
  }>();

  // These live in state (not derived directly from route params) so that
  // resuming an autosaved draft — possibly from a different session than
  // whatever we just navigated in with — can override them. Everywhere else
  // in this file still just reads `plan` / `planJson` / `patientLabel` /
  // `savedPlanId` / `articleId` exactly as before.
  const [plan, setPlan] = useState<GeneratedPlan | null>(() => parsePlan(paramPlanJson));
  const [planJson, setPlanJson] = useState(paramPlanJson ?? '');
  const [patientLabel, setPatientLabel] = useState(paramPatientLabel ?? 'Unknown');
  const [savedPlanId, setSavedPlanId] = useState(paramSavedPlanId ?? '');
  const [articleId, setArticleId] = useState(paramArticleId ?? '');

  // Stable start time for the current draft — set once, restored on resume.
  const draftStartedAtRef = React.useRef<string>(new Date().toISOString());

  const stepTitles = plan?.steps.map((s) => s.title) ?? [];

  // ── State ──
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCues, setSelectedCues] = useState<Set<CueLevel>>(new Set<CueLevel>(['Independent']));
  const [otherCueText, setOtherCueText] = useState('');
  const [trials, setTrials] = useState<TrialEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [customCues, setCustomCues] = useState<string[]>([]);
  const [selectedCustomCues, setSelectedCustomCues] = useState<Set<string>>(new Set());
  const [enabledCues, setEnabledCues] = useState<Record<string, boolean>>({});

  // ── Modal state ──
  const [endSessionVisible, setEndSessionVisible] = useState(false);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [addCueVisible, setAddCueVisible] = useState(false);
  const [newCueText, setNewCueText] = useState('');
  const [removeCueLabel, setRemoveCueLabel] = useState<string | null>(null);
  const [warningText, setWarningText] = useState<string | null>(null);
  // Dependent + incorrect guard — resets each new session (not persisted)
  const [dependentIncorrectVisible, setDependentIncorrectVisible] = useState(false);
  const [skipDependentWarning, setSkipDependentWarning] = useState(false);

  // An unsaved draft found on disk, awaiting the clinician's choice to
  // resume it or discard it. Null once resolved either way.
  const [pendingDraft, setPendingDraft] = useState<SessionDraft | null>(null);

  // Load custom cues and cue visibility from storage
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('ebp_slp_custom_cues_v1'),
      AsyncStorage.getItem('ebp_slp_cue_visibility_v1'),
    ]).then(([cueRaw, visRaw]) => {
      try {
        if (cueRaw) setCustomCues(JSON.parse(cueRaw));
        if (visRaw) setEnabledCues(JSON.parse(visRaw));
      } catch {}
    });
  }, []);

  // Check once on mount for a leftover autosaved draft — from this session
  // if the screen remounted, or from a completely different one that never
  // got saved (crash, force-quit, phone died mid-session).
  useEffect(() => {
    let cancelled = false;
    getDraft().then((draft) => {
      if (!cancelled && draft && draft.trials.length > 0) {
        setPendingDraft(draft);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Autosave: fires whenever recorded trials or the current step change.
  // Skipped while a found draft is still awaiting the clinician's decision
  // so we never silently overwrite it before they've chosen.
  useEffect(() => {
    if (pendingDraft) return;
    if (trials.length === 0) return; // nothing worth protecting yet
    const draft: SessionDraft = {
      patientLabel,
      savedPlanId,
      articleId,
      planJson,
      sessionTitle: plan?.sessionTitle ?? 'Session',
      currentStep,
      trials,
      startedAt: draftStartedAtRef.current,
      updatedAt: new Date().toISOString(),
    };
    saveDraft(draft);
  }, [trials, currentStep, patientLabel, savedPlanId, articleId, planJson, plan, pendingDraft]);

  const resumePendingDraft = useCallback(() => {
    if (!pendingDraft) return;
    setPlan(parsePlan(pendingDraft.planJson));
    setPlanJson(pendingDraft.planJson);
    setPatientLabel(pendingDraft.patientLabel);
    setSavedPlanId(pendingDraft.savedPlanId);
    setArticleId(pendingDraft.articleId);
    setTrials(pendingDraft.trials);
    setCurrentStep(pendingDraft.currentStep);
    draftStartedAtRef.current = pendingDraft.startedAt;
    setPendingDraft(null);
  }, [pendingDraft]);

  const discardPendingDraft = useCallback(() => {
    clearDraft();
    setPendingDraft(null);
  }, []);

  // Helper — is a cue enabled? Defaults to true if not set
  const isCueEnabled = (level: string) => enabledCues[level] !== false;

  const addCustomCue = () => {
    setNewCueText('');
    setAddCueVisible(true);
  };

  const confirmAddCustomCue = async () => {
    const trimmed = newCueText.trim();
    if (!trimmed) return;
    setAddCueVisible(false);
    if (customCues.includes(trimmed)) return;
    const updated = [...customCues, trimmed];
    setCustomCues(updated);
    await AsyncStorage.setItem('ebp_slp_custom_cues_v1', JSON.stringify(updated));
  };

  const removeCustomCue = (label: string) => setRemoveCueLabel(label);

  const confirmRemoveCustomCue = async () => {
    if (!removeCueLabel) return;
    const updated = customCues.filter((c) => c !== removeCueLabel);
    setCustomCues(updated);
    setSelectedCustomCues((prev) => { const next = new Set(prev); next.delete(removeCueLabel); return next; });
    await AsyncStorage.setItem('ebp_slp_custom_cues_v1', JSON.stringify(updated));
    setRemoveCueLabel(null);
  };

  const toggleCustomCue = (label: string) => {
    setSelectedCustomCues((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
        if (next.size === 0 && selectedCues.size === 0) {
          setSelectedCues(new Set<CueLevel>(['Independent']));
        }
      } else {
        next.add(label);
        // Clear exclusive levels when a custom cue is selected
        setSelectedCues((prevCues) => {
          const nextCues = new Set(prevCues);
          nextCues.delete('Independent');
          nextCues.delete('Dependent');
          return nextCues;
        });
      }
      return next;
    });
  };

  const stepTrials = trials.filter((t) => t.stepIndex === currentStep);
  const stepCorrect = stepTrials.filter((t) => t.correct).length;

  // Core recording logic — called directly or after the Dependent warning is confirmed
  const doRecordTrial = useCallback((correct: boolean) => {
    const hasCustom = selectedCustomCues.size > 0;
    const primaryCue = hasCustom ? 'Other' : getPrimaryCue(selectedCues);
    const allCues = [...selectedCues];
    const customNote = hasCustom ? [...selectedCustomCues].join(', ') : undefined;
    const note = customNote ?? (selectedCues.has('Other') ? otherCueText.trim() : undefined);
    setTrials((prev) => [
      ...prev,
      {
        trialNumber: prev.filter((t) => t.stepIndex === currentStep).length + 1,
        stepIndex: currentStep,
        stepTitle: stepTitles[currentStep] ?? `Step ${currentStep + 1}`,
        correct,
        cueLevel: primaryCue,
        cueLevels: allCues.length > 1 ? allCues : undefined,
        cueNote: note || undefined,
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [currentStep, selectedCues, otherCueText, selectedCustomCues, stepTitles]);

  const recordTrial = useCallback((correct: boolean) => {
    // Require text when "Other" is selected
    if (selectedCues.has('Other') && !otherCueText.trim() && selectedCustomCues.size === 0) {
      setWarningText('Type what cue you used in the field below before recording a trial.');
      return;
    }
    // Warn when marking Dependent as incorrect (unless user suppressed for this session)
    if (!correct && selectedCues.has('Dependent') && !skipDependentWarning) {
      setDependentIncorrectVisible(true);
      return;
    }
    doRecordTrial(correct);
  }, [selectedCues, otherCueText, selectedCustomCues, skipDependentWarning, doRecordTrial]);

  const undoLast = useCallback(() => {
    setTrials((prev) => {
      const idx = [...prev].map((t, i) => ({ t, i }))
        .filter(({ t }) => t.stepIndex === currentStep)
        .pop()?.i;
      return idx !== undefined ? prev.filter((_, i) => i !== idx) : prev;
    });
  }, [currentStep]);

  const handleEndSession = () => {
    if (trials.length === 0) {
      setWarningText('Record at least one trial before ending the session.');
      return;
    }
    setEndSessionVisible(true);
  };

  const confirmEndSession = async () => {
    setEndSessionVisible(false);
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
      await clearDraft();
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
      setWarningText('Something went wrong saving the session. Try again.');
    } finally {
      setSaving(false);
    }
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
              setLeaveVisible(true);
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
            <Text style={[styles.sectionLabel, { textAlign: 'center' }]}>CURRENT STEP</Text>
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

            {/* Independent + Dependent row */}
            {(isCueEnabled('Independent') || isCueEnabled('Dependent')) && (
              <View style={styles.cueRow}>
                {isCueEnabled('Independent') && (
                  <CueChip
                    label="Independent"
                    selected={selectedCues.has('Independent')}
                    onPress={() => {
                      setSelectedCues(new Set<CueLevel>(['Independent']));
                      setSelectedCustomCues(new Set());
                      setOtherCueText('');
                    }}
                    style={styles.cueChipHalf}
                  />
                )}
                {isCueEnabled('Dependent') && (
                  <CueChip
                    label="Dependent"
                    selected={selectedCues.has('Dependent')}
                    onPress={() => {
                      setSelectedCues(new Set<CueLevel>(['Dependent']));
                      setSelectedCustomCues(new Set());
                      setOtherCueText('');
                    }}
                    style={[styles.cueChipHalf, selectedCues.has('Dependent') && styles.cueChipDependentActive]}
                  />
                )}
              </View>
            )}

            {/* Verbal cue group */}
            {VERBAL_LEVELS.filter(isCueEnabled).length > 0 && (
              <>
                <Text style={styles.cueGroupLabel}>Verbal Cue</Text>
                <View style={styles.cueRow}>
                  {VERBAL_LEVELS.filter(isCueEnabled).map((level) => (
                    <CueChip
                      key={level}
                      label={CUE_LABELS[level]}
                      selected={selectedCues.has(level)}
                      onPress={() => setSelectedCues((prev) => toggleCue(prev, level))}
                      style={styles.cueChipThird}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Additional cues */}
            {ADDITIONAL_LEVELS.filter(isCueEnabled).length > 0 && (
              <>
                <Text style={styles.cueGroupLabel}>Additional</Text>
                <View style={styles.cueRow}>
                  {ADDITIONAL_LEVELS.filter(isCueEnabled).map((level) => (
                    <CueChip
                      key={level}
                      label={CUE_LABELS[level]}
                      selected={selectedCues.has(level)}
                      onPress={() => setSelectedCues((prev) => toggleCue(prev, level))}
                      style={styles.cueChipQuarter}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Free text — only shows when Other is selected */}
            {selectedCues.has('Other') && (
              <TextInput
                style={styles.otherInput}
                value={otherCueText}
                onChangeText={setOtherCueText}
                placeholder="Describe the cue (e.g. written cue, repetition request…)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                returnKeyType="done"
              />
            )}

            {/* Custom cues — wraps to new lines; respects visibility toggle from Profile */}
            {customCues.filter(isCueEnabled).length > 0 && (
              <>
                <Text style={styles.cueGroupLabel}>My Cues</Text>
                <View style={styles.cueRowWrapped}>
                  {customCues.filter(isCueEnabled).map((label) => (
                    <Pressable
                      key={label}
                      style={[styles.cueChip, selectedCustomCues.has(label) && styles.cueChipActive, styles.cueChipCustom]}
                      onPress={() => toggleCustomCue(label)}
                      onLongPress={() => removeCustomCue(label)}
                    >
                      <Text style={[styles.cueChipLabel, selectedCustomCues.has(label) && styles.cueChipLabelActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            <Pressable style={styles.addCustomCueBtn} onPress={addCustomCue}>
              <Text style={styles.addCustomCueBtnText}>+ Add custom cue</Text>
            </Pressable>
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
                    // Use all cues from multi-cue trials, fall back to primary
                    const levels = t.cueLevels ?? [t.cueLevel];
                    levels.forEach((lvl) => {
                      const key = lvl === 'Other' && t.cueNote ? t.cueNote : CUE_LABELS[lvl];
                      acc[key] = (acc[key] ?? 0) + 1;
                    });
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

          {/* ── Next step button ── */}
          {currentStep < stepTitles.length - 1 && (
            <Pressable
              style={styles.nextStepBtn}
              onPress={() => setCurrentStep((prev) => prev + 1)}
            >
              <Text style={styles.nextStepBtnText}>Next step →</Text>
            </Pressable>
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

      {/* ── End session confirm modal ── */}
      <Modal visible={endSessionVisible} transparent animationType="fade" onRequestClose={() => setEndSessionVisible(false)}>
        <View style={mStyles.overlay}>
          <View style={mStyles.card}>
            <Text style={mStyles.icon}>📊</Text>
            <Text style={mStyles.title}>End session?</Text>
            <Text style={mStyles.body}>
              Save {trials.length} trial{trials.length !== 1 ? 's' : ''} to "{patientLabel}"?
            </Text>
            <View style={mStyles.actions}>
              <Pressable style={mStyles.cancelBtn} onPress={() => setEndSessionVisible(false)}>
                <Text style={mStyles.cancelText}>Keep going</Text>
              </Pressable>
              <Pressable style={mStyles.confirmBtn} onPress={confirmEndSession}>
                <Text style={mStyles.confirmText}>Save & end</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Leave session confirm modal ── */}
      <Modal visible={leaveVisible} transparent animationType="fade" onRequestClose={() => setLeaveVisible(false)}>
        <View style={mStyles.overlay}>
          <View style={mStyles.card}>
            <Text style={mStyles.icon}>⚠️</Text>
            <Text style={mStyles.title}>Leave session?</Text>
            <Text style={mStyles.body}>Unsaved trial data will be lost.</Text>
            <View style={mStyles.actions}>
              <Pressable style={mStyles.cancelBtn} onPress={() => setLeaveVisible(false)}>
                <Text style={mStyles.cancelText}>Stay</Text>
              </Pressable>
              <Pressable
                style={[mStyles.confirmBtn, mStyles.destructiveBtn]}
                onPress={() => { clearDraft(); router.back(); }}
              >
                <Text style={mStyles.confirmText}>Leave</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add custom cue modal ── */}
      <Modal visible={addCueVisible} transparent animationType="fade" onRequestClose={() => setAddCueVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mStyles.overlay}>
          <View style={mStyles.card}>
            <Text style={mStyles.title}>Add custom cue</Text>
            <Text style={mStyles.body}>Give it a short label (e.g. "Written cue", "Repetition").</Text>
            <TextInput
              style={mStyles.input}
              value={newCueText}
              onChangeText={setNewCueText}
              placeholder="Cue name…"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmAddCustomCue}
            />
            <View style={mStyles.actions}>
              <Pressable style={mStyles.cancelBtn} onPress={() => setAddCueVisible(false)}>
                <Text style={mStyles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={mStyles.confirmBtn} onPress={confirmAddCustomCue}>
                <Text style={mStyles.confirmText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Remove cue confirm modal ── */}
      <Modal visible={!!removeCueLabel} transparent animationType="fade" onRequestClose={() => setRemoveCueLabel(null)}>
        <View style={mStyles.overlay}>
          <View style={mStyles.card}>
            <Text style={mStyles.title}>Remove "{removeCueLabel}"?</Text>
            <Text style={mStyles.body}>This cue will be removed from your custom list.</Text>
            <View style={mStyles.actions}>
              <Pressable style={mStyles.cancelBtn} onPress={() => setRemoveCueLabel(null)}>
                <Text style={mStyles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[mStyles.confirmBtn, mStyles.destructiveBtn]} onPress={confirmRemoveCustomCue}>
                <Text style={mStyles.confirmText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Warning / info modal ── */}
      <Modal visible={!!warningText} transparent animationType="fade" onRequestClose={() => setWarningText(null)}>
        <View style={mStyles.overlay}>
          <View style={mStyles.card}>
            <Text style={mStyles.title}>Heads up</Text>
            <Text style={mStyles.body}>{warningText}</Text>
            <Pressable style={[mStyles.confirmBtn, { flex: 0, alignSelf: 'stretch' }]} onPress={() => setWarningText(null)}>
              <Text style={mStyles.confirmText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Dependent + incorrect confirmation ── */}
      <Modal
        visible={dependentIncorrectVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDependentIncorrectVisible(false)}
      >
        <View style={mStyles.overlay}>
          <View style={mStyles.card}>
            <Text style={mStyles.icon}>🤔</Text>
            <Text style={mStyles.title}>Mark as incorrect?</Text>
            <Text style={mStyles.body}>
              "Dependent" usually means you assisted with 100% of the task. Are you sure you want to mark this trial as incorrect?
            </Text>
            {/* "Do not ask again" — resets each new session */}
            <Pressable
              style={mStyles.checkRow}
              onPress={() => setSkipDependentWarning((prev) => !prev)}
            >
              <View style={[mStyles.checkbox, skipDependentWarning && mStyles.checkboxOn]}>
                {skipDependentWarning && <Text style={mStyles.checkmark}>✓</Text>}
              </View>
              <Text style={mStyles.checkLabel}>Don't ask again this session</Text>
            </Pressable>
            <View style={mStyles.actions}>
              <Pressable style={mStyles.cancelBtn} onPress={() => setDependentIncorrectVisible(false)}>
                <Text style={mStyles.cancelText}>No</Text>
              </Pressable>
              <Pressable
                style={[mStyles.confirmBtn, mStyles.destructiveBtn]}
                onPress={() => {
                  setDependentIncorrectVisible(false);
                  doRecordTrial(false);
                }}
              >
                <Text style={mStyles.confirmText}>Yes, mark incorrect</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Resume unsaved session ── */}
      <Modal
        visible={!!pendingDraft}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={mStyles.overlay}>
          <View style={mStyles.card}>
            <Text style={mStyles.icon}>💾</Text>
            <Text style={mStyles.title}>Unsaved session found</Text>
            <Text style={mStyles.body}>
              {pendingDraft?.trials.length} trial{(pendingDraft?.trials.length ?? 0) !== 1 ? 's' : ''} recorded for "{pendingDraft?.patientLabel}"{pendingDraft?.sessionTitle ? ` (${pendingDraft.sessionTitle})` : ''} — last updated {formatRelativeTime(pendingDraft?.updatedAt ?? '')}.
              {'\n\n'}This wasn't saved before the app closed. Resume it, or discard it and continue with this session.
            </Text>
            <View style={mStyles.actions}>
              <Pressable style={mStyles.cancelBtn} onPress={discardPendingDraft}>
                <Text style={mStyles.cancelText}>Discard</Text>
              </Pressable>
              <Pressable style={mStyles.confirmBtn} onPress={resumePendingDraft}>
                <Text style={mStyles.confirmText}>Resume session</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
};

// ─── In-app modal styles (shared across all modals in this screen) ─────────────
const mStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: { fontSize: 32, marginBottom: 8 },
  title: {
    ...text.h3,
    color: colors.primaryDeep,
    textAlign: 'center',
    marginBottom: 8,
  } as any,
  body: {
    ...text.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  } as any,
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...text.body,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: 16,
  } as any,
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: {
    ...text.bodySmall,
    color: colors.textMuted,
    fontFamily: 'Quicksand_600SemiBold',
  } as any,
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
  },
  destructiveBtn: { backgroundColor: '#DC2626' },
  confirmText: {
    ...text.bodySmall,
    color: colors.surface,
    fontFamily: 'Quicksand_700Bold',
  } as any,
  // Checkbox for "don't ask again"
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 14,
    fontFamily: 'Quicksand_700Bold',
  } as any,
  checkLabel: {
    ...text.bodySmall,
    color: colors.textMuted,
  } as any,
});

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
  cueGroupLabel: {
    ...text.label,
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 6,
  },
  cueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cueRowWrapped: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cueChip: {
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
  cueChipFull: {
    width: '100%',
    marginBottom: 4,
  },
  cueChipHalf: {
    flex: 1,
  },
  cueChipThird: {
    flex: 1,
  },
  cueChipQuarter: {
    flex: 1,
  },
  cueChipActive: { backgroundColor: colors.primaryLighter, borderColor: colors.primary },
  cueChipDependentActive: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
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
  cueChipCustom: {
    // no flex: 1 — let chips size to their label so wrapping works naturally
  },
  addCustomCueBtn: {
    marginTop: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addCustomCueBtnText: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_600SemiBold',
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
  undoBtn: {
    marginTop: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  undoBtnText: { ...text.bodySmall, color: colors.primaryDeep, fontFamily: 'Quicksand_600SemiBold' },

  // ── Next Step ──
  nextStepBtn: {
    backgroundColor: colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  nextStepBtnText: { ...text.h4, color: colors.primaryDeep },

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

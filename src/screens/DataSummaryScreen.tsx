import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { CUE_LABELS, type StepSummary } from '@/types/sessionData';
import { generateDocPhrase } from '@/services/claude';

// ─── Step result card ─────────────────────────────────────────────────────────

const StepResultCard: React.FC<{ summary: StepSummary }> = ({ summary }) => {
  const pct = summary.accuracy;
  const barColor = pct >= 80 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626';

  return (
    <View style={styles.stepCard}>
      <View style={styles.stepCardHeader}>
        <View style={styles.stepNumCircle}>
          <Text style={styles.stepNumText}>{summary.stepIndex + 1}</Text>
        </View>
        <Text style={styles.stepCardTitle} numberOfLines={2}>{summary.stepTitle}</Text>
        <Text style={[styles.stepAccuracy, { color: summary.totalTrials === 0 ? colors.textMuted : barColor }]}>
          {summary.totalTrials === 0 ? '—' : `${pct}%`}
        </Text>
      </View>

      {summary.totalTrials > 0 && (
        <>
          {/* Accuracy bar */}
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
          </View>

          <View style={styles.stepMeta}>
            <Text style={styles.stepMetaText}>
              {summary.correctTrials}/{summary.totalTrials} correct
            </Text>
            {summary.dominantCueLevel && (
              <Text style={styles.stepMetaText}>
                Most used: {CUE_LABELS[summary.dominantCueLevel]}
              </Text>
            )}
          </View>

          {/* Cue breakdown */}
          <View style={styles.cueBreakRow}>
            {(Object.entries(summary.cueBreakdown) as [string, number][])
              .filter(([, count]) => count > 0)
              .map(([level, count]) => (
                <View key={level} style={styles.cuePill}>
                  <Text style={styles.cuePillText}>
                    {CUE_LABELS[level as keyof typeof CUE_LABELS]}: {count}
                  </Text>
                </View>
              ))}
          </View>
        </>
      )}

      {summary.totalTrials === 0 && (
        <Text style={styles.noDataText}>No trials recorded for this step</Text>
      )}
    </View>
  );
};

// ─── Data Summary Screen ──────────────────────────────────────────────────────

export const DataSummaryScreen: React.FC = () => {
  const router = useRouter();
  const { summaryJson, sessionTitle, patientLabel, fromLibrary, articleId } = useLocalSearchParams<{
    summaryJson: string;
    sessionTitle: string;
    patientLabel: string;
    fromLibrary?: string;
    articleId?: string;
    planJson?: string;
  }>();

  const [docPhrase, setDocPhrase]       = useState('');
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [copied, setCopied]             = useState(false);

  let summary: { stepSummaries: StepSummary[]; overallAccuracy: number; totalTrials: number } | null = null;
  try { summary = JSON.parse(summaryJson ?? ''); } catch { /* handled below */ }

  const handleGenerateDoc = async () => {
    if (!summary) return;
    setGeneratingDoc(true);
    try {
      const phrase = await generateDocPhrase({
        sessionTitle: sessionTitle ?? 'Session',
        totalTrials: summary.totalTrials,
        overallAccuracy: summary.overallAccuracy,
        stepSummaries: summary.stepSummaries.map((s) => ({
          stepTitle: s.stepTitle,
          totalTrials: s.totalTrials,
          correctTrials: s.correctTrials,
          accuracy: s.accuracy,
          dominantCueLevel: s.dominantCueLevel,
        })),
      });
      setDocPhrase(phrase);
    } catch {
      Alert.alert('Error', 'Could not generate documentation phrase. Try again.');
    } finally {
      setGeneratingDoc(false);
    }
  };

  const handleCopy = () => {
    Clipboard.setString(docPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const overallColor =
    !summary ? colors.textMuted :
    summary.overallAccuracy >= 80 ? '#16A34A' :
    summary.overallAccuracy >= 60 ? '#D97706' : '#DC2626';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Session summary</Text>
        <Text style={styles.patientChip}>{patientLabel}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Overall accuracy */}
        <View style={styles.overallCard}>
          <Text style={[styles.overallPct, { color: overallColor }]}>
            {summary ? `${summary.overallAccuracy}%` : '—'}
          </Text>
          <Text style={styles.overallLabel}>Overall accuracy</Text>
          {summary && (
            <Text style={styles.overallSub}>{summary.totalTrials} total trials</Text>
          )}
        </View>

        {/* Session info */}
        <View style={styles.sessionInfoBanner}>
          <Text style={styles.sessionInfoText}>
            <Text style={styles.sessionInfoBold}>Session: </Text>{sessionTitle}
          </Text>
          <Text style={styles.sessionInfoText}>
            <Text style={styles.sessionInfoBold}>Saved to: </Text>{patientLabel} in Caseload
          </Text>
        </View>

        {/* Step breakdowns */}
        {summary && (
          <>
            <Text style={styles.sectionLabel}>STEP BREAKDOWN</Text>
            {summary.stepSummaries.map((s) => (
              <StepResultCard key={s.stepIndex} summary={s} />
            ))}
          </>
        )}

        {/* Documentation phrase */}
        {summary && summary.totalTrials > 0 && (
          <View style={styles.docSection}>
            <Text style={styles.sectionLabel}>DOCUMENTATION</Text>
            {!docPhrase && (
              <Pressable
                style={[styles.docBtn, generatingDoc && styles.docBtnDisabled]}
                onPress={handleGenerateDoc}
                disabled={generatingDoc}
              >
                {generatingDoc ? (
                  <ActivityIndicator color={colors.surface} size="small" />
                ) : (
                  <Text style={styles.docBtnText}>✍️  Generate documentation phrase</Text>
                )}
              </Pressable>
            )}
            {docPhrase !== '' && (
              <View style={styles.docCard}>
                <Text style={styles.docText}>{docPhrase}</Text>
                <Pressable
                  style={[styles.copyBtn, copied && styles.copyBtnDone]}
                  onPress={handleCopy}
                >
                  <Text style={styles.copyBtnText}>
                    {copied ? '✓  Copied!' : 'Copy to clipboard'}
                  </Text>
                </Pressable>
                <Pressable onPress={handleGenerateDoc} style={styles.regenerateBtn}>
                  <Text style={styles.regenerateBtnText}>Regenerate</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {fromLibrary === 'true' ? (
            <Pressable
              style={styles.libraryBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.libraryBtnText}>← Back to Caseload</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={styles.libraryBtn}
                onPress={() => router.replace('/(tabs)/library')}
              >
                <Text style={styles.libraryBtnText}>View in Caseload →</Text>
              </Pressable>
              <Pressable
                style={styles.homeBtn}
                onPress={() => router.replace('/(tabs)/index')}
              >
                <Text style={styles.homeBtnText}>Back to home</Text>
              </Pressable>
            </>
          )}
        </View>

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
  screenTitle: { ...text.h2, color: colors.text },
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
  sectionLabel: { ...text.label, color: colors.textMuted, marginBottom: 10, marginTop: 4 },

  overallCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  overallPct: { fontSize: 64, fontFamily: 'Quicksand_700Bold', lineHeight: 72 },
  overallLabel: { ...text.h3, color: colors.text, marginTop: 4 },
  overallSub: { ...text.bodySmall, color: colors.textMuted, marginTop: 4 },

  sessionInfoBanner: {
    backgroundColor: colors.primaryLighter,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 4,
  },
  sessionInfoText: { ...text.bodySmall, color: colors.primaryDeep, lineHeight: 19 },
  sessionInfoBold: { fontFamily: 'Quicksand_700Bold' },

  stepCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNumCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: { ...text.caption, color: colors.surface, fontFamily: 'Quicksand_700Bold' },
  stepCardTitle: { ...text.h4, color: colors.text, flex: 1, lineHeight: 20 },
  stepAccuracy: { ...text.h3, fontFamily: 'Quicksand_700Bold', flexShrink: 0 },
  barTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  stepMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stepMetaText: { ...text.caption, color: colors.textMuted },
  cueBreakRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  cuePill: {
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  cuePillText: { ...text.caption, color: colors.primaryDark, fontFamily: 'Quicksand_600SemiBold' },
  noDataText: { ...text.caption, color: colors.textMuted, fontStyle: 'italic' },

  docSection: { marginBottom: 16 },
  docBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  docBtnDisabled: { opacity: 0.6 },
  docBtnText: { ...text.h4, color: colors.surface },
  docCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  docText: { ...text.bodySmall, color: colors.text, lineHeight: 22 },
  copyBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  copyBtnDone: { backgroundColor: '#16A34A' },
  copyBtnText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' },
  regenerateBtn: { alignItems: 'center', paddingVertical: 4 },
  regenerateBtnText: { ...text.caption, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },

  actions: { gap: 10, marginTop: 8 },
  libraryBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  libraryBtnText: { ...text.h4, color: colors.surface },
  homeBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  homeBtnText: { ...text.h4, color: colors.textMuted },
});

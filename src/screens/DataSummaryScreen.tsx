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
import * as Print from 'expo-print';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { CUE_LABELS, type StepSummary } from '@/types/sessionData';
// generateDocPhrase removed — doc phrase is now generated locally for consistency with the SOAP note

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

  const [copied, setCopied]             = useState(false);
  const [printingSOAP, setPrintingSOAP] = useState(false);

  let summary: { stepSummaries: StepSummary[]; overallAccuracy: number; totalTrials: number } | null = null;
  try { summary = JSON.parse(summaryJson ?? ''); } catch { /* handled below */ }

  const handlePrintSOAP = async () => {
    if (!summary) return;
    setPrintingSOAP(true);
    try {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const pct = summary.overallAccuracy;
      const performanceInterp =
        pct >= 80
          ? 'Patient demonstrated strong performance within functional accuracy targets.'
          : pct >= 60
          ? 'Patient demonstrated emerging skills with moderate cueing support.'
          : 'Patient required significant cueing support. Consider adjusting step difficulty or hierarchy.';

      const stepRows = summary.stepSummaries
        .filter((s) => s.totalTrials > 0)
        .map((s) => `
          <tr>
            <td>${s.stepTitle}</td>
            <td style="text-align:center">${s.totalTrials}</td>
            <td style="text-align:center">${s.correctTrials}</td>
            <td style="text-align:center;font-weight:bold;color:${s.accuracy >= 80 ? '#16A34A' : s.accuracy >= 60 ? '#D97706' : '#DC2626'}">${s.accuracy}%</td>
            <td>${s.dominantCueLevel ? CUE_LABELS[s.dominantCueLevel as keyof typeof CUE_LABELS] ?? s.dominantCueLevel : '—'}</td>
          </tr>`)
        .join('');

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; padding: 36px; color: #1a1a1a; font-size: 13px; }
    .header { border-bottom: 2.5px solid #5b3fa6; padding-bottom: 14px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; color: #3d2876; margin-bottom: 6px; }
    .meta { font-size: 12px; color: #555; display: flex; gap: 24px; flex-wrap: wrap; }
    .meta span strong { color: #3d2876; }
    h2 { font-size: 14px; color: #3d2876; border-left: 4px solid #5b3fa6; padding-left: 10px;
         margin-top: 22px; margin-bottom: 10px; }
    p { line-height: 1.65; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 12px; }
    th { background: #f0ebfc; color: #3d2876; padding: 8px 10px; text-align: left; font-size: 11px;
         text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 8px 10px; border-bottom: 1px solid #e8e0f7; vertical-align: top; }
    .overall { background: #f0ebfc; border-radius: 8px; padding: 12px 16px; margin: 12px 0;
               display: inline-block; }
    .overall .pct { font-size: 32px; font-weight: bold; color: ${pct >= 80 ? '#16A34A' : pct >= 60 ? '#D97706' : '#DC2626'}; }
    .overall .lbl { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.05em; }
    .footer { margin-top: 36px; font-size: 10.5px; color: #999; border-top: 1px solid #e8e0f7;
              padding-top: 12px; text-align: center; }
    .signature-block { margin-top: 28px; display: flex; gap: 60px; }
    .sig-line { border-top: 1px solid #555; padding-top: 4px; width: 240px; font-size: 11px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SOAP Note</h1>
    <div class="meta">
      <span><strong>Session protocol:</strong> ${sessionTitle ?? 'Session'}</span>
      <span><strong>Treatment label:</strong> ${patientLabel ?? '—'}</span>
      <span><strong>Date:</strong> ${today}</span>
    </div>
  </div>

  <h2>S — Subjective</h2>
  <p>Patient presented for individual speech-language treatment. Session was conducted using the evidence-based protocol: <em>${sessionTitle ?? 'Session'}</em>. Patient tolerated the session. Background, goals, and clinical history are documented in the treatment plan on file.</p>

  <h2>O — Objective</h2>
  <p><strong>${patientLabel ?? 'Patient'}</strong> completed ${summary.stepSummaries.filter(s => s.totalTrials > 0).length} treatment step(s) with a total of <strong>${summary.totalTrials} trials</strong>.</p>

  <table>
    <thead>
      <tr>
        <th>Step / Target</th>
        <th style="text-align:center">Trials</th>
        <th style="text-align:center">Correct</th>
        <th style="text-align:center">Accuracy</th>
        <th>Primary Cue Used</th>
      </tr>
    </thead>
    <tbody>
      ${stepRows || '<tr><td colspan="5" style="color:#999;font-style:italic">No trials recorded</td></tr>'}
    </tbody>
  </table>

  <div class="overall">
    <div class="pct">${pct}%</div>
    <div class="lbl">Overall Accuracy</div>
  </div>

  <h2>A — Assessment</h2>
  <p>${performanceInterp} Overall accuracy was <strong>${pct}%</strong> across ${summary.totalTrials} total trial(s). Cueing hierarchy and response patterns are detailed above.</p>

  <h2>P — Plan</h2>
  <p>Continue evidence-based treatment protocol per established plan of care. Review accuracy trends across sessions and adjust cueing level, session targets, or step difficulty as clinically indicated. Consider increasing complexity if accuracy is consistently ≥ 80%, or providing additional modeling and scaffolding if accuracy remains below 60%.</p>

  <div class="signature-block">
    <div>
      <div class="sig-line">Clinician Signature</div>
    </div>
    <div>
      <div class="sig-line">Date</div>
    </div>
    <div>
      <div class="sig-line">Credentials / License #</div>
    </div>
  </div>

  <div class="footer">
    Generated by EBP-SLP · For authorized clinical use only · Contains no patient PHI · Review and customize before filing
  </div>
</body>
</html>`;

      await Print.printAsync({ html });
    } catch (e: any) {
      if (e?.message !== 'Printing did not complete') {
        Alert.alert('Error', 'Could not open print dialog. Try again.');
      }
    } finally {
      setPrintingSOAP(false);
    }
  };

  // Deterministic doc phrase — matches the SOAP note's O and A language exactly
  const buildDocPhrase = (): string => {
    if (!summary) return '';
    const pct = summary.overallAccuracy;
    const stepsWithTrials = summary.stepSummaries.filter((s) => s.totalTrials > 0);
    const performanceInterp =
      pct >= 80
        ? 'Patient demonstrated strong performance within functional accuracy targets.'
        : pct >= 60
        ? 'Patient demonstrated emerging skills with moderate cueing support.'
        : 'Patient required significant cueing support; consider adjusting step difficulty or hierarchy.';
    const s1 = `Patient completed ${stepsWithTrials.length} treatment step(s) via ${sessionTitle ?? 'session'} with ${summary.totalTrials} total trial(s).`;
    const s2 = `Patient achieved ${pct}% overall accuracy across ${summary.totalTrials} trial(s).`;
    return `${s1} ${s2} ${performanceInterp}`;
  };

  const docPhrase = buildDocPhrase();

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
            <Text style={styles.sessionInfoBold}>Saved to: </Text>{patientLabel} in Plans
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

        {/* Documentation */}
        {summary && summary.totalTrials > 0 && (
          <View style={styles.docSection}>
            <Text style={styles.sectionLabel}>DOCUMENTATION</Text>

            {/* SOAP note */}
            <Pressable
              style={[styles.soapBtn, printingSOAP && styles.docBtnDisabled]}
              onPress={handlePrintSOAP}
              disabled={printingSOAP}
            >
              {printingSOAP ? (
                <ActivityIndicator color={colors.primaryDark} size="small" />
              ) : (
                <Text style={styles.soapBtnText}>📋  Print SOAP note</Text>
              )}
            </Pressable>

            {/* Documentation phrase — same content as SOAP note O + A */}
            <View style={styles.docCard}>
              <Text style={styles.docCardLabel}>Documentation phrase</Text>
              <Text style={styles.docText}>{docPhrase}</Text>
              <Pressable
                style={[styles.copyBtn, copied && styles.copyBtnDone]}
                onPress={handleCopy}
              >
                <Text style={styles.copyBtnText}>
                  {copied ? '✓  Copied!' : 'Copy to clipboard'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {fromLibrary === 'true' ? (
            <Pressable
              style={styles.libraryBtn}
              onPress={() => router.back()}
            >
              <Text style={styles.libraryBtnText}>← Back to Plans</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={styles.libraryBtn}
                onPress={() => router.replace('/(tabs)/library')}
              >
                <Text style={styles.libraryBtnText}>View in Plans →</Text>
              </Pressable>
              <Pressable
                style={styles.homeBtn}
                onPress={() => router.replace('/(tabs)')}
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
  soapBtn: {
    backgroundColor: colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  soapBtnText: { ...text.h4, color: colors.primaryDark },
  docCardLabel: {
    ...text.label,
    color: colors.textMuted,
    marginBottom: 8,
  },
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
  regeneratingText: { ...text.caption, color: colors.primary, fontFamily: 'Quicksand_600SemiBold' },

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

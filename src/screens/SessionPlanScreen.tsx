import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { getArticleById } from '@/data/articles';
import { type GeneratedPlan } from '@/services/claude';
import {
  savePlan,
  getSavedPlans,
  getPatientLabels,
  deleteSavedPlan,
} from '@/services/storage';

// ─── Sub-components ───────────────────────────────────────────────────────────

const StepCard: React.FC<{
  number: number;
  title: string;
  duration: string;
  instructions: string;
  whyNote: string;
  showWhyNotes: boolean;
}> = ({ number, title, duration, instructions, whyNote, showWhyNotes }) => (
  <View style={styles.stepCard}>
    <View style={styles.stepHeader}>
      <View style={styles.stepNumCircle}>
        <Text style={styles.stepNum}>{number}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <View style={styles.stepTimeBadge}>
        <Text style={styles.stepTimeText}>{duration}</Text>
      </View>
    </View>
    <Text style={styles.stepInstructions}>{instructions}</Text>
    {showWhyNotes && !!whyNote && (
      <View style={styles.whyRow}>
        <Text style={styles.whyLabel}>Why: </Text>
        <Text style={styles.whyText}>{whyNote}</Text>
      </View>
    )}
  </View>
);

const InfoPanel: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <View style={styles.infoPanel}>
    <Text style={styles.infoPanelTitle}>{title}</Text>
    <Text style={styles.infoPanelBody}>{body}</Text>
  </View>
);

// ─── Save Modal ───────────────────────────────────────────────────────────────

interface SaveModalProps {
  visible: boolean;
  existingLabels: string[];
  onSave: (label: string) => void;
  onClose: () => void;
  saving: boolean;
}

const SaveModal: React.FC<SaveModalProps> = ({
  visible,
  existingLabels,
  onSave,
  onClose,
  saving,
}) => {
  const [label, setLabel] = useState('');

  // Reset input when modal opens
  useEffect(() => {
    if (visible) setLabel('');
  }, [visible]);

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a name for this treatment approach or group.');
      return;
    }
    onSave(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>Save to Plans</Text>
          <Text style={styles.modalSubtitle}>
            Name your treatment approach or group — no patient names.
          </Text>

          {/* Existing label chips */}
          {existingLabels.length > 0 && (
            <View style={styles.existingSection}>
              <Text style={styles.existingLabel}>EXISTING PATIENTS</Text>
              <View style={styles.chipRow}>
                {existingLabels.map((l) => (
                  <Pressable
                    key={l}
                    style={[
                      styles.labelChip,
                      label === l && styles.labelChipSelected,
                    ]}
                    onPress={() => setLabel(l)}
                  >
                    <Text
                      style={[
                        styles.labelChipText,
                        label === l && styles.labelChipTextSelected,
                      ]}
                    >
                      {l}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* New label input */}
          <TextInput
            style={styles.labelInput}
            value={label}
            onChangeText={(t) => setLabel(t)}
            placeholder={existingLabels.length > 0 ? 'Or add new…' : 'e.g. Fluency Group, Aphasia AM, CILT'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          {/* Actions */}
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Session Plan Screen ──────────────────────────────────────────────────────

export const SessionPlanScreen: React.FC = () => {
  const router = useRouter();
  const { planJson, articleId, source, savedPlanId: savedPlanIdParam, patientLabel: patientLabelParam } = useLocalSearchParams<{
    planJson: string;
    articleId: string;
    source?: string;       // 'library' → back btn says ← Library
    savedPlanId?: string;  // set when opened from library
    patientLabel?: string; // set when opened from library
  }>();

  const article = getArticleById(articleId);

  // ── Settings ──
  const [showWhyNotes, setShowWhyNotes] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('ebp_slp_settings_v1').then((raw) => {
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (typeof s.showWhyNotes === 'boolean') setShowWhyNotes(s.showWhyNotes);
        } catch {}
      }
    });
  }, []);

  // ── Save state ──
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [existingLabels, setExistingLabels] = useState<string[]>([]);

  const loadLabels = useCallback(async () => {
    const plans = await getSavedPlans();
    setExistingLabels(getPatientLabels(plans));
  }, []);

  useEffect(() => {
    loadLabels().catch(() => {});
  }, [loadLabels]);

  const handleOpenSave = async () => {
    try { await loadLabels(); } catch {} // refresh in case user saved others recently
    setModalVisible(true);
  };

  // ── Export plan as formatted PDF (print / save to Files — no sharing) ──
  const handleExport = async () => {
    if (!plan || !article) return;

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const evidenceBadge = article.evidenceLevel.toUpperCase();

    const stepsHTML = plan.steps.map((s) => `
      <div class="step">
        <div class="step-header">
          <div class="step-num">${s.number}</div>
          <div class="step-title">${s.title}</div>
          <div class="step-duration">${s.duration}</div>
        </div>
        <div class="step-instructions">${s.instructions}</div>
        ${showWhyNotes && s.whyNote ? `<div class="why-note"><span class="why-label">Why: </span>${s.whyNote}</div>` : ''}
      </div>
    `).join('');

    const additionalPanels = [
      plan.cueingHierarchy ? { title: 'Cueing Hierarchy', body: plan.cueingHierarchy } : null,
      plan.homeProgram     ? { title: 'Home Program',      body: plan.homeProgram }     : null,
      plan.clinicianNotes  ? { title: 'Clinician Notes',   body: plan.clinicianNotes }  : null,
    ].filter(Boolean) as { title: string; body: string }[];

    const additionalHTML = additionalPanels.length > 0 ? `
      <div class="section-heading">Additional Information</div>
      ${additionalPanels.map((p) => `
        <div class="info-panel">
          <div class="info-panel-title">${p.title}</div>
          <div class="info-panel-body">${p.body}</div>
        </div>
      `).join('')}
    ` : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EBP-SLP Session Plan</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, Helvetica Neue, Arial, sans-serif;
      font-size: 13px;
      color: #1f1f2e;
      max-width: 680px;
      margin: 0 auto;
      padding: 28px 24px;
      line-height: 1.5;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #5b3fa6;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }
    .app-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #5b3fa6;
      margin-bottom: 8px;
    }
    .session-title {
      font-size: 22px;
      font-weight: 800;
      color: #1f1f2e;
      margin: 4px 0 6px;
    }
    .meta-row {
      font-size: 11.5px;
      color: #6b7280;
    }
    .chips {
      display: flex;
      gap: 8px;
      justify-content: center;
      flex-wrap: wrap;
      margin: 14px 0;
    }
    .chip {
      display: inline-block;
      padding: 5px 13px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
      background: #ede9fe;
      color: #5b3fa6;
      border: 1px solid #c4b5fd;
    }
    .section-heading {
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #9ca3af;
      margin: 20px 0 12px;
    }
    .step {
      border: 1.5px solid #e5e7eb;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .step-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .step-num {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: #5b3fa6;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      text-align: center;
      line-height: 30px;
    }
    .step-title {
      font-size: 14px;
      font-weight: 700;
      color: #1f1f2e;
      flex: 1;
    }
    .step-duration {
      font-size: 11px;
      font-weight: 600;
      color: #5b3fa6;
      background: #ede9fe;
      padding: 3px 9px;
      border-radius: 6px;
      white-space: nowrap;
    }
    .step-instructions {
      font-size: 12.5px;
      color: #374151;
      line-height: 1.6;
      margin-bottom: 6px;
    }
    .why-note {
      font-size: 11.5px;
      color: #6b7280;
      border-left: 2.5px solid #c4b5fd;
      padding-left: 10px;
      margin-top: 6px;
      line-height: 1.5;
    }
    .why-label { font-weight: 700; color: #5b3fa6; }
    .info-panel {
      border: 1.5px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 8px;
      page-break-inside: avoid;
    }
    .info-panel-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #5b3fa6;
      margin-bottom: 6px;
    }
    .info-panel-body {
      font-size: 12.5px;
      color: #374151;
      line-height: 1.6;
    }
    .notice {
      text-align: center;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 10.5px;
      color: #92400e;
      margin-top: 18px;
    }
    .footer {
      margin-top: 14px;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
    }
    @media print {
      body { padding: 0; }
      .step, .info-panel { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="app-badge">EBP-SLP · Evidence-Based Practice</div>
    <div class="session-title">${plan.sessionTitle ?? 'Session Plan'}</div>
    <div class="meta-row">${article.authorShort} (${article.year}) &nbsp;·&nbsp; Level ${evidenceBadge} Evidence &nbsp;·&nbsp; ${today}</div>
  </div>

  <div class="chips">
    <span class="chip">⏱&nbsp; ${plan.totalDuration}</span>
    <span class="chip">📋&nbsp; ${plan.steps.length} steps</span>
    <span class="chip">${plan.protocolFidelityNote}</span>
  </div>

  <div class="section-heading">Session Steps</div>

  ${stepsHTML}

  ${additionalHTML}

  <div class="notice">
    ⚠️&nbsp; For personal clinical use only &nbsp;·&nbsp; Not for distribution &nbsp;·&nbsp; Generated via EBP-SLP
  </div>
  <div class="footer">Generated by EBP-SLP &nbsp;·&nbsp; ebpslp.com &nbsp;·&nbsp; Licensed for individual use only</div>
</body>
</html>`;

    try {
      await Print.printAsync({ html });
    } catch {
      Alert.alert('Print failed', 'Could not open the print dialog. Try again.');
    }
  };

  // ── Delete plan (when opened from library) ──
  const handleDeleteFromPlan = () => {
    if (!savedPlanIdParam) return;
    Alert.alert(
      'Delete this plan?',
      'This session plan will be removed from your library. Session data collected from it will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSavedPlan(savedPlanIdParam);
            router.replace('/(tabs)/library');
          },
        },
      ]
    );
  };

  const handleSave = async (label: string) => {
    if (!article || !plan) return;
    setSaving(true);
    try {
      const saved = await savePlan({
        patientLabel: label,
        articleId: article.id,
        articleShortTitle: article.shortTitle,
        articleAuthorShort: article.authorShort,
        articleYear: article.year,
        plan,
      });
      setSavedLabel(label);
      setSavedPlanId(saved.id);
      setModalVisible(false);
    } catch {
      Alert.alert('Save failed', 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Parse plan ──
  let plan: GeneratedPlan | null = null;
  try {
    const parsed = JSON.parse(planJson ?? '');
    // Guard against plans with missing or empty steps array
    if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      plan = parsed;
    }
  } catch {
    // handled below
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorTitle}>Couldn't load plan</Text>
          <Text style={styles.errorBody}>Something went wrong. Go back and try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const backLabel = source === 'library' ? '← Plans' : '← Back';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Today's session</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Citation banner */}
        <View style={styles.citationBanner}>
          <Text style={styles.citationText}>
            <Text style={styles.citationLabel}>Protocol: </Text>
            {plan.protocolFidelityNote}
          </Text>
        </View>

        {/* PHI safe banner */}
        <View style={styles.phiBanner}>
          <Text style={styles.phiIcon}>🛡</Text>
          <Text style={styles.phiText}>
            <Text style={styles.phiBold}>PHI-safe by design. </Text>
            Counts only — no patient names, no notes, nothing leaves your device.
          </Text>
        </View>

        {/* Session summary row */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>⏱ {plan.totalDuration}</Text>
          </View>
          <View style={styles.summaryChip}>
            <Text style={styles.summaryChipText}>📋 {plan.steps.length} steps</Text>
          </View>
        </View>

        {/* Steps */}
        {plan.steps.map((step) => (
          <StepCard
            key={step.number}
            number={step.number}
            title={step.title}
            duration={step.duration}
            instructions={step.instructions}
            whyNote={step.whyNote}
            showWhyNotes={showWhyNotes}
          />
        ))}

        {/* ─── Additional Information divider ─── */}
        {(!!plan.cueingHierarchy || !!plan.homeProgram || !!plan.clinicianNotes) && (
          <View style={styles.sectionDivider}>
            <View style={styles.sectionDividerLine} />
            <Text style={styles.sectionDividerLabel}>ADDITIONAL INFORMATION</Text>
            <View style={styles.sectionDividerLine} />
          </View>
        )}

        {/* Cueing hierarchy */}
        {!!plan.cueingHierarchy && (
          <InfoPanel title="Cueing hierarchy" body={plan.cueingHierarchy} />
        )}

        {/* Home program */}
        {!!plan.homeProgram && (
          <InfoPanel title="Home program" body={plan.homeProgram} />
        )}

        {/* Clinician notes */}
        {!!plan.clinicianNotes && (
          <InfoPanel title="Clinician notes" body={plan.clinicianNotes} />
        )}

        {/* Article credit */}
        {article && (
          <View style={styles.articleCredit}>
            <Text style={styles.articleCreditText}>
              Generated from: {article.authorShort} ({article.year}) · {article.evidenceLevel.toUpperCase()} evidence
            </Text>
          </View>
        )}

        {/* Save button / data collection */}
        {savedLabel && savedPlanId ? (
          <View style={styles.postSaveGroup}>
            <View style={styles.savedConfirmation}>
              <Text style={styles.savedIcon}>✓</Text>
              <Text style={styles.savedText}>Saved to "{savedLabel}"</Text>
            </View>
            <Pressable
              style={styles.dataBtn}
              onPress={() =>
                router.push({
                  pathname: '/session/data',
                  params: {
                    planJson,
                    articleId,
                    savedPlanId,
                    patientLabel: savedLabel,
                  },
                })
              }
            >
              <Text style={styles.dataBtnText}>📊  Start data collection</Text>
            </Pressable>
            <Pressable style={styles.exportBtn} onPress={handleExport}>
              <Text style={styles.exportBtnText}>🖨  Save / Print plan</Text>
            </Pressable>
            <Pressable
              style={styles.viewPlansBtn}
              onPress={() => router.replace('/(tabs)/library')}
            >
              <Text style={styles.viewPlansBtnText}>View in Plans →</Text>
            </Pressable>
          </View>
        ) : source === 'library' && savedPlanIdParam ? (
          // Opened from library — show data + print + delete
          <View style={styles.postSaveGroup}>
            <Pressable
              style={styles.dataBtn}
              onPress={() =>
                router.push({
                  pathname: '/session/data',
                  params: {
                    planJson,
                    articleId,
                    savedPlanId: savedPlanIdParam,
                    patientLabel: patientLabelParam ?? '',
                  },
                })
              }
            >
              <Text style={styles.dataBtnText}>📊  Start data collection</Text>
            </Pressable>
            <Pressable style={styles.exportBtn} onPress={handleExport}>
              <Text style={styles.exportBtnText}>🖨  Save / Print plan</Text>
            </Pressable>
            <Pressable style={styles.deletePlanBtn} onPress={handleDeleteFromPlan}>
              <Text style={styles.deletePlanBtnText}>🗑  Delete this plan</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.postSaveGroup}>
            <Pressable style={styles.saveBtn} onPress={handleOpenSave}>
              <Text style={styles.saveBtnText}>📋  Save to Plans</Text>
            </Pressable>
            <Pressable style={styles.exportBtn} onPress={handleExport}>
              <Text style={styles.exportBtnText}>🖨  Save / Print plan</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Save Modal */}
      <SaveModal
        visible={modalVisible}
        existingLabels={existingLabels}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
        saving={saving}
      />
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
    marginBottom: 10,
  },
  citationLabel: { fontFamily: 'Quicksand_700Bold', color: colors.primaryDeep },
  citationText: { ...text.bodySmall, color: colors.primaryDeep, lineHeight: 18 },

  phiBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  phiIcon: { fontSize: 16 },
  phiText: { ...text.bodySmall, color: '#166534', lineHeight: 17, flex: 1 },
  phiBold: { fontFamily: 'Quicksand_700Bold' },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 999,
  },
  summaryChipText: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_600SemiBold' },

  stepCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepNumCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNum: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' },
  stepTitle: { ...text.h4, color: colors.text, flex: 1 },
  stepTimeBadge: {
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stepTimeText: { ...text.badge, color: colors.primaryDeep },
  stepInstructions: { ...text.bodySmall, color: colors.text, lineHeight: 19, marginBottom: 8 },
  whyRow: { flexDirection: 'row', flexWrap: 'wrap' },
  whyLabel: { ...text.caption, color: colors.primaryDark, fontFamily: 'Quicksand_700Bold' },
  whyText: { ...text.caption, color: colors.textMuted, flex: 1, lineHeight: 17 },

  infoPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  infoPanelTitle: { ...text.h4, color: colors.primaryDeep, marginBottom: 6 },
  infoPanelBody: { ...text.bodySmall, color: colors.text, lineHeight: 19 },

  articleCredit: { marginTop: 4, marginBottom: 16, alignItems: 'center' },
  articleCreditText: { ...text.caption, color: colors.textMuted },

  saveBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveBtnText: { ...text.h4, color: colors.surface },

  postSaveGroup: { gap: 10 },
  savedConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    paddingVertical: 18,
  },
  savedIcon: { fontSize: 18, color: '#16A34A' },
  savedText: { ...text.h4, color: '#16A34A' },

  dataBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  dataBtnText: { ...text.h4, color: colors.surface },
  exportBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  exportBtnText: { ...text.h4, color: colors.primary },
  deletePlanBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  deletePlanBtnText: { ...text.bodySmall, color: '#DC2626', fontFamily: 'Quicksand_700Bold' },
  viewPlansBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  viewPlansBtnText: {
    ...text.bodySmall,
    color: colors.primary,
    fontFamily: 'Quicksand_700Bold',
  },
  // ── Section divider ──
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  sectionDividerLabel: {
    ...text.label,
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 0.5,
  },

  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { ...text.h3, color: colors.textMuted, marginBottom: 8 },
  errorBody: { ...text.body, color: colors.textMuted, textAlign: 'center' },

  // ── Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { ...text.h2, color: colors.text, marginBottom: 6 },
  modalSubtitle: { ...text.bodySmall, color: colors.textMuted, lineHeight: 18, marginBottom: 20 },

  existingSection: { marginBottom: 16 },
  existingLabel: { ...text.label, color: colors.textMuted, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  labelChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  labelChipSelected: {
    backgroundColor: colors.primaryLighter,
    borderColor: colors.primary,
  },
  labelChipText: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_600SemiBold' },
  labelChipTextSelected: { color: colors.primaryDeep },

  labelInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...text.body,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 20,
  },

  modalActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { ...text.h4, color: colors.textMuted },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.6 },
  confirmBtnText: { ...text.h4, color: colors.surface },
});

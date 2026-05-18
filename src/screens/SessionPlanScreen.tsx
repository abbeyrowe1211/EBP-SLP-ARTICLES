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
} from '@/services/storage';

// ─── Sub-components ───────────────────────────────────────────────────────────

const StepCard: React.FC<{
  number: number;
  title: string;
  duration: string;
  instructions: string;
  whyNote: string;
}> = ({ number, title, duration, instructions, whyNote }) => (
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
    {!!whyNote && (
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
    const trimmed = label.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Add initials', 'Enter up to 3 initials for this patient (e.g. "AJB").');
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

          <Text style={styles.modalTitle}>Save to caseload</Text>
          <Text style={styles.modalSubtitle}>
            No patient names — max 10 characters.
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
            onChangeText={(t) => setLabel(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            placeholder={existingLabels.length > 0 ? 'Or add new label…' : 'Label (e.g. AJB or ROOM12)'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={10}
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
  const { planJson, articleId, source } = useLocalSearchParams<{
    planJson: string;
    articleId: string;
    source?: string; // 'library' → back btn says ← Library
  }>();

  const article = getArticleById(articleId);

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
    loadLabels();
  }, [loadLabels]);

  const handleOpenSave = async () => {
    await loadLabels(); // refresh in case user saved others recently
    setModalVisible(true);
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
    plan = JSON.parse(planJson ?? '');
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

  const backLabel = source === 'library' ? '← Caseload' : '← Back';

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
          />
        ))}

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
          </View>
        ) : (
          <Pressable style={styles.saveBtn} onPress={handleOpenSave}>
            <Text style={styles.saveBtnText}>📋  Save to caseload</Text>
          </Pressable>
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

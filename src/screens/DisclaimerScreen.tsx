import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

// ─── Section block ────────────────────────────────────────────────────────────

const Block: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <View style={styles.block}>
    <Text style={styles.blockTitle}>{title}</Text>
    <Text style={styles.blockBody}>{body}</Text>
  </View>
);

// ─── Disclaimer Screen ────────────────────────────────────────────────────────

export const DisclaimerScreen: React.FC = () => {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Clinical Disclaimer</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>⚠️</Text>
          <Text style={styles.bannerText}>
            EBP-SLP is a professional reference and planning tool — not a medical device, diagnostic system, or substitute for clinical judgment.
          </Text>
        </View>

        <Block
          title="Intended users"
          body="EBP-SLP is designed exclusively for use by licensed speech-language pathologists (SLPs) and SLP students under clinical supervision. It is not intended for use by patients, caregivers, or members of the general public."
        />

        <Block
          title="Not a medical device"
          body="EBP-SLP has not been cleared or approved by the U.S. Food and Drug Administration (FDA) or any other regulatory body. It is not a medical device, diagnostic tool, or clinical decision support system as defined under applicable law."
        />

        <Block
          title="No clinical decisions"
          body="Nothing in this app constitutes medical advice, a clinical recommendation, or a treatment directive. All session plans, article summaries, and AI-generated content are provided for informational and planning purposes only. The clinician using this app is solely responsible for all clinical decisions made during patient care."
        />

        <Block
          title="AI-generated content"
          body="Session plans generated within this app are produced by an AI language model (Claude by Anthropic) based on parameters you provide. AI-generated plans are suggestions only. They may contain errors, omissions, or content that is inappropriate for a specific patient. Every plan must be reviewed, adapted, and approved by a licensed SLP before use with any patient."
        />

        <Block
          title="Article summaries"
          body="Research article summaries in this app are written interpretations of published studies. They are not verbatim reproductions of the original research. Always consult the primary source before basing clinical decisions on a summary. Evidence quality, applicability, and generalizability must be assessed by the individual clinician."
        />

        <Block
          title="No guarantee of outcomes"
          body="Use of evidence-based practice frameworks and research-informed session plans does not guarantee any particular patient outcome. Treatment effectiveness depends on many factors outside the scope of this app, including patient diagnosis, severity, comorbidities, motivation, and individual response to intervention."
        />

        <Block
          title="PHI and privacy"
          body="EBP-SLP is not HIPAA-compliant software and does not meet the technical, administrative, or physical safeguard requirements of the Health Insurance Portability and Accountability Act. Do not enter any Protected Health Information (PHI) into this application. Patient labels must be non-identifying. All data is stored locally on your device only."
        />

        <Block
          title="Liability for inadvertent PHI"
          body="EBP-SLP is not responsible for any Protected Health Information inadvertently entered into the app by the user. It is solely the clinician's responsibility to ensure that no patient-identifying information is entered at any time. If PHI is entered, it remains stored only on the user's local device — but all compliance obligations and associated risk remain with the clinician and their employer."
        />

        <Block
          title="Professional responsibility"
          body="The clinician using this app is responsible for complying with all applicable laws, regulations, professional standards, and facility policies — including but not limited to ASHA's Code of Ethics, state licensure requirements, and employer guidelines. EBP-SLP does not replace professional training, clinical supervision, or independent clinical judgment."
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>EBP-SLP · Version 1.0</Text>
          <Text style={styles.footerText}>For licensed SLPs and SLP students only</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backText: {
    ...text.body,
    color: colors.primary,
    fontFamily: 'Quicksand_600SemiBold',
  },
  screenTitle: { ...text.h3, color: colors.text },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  banner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  bannerIcon: { fontSize: 18 },
  bannerText: {
    ...text.bodySmall,
    color: '#92400E',
    flex: 1,
    lineHeight: 20,
    fontFamily: 'Quicksand_600SemiBold',
  },

  block: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  blockTitle: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 6,
  },
  blockBody: {
    ...text.bodySmall,
    color: colors.text,
    lineHeight: 20,
  },

  footer: {
    marginTop: 20,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    ...text.caption,
    color: colors.textMuted,
  },
});

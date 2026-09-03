// ─── Walkthrough Modal ────────────────────────────────────────────────────────
// First-launch tutorial that shows key app features.

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

const STEPS = [
  {
    icon: '👋',
    title: 'Welcome to EBP-SLP!',
    body: "You're in. Let's take a quick tour so you know exactly where everything lives.",
  },
  {
    icon: '⚡',
    title: 'Generate session plans',
    body: "See the ⚡ lightning bolt on an article card? Tap it to instantly build an evidence-based session plan tailored to your patient's needs.",
  },
  {
    icon: '🔖',
    title: 'Save & long-press to group',
    body: 'Tap the bookmark to save an article. Long-press any article to add it directly to one of your groups — great for organising by caseload.',
  },
  {
    icon: '📁',
    title: 'Create article groups',
    body: "Group your saved articles by topic, patient type, or whatever works for you — like 'Aphasia AM' or 'Swallowing Protocol'. Find them in the My Articles tab.",
  },
  {
    icon: '📝',
    title: 'Notes on any article',
    body: "Open an article and scroll down to find your personal notes panel. Jot down clinical reminders or highlights — a 📝 Note badge will appear on the card so you always know which articles you've annotated.",
  },
  {
    icon: '📊',
    title: 'Track data in-session',
    body: 'After saving a plan, tap "Start data collection" to track trial-by-trial accuracy during your session. All data stays on-device.',
  },
  {
    icon: '🎉',
    title: "You're all set!",
    body: "Explore the research, build your sessions, and keep growing. Your clients are lucky to have an SLP who cares this much.",
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export const WalkthroughModal: React.FC<Props> = ({ visible, onDone }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      setStep(0);
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  const skip = () => {
    setStep(0);
    onDone();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={skip}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Progress dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          <Text style={styles.stepIcon}>{current.icon}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.actions}>
            {!isLast && (
              <Pressable style={styles.skipBtn} onPress={skip}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.nextBtn, isLast && { flex: 1 }]}
              onPress={next}
            >
              <Text style={styles.nextText}>{isLast ? 'Get started →' : 'Next →'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 22,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
    borderRadius: 3,
  },
  stepIcon: {
    fontSize: 56,
    marginBottom: 16,
    textAlign: 'center',
  },
  title: {
    ...text.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 28,
  },
  body: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  skipText: {
    ...text.h4,
    color: colors.textMuted,
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  nextText: {
    ...text.h4,
    color: colors.surface,
  },
});

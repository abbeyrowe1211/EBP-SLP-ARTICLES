import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

interface Props {
  title: string;
  subtitle: string;
}

export const StubScreen: React.FC<Props> = ({ title, subtitle }) => (
  <SafeAreaView edges={['top']} style={styles.container}>
    <View style={styles.content}>
      <Text style={styles.emoji}>🚧</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.divider} />
      <Text style={styles.note}>
        Coming in the next build phase. Home screen is live now — tap around the bottom nav and
        scroll to see the full design system in action.
      </Text>
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    ...text.h1,
    color: colors.primaryDeep,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: colors.primaryLight,
    borderRadius: 2,
    marginBottom: 24,
  },
  note: {
    ...text.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

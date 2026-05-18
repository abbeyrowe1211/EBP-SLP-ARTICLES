import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

interface Props {
  label: string;
  title: string;
  authors: string;
  lastOpenedAt?: number; // timestamp ms
  onPress?: () => void;
}

function timeAgo(ts?: number): string {
  if (!ts) return 'Recently opened';
  const diffMs = Date.now() - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Opened today';
  if (diffDays === 1) return 'Opened yesterday';
  if (diffDays < 7) return `Opened ${diffDays} days ago`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return 'Opened 1 week ago';
  if (weeks < 5) return `Opened ${weeks} weeks ago`;
  return 'Opened a while ago';
}

export const ResumeCard: React.FC<Props> = ({ label, title, authors, lastOpenedAt, onPress }) => (
  <Pressable onPress={onPress}>
    <LinearGradient colors={[colors.primary, '#B794F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{authors}</Text>
        <Text style={styles.meta}>{timeAgo(lastOpenedAt)}</Text>
      </View>
    </LinearGradient>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
  },
  label: {
    ...text.label,
    color: 'white',
    opacity: 0.95,
    marginBottom: 6,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  title: {
    ...text.h4,
    color: 'white',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    ...text.caption,
    color: 'white',
    opacity: 0.95,
  },
});

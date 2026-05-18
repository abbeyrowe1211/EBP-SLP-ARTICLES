import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

interface Props {
  name: string;
  count: string;
  borderColor: string;
  onPress?: () => void;
}

export const SettingCard: React.FC<Props> = ({ name, count, borderColor, onPress }) => (
  <Pressable style={[styles.card, { borderLeftColor: borderColor }]} onPress={onPress}>
    <Text style={styles.name}>{name}</Text>
    <Text style={styles.count}>{count}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: 14,
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 14,
    minWidth: 140,
    marginRight: 8,
  },
  name: {
    ...text.h4,
    color: colors.text,
    marginBottom: 2,
  },
  count: {
    ...text.caption,
    color: colors.textMuted,
  },
});

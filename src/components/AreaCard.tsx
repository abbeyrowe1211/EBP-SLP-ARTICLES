import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

interface Props {
  title: string;
  subtitle: string;
  iconBg: string;
  iconColor: string;
  Icon: React.FC<{ color?: string; size?: number }>;
  onPress?: () => void;
}

export const AreaCard: React.FC<Props> = ({ title, subtitle, iconBg, iconColor, Icon, onPress }) => (
  <Pressable style={styles.card} onPress={onPress}>
    <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
      <Icon color={iconColor} size={26} />
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    minHeight: 110,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    ...text.h4,
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    ...text.caption,
    color: colors.textMuted,
  },
});

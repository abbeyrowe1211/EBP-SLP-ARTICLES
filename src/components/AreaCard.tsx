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
      <Icon color={iconColor} size={24} />
    </View>
    <Text style={styles.title} maxFontSizeMultiplier={1.4}>{title}</Text>
    <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>{subtitle}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    // No minHeight — let the card size naturally to its content so the
    // subtitle is never clipped on any device or system font setting.
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
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

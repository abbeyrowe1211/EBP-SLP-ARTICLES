import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { PillarsIcon } from './icons/AreaIcons';
import { useArticles } from '@/context/ArticlesContext';

interface Props {
  onPressArticle: (id: string) => void;
}

export const FoundationsCard: React.FC<Props> = ({ onPressArticle }) => {
  const { articles } = useArticles();
  const foundationArticles = articles.filter((a) => a.isFoundation);
  return (
  <LinearGradient
    colors={[colors.pastelLavender, colors.primaryLight, colors.pastelPeach]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.card}
  >
    <View style={styles.header}>
      <View style={styles.iconWrap}>
        <PillarsIcon color={colors.primaryDeep} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>The pillars behind every protocol</Text>
        <Text style={styles.sub}>Tap any article to read more</Text>
      </View>
    </View>

    {foundationArticles.map((article) => (
      <Pressable
        key={article.id}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => onPressArticle(article.id)}
      >
        <Text style={styles.line} numberOfLines={1}>
          · <Text style={styles.bold}>{article.authorShort} ({article.year})</Text>
          {'  '}
          <Text style={styles.topic}>{article.shortTitle}</Text>
        </Text>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    ))}
  </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconWrap: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...text.h4,
    color: colors.primaryDeep,
    fontSize: 14,
  },
  sub: {
    ...text.caption,
    color: colors.primaryDeep,
    opacity: 0.75,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderRadius: 8,
    paddingHorizontal: 2,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  line: {
    ...text.bodySmall,
    color: colors.text,
    lineHeight: 20,
    flex: 1,
  },
  bold: {
    fontFamily: 'Quicksand_700Bold',
    color: colors.primaryDeep,
  },
  topic: {
    color: colors.text,
    opacity: 0.8,
  },
  arrow: {
    ...text.h3,
    color: colors.primaryDeep,
    opacity: 0.5,
    marginLeft: 4,
  },
});

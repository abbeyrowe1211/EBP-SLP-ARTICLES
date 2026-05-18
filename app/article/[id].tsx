import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArticleDetailScreen } from '@/screens/ArticleDetailScreen';
import { getArticleById } from '@/data/articles';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';

export default function ArticleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = getArticleById(id);

  if (!article) {
    return (
      <SafeAreaView style={styles.notFound}>
        <Text style={styles.notFoundText}>Article not found.</Text>
      </SafeAreaView>
    );
  }

  return <ArticleDetailScreen article={article} />;
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    ...text.body,
    color: colors.textMuted,
  },
});

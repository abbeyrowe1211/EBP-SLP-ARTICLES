import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { EVIDENCE_LABELS, EVIDENCE_COLORS, type Article } from '@/data/articles';
import { getSavedArticleIds, toggleSavedArticle } from '@/store/savedArticlesStore';
import { useArticles } from '@/context/ArticlesContext';

// ─── Article row ──────────────────────────────────────────────────────────────

const SavedArticleRow: React.FC<{
  article: Article;
  onPress: () => void;
  onUnsave: () => void;
}> = ({ article, onPress, onUnsave }) => {
  const evColor = EVIDENCE_COLORS[article.evidenceLevel];
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <View style={[styles.evBadge, { backgroundColor: evColor.bg }]}>
          <Text style={[styles.evBadgeText, { color: evColor.text }]}>
            {EVIDENCE_LABELS[article.evidenceLevel]}
          </Text>
        </View>
        <Text style={styles.rowTitle} numberOfLines={2}>{article.shortTitle}</Text>
        <Text style={styles.rowMeta}>
          {article.authorShort} · {article.year} · {article.areas[0]}
        </Text>
      </View>
      <Pressable style={styles.unsaveBtn} onPress={onUnsave} hitSlop={8}>
        <Text style={styles.unsaveBtnText}>✕</Text>
      </Pressable>
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export const SavedArticlesScreen: React.FC = () => {
  const router = useRouter();
  const { articles } = useArticles();
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);

  const load = useCallback(async () => {
    const ids = await getSavedArticleIds();
    setSavedArticles(articles.filter((a) => ids.has(a.id)));
  }, [articles]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleUnsave = async (id: string) => {
    await toggleSavedArticle(id);
    await load();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Articles</Text>
        <Text style={styles.headerCount}>
          {savedArticles.length} saved
        </Text>
      </View>

      {savedArticles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔖</Text>
          <Text style={styles.emptyTitle}>No saved articles yet</Text>
          <Text style={styles.emptyBody}>
            Tap "Save" on any article to bookmark it here for quick access.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {savedArticles.map((article) => (
            <SavedArticleRow
              key={article.id}
              article={article}
              onPress={() => router.push({ pathname: '/article/[id]', params: { id: article.id } })}
              onUnsave={() => handleUnsave(article.id)}
            />
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { ...text.h2, color: colors.text },
  headerCount: {
    ...text.caption,
    color: colors.primaryDeep,
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontFamily: 'Quicksand_600SemiBold',
    overflow: 'hidden',
  },
  scroll: { paddingHorizontal: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  rowLeft: { flex: 1, gap: 6 },
  evBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  evBadgeText: { ...text.badge, fontSize: 10 },
  rowTitle: {
    ...text.bodySmall,
    color: colors.text,
    fontFamily: 'Quicksand_600SemiBold',
    lineHeight: 18,
  },
  rowMeta: { ...text.caption, color: colors.textMuted },

  unsaveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  unsaveBtnText: {
    ...text.caption,
    color: colors.textMuted,
    fontSize: 11,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  emptyBody: {
    ...text.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

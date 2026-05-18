import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { SearchIcon } from '@/components/icons/NavIcons';
import {
  EVIDENCE_LABELS,
  EVIDENCE_COLORS,
  type Article,
  type AshaArea,
} from '@/data/articles';
import { useArticles } from '@/context/ArticlesContext';
import { getBrowseArea, setBrowseArea, subscribeBrowseArea, getBrowseQuery, setBrowseQuery, subscribeBrowseQuery } from '@/store/browseStore';

// ─── Area definitions (in display order) ─────────────────────────────────────

const AREAS: { label: string; value: AshaArea | 'All' }[] = [
  { label: 'All areas', value: 'All' },
  { label: 'Language', value: 'Language' },
  { label: 'Swallowing', value: 'Swallowing' },
  { label: 'Voice & Resonance', value: 'Voice & Resonance' },
  { label: 'Motor Speech', value: 'Motor Speech' },
  { label: 'Cognitive-Comm', value: 'Cognitive-Communication' },
  { label: 'Fluency', value: 'Fluency' },
  { label: 'AAC', value: 'AAC' },
];

// Ordered area names for section display
const AREA_ORDER: AshaArea[] = [
  'Language',
  'Swallowing',
  'Voice & Resonance',
  'Motor Speech',
  'Cognitive-Communication',
  'Fluency',
  'AAC',
];

// ─── Article card ─────────────────────────────────────────────────────────────

const ArticleCard: React.FC<{ article: Article; onPress: () => void }> = ({
  article,
  onPress,
}) => {
  const evColor = EVIDENCE_COLORS[article.evidenceLevel];
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: evColor.bg }]}>
          <Text style={[styles.badgeText, { color: evColor.text }]}>
            {EVIDENCE_LABELS[article.evidenceLevel]}
          </Text>
        </View>
        {article.isFoundation && (
          <View style={[styles.badge, { backgroundColor: colors.primaryLighter }]}>
            <Text style={[styles.badgeText, { color: colors.primaryDeep }]}>Foundation</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {article.shortTitle}
      </Text>

      <Text style={styles.cardMeta}>
        {article.authorShort} · {article.journal.split(',')[0]} · {article.year}
      </Text>

      <Text style={styles.cardSummary} numberOfLines={3}>
        {article.summary}
      </Text>
    </Pressable>
  );
};

// ─── Area section ─────────────────────────────────────────────────────────────

const AreaSection: React.FC<{
  area: AshaArea;
  articles: Article[];
  onPress: (article: Article) => void;
}> = ({ area, articles, onPress }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{area}</Text>
      <View style={styles.sectionCount}>
        <Text style={styles.sectionCountText}>{articles.length}</Text>
      </View>
    </View>
    {articles.map((article) => (
      <ArticleCard
        key={article.id}
        article={article}
        onPress={() => onPress(article)}
      />
    ))}
  </View>
);

// ─── Browse Screen ────────────────────────────────────────────────────────────

export const BrowseScreen: React.FC = () => {
  const router = useRouter();
  const { articles: ARTICLES } = useArticles();
  const searchInputRef = useRef<TextInput>(null);

  const [selectedArea, setSelectedArea] = useState<AshaArea | 'All'>(getBrowseArea);
  const [searchQuery, setSearchQuery] = useState(getBrowseQuery);
  const [searchActive, setSearchActive] = useState(() => getBrowseQuery().length > 0);

  useEffect(() => {
    const unsubArea = subscribeBrowseArea((area) => setSelectedArea(area));
    const unsubQuery = subscribeBrowseQuery((q) => {
      setSearchQuery(q);
      setSearchActive(q.length > 0);
      if (q.length > 0) setTimeout(() => searchInputRef.current?.focus(), 50);
    });
    return () => { unsubArea(); unsubQuery(); };
  }, []);

  const selectArea = (area: AshaArea | 'All') => {
    setSelectedArea(area);
    setBrowseArea(area);
  };

  const openSearch = () => {
    setSearchActive(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setSearchQuery('');
    setBrowseQuery('');
    setSearchActive(false);
    Keyboard.dismiss();
  };

  // Evidence-strength sort order
  const evidenceRank = (level: string) =>
    ({ '1a': 0, '1b': 1, '2': 2, '3': 3 }[level] ?? 4);

  // Search across title, shortTitle, authors, tags, summary, area
  const matchesSearch = (a: Article, q: string) => {
    const lower = q.toLowerCase();
    return (
      a.shortTitle.toLowerCase().includes(lower) ||
      a.title.toLowerCase().includes(lower) ||
      a.authorShort.toLowerCase().includes(lower) ||
      a.authors.toLowerCase().includes(lower) ||
      a.summary.toLowerCase().includes(lower) ||
      a.tags.some((t) => t.toLowerCase().includes(lower)) ||
      a.areas.some((ar) => ar.toLowerCase().includes(lower)) ||
      String(a.year).includes(lower)
    );
  };

  const feed = ARTICLES
    .filter((a) => selectedArea === 'All' || a.areas.includes(selectedArea as AshaArea))
    .filter((a) => !searchQuery.trim() || matchesSearch(a, searchQuery.trim()))
    .sort((a, b) => b.year - a.year || evidenceRank(a.evidenceLevel) - evidenceRank(b.evidenceLevel));

  const handleArticlePress = (article: Article) => {
    router.push({ pathname: '/article/[id]', params: { id: article.id } });
  };

  const resultsLabel = () => {
    const count = `${feed.length} ${feed.length === 1 ? 'article' : 'articles'}`;
    if (searchQuery.trim()) return `${count} · "${searchQuery.trim()}"`;
    if (selectedArea !== 'All') return `${count} · ${selectedArea}`;
    return `${count} · newest first`;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {searchActive ? (
          // ── Search bar ──
          <View style={styles.searchBar}>
            <SearchIcon color={colors.textMuted} size={16} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search articles, authors, tags…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
            />
            <Pressable onPress={closeSearch} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          // ── Normal header ──
          <>
            <Text style={styles.screenTitle}>Browse</Text>
            <Pressable style={styles.searchBtn} onPress={openSearch}>
              <SearchIcon color={colors.primaryDark} size={18} />
            </Pressable>
          </>
        )}
      </View>

      {/* Area filter chips — hide when searching */}
      {!searchActive && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
          alwaysBounceHorizontal={false}
          keyboardShouldPersistTaps="handled"
        >
          {AREAS.map((a) => (
            <Pressable
              key={a.value}
              style={[styles.chip, selectedArea === a.value && styles.chipActive]}
              onPress={() => selectArea(a.value as AshaArea | 'All')}
            >
              <Text
                numberOfLines={1}
                style={[styles.chipText, selectedArea === a.value && styles.chipTextActive]}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Results count */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>{resultsLabel()}</Text>
      </View>

      {/* Feed */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {feed.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyBody}>
              {searchQuery.trim()
                ? `No articles matched "${searchQuery.trim()}". Try a different keyword.`
                : 'No articles in this area yet. Check back soon.'}
            </Text>
          </View>
        ) : (
          feed.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onPress={() => handleArticlePress(article)}
            />
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  screenTitle: { ...text.h2, color: colors.text },
  searchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...text.body,
    color: colors.text,
    paddingVertical: 0,
  },
  cancelBtn: { paddingLeft: 4 },
  cancelText: {
    ...text.bodySmall,
    color: colors.primary,
    fontFamily: 'Quicksand_600SemiBold',
  },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterContent: {
    paddingHorizontal: 20,
    gap: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexShrink: 0,
    alignSelf: 'center',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...text.bodySmall,
    color: colors.textMuted,
    fontFamily: 'Quicksand_600SemiBold',
  },
  chipTextActive: { color: colors.surface },
  resultsRow: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  resultsText: { ...text.label, color: colors.textMuted },
  list: { paddingHorizontal: 16 },

  // ── Section ──
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 10,
    paddingTop: 8,
  },
  sectionTitle: {
    ...text.h3,
    color: colors.text,
  },
  sectionCount: {
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sectionCountText: {
    ...text.caption,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_700Bold',
  },

  // ── Card ──
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { ...text.badge },
  cardTitle: {
    ...text.h3,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  cardMeta: {
    ...text.caption,
    color: colors.textMuted,
    marginBottom: 8,
  },
  cardSummary: {
    ...text.bodySmall,
    color: colors.text,
    lineHeight: 18,
  },

  // ── Empty ──
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: { ...text.h3, color: colors.textMuted, marginBottom: 8 },
  emptyBody: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

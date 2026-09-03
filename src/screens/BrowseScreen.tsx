import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { hapticLight } from '@/utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
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
import { getSavedArticleIds, subscribeSavedArticles, toggleSavedArticle } from '@/store/savedArticlesStore';
import { getGroups, createGroup, setGroupArticles, subscribeGroups, type ArticleGroup } from '@/store/articleGroupsStore';
import { SavedIcon } from '@/components/icons/NavIcons';
import { isPremium } from '@/config/premium';

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
  { label: 'General Practice', value: 'General Practice' },
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
  'General Practice',
];

// ─── Article card ─────────────────────────────────────────────────────────────

const ArticleCard: React.FC<{
  article: Article;
  onPress: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
  onGeneratePress?: () => void;
  onLongPress?: () => void;
  hasNote?: boolean;
}> = ({ article, onPress, isSaved, onToggleSave, onGeneratePress, onLongPress, hasNote }) => {
  const evColor = EVIDENCE_COLORS[article.evidenceLevel];
  return (
    <Pressable style={styles.card} onPress={onPress} onLongPress={onLongPress} delayLongPress={400}>
      {/* Badge row + action icons */}
      <View style={styles.cardTopRow}>
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
          {hasNote && (
            <View style={[styles.badge, { backgroundColor: '#FFFBEB' }]}>
              <Text style={[styles.badgeText, { color: '#B45309' }]}>📝 Note</Text>
            </View>
          )}
        </View>
        <View style={styles.cardActions}>
          {article.isTreatmentFocused !== false && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onGeneratePress?.(); }}
              hitSlop={8}
              style={styles.cardBoltBtn}
            >
              <Text style={styles.cardBoltIcon}>⚡</Text>
            </Pressable>
          )}
          <Pressable
            onPress={(e) => { e.stopPropagation(); onToggleSave(); }}
            hitSlop={8}
            style={[styles.cardSaveBtn, isSaved && styles.cardSaveBtnActive]}
          >
            <SavedIcon color={isSaved ? colors.surface : colors.primaryDeep} size={13} filled={isSaved} />
          </Pressable>
        </View>
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
  savedIds: Set<string>;
  onPress: (article: Article) => void;
  onToggleSave: (article: Article) => void;
  onGeneratePress: (article: Article) => void;
  onLongPress: (article: Article) => void;
}> = ({ area, articles, savedIds, onPress, onToggleSave, onGeneratePress, onLongPress }) => (
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
        isSaved={savedIds.has(article.id)}
        onToggleSave={() => onToggleSave(article)}
        onGeneratePress={() => onGeneratePress(article)}
        onLongPress={() => onLongPress(article)}
      />
    ))}
  </View>
);

// ─── Browse Screen ────────────────────────────────────────────────────────────

export const BrowseScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { articles: ARTICLES, isLoading, fetchError } = useArticles();
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [notedIds, setNotedIds] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<ArticleGroup[]>([]);
  const searchInputRef = useRef<TextInput>(null);

  // Group picker modal state
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);
  const [newGroupInputVisible, setNewGroupInputVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [pendingArticleId, setPendingArticleId] = useState<string | null>(null);

  // Swipe-down to dismiss modal
  const sheetPanY = useRef(new Animated.Value(0)).current;
  // Use refs to keep panResponder callbacks stable across re-renders
  const groupPickerVisibleRef = useRef(groupPickerVisible);
  const newGroupInputVisibleRef = useRef(newGroupInputVisible);
  useEffect(() => { groupPickerVisibleRef.current = groupPickerVisible; }, [groupPickerVisible]);
  useEffect(() => { newGroupInputVisibleRef.current = newGroupInputVisible; }, [newGroupInputVisible]);

  const dismissModal = () => {
    Animated.timing(sheetPanY, { toValue: 600, duration: 220, useNativeDriver: true }).start(() => {
      sheetPanY.setValue(0);
      if (newGroupInputVisibleRef.current) { setNewGroupInputVisible(false); }
      else { setGroupPickerVisible(false); setPendingArticleId(null); }
    });
  };
  const dismissModalRef = useRef(dismissModal);
  useEffect(() => { dismissModalRef.current = dismissModal; });

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.dy > 0,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) sheetPanY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 90 || gs.vy > 1.2) {
          dismissModalRef.current();
        } else {
          Animated.spring(sheetPanY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    getSavedArticleIds().then(setSavedIds);
    getGroups().then(setGroups);
    const unsubSaved = subscribeSavedArticles(() => getSavedArticleIds().then(setSavedIds));
    const unsubGroups = subscribeGroups(() => getGroups().then(setGroups));
    return () => { unsubSaved(); unsubGroups(); };
  }, []);

  // Reload note indicators whenever screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('ebp_article_notes_v1').then((raw) => {
        if (!raw) { setNotedIds(new Set()); return; }
        try {
          const notes = JSON.parse(raw) as Record<string, string>;
          setNotedIds(new Set(Object.keys(notes).filter((k) => !!notes[k]?.trim())));
        } catch {
          setNotedIds(new Set());
        }
      });
    }, [])
  );

  const [selectedArea, setSelectedArea] = useState<AshaArea | 'All'>(getBrowseArea);
  const [searchQuery, setSearchQuery] = useState(getBrowseQuery);
  const [searchActive, setSearchActive] = useState(() => getBrowseQuery().length > 0);
  const [evidenceFilters, setEvidenceFilters] = useState<Set<string>>(new Set());

  const toggleEvidenceFilter = (value: string | null) => {
    if (value === null) {
      // "All levels" clears the selection
      setEvidenceFilters(new Set());
      return;
    }
    setEvidenceFilters((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  };
  const [sortBy, setSortBy] = useState<'newest' | 'evidence'>('newest');

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
  // Null-safe: remote articles may have missing fields if fetched with encoding issues
  const matchesSearch = (a: Article, q: string) => {
    const lower = q.toLowerCase();
    const safe = (s?: string | null) => (s ?? '').toLowerCase();
    const safeArr = (arr?: string[] | null) => (Array.isArray(arr) ? arr : []);
    return (
      safe(a.shortTitle).includes(lower) ||
      safe(a.title).includes(lower) ||
      safe(a.authorShort).includes(lower) ||
      safe(a.authors).includes(lower) ||
      safe(a.summary).includes(lower) ||
      safeArr(a.tags).some((t) => safe(t).includes(lower)) ||
      safeArr(a.areas).some((ar) => safe(ar).includes(lower)) ||
      String(a.year).includes(lower)
    );
  };

  const feed = ARTICLES
    .filter((a) => selectedArea === 'All' || a.areas.includes(selectedArea as AshaArea))
    .filter((a) => !searchQuery.trim() || matchesSearch(a, searchQuery.trim()))
    .filter((a) => evidenceFilters.size === 0 || evidenceFilters.has(a.evidenceLevel))
    .sort((a, b) =>
      sortBy === 'evidence'
        ? evidenceRank(a.evidenceLevel) - evidenceRank(b.evidenceLevel) || b.year - a.year
        : b.year - a.year || evidenceRank(a.evidenceLevel) - evidenceRank(b.evidenceLevel)
    );

  const handleArticlePress = (article: Article) => {
    router.push({ pathname: '/article/[id]', params: { id: article.id } });
  };

  // Save with group prompt — opens custom in-app modal
  const handleSaveWithGroupPrompt = async (articleId: string) => {
    hapticLight();
    const nowSaved = await toggleSavedArticle(articleId);
    if (!nowSaved) return; // unsaved — no prompt needed
    setPendingArticleId(articleId);
    setGroupPickerVisible(true);
  };

  const handleGroupSelected = async (groupId: string) => {
    if (!pendingArticleId) return;
    const g = groups.find((grp) => grp.id === groupId);
    if (g) {
      const updated = g.articleIds.includes(pendingArticleId)
        ? g.articleIds
        : [...g.articleIds, pendingArticleId];
      await setGroupArticles(groupId, updated);
    }
    setGroupPickerVisible(false);
    setPendingArticleId(null);
  };

  const handleNewGroupSave = async () => {
    if (!newGroupName.trim() || !pendingArticleId) return;
    const grp = await createGroup(newGroupName.trim());
    await setGroupArticles(grp.id, [pendingArticleId]);
    setNewGroupInputVisible(false);
    setNewGroupName('');
    setGroupPickerVisible(false);
    setPendingArticleId(null);
  };

  const handleUndoSave = async () => {
    if (!pendingArticleId) return;
    await toggleSavedArticle(pendingArticleId); // unsave
    setGroupPickerVisible(false);
    setPendingArticleId(null);
  };

  // Long press on article card — add directly to group (save first if needed)
  const handleLongPressArticle = async (articleId: string) => {
    const alreadySaved = savedIds.has(articleId);
    if (!alreadySaved) {
      await toggleSavedArticle(articleId);
    }
    setPendingArticleId(articleId);
    setGroupPickerVisible(true);
  };

  // Lightning bolt — generate session plan (uses in-app modal via router)
  const handleGenerate = (article: Article) => {
    Alert.alert(
      '⚡ Generate session plan',
      `Create an evidence-based plan from:\n"${article.shortTitle}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => {
            if (!isPremium()) { router.push('/paywall'); return; }
            router.push({ pathname: '/session/builder', params: { articleId: article.id } });
          },
        },
      ],
    );
  };

  const resultsLabel = () => {
    const count = `${feed.length} ${feed.length === 1 ? 'article' : 'articles'}`;
    const sortLabel = sortBy === 'evidence' ? 'best evidence' : 'newest first';
    if (searchQuery.trim()) return `${count} · "${searchQuery.trim()}"`;
    if (selectedArea !== 'All') return `${count} · ${selectedArea}\n${sortLabel}`;
    return `${count} · ${sortLabel}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
            <View style={styles.headerRight}>
              <Pressable
                style={styles.patientSearchBtn}
                onPress={() => {
                  if (!isPremium()) { router.push('/paywall'); return; }
                  router.push('/patient-search');
                }}
              >
                <Text style={styles.patientSearchBtnText}>🔍 My patient</Text>
              </Pressable>
              <Pressable style={styles.searchBtn} onPress={openSearch}>
                <SearchIcon color={colors.primaryDark} size={18} />
              </Pressable>
            </View>
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

      {/* Evidence filter chips — hide when searching */}
      {!searchActive && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={[styles.filterContent, { paddingTop: 0, paddingBottom: 6 }]}
          alwaysBounceHorizontal={false}
          keyboardShouldPersistTaps="handled"
        >
          {([
            { label: 'All levels', value: null },
            { label: 'Level 1a', value: '1a' },
            { label: 'Level 1b', value: '1b' },
            { label: 'Level 2', value: '2' },
            { label: 'Level 3', value: '3' },
          ] as { label: string; value: string | null }[]).map((opt) => {
            const isActive = opt.value === null
              ? evidenceFilters.size === 0
              : evidenceFilters.has(opt.value);
            return (
            <Pressable
              key={opt.value ?? 'all-ev'}
              style={[styles.chip, styles.evChip, isActive && styles.evChipActive]}
              onPress={() => toggleEvidenceFilter(opt.value)}
            >
              <Text
                numberOfLines={1}
                style={[styles.chipText, isActive && styles.evChipTextActive]}
              >
                {opt.label}
              </Text>
            </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Results count + sort toggle + refresh indicator */}
      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>{resultsLabel()}</Text>
        <View style={styles.resultsRight}>
          {isLoading && (
            <View style={styles.refreshPill}>
              <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.7 }] }} />
              <Text style={styles.refreshText}>Updating…</Text>
            </View>
          )}
          <Pressable
            style={[styles.sortToggle, sortBy === 'evidence' && styles.sortToggleActive]}
            onPress={() => setSortBy(sortBy === 'newest' ? 'evidence' : 'newest')}
          >
            <Text style={[styles.sortToggleText, sortBy === 'evidence' && styles.sortToggleTextActive]}>
              {sortBy === 'newest' ? '🕐 Newest' : '⭐ Evidence'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Network error banner */}
      {fetchError && !errorDismissed && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Couldn't refresh articles — showing saved content</Text>
          <Pressable onPress={() => setErrorDismissed(true)} hitSlop={8}>
            <Text style={styles.errorDismiss}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Feed */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
              isSaved={savedIds.has(article.id)}
              onToggleSave={() => handleSaveWithGroupPrompt(article.id)}
              onGeneratePress={() => handleGenerate(article)}
              onLongPress={() => handleLongPressArticle(article.id)}
              hasNote={notedIds.has(article.id)}
            />
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Group picker / new group — single modal, two views ── */}
      <Modal
        visible={groupPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={dismissModal}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={gpStyles.overlay}>
          <Pressable style={gpStyles.backdrop} onPress={dismissModal} />

          {/* ── View A: group list ── */}
          {!newGroupInputVisible && (
            <Animated.View
              style={[gpStyles.sheet, { transform: [{ translateY: sheetPanY }] }]}
            >
              {/* Drag handle — swipe down to dismiss */}
              <View {...sheetPanResponder.panHandlers}>
                <View style={gpStyles.handle} />
              </View>
              <Text style={gpStyles.title}>🔖 Saved!</Text>
              <Text style={gpStyles.subtitle}>Add to a group?</Text>

              {groups.length > 0 && (
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  {groups.map((g) => (
                    <Pressable key={g.id} style={gpStyles.groupRow} onPress={() => handleGroupSelected(g.id)}>
                      <Text style={gpStyles.groupName}>{g.name}</Text>
                      <Text style={gpStyles.groupCount}>{g.articleIds.length} articles</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <Pressable style={gpStyles.newGroupRow} onPress={() => { setNewGroupName(''); setNewGroupInputVisible(true); }}>
                <Text style={gpStyles.newGroupText}>+ New group</Text>
              </Pressable>

              <View style={gpStyles.bottomRow}>
                <Pressable style={gpStyles.skipBtn} onPress={() => { setGroupPickerVisible(false); setPendingArticleId(null); }}>
                  <Text style={gpStyles.skipText}>No group</Text>
                </Pressable>
                <Pressable style={gpStyles.undoBtn} onPress={handleUndoSave}>
                  <Text style={gpStyles.undoText}>Undo save</Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* ── View B: new group name input ── */}
          {newGroupInputVisible && (
            <View style={gpStyles.sheet}>
              <View style={gpStyles.handle} />
              <Text style={gpStyles.title}>New group</Text>
              <TextInput
                style={gpStyles.input}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder="e.g. Aphasia, Fluency, Favourites…"
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleNewGroupSave}
              />
              <View style={gpStyles.inputActions}>
                <Pressable style={gpStyles.cancelBtn} onPress={() => setNewGroupInputVisible(false)}>
                  <Text style={gpStyles.cancelBtnText}>Back</Text>
                </Pressable>
                <Pressable style={gpStyles.createBtn} onPress={handleNewGroupSave}>
                  <Text style={gpStyles.createBtnText}>Create</Text>
                </Pressable>
              </View>
            </View>
          )}

        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

// ─── Group picker styles ───────────────────────────────────────────────────────
const gpStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderTopWidth: 1.5,
    borderColor: colors.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  title: { ...text.h3, color: colors.text, marginBottom: 2 },
  subtitle: { ...text.bodySmall, color: colors.textMuted, marginBottom: 16, fontFamily: 'Quicksand_600SemiBold' },
  groupRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  groupName: { ...text.bodySmall, color: colors.primaryDeep, fontFamily: 'Quicksand_700Bold' },
  groupCount: { ...text.caption, color: colors.textMuted },
  newGroupRow: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  newGroupText: { ...text.bodySmall, color: colors.primary, fontFamily: 'Quicksand_700Bold' },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  skipBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  skipText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
  undoBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FCA5A5', alignItems: 'center',
  },
  undoText: { ...text.bodySmall, color: '#DC2626', fontFamily: 'Quicksand_700Bold' },
  input: {
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    ...text.body, color: colors.text,
    backgroundColor: colors.surface, marginBottom: 16, marginTop: 8,
  },
  inputActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  cancelBtnText: { ...text.bodySmall, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },
  createBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.primaryDark, alignItems: 'center',
  },
  createBtnText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' },
});

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  patientSearchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  patientSearchBtnText: {
    ...text.caption,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_700Bold',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsText: { ...text.label, color: colors.textMuted, flex: 1, flexShrink: 1, flexWrap: 'wrap' },
  refreshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  refreshText: {
    ...text.caption,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_600SemiBold',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: {
    ...text.caption,
    color: '#92400E',
    flex: 1,
    fontFamily: 'Quicksand_600SemiBold',
  },
  errorDismiss: {
    ...text.caption,
    color: '#92400E',
    paddingLeft: 8,
  },
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
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
    flexShrink: 0,
  },
  cardBoltBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF9C4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F9C700',
  },
  cardBoltIcon: {
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  cardSaveBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primaryLighter,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  cardSaveBtnActive: {
    backgroundColor: colors.primary,
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

  // ── Evidence filter chips ──
  evChip: {
    borderColor: colors.primaryLighter,
  },
  evChipActive: {
    backgroundColor: colors.primaryDeep,
    borderColor: colors.primaryDeep,
  },
  evChipTextActive: { color: colors.surface },

  // ── Sort toggle ──
  resultsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  sortToggleActive: {
    backgroundColor: colors.primaryLighter,
    borderColor: colors.primary,
  },
  sortToggleText: {
    ...text.caption,
    color: colors.textMuted,
    fontFamily: 'Quicksand_600SemiBold',
  },
  sortToggleTextActive: {
    color: colors.primaryDeep,
  },
});

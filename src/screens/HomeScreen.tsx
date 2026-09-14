import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  Modal,
  Image,
  Animated,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
// Logo image (the new branded PNG)
import {
  FluencyIcon,
  VoiceResonanceIcon,
  LanguageIcon,
  SwallowingIcon,
  CogCommIcon,
  AacIcon,
  MotorSpeechIcon,
  GeneralPracticeIcon,
} from '@/components/icons/AreaIcons';
import { BellIcon, SearchIcon } from '@/components/icons/NavIcons';
import { AreaCard } from '@/components/AreaCard';
import { ResumeCard } from '@/components/ResumeCard';
import { FoundationsCard } from '@/components/FoundationsCard';
import { type AshaArea, getArticleById, type Article, EVIDENCE_LABELS, EVIDENCE_COLORS } from '@/data/articles';
import { useArticles } from '@/context/ArticlesContext';
import { setBrowseArea, setBrowseQuery } from '@/store/browseStore';
import { loadLastReadEntry } from '@/store/lastReadStore';
import { loadRecentlyViewed, subscribeRecentlyViewed } from '@/store/recentlyViewedStore';
import { NEW_ARTICLES_SEEN_KEY, getPendingNewArticleIds } from '@/data/newArticles';
import { getArticleOfWeek } from '@/services/articleOfWeekService';
import { getDraft, type SessionDraft } from '@/services/sessionDraftStorage';
import { hapticMedium } from '@/utils/haptics';

const KEY_PROFILE    = 'ebp_slp_profile_v1';
const KEY_DAYS       = 'ebp_slp_days_active_v1';
const KEY_NOTES      = 'ebp_article_notes_v1';

// ─── Days-active streak ───────────────────────────────────────────────────────

async function trackAndGetStreak(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const raw   = await AsyncStorage.getItem(KEY_DAYS);
  if (!raw) {
    await AsyncStorage.setItem(KEY_DAYS, JSON.stringify({ streak: 1, last: today }));
    return 1;
  }
  try {
    const { streak, last } = JSON.parse(raw) as { streak: number; last: string };
    if (last === today) return streak;
    const prev = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const next = last === prev ? streak + 1 : 1;
    await AsyncStorage.setItem(KEY_DAYS, JSON.stringify({ streak: next, last: today }));
    return next;
  } catch {
    // Corrupted data — reset the streak rather than let this throw and
    // break the rest of Home screen's load().
    await AsyncStorage.setItem(KEY_DAYS, JSON.stringify({ streak: 1, last: today }));
    return 1;
  }
}

// ─── Article of the week ──────────────────────────────────────────────────────
// Picked by the shared getArticleOfWeek() in articleOfWeekService, so the
// Home screen card always matches whatever the weekly notification announced.

// Article counts are computed inside the component using live articles

// Rotating motivational nudges
const NUDGES = [
  'Evidence makes the difference.',
  'Your patients are lucky to have you.',
  'Great clinicians never stop learning.',
  'Research-backed. Patient-centered.',
  'Small consistent gains compound.',
  'You showed up. That already matters.',
  'EBP isn\'t a box to check — it\'s a habit.',
  'Every session is a chance to improve.',
  'The best SLPs stay curious.',
  'Trust the process. Trust the evidence.',
];
const todayNudge = NUDGES[new Date().getDate() % NUDGES.length];

// ─── Swipeable article row ────────────────────────────────────────────────────

const SWIPE_THRESHOLD = -44;

const SwipeableArticleRow: React.FC<{
  article: Article;
  onPress: () => void;
  onDismiss: () => void;
}> = ({ article, onPress, onDismiss }) => {
  const evColor = EVIDENCE_COLORS[article.evidenceLevel];
  const translateX = useRef(new Animated.Value(0)).current;

  // Always-current ref so the stale-closure bug can't affect the PanResponder
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const snapBack = () =>
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 130,
      friction: 12,
    }).start();

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx < -5 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < SWIPE_THRESHOLD) {
          hapticMedium();
          // Slide row off to the left, then call dismiss so the row unmounts cleanly
          Animated.timing(translateX, {
            toValue: -500,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            onDismissRef.current();
          });
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: () => snapBack(),
    })
  ).current;

  const actionOpacity = translateX.interpolate({
    inputRange: [-120, -20, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Green reveal — only visible once swiping starts */}
      <Animated.View style={[styles.swipeActionBg, { opacity: actionOpacity }]}>
        <Text style={styles.swipeActionIcon}>✓</Text>
        <Text style={styles.swipeActionLabel}>Done</Text>
      </Animated.View>

      <Animated.View
        style={[styles.articleRow, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable style={styles.articleRowInner} onPress={onPress}>
          <View style={styles.unreadArticleDot} />
          <View style={[styles.evBadge, { backgroundColor: evColor.bg }]}>
            <Text style={[styles.evBadgeText, { color: evColor.text }]}>
              {EVIDENCE_LABELS[article.evidenceLevel]}
            </Text>
          </View>
          <View style={styles.articleRowBody}>
            <Text style={styles.articleRowTitle} numberOfLines={2}>
              {article.shortTitle}
            </Text>
            <Text style={styles.articleRowMeta}>
              {article.authorShort} · {article.year} · {article.areas[0]}
            </Text>
          </View>
          <Text style={styles.articleRowArrow}>›</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

// ─── New Articles Panel ───────────────────────────────────────────────────────

const NewArticlesPanel: React.FC<{
  visible: boolean;
  onClose: () => void;
  onPressArticle: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  seenIds: Set<string>;
  newArticleIds: string[];
}> = ({ visible, onClose, onPressArticle, onDismiss, onClearAll, seenIds, newArticleIds }) => {
  const { articles } = useArticles();
  // Only show articles that haven't been dismissed yet
  const visibleArticles = newArticleIds
    .map((id) => articles.find((a) => a.id === id))
    .filter((a): a is Article => !!a && !seenIds.has(a.id));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.panel}>
        <View style={styles.panelHandle} />
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Recently added</Text>
          <View style={styles.panelHeaderRight}>
            {visibleArticles.length > 0 && (
              <Pressable onPress={onClearAll} hitSlop={8}>
                <Text style={styles.panelClearAll}>Clear all</Text>
              </Pressable>
            )}
            {visibleArticles.length > 0 && (
              <Text style={styles.panelCount}>{visibleArticles.length} new</Text>
            )}
          </View>
        </View>

        {visibleArticles.length === 0 ? (
          <View style={styles.panelEmpty}>
            <Text style={styles.panelEmptyIcon}>✓</Text>
            <Text style={styles.panelEmptyText}>All caught up!</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
            {visibleArticles.map((article) => (
              <SwipeableArticleRow
                key={article.id}
                article={article}
                onPress={() => { onClose(); onPressArticle(article.id); }}
                onDismiss={() => onDismiss(article.id)}
              />
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

// ─── Home Screen ──────────────────────────────────────────────────────────────

export const HomeScreen = () => {
  const router = useRouter();
  const { articles } = useArticles();
  const areaCount = (area: AshaArea) => articles.filter((a) => a.areas.includes(area)).length;
  const [lastArticle, setLastArticle]       = useState<Article | null>(null);
  const [lastOpenedAt, setLastOpenedAt]     = useState<number | undefined>(undefined);
  const [recentIds, setRecentIds]           = useState<string[]>([]);
  const [panelVisible, setPanelVisible]     = useState(false);
  const [hasUnseen, setHasUnseen]           = useState(false);
  const [seenIds, setSeenIds]               = useState<Set<string>>(new Set());
  const [newArticleIds, setNewArticleIds]   = useState<string[]>([]);
  const [profileName, setProfileName]       = useState('');
  const [searchText, setSearchText]         = useState('');
  const [daysActive, setDaysActive]         = useState(0);
  const [weekArticle, setWeekArticle]       = useState<Article | null>(null);
  const [notedArticles, setNotedArticles]   = useState<{ article: Article; note: string }[]>([]);
  const [draftSession, setDraftSession]     = useState<SessionDraft | null>(null);

  const load = useCallback(async () => {
    const [lastEntry, seenRaw, profileRaw, recentlyViewedIds, notesRaw, streak, pendingNewIds, draft] = await Promise.all([
      loadLastReadEntry(),
      AsyncStorage.getItem(NEW_ARTICLES_SEEN_KEY),
      AsyncStorage.getItem(KEY_PROFILE),
      loadRecentlyViewed(),
      AsyncStorage.getItem(KEY_NOTES),
      trackAndGetStreak(),
      getPendingNewArticleIds(),
      getDraft(),
    ]);
    setLastArticle(lastEntry ? (getArticleById(lastEntry.id) ?? null) : null);
    setLastOpenedAt(lastEntry?.ts);
    setRecentIds(recentlyViewedIds);
    setDaysActive(streak);
    setNewArticleIds(pendingNewIds);
    setDraftSession(draft && draft.trials.length > 0 ? draft : null);

    try {
      const seen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
      const seenSet = new Set(seen);
      setSeenIds(seenSet);
      setHasUnseen(pendingNewIds.some((id) => !seenSet.has(id)));
    } catch {
      setSeenIds(new Set());
      setHasUnseen(pendingNewIds.length > 0);
    }

    try {
      if (profileRaw) {
        const p = JSON.parse(profileRaw);
        setProfileName(p.name ?? '');
      }
    } catch {}

    try {
      if (notesRaw) {
        const notes = JSON.parse(notesRaw) as Record<string, string>;
        const noted = Object.entries(notes)
          .filter(([, n]) => n.trim())
          .map(([id, n]) => ({ article: getArticleById(id), note: n }))
          .filter((x): x is { article: Article; note: string } => !!x.article);
        setNotedArticles(noted);
      } else {
        setNotedArticles([]);
      }
    } catch {
      setNotedArticles([]);
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeRecentlyViewed((ids) => setRecentIds(ids));
    return unsub;
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Recompute article of the week whenever articles load
  useEffect(() => {
    if (articles.length > 0) setWeekArticle(getArticleOfWeek(articles));
  }, [articles]);

  const openPanel = () => {
    setPanelVisible(true);
  };

  const persistSeen = async (next: Set<string>) => {
    setSeenIds(next);
    await AsyncStorage.setItem(NEW_ARTICLES_SEEN_KEY, JSON.stringify([...next]));
    setHasUnseen(newArticleIds.some((nid) => !next.has(nid)));
  };

  const markArticleSeen = async (id: string) => {
    const next = new Set(seenIds);
    next.add(id);
    await persistSeen(next);
    router.push({ pathname: '/article/[id]', params: { id } });
  };

  const markArticleRead = async (id: string) => {
    const next = new Set(seenIds);
    next.add(id);
    await persistSeen(next);
  };

  const markAllRead = async () => {
    await persistSeen(new Set(newArticleIds));
  };

  const goToBrowse = (area?: AshaArea) => {
    setBrowseArea(area ?? 'All');
    router.push('/(tabs)/browse');
  };

  const handleSearch = () => {
    if (!searchText.trim()) return;
    setBrowseArea('All');
    setBrowseQuery(searchText.trim());
    setSearchText('');
    router.push('/(tabs)/browse');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* App bar */}
      <View style={styles.appBar}>
        <View style={styles.brandInline}>
          <Image
            source={require('../../assets/ebp-slp-logo.png')}
            style={styles.logoImg}
          />
          <View>
            <Text style={styles.greetTitle}>Hi{profileName ? `, ${profileName.split(' ')[0]}` : ''}</Text>
            <Text style={styles.greetSub}>{todayNudge}</Text>
          </View>
        </View>

        <View style={styles.appBarRight}>
          {daysActive > 0 && (
            <View style={styles.streakChip}>
              <Text style={styles.streakText}>🔥 {daysActive}</Text>
            </View>
          )}
          {/* Bell with unseen dot */}
          <Pressable style={styles.iconBtn} onPress={openPanel}>
            <BellIcon color={colors.primaryDark} size={18} />
            {hasUnseen && <View style={styles.unreadDot} />}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <Pressable style={styles.searchBar} onPress={() => searchText.trim() && handleSearch()}>
          <SearchIcon color={colors.textMuted} size={18} />
          <TextInput
            placeholder="Search treatments, conditions, authors…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
          />
        </Pressable>

        {/* Unsaved data-collection session */}
        {draftSession && (
          <Pressable
            style={styles.draftBanner}
            onPress={() => router.push({
              pathname: '/session/data',
              params: {
                planJson: draftSession.planJson,
                articleId: draftSession.articleId,
                savedPlanId: draftSession.savedPlanId,
                patientLabel: draftSession.patientLabel,
              },
            })}
          >
            <Text style={styles.draftBannerIcon}>💾</Text>
            <View style={styles.draftBannerBody}>
              <Text style={styles.draftBannerTitle}>Unsaved session — tap to resume</Text>
              <Text style={styles.draftBannerSub}>
                {draftSession.trials.length} trial{draftSession.trials.length !== 1 ? 's' : ''} for "{draftSession.patientLabel}" wasn't saved
              </Text>
            </View>
            <Text style={styles.draftBannerArrow}>›</Text>
          </Pressable>
        )}

        {/* Article of the week */}
        {weekArticle && (() => {
          const evColor = EVIDENCE_COLORS[weekArticle.evidenceLevel];
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/article/[id]', params: { id: weekArticle.id } })}
              style={styles.weekCard}
            >
              <LinearGradient
                colors={[colors.primaryLighter, '#ede9fe']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.weekGradient}
              >
                <Text style={styles.weekLabel}>⭐  ARTICLE OF THE WEEK</Text>
                <View style={[styles.weekEvBadge, { backgroundColor: evColor.bg }]}>
                  <Text style={[styles.weekEvText, { color: evColor.text }]}>
                    {EVIDENCE_LABELS[weekArticle.evidenceLevel]}
                  </Text>
                </View>
                <Text style={styles.weekTitle} numberOfLines={2}>{weekArticle.shortTitle}</Text>
                <Text style={styles.weekMeta}>
                  {weekArticle.authorShort} · {weekArticle.year} · {weekArticle.areas[0]}
                </Text>
                <View style={styles.weekReadBtn}>
                  <Text style={styles.weekReadText}>Read article →</Text>
                </View>
              </LinearGradient>
            </Pressable>
          );
        })()}

        {/* Continue reading */}
        {lastArticle && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>Continue reading</Text>
            </View>
            <ResumeCard
              label="Last opened"
              title={lastArticle.shortTitle}
              authors={`${lastArticle.authorShort} · ${lastArticle.year}`}
              lastOpenedAt={lastOpenedAt}
              onPress={() => router.push({ pathname: '/article/[id]', params: { id: lastArticle.id } })}
            />
          </>
        )}

        {/* Recently viewed */}
        {recentIds.length > 1 && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>Recently viewed</Text>
              <Pressable onPress={() => goToBrowse()}>
                <Text style={styles.sectionLink}>Browse all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroll}
            >
              {recentIds.map((id) => {
                const a = getArticleById(id);
                if (!a) return null;
                const evColor = EVIDENCE_COLORS[a.evidenceLevel];
                return (
                  <Pressable
                    key={id}
                    style={styles.recentCard}
                    onPress={() => router.push({ pathname: '/article/[id]', params: { id } })}
                  >
                    <View style={[styles.recentBadge, { backgroundColor: evColor.bg }]}>
                      <Text style={[styles.recentBadgeText, { color: evColor.text }]}>
                        {EVIDENCE_LABELS[a.evidenceLevel]}
                      </Text>
                    </View>
                    <Text style={styles.recentTitle} numberOfLines={2}>{a.shortTitle}</Text>
                    <Text style={styles.recentMeta}>{a.authorShort} · {a.year}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* Browse by area */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>Browse by area</Text>
          <Pressable onPress={() => goToBrowse()}>
            <Text style={styles.sectionLink}>See all</Text>
          </Pressable>
        </View>
        <View style={styles.areaGrid}>
          <View style={styles.areaRow}>
            <AreaCard
              title="Fluency"
              subtitle={`${areaCount('Fluency')} articles`}
              iconBg={colors.pastelPink}
              iconColor={colors.pastelPinkDeep}
              Icon={FluencyIcon}
              onPress={() => goToBrowse('Fluency')}
            />
            <View style={{ width: 10 }} />
            <AreaCard
              title="Voice & Resonance"
              subtitle={`${areaCount('Voice & Resonance')} articles`}
              iconBg={colors.pastelPeach}
              iconColor={colors.pastelPeachDeep}
              Icon={VoiceResonanceIcon}
              onPress={() => goToBrowse('Voice & Resonance')}
            />
          </View>
          <View style={styles.areaRow}>
            <AreaCard
              title="Language"
              subtitle={`${areaCount('Language')} articles`}
              iconBg={colors.pastelLavender}
              iconColor={colors.pastelLavenderDeep}
              Icon={LanguageIcon}
              onPress={() => goToBrowse('Language')}
            />
            <View style={{ width: 10 }} />
            <AreaCard
              title="Swallowing"
              subtitle={`${areaCount('Swallowing')} articles`}
              iconBg={colors.pastelBlue}
              iconColor={colors.pastelBlueDeep}
              Icon={SwallowingIcon}
              onPress={() => goToBrowse('Swallowing')}
            />
          </View>
          <View style={styles.areaRow}>
            <AreaCard
              title="Cognitive-Comm"
              subtitle={`${areaCount('Cognitive-Communication')} articles`}
              iconBg={colors.pastelYellow}
              iconColor={colors.pastelYellowDeep}
              Icon={CogCommIcon}
              onPress={() => goToBrowse('Cognitive-Communication')}
            />
            <View style={{ width: 10 }} />
            <AreaCard
              title="AAC"
              subtitle={`${areaCount('AAC')} articles`}
              iconBg={colors.pastelMint}
              iconColor={colors.pastelMintDeep}
              Icon={AacIcon}
              onPress={() => goToBrowse('AAC')}
            />
          </View>
          <View style={styles.areaRow}>
            <AreaCard
              title="Motor Speech"
              subtitle={`${areaCount('Motor Speech')} articles`}
              iconBg={colors.pastelTeal}
              iconColor={colors.pastelTealDeep}
              Icon={MotorSpeechIcon}
              onPress={() => goToBrowse('Motor Speech')}
            />
            <View style={{ width: 10 }} />
            <AreaCard
              title="General Practice"
              subtitle={`${areaCount('General Practice')} articles`}
              iconBg={colors.pastelIndigo}
              iconColor={colors.pastelIndigoDeep}
              Icon={GeneralPracticeIcon}
              onPress={() => goToBrowse('General Practice')}
            />
          </View>
        </View>

        {/* My notes summary */}
        {notedArticles.length > 0 && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>My notes</Text>
              <Text style={styles.sectionLink}>{notedArticles.length} annotated</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroll}
            >
              {notedArticles.map(({ article: a, note }) => (
                <Pressable
                  key={a.id}
                  style={styles.noteCard}
                  onPress={() => router.push({ pathname: '/article/[id]', params: { id: a.id } })}
                >
                  <Text style={styles.noteCardEmoji}>📝</Text>
                  <Text style={styles.noteCardTitle} numberOfLines={2}>{a.shortTitle}</Text>
                  <Text style={styles.noteCardPreview} numberOfLines={3}>{note}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Foundations */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>Foundations of practice</Text>
        </View>
        <FoundationsCard onPressArticle={(id) => router.push({ pathname: '/article/[id]', params: { id } })} />

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* New articles panel */}
      <NewArticlesPanel
        visible={panelVisible}
        onClose={() => setPanelVisible(false)}
        onPressArticle={markArticleSeen}
        onDismiss={markArticleRead}
        onClearAll={markAllRead}
        seenIds={seenIds}
        newArticleIds={newArticleIds}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandInline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakChip: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 13,
    color: '#C2410C',
  },
  logoImg: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },

  // ── Unsaved session banner ──
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  draftBannerIcon: { fontSize: 20 },
  draftBannerBody: { flex: 1 },
  draftBannerTitle: {
    ...text.bodySmall,
    color: '#92400E',
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 2,
  },
  draftBannerSub: {
    ...text.caption,
    color: '#92400E',
    opacity: 0.85,
  },
  draftBannerArrow: { ...text.h3, color: '#92400E', opacity: 0.6 },

  // ── Article of the week ──
  weekCard: {
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
  },
  weekGradient: {
    padding: 16,
  },
  weekLabel: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.primaryDeep,
    marginBottom: 10,
  },
  weekEvBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  weekEvText: { fontFamily: 'Quicksand_700Bold', fontSize: 10, letterSpacing: 0.3 },
  weekTitle: {
    ...text.h3,
    color: colors.primaryDeep,
    lineHeight: 22,
    marginBottom: 5,
  },
  weekMeta: {
    ...text.caption,
    color: colors.primaryDeep,
    opacity: 0.75,
    marginBottom: 14,
  },
  weekReadBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  weekReadText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 13,
    color: colors.surface,
  },

  // ── My notes cards ──
  noteCard: {
    width: 170,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
  },
  noteCardEmoji: { fontSize: 18, marginBottom: 6 },
  noteCardTitle: {
    ...text.bodySmall,
    color: colors.text,
    fontFamily: 'Quicksand_700Bold',
    lineHeight: 17,
    marginBottom: 5,
  },
  noteCardPreview: {
    ...text.caption,
    color: '#92400E',
    lineHeight: 15,
    fontStyle: 'italic',
  },
  greetTitle: { ...text.h2, color: colors.text },
  greetSub: { ...text.bodySmall, color: colors.textMuted, fontSize: 13 },
  iconBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  searchBar: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Quicksand_500Medium',
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionLabelText: { ...text.label, color: colors.textMuted },
  sectionLink: {
    ...text.caption,
    color: colors.primaryDark,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
  },
  areaGrid: { gap: 10 },
  areaRow: { flexDirection: 'row' },

  // ── Recently viewed ──
  recentScroll: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  recentCard: {
    width: 160,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
  },
  recentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  recentBadgeText: {
    fontSize: 10,
    fontFamily: 'Quicksand_700Bold',
    letterSpacing: 0.2,
  },
  recentTitle: {
    ...text.bodySmall,
    color: colors.text,
    fontFamily: 'Quicksand_600SemiBold',
    lineHeight: 17,
    marginBottom: 5,
  },
  recentMeta: {
    ...text.caption,
    color: colors.textMuted,
  },

  // ── Modal / Panel ──
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  panelHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  panelTitle: { ...text.h2, color: colors.text },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelClearAll: {
    ...text.caption,
    color: colors.primary,
    fontFamily: 'Quicksand_700Bold',
  },
  panelCount: {
    ...text.caption,
    color: colors.surface,
    fontFamily: 'Quicksand_600SemiBold',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  panelScroll: { flex: 1 },
  panelEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
    gap: 8,
  },
  panelEmptyIcon: {
    fontSize: 36,
    color: '#16A34A',
  },
  panelEmptyText: {
    ...text.body,
    color: colors.textMuted,
    fontFamily: 'Quicksand_600SemiBold',
  },

  // ── Article row ──
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  evBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  evBadgeText: { ...text.badge, fontSize: 10 },
  articleRowBody: { flex: 1 },
  articleRowTitle: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_600SemiBold', lineHeight: 18 },
  articleRowMeta: { ...text.caption, color: colors.textMuted, marginTop: 2 },
  articleRowArrow: { ...text.h3, color: colors.textMuted, opacity: 0.5 },
  articleRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  articleRowUnread: { backgroundColor: colors.primaryLighter + '55' },
  unreadArticleDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },

  // ── Swipe-to-clear ──
  swipeActionBg: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  swipeActionIcon: { fontSize: 18, color: 'white' },
  swipeActionLabel: {
    fontSize: 10,
    color: 'white',
    fontFamily: 'Quicksand_700Bold',
    letterSpacing: 0.3,
  },
});

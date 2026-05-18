import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { Logo } from '@/components/icons/Logo';
import {
  FluencyIcon,
  VoiceResonanceIcon,
  LanguageIcon,
  SwallowingIcon,
  CogCommIcon,
  AacIcon,
  MotorSpeechIcon,
} from '@/components/icons/AreaIcons';
import { BellIcon, SearchIcon } from '@/components/icons/NavIcons';
import { AreaCard } from '@/components/AreaCard';
import { ResumeCard } from '@/components/ResumeCard';
import { FoundationsCard } from '@/components/FoundationsCard';
import { type AshaArea, getArticleById, type Article, EVIDENCE_LABELS, EVIDENCE_COLORS } from '@/data/articles';
import { useArticles } from '@/context/ArticlesContext';
import { setBrowseArea, setBrowseQuery } from '@/store/browseStore';
import { loadLastReadEntry } from '@/store/lastReadStore';
import { NEW_ARTICLE_IDS, NEW_ARTICLES_SEEN_KEY } from '@/data/newArticles';

const KEY_PROFILE = 'ebp_slp_profile_v1';

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

// ─── New Articles Panel ───────────────────────────────────────────────────────

const NewArticlesPanel: React.FC<{
  visible: boolean;
  onClose: () => void;
  onPressArticle: (id: string) => void;
}> = ({ visible, onClose, onPressArticle }) => {
  const { articles } = useArticles();
  const newArticles = NEW_ARTICLE_IDS
    .map((id) => articles.find((a) => a.id === id))
    .filter(Boolean) as Article[];

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
          <Text style={styles.panelCount}>{newArticles.length} new articles</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.panelScroll}>
          {newArticles.map((article) => {
            const evColor = EVIDENCE_COLORS[article.evidenceLevel];
            return (
              <Pressable
                key={article.id}
                style={styles.articleRow}
                onPress={() => { onClose(); onPressArticle(article.id); }}
              >
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
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
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
  const [panelVisible, setPanelVisible]     = useState(false);
  const [hasUnseen, setHasUnseen]           = useState(false);
  const [profileName, setProfileName]       = useState('');
  const [searchText, setSearchText]         = useState('');

  const load = useCallback(async () => {
    const [lastEntry, seenRaw, profileRaw] = await Promise.all([
      loadLastReadEntry(),
      AsyncStorage.getItem(NEW_ARTICLES_SEEN_KEY),
      AsyncStorage.getItem(KEY_PROFILE),
    ]);
    setLastArticle(lastEntry ? (getArticleById(lastEntry.id) ?? null) : null);
    setLastOpenedAt(lastEntry?.ts);

    const seen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
    setHasUnseen(NEW_ARTICLE_IDS.some((id) => !seen.includes(id)));

    if (profileRaw) {
      const p = JSON.parse(profileRaw);
      setProfileName(p.name ?? '');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openPanel = async () => {
    // Mark all new articles as seen
    await AsyncStorage.setItem(NEW_ARTICLES_SEEN_KEY, JSON.stringify(NEW_ARTICLE_IDS));
    setHasUnseen(false);
    setPanelVisible(true);
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
          <Logo size={36} />
          <View>
            <Text style={styles.greetTitle}>Hi{profileName ? `, ${profileName.split(' ')[0]}` : ''}</Text>
            <Text style={styles.greetSub}>{todayNudge}</Text>
          </View>
        </View>

        {/* Bell with unseen dot */}
        <Pressable style={styles.iconBtn} onPress={openPanel}>
          <BellIcon color={colors.primaryDark} size={18} />
          {hasUnseen && <View style={styles.unreadDot} />}
        </Pressable>
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
            <View style={{ flex: 1 }} />
            <View style={{ flex: 2 }}>
              <AreaCard
                title="Motor Speech"
                subtitle={`${areaCount('Motor Speech')} articles`}
                iconBg={colors.pastelTeal}
                iconColor={colors.pastelTealDeep}
                Icon={MotorSpeechIcon}
                onPress={() => goToBrowse('Motor Speech')}
              />
            </View>
            <View style={{ flex: 1 }} />
          </View>
        </View>

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
        onPressArticle={(id) => router.push({ pathname: '/article/[id]', params: { id } })}
      />
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  appBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandInline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
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
});

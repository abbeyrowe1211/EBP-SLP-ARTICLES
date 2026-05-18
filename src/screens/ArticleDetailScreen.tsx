import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import {
  type Article,
  EVIDENCE_LABELS,
  EVIDENCE_COLORS,
} from '@/data/articles';
import { setLastRead } from '@/store/lastReadStore';
import { isArticleSaved, toggleSavedArticle } from '@/store/savedArticlesStore';
import { SavedIcon } from '@/components/icons/NavIcons';

// ─── Sub-components ───────────────────────────────────────────────────────────

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.panel}>
    <Text style={styles.panelTitle}>{title}</Text>
    {children}
  </View>
);

const Bullet: React.FC<{ text: string }> = ({ text: t }) => (
  <View style={styles.bulletRow}>
    <View style={styles.bulletDot} />
    <Text style={styles.bulletText}>{t}</Text>
  </View>
);

const StatBox: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <View style={styles.statBox}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

interface Props {
  article: Article;
}

export const ArticleDetailScreen: React.FC<Props> = ({ article }) => {
  const router = useRouter();
  const evColor = EVIDENCE_COLORS[article.evidenceLevel];
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLastRead(article.id);
    isArticleSaved(article.id).then(setSaved);
  }, [article.id]);

  const handleToggleSave = useCallback(async () => {
    const nowSaved = await toggleSavedArticle(article.id);
    setSaved(nowSaved);
  }, [article.id]);

  const stats = article.sessionStats;
  const statEntries = [
    stats.frequency && { value: stats.frequency, label: 'Frequency' },
    stats.sessionLength && { value: stats.sessionLength, label: 'Session' },
    stats.dose && { value: stats.dose, label: 'Dose' },
    stats.bestFit && { value: stats.bestFit, label: 'Best fit' },
  ].filter(Boolean) as { value: string; label: string }[];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Back bar */}
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Browse</Text>
        </Pressable>
        <Pressable style={[styles.saveBtn, saved && styles.saveBtnActive]} onPress={handleToggleSave}>
          <SavedIcon color={saved ? colors.surface : colors.primaryDeep} size={14} filled={saved} />
          <Text style={[styles.saveBtnText, saved && styles.saveBtnTextActive]}>{saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge row */}
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

        {/* Title */}
        <Text style={styles.title}>{article.title}</Text>

        {/* Authors */}
        <Text style={styles.authors}>{article.authors}</Text>

        {/* Journal / year / PMID */}
        <Text style={styles.journal}>
          {article.journal} · {article.year}
          {article.pmid ? ` · PMID: ${article.pmid}` : ''}
        </Text>

        {/* Area tags */}
        <View style={styles.tagRow}>
          {article.areas.map((area) => (
            <View key={area} style={styles.areaTag}>
              <Text style={styles.areaTagText}>{area}</Text>
            </View>
          ))}
        </View>

        {/* What the research found */}
        <Panel title="What the research found">
          {article.researchFindings.map((finding, i) => (
            <Bullet key={i} text={finding} />
          ))}
        </Panel>

        {/* How to apply it */}
        <Panel title="Clinical application">
          <Text style={styles.paragraphText}>{article.clinicalApplication}</Text>
        </Panel>

        {/* Session stats */}
        {statEntries.length > 0 && (
          <View style={styles.statsGrid}>
            {statEntries.map((s) => (
              <StatBox key={s.label} value={s.value} label={s.label} />
            ))}
          </View>
        )}

        {/* Best fit */}
        <Panel title="Best fit for patients with…">
          {article.bestFitCriteria.map((criterion, i) => (
            <Bullet key={i} text={criterion} />
          ))}
        </Panel>

        {/* CTA */}
        <Pressable
          style={styles.ctaBtn}
          onPress={() =>
            router.push({
              pathname: '/session/builder',
              params: { articleId: article.id },
            })
          }
        >
          <Text style={styles.ctaBtnText}>⚡  Generate session plan from this article</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backText: {
    ...text.body,
    color: colors.primary,
    fontFamily: 'Quicksand_600SemiBold',
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primaryLighter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  saveBtnActive: {
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    fontFamily: 'Quicksand_700Bold',
  },
  saveBtnTextActive: {
    color: colors.surface,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    ...text.badge,
  },
  title: {
    ...text.h2,
    color: colors.text,
    lineHeight: 30,
    marginBottom: 8,
  },
  authors: {
    ...text.body,
    color: colors.textMuted,
    marginBottom: 4,
    lineHeight: 20,
  },
  journal: {
    ...text.bodySmall,
    color: colors.textMuted,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  areaTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.primaryLighter,
  },
  areaTagText: {
    ...text.badge,
    color: colors.primaryDark,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  panelTitle: {
    ...text.h4,
    color: colors.primaryDeep,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
    flexShrink: 0,
  },
  bulletText: {
    ...text.bodySmall,
    color: colors.text,
    lineHeight: 18,
    flex: 1,
  },
  paragraphText: {
    ...text.bodySmall,
    color: colors.text,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    ...text.h4,
    color: colors.primaryDeep,
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    ...text.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  ctaBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaBtnText: {
    ...text.h4,
    color: colors.surface,
  },
});

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import {
  type Article,
  EVIDENCE_LABELS,
  EVIDENCE_COLORS,
} from '@/data/articles';
import { useArticles } from '@/context/ArticlesContext';
import { setLastRead } from '@/store/lastReadStore';
import { pushRecentlyViewed } from '@/store/recentlyViewedStore';
import { isArticleSaved, toggleSavedArticle } from '@/store/savedArticlesStore';
import { hapticLight } from '@/utils/haptics';
import { SavedIcon } from '@/components/icons/NavIcons';
import { isPremium } from '@/config/premium';
import { NEW_ARTICLES_SEEN_KEY } from '@/data/newArticles';

const NOTES_KEY = 'ebp_article_notes_v1';

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
  const { articles: allArticles } = useArticles();
  const evColor = EVIDENCE_COLORS[article.evidenceLevel];

  // Related: same area, strongest evidence first, top 3
  const evRank: Record<string, number> = { '1a': 0, '1b': 1, '2': 2, '3': 3 };
  const relatedArticles = allArticles
    .filter((a) => a.id !== article.id && a.areas.some((ar) => article.areas.includes(ar)))
    .sort((a, b) => {
      const aOverlap = a.areas.filter((ar) => article.areas.includes(ar)).length;
      const bOverlap = b.areas.filter((ar) => article.areas.includes(ar)).length;
      if (bOverlap !== aOverlap) return bOverlap - aOverlap;
      return (evRank[a.evidenceLevel] ?? 4) - (evRank[b.evidenceLevel] ?? 4);
    })
    .slice(0, 3);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const [printingArticle, setPrintingArticle] = useState(false);
  const saveNoteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const notesPanelYRef = useRef(0);

  useEffect(() => {
    setLastRead(article.id);
    pushRecentlyViewed(article.id);
    isArticleSaved(article.id).then(setSaved);
    // Load note for this article
    AsyncStorage.getItem(NOTES_KEY).then((raw) => {
      if (raw) {
        try {
          const notes = JSON.parse(raw) as Record<string, string>;
          setNote(notes[article.id] ?? '');
        } catch {}
      }
    });
    // Auto-mark as seen (harmless no-op if it wasn't "new") — clears the
    // home screen red dot for this article without needing to check
    // membership against the dynamic new-articles list first.
    AsyncStorage.getItem(NEW_ARTICLES_SEEN_KEY).then((raw) => {
      try {
        const seen: string[] = raw ? JSON.parse(raw) : [];
        if (!seen.includes(article.id)) {
          AsyncStorage.setItem(NEW_ARTICLES_SEEN_KEY, JSON.stringify([...seen, article.id]));
        }
      } catch {}
    });
  }, [article.id]);

  const handleNoteChange = (val: string) => {
    setNote(val);
    // Debounce save
    if (saveNoteTimeout.current) clearTimeout(saveNoteTimeout.current);
    saveNoteTimeout.current = setTimeout(async () => {
      try {
        const raw = await AsyncStorage.getItem(NOTES_KEY);
        const notes: Record<string, string> = raw ? JSON.parse(raw) : {};
        if (val.trim()) {
          notes[article.id] = val;
        } else {
          delete notes[article.id];
        }
        await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      } catch {}
    }, 500);
  };

  const handleToggleSave = useCallback(async () => {
    hapticLight();
    const nowSaved = await toggleSavedArticle(article.id);
    setSaved(nowSaved);
  }, [article.id]);

  const handlePrintArticle = async () => {
    setPrintingArticle(true);
    try {
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      const evColor = EVIDENCE_COLORS[article.evidenceLevel];
      const evLabel = EVIDENCE_LABELS[article.evidenceLevel];

      const findingsList = article.researchFindings
        .map((f) => `<li>${f}</li>`)
        .join('');
      const criteriaList = article.bestFitCriteria
        .map((c) => `<li>${c}</li>`)
        .join('');
      const areaTags = article.areas
        .map((a) => `<span class="area-tag">${a}</span>`)
        .join('');
      const pmidLine = article.pmid ? ` · PMID: ${article.pmid}` : '';

      const st = article.sessionStats;
      const statEntries = [
        st.frequency     && { value: st.frequency,     label: 'Frequency' },
        st.sessionLength && { value: st.sessionLength,  label: 'Session' },
        st.dose          && { value: st.dose,           label: 'Dose' },
        st.bestFit       && { value: st.bestFit,        label: 'Best fit' },
      ].filter(Boolean) as { value: string; label: string }[];
      const statsHtml = statEntries.length > 0 ? `
        <h2>Session Parameters</h2>
        <div class="stats-grid">
          ${statEntries.map((s) => `
            <div class="stat-box">
              <div class="stat-value">${s.value}</div>
              <div class="stat-label">${s.label}</div>
            </div>`).join('')}
        </div>` : '';

      const foundationBadge = article.isFoundation
        ? `<span class="badge-foundation">Foundation Article</span>` : '';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    /* ── Page setup ── */
    @page { margin: 40px 36px; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 13px; }

    /* ── Page-break rules — keep each section together ── */
    h2                              { page-break-after: avoid;  break-after: avoid; }
    ul, ol                          { page-break-inside: avoid; break-inside: avoid; }
    li                              { page-break-inside: avoid; break-inside: avoid; }
    p                               { page-break-inside: avoid; break-inside: avoid; }
    .section                        { page-break-inside: avoid; break-inside: avoid; }
    .stats-grid, .stat-box          { page-break-inside: avoid; break-inside: avoid; }
    .disclaimer, .header, .badge-row,
    .article-meta, .area-tags       { page-break-inside: avoid; break-inside: avoid; }

    /* ── Disclaimer ── */
    .disclaimer {
      background: #FEF3C7; border: 2.5px solid #F59E0B; border-radius: 8px;
      padding: 12px 18px; margin-bottom: 22px;
      font-size: 12.5px; font-weight: bold; color: #92400E;
      text-align: center; letter-spacing: 0.02em;
    }

    /* ── Header ── */
    .header {
      display: flex; align-items: flex-start; justify-content: space-between;
      border-bottom: 2.5px solid #5b3fa6; padding-bottom: 14px; margin-bottom: 20px;
    }
    .logo     { font-size: 21px; font-weight: bold; color: #3d2876; letter-spacing: 0.06em; }
    .logo-sub { font-size: 10.5px; color: #777; margin-top: 3px; }
    .header-right { text-align: right; font-size: 11px; color: #999; line-height: 1.6; }

    /* ── Badges ── */
    .badge-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .badge-ev {
      display: inline-block; padding: 4px 12px; border-radius: 6px;
      font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;
      background: ${evColor.bg}; color: ${evColor.text};
    }
    .badge-foundation {
      display: inline-block; padding: 4px 12px; border-radius: 6px;
      font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;
      background: #ede9fe; color: #4c1d95;
    }

    /* ── Article meta ── */
    .article-meta { margin-bottom: 16px; }
    .article-title { font-size: 18px; font-weight: bold; color: #1a1a1a; line-height: 1.45; margin-bottom: 8px; }
    .authors { font-size: 12px; color: #555; margin-bottom: 4px; line-height: 1.5; }
    .journal { font-size: 12px; color: #888; }

    /* ── Area tags ── */
    .area-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 22px; }
    .area-tag {
      background: #f0ebfc; color: #3d2876; padding: 3px 10px;
      border-radius: 4px; font-size: 11px; font-weight: bold;
      text-transform: uppercase; letter-spacing: 0.04em;
    }

    /* ── Section headings ── */
    h2 {
      font-size: 12px; color: #3d2876;
      border-left: 4px solid #5b3fa6; padding-left: 10px;
      margin-top: 22px; margin-bottom: 10px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* ── Body content ── */
    ul { padding-left: 20px; margin-bottom: 10px; }
    li { font-size: 12.5px; line-height: 1.75; color: #1a1a1a; margin-bottom: 5px; }
    p  { font-size: 12.5px; line-height: 1.75; color: #1a1a1a; margin-bottom: 10px; }

    /* ── Session stats ── */
    .stats-grid { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0 16px; }
    .stat-box {
      flex: 1; min-width: 110px;
      background: #f0ebfc; border: 1.5px solid #d8c8f8;
      border-radius: 10px; padding: 12px 14px; text-align: center;
    }
    .stat-value { font-size: 16px; font-weight: bold; color: #3d2876; margin-bottom: 4px; }
    .stat-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }

    /* ── Footer ── */
    .footer {
      margin-top: 36px; font-size: 10.5px; color: #aaa;
      border-top: 1px solid #e8e0f7; padding-top: 12px; text-align: center;
    }
  </style>
</head>
<body>

  <div class="disclaimer">⚠️ NOT FOR SHARING — For personal clinical reference only. Do not distribute or share this document.</div>

  <div class="header">
    <div>
      <div class="logo">EBP-SLP</div>
      <div class="logo-sub">Evidence-Based Practice for Speech-Language Pathology</div>
    </div>
    <div class="header-right">Article Summary<br>${today}</div>
  </div>

  <div class="badge-row">
    <span class="badge-ev">${evLabel}</span>
    ${foundationBadge}
  </div>

  <div class="article-meta">
    <div class="article-title">${article.title}</div>
    <div class="authors">${article.authors}</div>
    <div class="journal">${article.journal} · ${article.year}${pmidLine}</div>
  </div>

  <div class="area-tags">${areaTags}</div>

  <div class="section">
    <h2>What the Research Found</h2>
    <ul>${findingsList}</ul>
  </div>

  <div class="section">
    <h2>Clinical Application</h2>
    <p>${article.clinicalApplication}</p>
  </div>

  ${statsHtml}

  <div class="section">
    <h2>Best Fit For Patients With…</h2>
    <ul>${criteriaList}</ul>
  </div>

  <div class="footer">
    Generated by EBP-SLP · For authorized clinical use only · Not for distribution or sharing · Review content before clinical use
  </div>

</body>
</html>`;

      await Print.printAsync({ html });

    } catch (e: any) {
      if (e?.message !== 'Printing did not complete') {
        Alert.alert('Error', 'Could not open print dialog. Try again.');
      }
    } finally {
      setPrintingArticle(false);
    }
  };

  const APP_STORE_URL = 'https://apps.apple.com/us/app/ebp-slp/id6785711543';

  const handleExportPress = () => {
    Alert.alert(
      'Spread the word! 📣',
      'Know another SLP who could use evidence-based resources at their fingertips?',
      [
        {
          text: 'Maybe later',
          style: 'cancel',
          onPress: () => handlePrintArticle(),
        },
        {
          text: 'Share with a colleague',
          onPress: () =>
            Share.share({
              message:
                "I've been using EBP-SLP for evidence-based treatment articles and session planning — it's been a game changer for my clinical practice! Download it here:",
              url: APP_STORE_URL,
            }),
        },
      ],
    );
  };

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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

        {/* See full article link — always shown */}
        <Pressable
          style={styles.fullArticleBtn}
          onPress={() => {
            let link: string;
            if (article.url) {
              link = article.url;
            } else if (article.pmid) {
              link = `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
            } else {
              const query = encodeURIComponent(`${article.title} ${article.authorShort} ${article.year}`);
              link = `https://scholar.google.com/scholar?q=${query}`;
            }
            Linking.openURL(link);
          }}
        >
          <Text style={styles.fullArticleBtnText}>🔗  See full article</Text>
        </Pressable>

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

        {/* Personal notes */}
        <View
          style={styles.notesPanel}
          onLayout={(e) => {
            notesPanelYRef.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.notesPanelTitle}>📝  My notes</Text>
          <Text style={styles.notesWarning}>
            ⚠️ Do not enter patient names, dates of birth, or any identifying information.
          </Text>
          <TextInput
            style={styles.notesInput}
            value={note}
            onChangeText={handleNoteChange}
            placeholder="Add clinical notes, reminders, or highlights for this article…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            returnKeyType="done"
            blurOnSubmit={true}
            onFocus={() => {
              // Scroll so the notes panel sits just under the header, rather than
              // scrolling to the end of all content (which overshoots past this
              // panel to the related-articles/CTA/export sections below it).
              setTimeout(() => {
                scrollRef.current?.scrollTo({
                  y: Math.max(notesPanelYRef.current - 16, 0),
                  animated: true,
                });
              }, 100);
            }}
          />
        </View>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <View style={styles.relatedPanel}>
            <Text style={styles.relatedTitle}>Related articles</Text>
            {relatedArticles.map((a) => {
              const rc = EVIDENCE_COLORS[a.evidenceLevel];
              return (
                <Pressable
                  key={a.id}
                  style={styles.relatedRow}
                  onPress={() => router.push({ pathname: '/article/[id]', params: { id: a.id } })}
                >
                  <View style={styles.relatedLeft}>
                    <View style={[styles.relatedBadge, { backgroundColor: rc.bg }]}>
                      <Text style={[styles.relatedBadgeText, { color: rc.text }]}>
                        {EVIDENCE_LABELS[a.evidenceLevel]}
                      </Text>
                    </View>
                    <Text style={styles.relatedRowTitle} numberOfLines={2}>{a.shortTitle}</Text>
                    <Text style={styles.relatedRowMeta}>{a.authorShort} · {a.year}</Text>
                  </View>
                  <Text style={styles.relatedArrow}>›</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* CTA — treatment-focused articles get the generator; others get an explanation */}
        {article.isTreatmentFocused !== false ? (
          <Pressable
            style={styles.ctaBtn}
            onPress={() => {
              if (!isPremium()) {
                router.push('/paywall');
                return;
              }
              router.push({
                pathname: '/session/builder',
                params: { articleId: article.id },
              });
            }}
          >
            <Text style={styles.ctaBtnText}>⚡  Generate session plan from this article</Text>
          </Pressable>
        ) : (
          <View style={styles.noCtaNote}>
            <Text style={styles.noCtaIcon}>📋</Text>
            <Text style={styles.noCtaText}>
              This article is a research framework, literature review, or assessment guide. Session plan generation is available for treatment-focused articles.
            </Text>
          </View>
        )}

        {/* Export article summary */}
        <Pressable
          style={[styles.exportBtn, printingArticle && styles.exportBtnDisabled]}
          onPress={handleExportPress}
          disabled={printingArticle}
        >
          {printingArticle ? (
            <ActivityIndicator color={colors.primaryDark} size="small" />
          ) : (
            <Text style={styles.exportBtnText}>📄  Export article summary</Text>
          )}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
      </KeyboardAvoidingView>
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
  fullArticleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 14,
  },
  fullArticleBtnText: {
    ...text.bodySmall,
    color: colors.primary,
    fontFamily: 'Quicksand_700Bold',
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
  notesPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  notesPanelTitle: {
    ...text.h4,
    color: colors.primaryDeep,
    marginBottom: 8,
  },
  notesWarning: {
    ...text.caption,
    color: '#B45309',
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    lineHeight: 16,
  },
  notesInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...text.bodySmall,
    color: colors.text,
    minHeight: 80,
    backgroundColor: colors.bg,
    lineHeight: 20,
  },

  relatedPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  relatedTitle: { ...text.h4, color: colors.primaryDeep, marginBottom: 10 },
  relatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  relatedLeft: { flex: 1, gap: 3 },
  relatedBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  relatedBadgeText: { ...text.badge, fontSize: 9 },
  relatedRowTitle: { ...text.bodySmall, color: colors.text, fontFamily: 'Quicksand_600SemiBold', lineHeight: 17 },
  relatedRowMeta: { ...text.caption, color: colors.textMuted },
  relatedArrow: { ...text.h3, color: colors.textMuted, opacity: 0.5 },

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
  noCtaNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  noCtaIcon: {
    fontSize: 18,
  },
  noCtaText: {
    ...text.bodySmall,
    color: colors.primaryDeep,
    flex: 1,
    lineHeight: 20,
    fontFamily: 'Quicksand_600SemiBold',
  },
  exportBtn: {
    backgroundColor: colors.primaryLighter,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: {
    ...text.h4,
    color: colors.primaryDark,
  },
});

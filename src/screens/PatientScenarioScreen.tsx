// ─── Patient Scenario Smart Search ───────────────────────────────────────────
// Lets clinicians describe a patient in natural language and surfaces articles
// relevant to that presentation. Keyword matching maps clinical terms → ASHA
// areas, tags, and article content without requiring any network call.

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { text } from '@/theme/typography';
import { useArticles } from '@/context/ArticlesContext';
import { EVIDENCE_LABELS, EVIDENCE_COLORS, type Article, type AshaArea } from '@/data/articles';
import { setBrowseArea } from '@/store/browseStore';

// ─── Keyword → area mapping ───────────────────────────────────────────────────

const AREA_KEYWORDS: Record<string, string[]> = {
  Language: [
    'aphasia', 'language', 'word finding', 'anomia', 'expressive', 'receptive',
    'comprehension', 'naming', 'semantic', 'reading', 'writing', 'word retrieval',
    'agrammatism', 'paraphasia', 'broca', 'wernicke', 'global aphasia',
    'progressive aphasia', 'ppa', 'stroke language', 'discourse',
  ],
  Swallowing: [
    'swallowing', 'dysphagia', 'aspiration', 'choking', 'feeding', 'oral',
    'pharyngeal', 'esophageal', 'tube feeding', 'npo', 'peg', 'thin liquid',
    'thickened liquid', 'modified diet', 'silent aspiration', 'coughing when eating',
    'difficulty swallowing', 'mbss', 'fees', 'videofluoroscopy', 'chin tuck',
    'head turn', 'supraglottic swallow', 'effortful swallow',
  ],
  'Voice & Resonance': [
    'voice', 'vocal', 'hoarseness', 'dysphonia', 'resonance', 'hypernasality',
    'hyponasality', 'vocal fold', 'laryngeal', 'pitch', 'loudness', 'breathiness',
    'spasmodic dysphonia', 'vocal nodules', 'polyp', 'lsvt', 'resonant voice',
    'vhi', 'vrqol', 'voice therapy', 'vocal hygiene',
  ],
  'Motor Speech': [
    'apraxia', 'dysarthria', 'motor speech', 'articulation', 'intelligibility',
    'speech rate', 'aos', 'dttc', 'lsvt', 'rate control', 'spastic',
    'flaccid', 'ataxic', 'hypokinetic', 'hyperkinetic', 'parkinson',
    'als motor', 'cerebral palsy speech', 'slurred speech', 'sound production',
  ],
  'Cognitive-Communication': [
    'cognitive', 'memory', 'attention', 'executive function', 'tbi', 'brain injury',
    'traumatic brain injury', 'dementia', 'confusion', 'disorientation',
    'reasoning', 'problem solving', 'social communication', 'pragmatics',
    'frontal lobe', 'right hemisphere', 'acquired brain',
  ],
  Fluency: [
    'stuttering', 'fluency', 'cluttering', 'disfluency', 'stammering',
    'stutter', 'prolongation', 'repetition', 'block', 'fluency shaping',
    'stuttering modification', 'anxiety stutter', 'oases',
  ],
  AAC: [
    'aac', 'augmentative', 'alternative communication', 'communication device',
    'nonverbal', 'nonspeaking', 'pecs', 'sgd', 'speech generating',
    'als communication', 'low tech', 'high tech', 'core vocabulary',
    'aided language', 'symbol based',
  ],
  'General Practice': [
    'telehealth', 'telepractice', 'teletherapy', 'remote', 'virtual therapy',
    'evidence-based', 'ebp', 'clinical evidence', 'icf', 'framework',
    'service delivery', 'face-to-face', 'best practice', 'guidelines',
  ],
};

// ─── Score an article against a query ────────────────────────────────────────

interface ScoredArticle {
  article: Article;
  score: number;
  matchedTerms: string[];
}

function scoreArticle(article: Article, tokens: string[]): ScoredArticle {
  let score = 0;
  const matchedTerms: string[] = [];

  // Guard against malformed remote articles — any missing field = skip safely
  const areas: string[] = Array.isArray(article.areas) ? article.areas : [];
  const tags: string[] = Array.isArray(article.tags) ? article.tags : [];
  const bestFitCriteria: string[] = Array.isArray(article.bestFitCriteria) ? article.bestFitCriteria : [];
  const summary = (article.summary ?? '').toLowerCase();
  const shortTitle = (article.shortTitle ?? '').toLowerCase();
  const title = (article.title ?? '').toLowerCase();

  // Check each token against every area's keyword list
  for (const token of tokens) {
    for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
      if (keywords.some((kw) => token.includes(kw) || (kw.length >= 5 && kw.includes(token)))) {
        if (areas.includes(area)) {
          score += 5; // strong signal: article is tagged with this area
          if (!matchedTerms.includes(area)) matchedTerms.push(area);
        }
        // No points for area mismatch — prevents all articles from scoring ≥ 1
      }
    }

    // Tag match
    if (tags.some((t) => t?.toLowerCase().includes(token) || token.includes(t?.toLowerCase() ?? ''))) {
      score += 3;
      const tag = tags.find((t) => t?.toLowerCase().includes(token) || token.includes(t?.toLowerCase() ?? ''));
      if (tag && !matchedTerms.includes(tag)) matchedTerms.push(tag);
    }

    // Summary / title match
    if (summary.includes(token)) score += 2;
    if (shortTitle.includes(token)) score += 2;
    if (title.includes(token)) score += 1;

    // Best fit criteria match — very clinically meaningful
    if (bestFitCriteria.some((c) => c?.toLowerCase().includes(token))) {
      score += 4;
    }
  }

  return { article, score, matchedTerms };
}

// Common words that appear in almost every article and would inflate match counts
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'has', 'are', 'can', 'not', 'but', 'this',
  'that', 'from', 'have', 'been', 'will', 'they', 'when', 'who', 'what',
  'how', 'post', 'per', 'via', 'age', 'use', 'used', 'also', 'both',
  'may', 'was', 'who', 'its', 'all', 'one', 'two', 'due', 'low', 'high',
  'which', 'these', 'their', 'than', 'more', 'using', 'during', 'after',
  'well', 'based', 'study', 'show', 'shown', 'found', 'patient', 'patients',
  'adult', 'adults', 'clinical', 'treatment', 'therapy', 'evidence',
]);

function runSearch(query: string, articles: Article[]): ScoredArticle[] {
  if (!query.trim()) return [];

  const lower = query.toLowerCase();
  // Only keep meaningful clinical terms (4+ chars, not stop words)
  const tokens = Array.from(
    new Set(
      lower
        .split(/[\s,;.()\-]+/)
        .filter((t) => t.length >= 4 && !STOP_WORDS.has(t)),
    ),
  );

  // If no meaningful tokens extracted, fall back to the full trimmed query
  if (tokens.length === 0) tokens.push(lower.trim());

  return articles
    .map((a) => scoreArticle(a, tokens))
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreak: evidence strength
      const rank: Record<string, number> = { '1a': 0, '1b': 1, '2': 2, '3': 3 };
      return (rank[a.article.evidenceLevel] ?? 4) - (rank[b.article.evidenceLevel] ?? 4);
    });
}

// ─── Pick best-matching articles (3–8) ───────────────────────────────────────
// Show only articles whose score is at least 35% of the top score,
// capped at 8 and floored at 3.

function getTopResults(results: ScoredArticle[], min = 3, max = 8): ScoredArticle[] {
  if (results.length === 0) return [];
  if (results.length <= min) return results;
  const topScore = results[0].score;
  const threshold = topScore * 0.35;
  const filtered = results.filter((r) => r.score >= threshold);
  // Always return at least min results even if they fall below threshold
  return filtered.length >= min ? filtered.slice(0, max) : results.slice(0, min);
}

// ─── Detect relevant areas from query tokens ──────────────────────────────────

const AREA_ICONS: Record<string, string> = {
  'Language': '💬',
  'Swallowing': '🫁',
  'Voice & Resonance': '🎙️',
  'Motor Speech': '🗣️',
  'General Practice': '📋',
  'Cognitive-Communication': '🧠',
  'Fluency': '🔄',
  'AAC': '📱',
};

// Primary: derive areas from which articles actually matched (works for any query phrasing)
function detectAreasFromResults(results: ScoredArticle[]): string[] {
  const areaCount: Record<string, number> = {};
  for (const { article, score } of results) {
    for (const area of (article.areas ?? [])) {
      // Weight by score so higher-ranked articles influence the suggestion more
      areaCount[area] = (areaCount[area] ?? 0) + score;
    }
  }
  return Object.entries(areaCount)
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area);
}

// Secondary fallback: keyword-based area detection (used when results are empty)
function detectAreasFromQuery(tokens: string[]): string[] {
  const areaScores: Record<string, number> = {};
  for (const token of tokens) {
    for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
      if (keywords.some((kw) => token.includes(kw) || (kw.length >= 5 && kw.includes(token)))) {
        areaScores[area] = (areaScores[area] ?? 0) + 1;
      }
    }
  }
  return Object.entries(areaScores)
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area);
}

// ─── Result card ──────────────────────────────────────────────────────────────

const ResultCard: React.FC<{
  result: ScoredArticle;
  onPress: () => void;
}> = ({ result, onPress }) => {
  const { article, matchedTerms } = result;
  const evColor = EVIDENCE_COLORS[article.evidenceLevel] ?? EVIDENCE_COLORS['3'];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: evColor.bg }]}>
            <Text style={[styles.badgeText, { color: evColor.text }]}>
              {EVIDENCE_LABELS[article.evidenceLevel]}
            </Text>
          </View>
          {article.isTreatmentFocused !== false && (
            <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.badgeText, { color: '#E65100' }]}>⚡ Plan ready</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardArrow}>›</Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{article.shortTitle}</Text>
      <Text style={styles.cardMeta}>{article.authorShort} · {article.year}</Text>

      {matchedTerms.length > 0 && (
        <View style={styles.matchRow}>
          {matchedTerms.slice(0, 3).map((term) => (
            <View key={term} style={styles.matchPill}>
              <Text style={styles.matchPillText}>{term}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.cardSummary} numberOfLines={2}>{article.summary}</Text>
    </Pressable>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export const PatientScenarioScreen: React.FC = () => {
  const router = useRouter();
  const { articles } = useArticles();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ScoredArticle[]>([]);
  const [suggestedAreas, setSuggestedAreas] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const EXAMPLES = [
    'severe expressive aphasia post-stroke',
    "patient with Parkinson's and quiet voice",
    'adult TBI with memory and attention deficits',
    'dysphagia with aspiration risk on thin liquids',
    'stuttering with social anxiety in adults',
    'ALS with declining intelligibility',
  ];

  const handleSearch = useCallback((q: string) => {
    if (!q.trim()) return;
    setIsSearching(true);
    Keyboard.dismiss();
    // Small delay so the spinner renders before the synchronous search
    setTimeout(() => {
      const lower = q.toLowerCase();
      const tokens = Array.from(
        new Set(
          lower.split(/[\s,;.()\-]+/).filter((t) => t.length >= 4 && !STOP_WORDS.has(t)),
        ),
      );
      if (tokens.length === 0) tokens.push(lower.trim());

      const allResults = runSearch(q, articles);
      const topResults = getTopResults(allResults);

      // Derive area suggestions from matched articles (works for any query phrasing).
      // Fall back to keyword matching only when nothing matched.
      const areasFromResults = detectAreasFromResults(allResults);
      const areasFromKeywords = detectAreasFromQuery(tokens);

      // Merge: results-based areas first, then fill in any additional from keywords
      const seen = new Set(areasFromResults);
      const mergedAreas = [...areasFromResults];
      for (const area of areasFromKeywords) {
        if (!seen.has(area)) { mergedAreas.push(area); seen.add(area); }
      }

      setResults(topResults);
      setSuggestedAreas(mergedAreas.slice(0, 4));
      setHasSearched(true);
      setIsSearching(false);
    }, 80);
  }, [articles]);

  const handleExample = (ex: string) => {
    setQuery(ex);
    handleSearch(ex);
  };

  const handleArticlePress = (article: Article) => {
    router.push({ pathname: '/article/[id]', params: { id: article.id } });
  };

  const handleAreaPress = (area: string) => {
    setBrowseArea(area as AshaArea);
    router.push('/(tabs)/browse');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Browse</Text>
        </Pressable>
        <Text style={[styles.screenTitle, { flex: 1, textAlign: 'center' }]}>
          Evidence-Based Plans for My Patient
        </Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Describe your patient…"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          returnKeyType="search"
          onSubmitEditing={() => handleSearch(query)}
          blurOnSubmit
        />
        <Pressable
          style={[styles.searchBtn, !query.trim() && styles.searchBtnDisabled]}
          onPress={() => handleSearch(query)}
          disabled={!query.trim() || isSearching}
        >
          {isSearching ? (
            <ActivityIndicator color={colors.surface} size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Describe your patient's diagnosis, deficits, or goals. The more detail, the better the match.
      </Text>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Examples */}
        {!hasSearched && (
          <>
            <Text style={styles.sectionLabel}>TRY AN EXAMPLE</Text>
            {EXAMPLES.map((ex) => (
              <Pressable key={ex} style={styles.exampleBtn} onPress={() => handleExample(ex)}>
                <Text style={styles.exampleText}>{ex}</Text>
                <Text style={styles.exampleArrow}>→</Text>
              </Pressable>
            ))}
          </>
        )}

        {/* Results */}
        {hasSearched && (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.sectionLabel}>
                {results.length > 0
                  ? `${results.length} ARTICLE${results.length !== 1 ? 'S' : ''} MATCHED`
                  : 'NO MATCHES'}
              </Text>
              <Pressable
                onPress={() => { setQuery(''); setResults([]); setSuggestedAreas([]); setHasSearched(false); }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            </View>

            {results.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No articles matched</Text>
                <Text style={styles.emptyBody}>
                  Try different clinical terms — diagnosis names, deficit types, or treatment approaches work well.
                </Text>
                {suggestedAreas.length > 0 && (
                  <View style={styles.areaSection}>
                    <Text style={styles.areaSectionLabel}>BROWSE BY TOPIC</Text>
                    <View style={styles.areaChipRow}>
                      {suggestedAreas.map((area) => (
                        <Pressable key={area} style={styles.areaChip} onPress={() => handleAreaPress(area)}>
                          <Text style={styles.areaChipIcon}>{AREA_ICONS[area] ?? '📂'}</Text>
                          <Text style={styles.areaChipText}>{area}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.queryEcho}>Best matches for: <Text style={styles.queryEchoItalic}>"{query}"</Text></Text>
                {results.map((r) => (
                  <ResultCard
                    key={r.article.id}
                    result={r}
                    onPress={() => handleArticlePress(r.article)}
                  />
                ))}
                <View style={styles.tipCard}>
                  <Text style={styles.tipText}>
                    💡 Articles with ⚡ <Text style={{ fontFamily: 'Quicksand_700Bold' }}>Plan ready</Text> can generate a full evidence-based session plan directly from the article detail page.
                  </Text>
                </View>

                {/* Continue Searching */}
                {suggestedAreas.length > 0 && (
                  <View style={styles.areaSection}>
                    <Text style={styles.areaSectionLabel}>CONTINUE SEARCHING</Text>
                    <Text style={styles.areaSectionHint}>Browse the full topic library for more articles</Text>
                    <View style={styles.areaChipRow}>
                      {suggestedAreas.map((area) => (
                        <Pressable key={area} style={styles.areaChip} onPress={() => handleAreaPress(area)}>
                          <Text style={styles.areaChipIcon}>{AREA_ICONS[area] ?? '📂'}</Text>
                          <Text style={styles.areaChipText}>{area}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { paddingVertical: 4 },
  backText: { ...text.body, color: colors.primary, fontFamily: 'Quicksand_600SemiBold' },
  screenTitle: { ...text.h3, color: colors.text },

  searchWrap: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 4,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...text.body,
    color: colors.text,
    minHeight: 64,
    maxHeight: 110,
  },
  searchBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { ...text.bodySmall, color: colors.surface, fontFamily: 'Quicksand_700Bold' },

  hint: {
    ...text.caption,
    color: colors.textMuted,
    marginHorizontal: 20,
    marginBottom: 12,
    lineHeight: 17,
  },

  scroll: { paddingHorizontal: 20 },

  sectionLabel: { ...text.label, color: colors.textMuted, marginBottom: 10 },

  exampleBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exampleText: { ...text.bodySmall, color: colors.primaryDark, flex: 1, lineHeight: 18 },
  exampleArrow: { ...text.body, color: colors.primary, marginLeft: 8 },

  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  clearBtnText: { ...text.caption, color: colors.textMuted, fontFamily: 'Quicksand_600SemiBold' },

  queryEcho: { ...text.caption, color: colors.textMuted, marginBottom: 12 },
  queryEchoItalic: { fontStyle: 'italic' },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: 'Quicksand_600SemiBold' },
  cardArrow: { ...text.h3, color: colors.textMuted, marginLeft: 8 },
  cardTitle: { ...text.h4, color: colors.text, marginBottom: 3, lineHeight: 20 },
  cardMeta: { ...text.caption, color: colors.textMuted, marginBottom: 8 },
  matchRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 8 },
  matchPill: {
    backgroundColor: colors.primaryLighter,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  matchPillText: { ...text.caption, color: colors.primaryDeep, fontFamily: 'Quicksand_600SemiBold' },
  cardSummary: { ...text.caption, color: colors.textMuted, lineHeight: 17 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { ...text.h3, color: colors.text, marginBottom: 8 },
  emptyBody: {
    ...text.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  tipCard: {
    backgroundColor: colors.primaryLighter,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  tipText: { ...text.caption, color: colors.primaryDeep, lineHeight: 18 },

  areaSection: {
    marginTop: 20,
    marginBottom: 8,
  },
  areaSectionLabel: { ...text.label, color: colors.textMuted, marginBottom: 4 },
  areaSectionHint: { ...text.caption, color: colors.textMuted, marginBottom: 12, lineHeight: 16 },
  areaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  areaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  areaChipIcon: { fontSize: 14 },
  areaChipText: {
    ...text.bodySmall,
    color: colors.primaryDark,
    fontFamily: 'Quicksand_600SemiBold',
  },
});

// ─── Article Data ─────────────────────────────────────────────────────────────
// Types, helpers, and bundled article list.
//
// IMPORTANT: Article DATA lives in articles.json (same file pushed to GitHub).
// Importing it here keeps the bundled fallback 100% in sync with the live
// database — no manual copy-paste needed. To add or edit articles, update
// articles.json and run push_articles.sh, then build a new binary.

export type EvidenceLevel = '1a' | '1b' | '2' | '3';

export type AshaArea =
  | 'Motor Speech'
  | 'Voice & Resonance'
  | 'Language'
  | 'Swallowing'
  | 'Cognitive-Communication'
  | 'AAC'
  | 'Fluency'
  | 'General Practice';

export interface Article {
  id: string;
  title: string;
  shortTitle: string;
  authors: string;
  authorShort: string; // e.g. "Maas et al."
  journal: string;
  year: number;
  pmid?: string;
  url?: string; // direct link to article (DOI, ResearchGate, etc.) — falls back to PubMed if pmid is set
  evidenceLevel: EvidenceLevel;
  evidenceType: string; // e.g. "RCT", "Systematic review", "Tutorial"
  areas: AshaArea[];
  tags: string[];
  summary: string; // 1–2 sentence overview shown on the article card
  isFoundation: boolean;
  isTreatmentFocused?: boolean; // if false, hides "Generate session plan" CTA
  researchFindings: string[];
  clinicalApplication: string; // paragraph describing how to apply
  sessionStats: {
    frequency?: string;
    sessionLength?: string;
    dose?: string;
    bestFit?: string;
  };
  bestFitCriteria: string[];
}

// ─── Bundled article list ─────────────────────────────────────────────────────
// Metro bundles this JSON into the app at build time.
// The live app also fetches the latest from GitHub (see remoteArticlesService).

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const ARTICLES: Article[] = require('../../articles.json') as Article[];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// _remoteCache is set by ArticlesContext when remote articles load.
// This lets session screens (which call getArticleById synchronously) find
// articles that were added after the bundled release.
let _remoteCache: Article[] | null = null;
export function setRemoteArticleCache(articles: Article[]): void {
  _remoteCache = articles;
}

export function getArticleById(id: string): Article | undefined {
  if (_remoteCache) {
    const found = _remoteCache.find((a) => a.id === id);
    // If found in remote cache, use it. Otherwise fall through to bundled —
    // this handles the case where the remote copy is older than the binary
    // (e.g. GitHub hasn't been pushed yet since the last articles.json update).
    if (found) return found;
  }
  return ARTICLES.find((a) => a.id === id);
}

export function getArticlesByArea(area: AshaArea): Article[] {
  return ARTICLES.filter((a) => a.areas.includes(area));
}

export function getFoundationArticles(): Article[] {
  return ARTICLES.filter((a) => a.isFoundation);
}

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  '1a': 'Level 1a · Systematic review',
  '1b': 'Level 1b · RCT',
  '2': 'Level 2 · Review',
  '3': 'Level 3 · Case series',
};

export const EVIDENCE_COLORS: Record<EvidenceLevel, { bg: string; text: string }> = {
  '1a': { bg: '#D1FAE5', text: '#059669' },
  '1b': { bg: '#DBEAFE', text: '#1D4ED8' },
  '2': { bg: '#E9D5FF', text: '#7E22CE' },
  '3': { bg: '#FED7AA', text: '#C2410C' },
};

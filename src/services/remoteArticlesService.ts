// ─── Remote Articles Service ──────────────────────────────────────────────────
// Fetches the article list from GitHub and caches it in AsyncStorage.
// The app always starts with the bundled articles, then silently upgrades
// to the latest remote list in the background.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Article } from '@/data/articles';

const REMOTE_URL =
  'https://raw.githubusercontent.com/abbeyrowe1211/EBP-SLP-ARTICLES/main/articles.json';

const CACHE_KEY = 'ebp_slp_remote_articles_v3'; // bumped to force re-fetch + sanitize

// ─── Text sanitizer ───────────────────────────────────────────────────────────
// Cleans up common encoding artifacts that appear when articles are exported
// from Word, Google Docs, or other tools into JSON.

function sanitizeText(text: unknown): string {
  if (!text || typeof text !== 'string') return text as string;
  return text
    // HTML entities (named)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, ' - ')
    .replace(/&ndash;/g, '-')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    // HTML entities (numeric)
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, ' - ')
    .replace(/&#x27;/g, "'")
    // Smart / curly quotes
    .replace(/‘|’/g, "'")
    .replace(/“|”/g, '"')
    // Mojibake: double-encoded UTF-8 artifacts that may linger in old cached data
    .replace(/Ã¢ÂÂ/g, '–')
    .replace(/â€”/g, '—')
    .replace(/â€“/g, '–')
    .replace(/â€˜/g, "'")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    // Em dash, en dash, horizontal bar (keep as-is — iOS renders these fine)
    // Ellipsis, non-breaking space, zero-width chars
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[​‌‍﻿]/g, '')
    // Stray markdown bold/italic
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
}

function sanitizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => sanitizeText(item));
}

function sanitizeArticle(a: Article): Article {
  return {
    ...a,
    title: sanitizeText(a.title),
    shortTitle: sanitizeText(a.shortTitle),
    summary: sanitizeText(a.summary),
    clinicalApplication: sanitizeText(a.clinicalApplication),
    researchFindings: sanitizeStringArray(a.researchFindings),
    bestFitCriteria: sanitizeStringArray(a.bestFitCriteria),
  };
}

// ─── Get cached articles (fast, sync-ish) ────────────────────────────────────

export async function getCachedRemoteArticles(): Promise<Article[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return (parsed as Article[]).map(sanitizeArticle);
  } catch {
    return null;
  }
}

// ─── Fetch from GitHub and update cache ──────────────────────────────────────

export async function fetchAndCacheRemoteArticles(): Promise<Article[] | null> {
  try {
    const res = await fetch(REMOTE_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const sanitized = (data as Article[]).map(sanitizeArticle);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return null;
  }
}

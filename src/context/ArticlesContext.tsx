// ─── Articles Context ─────────────────────────────────────────────────────────
// Provides the article list to the whole app.
// Strategy:
//   1. Start immediately with bundled articles (no delay).
//   2. Swap in cached remote articles if available (AsyncStorage, fast).
//   3. Fetch fresh from GitHub in the background and update silently.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { ARTICLES as BUNDLED_ARTICLES, type Article, setRemoteArticleCache } from '@/data/articles';
import {
  getCachedRemoteArticles,
  fetchAndCacheRemoteArticles,
} from '@/services/remoteArticlesService';

// ─── Module-level cache so getArticleById always has access ──────────────────
let _articleCache: Article[] = BUNDLED_ARTICLES;

export function getArticles(): Article[] {
  return _articleCache;
}

export function getArticleByIdFromCache(id: string): Article | undefined {
  return _articleCache.find((a) => a.id === id);
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ArticlesContextValue {
  articles: Article[];
}

const ArticlesContext = createContext<ArticlesContextValue>({
  articles: BUNDLED_ARTICLES,
});

export const useArticles = () => useContext(ArticlesContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ArticlesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [articles, setArticles] = useState<Article[]>(BUNDLED_ARTICLES);

  const updateArticles = useCallback((data: Article[]) => {
    _articleCache = data;
    setRemoteArticleCache(data);
    setArticles(data);
  }, []);

  useEffect(() => {
    // Step 1: load cached remote articles immediately (fast path)
    getCachedRemoteArticles().then((cached) => {
      if (cached) updateArticles(cached);
    });

    // Step 2: fetch fresh from GitHub in background
    fetchAndCacheRemoteArticles().then((fresh) => {
      if (fresh) updateArticles(fresh);
    });
  }, [updateArticles]);

  return (
    <ArticlesContext.Provider value={{ articles }}>
      {children}
    </ArticlesContext.Provider>
  );
};

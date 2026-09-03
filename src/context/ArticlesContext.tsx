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
import * as Notifications from 'expo-notifications';
import { ARTICLES as BUNDLED_ARTICLES, type Article, setRemoteArticleCache } from '@/data/articles';
import {
  getCachedRemoteArticles,
  fetchAndCacheRemoteArticles,
} from '@/services/remoteArticlesService';
import { detectNewArticles } from '@/data/newArticles';

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
  isLoading: boolean;
  fetchError: boolean;
}

const ArticlesContext = createContext<ArticlesContextValue>({
  articles: BUNDLED_ARTICLES,
  isLoading: false,
  fetchError: false,
});

export const useArticles = () => useContext(ArticlesContext);

// ─── Local notification when new content lands ───────────────────────────────
// Fires the moment the app detects new articles during a background refresh.
// Only fires if notification permission was already granted elsewhere (Article
// of the Week / motivational reminders) — this code path never prompts for
// permission on its own, since that'd be a surprising place to ask.

async function notifyNewArticles(count: number): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📚 New research added',
        body: `${count} new article${count > 1 ? 's' : ''} just added to EBP SLP.`,
        data: { type: 'newArticles' },
      },
      trigger: null, // fire immediately
    });
  } catch {
    // Silently fail — don't disrupt article loading over a notification.
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ArticlesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [articles, setArticles] = useState<Article[]>(BUNDLED_ARTICLES);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const updateArticles = useCallback((data: Article[]) => {
    _articleCache = data;
    setRemoteArticleCache(data);
    setArticles(data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Step 1: load cached remote articles immediately (fast path)
      const cached = await getCachedRemoteArticles();
      if (!cancelled && cached) updateArticles(cached);

      // Step 2: fetch fresh from GitHub in background
      setIsLoading(true);
      setFetchError(false);
      const fresh = await fetchAndCacheRemoteArticles();
      if (!cancelled) {
        setIsLoading(false);
        if (fresh) {
          updateArticles(fresh);

          // Diff against what this device has seen before. Only truly new
          // articles come back here — nothing on first run, nothing already
          // known. Powers the bell dot / panel automatically, no rebuild
          // needed when new articles are pushed.
          const newlyAppeared = await detectNewArticles(fresh);
          if (!cancelled && newlyAppeared.length > 0) {
            notifyNewArticles(newlyAppeared.length);
          }
        } else {
          setFetchError(true);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [updateArticles]);

  return (
    <ArticlesContext.Provider value={{ articles, isLoading, fetchError }}>
      {children}
    </ArticlesContext.Provider>
  );
};

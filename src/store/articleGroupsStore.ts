// ─── Article Groups Store ─────────────────────────────────────────────────────
// Persists user-created groups of saved articles.
// Articles can belong to multiple groups simultaneously.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ebp_slp_article_groups_v1';

export interface ArticleGroup {
  id: string;
  name: string;
  articleIds: string[];
  createdAt: string;
}

let _cached: ArticleGroup[] | null = null;
const _listeners = new Set<() => void>();

async function load(): Promise<ArticleGroup[]> {
  if (_cached !== null) return _cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    _cached = raw ? JSON.parse(raw) : [];
  } catch {
    _cached = [];
  }
  return _cached!;
}

async function persist(groups: ArticleGroup[]): Promise<void> {
  _cached = groups;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(groups));
    _listeners.forEach((fn) => fn());
  } catch {}
}

export async function getGroups(): Promise<ArticleGroup[]> {
  return load();
}

export async function createGroup(name: string): Promise<ArticleGroup> {
  const groups = await load();
  const group: ArticleGroup = {
    id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    articleIds: [],
    createdAt: new Date().toISOString(),
  };
  await persist([...groups, group]);
  return group;
}

export async function renameGroup(id: string, name: string): Promise<void> {
  const groups = await load();
  await persist(groups.map((g) => (g.id === id ? { ...g, name: name.trim() } : g)));
}

export async function deleteGroup(id: string): Promise<void> {
  const groups = await load();
  await persist(groups.filter((g) => g.id !== id));
}

export async function setGroupArticles(groupId: string, articleIds: string[]): Promise<void> {
  const groups = await load();
  await persist(groups.map((g) => (g.id === groupId ? { ...g, articleIds } : g)));
}

export function subscribeGroups(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

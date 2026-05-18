// ─── Browse Store ─────────────────────────────────────────────────────────────
// Module-level store for Browse area + search query.
// Using simple module variables avoids URL param issues with Expo Router
// re-mounting the Browse screen on navigation.

import { type AshaArea } from '@/data/articles';

let _area: AshaArea | 'All' = 'All';
let _query: string = '';

const _areaListeners: Set<(area: AshaArea | 'All') => void> = new Set();
const _queryListeners: Set<(query: string) => void> = new Set();

// ─── Area ─────────────────────────────────────────────────────────────────────
export function getBrowseArea(): AshaArea | 'All' { return _area; }

export function setBrowseArea(area: AshaArea | 'All') {
  _area = area;
  _areaListeners.forEach((fn) => fn(area));
}

export function subscribeBrowseArea(fn: (area: AshaArea | 'All') => void) {
  _areaListeners.add(fn);
  return () => _areaListeners.delete(fn);
}

// ─── Search query ─────────────────────────────────────────────────────────────
export function getBrowseQuery(): string { return _query; }

export function setBrowseQuery(query: string) {
  _query = query;
  _queryListeners.forEach((fn) => fn(query));
}

export function subscribeBrowseQuery(fn: (query: string) => void) {
  _queryListeners.add(fn);
  return () => _queryListeners.delete(fn);
}

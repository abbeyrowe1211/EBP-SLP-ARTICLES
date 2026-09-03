// ─── Session Draft Storage ─────────────────────────────────────────────────────
// Autosaves an in-progress data-collection session so trial data survives a
// crash, force-quit, or the OS reclaiming background memory. Previously,
// trial data only reached storage when the clinician tapped "End session" —
// any interruption before that silently lost the whole session.
//
// Single-slot by design: only one data-collection session can realistically
// be active on one device at a time, so there's one current draft, not a list.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type TrialEntry } from '@/types/sessionData';

const DRAFT_KEY = 'ebp_slp_session_draft_v1';

export interface SessionDraft {
  patientLabel: string;
  savedPlanId: string;
  articleId: string;
  planJson: string;   // raw plan JSON string — re-parsed on resume
  sessionTitle: string;
  currentStep: number;
  trials: TrialEntry[];
  startedAt: string;  // ISO — when this draft was first created
  updatedAt: string;  // ISO — last autosave
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getDraft(): Promise<SessionDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraft;
    if (!parsed || !Array.isArray(parsed.trials)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────
// Best-effort: an autosave failure should never interrupt live data entry,
// so this swallows errors rather than surfacing them mid-session.

export async function saveDraft(draft: SessionDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // No recovery point this time — not worth interrupting the clinician.
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// ─── Session Data Storage ─────────────────────────────────────────────────────
// Persists trial-by-trial session data using AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type SessionDataRecord,
  type TrialEntry,
  type StepSummary,
  type CueLevel,
  CUE_ALL,
} from '@/types/sessionData';

const STORAGE_KEY = 'ebp_slp_session_data_v1';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getAllSessionData(): Promise<SessionDataRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionDataRecord[];
  } catch {
    return [];
  }
}

export async function saveSessionData(
  record: Omit<SessionDataRecord, 'id'>
): Promise<SessionDataRecord> {
  const existing = await getAllSessionData();
  const newRecord: SessionDataRecord = {
    ...record,
    id: `data_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([newRecord, ...existing]));
  return newRecord;
}

export async function deleteSessionData(id: string): Promise<void> {
  const existing = await getAllSessionData();
  const updated = existing.filter((r) => r.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function getSessionDataForPlan(savedPlanId: string): Promise<SessionDataRecord[]> {
  const all = await getAllSessionData();
  return all.filter((r) => r.savedPlanId === savedPlanId);
}

// ─── Summary computation ──────────────────────────────────────────────────────

export function computeStepSummaries(
  trials: TrialEntry[],
  stepTitles: string[]
): StepSummary[] {
  return stepTitles.map((title, stepIndex) => {
    const stepTrials = trials.filter((t) => t.stepIndex === stepIndex);
    const totalTrials = stepTrials.length;
    const correctTrials = stepTrials.filter((t) => t.correct).length;
    const accuracy = totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;

    // Cue breakdown — only include levels that were actually used
    const cueBreakdown: Partial<Record<CueLevel, number>> = {};
    stepTrials.forEach((t) => {
      cueBreakdown[t.cueLevel] = (cueBreakdown[t.cueLevel] ?? 0) + 1;
    });

    // Dominant cue level (most-used)
    let dominantCueLevel: CueLevel | null = null;
    if (totalTrials > 0) {
      dominantCueLevel = (Object.entries(cueBreakdown) as [CueLevel, number][])
        .reduce((a, b) => (a[1] >= b[1] ? a : b))[0];
    }

    return { stepIndex, stepTitle: title, totalTrials, correctTrials, accuracy, dominantCueLevel, cueBreakdown };
  });
}

export function computeOverallAccuracy(trials: TrialEntry[]): number {
  if (trials.length === 0) return 0;
  const correct = trials.filter((t) => t.correct).length;
  return Math.round((correct / trials.length) * 100);
}

export function formatSessionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

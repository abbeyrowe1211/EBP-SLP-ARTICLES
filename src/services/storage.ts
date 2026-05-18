// ─── Storage Service ──────────────────────────────────────────────────────────
// Persists saved session plans locally on device using AsyncStorage.
// No PHI is ever stored — patient labels are clinician-assigned descriptors only.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type GeneratedPlan } from './claude';

const STORAGE_KEY = 'ebp_slp_saved_plans_v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SavedPlan {
  id: string;
  patientLabel: string;         // Initials only, max 3 chars, e.g. "AJB"
  savedAt: string;              // ISO date string
  articleId: string;
  articleShortTitle: string;
  articleAuthorShort: string;
  articleYear: number;
  plan: GeneratedPlan;
}

export interface PatientGroup {
  label: string;
  plans: SavedPlan[];
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getSavedPlans(): Promise<SavedPlan[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPlan[];
  } catch {
    return [];
  }
}

export async function savePlan(
  entry: Omit<SavedPlan, 'id' | 'savedAt'>
): Promise<SavedPlan> {
  const existing = await getSavedPlans();
  const newEntry: SavedPlan = {
    ...entry,
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([newEntry, ...existing])
  );
  return newEntry;
}

export async function deleteSavedPlan(id: string): Promise<void> {
  const existing = await getSavedPlans();
  const updated = existing.filter((p) => p.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns unique patient labels from saved plans, most-recently-used first. */
export function getPatientLabels(plans: SavedPlan[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const p of plans) {
    if (!seen.has(p.patientLabel)) {
      seen.add(p.patientLabel);
      labels.push(p.patientLabel);
    }
  }
  return labels;
}

/** Groups saved plans by patient label, preserving recency order. */
export function getPatientGroups(plans: SavedPlan[]): PatientGroup[] {
  const map = new Map<string, SavedPlan[]>();
  for (const plan of plans) {
    if (!map.has(plan.patientLabel)) map.set(plan.patientLabel, []);
    map.get(plan.patientLabel)!.push(plan);
  }
  return Array.from(map.entries()).map(([label, plans]) => ({ label, plans }));
}

/** Formats a savedAt ISO string to a readable date, e.g. "May 7". */
export function formatSavedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ─── Session Data Types ───────────────────────────────────────────────────────
// All data is PHI-free — patient labels only, no names or identifiers.

export type CueLevel =
  // ── Physical / hierarchy ──
  | 'Independent'
  | 'Gestural'
  | 'Tactile'
  // ── Verbal subtypes ──
  | 'Phonemic'
  | 'Semantic'
  | 'Category'
  | 'Sentence completion'
  | 'Choice'
  // ── Custom ──
  | 'Other';

// Display order — physical row first, verbal row second, Other last
export const CUE_PHYSICAL: CueLevel[] = ['Independent', 'Gestural', 'Tactile'];
export const CUE_VERBAL: CueLevel[]   = ['Phonemic', 'Semantic', 'Category', 'Sentence completion', 'Choice'];
export const CUE_ALL: CueLevel[]      = [...CUE_PHYSICAL, ...CUE_VERBAL, 'Other'];

export const CUE_LABELS: Record<CueLevel, string> = {
  Independent:           'Independent',
  Gestural:              'Gestural',
  Tactile:               'Tactile',
  Phonemic:              'Phonemic',
  Semantic:              'Semantic',
  Category:              'Category',
  'Sentence completion': 'Sentence Completion',
  Choice:                'Choice',
  Other:                 'Other…',
};

export const CUE_DESCRIPTIONS: Record<CueLevel, string> = {
  Independent:           'No cue needed',
  Gestural:              'Point, sign, or visual gesture',
  Tactile:               'Physical touch or tactile assist',
  Phonemic:              'First sound or syllable ("/k/…")',
  Semantic:              'Meaning-based description',
  Category:              'Category membership ("a type of…")',
  'Sentence completion': 'Carrier phrase to complete',
  Choice:                'Forced-choice alternatives',
  Other:                 'Custom — type below',
};

export interface TrialEntry {
  trialNumber: number;    // 1-based, within this step
  stepIndex: number;      // which session step (0-based)
  stepTitle: string;
  correct: boolean;
  cueLevel: CueLevel;
  cueNote?: string;       // free-text label when cueLevel === 'Other'
  timestamp: string;      // ISO string
}

export interface StepSummary {
  stepIndex: number;
  stepTitle: string;
  totalTrials: number;
  correctTrials: number;
  accuracy: number;                      // 0–100
  dominantCueLevel: CueLevel | null;
  cueBreakdown: Partial<Record<CueLevel, number>>;
}

export interface SessionDataRecord {
  id: string;
  patientLabel: string;
  savedPlanId: string;        // links to SavedPlan.id
  articleId: string;
  sessionTitle: string;
  date: string;               // ISO date string
  trials: TrialEntry[];
  stepSummaries: StepSummary[];
  totalTrials: number;
  overallAccuracy: number;    // 0–100
}

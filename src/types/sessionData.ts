// ─── Session Data Types ───────────────────────────────────────────────────────
// All data is PHI-free — patient labels only, no names or identifiers.

export type CueLevel =
  // ── Extreme/standalone levels ──
  | 'Independent'
  | 'Dependent'
  // ── Verbal hierarchy (least → most supportive) ──
  | 'Min Verbal'
  | 'Mod Verbal'
  | 'Max Verbal'
  | 'Direct Model'
  // ── Physical cues ──
  | 'Gestural'
  | 'Tactile'
  // ── Custom ──
  | 'Other';

// Display order — verbal hierarchy first, physical cues, then Other
export const CUE_ALL: CueLevel[] = [
  'Independent',
  'Dependent',
  'Min Verbal',
  'Mod Verbal',
  'Max Verbal',
  'Direct Model',
  'Gestural',
  'Tactile',
  'Other',
];

export const CUE_LABELS: Record<CueLevel, string> = {
  'Independent':   'Independent',
  'Dependent':     'Dependent',
  'Min Verbal':    'Min Verbal',
  'Mod Verbal':    'Mod Verbal',
  'Max Verbal':    'Max Verbal',
  'Direct Model':  'Direct Model',
  'Gestural':      'Gestural',
  'Tactile':       'Tactile',
  'Other':         'Other…',
};

export const CUE_DESCRIPTIONS: Record<CueLevel, string> = {
  'Independent':   'No cue needed',
  'Dependent':     'Full physical assistance required',
  'Min Verbal':    'Light hint or general direction',
  'Mod Verbal':    'Semantic, category, or description cue',
  'Max Verbal':    'Phonemic, sentence completion, or strong verbal prompt',
  'Direct Model':  'Clinician provided the answer',
  'Gestural':      'Point, sign, or visual gesture',
  'Tactile':       'Physical touch or hand-over-hand assist',
  'Other':         'Custom — type below',
};

export interface TrialEntry {
  trialNumber: number;    // 1-based, within this step
  stepIndex: number;      // which session step (0-based)
  stepTitle: string;
  correct: boolean;
  cueLevel: CueLevel;     // primary (most supportive) cue — used for summaries & backward compat
  cueLevels?: CueLevel[]; // all cues used simultaneously (multi-cue support)
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

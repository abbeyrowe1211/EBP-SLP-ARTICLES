// ─── Claude API Service ───────────────────────────────────────────────────────
// Calls the Anthropic API directly from the app using fetch.
// API key is read from the EXPO_PUBLIC_ANTHROPIC_API_KEY environment variable.
// To set your key: add it to the .env file in the project root.

import { type Article } from '@/data/articles';

export interface SessionParams {
  sessionLength: string;       // e.g. "45 min"
  severity: string;            // "Mild" | "Moderate" | "Severe"
  setting: string;             // "Acute" | "IPR" | "SNF" | "Home health" | "Outpatient"
  functionalGoal: string;      // selected goal string
  timePostOnset: string;       // "Acute (<1 mo)" | "Subacute (1–6 mo)" | "Chronic (>6 mo)"
  materials: string[];         // e.g. ["Whiteboard", "Picture cards"]
}

export interface SessionStep {
  number: number;
  title: string;
  duration: string;
  instructions: string;
  whyNote: string;
}

export interface GeneratedPlan {
  sessionTitle: string;
  totalDuration: string;
  protocolFidelityNote: string;
  steps: SessionStep[];
  cueingHierarchy: string;
  homeProgram: string;
  clinicianNotes: string;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

// ─── Foundation Principles ────────────────────────────────────────────────────
// These principles (Maas et al. 2008; Kleim & Jones, 2008) are injected into
// every session plan regardless of the selected article. They represent the
// non-negotiable underpinning of all evidence-based SLP treatment.
const FOUNDATION_PRINCIPLES = `
MANDATORY FOUNDATION PRINCIPLES (apply to ALL session plans regardless of protocol):

Motor Learning Principles (Maas et al., 2008 — AJSLP):
- Practice variability: within any drill or exercise block, vary the target, context, or position — do not have the client repeat the exact same item in the exact same way more than 3 times consecutively.
- Feedback fading: begin with more frequent feedback (every trial), then systematically reduce to every 3rd–5th response as accuracy improves within the session. Never correct every single error in the final block.
- Schedule of practice: use a mix of blocked practice (same target, massed) for initial acquisition, then shift to random or interleaved practice (varied targets) for retention and generalization.
- Feedback type: use Knowledge of Performance (KP — how the movement felt/looked) alongside Knowledge of Results (KR — correct/incorrect) where appropriate to the task.

Experience-Dependent Neural Plasticity Principles (Kleim & Jones, 2008 — JSLHR):
- Repetition matters: every step should specify a target trial count or repetition volume. Underdosed practice does not drive neural change.
- Intensity matters: sessions should be maximally active — minimize clinician talking time, maximize client response time.
- Specificity: practice tasks must directly resemble the functional goal target — do not use decontextualized drills as the only activity if a more ecologically valid version of the task exists.
- Salience: tasks should be meaningful to the client. Frame exercises in terms of real-world communicative or functional relevance.
- Time matters: note the time post-onset in cueing and expectation-setting — subacute clients may respond faster; chronic clients need more repetitions for equivalent plasticity.

These principles should be reflected in HOW steps are designed (trial counts, feedback schedules, practice variability) and in the whyNote fields — not added as a separate step or disclaimer.
`.trim();

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_API_KEY = 'ebp_slp_api_key_v1';

async function getApiKey(): Promise<string | null> {
  // Prefer the key saved in Profile; fall back to .env
  try {
    const stored = await AsyncStorage.getItem(KEY_API_KEY);
    if (stored && stored.startsWith('sk-ant-')) return stored;
  } catch { /* ignore */ }
  return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? null;
}

export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return !!key && key.length > 10 && key.startsWith('sk-ant-');
}

function buildPrompt(article: Article, params: SessionParams): string {
  const materialsStr =
    params.materials.length > 0 ? params.materials.join(', ') : 'none specified';

  return `You are generating a clinical session plan for a medical speech-language pathologist.

${FOUNDATION_PRINCIPLES}

---

TREATMENT PROTOCOL (the selected article for this session):
Title: ${article.title}
Authors: ${article.authors} (${article.year})
Evidence level: ${article.evidenceLevel}
Clinical areas: ${article.areas.join(', ')}

Protocol description:
${article.clinicalApplication}

Research findings to stay faithful to:
${article.researchFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

PATIENT PARAMETERS (no PHI — clinical descriptors only):
- Session length: ${params.sessionLength}
- Severity: ${params.severity}
- Setting: ${params.setting}
- Time post-onset: ${params.timePostOnset}
- Functional goal target: ${params.functionalGoal}
- Materials available: ${materialsStr}

Generate a structured session plan adapted to these parameters. The plan must:
1. Be faithful to the protocol above — do not invent clinical steps not described in the evidence
2. Allocate time across steps so they sum to the session length
3. Adapt complexity and cueing to the stated severity
4. Use only the listed materials
5. Include a functional carryover step tied to the stated goal
6. Include a brief home program recommendation
7. Reflect motor learning principles in every drill step: specify trial counts, note when feedback should be faded, and include at least one variable practice element
8. Reflect neural plasticity principles: every step must have a trial count or time target; minimize clinician monologue; tasks should be as functionally relevant as possible

IMPORTANT: Return ONLY valid JSON with no additional text, markdown, or explanation. Use this exact structure:
{
  "sessionTitle": "short title for this session",
  "totalDuration": "${params.sessionLength}",
  "protocolFidelityNote": "one sentence noting which protocol this adapts and how",
  "steps": [
    {
      "number": 1,
      "title": "step title",
      "duration": "X min",
      "instructions": "clear clinician-facing instructions for this step",
      "whyNote": "brief evidence rationale for this step"
    }
  ],
  "cueingHierarchy": "describe the cueing hierarchy to use across all steps",
  "homeProgram": "brief home practice recommendation",
  "clinicianNotes": "any additional clinical notes specific to these patient parameters"
}`;
}

export async function generateSessionPlan(
  article: Article,
  params: SessionParams
): Promise<GeneratedPlan> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const prompt = buildPrompt(article, params);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: 'You are a clinical session plan generator. You output ONLY valid JSON — no prose, no markdown, no code fences, no explanation before or after. Your entire response must be a single parseable JSON object.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Claude API error:', response.status, errorBody);
    throw new Error(`API_ERROR:${response.status}`);
  }

  const data = await response.json();
  const rawText: string = data?.content?.[0]?.text ?? '';

  // Extract JSON robustly: grab from first { to last }
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  const extracted = firstBrace !== -1 && lastBrace > firstBrace
    ? rawText.slice(firstBrace, lastBrace + 1)
    : rawText.trim();

  try {
    const plan: GeneratedPlan = JSON.parse(extracted);
    return plan;
  } catch {
    console.error('Failed to parse plan JSON:', extracted);
    throw new Error('PARSE_ERROR');
  }
}

// ─── Documentation phrase generator ──────────────────────────────────────────

export interface DocPhraseInput {
  sessionTitle: string;           // e.g. "SFA - Word Retrieval · Moderate"
  totalTrials: number;
  overallAccuracy: number;        // 0–100
  stepSummaries: Array<{
    stepTitle: string;
    totalTrials: number;
    correctTrials: number;
    accuracy: number;
    dominantCueLevel: string | null;
  }>;
}

export async function generateDocPhrase(input: DocPhraseInput): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');

  const stepLines = input.stepSummaries
    .filter((s) => s.totalTrials > 0)
    .map((s) =>
      `- ${s.stepTitle}: ${s.accuracy}% accuracy (${s.correctTrials}/${s.totalTrials} trials)${s.dominantCueLevel ? `, dominant cue: ${s.dominantCueLevel}` : ''}`
    )
    .join('\n');

  const prompt = `You are writing a brief clinical documentation note for a speech-language pathologist to paste into their EMR.

Session data:
- Treatment approach: ${input.sessionTitle}
- Overall accuracy: ${input.overallAccuracy}% across ${input.totalTrials} total trials
- Step breakdown:
${stepLines}

Write exactly 3 sentences in this structure:
1. "Patient completed [treatment approach] targeting [what was targeted] across [X] trials."
2. "Patient achieved [X]% accuracy [describe cueing level and any notable patterns from the data]."
3. "[Clinical interpretation of what the results mean] [Recommendation for next steps or continued approach]."

Rules:
- Use "patient" not "the patient" or any name
- Be specific — use the actual numbers
- Clinical but plain language — no jargon beyond standard SLP terminology
- Do not cite any research articles
- Return only the 3 sentences, no labels, no formatting`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      system: 'You are a clinical documentation assistant for speech-language pathologists. You write concise, accurate, professional documentation phrases based on session data.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`API_ERROR:${response.status}`);

  const data = await response.json();
  return (data?.content?.[0]?.text ?? '').trim();
}

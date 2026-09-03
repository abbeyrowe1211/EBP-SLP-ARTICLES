// ─── Claude API Service ───────────────────────────────────────────────────────
// Calls the EBP SLP proxy server, which forwards to Anthropic.
// No API key is needed in the app — the key lives on the server.

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

// ⚠️  After deploying to Netlify, replace this with your actual Netlify URL.
//     e.g. 'https://ebp-slp-proxy.netlify.app/.netlify/functions/claude'
const PROXY_URL = 'https://curious-macaron-9d259c.netlify.app/.netlify/functions/claude';
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

// No API key needed in the app — always available via proxy
export async function hasApiKey(): Promise<boolean> {
  return true;
}

function buildPrompt(article: Article, params: SessionParams): string {
  const materialsStr =
    params.materials.length > 0 ? params.materials.join(', ') : 'none specified';

  // Estimate number of steps based on session length
  const sessionMinutes = parseInt(params.sessionLength) || 45;
  const targetSteps = sessionMinutes <= 30 ? 3 : sessionMinutes <= 45 ? 4 : sessionMinutes <= 60 ? 5 : 6;

  return `You are generating a clinical session plan for a medical speech-language pathologist.

${FOUNDATION_PRINCIPLES}

---

TREATMENT PROTOCOL:
Title: ${article.title}
Authors: ${article.authors} (${article.year})
Evidence level: ${article.evidenceLevel}
Clinical areas: ${article.areas.join(', ')}

Protocol description:
${article.clinicalApplication}

Research findings:
${article.researchFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

PATIENT PARAMETERS:
- Session length: ${params.sessionLength} (generate exactly ${targetSteps} steps that sum to this duration)
- Severity: ${params.severity}
- Setting: ${params.setting}
- Time post-onset: ${params.timePostOnset}
- Functional goal target: ${params.functionalGoal}
- Materials available: ${materialsStr}

INSTRUCTIONS:
1. Stay faithful to the protocol — only use clinical techniques described in the evidence above
2. If the functional goal does not perfectly match the protocol, adapt the goal to fit within the protocol's scope rather than inventing techniques outside the evidence
3. Steps must sum exactly to ${params.sessionLength} — assign minutes to each step adding up to ${sessionMinutes} total
4. Adapt cueing density and complexity to ${params.severity} severity
5. Use ONLY the listed materials
6. Final step must be a functional carryover activity tied to the goal
7. Every drill step must specify trial count and feedback schedule (motor learning principles)

CRITICAL: Your entire response must be ONLY the JSON object below — no other text, no markdown, no code fences.

{
  "sessionTitle": "3-6 word title describing this specific session",
  "totalDuration": "${params.sessionLength}",
  "protocolFidelityNote": "One sentence: which protocol, how adapted",
  "steps": [
    {
      "number": 1,
      "title": "Step title",
      "duration": "X min",
      "instructions": "Clinician-facing instructions. Include trial counts and feedback schedule.",
      "whyNote": "One sentence evidence rationale"
    }
  ],
  "cueingHierarchy": "Cueing sequence to use across all steps for ${params.severity} severity",
  "homeProgram": "1-2 sentence home practice recommendation",
  "clinicianNotes": "Clinical notes specific to ${params.severity} severity, ${params.setting} setting, ${params.timePostOnset}"
}`;
}

// ─── Plan validation & normalization ─────────────────────────────────────────
// Ensures every field exists even if Claude returned a partial response.
function normalizePlan(raw: Partial<GeneratedPlan>, params: SessionParams): GeneratedPlan {
  const steps: SessionStep[] = Array.isArray(raw.steps)
    ? raw.steps.map((s: Partial<SessionStep>, i: number) => ({
        number: typeof s.number === 'number' ? s.number : i + 1,
        title: s.title ?? `Step ${i + 1}`,
        duration: s.duration ?? '',
        instructions: s.instructions ?? '',
        whyNote: s.whyNote ?? '',
      }))
    : [];

  return {
    sessionTitle: raw.sessionTitle ?? 'Session Plan',
    totalDuration: raw.totalDuration ?? params.sessionLength,
    protocolFidelityNote: raw.protocolFidelityNote ?? '',
    steps,
    cueingHierarchy: raw.cueingHierarchy ?? '',
    homeProgram: raw.homeProgram ?? '',
    clinicianNotes: raw.clinicianNotes ?? '',
  };
}

function extractJson(rawText: string): string {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return rawText.slice(firstBrace, lastBrace + 1);
  }
  return rawText.trim();
}

async function callClaude(prompt: string): Promise<string> {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      system: 'You are a clinical session plan generator for speech-language pathologists. You output ONLY valid JSON — no prose, no markdown, no code fences, no explanation. Your entire response must be a single parseable JSON object matching the schema provided.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Claude API error:', response.status, errorBody);
    throw new Error(`API_ERROR:${response.status}`);
  }

  const data = await response.json();
  return data?.content?.[0]?.text ?? '';
}

export async function generateSessionPlan(
  article: Article,
  params: SessionParams
): Promise<GeneratedPlan> {
  const prompt = buildPrompt(article, params);

  // Try up to 2 times before giving up
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rawText = await callClaude(prompt);
      const extracted = extractJson(rawText);
      const parsed: Partial<GeneratedPlan> = JSON.parse(extracted);
      const plan = normalizePlan(parsed, params);

      // Require at least one step — if empty, retry
      if (plan.steps.length === 0) {
        throw new Error('EMPTY_STEPS');
      }

      return plan;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('UNKNOWN');
      if (lastError.message.startsWith('API_ERROR')) break; // don't retry network errors
      console.warn(`Session plan attempt ${attempt} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error('PARSE_ERROR');
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

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

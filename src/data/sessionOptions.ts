import { type AshaArea } from './articles';

export const SESSION_LENGTHS = ['30 min', '45 min', '60 min', '90 min'];
export const SEVERITIES = ['Mild', 'Moderate', 'Severe'];
export const SETTINGS = ['Acute', 'IPR', 'SNF', 'Home health', 'Outpatient'];
export const TIME_POST_ONSET = ['Acute (<1 mo)', 'Subacute (1–6 mo)', 'Chronic (>6 mo)'];
export const MATERIALS = [
  'Whiteboard',
  'Picture cards',
  'iPad/tablet',
  'Worksheets',
  'Communication book',
  'Mirror',
  'Audio recorder',
];

// Goal options scoped to each ASHA area
export const GOALS_BY_AREA: Record<AshaArea, string[]> = {
  Language: [
    'Conversational verb retrieval — daily routines',
    'Conversational verb retrieval — community contexts',
    'Sentence-level production for ordering / requesting',
    'Sentence-level production for narrative recall',
    'Discourse-level connected speech',
    'Word retrieval for functional nouns',
    'Reading comprehension for daily materials',
    'Family-facing communication tasks',
  ],
  'Motor Speech': [
    'Functional phrase production in structured contexts',
    'Conversational intelligibility in quiet environments',
    'Intelligibility during daily routine communication',
    'Self-monitoring of speech accuracy',
    'Carryover of target sounds to conversation',
    'Prosody and rate for natural-sounding speech',
  ],
  'Voice & Resonance': [
    'Voice quality for professional / work contexts',
    'Vocal endurance for extended conversation',
    'Reducing vocal hyperfunction behaviors',
    'Voice use during daily communication tasks',
    'Resonance balance for functional communication',
    'Post-surgical voice restoration',
  ],
  Swallowing: [
    'Safe oral intake of regular diet with modified technique',
    'Transition from modified to regular diet texture',
    'Laryngeal elevation and airway protection',
    'Caregiver / patient education on safe swallowing',
    'Reduced aspiration risk during meals',
    'Improved swallowing efficiency for adequate nutrition',
  ],
  'Cognitive-Communication': [
    'Memory strategy use in daily activities',
    'Executive function support for work / school tasks',
    'Social communication in familiar contexts',
    'Organized verbal expression in structured tasks',
    'Attention and concentration for functional tasks',
    'Problem-solving for daily living activities',
  ],
  AAC: [
    'Core vocabulary access for daily communication',
    'AAC use for wants and needs in familiar settings',
    'Multi-modal communication across partners',
    'Aided language stimulation with communication partner',
    'AAC use for novel utterances in community settings',
    'Communication partner training for AAC support',
  ],
  Fluency: [
    'Fluency-enhancing techniques in structured conversation',
    'Voluntary stuttering for desensitization',
    'Speech naturalness with fluency techniques',
    'Stuttering modification in conversation',
    'Self-advocacy and disclosure in social settings',
  ],
};

export function getGoalsForAreas(areas: AshaArea[]): string[] {
  const primaryArea = areas[0];
  return GOALS_BY_AREA[primaryArea] ?? GOALS_BY_AREA['Language'];
}

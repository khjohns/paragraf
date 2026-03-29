/**
 * Mockdata for porteføljeoversikten (hybrid-v3).
 * Realistisk norsk anskaffelsesrett — hardkodet, ingen backend.
 */

export type Phase = 'oppsett' | 'primaersok' | 'screening' | 'ettersok' | 'sammenstilling';

export interface MockAnalysis {
  id: string;
  title: string;
  problem: string;
  phase: Phase;
  owner: string;
  provisions: string[];
  overlapWith: string | null;
  lastActive: boolean;
  lastAction?: string;
  perspective?: string;
  newEvents: number;
  tag: string;
  teamOnly?: boolean;
}

export const PHASE_COLORS: Record<Phase, string> = {
  oppsett: '#A8A29E',
  primaersok: '#64748B',
  screening: '#B45309',
  ettersok: '#CA8A04',
  sammenstilling: '#059669',
};

export const PHASE_NAMES: Record<Phase, string> = {
  oppsett: 'Oppsett',
  primaersok: 'Primaersok',
  screening: 'Screening',
  ettersok: 'Ettersok',
  sammenstilling: 'Sammenstilling',
};

export const TOTAL_PHASES = Object.keys(PHASE_NAMES).length;

export const AVAILABLE_TAGS = [
  'Kvalifikasjonskrav & Avvisning',
  'Tilbudsevaluering & Avvik',
  'Rammeavtaler & Minikonkurranser',
];

export const MOCK_ANALYSES: MockAnalysis[] = [
  {
    id: 'a1',
    title: 'Avvisning pa grunn av manglende skatteattest',
    problem:
      'Hvor absolutt er kravet til innlevering av skatteattest i apen anbudskonkurranse, og i hvilken grad tillater rettspraksis ettersending av dokumentasjon som forela for tilbudsfristen?',
    phase: 'screening',
    owner: 'Meg',
    provisions: ['FOA \u00a716-10', 'FOA \u00a724-2'],
    overlapWith: 'FOA \u00a716-10',
    lastActive: true,
    lastAction: 'Leste KOFA-2023-145',
    perspective: 'Saksoversikten',
    newEvents: 2,
    tag: 'Kvalifikasjonskrav & Avvisning',
  },
  {
    id: 'a4',
    title: 'Dokumentasjonsplikt vs. ettersending',
    problem:
      'Oppdragsgivers plikt og rett til a be om ettersending av manglende dokumentasjon for kvalifikasjonskrav.',
    phase: 'ettersok',
    owner: 'Erik',
    provisions: ['FOA \u00a716-10', 'FOA \u00a724-8(2)'],
    overlapWith: 'FOA \u00a716-10',
    lastActive: false,
    teamOnly: true,
    perspective: 'Rettssetningsregisteret',
    newEvents: 0,
    tag: 'Kvalifikasjonskrav & Avvisning',
  },
  {
    id: 'a2',
    title: 'Bruk av forhandlinger i apen anbudskonkurranse',
    problem:
      'Nar gar en avklaring over til a bli en ulovlig forhandling? Grensedragningen mellom tillatt presisering og ulovlig endring av tilbud.',
    phase: 'primaersok',
    owner: 'Meg',
    provisions: ['FOA \u00a723-1'],
    overlapWith: null,
    lastActive: false,
    perspective: 'Saksoversikten',
    newEvents: 0,
    tag: 'Tilbudsevaluering & Avvik',
  },
  {
    id: 'a3',
    title: 'Vesentlige avvik i tilbud',
    problem:
      'Identifisering og handtering av forbehold som utgjor et vesentlig avvik fra kravspesifikasjonen.',
    phase: 'sammenstilling',
    owner: 'Meg',
    provisions: ['FOA \u00a724-8(1)', 'FOA \u00a716-10'],
    overlapWith: 'FOA \u00a716-10',
    lastActive: false,
    perspective: 'Notatet',
    newEvents: 1,
    tag: 'Tilbudsevaluering & Avvik',
  },
  {
    id: 'a5',
    title: 'Gjenapning av vilkar i minikonkurranse',
    problem:
      'I hvilken grad kan oppdragsgiver gjenapne konkurransen om vilkar som allerede er fastsatt i rammeavtalen?',
    phase: 'oppsett',
    owner: 'Meg',
    provisions: ['FOA \u00a726-4'],
    overlapWith: null,
    lastActive: false,
    perspective: 'Problemstillingen',
    newEvents: 0,
    tag: 'Rammeavtaler & Minikonkurranser',
  },
];

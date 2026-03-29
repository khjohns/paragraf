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
  primaersok: 'Primærsøk',
  screening: 'Screening',
  ettersok: 'Ettersøk',
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
    title: 'Avvisning på grunn av manglende skatteattest',
    problem:
      'Hvor absolutt er kravet til innlevering av skatteattest i åpen anbudskonkurranse, og i hvilken grad tillater rettspraksis ettersending av dokumentasjon som forelå før tilbudsfristen?',
    phase: 'screening',
    owner: 'Meg',
    provisions: ['FOA §16-10', 'FOA §24-2'],
    overlapWith: 'FOA §16-10',
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
      'Oppdragsgivers plikt og rett til å be om ettersending av manglende dokumentasjon for kvalifikasjonskrav.',
    phase: 'ettersok',
    owner: 'Erik',
    provisions: ['FOA §16-10', 'FOA §24-8(2)'],
    overlapWith: 'FOA §16-10',
    lastActive: false,
    teamOnly: true,
    perspective: 'Rettssetningsregisteret',
    newEvents: 0,
    tag: 'Kvalifikasjonskrav & Avvisning',
  },
  {
    id: 'a2',
    title: 'Bruk av forhandlinger i åpen anbudskonkurranse',
    problem:
      'Når går en avklaring over til å bli en ulovlig forhandling? Grensedragningen mellom tillatt presisering og ulovlig endring av tilbud.',
    phase: 'primaersok',
    owner: 'Meg',
    provisions: ['FOA §23-1'],
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
      'Identifisering og håndtering av forbehold som utgjør et vesentlig avvik fra kravspesifikasjonen.',
    phase: 'sammenstilling',
    owner: 'Meg',
    provisions: ['FOA §24-8(1)', 'FOA §16-10'],
    overlapWith: 'FOA §16-10',
    lastActive: false,
    perspective: 'Notatet',
    newEvents: 1,
    tag: 'Tilbudsevaluering & Avvik',
  },
  {
    id: 'a5',
    title: 'Gjenåpning av vilkår i minikonkurranse',
    problem:
      'I hvilken grad kan oppdragsgiver gjenåpne konkurransen om vilkår som allerede er fastsatt i rammeavtalen?',
    phase: 'oppsett',
    owner: 'Meg',
    provisions: ['FOA §26-4'],
    overlapWith: null,
    lastActive: false,
    perspective: 'Problemstillingen',
    newEvents: 0,
    tag: 'Rammeavtaler & Minikonkurranser',
  },
];

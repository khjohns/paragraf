/**
 * Mockdata for analysesiden (scope + arbeidsregister + lesepanel).
 * Hardkodet — ingen backend.
 */

export type SignalType = 'R' | 'F' | 'V';

export interface MockSignal {
  type: SignalType;
  detail: string;
}

export type MockCategory = 'A' | 'B' | 'C' | null;

export type VectorStrength = 'nært' | 'beslektet' | 'perifert';

export interface MockCandidate {
  id: string;
  ref: string;
  outcome: string | null;
  category: MockCategory;
  read_at: string | null;
  iteration: number;
  discovery_rank: number;
  signals: MockSignal[];
  ai_screening: {
    category: MockCategory;
    proposition: string;
  } | null;
}

export interface MockScopeData {
  mainQuestion: string;
  refinedProblem: string;
  aiExplanation: string;
  subProblems: { id: number; text: string }[];
  context: Record<string, string>;
  strategy: {
    provisions: string[];
    suggestedProvisions: string[];
    ftsTerms: string[];
    vectorQuery: string;
    cases: string[];
  };
  crossCoverage: { label: string }[];
}

export const MOCK_SCOPE: MockScopeData = {
  mainQuestion:
    'Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11?',
  refinedProblem:
    'Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, og i hvilken grad tillater rettspraksis at slike krav først oppfylles etter tilbudsfristens utløp?',
  aiExplanation:
    'Problemstillingen dreier seg primært om FOA § 16-11 som direkte regulerer leverandørgrupperinger. § 16-10 er sentral fordi støtte på andre virksomheters kapasitet er et alternativ. Søkestrategien kombinerer presise bestemmelsesreferanser med semantiske søk.',
  subProblems: [
    { id: 1, text: 'Krav om solidaransvar og når dette inntrer' },
    { id: 2, text: 'Tidspunkt for krav om formalisert samarbeidsavtale' },
    { id: 3, text: 'Konsekvenser for evaluering av tilbudet (samlet kapasitet)' },
  ],
  context: {
    procedure: 'Åpen anbudskonkurranse',
    threshold: 'Nasjonale terskelverdier (Del II)',
  },
  strategy: {
    provisions: ['FOA §16-11', 'FOA §16-10', 'FOA §19-2'],
    suggestedProvisions: ['KNFR §6', 'FOA §5-1'],
    ftsTerms: ['«konsortium»', '«leverandørgruppering»', '«solidaransvar»'],
    vectorQuery: 'krav til leverandørgrupperinger og konsortier i konkurransegrunnlaget',
    cases: ['KOFA-2023-145'],
  },
  crossCoverage: [{ label: '§16-11 ∩ §16-10' }, { label: '§16-11 ∩ §19-2' }],
};

export const MOCK_CANDIDATES: MockCandidate[] = [
  {
    id: 'c1',
    ref: 'KOFA-2022-1200',
    outcome: 'Brudd',
    category: 'A',
    read_at: '2026-03-27T10:14:00Z',
    iteration: 1,
    discovery_rank: 3,
    signals: [
      { type: 'R', detail: 'FOA §16-11' },
      { type: 'F', detail: '«solidaransvar»' },
      { type: 'V', detail: 'Nært' },
    ],
    ai_screening: {
      category: 'A',
      proposition:
        'Fastslår at solidaransvar forutsettes ved deltakelse som leverandørgruppering, og at samarbeidsavtale må foreligge før kontraktsignering.',
    },
  },
  {
    id: 'c2',
    ref: 'HR-2019-1801-A',
    outcome: null,
    category: null,
    read_at: null,
    iteration: 1,
    discovery_rank: 2,
    signals: [
      { type: 'F', detail: '«konsortium»' },
      { type: 'V', detail: 'Beslektet' },
    ],
    ai_screening: {
      category: 'A',
      proposition:
        'Høyesterett vurderer selskapsrettslig status for konsortier opprettet kun for én anbudskonkurranse.',
    },
  },
  {
    id: 'c3',
    ref: 'KOFA-2020-55',
    outcome: 'Ikke brudd',
    category: 'B',
    read_at: '2026-03-27T12:05:00Z',
    iteration: 2,
    discovery_rank: 1,
    signals: [{ type: 'R', detail: 'FOA §16-10' }],
    ai_screening: {
      category: 'B',
      proposition:
        'Trekker grensen mellom støtte på kapasitet (§16-10) og underleverandører i gjennomføringsfasen.',
    },
  },
  {
    id: 'c4',
    ref: 'KOFA-2021-893',
    outcome: 'Ikke brudd',
    category: 'C',
    read_at: null,
    iteration: 1,
    discovery_rank: 1,
    signals: [{ type: 'R', detail: 'FOA §19-2' }],
    ai_screening: {
      category: 'C',
      proposition:
        'Fokuserer utelukkende på bytte av underleverandør etter kontraktsinngåelse, ikke etablering av grupperinger.',
    },
  },
  {
    id: 'c5',
    ref: 'KOFA-2023-145',
    outcome: 'Brudd',
    category: 'A',
    read_at: '2026-03-28T14:20:00Z',
    iteration: 1,
    discovery_rank: 2,
    signals: [
      { type: 'R', detail: 'FOA §16-11' },
      { type: 'F', detail: '«leverandørgruppering»' },
    ],
    ai_screening: {
      category: 'A',
      proposition:
        'Klagenemnda presiserer at avvisning av gruppering uten solidaransvar krever at kravet fremgår av konkurransegrunnlaget.',
    },
  },
  {
    id: 'c6',
    ref: 'C-396/14 (MT Højgaard)',
    outcome: null,
    category: null,
    read_at: null,
    iteration: 2,
    discovery_rank: 1,
    signals: [{ type: 'V', detail: 'Beslektet' }],
    ai_screening: {
      category: 'B',
      proposition:
        'EU-domstolen om proporsjonalitet ved krav til økonomisk kapasitet for grupperinger.',
    },
  },
];

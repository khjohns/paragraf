/**
 * Mockdata for analysesiden (scope + arbeidsregister + lesepanel).
 * Hardkodet — ingen backend.
 */

export type SignalType = 'R' | 'F' | 'V';
export type MockCategory = 'A' | 'B' | 'C' | null;

export interface MockSignal {
  type: SignalType;
  detail: string;
  explanation?: string;
}

export interface ExcerptPart {
  text: string;
  mark: SignalType | null;
}

export interface MockCandidate {
  id: string;
  ref: string;
  source: string;
  date: string;
  category: MockCategory;
  read_at: string | null;
  signals: MockSignal[];
  ai_screening: {
    category: MockCategory;
    proposition: string;
  } | null;
  excerpt: ExcerptPart[];
}

export interface MockProvision {
  ref: string;
  label: string;
  primary: boolean;
  reason: string;
}

export interface MockScopeData {
  originalProblem: string;
  refinedProblem: string;
  subProblems: { id: number; text: string; active: boolean }[];
  context: {
    procedure: string;
    service_area: string;
    market: string | null;
    threshold: string;
  };
  provisions: MockProvision[];
  searchStrategy: {
    refTable: string[];
    fts: string[];
    vector: string[];
    prepWork: string[];
  };
  reasoning: string;
}

export const MOCK_COUNTS = { null: 53, A: 5, B: 8, C: 35, total: 101 };

export const MOCK_SCOPE: MockScopeData = {
  originalProblem:
    'Vi skal anskaffe FDVU-system og lurer pa hva vi ma tenke pa mht leverandorgrupperinger og konsortier i konkurransegrunnlaget',
  refinedProblem:
    'Hvilke krav bor konkurransegrunnlaget stille til leverandorgrupperinger og konsortier, jf. FOA \u00a7 16-11, og finnes det leverandorkonstellasjoner som krever saerskilt regulering?',
  subProblems: [
    { id: 1, text: 'Krav om solidaransvar og nar dette inntrer', active: true },
    { id: 2, text: 'Tidspunkt for krav om formalisert samarbeidsavtale', active: true },
    {
      id: 3,
      text: 'Grensen mellom stotte pa kapasitet (\u00a716-10) og konsortiedeltakelse (\u00a716-11)',
      active: true,
    },
  ],
  context: {
    procedure: 'Konkurransepreget dialog',
    service_area: 'FDVU-system / IKT',
    market: null,
    threshold: 'EOS',
  },
  provisions: [
    {
      ref: 'FOA \u00a716-11',
      label: 'Leverandorgrupperinger',
      primary: true,
      reason: 'Direkte regulerer krav til konsortier og fellesskap av leverandorer.',
    },
    {
      ref: 'FOA \u00a716-10',
      label: 'Stotte pa kapasitet',
      primary: true,
      reason: 'Alternativ til konsortiedannelse — grensedragningen er sentral.',
    },
    {
      ref: 'FOA \u00a719-2',
      label: 'Underleverandorer',
      primary: true,
      reason:
        'Regulerer underleverandorer i gjennomforingsfasen, relevant for konstellasjonsmodellene.',
    },
    {
      ref: 'FOA \u00a724-2',
      label: 'Avvisning kvalifikasjon',
      primary: false,
      reason: 'Konsekvens ved manglende oppfyllelse av krav til grupperingen.',
    },
    {
      ref: 'FOA \u00a75-1',
      label: 'Grunnleggende prinsipper',
      primary: false,
      reason: 'Rammeverk for forholdsmessighetsvurderingen.',
    },
    {
      ref: 'LOA \u00a74',
      label: 'Likebehandling',
      primary: false,
      reason: 'Overordnet prinsipp som begrenser handlingsrommet.',
    },
  ],
  searchStrategy: {
    refTable: ['FOA \u00a716-11', 'FOA \u00a716-10', 'FOA \u00a719-2'],
    fts: [
      '\u00abkonsortium\u00bb',
      '\u00absolidaransvar\u00bb',
      '\u00ableverandorgruppering\u00bb',
    ],
    vector: [
      'krav til leverandorgrupperinger og solidaransvar ved felles tilbud',
      'samarbeidsavtale mellom leverandorer i offentlig anskaffelse',
    ],
    prepWork: ['Prop. 51 L (2015\u20132016)'],
  },
  reasoning:
    'Problemstillingen dreier seg primaert om FOA \u00a7 16-11 som direkte regulerer leverandorgrupperinger/fellesskap. \u00a7 16-10 er sentral fordi stotte pa andre virksomheters kapasitet er et alternativ til konsortiedannelse — grensedragningen mellom disse to mekanismene er ofte avgjorende. \u00a7 19-2 regulerer underleverandorer i gjennomforingsfasen, noe som er relevant for de ulike konstellasjonsmodellene som er beskrevet. Sokestrategien kombinerer presise bestemmelsesreferanser med fulltekstsok pa sentrale begreper og semantiske sok for a fange opp saker som bruker annen terminologi.',
};

export const MOCK_CANDIDATES: MockCandidate[] = [
  {
    id: 'k1',
    ref: 'KOFA-2022-1200',
    source: 'Klagenemnda',
    date: '12. nov 2022',
    category: 'A',
    read_at: '2026-03-27T10:14:00Z',
    signals: [
      { type: 'R', detail: 'FOA \u00a716-11' },
      { type: 'F', detail: '\u00absolidaransvar\u00bb' },
      {
        type: 'V',
        detail: 'Naert treff',
        explanation: 'Konseptuelt treff pa: "felles hefte for forpliktelser"',
      },
    ],
    ai_screening: {
      category: 'A',
      proposition: 'Fastslar at solidaransvar forutsettes ved deltakelse som leverandorgruppering.',
    },
    excerpt: [
      { text: 'Nemnda bemerker at formalet med ', mark: null },
      { text: 'FOA \u00a7 16-11', mark: 'R' },
      {
        text: ' er a sikre at oppdragsgiver har en reell juridisk motpart som hefter for oppfyllelsen av kontrakten. Selv om leverandorene ikke hadde stiftet et eget selskap (',
        mark: null,
      },
      { text: 'konsortium', mark: 'F' },
      {
        text: '), innebar deres felles innlevering av tilbud at de matte anses som en leverandorgruppering. Det pahvilte dermed gruppen et ',
        mark: null,
      },
      { text: 'solidaransvar', mark: 'F' },
      {
        text: '. Oppdragsgiver hadde folgelig rett til a kreve en formalisert samarbeidsavtale fremlagt for kontraktsignering, for a sikre at ',
        mark: null,
      },
      { text: 'felles hefte for forpliktelser', mark: 'V' },
      { text: ' var avklart.', mark: null },
    ],
  },
  {
    id: 'k2',
    ref: 'HR-2019-1801-A',
    source: 'Hoyesterett',
    date: '04. feb 2019',
    category: null,
    read_at: null,
    signals: [
      { type: 'F', detail: '\u00abkonsortium\u00bb' },
      {
        type: 'V',
        detail: 'Beslektet',
        explanation: 'Konseptuelt treff pa: "selskapsrettslig status ved felles tilbud"',
      },
    ],
    ai_screening: {
      category: 'A',
      proposition:
        'Hoyesterett vurderer selskapsrettslig status for konsortier opprettet kun for en anbudskonkurranse.',
    },
    excerpt: [
      {
        text: 'Hoyesterett la til grunn at selskapsrettslig status for midlertidige ',
        mark: null,
      },
      { text: 'konsortier', mark: 'F' },
      {
        text: ' ma vurderes konkret. Et samarbeid for en enkeltstaaende anbudskonkurranse utgjor ikke nodvendigvis et selskap i ',
        mark: null,
      },
      { text: 'selskapslovens forstand', mark: 'V' },
      {
        text: ', men representerer like fullt et forpliktende fellesskap overfor oppdragsgiver.',
        mark: null,
      },
    ],
  },
  {
    id: 'k3',
    ref: 'KOFA-2020-55',
    source: 'Klagenemnda',
    date: '15. mar 2020',
    category: 'B',
    read_at: '2026-03-27T12:05:00Z',
    signals: [{ type: 'R', detail: 'FOA \u00a716-10' }],
    ai_screening: {
      category: 'B',
      proposition:
        'Trekker opp grensen mellom stotte pa kapasitet (\u00a716-10) og underleverandorer.',
    },
    excerpt: [
      {
        text: 'Saken gjaldt sporsmalet om valgte leverandor lovlig kunne stotte seg pa et morselskap for a oppfylle kravene til okonomisk kapasitet, jf. ',
        mark: null,
      },
      { text: 'FOA \u00a7 16-10', mark: 'R' },
      {
        text: '. Nemnda kom til at forpliktelseserklaeringen var tilstrekkelig.',
        mark: null,
      },
    ],
  },
  {
    id: 'k4',
    ref: 'C-396/14 (MT Hojgaard)',
    source: 'EU-domstolen',
    date: '24. mai 2016',
    category: 'A',
    read_at: null,
    signals: [
      {
        type: 'V',
        detail: 'Naert treff',
        explanation:
          'Konseptuelt treff pa: "sammenslutningers rett til a stotte seg pa medlemmers kapasitet"',
      },
    ],
    ai_screening: {
      category: 'A',
      proposition:
        'EU-domstolen bekrefter at en sammenslutning av foretak kan stotte seg pa kapasiteten til de enkelte medlemmene.',
    },
    excerpt: [
      {
        text: 'Domstolen fastslo at direktiv 2004/18 er til hinder for at en oppdragsgiver utelukker en ',
        mark: null,
      },
      { text: 'sammenslutning av foretak', mark: 'V' },
      {
        text: ' fra a delta, kun med den begrunnelse at sammenslutningen som sadan ikke har de nodvendige kvalifikasjonene, nar sammenslutningen godtgjor at den faktisk rader over ',
        mark: null,
      },
      { text: 'medlemmenes ressurser', mark: 'V' },
      { text: '.', mark: null },
    ],
  },
  {
    id: 'k5',
    ref: 'KOFA-2018-12',
    source: 'Klagenemnda',
    date: '10. jan 2018',
    category: 'C',
    read_at: '2026-03-26T14:20:00Z',
    signals: [
      { type: 'F', detail: '\u00absamarbeidsavtale\u00bb' },
      {
        type: 'V',
        detail: 'Perifert',
        explanation: 'Gjelder samarbeid, men ikke i anskaffelsesrettslig forstand.',
      },
    ],
    ai_screening: {
      category: 'C',
      proposition:
        'Omhandler en privatrettslig samarbeidsavtale som ikke er relevant for krav i konkurransegrunnlaget.',
    },
    excerpt: [
      {
        text: 'Saken avvist, da klagen i realiteten gjaldt en tvist om forstaelsen av en privatrettslig ',
        mark: null,
      },
      { text: 'samarbeidsavtale', mark: 'F' },
      {
        text: ' mellom to leverandorer, som faller utenfor nemndas kompetanse.',
        mark: null,
      },
    ],
  },
  {
    id: 'k6',
    ref: 'KOFA-2023-999',
    source: 'Klagenemnda',
    date: '02. sep 2023',
    category: null,
    read_at: null,
    signals: [
      { type: 'R', detail: 'FOA \u00a716-11' },
      {
        type: 'V',
        detail: 'Beslektet',
        explanation: 'Konseptuelt treff pa: "krav til underleverandorer ved felles tilbud"',
      },
    ],
    ai_screening: null,
    excerpt: [
      {
        text: 'Klagenemnda matte i denne saken ta stilling til om det var adgang til a kreve at samtlige medlemmer av en leverandorgruppering, jf. ',
        mark: null,
      },
      { text: 'FOA \u00a7 16-11', mark: 'R' },
      { text: ', skulle signere en likelydende egenerklearing.', mark: null },
    ],
  },
];

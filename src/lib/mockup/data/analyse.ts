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
    'Vi skal anskaffe FDVU-system og lurer på hva vi må tenke på mht leverandørgrupperinger og konsortier i konkurransegrunnlaget',
  refinedProblem:
    'Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11, og finnes det leverandørkonstellasjoner som krever særskilt regulering?',
  subProblems: [
    { id: 1, text: 'Krav om solidaransvar og når dette inntrer', active: true },
    { id: 2, text: 'Tidspunkt for krav om formalisert samarbeidsavtale', active: true },
    {
      id: 3,
      text: 'Grensen mellom støtte på kapasitet (§16-10) og konsortiedeltakelse (§16-11)',
      active: true,
    },
  ],
  context: {
    procedure: 'Konkurransepreget dialog',
    service_area: 'FDVU-system / IKT',
    market: null,
    threshold: 'EØS',
  },
  provisions: [
    {
      ref: 'FOA §16-11',
      label: 'Leverandørgrupperinger',
      primary: true,
      reason: 'Direkte regulerer krav til konsortier og fellesskap av leverandører.',
    },
    {
      ref: 'FOA §16-10',
      label: 'Støtte på kapasitet',
      primary: true,
      reason: 'Alternativ til konsortiedannelse — grensedragningen er sentral.',
    },
    {
      ref: 'FOA §19-2',
      label: 'Underleverandører',
      primary: true,
      reason:
        'Regulerer underleverandører i gjennomføringsfasen, relevant for konstellasjonsmodellene.',
    },
    {
      ref: 'FOA §24-2',
      label: 'Avvisning kvalifikasjon',
      primary: false,
      reason: 'Konsekvens ved manglende oppfyllelse av krav til grupperingen.',
    },
    {
      ref: 'FOA §5-1',
      label: 'Grunnleggende prinsipper',
      primary: false,
      reason: 'Rammeverk for forholdsmessighetsvurderingen.',
    },
    {
      ref: 'LOA §4',
      label: 'Likebehandling',
      primary: false,
      reason: 'Overordnet prinsipp som begrenser handlingsrommet.',
    },
  ],
  searchStrategy: {
    refTable: ['FOA §16-11', 'FOA §16-10', 'FOA §19-2'],
    fts: ['«konsortium»', '«solidaransvar»', '«leverandørgruppering»'],
    vector: [
      'krav til leverandørgrupperinger og solidaransvar ved felles tilbud',
      'samarbeidsavtale mellom leverandører i offentlig anskaffelse',
    ],
    prepWork: ['Prop. 51 L (2015–2016)'],
  },
  reasoning:
    'Problemstillingen dreier seg primært om FOA § 16-11 som direkte regulerer leverandørgrupperinger/fellesskap. § 16-10 er sentral fordi støtte på andre virksomheters kapasitet er et alternativ til konsortiedannelse — grensedragningen mellom disse to mekanismene er ofte avgjørende. § 19-2 regulerer underleverandører i gjennomføringsfasen, noe som er relevant for de ulike konstellasjonsmodellene som er beskrevet. Søkestrategien kombinerer presise bestemmelsesreferanser med fulltekstsøk på sentrale begreper og semantiske søk for å fange opp saker som bruker annen terminologi.',
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
      { type: 'R', detail: 'FOA §16-11' },
      { type: 'F', detail: '«solidaransvar»' },
      {
        type: 'V',
        detail: 'Nært treff',
        explanation: 'Konseptuelt treff på: "felles hefte for forpliktelser"',
      },
    ],
    ai_screening: {
      category: 'A',
      proposition: 'Fastslår at solidaransvar forutsettes ved deltakelse som leverandørgruppering.',
    },
    excerpt: [
      { text: 'Nemnda bemerker at formålet med ', mark: null },
      { text: 'FOA § 16-11', mark: 'R' },
      {
        text: ' er å sikre at oppdragsgiver har en reell juridisk motpart som hefter for oppfyllelsen av kontrakten. Selv om leverandørene ikke hadde stiftet et eget selskap (',
        mark: null,
      },
      { text: 'konsortium', mark: 'F' },
      {
        text: '), innebar deres felles innlevering av tilbud at de måtte anses som en leverandørgruppering. Det påhvilte dermed gruppen et ',
        mark: null,
      },
      { text: 'solidaransvar', mark: 'F' },
      {
        text: '. Oppdragsgiver hadde følgelig rett til å kreve en formalisert samarbeidsavtale fremlagt før kontraktsignering, for å sikre at ',
        mark: null,
      },
      { text: 'felles hefte for forpliktelser', mark: 'V' },
      { text: ' var avklart.', mark: null },
    ],
  },
  {
    id: 'k2',
    ref: 'HR-2019-1801-A',
    source: 'Høyesterett',
    date: '04. feb 2019',
    category: null,
    read_at: null,
    signals: [
      { type: 'F', detail: '«konsortium»' },
      {
        type: 'V',
        detail: 'Beslektet',
        explanation: 'Konseptuelt treff på: "selskapsrettslig status ved felles tilbud"',
      },
    ],
    ai_screening: {
      category: 'A',
      proposition:
        'Høyesterett vurderer selskapsrettslig status for konsortier opprettet kun for én anbudskonkurranse.',
    },
    excerpt: [
      {
        text: 'Høyesterett la til grunn at selskapsrettslig status for midlertidige ',
        mark: null,
      },
      { text: 'konsortier', mark: 'F' },
      {
        text: ' må vurderes konkret. Et samarbeid for én enkeltstående anbudskonkurranse utgjør ikke nødvendigvis et selskap i ',
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
    signals: [{ type: 'R', detail: 'FOA §16-10' }],
    ai_screening: {
      category: 'B',
      proposition: 'Trekker opp grensen mellom støtte på kapasitet (§16-10) og underleverandører.',
    },
    excerpt: [
      {
        text: 'Saken gjaldt spørsmålet om valgte leverandør lovlig kunne støtte seg på et morselskap for å oppfylle kravene til økonomisk kapasitet, jf. ',
        mark: null,
      },
      { text: 'FOA § 16-10', mark: 'R' },
      {
        text: '. Nemnda kom til at forpliktelseserklæringen var tilstrekkelig.',
        mark: null,
      },
    ],
  },
  {
    id: 'k4',
    ref: 'C-396/14 (MT Højgaard)',
    source: 'EU-domstolen',
    date: '24. mai 2016',
    category: 'A',
    read_at: null,
    signals: [
      {
        type: 'V',
        detail: 'Nært treff',
        explanation:
          'Konseptuelt treff på: "sammenslutningers rett til å støtte seg på medlemmers kapasitet"',
      },
    ],
    ai_screening: {
      category: 'A',
      proposition:
        'EU-domstolen bekrefter at en sammenslutning av foretak kan støtte seg på kapasiteten til de enkelte medlemmene.',
    },
    excerpt: [
      {
        text: 'Domstolen fastslo at direktiv 2004/18 er til hinder for at en oppdragsgiver utelukker en ',
        mark: null,
      },
      { text: 'sammenslutning av foretak', mark: 'V' },
      {
        text: ' fra å delta, kun med den begrunnelse at sammenslutningen som sådan ikke har de nødvendige kvalifikasjonene, når sammenslutningen godtgjør at den faktisk råder over ',
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
      { type: 'F', detail: '«samarbeidsavtale»' },
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
        text: 'Saken avvist, da klagen i realiteten gjaldt en tvist om forståelsen av en privatrettslig ',
        mark: null,
      },
      { text: 'samarbeidsavtale', mark: 'F' },
      {
        text: ' mellom to leverandører, som faller utenfor nemndas kompetanse.',
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
      { type: 'R', detail: 'FOA §16-11' },
      {
        type: 'V',
        detail: 'Beslektet',
        explanation: 'Konseptuelt treff på: "krav til underleverandører ved felles tilbud"',
      },
    ],
    ai_screening: null,
    excerpt: [
      {
        text: 'Klagenemnda måtte i denne saken ta stilling til om det var adgang til å kreve at samtlige medlemmer av en leverandørgruppering, jf. ',
        mark: null,
      },
      { text: 'FOA § 16-11', mark: 'R' },
      { text: ', skulle signere en likelydende egenerklæring.', mark: null },
    ],
  },
];

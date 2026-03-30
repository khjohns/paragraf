// Mock data for "Ny analyse" — scoping flow

export interface SubProblem {
  id: number;
  text: string;
}

export interface ContextData {
  procedure: string;
  threshold: string;
  service_area: string;
  market: string | null;
}

export interface Provision {
  ref: string;
  label: string;
  primary: boolean;
  reason: string;
}

export interface SearchStrategy {
  ref: string[];
  fts: string[];
  vector: string[];
  prepWork: string[];
}

export interface ScopingResult {
  refinedProblem: string;
  subProblems: SubProblem[];
  context: ContextData;
  provisions: Provision[];
  searchStrategy: SearchStrategy;
  reasoning: string;
}

export const SECTION_LABELS = [
  'Problemstilling',
  'Delspørsmål',
  'Kontekst',
  'Bestemmelser',
  'Søkestrategi',
  'KI-resonnement',
] as const;

/** Simulated delays per section (ms) — compressed for demo. Real: 15–30s each. */
export const SECTION_DELAYS = [5000, 2800, 2200, 3000, 3200, 2800];

export const MOCK_SCOPING: ScopingResult = {
  refinedProblem:
    'Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11, og finnes det leverandørkonstellasjoner som krever særskilt regulering?',
  subProblems: [
    { id: 1, text: 'Krav om solidaransvar og når dette inntrer' },
    { id: 2, text: 'Tidspunkt for krav om formalisert samarbeidsavtale' },
    {
      id: 3,
      text: 'Grensen mellom støtte på kapasitet (§ 16-10) og konsortiedeltakelse (§ 16-11)',
    },
  ],
  context: {
    procedure: 'Konkurransepreget dialog',
    threshold: 'EØS',
    service_area: 'FDVU-system / IKT',
    market: null,
  },
  provisions: [
    {
      ref: 'FOA § 16-11',
      label: 'Leverandørgrupperinger',
      primary: true,
      reason: 'Direkte regulerer krav til konsortier og fellesskap av leverandører.',
    },
    {
      ref: 'FOA § 16-10',
      label: 'Støtte på kapasitet',
      primary: true,
      reason: 'Alternativ til konsortiedannelse — grensedragningen er sentral.',
    },
    {
      ref: 'FOA § 19-2',
      label: 'Underleverandører',
      primary: true,
      reason: 'Regulerer underleverandører i gjennomføringsfasen.',
    },
    {
      ref: 'FOA § 24-2',
      label: 'Avvisning kvalifikasjon',
      primary: false,
      reason: 'Konsekvens ved manglende oppfyllelse av krav til grupperingen.',
    },
    {
      ref: 'FOA § 5-1',
      label: 'Grunnleggende prinsipper',
      primary: false,
      reason: 'Rammeverk for forholdsmessighetsvurderingen.',
    },
    {
      ref: 'LOA § 4',
      label: 'Likebehandling',
      primary: false,
      reason: 'Overordnet prinsipp som begrenser handlingsrommet.',
    },
  ],
  searchStrategy: {
    ref: ['FOA § 16-11', 'FOA § 16-10', 'FOA § 19-2'],
    fts: ['«konsortium»', '«solidaransvar»', '«leverandørgruppering»'],
    vector: [
      'krav til leverandørgrupperinger og solidaransvar ved felles tilbud',
      'samarbeidsavtale mellom leverandører i offentlig anskaffelse',
    ],
    prepWork: ['Prop. 51 L (2015–2016) kap. 22', 'NOU 2014:4 kap. 17'],
  },
  reasoning:
    'Problemstillingen berører et kjerneområde i anskaffelsesretten der FOA § 16-11 gir oppdragsgiver et visst handlingsrom, men der rettspraksis har utviklet presiserende normer — særlig rundt solidaransvar og tidspunkt for samarbeidsavtale. Grensedragningen mot § 16-10 (støtte på kapasitet) er praktisk viktig fordi den avgjør hvilke krav som stilles til dokumentasjon og ansvar. Søkestrategien kombinerer lovhenvisninger med konseptuelle søk fordi terminologien varierer mellom avgjørelser.',
};

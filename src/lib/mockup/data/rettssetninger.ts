/**
 * Mock data for Rettssetningsregister (Legal Propositions Registry).
 * Source: .mockups/paragraf-rettssetninger-v3.jsx
 */

// --- Types ---

export type EvolutionType = 'established' | 'confirmed' | 'qualified' | 'consolidating';

export interface Quote {
  p: string;
  text: string;
}

export interface CaseInstance {
  ref: string;
  year: string;
  paragraphs: string;
  evolution: EvolutionType;
  star: boolean;
  suggested: boolean;
  regulation: string;
  screeningProposition: string;
  factum: string;
  assessment: string;
  quotes: Quote[];
  nuances: string | null;
}

export interface BoundaryNote {
  caseId: string;
  note: string;
}

export interface Tension {
  withId: string;
  note: string;
}

export interface Rettssetning {
  id: string;
  theme: string;
  topic: string;
  proposition: string;
  isAiGenerated: boolean;
  lastEditedBy: string;
  yearSpan: string;
  tension: Tension | null;
  boundaryNotes: BoundaryNote[];
  cases: CaseInstance[];
}

export const EVOLUTION_CONFIG: Record<EvolutionType, { label: string; css: string }> = {
  established: { label: 'Etablert', css: 'tag-established' },
  confirmed: { label: 'Bekreftet', css: 'tag-confirmed' },
  qualified: { label: 'Kvalifisert', css: 'tag-qualified' },
  consolidating: { label: 'Konsoliderende', css: 'tag-consolidating' },
};

// --- Mock Data ---

export const THEMES = [
  'Solidaransvar og samarbeidsavtale',
  'Støtte på kapasitet',
  'Selskapsrettslig status',
];

export const MOCK_RETTSSETNINGER: Rettssetning[] = [
  {
    id: 'rs1',
    theme: 'Solidaransvar og samarbeidsavtale',
    topic: 'Tidspunkt for samarbeidsavtale',
    proposition:
      'Solidaransvar forutsettes ved deltakelse som leverandørgruppering. Det er imidlertid tilstrekkelig at en formalisert samarbeidsavtale foreligger før kontraktsignering, ikke nødvendigvis på tilbudstidspunktet.',
    isAiGenerated: false,
    lastEditedBy: 'Meg',
    yearSpan: '2016–2022',
    tension: null,
    boundaryNotes: [
      {
        caseId: 'KOFA-2018-12',
        note: 'Privatrettslig samarbeidsavtale mellom leverandører faller utenfor nemndas kompetanse og FOA § 16-11.',
      },
    ],
    cases: [
      {
        ref: 'KOFA-2016-104',
        year: '2016',
        paragraphs: 'avsnitt 33',
        evolution: 'established',
        star: false,
        suggested: false,
        regulation: 'FOA',
        screeningProposition:
          'Felles innlevering av tilbud etablerer i seg selv et solidaransvar uten krav om formell selskapsavtale.',
        factum:
          'Flere foretak innga felles tilbud, men manglet formell samarbeidsavtale ved tilbudsfristens utløp.',
        assessment:
          'Klagenemnda etablerte at selve den felles innleveringen var tilstrekkelig for å anse grupperingen som forpliktende overfor oppdragsgiver i tilbudsfasen.',
        quotes: [
          {
            p: '33',
            text: 'Nemnda finner at innlevering av et felles tilbud i seg selv etablerer et solidaransvar for de deltakende selskaper overfor oppdragsgiver, selv uten fremlagt selskapsavtale.',
          },
        ],
        nuances: null,
      },
      {
        ref: 'KOFA-2022-1200',
        year: '2022',
        paragraphs: '§ 16-11',
        evolution: 'confirmed',
        star: true,
        suggested: false,
        regulation: 'FOA',
        screeningProposition:
          'Solidaransvar forutsettes ved leverandørgruppering. Samarbeidsavtale kan kreves først ved kontraktsignering.',
        factum: 'To selskaper innga felles tilbud uten å ha stiftet et formelt selskap.',
        assessment:
          'Nemnda bekreftet tidligere praksis og slo fast at det ikke utgjorde et avvik fra FOA § 16-11 at samarbeidsavtalen først ble krevd fremlagt før selve signeringen.',
        quotes: [
          {
            p: '42',
            text: 'Når to eller flere selskaper velger å inngi et felles tilbud, etableres det i anskaffelsesrettslig forstand en leverandørgruppering som utløser et solidaransvar, uavhengig av den bakenforliggende selskapsrettslige organiseringen.',
          },
          {
            p: '45',
            text: 'Oppdragsgiver har rett til å kreve at grupperingen antar en bestemt juridisk form, men et slikt krav kan først gjøres gjeldende etter at kontrakt er tildelt.',
          },
        ],
        nuances: null,
      },
    ],
  },
  {
    id: 'rs2',
    theme: 'Støtte på kapasitet',
    topic: 'Støtte på kapasitet vs. Underleverandør',
    proposition:
      'En sammenslutning av foretak kan lovlig støtte seg på kapasiteten til de enkelte medlemmene for å oppfylle kvalifikasjonskrav, forutsatt at sammenslutningen faktisk råder over disse ressursene ved kontraktsgjennomføringen.',
    isAiGenerated: true,
    lastEditedBy: 'KI',
    yearSpan: '2014–2020',
    tension: {
      withId: 'rs1',
      note: 'Spenning mellom solidaransvar ved gruppering (rs1) og den mer fleksible adgangen til å støtte seg på kapasitet (rs2) — i grensetilfeller kan det være uklart om en konstellasjon er en gruppering eller et støtteforhold.',
    },
    boundaryNotes: [],
    cases: [
      {
        ref: 'C-396/14 (MT Højgaard)',
        year: '2014',
        paragraphs: 'Art. 44',
        evolution: 'established',
        star: true,
        suggested: false,
        regulation: 'Dir. 2004/18',
        screeningProposition:
          'EU-domstolen bekrefter at en sammenslutning av foretak kan støtte seg på kapasiteten til de enkelte medlemmene.',
        factum:
          'Et konsortium vant en anbudskonkurranse. Etter tildeling gikk ett av medlemmene konkurs.',
        assessment:
          'EU-domstolen fastslo at en sammenslutning i utgangspunktet kan støtte seg på medlemmenes kapasitet. Dersom sammenslutningen endres, må gjenværende medlemmer uansett oppfylle kravene alene.',
        quotes: [
          {
            p: '44',
            text: 'Direktiv 2004/18 er ikke til hinder for at en oppdragsgiver tillater en sammenslutning å støtte seg på kapasiteten til ett eller flere av sine medlemmer...',
          },
        ],
        nuances:
          'Domstolen presiserer at oppdragsgiver kan fastsette vilkår for hvordan denne kapasiteten skal dokumenteres, særlig dersom ressursene er kritiske for ytelsen.',
      },
      {
        ref: 'KOFA-2020-55',
        year: '2020',
        paragraphs: '§ 16-10',
        evolution: 'consolidating',
        star: false,
        suggested: false,
        regulation: 'FOA',
        screeningProposition:
          'Trekker opp grensen mellom støtte på kapasitet (§16-10) og underleverandører.',
        factum: 'Valgte leverandør støttet seg på et morselskap for økonomisk kapasitet.',
        assessment:
          'Nemnda godtok forpliktelseserklæringen, og trakk en tydelig grense mot underleverandører i gjennomføringsfasen, i tråd med EU-praksis.',
        quotes: [
          {
            p: '28',
            text: 'Det må trekkes et klart skille mellom det å støtte seg på en annens kapasitet for å bli kvalifisert, og bruk av underleverandør for å utføre deler av selve kontraktsarbeidet.',
          },
        ],
        nuances: null,
      },
      {
        ref: 'KOFA-2021-312',
        year: '2021',
        paragraphs: '§ 16-10(3)',
        evolution: 'qualified',
        star: false,
        suggested: true,
        regulation: 'FOA',
        screeningProposition:
          'Forpliktelseserklæring fra støtteforetak er ikke tilstrekkelig der kapasiteten gjelder nøkkelpersonell — reell disposisjonsrett må dokumenteres.',
        factum:
          'Leverandør støttet seg på et konsulentselskaps nøkkelpersonell, men kunne ikke dokumentere reell rådighet.',
        assessment:
          'Nemnda kvalifiserte rekkevidden av kapasitetsstøtte: ren erklæring uten avtalemessig binding er utilstrekkelig for kritiske ressurser.',
        quotes: [
          {
            p: '36',
            text: 'Der støtten gjelder nøkkelpersonell som er avgjørende for ytelsen, kreves det mer enn en generell forpliktelseserklæring — det må foreligge en bindende avtale som sikrer reell disposisjonsrett.',
          },
        ],
        nuances:
          'Skillet mellom «generell kapasitet» og «nøkkelpersonell» er ikke etablert i EU-praksis og representerer en strengere norsk linje.',
      },
    ],
  },
  {
    id: 'rs3',
    theme: 'Selskapsrettslig status',
    topic: 'Selskapsrettslig status',
    proposition:
      'Et konsortium opprettet kun for én spesifikk anbudskonkurranse utgjør ikke nødvendigvis et selskap i selskapslovens forstand, men representerer like fullt et forpliktende fellesskap overfor oppdragsgiver.',
    isAiGenerated: true,
    lastEditedBy: 'KI',
    yearSpan: '2019',
    tension: null,
    boundaryNotes: [],
    cases: [
      {
        ref: 'HR-2019-1801-A',
        year: '2019',
        paragraphs: 'avsnitt 52',
        evolution: 'established',
        star: false,
        suggested: false,
        regulation: 'Selskapsloven',
        screeningProposition:
          'Høyesterett vurderer selskapsrettslig status for konsortier opprettet kun for én anbudskonkurranse.',
        factum:
          'To selskaper inngikk avtale om felles anbud. Tvisten gjaldt intern fordeling av risiko.',
        assessment:
          'Høyesterett kom til at det interne ansvarsforholdet berodde på en konkret tolkning av samarbeidsavtalen, og at selskapsloven ikke kom direkte til anvendelse.',
        quotes: [
          {
            p: '52',
            text: 'Et samarbeid avgrenset til innlevering og eventuell gjennomføring av ett enkelt anbud, etablerer ikke uten videre et selskap etter selskapsloven § 1-1.',
          },
        ],
        nuances:
          'Dommen gjelder primært det indre ansvarsforholdet mellom partene (regress), og er bare analogt relevant for oppdragsgivers krav til solidaransvar utad.',
      },
    ],
  },
];

/** Group rettssetninger by theme in defined order */
export function groupByTheme(rules: Rettssetning[]) {
  return THEMES.map((theme) => ({
    theme,
    rules: rules.filter((r) => r.theme === theme),
  })).filter((g) => g.rules.length > 0);
}

/**
 * Mockdata for lesevisning — KOFA-2025/0999 (Gran kommune, § 7-9).
 * Real avsnitt, trimmed for illustration of all reading view patterns.
 */

export interface ParagraphRef {
  provision?: string;
  case?: string;
  para?: string;
}

export interface Paragraph {
  n: number;
  text: string;
  isQuoted?: boolean;
  isKey?: boolean;
  refs?: ParagraphRef[];
}

export interface Section {
  id: string;
  label: string;
  paragraphs: Paragraph[];
}

export interface Screening {
  category: 'A' | 'B' | 'C';
  star: boolean;
  relevance_reasoning: string;
  factum: string;
  assessment: string;
  proposition: string;
  quotes: { p: number; text: string }[];
  nuances: string | null;
}

export interface CaseMetadata {
  ref: string;
  title: string;
  innklaget: string;
  klager: string;
  sakstype: string;
  avgjoerelse: string;
  gjelder: string;
  avsluttet: string;
  provisions: string[];
  relatedCases: string[];
}

export const MOCK_SCREENING: Screening = {
  category: 'A',
  star: true,
  relevance_reasoning:
    'Saken behandler kjernen av § 7-9 — vektingskravet på 30 prosent og unntaksadgangen i fjerde ledd. Direkte relevant for problemstillingen om utforming av miljøkriterier i konkurransegrunnlaget.',
  factum:
    'Gran kommune kunngjorde åpen anbudskonkurranse for næringsavfallstømming (estimert 82 MNOK). Tildelingskriteriet «kvalitet og miljø» ble vektet 40 %, men nemndas gjennomgang viste at kun 20 % faktisk ivaretok klima- og miljøhensyn.',
  assessment:
    'Nemnda konstaterte brudd på § 7-9 fordi klima- og miljøhensyn ikke var vektet med 30 %. Unntaket i § 7-9(4) kom ikke til anvendelse fordi begrunnelsesplikten ikke var oppfylt — verken i anskaffelsesdokumentene eller i etterfølgende forklaring. Konkurransen måtte avlyses.',
  proposition:
    'For at et underkriterium skal anses å ivareta klima- og miljøhensyn etter § 7-9, må det uttrykkelig angi klima- og miljøhensyn som relevant for evalueringen. Det er ikke tilstrekkelig at slike hensyn kan inngå som ledd i leverandørenes besvarelse.',
  quotes: [
    {
      p: 57,
      text: 'Tildelingskriteriet uttrykkelig må angi klima- og miljøhensyn som relevant for tilbudsevalueringen dersom dette ønskes ivaretatt.',
    },
    {
      p: 63,
      text: 'Det er den samlede klima- og miljøeffekten i kravspesifikasjonen som må vurderes opp mot miljøeffekten av tildelingskriteriene, jf. formålet i forskriften § 7-9 (1).',
    },
    {
      p: 65,
      text: 'Begrunnelsen skal sannsynliggjøre hvorfor unntaket er anvendelig, i samsvar med det grunnleggende kravet til etterprøvbarhet.',
    },
  ],
  nuances: null,
};

export const MOCK_SECTIONS: Section[] = [
  {
    id: 'bakgrunn',
    label: 'Bakgrunn',
    paragraphs: [
      {
        n: 1,
        text: 'Innkjøpssamarbeidet for Hadeland, ved Gran kommune som vertskommune (heretter innklagede) kunngjorde 2. april 2025 en åpen anbudskonkurranse for anskaffelse av avtale for tømming av næringsavfall med tilbudsfrist 7. mai 2025. Anskaffelsens verdi var estimert til 82 000 000 kroner ekskl. mva.',
      },
      {
        n: 3,
        text: 'I henhold til tildelingskriteriene i konkurransegrunnlaget punkt 7.1 skulle «pris» vektes med 60 prosent og «kvalitet og miljø» vektlegges med 40 prosent.',
      },
      {
        n: 4,
        text: 'Tildelingskriteriet «kvalitet og miljø» bestod av fem underkriterier: Kildesortering (30 %), Smitteavfall (10 %), Implementering og gjennomføring (30 %), Miljøsertifisering (10 %) og Miljøvennlige kjøretøy (20 %).',
        isKey: true,
      },
    ],
  },
  {
    id: 'vurdering',
    label: 'Vurdering',
    paragraphs: [
      {
        n: 52,
        text: 'Klagenemnda tar først stilling til spørsmålet om tildelingskriteriet «kvalitet og miljø» er ulovlig. Klager har anført at innklagede har brutt forskriften § 7-9 ved å ikke vektlegge klima- og miljøhensyn med 30 prosent som tildelingskriterium.',
        refs: [{ provision: '§ 7-9' }],
      },
      {
        n: 54,
        text: 'Ordlyden i bestemmelsens første ledd tilsier at oppdragsgiver skal identifisere og forsøke å avhjelpe anskaffelsens påvirkning på klima og miljø ved å primært stille kriterier som er egnet til å redusere anskaffelsens negative påvirkning på klimaet og/eller miljøet.',
        refs: [{ provision: '§ 7-9(1)' }],
      },
      {
        n: 56,
        text: 'Klagenemnda finner det klart at underkriteriene kildesortering og miljøvennlige kjøretøy ivaretar klima- og miljøhensyn, svarende til en vekt på til sammen 20 prosent.',
      },
      {
        n: 57,
        text: 'Klagenemndas syn er at tildelingskriteriet uttrykkelig må angi klima- og miljøhensyn som relevant for tilbudsevalueringen dersom dette ønskes ivaretatt. Ettersom innklagede ikke legger opp til en slik vurdering har klagenemnda funnet at kriteriet ikke ivaretar klima- og miljøhensyn etter forskriften § 7-9.',
        isQuoted: true,
        refs: [{ provision: '§ 7-9' }],
      },
      {
        n: 60,
        text: 'Innklagede har dermed uansett ikke vektet klima og miljø med mer enn 24 prosent totalt. Når innklagede ikke vektet klima- og miljøhensyn med 30 prosent, utgjør dette i utgangspunktet et brudd på anskaffelsesforskriften § 7-9 (2).',
        refs: [{ provision: '§ 7-9(2)' }],
      },
      {
        n: 63,
        text: 'Ordlyden «klart» tilsier at krav i kravspesifikasjonen må gi en objektivt bedre effekt på klima og miljø enn om dette hensynet ivaretas i tildelingskriteriene, riktignok slik at det er tilstrekkelig at effekten er marginalt bedre, jf. klagenemndas avgjørelse i sak 2024/1387, avsnitt 24 flg.',
        isQuoted: true,
        refs: [{ provision: '§ 7-9(4)' }, { case: '2024/1387', para: '24' }],
      },
      {
        n: 64,
        text: 'En forutsetning for å foreta en vurdering av om det «klart» gir en bedre miljøeffekt å stille krav i kravspesifikasjonen enn tildelingskriterier, er at oppdragsgiver sikrer et «tilstrekkelig kunnskapsgrunnlag» for vurderingen, se klagenemndas avgjørelse i sak 2025/0356, avsnitt 28.',
        refs: [{ case: '2025/0356', para: '28' }],
      },
      {
        n: 65,
        text: 'At bruk av unntaksbestemmelsen skal «begrunnes i anskaffelsesdokumentene», forutsetter at innklagede i forkant av anskaffelsen har vurdert om det er «klart» at det å stille krav gir en bedre klima- og miljøeffekt enn å oppstille tildelingskriterier, jf. klagenemndas avgjørelse i sak 2025/0819 avsnitt 30. Begrunnelsen skal sannsynliggjøre hvorfor unntaket er anvendelig, i samsvar med det grunnleggende kravet til etterprøvbarhet.',
        isQuoted: true,
        refs: [
          { case: '2025/0819', para: '30' },
          { case: '2025/0322', para: '46' },
        ],
      },
      {
        n: 69,
        text: 'Når innklagede ikke kan vise til at det ble foretatt konkrete vurderinger som begrunner anvendelse av unntaket i forskriften § 7-9 (4) og heller ikke i ettertid kan vise til slike forhold, har ikke innklagede sannsynliggjort hvorfor og eventuelt hvordan det er «klart» at de anførte kravene faktisk gir en bedre klima- og miljøeffekt enn å oppstille klima- og miljøkriterier som er vektet 30 prosent.',
        refs: [{ provision: '§ 7-9(4)' }],
      },
    ],
  },
  {
    id: 'konklusjon',
    label: 'Konklusjon',
    paragraphs: [
      {
        n: 78,
        text: 'Innklagede har ikke vektet klima- og miljøhensyn med 30 prosent. Det kan ikke utelukkes at tilbudene hadde vært ulikt utformet dersom klima- og miljøhensyn var lovlig vektet. Feilen kan ikke rettes. Klagenemnda finner derfor at konkurransen må avlyses som følge av at innklagede har oppstilt et ulovlig tildelingskriterium.',
      },
      {
        n: 80,
        text: 'Gran kommune har brutt regelverket for offentlige anskaffelser ved å oppstille et ulovlig tildelingskriterium.',
        isKey: true,
      },
    ],
  },
];

export const MOCK_CASE_METADATA: CaseMetadata = {
  ref: 'KOFA-2025/0999',
  title: 'Gran kommune — Tømming av næringsavfall',
  innklaget: 'Gran kommune',
  klager: 'Hadeland og Ringerike avfallsselskap AS',
  sakstype: 'Prioritert rådgivende sak',
  avgjoerelse: 'Brudd på regelverket',
  gjelder: 'Miljøbestemmelsen § 7-9, Ulovlig tildelingskriterium, Avlysning/totalforkastelse',
  avsluttet: '15. september 2025',
  provisions: ['FOA § 7-9', 'FOA § 18-1(4)'],
  relatedCases: ['2024/1387', '2024/639', '2025/0322', '2025/0356', '2025/0819'],
};

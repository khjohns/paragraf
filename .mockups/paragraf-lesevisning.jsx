import React, { useState, useRef, useEffect } from 'react';
import {
  Search, List, Network, BookOpen, PenTool, Sparkles,
  Check, X, Maximize2, Minimize2, ChevronDown, ChevronRight,
  Star, Sun, Moon, ExternalLink, Copy, ArrowLeft
} from 'lucide-react';

/*
  PARAGRAF — Lesevisning (standalone mock)
  
  Real KOFA content: sak 2025/0999 (Gran kommune, § 7-9)
  Trimmed to illustrative avsnitt — enough to show all patterns.
  
  Design decisions:
  ─ KI-screening as structured layer ABOVE full text (not replacing it)
  ─ Section nav (Bakgrunn/Anførsler/Vurdering) as sticky tabs
  ─ Paragraph numbers as anchors (clickable, copyable)
  ─ Cross-references are clickable links (open related case)
  ─ Provision references highlighted inline (subtle underline)
  ─ Full-width mode (not 420px panel — this is the reading *experience*)
  ─ Quotes curated by KI shown with highlight affordance
*/

// --- MOCK: KI Screening output for this case ---
const screening = {
  category: 'A',
  star: true,
  relevance_reasoning: 'Saken behandler kjernen av § 7-9 — vektingskravet på 30 prosent og unntaksadgangen i fjerde ledd. Direkte relevant for problemstillingen om utforming av miljøkriterier i konkurransegrunnlaget.',
  factum: 'Gran kommune kunngjorde åpen anbudskonkurranse for næringsavfallstømming (estimert 82 MNOK). Tildelingskriteriet «kvalitet og miljø» ble vektet 40 %, men nemndas gjennomgang viste at kun 20 % faktisk ivaretok klima- og miljøhensyn.',
  assessment: 'Nemnda konstaterte brudd på § 7-9 fordi klima- og miljøhensyn ikke var vektet med 30 %. Unntaket i § 7-9(4) kom ikke til anvendelse fordi begrunnelsesplikten ikke var oppfylt — verken i anskaffelsesdokumentene eller i etterfølgende forklaring. Konkurransen måtte avlyses.',
  proposition: 'For at et underkriterium skal anses å ivareta klima- og miljøhensyn etter § 7-9, må det uttrykkelig angi klima- og miljøhensyn som relevant for evalueringen. Det er ikke tilstrekkelig at slike hensyn kan inngå som ledd i leverandørenes besvarelse.',
  quotes: [
    { p: 57, text: 'Tildelingskriteriet uttrykkelig må angi klima- og miljøhensyn som relevant for tilbudsevalueringen dersom dette ønskes ivaretatt.' },
    { p: 63, text: 'Det er den samlede klima- og miljøeffekten i kravspesifikasjonen som må vurderes opp mot miljøeffekten av tildelingskriteriene, jf. formålet i forskriften § 7-9 (1).' },
    { p: 65, text: 'Begrunnelsen skal sannsynliggjøre hvorfor unntaket er anvendelig, i samsvar med det grunnleggende kravet til etterprøvbarhet.' },
  ],
  nuances: null,
};

// --- MOCK: Structured sections with paragraph data ---
// Using real avsnitt from 2025/0999, trimmed for illustration
const sections = [
  {
    id: 'bakgrunn',
    label: 'Bakgrunn',
    paragraphs: [
      { n: 1, text: 'Innkjøpssamarbeidet for Hadeland, ved Gran kommune som vertskommune (heretter innklagede) kunngjorde 2. april 2025 en åpen anbudskonkurranse for anskaffelse av avtale for tømming av næringsavfall med tilbudsfrist 7. mai 2025. Anskaffelsens verdi var estimert til 82 000 000 kroner ekskl. mva.' },
      { n: 3, text: 'I henhold til tildelingskriteriene i konkurransegrunnlaget punkt 7.1 skulle «pris» vektes med 60 prosent og «kvalitet og miljø» vektlegges med 40 prosent.' },
      { n: 4, text: 'Tildelingskriteriet «kvalitet og miljø» bestod av fem underkriterier: Kildesortering (30 %), Smitteavfall (10 %), Implementering og gjennomføring (30 %), Miljøsertifisering (10 %) og Miljøvennlige kjøretøy (20 %).', isKey: true },
    ]
  },
  {
    id: 'vurdering',
    label: 'Vurdering',
    paragraphs: [
      { n: 52, text: 'Klagenemnda tar først stilling til spørsmålet om tildelingskriteriet «kvalitet og miljø» er ulovlig. Klager har anført at innklagede har brutt forskriften § 7-9 ved å ikke vektlegge klima- og miljøhensyn med 30 prosent som tildelingskriterium.', refs: [{ provision: '§ 7-9' }] },
      { n: 54, text: 'Ordlyden i bestemmelsens første ledd tilsier at oppdragsgiver skal identifisere og forsøke å avhjelpe anskaffelsens påvirkning på klima og miljø ved å primært stille kriterier som er egnet til å redusere anskaffelsens negative påvirkning på klimaet og/eller miljøet.', refs: [{ provision: '§ 7-9(1)' }] },
      { n: 56, text: 'Klagenemnda finner det klart at underkriteriene kildesortering og miljøvennlige kjøretøy ivaretar klima- og miljøhensyn, svarende til en vekt på til sammen 20 prosent.' },
      { n: 57, text: 'Klagenemndas syn er at tildelingskriteriet uttrykkelig må angi klima- og miljøhensyn som relevant for tilbudsevalueringen dersom dette ønskes ivaretatt. Ettersom innklagede ikke legger opp til en slik vurdering har klagenemnda funnet at kriteriet ikke ivaretar klima- og miljøhensyn etter forskriften § 7-9.', isQuoted: true, refs: [{ provision: '§ 7-9' }] },
      { n: 60, text: 'Innklagede har dermed uansett ikke vektet klima og miljø med mer enn 24 prosent totalt. Når innklagede ikke vektet klima- og miljøhensyn med 30 prosent, utgjør dette i utgangspunktet et brudd på anskaffelsesforskriften § 7-9 (2).', refs: [{ provision: '§ 7-9(2)' }] },
      { n: 63, text: 'Ordlyden «klart» tilsier at krav i kravspesifikasjonen må gi en objektivt bedre effekt på klima og miljø enn om dette hensynet ivaretas i tildelingskriteriene, riktignok slik at det er tilstrekkelig at effekten er marginalt bedre, jf. klagenemndas avgjørelse i sak 2024/1387, avsnitt 24 flg.', isQuoted: true, refs: [{ provision: '§ 7-9(4)' }, { case: '2024/1387', para: '24' }] },
      { n: 64, text: 'En forutsetning for å foreta en vurdering av om det «klart» gir en bedre miljøeffekt å stille krav i kravspesifikasjonen enn tildelingskriterier, er at oppdragsgiver sikrer et «tilstrekkelig kunnskapsgrunnlag» for vurderingen, se klagenemndas avgjørelse i sak 2025/0356, avsnitt 28.', refs: [{ case: '2025/0356', para: '28' }] },
      { n: 65, text: 'At bruk av unntaksbestemmelsen skal «begrunnes i anskaffelsesdokumentene», forutsetter at innklagede i forkant av anskaffelsen har vurdert om det er «klart» at det å stille krav gir en bedre klima- og miljøeffekt enn å oppstille tildelingskriterier, jf. klagenemndas avgjørelse i sak 2025/0819 avsnitt 30. Begrunnelsen skal sannsynliggjøre hvorfor unntaket er anvendelig, i samsvar med det grunnleggende kravet til etterprøvbarhet.', isQuoted: true, refs: [{ case: '2025/0819', para: '30' }, { case: '2025/0322', para: '46' }] },
      { n: 69, text: 'Når innklagede ikke kan vise til at det ble foretatt konkrete vurderinger som begrunner anvendelse av unntaket i forskriften § 7-9 (4) og heller ikke i ettertid kan vise til slike forhold, har ikke innklagede sannsynliggjort hvorfor og eventuelt hvordan det er «klart» at de anførte kravene faktisk gir en bedre klima- og miljøeffekt enn å oppstille klima- og miljøkriterier som er vektet 30 prosent.', refs: [{ provision: '§ 7-9(4)' }] },
    ]
  },
  {
    id: 'konklusjon',
    label: 'Konklusjon',
    paragraphs: [
      { n: 78, text: 'Innklagede har ikke vektet klima- og miljøhensyn med 30 prosent. Det kan ikke utelukkes at tilbudene hadde vært ulikt utformet dersom klima- og miljøhensyn var lovlig vektet. Feilen kan ikke rettes. Klagenemnda finner derfor at konkurransen må avlyses som følge av at innklagede har oppstilt et ulovlig tildelingskriterium.' },
      { n: 80, text: 'Gran kommune har brutt regelverket for offentlige anskaffelser ved å oppstille et ulovlig tildelingskriterium.', isKey: true },
    ]
  }
];

const caseMetadata = {
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

export default function App() {
  const [activeSection, setActiveSection] = useState('vurdering');
  const [darkMode, setDarkMode] = useState(false);
  const [screeningOpen, setScreeningOpen] = useState(true);
  const [copiedPara, setCopiedPara] = useState(null);
  const [isFullWidth, setIsFullWidth] = useState(true);
  const scrollRef = useRef(null);

  const currentSection = sections.find(s => s.id === activeSection);
  const quotedParas = new Set(screening.quotes.map(q => q.p));

  const copyParaRef = (n) => {
    const text = `KOFA-2025/0999, avsnitt ${n}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedPara(n);
      setTimeout(() => setCopiedPara(null), 2000);
    });
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap');

        :root {
          --ink: #1C1B1A; --ink-secondary: #33312E; --ink-tertiary: #4A4843; --ink-muted: #7A766F;
          --paper: #F8F6F1; --paper-dark: #EDEAE3;
          --border-subtle: rgba(28,27,26,0.06); --border: rgba(28,27,26,0.12);
          --border-strong: rgba(28,27,26,0.20); --border-stronger: rgba(28,27,26,0.35);
          --ai-accent: #92600A; --ai-border: rgba(146,96,10,0.20); --ai-bg: rgba(146,96,10,0.05);
          --hover-bg: rgba(28,27,26,0.02); --hover-bg-strong: rgba(28,27,26,0.04);
          --header-bg: rgba(248,246,241,0.92);
          --confirm-color: #375E37; --gold-star: #B8941E;
          --ref-link: #4A6A8B;
          --noise-svg: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
        }
        .dark {
          --ink: #E2DFD6; --ink-secondary: #C4C0B5; --ink-tertiary: #8E8A80; --ink-muted: #5C5850;
          --paper: #1E1C19; --paper-dark: #16140F;
          --border-subtle: rgba(232,229,220,0.06); --border: rgba(232,229,220,0.10);
          --border-strong: rgba(232,229,220,0.16); --border-stronger: rgba(232,229,220,0.28);
          --ai-accent: #C49A4E; --ai-border: rgba(196,154,78,0.25); --ai-bg: rgba(196,154,78,0.08);
          --hover-bg: rgba(232,229,220,0.03); --hover-bg-strong: rgba(232,229,220,0.06);
          --header-bg: rgba(30,28,25,0.92);
          --confirm-color: #8BC48B; --gold-star: #D4B84E;
          --ref-link: #8BAAC4;
          --noise-svg: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E");
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .font-sans { font-family: 'Albert Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-serif { font-family: 'Newsreader', serif; }
        ::selection { background: var(--ai-bg); color: var(--ai-accent); }

        .logo-home { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 1.5px solid var(--ink); border-radius: 4px; background: transparent; cursor: pointer; transition: border-color 0.15s ease; flex-shrink: 0; }
        .logo-home:hover { border-color: var(--border-strong); }

        .mode-toggle { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border); background: transparent; color: var(--ink-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .mode-toggle:hover { color: var(--ink); border-color: var(--border-strong); }

        .action-btn { display: inline-flex; align-items: center; gap: 4px; font-family: 'Albert Sans', sans-serif; font-size: 11px; font-weight: 500; padding: 4px 12px; border-radius: 2px; cursor: pointer; transition: all 0.15s ease; border: 1px solid var(--border); background: transparent; color: var(--ink-tertiary); }
        .action-btn:hover { border-color: var(--border-strong); color: var(--ink); }
        .action-btn:active { transform: scale(0.98); }
        .action-btn-ai { border-color: var(--ai-border); color: var(--ai-accent); }
        .action-btn-ai:hover { border-color: var(--ai-accent); background: var(--ai-bg); }

        .btn-primary-full { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; font-family: 'Albert Sans', sans-serif; font-size: 12px; font-weight: 500; padding: 8px 16px; border-radius: 2px; cursor: pointer; transition: all 0.15s ease; background: var(--ink); color: var(--paper); border: 1.5px solid transparent; }
        .btn-primary-full:hover { background: #000; }
        .dark .btn-primary-full { background: transparent; color: var(--ink-secondary); border-color: var(--border-strong); }
        .dark .btn-primary-full:hover { background: var(--hover-bg-strong); color: var(--ink); }

        /* Section tabs */
        .sec-tab { padding: 6px 16px; font-family: 'Albert Sans', sans-serif; font-size: 12px; font-weight: 500; border: none; background: transparent; color: var(--ink-muted); cursor: pointer; transition: all 0.15s ease; border-bottom: 2px solid transparent; }
        .sec-tab:hover { color: var(--ink-secondary); }
        .sec-tab.active { color: var(--ink); border-bottom-color: var(--ink); }

        /* Paragraph row */
        .para-row { display: flex; gap: 0; transition: background 0.15s ease; }
        .para-row:hover { background: var(--hover-bg); }
        .para-row:hover .para-num-btn { opacity: 1; }
        .para-num-btn { opacity: 0.4; transition: opacity 0.15s ease; }
        .para-num-btn:hover { opacity: 1 !important; color: var(--ink) !important; }

        /* Highlighted paragraph (KI-quoted) */
        .para-highlighted { border-left: 2px solid var(--ai-accent); margin-left: -2px; }

        /* Key paragraph */
        .para-key { background: var(--hover-bg); }

        /* Inline ref link */
        .ref-link { color: var(--ref-link); text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; cursor: pointer; transition: color 0.15s ease; }
        .ref-link:hover { color: var(--ink); text-decoration-style: solid; }

        /* Provision inline */
        .prov-inline { color: var(--ink); font-family: 'JetBrains Mono', monospace; font-size: 0.88em; }

        .slide-in { animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}} />

      <div className={darkMode ? 'dark' : ''} style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--paper)', color: 'var(--ink)', colorScheme: darkMode ? 'dark' : 'light', backgroundImage: 'var(--noise-svg)', fontFamily: "'Albert Sans', sans-serif" }}>

        {/* ─── HEADER ─── */}
        <header style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--header-bg)', backdropFilter: 'blur(12px)', flexShrink: 0, zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <button className="logo-home" title="Tilbake til porteføljen">
              <span className="font-serif" style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 13, lineHeight: 1 }}>§</span>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
            <h1 className="font-serif" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Utforming av miljøkriterier i konkurransegrunnlaget, jf. FOA § 7-9
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button className="mode-toggle" onClick={() => setDarkMode(!darkMode)}>{darkMode ? <Sun style={{ width: 14, height: 14 }} /> : <Moon style={{ width: 14, height: 14 }} />}</button>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--paper-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--ink-secondary)' }}>MJ</div>
          </div>
        </header>

        {/* ─── MAIN READING AREA ─── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 80px' }}>

              {/* ─── CASE HEADER ─── */}
              <div className="slide-in" style={{ paddingTop: 32, paddingBottom: 24, borderBottom: '2px solid var(--ink)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <button className="action-btn" style={{ padding: '2px 8px', border: 'none', gap: 4 }}>
                    <ArrowLeft style={{ width: 12, height: 12 }} /> Tilbake til registeret
                  </button>
                </div>
                <h2 className="font-serif" style={{ fontSize: 28, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.25, letterSpacing: '-0.015em', marginBottom: 8 }}>
                  {caseMetadata.ref}
                </h2>
                <p className="font-sans" style={{ fontSize: 13, color: 'var(--ink-tertiary)', lineHeight: 1.5, marginBottom: 16 }}>
                  {caseMetadata.innklaget} — {caseMetadata.gjelder}
                </p>

                {/* Metadata chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink)', background: 'var(--paper-dark)', border: '1px solid var(--border)', padding: '2px 8px' }}>{caseMetadata.avgjoerelse}</span>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-muted)', border: '1px solid var(--border)', padding: '2px 8px' }}>{caseMetadata.sakstype}</span>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{caseMetadata.avsluttet}</span>
                  <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 4px' }} />
                  {caseMetadata.provisions.map((p, i) => (
                    <span key={i} className="font-mono" style={{ fontSize: 11, color: 'var(--ink)', background: 'var(--paper-dark)', border: '1px solid var(--border)', padding: '2px 8px' }}>{p}</span>
                  ))}
                </div>
              </div>

              {/* ─── KI SCREENING LAYER ─── */}
              <div className="slide-in" style={{ marginTop: 24, border: '1px solid var(--ai-border)', borderRadius: 3, overflow: 'hidden' }}>
                <button onClick={() => setScreeningOpen(!screeningOpen)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'var(--ai-bg)', border: 'none', cursor: 'pointer', transition: 'background 0.15s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles style={{ width: 14, height: 14, color: 'var(--ai-accent)' }} />
                    <span className="font-sans" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ai-accent)' }}>KI-screening</span>
                    <span className="font-sans" style={{ fontSize: 12, color: 'var(--ink-tertiary)' }}>— Kategori {screening.category}</span>
                    {screening.star && <Star style={{ width: 12, height: 12, color: 'var(--gold-star)', fill: 'currentColor' }} />}
                  </div>
                  <ChevronDown style={{ width: 14, height: 14, color: 'var(--ai-accent)', transform: screeningOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                </button>

                {screeningOpen && (
                  <div style={{ padding: '16px 20px 20px', borderTop: '1px solid var(--ai-border)' }}>
                    {/* Relevance reasoning */}
                    <div className="font-sans" style={{ fontSize: 11, color: 'var(--ai-accent)', marginBottom: 16, lineHeight: 1.5 }}>
                      {screening.relevance_reasoning}
                    </div>

                    {/* Factum + Assessment */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                      <div>
                        <span className="font-sans" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>Faktum</span>
                        <p className="font-serif" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-tertiary)' }}>{screening.factum}</p>
                      </div>
                      <div>
                        <span className="font-sans" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>Vurdering</span>
                        <p className="font-serif" style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink)' }}>{screening.assessment}</p>
                      </div>
                    </div>

                    {/* Proposition */}
                    <div style={{ borderLeft: '2px solid var(--ai-accent)', paddingLeft: 16, marginBottom: 20 }}>
                      <span className="font-sans" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ai-accent)', display: 'block', marginBottom: 4 }}>Foreslått rettssetning</span>
                      <p className="font-serif" style={{ fontSize: 16, fontStyle: 'italic', lineHeight: 1.55, color: 'var(--ai-accent)' }}>{screening.proposition}</p>
                    </div>

                    {/* Curated quotes — clicking scrolls to paragraph */}
                    <div>
                      <span className="font-sans" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', display: 'block', marginBottom: 8 }}>Nøkkelsitater</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {screening.quotes.map((q, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '6px 8px', background: 'var(--paper-dark)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                            <span className="font-mono" style={{ fontSize: 10, color: 'var(--ai-accent)', flexShrink: 0, fontWeight: 600 }}>§{q.p}</span>
                            <p className="font-serif" style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--ink-secondary)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              «{q.text}»
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                      <button className="action-btn action-btn-ai"><Check style={{ width: 12, height: 12 }} /> Godkjenn kategori</button>
                      <button className="action-btn">Endre</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── SECTION NAVIGATION ─── */}
              <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--header-bg)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', marginTop: 32, display: 'flex', gap: 0 }}>
                {sections.map(s => (
                  <button key={s.id} onClick={() => setActiveSection(s.id)}
                    className={`sec-tab ${activeSection === s.id ? 'active' : ''}`}>
                    {s.label}
                    <span className="font-mono" style={{ fontSize: 9, color: 'var(--ink-muted)', marginLeft: 4 }}>{s.paragraphs.length}</span>
                  </button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
                  <a href={`https://www.klagenemndssekretariatet.no/sak/2025-0999`} target="_blank" rel="noopener noreferrer"
                    className="font-sans" style={{ fontSize: 11, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', transition: 'color 0.15s' }}>
                    Original <ExternalLink style={{ width: 10, height: 10 }} />
                  </a>
                </div>
              </div>

              {/* ─── PARAGRAPH CONTENT ─── */}
              <div style={{ marginTop: 24 }}>
                {currentSection?.paragraphs.map((p, i) => {
                  const isQuoted = quotedParas.has(p.n);
                  const isCopied = copiedPara === p.n;
                  return (
                    <div key={p.n}
                      className={`para-row ${isQuoted ? 'para-highlighted' : ''} ${p.isKey ? 'para-key' : ''}`}
                      style={{ padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      {/* Paragraph number — clickable anchor */}
                      <div style={{ width: 48, flexShrink: 0, paddingTop: 2, textAlign: 'right', paddingRight: 16 }}>
                        <button className="para-num-btn font-mono" onClick={() => copyParaRef(p.n)}
                          title={isCopied ? 'Kopiert!' : `Kopier referanse: avsnitt ${p.n}`}
                          style={{ fontSize: 11, color: isCopied ? 'var(--confirm-color)' : 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s', fontWeight: 500 }}>
                          {isCopied ? '✓' : p.n}
                        </button>
                      </div>

                      {/* Paragraph text */}
                      <div style={{ flex: 1, paddingRight: 16 }}>
                        <p className="font-serif" style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--ink-secondary)' }}>
                          {p.text}
                        </p>

                        {/* Inline references — provision and case links */}
                        {p.refs?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                            {p.refs.map((r, ri) => (
                              r.case ? (
                                <button key={ri} className="ref-link font-mono" style={{ fontSize: 10, background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  KOFA-{r.case}{r.para && `, avsnitt ${r.para}`} <ExternalLink style={{ width: 9, height: 9 }} />
                                </button>
                              ) : (
                                <span key={ri} className="font-mono" style={{ fontSize: 10, color: 'var(--ink-tertiary)', background: 'var(--paper-dark)', border: '1px solid var(--border)', padding: '0 6px', borderRadius: 2 }}>
                                  {r.provision}
                                </span>
                              )
                            ))}
                          </div>
                        )}
                      </div>

                      {/* KI-quote indicator */}
                      {isQuoted && (
                        <div style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: 4 }}>
                          <Sparkles style={{ width: 11, height: 11, color: 'var(--ai-accent)' }} title="Sitert av KI-screening" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ─── BOTTOM ACTION ─── */}
              <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <button className="btn-primary-full">
                  <BookOpen style={{ width: 14, height: 14 }} /> Marker som Rettssetning
                </button>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
                  <span className="font-sans" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                    {caseMetadata.relatedCases.length} relaterte saker
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── SIDEBAR: Related cases ─── */}
          <aside style={{ width: 240, borderLeft: '1px solid var(--border)', flexShrink: 0, overflowY: 'auto', padding: '20px 16px' }}>
            <div className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-muted)', marginBottom: 16 }}>
              Relaterte saker
            </div>
            {caseMetadata.relatedCases.map((ref, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }}>
                <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ref-link)' }}>KOFA-{ref}</span>
              </div>
            ))}

            <div style={{ marginTop: 32 }}>
              <div className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-muted)', marginBottom: 12 }}>Bestemmelser</div>
              {caseMetadata.provisions.map((p, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink)', background: 'var(--paper-dark)', border: '1px solid var(--border)', padding: '2px 8px' }}>{p}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

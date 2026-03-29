import React, { useState } from 'react';
import { 
  Search, List, Network, BookOpen, PenTool, Sparkles,
  Eye, Check, Plus, X, Filter, Maximize2, ChevronRight, ChevronDown,
  Square, CheckSquare, Sun, Moon, Pencil
} from 'lucide-react';

/*
  PARAGRAF — Arbeidsflate (Saksoversikt)
  
  Scope panel restructured to match Claude scoping prompt output:
  1. Problemstilling (refined_problem) — editable
  2. Delspørsmål (sub_problems) — editable, addable
  3. Kontekst (context) — collapsible, metadata chips
  4. Bestemmelser (provisions) — primary/secondary split, with reasons
  5. Søkestrategi (search_strategy) — R/F/V/Forarbeider groups
  6. Resonnement (reasoning) — collapsed, AI-owned
  
  Tab labels: "Kjernesak · A (5)" etc.
  Panel width: 360px (reading panel auto-closes)
*/

// --- MOCK DATA (matches scoping prompt output) ---
const scopeData = {
  originalProblem: "Vi skal anskaffe FDVU-system og lurer på hva vi må tenke på mht leverandørgrupperinger og konsortier i konkurransegrunnlaget",
  refinedProblem: "Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11, og finnes det leverandørkonstellasjoner som krever særskilt regulering?",
  subProblems: [
    { id: 1, text: "Krav om solidaransvar og når dette inntrer", active: true },
    { id: 2, text: "Tidspunkt for krav om formalisert samarbeidsavtale", active: true },
    { id: 3, text: "Grensen mellom støtte på kapasitet (§16-10) og konsortiedeltakelse (§16-11)", active: true }
  ],
  context: {
    procedure: 'Konkurransepreget dialog',
    service_area: 'FDVU-system / IKT',
    market: null,
    threshold: 'EØS'
  },
  provisions: [
    { ref: 'FOA §16-11', label: 'Leverandørgrupperinger', primary: true, reason: 'Direkte regulerer krav til konsortier og fellesskap av leverandører.' },
    { ref: 'FOA §16-10', label: 'Støtte på kapasitet', primary: true, reason: 'Alternativ til konsortiedannelse — grensedragningen er sentral.' },
    { ref: 'FOA §19-2', label: 'Underleverandører', primary: true, reason: 'Regulerer underleverandører i gjennomføringsfasen, relevant for konstellasjonsmodellene.' },
    { ref: 'FOA §24-2', label: 'Avvisning kvalifikasjon', primary: false, reason: 'Konsekvens ved manglende oppfyllelse av krav til grupperingen.' },
    { ref: 'FOA §5-1', label: 'Grunnleggende prinsipper', primary: false, reason: 'Rammeverk for forholdsmessighetsvurderingen.' },
    { ref: 'LOA §4', label: 'Likebehandling', primary: false, reason: 'Overordnet prinsipp som begrenser handlingsrommet.' }
  ],
  searchStrategy: {
    refTable: ['FOA §16-11', 'FOA §16-10', 'FOA §19-2'],
    fts: ['«konsortium»', '«solidaransvar»', '«leverandørgruppering»'],
    vector: ['krav til leverandørgrupperinger og solidaransvar ved felles tilbud', 'samarbeidsavtale mellom leverandører i offentlig anskaffelse'],
    prepWork: ['Prop. 51 L (2015–2016)']
  },
  reasoning: "Problemstillingen dreier seg primært om FOA § 16-11 som direkte regulerer leverandørgrupperinger/fellesskap. § 16-10 er sentral fordi støtte på andre virksomheters kapasitet er et alternativ til konsortiedannelse — grensedragningen mellom disse to mekanismene er ofte avgjørende. § 19-2 regulerer underleverandører i gjennomføringsfasen, noe som er relevant for de ulike konstellasjonsmodellene som er beskrevet. Søkestrategien kombinerer presise bestemmelsesreferanser med fulltekstsøk på sentrale begreper og semantiske søk for å fange opp saker som bruker annen terminologi."
};

const counts = { null: 53, A: 5, B: 8, C: 35, total: 101 };

const workingRegister = [
  {
    id: 'k1', ref: 'KOFA-2022-1200', source: 'Klagenemnda', date: '12. nov 2022',
    category: 'A', read_at: '2026-03-27T10:14:00Z',
    signals: [
      { type: 'R', detail: 'FOA §16-11' },
      { type: 'F', detail: '«solidaransvar»' },
      { type: 'V', detail: 'Nært treff', explanation: 'Konseptuelt treff på: "felles hefte for forpliktelser"' }
    ],
    ai_screening: { category: 'A', proposition: 'Fastslår at solidaransvar forutsettes ved deltakelse som leverandørgruppering.' },
    excerpt: [
      { text: 'Nemnda bemerker at formålet med ', mark: null },
      { text: 'FOA § 16-11', mark: 'R' },
      { text: ' er å sikre at oppdragsgiver har en reell juridisk motpart som hefter for oppfyllelsen av kontrakten. Selv om leverandørene ikke hadde stiftet et eget selskap (', mark: null },
      { text: 'konsortium', mark: 'F' },
      { text: '), innebar deres felles innlevering av tilbud at de måtte anses som en leverandørgruppering. Det påhvilte dermed gruppen et ', mark: null },
      { text: 'solidaransvar', mark: 'F' },
      { text: '. Oppdragsgiver hadde følgelig rett til å kreve en formalisert samarbeidsavtale fremlagt før kontraktsignering, for å sikre at ', mark: null },
      { text: 'felles hefte for forpliktelser', mark: 'V' },
      { text: ' var avklart.', mark: null }
    ]
  },
  {
    id: 'k2', ref: 'HR-2019-1801-A', source: 'Høyesterett', date: '04. feb 2019',
    category: null, read_at: null,
    signals: [
      { type: 'F', detail: '«konsortium»' },
      { type: 'V', detail: 'Beslektet', explanation: 'Konseptuelt treff på: "selskapsrettslig status ved felles tilbud"' }
    ],
    ai_screening: { category: 'A', proposition: 'Høyesterett vurderer selskapsrettslig status for konsortier opprettet kun for én anbudskonkurranse.' },
    excerpt: [
      { text: 'Høyesterett la til grunn at selskapsrettslig status for midlertidige ', mark: null },
      { text: 'konsortier', mark: 'F' },
      { text: ' må vurderes konkret. Et samarbeid for én enkeltstående anbudskonkurranse utgjør ikke nødvendigvis et selskap i ', mark: null },
      { text: 'selskapslovens forstand', mark: 'V' },
      { text: ', men representerer like fullt et forpliktende fellesskap overfor oppdragsgiver.', mark: null }
    ]
  },
  {
    id: 'k3', ref: 'KOFA-2020-55', source: 'Klagenemnda', date: '15. mar 2020',
    category: 'B', read_at: '2026-03-27T12:05:00Z',
    signals: [{ type: 'R', detail: 'FOA §16-10' }],
    ai_screening: { category: 'B', proposition: 'Trekker opp grensen mellom støtte på kapasitet (§16-10) og underleverandører.' },
    excerpt: [
      { text: 'Saken gjaldt spørsmålet om valgte leverandør lovlig kunne støtte seg på et morselskap for å oppfylle kravene til økonomisk kapasitet, jf. ', mark: null },
      { text: 'FOA § 16-10', mark: 'R' },
      { text: '. Nemnda kom til at forpliktelseserklæringen var tilstrekkelig.', mark: null }
    ]
  },
  {
    id: 'k4', ref: 'C-396/14 (MT Højgaard)', source: 'EU-domstolen', date: '24. mai 2016',
    category: 'A', read_at: null,
    signals: [{ type: 'V', detail: 'Nært treff', explanation: 'Konseptuelt treff på: "sammenslutningers rett til å støtte seg på medlemmers kapasitet"' }],
    ai_screening: { category: 'A', proposition: 'EU-domstolen bekrefter at en sammenslutning av foretak kan støtte seg på kapasiteten til de enkelte medlemmene.' },
    excerpt: [
      { text: 'Domstolen fastslo at direktiv 2004/18 er til hinder for at en oppdragsgiver utelukker en ', mark: null },
      { text: 'sammenslutning av foretak', mark: 'V' },
      { text: ' fra å delta, kun med den begrunnelse at sammenslutningen som sådan ikke har de nødvendige kvalifikasjonene, når sammenslutningen godtgjør at den faktisk råder over ', mark: null },
      { text: 'medlemmenes ressurser', mark: 'V' },
      { text: '.', mark: null }
    ]
  },
  {
    id: 'k5', ref: 'KOFA-2018-12', source: 'Klagenemnda', date: '10. jan 2018',
    category: 'C', read_at: '2026-03-26T14:20:00Z',
    signals: [
      { type: 'F', detail: '«samarbeidsavtale»' },
      { type: 'V', detail: 'Perifert', explanation: 'Gjelder samarbeid, men ikke i anskaffelsesrettslig forstand.' }
    ],
    ai_screening: { category: 'C', proposition: 'Omhandler en privatrettslig samarbeidsavtale som ikke er relevant for krav i konkurransegrunnlaget.' },
    excerpt: [
      { text: 'Saken avvist, da klagen i realiteten gjaldt en tvist om forståelsen av en privatrettslig ', mark: null },
      { text: 'samarbeidsavtale', mark: 'F' },
      { text: ' mellom to leverandører, som faller utenfor nemndas kompetanse.', mark: null }
    ]
  },
  {
    id: 'k6', ref: 'KOFA-2023-999', source: 'Klagenemnda', date: '02. sep 2023',
    category: null, read_at: null,
    signals: [
      { type: 'R', detail: 'FOA §16-11' },
      { type: 'V', detail: 'Beslektet', explanation: 'Konseptuelt treff på: "krav til underleverandører ved felles tilbud"' }
    ],
    ai_screening: null,
    excerpt: [
      { text: 'Klagenemnda måtte i denne saken ta stilling til om det var adgang til å kreve at samtlige medlemmer av en leverandørgruppering, jf. ', mark: null },
      { text: 'FOA § 16-11', mark: 'R' },
      { text: ', skulle signere en likelydende egenerklæring.', mark: null }
    ]
  }
];

const MARK_STYLES = {
  R: { bg: 'var(--paper-dark)', border: 'var(--border-strong)', color: 'var(--ink)' },
  F: { bg: 'var(--signal-fts-bg)', border: 'var(--signal-fts-border)', color: 'var(--signal-fts)' },
  V: { bg: 'var(--ai-bg)', border: 'var(--ai-border)', color: 'var(--ai-accent)' }
};

// --- COMPONENTS ---

const SignalBadge = ({ type, detail, explanation }) => {
  if (!detail) return null;
  const cm = {
    R: { color: 'var(--ink-secondary)', border: 'var(--border)', bg: 'var(--paper-dark)' },
    F: { color: 'var(--signal-fts)', border: 'var(--signal-fts-border)', bg: 'var(--signal-fts-bg)' },
    V: { color: 'var(--ai-accent)', border: 'var(--ai-border)', bg: 'var(--ai-bg)' }
  };
  const s = cm[type];
  return (
    <div className="font-mono signal-badge" style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 6px', fontSize: 10.5, lineHeight: 1.4,
      color: s.color, border: `1px solid ${s.border}`, background: s.bg,
      cursor: 'default', position: 'relative'
    }}>
      <span style={{ fontWeight: 700, opacity: 0.6 }}>[{type}]</span>
      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
      {explanation && (
        <div className="signal-tooltip font-sans" style={{
          position: 'absolute', left: 0, bottom: '100%', marginBottom: 4,
          display: 'none', width: 200, zIndex: 50,
          background: 'var(--ink)', color: 'var(--paper)',
          fontSize: 11, padding: 8, borderRadius: 3,
          pointerEvents: 'none', whiteSpace: 'normal'
        }}>{explanation}</div>
      )}
    </div>
  );
};

const CategoryBadge = ({ category }) => {
  const base = {
    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700, borderRadius: 2, cursor: 'pointer',
    transition: 'all 0.15s ease', fontFamily: "'JetBrains Mono', monospace"
  };
  const v = {
    A: { background: 'var(--ink)', color: 'var(--paper)', border: '1px solid transparent' },
    B: { background: 'var(--paper-dark)', color: 'var(--ink)', border: '1px solid var(--border)' },
    C: { background: 'transparent', color: 'var(--ink-muted)', border: '1px solid var(--border)', opacity: 0.6 },
    null: { background: 'transparent', color: 'var(--ink-muted)', border: '1px dashed var(--border-strong)' }
  };
  return <button style={{ ...base, ...(v[category] || v.null) }}>{category || '–'}</button>;
};

const ExcerptWithMarkers = ({ parts }) => (
  <p>{parts.map((part, i) => {
    if (!part.mark) return <span key={i}>{part.text}</span>;
    const ms = MARK_STYLES[part.mark];
    return <span key={i} style={{ background: ms.bg, borderBottom: `1.5px solid ${ms.border}`, padding: '0 2px', cursor: 'pointer' }} title={`${part.mark}-treff`}>{part.text}</span>;
  })}</p>
);

// Collapsible section header
const ScopeSection = ({ label, open, onToggle, aiOwned, children }) => (
  <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
    <button
      onClick={onToggle}
      className="font-mono scope-section-header"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: aiOwned ? 'var(--ai-accent)' : 'var(--ink-muted)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        transition: 'color 0.15s ease', fontWeight: 600
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {aiOwned && <Sparkles style={{ width: 10, height: 10 }} />}
        {label}
      </span>
      <ChevronDown style={{
        width: 12, height: 12,
        transform: open ? 'rotate(0)' : 'rotate(-90deg)',
        transition: 'transform 0.2s ease'
      }} />
    </button>
    {open && <div style={{ padding: '0 20px 16px' }}>{children}</div>}
  </div>
);

// Context chip
const ContextChip = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span className="font-sans" style={{ fontSize: 10, color: 'var(--ink-muted)', fontWeight: 500 }}>{label}</span>
    {value ? (
      <span className="font-sans editable-field" style={{
        fontSize: 12, color: 'var(--ink-secondary)', fontWeight: 500,
        padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 2,
        cursor: 'text', display: 'inline-block'
      }}>{value}</span>
    ) : (
      <span className="font-sans" style={{
        fontSize: 12, color: 'var(--ink-muted)', fontStyle: 'italic',
        padding: '2px 8px', border: '1px dashed var(--border)', borderRadius: 2,
        cursor: 'pointer', display: 'inline-block'
      }}>Ikke spesifisert</span>
    )}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('all');
  const [isScopeOpen, setIsScopeOpen] = useState(true);
  const [expandedAiRow, setExpandedAiRow] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [openSections, setOpenSections] = useState({
    problem: true, sub: true, context: false, provisions: true, strategy: true, reasoning: false
  });

  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const visibleCases = activeTab === 'all'
    ? workingRegister
    : workingRegister.filter(c => activeTab === 'null' ? c.category === null : c.category === activeTab);

  const openCase = (c) => { setSelectedCase(c); if (c) setIsScopeOpen(false); };
  const toggleScope = () => { setIsScopeOpen(prev => { if (!prev) setSelectedCase(null); return !prev; }); };
  const toggleAiExpanded = (id, e) => { e.stopPropagation(); setExpandedAiRow(prev => prev === id ? null : id); };
  const toggleRowSelection = (id, e) => { e.stopPropagation(); setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]); };
  const toggleAllSelection = () => { setSelectedRows(prev => prev.length === visibleCases.length ? [] : visibleCases.map(c => c.id)); };
  const getSignalsByType = (signals, type) => signals.filter(s => s.type === type);

  const primaryProvisions = scopeData.provisions.filter(p => p.primary);
  const secondaryProvisions = scopeData.provisions.filter(p => !p.primary);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap');

        :root {
          --ink: #1C1B1A; --ink-secondary: #33312E; --ink-tertiary: #4A4843; --ink-muted: #7A766F;
          --paper: #F8F6F1; --paper-dark: #EDEAE3;
          --border-subtle: rgba(28,27,26,0.06); --border: rgba(28,27,26,0.12);
          --border-strong: rgba(28,27,26,0.20); --border-stronger: rgba(28,27,26,0.35);
          --control-bg: #EDEAE3; --control-border: rgba(28,27,26,0.12);
          --ai-accent: #92600A; --ai-border: rgba(146,96,10,0.20); --ai-bg: rgba(146,96,10,0.05);
          --signal-fts: #4A6A8B; --signal-fts-border: rgba(74,106,139,0.25); --signal-fts-bg: rgba(74,106,139,0.06);
          --hover-bg: rgba(28,27,26,0.02); --hover-bg-strong: rgba(28,27,26,0.04);
          --header-bg: rgba(248,246,241,0.92); --row-active-bg: rgba(28,27,26,0.04);
          --selection-bg: rgba(146,96,10,0.08);
          --noise-svg: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
        }
        .dark {
          --ink: #E2DFD6; --ink-secondary: #C4C0B5; --ink-tertiary: #8E8A80; --ink-muted: #5C5850;
          --paper: #1E1C19; --paper-dark: #16140F;
          --border-subtle: rgba(232,229,220,0.06); --border: rgba(232,229,220,0.10);
          --border-strong: rgba(232,229,220,0.16); --border-stronger: rgba(232,229,220,0.28);
          --control-bg: #262420; --control-border: rgba(232,229,220,0.12);
          --ai-accent: #C49A4E; --ai-border: rgba(196,154,78,0.25); --ai-bg: rgba(196,154,78,0.08);
          --signal-fts: #8BAAC4; --signal-fts-border: rgba(139,170,196,0.25); --signal-fts-bg: rgba(139,170,196,0.08);
          --hover-bg: rgba(232,229,220,0.03); --hover-bg-strong: rgba(232,229,220,0.06);
          --header-bg: rgba(30,28,25,0.92); --row-active-bg: rgba(232,229,220,0.05);
          --selection-bg: rgba(196,154,78,0.10);
          --noise-svg: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E");
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--paper); color: var(--ink); }
        .font-sans { font-family: 'Albert Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-serif { font-family: 'Newsreader', serif; }
        ::selection { background: var(--selection-bg); color: var(--ai-accent); }

        .dense-row {
          display: grid;
          grid-template-columns: 24px 28px minmax(140px,1.6fr) 88px minmax(70px,1fr) minmax(70px,1fr) minmax(70px,1fr) 40px;
          gap: 12px; align-items: start;
        }
        .register-row { border-bottom: 1px solid var(--border-subtle); cursor: pointer; transition: background 0.15s ease; }
        .register-row:hover { background: var(--hover-bg); }
        .case-dimmed { opacity: 0.4; transition: opacity 0.15s ease; }
        .case-dimmed:hover { opacity: 0.85; }
        .signal-badge:hover .signal-tooltip { display: block !important; }

        .nav-btn {
          width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
          border-radius: 3px; border: 1px solid transparent; cursor: pointer;
          transition: all 0.15s ease; background: transparent; color: var(--ink-muted);
        }
        .nav-btn:hover { color: var(--ink); background: var(--hover-bg); }
        .nav-btn:active { transform: scale(0.95); }
        .nav-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--border-stronger); }
        .nav-btn.active { color: var(--ink); background: var(--paper-dark); border-color: var(--border); }

        .tab-toggle { display: flex; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
        .tab-toggle .tab-sep { width: 1px; align-self: stretch; background: var(--border); }
        .tab-btn {
          padding: 4px 10px; font-family: 'Albert Sans', sans-serif; font-size: 11px; font-weight: 500;
          border: none; background: transparent; color: var(--ink-muted); cursor: pointer;
          white-space: nowrap; transition: all 0.15s ease;
        }
        .tab-btn:hover { color: var(--ink-secondary); background: var(--hover-bg); }
        .tab-btn:active { transform: scale(0.97); }
        .tab-btn.active { background: var(--paper-dark); color: var(--ink); }
        /* Category letter in tab — mono, smaller */
        .tab-cat { font-family: 'JetBrains Mono', monospace; font-size: 10px; opacity: 0.5; margin-left: 2px; }

        .action-btn {
          display: inline-flex; align-items: center; gap: 4px;
          font-family: 'Albert Sans', sans-serif; font-size: 11px; font-weight: 500;
          padding: 4px 12px; border-radius: 2px; cursor: pointer; transition: all 0.15s ease;
          border: 1px solid var(--border); background: transparent; color: var(--ink-tertiary);
        }
        .action-btn:hover { border-color: var(--border-strong); color: var(--ink); }
        .action-btn:active { transform: scale(0.98); }
        .action-btn:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--border-stronger); }
        .action-btn-ai { border-color: var(--ai-border); color: var(--ai-accent); }
        .action-btn-ai:hover { border-color: var(--ai-accent); background: var(--ai-bg); }

        .btn-primary-full {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
          font-family: 'Albert Sans', sans-serif; font-size: 12px; font-weight: 500;
          padding: 8px 16px; border-radius: 2px; cursor: pointer; transition: all 0.15s ease;
          background: var(--ink); color: var(--paper); border: 1.5px solid transparent;
        }
        .btn-primary-full:hover { background: #000; }
        .btn-primary-full:active { transform: scale(0.98); }
        .dark .btn-primary-full { background: transparent; color: var(--ink-secondary); border-color: var(--border-strong); }
        .dark .btn-primary-full:hover { background: var(--hover-bg-strong); color: var(--ink); border-color: var(--border-stronger); }

        .mode-toggle {
          width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border);
          background: transparent; color: var(--ink-tertiary); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;
        }
        .mode-toggle:hover { color: var(--ink); border-color: var(--border-strong); }

        .logo-home:hover { border-color: var(--border-strong) !important; }
        .logo-home:active { transform: scale(0.95); }

        .provision-tag {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink);
          background: var(--paper-dark); border: 1px solid var(--border); padding: 2px 8px;
        }

        /* Scope panel: section headers */
        .scope-section-header:hover { color: var(--ink-tertiary) !important; }

        /* Editable field affordance — subtle dashed border on hover */
        .editable-field { transition: border-color 0.15s ease; }
        .editable-field:hover { border-color: var(--border-strong) !important; }

        /* Provision with reason tooltip */
        .prov-row { position: relative; }
        .prov-reason { display: none; position: absolute; left: 0; top: 100%; margin-top: 4px;
          width: 260px; z-index: 50; background: var(--ink); color: var(--paper);
          font-family: 'Albert Sans', sans-serif; font-size: 11px; padding: 8px; border-radius: 3px;
          pointer-events: none; white-space: normal; line-height: 1.4;
        }
        .prov-row:hover .prov-reason { display: block; }

        .slide-in { opacity: 0; transform: translateX(16px); animation: slideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes slideIn { to { opacity: 1; transform: translateX(0); } }
        .fade-up { opacity: 0; transform: translateY(8px); animation: fadeUp 0.25s ease-out forwards; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
      `}} />

      <div className={darkMode ? 'dark' : ''} style={{
        height: '100vh', width: '100%', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', backgroundColor: 'var(--paper)', color: 'var(--ink)',
        colorScheme: darkMode ? 'dark' : 'light', backgroundImage: 'var(--noise-svg)',
        fontFamily: "'Albert Sans', sans-serif"
      }}>
        {/* ─── HEADER ─── */}
        <header style={{
          height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--header-bg)', backdropFilter: 'blur(12px)', flexShrink: 0, zIndex: 30
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <button className="logo-home" title="Tilbake til porteføljen" style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--ink)', borderRadius: 4, flexShrink: 0, background: 'transparent', cursor: 'pointer', transition: 'border-color 0.15s ease' }}>
              <span className="font-serif" style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 13, lineHeight: 1 }}>§</span>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
            <h1 className="font-serif" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={scopeData.refinedProblem}>
              {scopeData.refinedProblem}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button className="mode-toggle" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Sun style={{ width: 14, height: 14 }} /> : <Moon style={{ width: 14, height: 14 }} />}
            </button>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--paper-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--ink-secondary)' }}>MJ</div>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* ─── NAV RAIL ─── */}
          <nav style={{ width: 48, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', flexShrink: 0, gap: 4 }}>
            <button onClick={toggleScope} className={`nav-btn ${isScopeOpen ? 'active' : ''}`} title="Scope"><Search style={{ width: 16, height: 16 }} /></button>
            <button className="nav-btn active" style={{ position: 'relative' }} title="Arbeidsregister">
              <List style={{ width: 16, height: 16 }} />
              <div style={{ position: 'absolute', top: 6, right: 6, width: 5, height: 5, borderRadius: '50%', background: 'var(--ai-accent)' }} />
            </button>
            <button className="nav-btn" title="Grafvisning"><Network style={{ width: 16, height: 16 }} /></button>
            <button className="nav-btn" title="Rettssetninger"><BookOpen style={{ width: 16, height: 16 }} /></button>
            <div style={{ marginTop: 'auto' }}><button className="nav-btn" title="Notat"><PenTool style={{ width: 16, height: 16 }} /></button></div>
          </nav>

          {/* ─── SCOPE PANEL (360px, structured from scoping prompt) ─── */}
          {isScopeOpen && (
            <aside style={{ width: 360, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', paddingBottom: 40 }}>

              {/* 1. PROBLEMSTILLING */}
              <ScopeSection label="Problemstilling" open={openSections.problem} onToggle={() => toggleSection('problem')}>
                <div className="font-serif editable-field" style={{
                  fontSize: 15, lineHeight: 1.55, color: 'var(--ink)', fontWeight: 500,
                  padding: 8, border: '1px solid transparent', borderRadius: 2, cursor: 'text',
                  marginBottom: 12
                }}>
                  {scopeData.refinedProblem}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles style={{ width: 10, height: 10, color: 'var(--ai-accent)', flexShrink: 0 }} />
                  <span className="font-sans" style={{ fontSize: 10, color: 'var(--ai-accent)' }}>Spisset av KI fra:</span>
                  <span className="font-sans" style={{ fontSize: 10, color: 'var(--ink-muted)', fontStyle: 'italic' }}>«{scopeData.originalProblem.substring(0, 60)}…»</span>
                </div>
              </ScopeSection>

              {/* 2. DELSPØRSMÅL */}
              <ScopeSection label="Delspørsmål" open={openSections.sub} onToggle={() => toggleSection('sub')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {scopeData.subProblems.map((sp, i) => (
                    <div key={sp.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-muted)', flexShrink: 0, width: 16, textAlign: 'right' }}>{i + 1}.</span>
                      <span className="font-serif editable-field" style={{
                        fontSize: 14, color: 'var(--ink-secondary)', lineHeight: 1.45, flex: 1,
                        padding: '2px 4px', border: '1px solid transparent', borderRadius: 2, cursor: 'text'
                      }}>{sp.text}</span>
                    </div>
                  ))}
                  <button className="font-sans" style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginLeft: 24,
                    fontSize: 11, color: 'var(--ink-muted)', background: 'none',
                    border: 'none', cursor: 'pointer', padding: '4px 0', transition: 'color 0.15s'
                  }}><Plus style={{ width: 11, height: 11 }} /> Legg til delspørsmål</button>
                </div>
              </ScopeSection>

              {/* 3. KONTEKST (collapsed by default) */}
              <ScopeSection label="Kontekst" open={openSections.context} onToggle={() => toggleSection('context')}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <ContextChip label="Prosedyre" value={scopeData.context.procedure} />
                  <ContextChip label="Terskelverdi" value={scopeData.context.threshold} />
                  <ContextChip label="Tjenesteområde" value={scopeData.context.service_area} />
                  <ContextChip label="Marked" value={scopeData.context.market} />
                </div>
              </ScopeSection>

              {/* 4. BESTEMMELSER */}
              <ScopeSection label="Bestemmelser" open={openSections.provisions} onToggle={() => toggleSection('provisions')}>
                {/* Primary */}
                <div style={{ marginBottom: 16 }}>
                  <div className="font-sans" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Primære</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {primaryProvisions.map(p => (
                      <div key={p.ref} className="prov-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="provision-tag">{p.ref}</span>
                        <span className="font-sans" style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>{p.label}</span>
                        <div className="prov-reason">{p.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Secondary */}
                <div style={{ marginBottom: 12 }}>
                  <div className="font-sans" style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Sekundære</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {secondaryProvisions.map(p => (
                      <div key={p.ref} className="prov-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-muted)', border: '1px dashed var(--border-strong)', padding: '2px 8px' }}>{p.ref}</span>
                        <span className="font-sans" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{p.label}</span>
                        <div className="prov-reason">{p.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="font-sans" style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: 'var(--ink-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '4px 0', transition: 'color 0.15s'
                }}><Plus style={{ width: 11, height: 11 }} /> Legg til bestemmelse</button>
              </ScopeSection>

              {/* 5. SØKESTRATEGI */}
              <ScopeSection label="Søkestrategi" open={openSections.strategy} onToggle={() => toggleSection('strategy')}>
                {/* Ref [R] */}
                <div style={{ marginBottom: 16 }}>
                  <div className="font-sans" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink-muted)' }} /> Referansesøk [R]
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {scopeData.searchStrategy.refTable.map((r, i) => <span key={i} className="provision-tag">{r}</span>)}
                  </div>
                </div>
                {/* FTS [F] */}
                <div style={{ marginBottom: 16 }}>
                  <div className="font-sans" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--signal-fts)' }} /> Fulltekstsøk [F]
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {scopeData.searchStrategy.fts.map((t, i) => <span key={i} className="provision-tag">{t}</span>)}
                  </div>
                </div>
                {/* Vector [V] */}
                <div style={{ marginBottom: 16 }}>
                  <div className="font-sans" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ai-accent)' }} /> Vektorsøk [V]
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {scopeData.searchStrategy.vector.map((v, i) => (
                      <div key={i} className="font-serif editable-field" style={{
                        fontSize: 13, fontStyle: 'italic', color: 'var(--ink-tertiary)', lineHeight: 1.5,
                        borderLeft: '2px solid var(--ai-border)', paddingLeft: 12, padding: '4px 4px 4px 12px',
                        border: '1px solid transparent', borderLeftColor: 'var(--ai-border)', cursor: 'text'
                      }}>{v}</div>
                    ))}
                  </div>
                </div>
                {/* Forarbeider */}
                <div>
                  <div className="font-sans" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>Forarbeider</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {scopeData.searchStrategy.prepWork.map((p, i) => <span key={i} className="provision-tag">{p}</span>)}
                    <button className="font-mono" style={{
                      fontSize: 11, color: 'var(--ink-muted)', border: '1px dashed var(--border-strong)',
                      background: 'transparent', padding: '2px 8px', cursor: 'pointer', transition: 'all 0.15s'
                    }}>+ Legg til</button>
                  </div>
                </div>
              </ScopeSection>

              {/* 6. RESONNEMENT (AI-owned, collapsed by default) */}
              <ScopeSection label="KI-resonnement" open={openSections.reasoning} onToggle={() => toggleSection('reasoning')} aiOwned>
                <div style={{ borderLeft: '2px solid var(--ai-border)', paddingLeft: 12 }}>
                  <p className="font-serif" style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--ink-tertiary)', lineHeight: 1.6 }}>
                    {scopeData.reasoning}
                  </p>
                </div>
              </ScopeSection>
            </aside>
          )}

          {/* ─── MAIN REGISTER ─── */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {/* Tab bar with A/B/C labels */}
            <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div className="tab-toggle">
                {[
                  ['all', 'Alle', null, counts.total],
                  ['null', 'Uvurdert', '–', counts.null],
                  ['A', 'Kjernesak', 'A', counts.A],
                  ['B', 'Støttesak', 'B', counts.B],
                  ['C', 'Kontekstsak', 'C', counts.C]
                ].map(([key, label, cat, count], i, arr) => (
                  <React.Fragment key={key}>
                    <button onClick={() => setActiveTab(key)} className={`tab-btn ${activeTab === key ? 'active' : ''}`}>
                      {label}{cat && <span className="tab-cat"> · {cat}</span>} ({count})
                    </button>
                    {i < arr.length - 1 && <div className="tab-sep" />}
                  </React.Fragment>
                ))}
              </div>
              {activeTab === 'null' && (
                <button className="action-btn action-btn-ai"><Sparkles style={{ width: 12, height: 12 }} /> Screen {counts.null} uvurderte</button>
              )}
            </div>

            {/* Column headers */}
            <div className="dense-row font-mono" style={{
              padding: '8px 20px', borderBottom: '1px solid var(--border)',
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--ink-muted)', flexShrink: 0, alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={toggleAllSelection}>
                {selectedRows.length === visibleCases.length && visibleCases.length > 0 ? <CheckSquare style={{ width: 14, height: 14 }} /> : <Square style={{ width: 14, height: 14 }} />}
              </div>
              <div>Kat</div><div>Referanse</div><div>Innsikt</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink-muted)', flexShrink: 0 }} />Ref</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--signal-fts)', flexShrink: 0 }} />Ord</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ai-accent)', flexShrink: 0 }} />Konsept</div>
              <div style={{ textAlign: 'right' }}>Lest</div>
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
              {visibleCases.map((c) => {
                const isDimmed = c.category === 'C';
                const isExpanded = expandedAiRow === c.id;
                const isActive = selectedCase?.id === c.id;
                const isChecked = selectedRows.includes(c.id);
                const rS = getSignalsByType(c.signals, 'R');
                const fS = getSignalsByType(c.signals, 'F');
                const vS = getSignalsByType(c.signals, 'V');
                return (
                  <div key={c.id} className={`register-row ${isDimmed && !isActive && !isChecked ? 'case-dimmed' : ''}`}
                    onClick={() => openCase(c)}
                    style={{ display: 'flex', flexDirection: 'column',
                      ...(isActive ? { background: 'var(--row-active-bg)', boxShadow: 'inset 2px 0 0 var(--ink)' } : {}),
                      ...(isChecked && !isActive ? { background: 'var(--ai-bg)', boxShadow: 'inset 2px 0 0 var(--ai-accent)' } : {})
                    }}>
                    <div className="dense-row" style={{ padding: '12px 20px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)' }} onClick={(e) => toggleRowSelection(c.id, e)}>
                        {isChecked ? <CheckSquare style={{ width: 16, height: 16, color: 'var(--ai-accent)' }} /> : <Square style={{ width: 16, height: 16 }} />}
                      </div>
                      <div onClick={(e) => e.stopPropagation()}><CategoryBadge category={c.category} /></div>
                      <div>
                        <div className="font-serif" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>{c.ref}</div>
                        <div className="font-sans" style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 2 }}>{c.source} · {c.date}</div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        {c.ai_screening?.proposition ? (
                          <button onClick={(e) => toggleAiExpanded(c.id, e)} className={`action-btn ${isExpanded ? 'action-btn-ai' : ''}`} style={{ fontSize: 11 }}>
                            <Sparkles style={{ width: 11, height: 11 }} /> {isExpanded ? 'Skjul' : 'KI-innsikt'}
                          </button>
                        ) : <span className="font-sans" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>–</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{rS.length > 0 ? rS.map((s, i) => <SignalBadge key={i} {...s} />) : <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>–</span>}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{fS.length > 0 ? fS.map((s, i) => <SignalBadge key={i} {...s} />) : <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>–</span>}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{vS.length > 0 ? vS.map((s, i) => <SignalBadge key={i} {...s} />) : <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>–</span>}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                        {c.read_at ? <Eye style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--signal-fts)' }} title="Ulest" />}
                        {isActive && <ChevronRight style={{ width: 14, height: 14, color: 'var(--ink)' }} />}
                      </div>
                    </div>
                    {isExpanded && c.ai_screening && (
                      <div style={{ padding: '0 20px 12px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ marginLeft: 64, marginRight: 52, border: '1px solid var(--ai-border)', background: 'var(--ai-bg)', padding: 12, borderRadius: 3 }}>
                          <div className="font-sans" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ai-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>KI foreslår: Kategori {c.ai_screening.category}</div>
                          <div className="font-serif" style={{ fontSize: 15, fontStyle: 'italic', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>{c.ai_screening.proposition}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bulk bar */}
            {selectedRows.length > 0 && (
              <div className="fade-up" style={{
                position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                background: '#1C1B1A', color: '#F8F6F1', padding: '10px 16px', borderRadius: 4,
                display: 'flex', alignItems: 'center', gap: 16, zIndex: 20, border: '1px solid rgba(248,246,241,0.1)'
              }}>
                <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, color: '#9E9A93' }}>{selectedRows.length} valgt</span>
                <div style={{ width: 1, height: 16, background: 'rgba(248,246,241,0.15)' }} />
                <button className="font-sans" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: '#F8F6F1', background: 'none', border: 'none', cursor: 'pointer' }}><Sparkles style={{ width: 12, height: 12 }} /> Screen med KI</button>
                <button className="font-sans" style={{ fontSize: 12, fontWeight: 500, color: '#9E9A93', background: 'none', border: 'none', cursor: 'pointer' }}>Sett kategori…</button>
                <button className="font-sans" style={{ fontSize: 12, fontWeight: 500, color: '#9E9A93', background: 'none', border: 'none', cursor: 'pointer' }}>Marker som lest</button>
                <button onClick={() => setSelectedRows([])} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#7A766F', borderRadius: 2 }}><X style={{ width: 14, height: 14 }} /></button>
              </div>
            )}
          </main>

          {/* ─── READING PANEL ─── */}
          {selectedCase && (
            <aside className="slide-in" style={{ width: 420, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 }}>
              <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-muted)', marginBottom: 4 }}>Lesevisning</div>
                  <h2 className="font-serif" style={{ fontSize: 22, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2 }}>{selectedCase.ref}</h2>
                  <div className="font-sans" style={{ fontSize: 11, color: 'var(--ink-tertiary)', marginTop: 4 }}>{selectedCase.source} · {selectedCase.date}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="action-btn" style={{ padding: 4, border: 'none' }} title="Fullskjerm"><Maximize2 style={{ width: 16, height: 16 }} /></button>
                  <button className="action-btn" style={{ padding: 4, border: 'none' }} onClick={() => setSelectedCase(null)} title="Lukk"><X style={{ width: 16, height: 16 }} /></button>
                </div>
              </header>
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 48 }}>
                {!selectedCase.read_at && selectedCase.ai_screening && (
                  <div style={{ margin: 20, border: '1px solid var(--ai-border)', padding: 16, borderRadius: 3 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <Sparkles style={{ width: 16, height: 16, color: 'var(--ai-accent)', marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div className="font-sans" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ai-accent)', marginBottom: 4 }}>KI-vurdering: Kategori {selectedCase.ai_screening.category}</div>
                        <p className="font-serif" style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--ink-secondary)', lineHeight: 1.5, marginBottom: 12 }}>{selectedCase.ai_screening.proposition}</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="action-btn action-btn-ai"><Check style={{ width: 12, height: 12 }} /> Godkjenn</button>
                          <button className="action-btn">Endre</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {!selectedCase.ai_screening && (
                  <div style={{ margin: 20, border: '1px dashed var(--ai-border)', padding: 24, borderRadius: 3, textAlign: 'center' }}>
                    <Sparkles style={{ width: 20, height: 20, color: 'var(--ai-accent)', margin: '0 auto 8px', opacity: 0.7 }} />
                    <div className="font-sans" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>Ingen KI-vurdering ennå</div>
                    <p className="font-serif" style={{ fontSize: 14, color: 'var(--ink-tertiary)', marginBottom: 16 }}>Vil du at maskinen skal skumlese saken og foreslå kategori og rettssetning?</p>
                    <button className="action-btn action-btn-ai" style={{ padding: '6px 16px' }}><Sparkles style={{ width: 12, height: 12 }} /> Analyser saken</button>
                  </div>
                )}
                <div style={{ padding: '8px 20px 20px' }}>
                  <h3 className="font-sans" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 16 }}>Utdrag fra avgjørelsen</h3>
                  <div className="font-serif" style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--ink-secondary)' }}>
                    <ExcerptWithMarkers parts={selectedCase.excerpt} />
                  </div>
                  <div style={{ marginTop: 32, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                    <button className="btn-primary-full"><BookOpen style={{ width: 14, height: 14 }} /> Marker som Rettssetning</button>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}

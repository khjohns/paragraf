import React, { useState } from 'react';
import {
  Search, List, Network, BookOpen, PenTool, Sparkles,
  Check, X, Edit3, AlertTriangle, Star, Plus, Sun, Moon,
  ChevronDown, Scale, Link2
} from 'lucide-react';

/*
  PARAGRAF — Rettssetningsregister v3
  
  Seven additions from cross-propositions analysis:
  1. Tensions — visual links between conflicting propositions
  2. Evolution — 4 states: established, confirmed, qualified, consolidating
  3. Suggested — AI-interpreted links marked with Sparkles
  4. Thematic ordering — grouped by theme, core → peripheral
  5. Boundary notes — cases that define limits of a proposition
  6. Lineage — original per-case screening propositions
  7. Regulation — which legal framework each case was decided under
*/

// --- MOCK DATA (enriched with all 7 fields) ---
const themes = [
  'Solidaransvar og samarbeidsavtale',
  'Støtte på kapasitet',
  'Selskapsrettslig status'
];

const initialRules = [
  {
    id: 'rs1',
    theme: 'Solidaransvar og samarbeidsavtale',
    topic: 'Tidspunkt for samarbeidsavtale',
    proposition: 'Solidaransvar forutsettes ved deltakelse som leverandørgruppering. Det er imidlertid tilstrekkelig at en formalisert samarbeidsavtale foreligger før kontraktsignering, ikke nødvendigvis på tilbudstidspunktet.',
    isAiGenerated: false,
    lastEditedBy: 'Meg',
    yearSpan: '2016–2022',
    tension: null,
    boundaryNotes: [
      { caseId: 'KOFA-2018-12', note: 'Privatrettslig samarbeidsavtale mellom leverandører faller utenfor nemndas kompetanse og FOA § 16-11.' }
    ],
    cases: [
      {
        ref: 'KOFA-2016-104', year: '2016', paragraphs: 'avsnitt 33',
        evolution: 'established', star: false, suggested: false,
        regulation: 'FOA',
        screeningProposition: 'Felles innlevering av tilbud etablerer i seg selv et solidaransvar uten krav om formell selskapsavtale.',
        factum: 'Flere foretak innga felles tilbud, men manglet formell samarbeidsavtale ved tilbudsfristens utløp.',
        assessment: 'Klagenemnda etablerte at selve den felles innleveringen var tilstrekkelig for å anse grupperingen som forpliktende overfor oppdragsgiver i tilbudsfasen.',
        quotes: [{ p: '33', text: 'Nemnda finner at innlevering av et felles tilbud i seg selv etablerer et solidaransvar for de deltakende selskaper overfor oppdragsgiver, selv uten fremlagt selskapsavtale.' }],
        nuances: null
      },
      {
        ref: 'KOFA-2022-1200', year: '2022', paragraphs: '§ 16-11',
        evolution: 'confirmed', star: true, suggested: false,
        regulation: 'FOA',
        screeningProposition: 'Solidaransvar forutsettes ved leverandørgruppering. Samarbeidsavtale kan kreves først ved kontraktsignering.',
        factum: 'To selskaper innga felles tilbud uten å ha stiftet et formelt selskap.',
        assessment: 'Nemnda bekreftet tidligere praksis og slo fast at det ikke utgjorde et avvik fra FOA § 16-11 at samarbeidsavtalen først ble krevd fremlagt før selve signeringen.',
        quotes: [
          { p: '42', text: 'Når to eller flere selskaper velger å inngi et felles tilbud, etableres det i anskaffelsesrettslig forstand en leverandørgruppering som utløser et solidaransvar, uavhengig av den bakenforliggende selskapsrettslige organiseringen.' },
          { p: '45', text: 'Oppdragsgiver har rett til å kreve at grupperingen antar en bestemt juridisk form, men et slikt krav kan først gjøres gjeldende etter at kontrakt er tildelt.' }
        ],
        nuances: null
      }
    ]
  },
  {
    id: 'rs2',
    theme: 'Støtte på kapasitet',
    topic: 'Støtte på kapasitet vs. Underleverandør',
    proposition: 'En sammenslutning av foretak kan lovlig støtte seg på kapasiteten til de enkelte medlemmene for å oppfylle kvalifikasjonskrav, forutsatt at sammenslutningen faktisk råder over disse ressursene ved kontraktsgjennomføringen.',
    isAiGenerated: true,
    lastEditedBy: 'KI',
    yearSpan: '2014–2020',
    tension: { withId: 'rs1', note: 'Spenning mellom solidaransvar ved gruppering (rs1) og den mer fleksible adgangen til å støtte seg på kapasitet (rs2) — i grensetilfeller kan det være uklart om en konstellasjon er en gruppering eller et støtteforhold.' },
    boundaryNotes: [],
    cases: [
      {
        ref: 'C-396/14 (MT Højgaard)', year: '2014', paragraphs: 'Art. 44',
        evolution: 'established', star: true, suggested: false,
        regulation: 'Dir. 2004/18',
        screeningProposition: 'EU-domstolen bekrefter at en sammenslutning av foretak kan støtte seg på kapasiteten til de enkelte medlemmene.',
        factum: 'Et konsortium vant en anbudskonkurranse. Etter tildeling gikk ett av medlemmene konkurs.',
        assessment: 'EU-domstolen fastslo at en sammenslutning i utgangspunktet kan støtte seg på medlemmenes kapasitet. Dersom sammenslutningen endres, må gjenværende medlemmer uansett oppfylle kravene alene.',
        quotes: [{ p: '44', text: 'Direktiv 2004/18 er ikke til hinder for at en oppdragsgiver tillater en sammenslutning å støtte seg på kapasiteten til ett eller flere av sine medlemmer...' }],
        nuances: 'Domstolen presiserer at oppdragsgiver kan fastsette vilkår for hvordan denne kapasiteten skal dokumenteres, særlig dersom ressursene er kritiske for ytelsen.'
      },
      {
        ref: 'KOFA-2020-55', year: '2020', paragraphs: '§ 16-10',
        evolution: 'consolidating', star: false, suggested: false,
        regulation: 'FOA',
        screeningProposition: 'Trekker opp grensen mellom støtte på kapasitet (§16-10) og underleverandører.',
        factum: 'Valgte leverandør støttet seg på et morselskap for økonomisk kapasitet.',
        assessment: 'Nemnda godtok forpliktelseserklæringen, og trakk en tydelig grense mot underleverandører i gjennomføringsfasen, i tråd med EU-praksis.',
        quotes: [{ p: '28', text: 'Det må trekkes et klart skille mellom det å støtte seg på en annens kapasitet for å bli kvalifisert, og bruk av underleverandør for å utføre deler av selve kontraktsarbeidet.' }],
        nuances: null
      },
      {
        ref: 'KOFA-2021-312', year: '2021', paragraphs: '§ 16-10(3)',
        evolution: 'qualified', star: false, suggested: true,
        regulation: 'FOA',
        screeningProposition: 'Forpliktelseserklæring fra støtteforetak er ikke tilstrekkelig der kapasiteten gjelder nøkkelpersonell — reell disposisjonsrett må dokumenteres.',
        factum: 'Leverandør støttet seg på et konsulentselskaps nøkkelpersonell, men kunne ikke dokumentere reell rådighet.',
        assessment: 'Nemnda kvalifiserte rekkevidden av kapasitetsstøtte: ren erklæring uten avtalemessig binding er utilstrekkelig for kritiske ressurser.',
        quotes: [{ p: '36', text: 'Der støtten gjelder nøkkelpersonell som er avgjørende for ytelsen, kreves det mer enn en generell forpliktelseserklæring — det må foreligge en bindende avtale som sikrer reell disposisjonsrett.' }],
        nuances: 'Skillet mellom «generell kapasitet» og «nøkkelpersonell» er ikke etablert i EU-praksis og representerer en strengere norsk linje.'
      }
    ]
  },
  {
    id: 'rs3',
    theme: 'Selskapsrettslig status',
    topic: 'Selskapsrettslig status',
    proposition: 'Et konsortium opprettet kun for én spesifikk anbudskonkurranse utgjør ikke nødvendigvis et selskap i selskapslovens forstand, men representerer like fullt et forpliktende fellesskap overfor oppdragsgiver.',
    isAiGenerated: true,
    lastEditedBy: 'KI',
    yearSpan: '2019',
    tension: null,
    boundaryNotes: [],
    cases: [
      {
        ref: 'HR-2019-1801-A', year: '2019', paragraphs: 'avsnitt 52',
        evolution: 'established', star: false, suggested: false,
        regulation: 'Selskapsloven',
        screeningProposition: 'Høyesterett vurderer selskapsrettslig status for konsortier opprettet kun for én anbudskonkurranse.',
        factum: 'To selskaper inngikk avtale om felles anbud. Tvisten gjaldt intern fordeling av risiko.',
        assessment: 'Høyesterett kom til at det interne ansvarsforholdet berodde på en konkret tolkning av samarbeidsavtalen, og at selskapsloven ikke kom direkte til anvendelse.',
        quotes: [{ p: '52', text: 'Et samarbeid avgrenset til innlevering og eventuell gjennomføring av ett enkelt anbud, etablerer ikke uten videre et selskap etter selskapsloven § 1-1.' }],
        nuances: 'Dommen gjelder primært det indre ansvarsforholdet mellom partene (regress), og er bare analogt relevant for oppdragsgivers krav til solidaransvar utad.'
      }
    ]
  }
];

// --- EVOLUTION LABELS ---
const EVOLUTION = {
  established:    { label: 'Etablert',       css: 'tag-established' },
  confirmed:      { label: 'Bekreftet',      css: 'tag-confirmed' },
  qualified:      { label: 'Kvalifisert',    css: 'tag-qualified' },
  consolidating:  { label: 'Konsoliderende', css: 'tag-consolidating' }
};

// --- MAIN ---
export default function App() {
  const [rules, setRules] = useState(initialRules);
  const [selectedRuleId, setSelectedRuleId] = useState(initialRules[0].id);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editBuffer, setEditBuffer] = useState('');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [copiedQuoteId, setCopiedQuoteId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showLineage, setShowLineage] = useState({});
  const [showBoundary, setShowBoundary] = useState(false);

  const selectedRule = rules.find(r => r.id === selectedRuleId);

  const startEditing = (rule, e) => { e.stopPropagation(); setEditingRuleId(rule.id); setEditBuffer(rule.proposition); };
  const saveEdit = (id) => { setRules(rules.map(r => r.id === id ? { ...r, proposition: editBuffer, isAiGenerated: false, lastEditedBy: 'Meg' } : r)); setEditingRuleId(null); };
  const cancelEdit = () => { setEditingRuleId(null); setEditBuffer(''); };
  const handleRowClick = (id) => { if (editingRuleId === id) return; setSelectedRuleId(id); setIsInspectorOpen(true); setShowBoundary(false); setShowLineage({}); };
  const handleCopyQuote = (text, id) => { navigator.clipboard?.writeText(text).then(() => { setCopiedQuoteId(id); setTimeout(() => setCopiedQuoteId(null), 2000); }); };
  const toggleLineage = (ref) => setShowLineage(prev => ({ ...prev, [ref]: !prev[ref] }));

  // Group rules by theme in defined order
  const groupedByTheme = themes.map(theme => ({
    theme,
    rules: rules.filter(r => r.theme === theme)
  })).filter(g => g.rules.length > 0);

  const tensionRule = selectedRule?.tension ? rules.find(r => r.id === selectedRule.tension.withId) : null;

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
          --hover-bg: rgba(28,27,26,0.02); --hover-bg-strong: rgba(28,27,26,0.04);
          --header-bg: rgba(248,246,241,0.92); --row-active-bg: rgba(28,27,26,0.04);
          --nuance-color: #8B3A3A; --confirm-color: #375E37; --gold-star: #B8941E;
          --tension-color: #6B4C9A; --tension-border: rgba(107,76,154,0.20); --tension-bg: rgba(107,76,154,0.04);
          --qualified-color: #9E6A3A;
          --noise-svg: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
        }
        .dark {
          --ink: #E2DFD6; --ink-secondary: #C4C0B5; --ink-tertiary: #8E8A80; --ink-muted: #5C5850;
          --paper: #1E1C19; --paper-dark: #16140F;
          --border-subtle: rgba(232,229,220,0.06); --border: rgba(232,229,220,0.10);
          --border-strong: rgba(232,229,220,0.16); --border-stronger: rgba(232,229,220,0.28);
          --control-bg: #262420; --control-border: rgba(232,229,220,0.12);
          --ai-accent: #C49A4E; --ai-border: rgba(196,154,78,0.25); --ai-bg: rgba(196,154,78,0.08);
          --hover-bg: rgba(232,229,220,0.03); --hover-bg-strong: rgba(232,229,220,0.06);
          --header-bg: rgba(30,28,25,0.92); --row-active-bg: rgba(232,229,220,0.05);
          --nuance-color: #D47A7A; --confirm-color: #8BC48B; --gold-star: #D4B84E;
          --tension-color: #9B82C4; --tension-border: rgba(155,130,196,0.25); --tension-bg: rgba(155,130,196,0.06);
          --qualified-color: #D4A06A;
          --noise-svg: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E");
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .font-sans { font-family: 'Albert Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-serif { font-family: 'Newsreader', serif; }
        ::selection { background: var(--ai-bg); color: var(--ai-accent); }

        .nav-btn { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 3px; border: 1px solid transparent; cursor: pointer; transition: all 0.15s ease; background: transparent; color: var(--ink-muted); }
        .nav-btn:hover { color: var(--ink); background: var(--hover-bg); }
        .nav-btn:active { transform: scale(0.95); }
        .nav-btn.active { color: var(--ink); background: var(--paper-dark); border-color: var(--border); }

        .rule-row { display: grid; grid-template-columns: minmax(200px, 1fr) 112px 112px 36px; gap: 20px; align-items: start; }
        .register-row { border-bottom: 1px solid var(--border-subtle); cursor: pointer; transition: background 0.15s ease; }
        .register-row:hover { background: var(--hover-bg); }
        .register-row:hover .edit-btn { opacity: 1; }
        .edit-btn { opacity: 0; transition: opacity 0.15s ease; }

        .action-btn { display: inline-flex; align-items: center; gap: 4px; font-family: 'Albert Sans', sans-serif; font-size: 11px; font-weight: 500; padding: 4px 12px; border-radius: 2px; cursor: pointer; transition: all 0.15s ease; border: 1px solid var(--border); background: transparent; color: var(--ink-tertiary); }
        .action-btn:hover { border-color: var(--border-strong); color: var(--ink); }
        .action-btn:active { transform: scale(0.98); }

        .btn-primary { display: inline-flex; align-items: center; gap: 8px; font-family: 'Albert Sans', sans-serif; font-size: 12px; font-weight: 500; padding: 8px 16px; border-radius: 2px; cursor: pointer; transition: all 0.15s ease; background: var(--ink); color: var(--paper); border: 1.5px solid transparent; }
        .btn-primary:hover { background: #000; }
        .btn-primary:active { transform: scale(0.98); }
        .dark .btn-primary { background: transparent; color: var(--ink-secondary); border-color: var(--border-strong); }
        .dark .btn-primary:hover { background: var(--hover-bg-strong); color: var(--ink); border-color: var(--border-stronger); }

        .mode-toggle { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--border); background: transparent; color: var(--ink-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease; }
        .mode-toggle:hover { color: var(--ink); border-color: var(--border-strong); }

        .logo-home:hover { border-color: var(--border-strong) !important; }
        .logo-home:active { transform: scale(0.95); }

        .quote-block { background: var(--paper-dark); padding: 16px 20px; border: 1px solid var(--border); border-radius: 2px; }
        .quote-block .copy-btn { opacity: 0; transition: all 0.15s ease; }
        .quote-block:hover .copy-btn { opacity: 1; }
        .copy-btn:hover { color: var(--ink) !important; }

        /* Evolution tags — 4 states */
        .tag-evolution { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 1px 6px; border-radius: 2px; }
        .tag-established { border: 1px solid var(--border-strong); color: var(--ink-tertiary); }
        .tag-confirmed { border: 1px solid rgba(55,94,55,0.3); color: var(--confirm-color); }
        .tag-qualified { border: 1px solid var(--qualified-color); color: var(--qualified-color); border-style: dashed; }
        .tag-consolidating { border: 1px solid var(--border); color: var(--ink-muted); }

        .text-link { font-family: 'Albert Sans', sans-serif; font-size: 12px; font-weight: 500; color: var(--ink-muted); background: none; border: none; cursor: pointer; transition: color 0.15s ease; padding: 4px 0; }
        .text-link:hover { color: var(--ink); }

        /* Collapsible toggle */
        .collapse-toggle { display: flex; align-items: center; gap: 6px; font-family: 'Albert Sans', sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-muted); background: none; border: none; cursor: pointer; padding: 8px 0; transition: color 0.15s ease; width: 100%; }
        .collapse-toggle:hover { color: var(--ink-tertiary); }
      `}} />

      <div className={darkMode ? 'dark' : ''} style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--paper)', color: 'var(--ink)', colorScheme: darkMode ? 'dark' : 'light', backgroundImage: 'var(--noise-svg)', fontFamily: "'Albert Sans', sans-serif" }}>

        {/* ─── HEADER ─── */}
        <header style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--header-bg)', backdropFilter: 'blur(12px)', flexShrink: 0, zIndex: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <button className="logo-home" title="Tilbake til porteføljen" style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid var(--ink)', borderRadius: 4, flexShrink: 0, background: 'transparent', cursor: 'pointer', transition: 'border-color 0.15s ease' }}>
              <span className="font-serif" style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 13, lineHeight: 1 }}>§</span>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
            <h1 className="font-serif" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11?">Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11?</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button className="btn-primary" style={{ padding: '4px 16px' }}>Eksportér til Notat</button>
            <button className="mode-toggle" onClick={() => setDarkMode(!darkMode)}>{darkMode ? <Sun style={{ width: 14, height: 14 }} /> : <Moon style={{ width: 14, height: 14 }} />}</button>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--paper-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'var(--ink-secondary)' }}>MJ</div>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* ─── NAV RAIL ─── */}
          <nav style={{ width: 48, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', flexShrink: 0, gap: 4 }}>
            <button className="nav-btn" title="Scope"><Search style={{ width: 16, height: 16 }} /></button>
            <button className="nav-btn" title="Arbeidsregister"><List style={{ width: 16, height: 16 }} /></button>
            <button className="nav-btn" title="Grafvisning"><Network style={{ width: 16, height: 16 }} /></button>
            <button className="nav-btn active" title="Rettssetninger"><BookOpen style={{ width: 16, height: 16 }} /></button>
            <div style={{ marginTop: 'auto' }}><button className="nav-btn" title="Notat"><PenTool style={{ width: 16, height: 16 }} /></button></div>
          </nav>

          {/* ─── REGISTER ─── */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 12px', flexShrink: 0, borderBottom: '2px solid var(--ink)' }}>
              <h2 className="font-serif" style={{ fontSize: 24, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Rettssetninger</h2>
              <p className="font-sans" style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginTop: 4 }}>
                {rules.length} rettssetninger i {themes.length} temaer — {rules.filter(r => r.isAiGenerated).length} KI-foreslåtte · {rules.filter(r => r.tension).length} spenning{rules.filter(r => r.tension).length !== 1 ? 'er' : ''}
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* (4) THEMATIC ORDERING — grouped by theme, core → peripheral */}
              {groupedByTheme.map((group, gi) => (
                <div key={group.theme}>
                  {/* Theme header */}
                  <div style={{ padding: '16px 24px 8px', borderBottom: '1px solid var(--border)' }}>
                    <h3 className="font-serif" style={{ fontSize: gi === 0 ? 18 : 16, fontStyle: 'italic', fontWeight: 400, color: gi === 0 ? 'var(--ink-secondary)' : 'var(--ink-tertiary)' }}>
                      {group.theme}
                    </h3>
                  </div>

                  {group.rules.map((r) => {
                    const isSelected = selectedRuleId === r.id;
                    const isEditing = editingRuleId === r.id;
                    const starCount = r.cases.filter(c => c.star).length;
                    const hasTension = !!r.tension;

                    return (
                      <div key={r.id} onClick={() => handleRowClick(r.id)} className="register-row"
                        style={{
                          ...(isSelected ? { background: 'var(--row-active-bg)', boxShadow: 'inset 3px 0 0 var(--ink)' } : {}),
                          ...(r.isAiGenerated && !isSelected ? { boxShadow: 'inset 3px 0 0 var(--ai-border)' } : {})
                        }}>
                        <div className="rule-row" style={{ padding: '16px 24px' }}>
                          {/* Col 1: Proposition */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div className="font-mono" style={{ fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              <span style={{ color: 'var(--ink-tertiary)', fontWeight: 500 }}>{r.topic}</span>
                            </div>
                            {isEditing ? (
                              <div onClick={e => e.stopPropagation()}>
                                <textarea className="font-serif" value={editBuffer} onChange={(e) => setEditBuffer(e.target.value)} autoFocus
                                  style={{ width: '100%', fontSize: 17, lineHeight: 1.6, color: 'var(--ink)', padding: 12, border: '1px solid var(--border-stronger)', borderRadius: 2, background: 'var(--paper)', outline: 'none', resize: 'vertical', minHeight: 120, fontFamily: "'Newsreader', serif" }} />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                  <button className="action-btn" onClick={cancelEdit}>Avbryt</button>
                                  <button className="btn-primary" style={{ padding: '4px 16px' }} onClick={() => saveEdit(r.id)}><Check style={{ width: 12, height: 12 }} /> Lagre</button>
                                </div>
                              </div>
                            ) : (
                              <div className="font-serif" style={{ fontSize: 17, lineHeight: 1.6, paddingRight: 16, ...(r.isAiGenerated ? { fontStyle: 'italic', color: 'var(--ai-accent)' } : { color: 'var(--ink)' }) }}>
                                {r.proposition}
                              </div>
                            )}
                            {/* (1) TENSION indicator in register row */}
                            {hasTension && !isEditing && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <Scale style={{ width: 12, height: 12, color: 'var(--tension-color)' }} />
                                <span className="font-sans" style={{ fontSize: 11, color: 'var(--tension-color)', fontWeight: 500 }}>
                                  Spenning med: {rules.find(x => x.id === r.tension.withId)?.topic}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Col 2: Status */}
                          <div style={{ paddingTop: 20 }}>
                            {r.isAiGenerated ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--ai-border)', padding: '2px 8px', borderRadius: 2, color: 'var(--ai-accent)' }}>
                                <Sparkles style={{ width: 11, height: 11 }} />
                                <span className="font-sans" style={{ fontSize: 11, fontWeight: 600 }}>KI-utkast</span>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 2, color: 'var(--ink-tertiary)' }}>
                                <Check style={{ width: 11, height: 11 }} />
                                <span className="font-sans" style={{ fontSize: 11, fontWeight: 500 }}>Verifisert</span>
                              </div>
                            )}
                            <div className="font-mono" style={{ fontSize: 10, color: 'var(--ink-muted)', marginTop: 6 }}>Sist: {r.lastEditedBy}</div>
                          </div>

                          {/* Col 3: Omfang */}
                          <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{r.cases.length} forekomster</span>
                            <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{r.yearSpan}</span>
                            {starCount > 0 && (
                              <span className="font-sans" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--gold-star)', marginTop: 2 }}>
                                <Star style={{ width: 11, height: 11, fill: 'currentColor' }} /> {starCount}
                              </span>
                            )}
                          </div>

                          {/* Col 4 */}
                          <div style={{ paddingTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                            {!isEditing && <button className="edit-btn action-btn" onClick={(e) => startEditing(r, e)} style={{ padding: 4, border: 'none' }} title="Rediger"><Edit3 style={{ width: 14, height: 14 }} /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div style={{ padding: '16px 24px' }}>
                <button className="action-btn" style={{ padding: '8px 16px' }}><Plus style={{ width: 14, height: 14 }} /> Opprett ny rettssetning</button>
              </div>
            </div>
          </main>

          {/* ─── EVIDENCE PANEL ─── */}
          {selectedRule && isInspectorOpen && (
            <aside style={{ width: 460, flexShrink: 0, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 }}>
              <header style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <div className="font-mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <BookOpen style={{ width: 11, height: 11 }} /> Bevisgrunnlag
                  </div>
                  <h2 className="font-serif" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45, color: selectedRule.isAiGenerated ? 'var(--ai-accent)' : 'var(--ink)', fontStyle: selectedRule.isAiGenerated ? 'italic' : 'normal' }}>
                    {selectedRule.proposition}
                  </h2>
                </div>
                <button className="action-btn" style={{ padding: 4, border: 'none', flexShrink: 0 }} onClick={() => setIsInspectorOpen(false)}><X style={{ width: 16, height: 16 }} /></button>
              </header>

              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 48px' }}>

                {/* (1) TENSION — shown at top of panel when present */}
                {selectedRule.tension && tensionRule && (
                  <div style={{ border: '1px solid var(--tension-border)', background: 'var(--tension-bg)', padding: 16, borderRadius: 3, marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Scale style={{ width: 14, height: 14, color: 'var(--tension-color)' }} />
                      <span className="font-sans" style={{ fontSize: 11, fontWeight: 600, color: 'var(--tension-color)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spenning</span>
                    </div>
                    <p className="font-serif" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-secondary)', marginBottom: 8 }}>
                      {selectedRule.tension.note}
                    </p>
                    <button className="font-sans" onClick={() => { setSelectedRuleId(tensionRule.id); setShowBoundary(false); setShowLineage({}); }}
                      style={{ fontSize: 11, fontWeight: 500, color: 'var(--tension-color)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, transition: 'opacity 0.15s' }}>
                      <Link2 style={{ width: 11, height: 11 }} /> Gå til: {tensionRule.topic}
                    </button>
                  </div>
                )}

                {/* TIMELINE */}
                <div style={{ position: 'relative', borderLeft: '1px solid var(--border)', marginLeft: 4 }}>
                  {selectedRule.cases.map((c, idx) => {
                    const evo = EVOLUTION[c.evolution] || EVOLUTION.established;
                    const isLast = idx === selectedRule.cases.length - 1;
                    const lineageOpen = showLineage[c.ref];

                    return (
                      <div key={idx} style={{ position: 'relative', paddingLeft: 28, paddingBottom: isLast ? 0 : 40 }}>
                        {/* Timeline dot — qualified gets dashed outline */}
                        <div style={{
                          position: 'absolute', left: -5, top: 4,
                          width: 9, height: 9, borderRadius: '50%', background: 'var(--paper)',
                          border: c.evolution === 'established' ? '2.5px solid var(--ink)' :
                                 c.evolution === 'qualified' ? '2px dashed var(--qualified-color)' :
                                 c.evolution === 'confirmed' ? '2px solid var(--confirm-color)' :
                                 '2px solid var(--ink-muted)'
                        }} />

                        {/* Case header */}
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                          <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{c.ref}</span>
                          {c.paragraphs && <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-tertiary)' }}>{c.paragraphs}</span>}
                          {/* (2) EVOLUTION — 4 states */}
                          <span className={`tag-evolution ${evo.css}`}>{evo.label}</span>
                          {/* (7) REGULATION tag */}
                          <span className="font-mono" style={{ fontSize: 9, color: 'var(--ink-muted)', border: '1px solid var(--border)', padding: '0 4px', borderRadius: 2 }}>{c.regulation}</span>
                          {/* (3) SUGGESTED — AI interpretation marker */}
                          {c.suggested && <Sparkles style={{ width: 11, height: 11, color: 'var(--ai-accent)' }} title="KI-tolket kobling" />}
                          <span className="font-mono" style={{ fontSize: 12, color: 'var(--ink-muted)', marginLeft: 'auto' }}>{c.year}</span>
                          {c.star && <Star style={{ width: 11, height: 11, color: 'var(--gold-star)', fill: 'currentColor' }} title="Gullkandidat" />}
                        </div>

                        {/* Factum + Assessment */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                          <p className="font-serif" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-tertiary)' }}>{c.factum}</p>
                          <p className="font-serif" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink)', fontWeight: 600 }}>{c.assessment}</p>
                        </div>

                        {/* Quotes */}
                        {c.quotes?.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                            {c.quotes.map((q, qIdx) => {
                              const quoteId = `${c.ref}-${qIdx}`;
                              const isCopied = copiedQuoteId === quoteId;
                              return (
                                <div key={qIdx} className="quote-block">
                                  <p className="font-serif" style={{ fontSize: 15, fontStyle: 'italic', color: 'var(--ink-secondary)', lineHeight: 1.65 }}>«{q.text}»</p>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                    <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-muted)' }}>[Avsnitt {q.p}]</span>
                                    <button className="copy-btn font-sans" onClick={() => handleCopyQuote(q.text, quoteId)}
                                      style={{ fontSize: 11, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', color: isCopied ? 'var(--confirm-color)' : 'var(--ink-muted)', ...(isCopied ? { opacity: 1 } : {}) }}>
                                      {isCopied ? '✓ Kopiert' : 'Kopier'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Nuances */}
                        {c.nuances && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4, marginBottom: 8 }}>
                            <AlertTriangle style={{ width: 13, height: 13, color: 'var(--nuance-color)', flexShrink: 0, marginTop: 3 }} />
                            <div>
                              <span className="font-sans" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nuance-color)', display: 'block', marginBottom: 4 }}>Unntak</span>
                              <p className="font-serif" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-secondary)' }}>{c.nuances}</p>
                            </div>
                          </div>
                        )}

                        {/* (6) LINEAGE — original screening proposition */}
                        <button className="font-sans" onClick={(e) => { e.stopPropagation(); toggleLineage(c.ref); }}
                          style={{ fontSize: 10, color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', marginTop: 4, transition: 'color 0.15s' }}>
                          <ChevronDown style={{ width: 10, height: 10, transform: lineageOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                          Opprinnelig screening-proposisjon
                        </button>
                        {lineageOpen && (
                          <div style={{ borderLeft: '2px solid var(--ai-border)', paddingLeft: 12, marginTop: 4, marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                              <Sparkles style={{ width: 10, height: 10, color: 'var(--ai-accent)' }} />
                              <span className="font-sans" style={{ fontSize: 10, color: 'var(--ai-accent)', fontWeight: 500 }}>KI-screening</span>
                            </div>
                            <p className="font-serif" style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--ink-tertiary)', lineHeight: 1.5 }}>
                              {c.screeningProposition}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* (5) BOUNDARY NOTES */}
                {selectedRule.boundaryNotes?.length > 0 && (
                  <div style={{ marginTop: 24, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
                    <button className="collapse-toggle" onClick={() => setShowBoundary(!showBoundary)}>
                      <ChevronDown style={{ width: 11, height: 11, transform: showBoundary ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                      Avgrensning ({selectedRule.boundaryNotes.length})
                    </button>
                    {showBoundary && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16 }}>
                        {selectedRule.boundaryNotes.map((bn, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                            <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)', flexShrink: 0 }}>{bn.caseId}</span>
                            <p className="font-serif" style={{ fontSize: 14, color: 'var(--ink-tertiary)', lineHeight: 1.45 }}>{bn.note}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                  <button className="text-link">+ Knytt flere saker til tidslinjen</button>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}

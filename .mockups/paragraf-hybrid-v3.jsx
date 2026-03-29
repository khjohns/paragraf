import React, { useState, useEffect, useRef } from 'react';
import { Clock, ArrowRight, Plus, Check, Search, Filter, X, ChevronDown, MoreVertical, Tag, Sun, Moon } from 'lucide-react';

/*
  PARAGRAF — Porteføljeoversikt v3
  
  v2→v3 changes:
  ─ Contrast: Darkened all text levels. Original's "light" (#4A4843) is now our tertiary.
  ─ Narrative sentence: 22px → 30px. Restored editorial presence.
  ─ Indeks header: back to 2px solid ink (editorial rule line, part of signature)
  ─ Provision tags: paper-dark background for contrast lift
  ─ "Sist" box: dropped border, uses dot separator + plain text
  ─ AI suggestion: 14px → 13px
  ─ Scope toggle: inner separator added
  ─ Progress line: ink-secondary (darker, scannable)
  ─ Empty state for 0 filter results
  ─ All-phases-selected collapses to "alle faser"
  ─ "Start ny analyse" hover matches index rows
  ─ "gruppert på" dashed line removed (no action wired)
*/

const VennIcon = ({ className, style }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8.5" cy="12" r="5.5" />
    <circle cx="15.5" cy="12" r="5.5" />
  </svg>
);

const PHASE_COLORS = {
  oppsett: '#A8A29E',
  primaersok: '#64748B',
  screening: '#B45309',
  ettersok: '#CA8A04',
  sammenstilling: '#059669'
};

const PHASE_NAMES = {
  oppsett: 'Oppsett',
  primaersok: 'Primærsøk',
  screening: 'Screening',
  ettersok: 'Ettersøk',
  sammenstilling: 'Sammenstilling'
};

const TOTAL_PHASES = Object.keys(PHASE_NAMES).length;

const initialAnalyses = [
  {
    id: 'a1',
    title: 'Avvisning på grunn av manglende skatteattest',
    problem: 'Hvor absolutt er kravet til innlevering av skatteattest i åpen anbudskonkurranse, og i hvilken grad tillater rettspraksis ettersending av dokumentasjon som forelå før tilbudsfristen?',
    phase: 'screening',
    owner: 'Meg',
    provisions: ['FOA §16-10', 'FOA §24-2'],
    overlapWith: 'FOA §16-10',
    lastActive: true,
    lastAction: 'Leste KOFA-2023-145',
    perspective: 'Saksoversikten',
    newEvents: 2,
    tag: 'Kvalifikasjonskrav & Avvisning'
  },
  {
    id: 'a4',
    title: 'Dokumentasjonsplikt vs. ettersending',
    problem: 'Oppdragsgivers plikt og rett til å be om ettersending av manglende dokumentasjon for kvalifikasjonskrav.',
    phase: 'ettersok',
    owner: 'Erik',
    provisions: ['FOA §16-10', 'FOA §24-8(2)'],
    overlapWith: 'FOA §16-10',
    lastActive: false,
    teamOnly: true,
    perspective: 'Rettssetningsregisteret',
    newEvents: 0,
    tag: 'Kvalifikasjonskrav & Avvisning'
  },
  {
    id: 'a2',
    title: 'Bruk av forhandlinger i åpen anbudskonkurranse',
    problem: 'Når går en avklaring over til å bli en ulovlig forhandling? Grensedragningen mellom tillatt presisering og ulovlig endring av tilbud.',
    phase: 'primaersok',
    owner: 'Meg',
    provisions: ['FOA §23-1'],
    overlapWith: null,
    lastActive: false,
    perspective: 'Saksoversikten',
    newEvents: 0,
    tag: 'Tilbudsevaluering & Avvik'
  },
  {
    id: 'a3',
    title: 'Vesentlige avvik i tilbud',
    problem: 'Identifisering og håndtering av forbehold som utgjør et vesentlig avvik fra kravspesifikasjonen.',
    phase: 'sammenstilling',
    owner: 'Meg',
    provisions: ['FOA §24-8(1)', 'FOA §16-10'],
    overlapWith: 'FOA §16-10',
    lastActive: false,
    perspective: 'Notatet',
    newEvents: 1,
    tag: 'Tilbudsevaluering & Avvik'
  },
  {
    id: 'a5',
    title: 'Gjenåpning av vilkår i minikonkurranse',
    problem: 'I hvilken grad kan oppdragsgiver gjenåpne konkurransen om vilkår som allerede er fastsatt i rammeavtalen?',
    phase: 'oppsett',
    owner: 'Meg',
    provisions: ['FOA §26-4'],
    overlapWith: null,
    lastActive: false,
    perspective: 'Problemstillingen',
    newEvents: 0,
    tag: 'Rammeavtaler & Minikonkurranser'
  }
];

const getOverlapProvisions = (items) => {
  const provisions = new Set();
  items.forEach(a => { if (a.overlapWith) provisions.add(a.overlapWith); });
  return provisions;
};

// --- PHASE DROPDOWN ---
const PhaseDropdown = ({ activePhases, onToggle, onClear }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = activePhases.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="font-sans ctrl-btn"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 500,
          color: count > 0 ? 'var(--ink)' : 'var(--ink-tertiary)',
          background: 'var(--control-bg)',
          border: `1px solid ${count > 0 ? 'var(--border-strong)' : 'var(--control-border)'}`,
          padding: '4px 8px', borderRadius: 4,
          cursor: 'pointer', whiteSpace: 'nowrap'
        }}
      >
        <Filter style={{ width: 12, height: 12 }} />
        Faser
        {count > 0 && (
          <span className="font-mono" style={{
            fontSize: 10, fontWeight: 600,
            background: 'var(--ink)', color: 'var(--paper)',
            borderRadius: 2, padding: '0 4px',
            lineHeight: '16px', minWidth: 16, textAlign: 'center'
          }}>{count}</span>
        )}
        <ChevronDown style={{
          width: 11, height: 11, color: 'var(--ink-muted)',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s ease'
        }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: 'var(--paper)',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          padding: '4px 0',
          minWidth: 200,
          zIndex: 50,
          animation: 'dropIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          {count > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 12px 8px', borderBottom: '1px solid var(--border-subtle)',
              marginBottom: 4
            }}>
              <span className="font-sans" style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 500 }}>
                {count} valgt
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="font-sans"
                style={{
                  fontSize: 11, color: 'var(--ink-tertiary)', fontWeight: 500,
                  background: 'none', border: 'none', cursor: 'pointer',
                  textDecoration: 'underline', textUnderlineOffset: 2
                }}
              >Nullstill</button>
            </div>
          )}

          {Object.entries(PHASE_NAMES).map(([key, name]) => {
            const isActive = activePhases.includes(key);
            return (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); onToggle(key); }}
                className={`font-sans dd-item ${isActive ? 'dd-active' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  padding: '6px 12px',
                  fontSize: 13, fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--ink)' : 'var(--ink-secondary)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: PHASE_COLORS[key],
                  flexShrink: 0,
                  boxShadow: isActive ? `0 0 0 2px var(--paper), 0 0 0 3.5px ${PHASE_COLORS[key]}` : 'none',
                  transition: 'box-shadow 0.15s ease'
                }} />
                <span style={{ flex: 1 }}>{name}</span>
                {isActive && <Check style={{ width: 12, height: 12, color: 'var(--ink-tertiary)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Available tags for grouping
const AVAILABLE_TAGS = [
  'Kvalifikasjonskrav & Avvisning',
  'Tilbudsevaluering & Avvik',
  'Rammeavtaler & Minikonkurranser'
];

// --- ROW CONTEXT MENU ---
const RowContextMenu = ({ analysisId, currentTag, allTags, onSetTag }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="ctx-btn"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24,
          background: 'none', border: 'none',
          cursor: 'pointer', borderRadius: 4,
          color: 'var(--ink-muted)',
        }}
      >
        <MoreVertical style={{ width: 14, height: 14 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: 'var(--paper)',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          padding: '4px 0',
          minWidth: 240,
          zIndex: 50,
          animation: 'dropIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div style={{
            padding: '4px 12px 6px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: 4
          }}>
            <span className="font-sans" style={{
              fontSize: 11, fontWeight: 600, color: 'var(--ink-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em'
            }}>
              <Tag style={{ width: 10, height: 10, display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
              Flytt til tema
            </span>
          </div>

          {allTags.map(tag => {
            const isActive = tag === currentTag;
            return (
              <button
                key={tag}
                onClick={(e) => { e.stopPropagation(); onSetTag(analysisId, tag); setOpen(false); }}
                className={`font-sans dd-item ${isActive ? 'dd-active' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  padding: '6px 12px',
                  fontSize: 13, fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--ink)' : 'var(--ink-secondary)',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <span style={{ flex: 1 }}>{tag}</span>
                {isActive && <Check style={{ width: 12, height: 12, color: 'var(--ink-tertiary)' }} />}
              </button>
            );
          })}

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 4 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="font-sans dd-item"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', textAlign: 'left',
                padding: '6px 12px',
                fontSize: 13, color: 'var(--ink-tertiary)',
                border: 'none', cursor: 'pointer',
              }}
            >
              <Plus style={{ width: 12, height: 12 }} />
              Nytt tema…
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN ---
export default function App() {
  const [viewScope, setViewScope] = useState('mine');
  const [activePhases, setActivePhases] = useState([]);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [darkMode, setDarkMode] = useState(false);

  const togglePhase = (phase) => {
    setActivePhases(prev =>
      prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]
    );
  };

  const handleSetTag = (analysisId, newTag) => {
    setAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tag: newTag } : a));
  };

  const activeAnalysis = analyses.find(a => a.lastActive);

  const scopeLabel = viewScope === 'mine' ? 'mine analyser' : viewScope === 'team' ? 'teamets analyser' : 'alle publiserte analyser';

  // Collapse to "alle faser" when all phases are selected
  const effectivePhases = activePhases.length === TOTAL_PHASES ? [] : activePhases;

  let phaseNarrative;
  if (effectivePhases.length === 0) {
    phaseNarrative = <> på tvers av <span style={{ color: 'var(--ink)', fontWeight: 500 }}>alle faser</span></>;
  } else if (effectivePhases.length === 1) {
    const key = effectivePhases[0];
    phaseNarrative = <> i fasen <span style={{ color: PHASE_COLORS[key], fontWeight: 500 }}>{PHASE_NAMES[key]}</span></>;
  } else {
    phaseNarrative = (
      <> i {effectivePhases.map((key, i) => (
        <span key={key}>
          {i > 0 && (i === effectivePhases.length - 1 ? ' og ' : ', ')}
          <span style={{ color: PHASE_COLORS[key], fontWeight: 500 }}>{PHASE_NAMES[key]}</span>
        </span>
      ))}</>
    );
  }

  const matchesFilter = (item) => {
    const scopeMatch = viewScope === 'corpus' || viewScope === 'team' || !item.teamOnly;
    const phaseMatch = effectivePhases.length === 0 || effectivePhases.includes(item.phase);
    return scopeMatch && phaseMatch;
  };

  const allVisible = analyses.filter(matchesFilter);
  const totalVisible = allVisible.length;
  const showKrysspollinering = getOverlapProvisions(allVisible).size > 0;

  // Group visible analyses by tag
  const groupedVisible = {};
  allVisible.forEach(a => {
    const tag = a.tag || 'Uten tema';
    if (!groupedVisible[tag]) groupedVisible[tag] = [];
    groupedVisible[tag].push(a);
  });

  // Collect all known tags for the context menu
  const allKnownTags = [...new Set([...AVAILABLE_TAGS, ...analyses.map(a => a.tag).filter(Boolean)])];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap');

        /* ── LIGHT MODE (default) ────────────────────────── */
        :root {
          --ink:            #1C1B1A;
          --ink-secondary:  #33312E;
          --ink-tertiary:   #4A4843;
          --ink-muted:      #7A766F;

          --paper:          #F8F6F1;
          --paper-dark:     #EDEAE3;

          --border-subtle:  rgba(28, 27, 26, 0.06);
          --border:         rgba(28, 27, 26, 0.12);
          --border-strong:  rgba(28, 27, 26, 0.20);
          --border-stronger: rgba(28, 27, 26, 0.35);

          --control-bg:     #EDEAE3;
          --control-border: rgba(28, 27, 26, 0.12);
          --control-border-focus: rgba(28, 27, 26, 0.40);

          --violet-accent:  #6B4C9A;
          --violet-border:  rgba(107, 76, 154, 0.18);
          --ai-accent:      #92600A;

          /* Interaction colors */
          --hover-bg:       rgba(28, 27, 26, 0.02);
          --hover-bg-strong: rgba(28, 27, 26, 0.04);
          --hover-bg-ctrl:  rgba(28, 27, 26, 0.025);
          --hover-bg-ctrl-active: rgba(28, 27, 26, 0.04);
          --header-bg:      rgba(248, 246, 241, 0.85);
          --selection-bg:   rgba(107, 76, 154, 0.12);
          --btn-primary-bg: var(--ink);
          --btn-primary-fg: var(--paper);
          --btn-primary-hover: #000000;
          --noise-opacity:  0.035;
          --noise-svg:      url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
        }

        /* ── DARK MODE ───────────────────────────────────── */
        .dark {
          --ink:            #E2DFD6;
          --ink-secondary:  #C4C0B5;
          --ink-tertiary:   #8E8A80;
          --ink-muted:      #5C5850;

          --paper:          #1E1C19;
          --paper-dark:     #16140F;

          --border-subtle:  rgba(232, 229, 220, 0.06);
          --border:         rgba(232, 229, 220, 0.10);
          --border-strong:  rgba(232, 229, 220, 0.16);
          --border-stronger: rgba(232, 229, 220, 0.28);

          --control-bg:     #262420;
          --control-border: rgba(232, 229, 220, 0.12);
          --control-border-focus: rgba(232, 229, 220, 0.35);

          --violet-accent:  #9B82C4;
          --violet-border:  rgba(155, 130, 196, 0.20);
          --ai-accent:      #C49A4E;

          --hover-bg:       rgba(232, 229, 220, 0.03);
          --hover-bg-strong: rgba(232, 229, 220, 0.06);
          --hover-bg-ctrl:  rgba(232, 229, 220, 0.04);
          --hover-bg-ctrl-active: rgba(232, 229, 220, 0.06);
          --header-bg:      rgba(30, 28, 25, 0.85);
          --selection-bg:   rgba(155, 130, 196, 0.20);
          --btn-primary-bg: #E2DFD6;
          --btn-primary-fg: #1E1C19;
          --btn-primary-hover: #F8F6F1;
          --noise-svg:      url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background-color: var(--paper);
          color: var(--ink);
          font-family: 'Newsreader', serif;
        }

        .font-sans  { font-family: 'Albert Sans', sans-serif; }
        .font-mono  { font-family: 'JetBrains Mono', monospace; }
        .font-serif { font-family: 'Newsreader', serif; }

        ::selection {
          background: var(--selection-bg);
          color: var(--violet-accent);
        }

        .fade-up {
          opacity: 0;
          transform: translateY(12px);
          animation: fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeUp {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* CONTROLS */
        .ctrl-btn {
          transition: all 0.15s ease;
        }
        .ctrl-btn:hover {
          border-color: var(--border-strong) !important;
          color: var(--ink) !important;
        }
        .ctrl-btn:active { transform: scale(0.98); }
        .ctrl-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--border-stronger);
        }

        .scope-toggle {
          display: flex;
          border: 1px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
        }
        .scope-btn {
          padding: 4px 12px;
          font-family: 'Albert Sans', sans-serif;
          font-size: 12px;
          font-weight: 500;
          border: none;
          background: transparent;
          color: var(--ink-tertiary);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .scope-btn:hover {
          color: var(--ink-secondary);
          background: var(--hover-bg-ctrl);
        }
        .scope-btn:active { transform: scale(0.97); }
        .scope-btn:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px var(--border-stronger);
        }
        .scope-btn.active {
          background: var(--paper-dark);
          color: var(--ink);
        }
        /* Inner separator between scope buttons */
        .scope-sep {
          width: 1px;
          align-self: stretch;
          background: var(--border);
        }

        .index-row {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 16px 0 16px 20px;
          border-bottom: 1px solid var(--border-subtle);
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .index-row:hover {
          background: var(--hover-bg);
        }
        .index-row:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px var(--border-stronger);
        }
        .index-row:hover .row-arrow {
          opacity: 1;
          transform: translateX(0);
        }
        .row-arrow {
          opacity: 0;
          transform: translateX(-4px);
          transition: all 0.15s ease;
        }
        .row-meta { margin-top: 8px; }
        .row-ctx {
          opacity: 0;
          transition: opacity 0.15s ease;
        }
        .index-row:hover .row-ctx {
          opacity: 1;
        }
        .ctx-btn {
          transition: all 0.15s ease;
        }
        .ctx-btn:hover {
          background: var(--hover-bg-strong) !important;
          color: var(--ink-secondary) !important;
        }
        .ctx-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--border-stronger);
        }

        /* Dropdown items — replaces inline hover handlers */
        .dd-item {
          transition: background 0.1s ease;
        }
        .dd-item:hover {
          background: var(--hover-bg-ctrl) !important;
        }
        .dd-item.dd-active {
          background: var(--hover-bg-ctrl-active);
        }
        .dd-item.dd-active:hover {
          background: var(--hover-bg-ctrl-active) !important;
        }

        /* Dark mode toggle */
        .mode-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--ink-tertiary);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mode-toggle:hover {
          color: var(--ink);
          border-color: var(--border-strong);
        }
        .mode-toggle:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--border-stronger);
        }

        @media (min-width: 768px) {
          .index-row { flex-direction: row; align-items: center; }
          .row-meta  { margin-top: 0; }
        }

        .search-input {
          font-family: 'Albert Sans', sans-serif;
          font-size: 12px;
          background: var(--control-bg);
          border: 1px solid var(--control-border);
          border-radius: 4px;
          padding: 4px 12px 4px 28px;
          width: 180px;
          outline: none;
          color: var(--ink);
          transition: border-color 0.15s ease;
        }
        .search-input::placeholder { color: var(--ink-muted); }
        .search-input:hover { border-color: var(--border-strong); }
        .search-input:focus { border-color: var(--control-border-focus); }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--btn-primary-bg);
          color: var(--btn-primary-fg);
          font-family: 'Albert Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          padding: 8px 20px;
          border: 1.5px solid transparent;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-primary:hover { background: var(--btn-primary-hover); }
        .btn-primary:active { transform: scale(0.98); }

        /* Dark mode: outline variant */
        .dark .btn-primary {
          background: transparent;
          color: var(--ink-secondary);
          border-color: var(--border-strong);
        }
        .dark .btn-primary:hover {
          background: var(--hover-bg-strong);
          color: var(--ink);
          border-color: var(--border-stronger);
        }
        .btn-primary:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px var(--paper), 0 0 0 4px var(--border-stronger);
        }

        /* Provision tag — reusable */
        .provision-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--ink);
          background: var(--paper-dark);
          border: 1px solid var(--border);
          padding: 2px 8px;
        }
        .provision-tag-sm {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--ink);
          background: var(--paper-dark);
          border: 1px solid var(--border);
          padding: 2px 8px;
        }
      `}} />

      <div className={darkMode ? 'dark' : ''} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 80, backgroundColor: 'var(--paper)', colorScheme: darkMode ? 'dark' : 'light', color: 'var(--ink)', backgroundImage: 'var(--noise-svg)' }}>

        {/* ─── STICKY HEADER ─── */}
        <header
          className="fade-up"
          style={{
            width: '100%', padding: '12px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            background: 'var(--header-bg)',
            backdropFilter: 'blur(12px)',
            position: 'sticky', top: 0, zIndex: 30
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--ink)', borderRadius: 4,
            }}>
              <span className="font-serif" style={{ fontStyle: 'italic', fontWeight: 600, fontSize: 13, lineHeight: 1 }}>§</span>
            </div>
            <span className="font-sans" style={{ fontWeight: 500, fontSize: 13, letterSpacing: '0.02em', color: 'var(--ink)' }}>
              Paragraf
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="mode-toggle" onClick={() => setDarkMode(!darkMode)}>
              {darkMode
                ? <Sun style={{ width: 14, height: 14 }} />
                : <Moon style={{ width: 14, height: 14 }} />
              }
            </button>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'var(--paper-dark)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Albert Sans', sans-serif",
              fontSize: 10, fontWeight: 600, color: 'var(--ink-secondary)'
            }}>MJ</div>
          </div>
        </header>

        <main style={{ width: '100%', maxWidth: 860, padding: '0 24px', marginTop: 32 }}>

          {/* ─── TOOLBAR ─── */}
          <div
            className="fade-up"
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: 12,
              marginBottom: 16, animationDelay: '80ms'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="scope-toggle">
                <button className={`scope-btn ${viewScope === 'mine' ? 'active' : ''}`} onClick={() => setViewScope('mine')}>
                  Mine
                </button>
                <div className="scope-sep" />
                <button className={`scope-btn ${viewScope === 'team' ? 'active' : ''}`} onClick={() => setViewScope('team')}>
                  Team
                </button>
                <div className="scope-sep" />
                <button className={`scope-btn ${viewScope === 'corpus' ? 'active' : ''}`} onClick={() => setViewScope('corpus')}>
                  Corpus
                </button>
              </div>

              <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 4px' }} />

              <button className="font-sans ctrl-btn" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 12, fontWeight: 500, color: 'var(--ink)',
                background: 'var(--control-bg)',
                border: '1px solid var(--control-border)',
                padding: '4px 12px', borderRadius: 4,
                cursor: 'pointer'
              }}>
                <Plus style={{ width: 12, height: 12 }} />
                Ny analyse
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-muted)', marginLeft: 4 }}>⌘N</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: 'var(--ink-muted)' }} />
                <input className="search-input" type="text" placeholder="Søk i arkivet…" />
              </div>
              <PhaseDropdown
                activePhases={activePhases}
                onToggle={togglePhase}
                onClear={() => setActivePhases([])}
              />
            </div>
          </div>

          {/* ─── NARRATIVE FILTER ─── */}
          <div
            className="fade-up"
            style={{
              borderBottom: '1px solid var(--border)',
              paddingBottom: 24, marginBottom: 40,
              animationDelay: '140ms'
            }}
          >
            <p className="font-serif" style={{
              fontSize: 30, lineHeight: 1.35, fontWeight: 400,
              color: 'var(--ink-tertiary)', maxWidth: 680,
              letterSpacing: '-0.01em'
            }}>
              Viser{' '}
              <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{scopeLabel}</span>
              {phaseNarrative}.
            </p>
          </div>

          {/* ─── FORTSETT DER DU SLAPP ─── */}
          {viewScope === 'mine' && activeAnalysis && effectivePhases.length === 0 && (
            <section className="fade-up" style={{ marginBottom: 64, animationDelay: '200ms' }}>
              <div className="font-sans" style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--ink-muted)'
              }}>
                <Clock style={{ width: 12, height: 12 }} />
                Fortsett der du slapp
              </div>

              <div style={{ position: 'relative', paddingLeft: 32 }}>
                <div style={{
                  position: 'absolute', left: 0, top: 4, bottom: 0, width: 2,
                  borderRadius: 1, backgroundColor: 'var(--ink-muted)'
                }} />

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 16 }}>
                  <div style={{ flex: '1 1 400px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span className="font-sans" style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', color: 'var(--ink-tertiary)' }}>
                        {PHASE_NAMES[activeAnalysis.phase]}
                      </span>
                      <span style={{ color: 'var(--ink-muted)', fontSize: 11 }}>·</span>
                      <span className="font-sans" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-tertiary)' }}>
                        i {activeAnalysis.perspective}
                      </span>
                      {activeAnalysis.overlapWith && (
                        <span className="font-sans" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 2,
                          border: '1px solid var(--violet-border)',
                          color: 'var(--violet-accent)',
                          fontSize: 11, fontWeight: 500
                        }}>
                          <VennIcon style={{ width: 12, height: 12 }} />
                          Overlapp med {activeAnalysis.overlapWith}
                        </span>
                      )}
                    </div>

                    <h2 className="font-serif" style={{
                      fontSize: 28, fontWeight: 500, lineHeight: 1.25,
                      color: 'var(--ink)', marginBottom: 8,
                      letterSpacing: '-0.015em'
                    }}>{activeAnalysis.title}</h2>

                    <p className="font-serif" style={{
                      fontSize: 17, lineHeight: 1.55, color: 'var(--ink-secondary)', maxWidth: 560
                    }}>{activeAnalysis.problem}</p>
                  </div>

                  <button className="btn-primary" style={{ flexShrink: 0 }}>
                    Fortsett i {activeAnalysis.perspective}
                    <ArrowRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>

                {/* Data row — provisions + sist + new events */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {activeAnalysis.provisions.map(prov => (
                      <span key={prov} className="provision-tag">{prov}</span>
                    ))}
                  </div>

                  <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

                  <div className="font-sans" style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 13, color: 'var(--ink-secondary)',
                  }}>
                    <Check style={{ width: 12, height: 12, color: 'var(--ink-muted)' }} />
                    <span style={{ color: 'var(--ink-tertiary)' }}>Sist:</span>
                    {activeAnalysis.lastAction}
                  </div>

                  {activeAnalysis.newEvents > 0 && (
                    <div className="font-sans" style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, fontWeight: 500,
                      color: 'var(--ai-accent)',
                      marginLeft: 'auto'
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        backgroundColor: 'var(--ai-accent)', flexShrink: 0
                      }} />
                      {activeAnalysis.newEvents} nye relevante saker
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ─── INDEKS ─── */}
          <section>
            {/* Editorial rule line — 2px solid ink. This is signature, not noise. */}
            <div
              className="fade-up"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '2px solid var(--ink)', paddingBottom: 8, marginBottom: 24,
                animationDelay: '280ms'
              }}
            >
              <h3 className="font-sans" style={{
                fontSize: 12, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)'
              }}>Indeks</h3>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                {totalVisible} mapper
              </span>
            </div>

            {/* Empty state */}
            {totalVisible === 0 && (
              <div className="fade-up" style={{
                padding: '48px 24px', textAlign: 'center',
                animationDelay: '340ms'
              }}>
                <p className="font-serif" style={{
                  fontSize: 18, color: 'var(--ink-tertiary)', marginBottom: 16, fontStyle: 'italic'
                }}>
                  Ingen analyser matcher filteret.
                </p>
                <button
                  onClick={() => setActivePhases([])}
                  className="font-sans ctrl-btn"
                  style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--ink-secondary)',
                    background: 'none', border: '1px solid var(--border)',
                    padding: '8px 16px', borderRadius: 4, cursor: 'pointer'
                  }}
                >
                  Nullstill filter
                </button>
              </div>
            )}

            {Object.entries(groupedVisible).map(([groupName, visibleItems], groupIndex) => (
              <div key={groupName} className="fade-up" style={{ marginBottom: 40, animationDelay: `${340 + groupIndex * 80}ms` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, paddingLeft: 4 }}>
                  <h4 className="font-serif" style={{
                    fontSize: 20, fontStyle: 'italic', fontWeight: 400, color: 'var(--ink-tertiary)'
                  }}>{groupName}</h4>
                  <span className="font-mono" style={{
                    fontSize: 10, color: 'var(--ink-muted)',
                    border: '1px solid var(--border)',
                    padding: '2px 4px', borderRadius: 2
                  }}>{visibleItems.length}</span>
                </div>

                {visibleItems.map((analysis) => (
                  <div key={analysis.id} className="index-row" tabIndex={0} role="button">
                    <div style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: 5, height: 5, borderRadius: '50%',
                      backgroundColor: 'var(--ink-muted)'
                    }} />

                    <div style={{ flex: 1, minWidth: 0, paddingRight: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <h5 className="font-serif" style={{
                          fontSize: 18, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>{analysis.title}</h5>
                        {analysis.teamOnly && (viewScope === 'team' || viewScope === 'corpus') && (
                          <span className="font-sans" style={{
                            fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            border: '1px solid var(--border)',
                            padding: '2px 4px',
                            color: 'var(--ink-tertiary)', flexShrink: 0
                          }}>{analysis.owner}</span>
                        )}
                      </div>
                      <p className="font-sans" style={{
                        fontSize: 13, color: 'var(--ink-tertiary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>{analysis.problem}</p>
                    </div>

                    <div className="row-meta" style={{
                      display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0
                    }}>
                      {analysis.newEvents > 0 && (
                        <span title={`${analysis.newEvents} nye saker`} style={{
                          width: 6, height: 6, borderRadius: '50%',
                          backgroundColor: 'var(--ai-accent)', flexShrink: 0
                        }} />
                      )}

                      {analysis.overlapWith && (
                        <div className="font-sans" style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          color: 'var(--violet-accent)', fontSize: 11, fontWeight: 500
                        }}>
                          <VennIcon style={{ width: 12, height: 12 }} />
                          <span>{analysis.overlapWith}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 4 }}>
                        {analysis.provisions.slice(0, 1).map(prov => (
                          <span key={prov} className="provision-tag-sm">{prov}</span>
                        ))}
                        {analysis.provisions.length > 1 && (
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-muted)', padding: '2px 4px' }}>
                            +{analysis.provisions.length - 1}
                          </span>
                        )}
                      </div>

                      <span className="font-sans" style={{
                        fontSize: 11, color: 'var(--ink-muted)',
                        width: 80, textAlign: 'right'
                      }}>{PHASE_NAMES[analysis.phase]}</span>

                      <div className="row-ctx">
                        <RowContextMenu
                          analysisId={analysis.id}
                          currentTag={analysis.tag}
                          allTags={allKnownTags}
                          onSetTag={handleSetTag}
                        />
                      </div>

                      <ArrowRight className="row-arrow" style={{ width: 14, height: 14, color: 'var(--ink-tertiary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {/* New analysis — hover matches index rows */}
            {totalVisible > 0 && (
              <div
                className="fade-up index-row"
                tabIndex={0}
                role="button"
                style={{
                  marginTop: 24, border: '1px dashed var(--border)',
                  borderBottom: '1px dashed var(--border)',
                  padding: 16, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  animationDelay: '580ms'
                }}
              >
                <Plus style={{ width: 14, height: 14, color: 'var(--ink-muted)' }} />
                <span className="font-sans" style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.02em', color: 'var(--ink-tertiary)' }}>
                  Start ny analyse
                </span>
              </div>
            )}
          </section>

          {/* ─── KRYSSPOLLINERING ─── */}
          {showKrysspollinering && (
            <section
              className="fade-up"
              style={{
                marginTop: 80, paddingTop: 40,
                borderTop: '1px solid var(--border-strong)',
                animationDelay: '660ms'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 className="font-sans" style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'var(--violet-accent)'
                }}>
                  <VennIcon style={{ width: 14, height: 14 }} />
                  Krysspollinering
                </h3>

                <div style={{
                  border: '1px solid var(--violet-border)',
                  padding: 24
                }}>
                  <h4 className="font-serif" style={{
                    fontSize: 19, fontWeight: 500, color: 'var(--ink)', marginBottom: 8
                  }}>
                    Konvergens rundt FOA §16-10
                  </h4>
                  <p className="font-serif" style={{
                    fontSize: 16, lineHeight: 1.6, color: 'var(--ink-secondary)', marginBottom: 16
                  }}>
                    {viewScope === 'mine'
                      ? "Du har to analyser som krysser hverandre her. Den ene ser på ettersending av skatteattest, den andre på vesentlige avvik. Koblingen ligger i dokumentasjonskravets absolutte natur."
                      : viewScope === 'team'
                      ? "Du og Erik ser på samme bestemmelse fra ulik vinkel. Erik fokuserer på oppdragsgivers plikt til å be om ettersending, mens du ser på konsekvensen av manglende attest."
                      : "Tre analyser på tvers av teamet konvergerer rundt denne bestemmelsen. Koblingen ligger i dokumentasjonskravets absolutte natur."}
                  </p>
                  <div className="font-mono" style={{
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
                    fontSize: 11, color: 'var(--ink-muted)',
                    borderTop: '1px solid var(--border-subtle)', paddingTop: 12
                  }}>
                    <span>Datagrunnlag:</span>
                    <span className="provision-tag-sm" style={{ color: 'var(--ink-secondary)' }}>
                      4 felles KOFA-avgjørelser
                    </span>
                    <span className="provision-tag-sm" style={{ color: 'var(--ink-secondary)' }}>
                      2 relevante EU-dommer
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

        </main>
      </div>
    </>
  );
}

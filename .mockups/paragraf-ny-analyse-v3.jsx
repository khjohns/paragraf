import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Sparkles, Plus, X, ChevronRight,
  Sun, Moon, Loader2, ArrowRight
} from 'lucide-react';

/*
  PARAGRAF — Start ny analyse v3
  
  v2→v3: Progressive streaming
  ─ No phase switch. One continuous document that grows downward.
  ─ Input area compresses (not disappears) when streaming begins.
  ─ Sections appear one-by-one as the JSON stream completes each key.
  ─ Pending sections: subtle skeleton pulse below the last completed section.
  ─ Progress: "Seksjon 2 av 6 · 0:24" with elapsed timer.
  ─ Cancel: stops stream, keeps completed sections, juristen can start with partial scope.
  ─ "Start analyse" appears after last section, or after cancel with ≥1 section.
  ─ Simulated timing: ~3s per section for demo. Real: incremental JSON parse from SSE stream.
*/

// ── SECTION METADATA ──
const SECTION_LABELS = [
  'Problemstilling',
  'Delspørsmål',
  'Kontekst',
  'Bestemmelser',
  'Søkestrategi',
  'KI-resonnement',
];

// Simulated delays per section (ms) — compressed for demo. Real: 15-30s each.
const SECTION_DELAYS = [5000, 2800, 2200, 3000, 3200, 2800];

// ── MOCK DATA ──
const MOCK = {
  refinedProblem: 'Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11, og finnes det leverandørkonstellasjoner som krever særskilt regulering?',
  subProblems: [
    { id: 1, text: 'Krav om solidaransvar og når dette inntrer' },
    { id: 2, text: 'Tidspunkt for krav om formalisert samarbeidsavtale' },
    { id: 3, text: 'Grensen mellom støtte på kapasitet (§ 16-10) og konsortiedeltakelse (§ 16-11)' },
  ],
  context: { procedure: 'Konkurransepreget dialog', service_area: 'FDVU-system / IKT', market: null, threshold: 'EØS' },
  provisions: [
    { ref: 'FOA § 16-11', label: 'Leverandørgrupperinger', primary: true, reason: 'Direkte regulerer krav til konsortier og fellesskap av leverandører.' },
    { ref: 'FOA § 16-10', label: 'Støtte på kapasitet', primary: true, reason: 'Alternativ til konsortiedannelse — grensedragningen er sentral.' },
    { ref: 'FOA § 19-2', label: 'Underleverandører', primary: true, reason: 'Regulerer underleverandører i gjennomføringsfasen.' },
    { ref: 'FOA § 24-2', label: 'Avvisning kvalifikasjon', primary: false, reason: 'Konsekvens ved manglende oppfyllelse av krav til grupperingen.' },
    { ref: 'FOA § 5-1', label: 'Grunnleggende prinsipper', primary: false, reason: 'Rammeverk for forholdsmessighetsvurderingen.' },
    { ref: 'LOA § 4', label: 'Likebehandling', primary: false, reason: 'Overordnet prinsipp som begrenser handlingsrommet.' },
  ],
  searchStrategy: {
    ref: ['FOA § 16-11', 'FOA § 16-10', 'FOA § 19-2'],
    fts: ['«konsortium»', '«solidaransvar»', '«leverandørgruppering»'],
    vector: ['krav til leverandørgrupperinger og solidaransvar ved felles tilbud', 'samarbeidsavtale mellom leverandører i offentlig anskaffelse'],
    prepWork: ['Prop. 51 L (2015–2016) kap. 22', 'NOU 2014:4 kap. 17'],
  },
  reasoning: 'Problemstillingen berører et kjerneområde i anskaffelsesretten der FOA § 16-11 gir oppdragsgiver et visst handlingsrom, men der rettspraksis har utviklet presiserende normer — særlig rundt solidaransvar og tidspunkt for samarbeidsavtale. Grensedragningen mot § 16-10 (støtte på kapasitet) er praktisk viktig fordi den avgjør hvilke krav som stilles til dokumentasjon og ansvar. Søkestrategien kombinerer lovhenvisninger med konseptuelle søk fordi terminologien varierer mellom avgjørelser.',
};

// ═══════════════════════════════════════════════
// SUBCOMPONENTS (same as v2, condensed)
// ═══════════════════════════════════════════════

const ReviewSection = ({ label, defaultOpen = true, children, aiOwned = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer',
      }}>
        <ChevronRight style={{ width: 12, height: 12, color: 'var(--ink-muted)',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.1em',
          color: aiOwned ? 'var(--ai-accent)' : 'var(--ink-tertiary)' }}>{label}</span>
        {aiOwned && <Sparkles style={{ width: 10, height: 10, color: 'var(--ai-accent)' }} />}
      </button>
      {open && <div style={{ paddingBottom: 16, paddingLeft: 20 }}>{children}</div>}
    </div>
  );
};

const ProvisionTag = ({ refText, label, primary, reason, onRemove }) => {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span className="prov-tag" style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '2px 8px',
        background: primary ? 'var(--paper-dark)' : 'transparent',
        border: primary ? '1px solid var(--border)' : '1px dashed var(--border-strong)',
        borderRadius: 2, color: 'var(--ink-secondary)',
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default',
      }}>
        {refText}
        <span style={{ fontFamily: "'Albert Sans', sans-serif", fontSize: 10, color: 'var(--ink-muted)' }}>{label}</span>
        {onRemove && <X onClick={(e) => { e.stopPropagation(); onRemove(); }} className="prov-x"
          style={{ width: 10, height: 10, color: 'var(--ink-muted)', cursor: 'pointer', flexShrink: 0 }} />}
      </span>
      {hover && reason && (
        <div className="tooltip-pop" style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, padding: '8px 12px',
          background: 'var(--paper)', border: '1px solid var(--border-strong)', borderRadius: 2,
          fontFamily: "'Albert Sans', sans-serif", fontSize: 12, color: 'var(--ink-secondary)',
          lineHeight: 1.45, maxWidth: 280, zIndex: 10, whiteSpace: 'normal',
        }}>
          <Sparkles style={{ width: 9, height: 9, color: 'var(--ai-accent)', display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          {reason}
        </div>
      )}
    </div>
  );
};

const EditableContextChip = ({ label, initialValue }) => {
  const [value, setValue] = useState(initialValue || '');
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  return (
    <div>
      <div style={{ fontFamily: "'Albert Sans', sans-serif", fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 4 }}>{label}</div>
      {editing ? (
        <input ref={ref} value={value} onChange={(e) => setValue(e.target.value)}
          onBlur={() => setEditing(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
          style={{ fontFamily: "'Albert Sans', sans-serif", fontSize: 13, color: 'var(--ink-secondary)',
            background: 'transparent', border: '1px solid var(--border-stronger)', borderRadius: 2,
            padding: '4px 8px', width: '100%', outline: 'none' }} />
      ) : (
        <div onClick={() => setEditing(true)} className="editable-field" style={{
          fontFamily: "'Albert Sans', sans-serif", fontSize: 13,
          color: value ? 'var(--ink-secondary)' : 'var(--ink-muted)',
          padding: '4px 8px', border: '1px solid transparent', borderRadius: 2,
          cursor: 'text', fontStyle: value ? 'normal' : 'italic',
        }}>{value || 'Ikke spesifisert'}</div>
      )}
    </div>
  );
};

const EditableSignalItem = ({ initialValue, type, onRemove }) => {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const ref = useRef(null);
  const isMono = type === 'ref' || type === 'prepWork';
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);
  const blur = () => { setEditing(false); if (!value.trim()) onRemove?.(); };
  const ff = isMono ? "'JetBrains Mono', monospace" : "'Newsreader', serif";
  const fs = isMono ? 11 : 13;
  if (editing) return (
    <input ref={ref} value={value} onChange={(e) => setValue(e.target.value)} onBlur={blur}
      onKeyDown={(e) => { if (e.key === 'Enter') blur(); if (e.key === 'Escape') { setValue(initialValue); setEditing(false); } }}
      style={{ fontFamily: ff, fontSize: fs, padding: '2px 6px', borderRadius: 2,
        border: '1px solid var(--border-stronger)', background: 'transparent',
        color: 'var(--ink)', outline: 'none', minWidth: 80, maxWidth: '100%' }} />
  );
  return (
    <span onClick={() => setEditing(true)} className="editable-field signal-item" style={{
      fontFamily: ff, fontSize: fs, padding: '2px 6px', borderRadius: 2,
      border: '1px solid transparent', cursor: 'text', color: 'var(--ink-secondary)',
      fontStyle: type === 'vector' ? 'italic' : 'normal',
      display: 'inline-flex', alignItems: 'center', gap: 4, transition: 'border-color 0.15s ease',
    }}>
      {value}
      <X onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="remove-x"
        style={{ width: 9, height: 9, color: 'var(--ink-muted)', cursor: 'pointer', flexShrink: 0 }} />
    </span>
  );
};

const SignalGroup = ({ type, label, color, items: init }) => {
  const [items, setItems] = useState(init);
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState('');
  const ar = useRef(null);
  useEffect(() => { if (adding && ar.current) ar.current.focus(); }, [adding]);
  const confirm = () => { if (nv.trim()) setItems(p => [...p, nv.trim()]); setNv(''); setAdding(false); };
  const isMono = type === 'ref' || type === 'prepWork';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Albert Sans', sans-serif", fontSize: 11, fontWeight: 500, color: 'var(--ink-tertiary)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 12, alignItems: 'center' }}>
        {items.map((item, i) => <EditableSignalItem key={`${i}-${item}`} initialValue={item} type={type}
          onRemove={() => setItems(p => p.filter((_, j) => j !== i))} />)}
        {adding ? (
          <input ref={ar} value={nv} onChange={(e) => setNv(e.target.value)} onBlur={confirm}
            onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') { setNv(''); setAdding(false); } }}
            placeholder={type === 'ref' ? '§ …' : type === 'fts' ? '«…»' : type === 'vector' ? 'Beskriv konsept…' : 'Referanse…'}
            style={{ fontFamily: isMono ? "'JetBrains Mono', monospace" : "'Newsreader', serif",
              fontSize: isMono ? 11 : 13, padding: '2px 6px', borderRadius: 2,
              border: '1px solid var(--border-stronger)', background: 'transparent',
              color: 'var(--ink)', outline: 'none', minWidth: 100 }} />
        ) : (
          <button onClick={() => setAdding(true)} className="add-term-btn" style={{
            display: 'inline-flex', alignItems: 'center', fontFamily: "'Albert Sans', sans-serif",
            fontSize: 10, fontWeight: 500, color: 'var(--ink-muted)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '2px 4px',
          }}><Plus style={{ width: 9, height: 9 }} /></button>
        )}
      </div>
    </div>
  );
};

const EditableText = ({ initialValue, aiGenerated = true, serif = true, size = 14, weight = 400, multiline = false }) => {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(false);
  const ref = useRef(null);
  const isAi = aiGenerated && !edited;
  useEffect(() => {
    if (editing && ref.current) { ref.current.focus(); if (multiline) { ref.current.style.height = 'auto'; ref.current.style.height = ref.current.scrollHeight + 'px'; } }
  }, [editing]);
  const blur = () => { setEditing(false); if (value !== initialValue) setEdited(true); };
  const ff = serif ? "'Newsreader', serif" : "'Albert Sans', sans-serif";
  const pl = aiGenerated ? 16 : 8;
  if (editing) {
    const El = multiline ? 'textarea' : 'input';
    return <El ref={ref} value={value} onChange={(e) => {
      setValue(e.target.value);
      if (multiline && ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = ref.current.scrollHeight + 'px'; }
    }} onBlur={blur} onKeyDown={(e) => { if (!multiline && e.key === 'Enter') blur(); }}
      style={{ fontFamily: ff, fontSize: size, fontWeight: weight, lineHeight: 1.55,
        color: 'var(--ink)', fontStyle: 'normal', padding: `4px 8px 4px ${pl}px`, borderRadius: 2,
        width: '100%', border: '1px solid var(--border-stronger)', borderLeft: '2px solid var(--border-stronger)',
        background: 'transparent', outline: 'none', resize: 'none', overflow: 'hidden' }} />;
  }
  return (
    <div onClick={() => setEditing(true)} className="editable-field" style={{
      fontFamily: ff, fontSize: size, fontWeight: weight, lineHeight: 1.55,
      color: isAi ? 'var(--ai-accent)' : 'var(--ink)', fontStyle: isAi ? 'italic' : 'normal',
      padding: `4px 8px 4px ${pl}px`, borderRadius: 2, cursor: 'text', width: '100%',
      border: '1px solid transparent', borderLeft: isAi ? '2px solid var(--ai-accent)' : '2px solid transparent',
      transition: 'color 0.2s ease',
    }}>
      {value}
      {edited && <span style={{ fontFamily: "'Albert Sans', sans-serif", fontSize: 9, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginLeft: 8,
        verticalAlign: 'middle' }}>Redigert</span>}
    </div>
  );
};

// ── Skeleton placeholder for pending section ──
const SectionSkeleton = ({ label }) => (
  <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '14px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
    <Loader2 className="spinner" style={{ width: 10, height: 10, color: 'var(--ai-accent)', flexShrink: 0 }} />
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-muted)' }}>{label}</span>
  </div>
);

// ── Elapsed timer ──
const useElapsed = (running) => {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  useEffect(() => {
    if (!running) { startRef.current = null; return; }
    startRef.current = Date.now();
    setElapsed(0);
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [running]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════
export default function NyAnalyse() {
  const [darkMode, setDarkMode] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [contextData, setContextData] = useState({ procedure: '', threshold: '', serviceArea: '', provisions: '' });

  // Streaming state
  const [streaming, setStreaming] = useState(false);
  const [completed, setCompleted] = useState(0); // 0-6
  const [cancelled, setCancelled] = useState(false);
  const [provisions, setProvisions] = useState(MOCK.provisions);
  const timerRef = useRef(null);
  const scrollRef = useRef(null);
  const elapsed = useElapsed(streaming);

  const textareaRef = useRef(null);
  useEffect(() => {
    if (textareaRef.current && !streaming) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(80, textareaRef.current.scrollHeight) + 'px';
    }
  }, [inputText, streaming]);

  // Simulate progressive section completion
  useEffect(() => {
    if (!streaming) return;
    let section = 0;
    const advance = () => {
      section++;
      setCompleted(section);
      if (section >= 6) { setStreaming(false); return; }
      timerRef.current = setTimeout(advance, SECTION_DELAYS[section]);
    };
    timerRef.current = setTimeout(advance, SECTION_DELAYS[0]);
    return () => clearTimeout(timerRef.current);
  }, [streaming]);

  // Auto-scroll to latest section
  useEffect(() => {
    if (completed > 0 && scrollRef.current) {
      setTimeout(() => {
        const el = document.getElementById(`section-${completed}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [completed]);

  const handleAnalyze = () => {
    if (!inputText.trim() || inputText.trim().length <= 10) return;
    setCompleted(0); setCancelled(false); setProvisions(MOCK.provisions);
    setStreaming(true);
  };

  const handleCancel = () => {
    clearTimeout(timerRef.current);
    setStreaming(false);
    setCancelled(true);
  };

  const handleStartDirect = () => {
    if (!inputText.trim()) return;
    alert(`→ Arbeidsflaten åpnes med:\nProblemstilling: «${inputText}»\nScope-panelet er åpent.`);
  };

  const handleStartAnalysis = () => {
    alert(`→ Arbeidsflaten åpnes med ${completed} av 6 scope-seksjoner utfylt.`);
  };

  const canSubmit = inputText.trim().length > 10;
  const done = completed >= 6;
  const hasContent = completed > 0;
  const showCTA = done || (cancelled && hasContent);
  const inputCollapsed = streaming || hasContent;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap');
        :root {
          --ink:#1C1B1A;--ink-secondary:#33312E;--ink-tertiary:#4A4843;--ink-muted:#7A766F;
          --paper:#F8F6F1;--paper-dark:#EDEAE3;
          --border-subtle:rgba(28,27,26,0.06);--border:rgba(28,27,26,0.12);
          --border-strong:rgba(28,27,26,0.20);--border-stronger:rgba(28,27,26,0.35);
          --control-bg:#EDEAE3;--control-border:rgba(28,27,26,0.12);--control-border-focus:rgba(28,27,26,0.40);
          --ai-accent:#92600A;--ai-border:rgba(146,96,10,0.20);--ai-bg:rgba(146,96,10,0.05);
          --signal-fts:#4A6A8B;
          --hover-bg:rgba(28,27,26,0.02);--hover-bg-strong:rgba(28,27,26,0.04);
          --header-bg:rgba(248,246,241,0.85);
          --noise-svg:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
        }
        .dark {
          --ink:#E2DFD6;--ink-secondary:#C4C0B5;--ink-tertiary:#8E8A80;--ink-muted:#5C5850;
          --paper:#1E1C19;--paper-dark:#16140F;
          --border-subtle:rgba(232,229,220,0.06);--border:rgba(232,229,220,0.10);
          --border-strong:rgba(232,229,220,0.16);--border-stronger:rgba(232,229,220,0.28);
          --control-bg:#262420;--control-border:rgba(232,229,220,0.12);--control-border-focus:rgba(232,229,220,0.30);
          --ai-accent:#C49A4E;--ai-border:rgba(196,154,78,0.25);--ai-bg:rgba(196,154,78,0.08);
          --signal-fts:#8BAAC4;
          --hover-bg:rgba(232,229,220,0.03);--hover-bg-strong:rgba(232,229,220,0.06);
          --header-bg:rgba(30,28,25,0.92);
          --noise-svg:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E");
        }
        *{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:rgba(146,96,10,0.15);color:var(--ai-accent)}
        .dark ::selection{background:rgba(196,154,78,0.20);color:var(--ai-accent)}
        .logo-home{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--ink);border-radius:4px;background:transparent;cursor:pointer;transition:border-color .15s ease;flex-shrink:0}
        .logo-home:hover{border-color:var(--border-strong)}.logo-home:active{transform:scale(.95)}
        .mode-toggle{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:none;border:1px solid var(--border);border-radius:4px;color:var(--ink-muted);cursor:pointer;transition:all .15s ease}
        .mode-toggle:hover{border-color:var(--border-strong);color:var(--ink-tertiary)}
        .editable-field{transition:border-color .15s ease}.editable-field:hover{border-color:var(--border-strong)!important}
        .problem-textarea{width:100%;resize:none;overflow:hidden;font-family:'Newsreader',serif;font-size:22px;line-height:1.5;font-weight:400;color:var(--ink);letter-spacing:-.01em;background:transparent;border:none;outline:none;padding:0;min-height:80px}
        .problem-textarea::placeholder{color:var(--ink-muted);font-style:italic}
        .problem-textarea:disabled{opacity:.35}
        .btn-primary{font-family:'Albert Sans',sans-serif;font-weight:600;border-radius:4px;cursor:pointer;transition:all .15s ease;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
        .btn-primary.sm{font-size:13px;padding:8px 20px}.btn-primary.lg{font-size:14px;padding:10px 24px}
        .btn-primary.filled{background:var(--ink);color:var(--paper);border:1px solid var(--ink)}
        .btn-primary.filled:hover:not(:disabled){background:#000}.btn-primary.filled:active:not(:disabled){transform:scale(.98)}
        .btn-primary.filled:disabled{opacity:.25;cursor:not-allowed}
        .dark .btn-primary.filled{background:transparent;color:var(--ink-secondary);border:1px solid var(--border-strong)}
        .dark .btn-primary.filled:hover:not(:disabled){background:var(--hover-bg-strong)}
        .btn-ghost{font-family:'Albert Sans',sans-serif;font-size:12px;font-weight:500;color:var(--ink-muted);background:none;border:none;cursor:pointer;padding:4px 0;transition:color .15s ease;display:inline-flex;align-items:center;gap:6px}
        .btn-ghost:hover{color:var(--ink)}
        .context-toggle{font-family:'Albert Sans',sans-serif;font-size:12px;font-weight:500;color:var(--ink-muted);background:none;border:none;cursor:pointer;padding:6px 0;transition:color .15s ease;display:flex;align-items:center;gap:6px}
        .context-toggle:hover{color:var(--ink-tertiary)}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{opacity:0;animation:fadeUp .5s cubic-bezier(.16,1,.3,1) forwards}
        @keyframes spin{to{transform:rotate(360deg)}}.spinner{animation:spin 1.2s linear infinite}
        .context-input{font-family:'Albert Sans',sans-serif;font-size:13px;color:var(--ink-secondary);background:var(--control-bg);border:1px solid var(--control-border);border-radius:2px;padding:8px 10px;width:100%;outline:none;transition:border-color .15s ease}
        .context-input:focus{border-color:var(--control-border-focus)}.context-input::placeholder{color:var(--ink-muted);font-style:italic}
        .direct-link{font-family:'Albert Sans',sans-serif;font-size:12px;font-weight:500;color:var(--ink-muted);background:none;border:none;cursor:pointer;padding:8px 0;transition:color .15s ease;display:inline-flex;align-items:center;gap:6px;border-bottom:1px dashed var(--border)}
        .direct-link:hover{color:var(--ink-secondary);border-color:var(--border-strong)}
        .signal-item .remove-x{opacity:0;transition:opacity .15s ease}.signal-item:hover .remove-x{opacity:.5}.signal-item .remove-x:hover{opacity:1!important}
        .prov-tag .prov-x{opacity:0;transition:opacity .15s ease}.prov-tag:hover .prov-x{opacity:.5}.prov-tag .prov-x:hover{opacity:1!important}
        .add-term-btn{transition:color .15s ease}.add-term-btn:hover{color:var(--ink-tertiary)!important}
        .tooltip-pop{animation:dropIn .12s ease forwards}@keyframes dropIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        /* Input summary when collapsed */
        .input-summary{font-family:'Newsreader',serif;font-size:14px;color:var(--ink-tertiary);font-style:italic;line-height:1.5;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
        /* Progress bar */
        .progress-strip{display:flex;gap:4px;align-items:center}
        .progress-segment{height:2px;border-radius:1px;flex:1;transition:background .3s ease}
      `}} />

      <div className={darkMode ? 'dark' : ''} style={{
        height: '100vh', width: '100%', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', backgroundColor: 'var(--paper)', color: 'var(--ink)',
        colorScheme: darkMode ? 'dark' : 'light', backgroundImage: 'var(--noise-svg)',
        fontFamily: "'Albert Sans', sans-serif",
      }}>

        {/* HEADER */}
        <header style={{
          height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--header-bg)', backdropFilter: 'blur(12px)', flexShrink: 0, zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="logo-home" title="Tilbake til porteføljen">
              <span style={{ fontFamily: "'Newsreader', serif", fontStyle: 'italic', fontWeight: 600, fontSize: 13, lineHeight: 1 }}>§</span>
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
            <span style={{ fontFamily: "'Newsreader', serif", fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>Ny analyse</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="mode-toggle" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Sun style={{ width: 14, height: 14 }} /> : <Moon style={{ width: 14, height: 14 }} />}
            </button>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)',
              background: 'var(--paper-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, color: 'var(--ink-secondary)' }}>MJ</div>
          </div>
        </header>

        {/* MAIN */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 80px' }}>

            {/* ── INPUT AREA ── */}
            <div className="fade-up" style={{ paddingTop: inputCollapsed ? 32 : 64, transition: 'padding-top 0.3s ease' }}>

              {!inputCollapsed && (
                <>
                  <button className="btn-ghost" style={{ marginBottom: 32 }}>
                    <ArrowLeft style={{ width: 12, height: 12 }} /> Tilbake til porteføljen
                  </button>
                  <h1 style={{ fontFamily: "'Newsreader', serif", fontSize: 28, fontWeight: 500,
                    color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 1.25, marginBottom: 8 }}>Ny analyse</h1>
                  <p style={{ fontSize: 14, color: 'var(--ink-tertiary)', lineHeight: 1.5, marginBottom: 40, maxWidth: 520 }}>
                    Beskriv hva du vil undersøke. KI strukturerer en forskningsplan, eller start direkte med et åpent scope-panel.
                  </p>
                </>
              )}

              {/* Input: full textarea or collapsed summary */}
              {inputCollapsed ? (
                <div style={{ padding: 12, background: 'var(--paper-dark)', border: '1px solid var(--border)',
                  borderRadius: 2, display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 24 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--ink-muted)', flexShrink: 0 }}>Input</span>
                  <span className="input-summary">«{inputText}»</span>
                  {!streaming && <button className="btn-ghost" onClick={() => { setCompleted(0); setCancelled(false); }}
                    style={{ flexShrink: 0, fontSize: 11 }}>Endre</button>}
                </div>
              ) : (
                <>
                  <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 24, marginBottom: 20 }}>
                    <textarea ref={textareaRef} className="problem-textarea"
                      placeholder="Beskriv problemstillingen din uformelt…"
                      value={inputText} onChange={(e) => setInputText(e.target.value)} rows={3} />
                  </div>

                  {/* Optional context */}
                  <div style={{ marginBottom: 32 }}>
                    <button className="context-toggle" onClick={() => setShowContext(!showContext)}>
                      <ChevronRight style={{ width: 11, height: 11, transform: showContext ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease' }} />
                      Jeg vet allerede…
                      <span style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 400, fontStyle: 'italic' }}>(valgfritt)</span>
                    </button>
                    {showContext && (
                      <div className="fade-up" style={{ marginTop: 12, padding: 16, background: 'var(--paper-dark)',
                        border: '1px solid var(--border)', borderRadius: 2 }}>
                        <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                          Brukes som input til KI-analysen, eller overføres til scope-panelet ved direkte start.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {[['Prosedyre','procedure','F.eks. åpen anbudskonkurranse'],['Terskelverdi','threshold','F.eks. EØS, nasjonal'],
                            ['Tjenesteområde','serviceArea','F.eks. IKT, bygg, helse'],['Bestemmelser','provisions','F.eks. FOA § 16-11']
                          ].map(([l,k,ph]) => (
                            <div key={k}>
                              <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                                letterSpacing: '0.06em', color: 'var(--ink-muted)', display: 'block', marginBottom: 4 }}>{l}</label>
                              <input className="context-input" placeholder={ph} value={contextData[k]}
                                onChange={(e) => setContextData(p => ({ ...p, [k]: e.target.value }))} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn-primary sm filled" disabled={!canSubmit} onClick={handleAnalyze}>
                      <Sparkles style={{ width: 13, height: 13 }} /> Analyser med KI
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>eller</span>
                    <button className="direct-link" disabled={!canSubmit} onClick={handleStartDirect}
                      style={{ opacity: canSubmit ? 1 : 0.35 }}>
                      Start direkte <ArrowRight style={{ width: 11, height: 11 }} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── STREAMING / REVIEW AREA ── */}
            {(hasContent || streaming) && (
              <div style={{ marginTop: inputCollapsed && !streaming ? 0 : 8 }}>
                {/* Progress indicator */}
                {streaming && (
                  <div className="fade-up" style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Loader2 className="spinner" style={{ width: 12, height: 12, color: 'var(--ai-accent)' }} />
                        <span style={{ fontFamily: "'Albert Sans', sans-serif", fontSize: 12, fontWeight: 500, color: 'var(--ai-accent)' }}>
                          Seksjon {Math.min(completed + 1, 6)} av 6
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--ink-muted)' }}>{elapsed}</span>
                      </div>
                      <button className="btn-ghost" onClick={handleCancel} style={{ fontSize: 11, color: 'var(--ink-muted)' }}>
                        Avbryt
                      </button>
                    </div>
                    <div className="progress-strip">
                      {SECTION_LABELS.map((_, i) => (
                        <div key={i} className="progress-segment"
                          style={{ background: i < completed ? 'var(--ai-accent)' : i === completed ? 'var(--ai-accent)' : 'var(--border)' ,
                            opacity: i === completed ? 0.4 : 1 }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Review header (appears after first section, stays) */}
                {!streaming && (
                  <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 24, marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Sparkles style={{ width: 14, height: 14, color: 'var(--ai-accent)' }} />
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: 'var(--ai-accent)' }}>
                        Forskningsplan{cancelled ? ` · ${completed} av 6 seksjoner` : ''}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--ink-tertiary)', lineHeight: 1.5 }}>
                      {cancelled
                        ? 'Analysen ble avbrutt. Du kan starte med det som er klart, eller kjøre på nytt.'
                        : 'Klikk på tekst for å redigere. Scopet kan justeres underveis i analysen.'}
                    </p>
                  </div>
                )}

                {/* ── SECTIONS ── */}

                {/* Initial wait — before first section arrives */}
                {streaming && completed === 0 && (
                  <div className="fade-up" style={{ paddingTop: 32, paddingBottom: 32 }}>
                    <p style={{
                      fontFamily: "'Newsreader', serif", fontSize: 15, fontStyle: 'italic',
                      color: 'var(--ai-accent)', lineHeight: 1.6, maxWidth: 460,
                    }}>
                      Leser problemstillingen din og identifiserer relevante rettskilder i grafen.
                      Første seksjon dukker opp om et øyeblikk.
                    </p>
                  </div>
                )}

                {/* 1. Problemstilling */}
                {completed >= 1 && (
                  <div id="section-1" className="fade-up">
                    <ReviewSection label="Problemstilling" defaultOpen>
                      <EditableText initialValue={MOCK.refinedProblem} aiGenerated serif size={17} weight={500} multiline />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                        <Sparkles style={{ width: 10, height: 10, color: 'var(--ai-accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: 'var(--ai-accent)' }}>Spisset av KI fra din input</span>
                      </div>
                    </ReviewSection>
                  </div>
                )}

                {/* 2. Delspørsmål */}
                {completed >= 2 && (
                  <div id="section-2" className="fade-up">
                    <ReviewSection label="Delspørsmål" defaultOpen>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {MOCK.subProblems.map((sp, i) => (
                          <div key={sp.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                              color: 'var(--ink-muted)', flexShrink: 0, width: 16, textAlign: 'right' }}>{i + 1}.</span>
                            <EditableText initialValue={sp.text} aiGenerated serif size={14} />
                          </div>
                        ))}
                        <button className="btn-ghost" style={{ marginLeft: 24, marginTop: 4 }}>
                          <Plus style={{ width: 11, height: 11 }} /> Legg til delspørsmål
                        </button>
                      </div>
                    </ReviewSection>
                  </div>
                )}

                {/* 3. Kontekst */}
                {completed >= 3 && (
                  <div id="section-3" className="fade-up">
                    <ReviewSection label="Kontekst" defaultOpen={false}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <EditableContextChip label="Prosedyre" initialValue={MOCK.context.procedure} />
                        <EditableContextChip label="Terskelverdi" initialValue={MOCK.context.threshold} />
                        <EditableContextChip label="Tjenesteområde" initialValue={MOCK.context.service_area} />
                        <EditableContextChip label="Marked" initialValue={MOCK.context.market} />
                      </div>
                    </ReviewSection>
                  </div>
                )}

                {/* 4. Bestemmelser */}
                {completed >= 4 && (
                  <div id="section-4" className="fade-up">
                    <ReviewSection label="Bestemmelser" defaultOpen>
                      <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: 'var(--ink-muted)', display: 'block', marginBottom: 8 }}>Primære</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {provisions.filter(p => p.primary).map(p => (
                            <ProvisionTag key={p.ref} refText={p.ref} label={p.label} primary
                              reason={p.reason} onRemove={() => setProvisions(pr => pr.filter(x => x.ref !== p.ref))} />
                          ))}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: 'var(--ink-muted)', display: 'block', marginBottom: 8 }}>Sekundære</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {provisions.filter(p => !p.primary).map(p => (
                            <ProvisionTag key={p.ref} refText={p.ref} label={p.label} primary={false}
                              reason={p.reason} onRemove={() => setProvisions(pr => pr.filter(x => x.ref !== p.ref))} />
                          ))}
                        </div>
                      </div>
                      <button className="btn-ghost" style={{ marginTop: 12 }}>
                        <Plus style={{ width: 11, height: 11 }} /> Legg til bestemmelse
                      </button>
                    </ReviewSection>
                  </div>
                )}

                {/* 5. Søkestrategi */}
                {completed >= 5 && (
                  <div id="section-5" className="fade-up">
                    <ReviewSection label="Søkestrategi" defaultOpen>
                      <SignalGroup type="ref" label="Referansekoblinger" color="var(--ink-muted)" items={MOCK.searchStrategy.ref} />
                      <SignalGroup type="fts" label="Fulltekstsøk" color="var(--signal-fts)" items={MOCK.searchStrategy.fts} />
                      <SignalGroup type="vector" label="Konseptsøk" color="var(--ai-accent)" items={MOCK.searchStrategy.vector} />
                      <SignalGroup type="prepWork" label="Forarbeider" color="var(--ink-tertiary)" items={MOCK.searchStrategy.prepWork} />
                    </ReviewSection>
                  </div>
                )}

                {/* 6. KI-resonnement */}
                {completed >= 6 && (
                  <div id="section-6" className="fade-up">
                    <ReviewSection label="KI-resonnement" defaultOpen={false} aiOwned>
                      <div style={{ borderLeft: '2px solid var(--ai-accent)', paddingLeft: 16 }}>
                        <p style={{ fontFamily: "'Newsreader', serif", fontSize: 14,
                          color: 'var(--ai-accent)', fontStyle: 'italic', lineHeight: 1.65 }}>{MOCK.reasoning}</p>
                      </div>
                    </ReviewSection>
                  </div>
                )}

                {/* Pending section skeletons */}
                {streaming && completed < 6 && (
                  <SectionSkeleton label={SECTION_LABELS[completed]} />
                )}

                {/* CTA */}
                {showCTA && (
                  <div className="fade-up" style={{ paddingTop: 40, borderTop: '1px solid var(--border-subtle)', marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <button className="btn-primary lg filled" onClick={handleStartAnalysis}>
                        {cancelled ? `Start med ${completed} seksjoner` : 'Start analyse'}
                        <ArrowRight style={{ width: 14, height: 14 }} />
                      </button>
                      {cancelled && (
                        <button className="btn-ghost" onClick={() => { setCompleted(0); setCancelled(false); setStreaming(false); }}>
                          Kjør på nytt
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

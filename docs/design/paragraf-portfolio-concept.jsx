import { useState, useMemo } from "react";

const T = {
  bg: '#F5F3EE',
  panel: '#FAF9F6',
  surface: '#FFFFFF',
  input: '#EFECE5',
  ink: '#1A1814',
  ink2: '#5C564D',
  ink3: '#8C8578',
  ink4: '#B0A99E',
  border: 'rgba(26,24,20,0.08)',
  borderM: 'rgba(26,24,20,0.13)',
  borderS: 'rgba(26,24,20,0.22)',
  kofa: '#8B6914',
  kofaBg: '#F0EBD8',
  prov: '#4A6670',
  provBg: '#E8EEF0',
  tension: '#A63D3D',
  tensionBg: 'rgba(166,61,61,0.04)',
  tensionBorder: 'rgba(166,61,61,0.15)',
  confirm: '#3D7A4A',
  confirmBg: '#EBF5ED',
  warn: '#A67B2E',
  warnBg: '#FBF5E8',
  gap: '#9B4DCA',
  overlap: '#6B4C6E',
  overlapBg: 'rgba(107,76,110,0.05)',
  overlapBorder: 'rgba(107,76,110,0.15)',
  ai: '#8B6914',
  aiBorder: 'rgba(139,105,20,0.2)',
  highlight: '#FBF5E8',
};

const STATUS = {
  setup:          { label: 'Oppsett',        color: T.ink4,   order: 0 },
  primary_search: { label: 'Primærsøk',      color: T.prov,   order: 1 },
  screening:      { label: 'Screening',       color: T.kofa,   order: 2 },
  post_search:    { label: 'Ettersøk',        color: T.warn,   order: 3 },
  synthesis:      { label: 'Sammenstilling',  color: T.confirm,order: 4 },
};

/* ═══════════════ DATA ═══════════════ */

const ANALYSES = [
  { id:'a1', owner:'meg', ownerName:'Helene Johansen', title:'FOA §16-10 — Rådighet', problem:'Er ESPD fra støttende virksomhet tilstrekkelig til å dokumentere rådighet, eller må forpliktelseserklæring foreligge ved tilbudsfrist?',
    provisions:['§16-10','§17-1','§16-12','LOA §5'], status:'screening', iteration:2,
    cases:{total:8,read:5}, propositions:4, tensions:1, gaps:4,
    lastActive:'2 timer siden', lastAction:'Leste 2022/345 — «binær vs. kvantitativ rådighet»',
    nextStep:'3 uleste A-saker gjenstår. 2018/123 er mest sitert.',
    abc:{A:3,B:3,C:2}, readByCategory:{A:2,B:2,C:1},
    keyPropositions:['Forpliktelseserklæring ved tilbudsfrist','Ettersending under vilkår','ESPD ≠ forpliktelseserklæring','Helhetsvurdering'],
    gapPairs:[{a:'§16-10',b:'§16-3'},{a:'§17-1',b:'§16-12'},{a:'§17-1',b:'§16-3'},{a:'§16-12',b:'LOA §5'}],
    recentSessions:[
      {date:'I dag, 09:15', actions:['Leste 2022/345','La til seed «binær rådighet»','Iterasjon 2 startet']},
      {date:'I går, 14:30', actions:['Leste 2023/456, 2022/789','Identifiserte spenning om tidspunkt','Notat: «ESPD er nøkkelspørsmålet»']},
    ],
  },
  { id:'a2', owner:'meg', ownerName:'Helene Johansen', title:'FOA §8-4 — Avvisningsplikt', problem:'Hvor går grensen mellom avvik som skal føre til avvisning og avvik som kan aksepteres?',
    provisions:['§8-4','§24-8','LOA §5'], status:'primary_search', iteration:1,
    cases:{total:23,read:4}, propositions:1, tensions:0, gaps:2,
    lastActive:'I går, 16:30', lastAction:'Primærsøk fullført. 23 kandidater.',
    nextStep:'19 uleste saker. Start med A-kategorien (6 saker).',
    abc:{A:6,B:9,C:8}, readByCategory:{A:2,B:2,C:0},
    keyPropositions:['Vesentlig avvik → avvisningsplikt'],
    gapPairs:[{a:'§8-4',b:'LOA §5'},{a:'§24-8',b:'LOA §5'}],
    recentSessions:[{date:'I går, 16:30', actions:['Primærsøk fullført','4 A-saker skummet']}],
  },
  { id:'a3', owner:'meg', ownerName:'Helene Johansen', title:'FOA §7-9 — Tildelingskriterier', problem:'Hvilke rammer gjelder for oppdragsgivers valg av evalueringsmodell?',
    provisions:['§7-9','§18-1','LOA §5'], status:'setup', iteration:0,
    cases:{total:0,read:0}, propositions:0, tensions:0, gaps:0,
    lastActive:'3 dager siden', lastAction:'Problemstilling definert.',
    nextStep:'Kjør primærsøk.',
    abc:{A:0,B:0,C:0}, readByCategory:{A:0,B:0,C:0},
    keyPropositions:[], gapPairs:[],
    recentSessions:[{date:'3 dager siden', actions:['Opprettet analyse','Seeds definert']}],
  },
  { id:'a4', owner:'meg', ownerName:'Helene Johansen', title:'FOA §14-1 — Kvalifikasjonskrav', problem:'Hvor langt kan oppdragsgiver gå i å stille krav til leverandørens organisasjon og bemanning?',
    provisions:['§14-1','§16-6','§16-7'], status:'synthesis', iteration:3,
    cases:{total:12,read:12}, propositions:6, tensions:0, gaps:0,
    lastActive:'1 uke siden', lastAction:'Alle saker lest. Eksport påbegynt.',
    nextStep:'Rettssetningene er klare for lovkommentar.',
    abc:{A:4,B:5,C:3}, readByCategory:{A:4,B:5,C:3},
    keyPropositions:['Bemanning som kvalifikasjonskrav','Krav til nøkkelpersonell','Forholdsmessighetskravet'],
    gapPairs:[], recentSessions:[{date:'1 uke siden', actions:['Ferdigstilt screening','Eksportert utkast']}],
  },
  // Team
  { id:'t1', owner:'kari', ownerName:'Kari Nordmann', title:'FOA §24-2 — Avlysning', problem:'Vilkår for lovlig avlysning og erstatningsrettslige konsekvenser.',
    provisions:['§24-2','§10-1','LOA §5'], status:'post_search', iteration:3,
    cases:{total:15,read:15}, propositions:7, tensions:2, gaps:1,
    lastActive:'1 time siden', lastAction:'Ettersøk: 2 nye saker via vinkelrotasjon.',
    nextStep:null, abc:{A:5,B:6,C:4}, readByCategory:{A:5,B:6,C:4},
    keyPropositions:['Saklig grunn for avlysning','Erstatning ved urettmessig avlysning','Frist for avlysning'],
    gapPairs:[{a:'§24-2',b:'§10-1'}], recentSessions:[],
  },
  { id:'t2', owner:'erik', ownerName:'Erik Hansen', title:'FOA §16-10 — Kapasitetslån ved rammeavtaler', problem:'Gjelder rådighets­kravet ved avrop eller ved inngåelse av rammeavtalen?',
    provisions:['§16-10','§26-1','§17-1'], status:'screening', iteration:1,
    cases:{total:11,read:7}, propositions:3, tensions:1, gaps:0,
    lastActive:'4 timer siden', lastAction:'Leste 3 saker om rammeavtale-avrop.',
    nextStep:null, abc:{A:3,B:5,C:3}, readByCategory:{A:3,B:3,C:1},
    keyPropositions:['Rådighet ved inngåelse vs. avrop','Rammeavtale som kvalifikasjonsgrunnlag'],
    gapPairs:[], recentSessions:[],
  },
  { id:'t3', owner:'mari', ownerName:'Mari Olsen', title:'FOA §7-3 — Rammeavtalers varighet', problem:'Når kan rammeavtaler forlenges utover 4 år?',
    provisions:['§7-3','§26-1'], status:'screening', iteration:1,
    cases:{total:9,read:3}, propositions:1, tensions:0, gaps:1,
    lastActive:'2 dager siden', lastAction:'Screening påbegynt.',
    nextStep:null, abc:{A:2,B:4,C:3}, readByCategory:{A:1,B:2,C:0},
    keyPropositions:['Særlige grunner for forlengelse'],
    gapPairs:[{a:'§7-3',b:'§26-1'}], recentSessions:[],
  },
];

const OVERLAPS = [
  { a:'a1', b:'t2', shared:['§16-10','§17-1'], cases:3, note:'Begge analyserer §16-10 — rådighet vs. rammeavtale-tidspunkt' },
  { a:'a2', b:'t1', shared:['LOA §5'], cases:1, note:'Deler likebehandlingsprinsippet som sekundærbestemmelse' },
  { a:'t2', b:'t3', shared:['§26-1'], cases:2, note:'Rammeavtalebestemmelser — ulik vinkel' },
];

/* ═══════════════ COMPONENTS ═══════════════ */

function AnalysisRow({ analysis, isSelected, isTeam, hasOverlap, onClick }) {
  const s = STATUS[analysis.status];
  const pct = analysis.cases.total ? Math.round(analysis.cases.read / analysis.cases.total * 100) : 0;

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px',
      cursor: 'pointer',
      background: isSelected ? T.active : 'transparent',
      borderBottom: `1px solid ${T.border}`,
      borderLeft: `3px solid ${isSelected ? (s?.color || T.ink3) : 'transparent'}`,
      transition: 'background 0.1s ease',
    }}
    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(26,24,20,0.02)'; }}
    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Phase dot */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: s?.color || T.ink4, opacity: 0.7,
        flexShrink: 0,
      }} />

      {/* Title + provisions */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isTeam && <span style={{ fontSize: 10, color: T.ink4, fontWeight: 500 }}>{analysis.ownerName.split(' ')[0]}</span>}
          <span style={{
            fontSize: 13, fontWeight: 600, color: T.ink,
            letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{analysis.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {analysis.provisions.slice(0, 3).map(p => (
            <span key={p} style={{
              fontSize: 10, fontFamily: "'Söhne Mono', monospace", fontWeight: 500,
              padding: '1px 4px', borderRadius: 2,
              background: T.provBg, color: T.prov,
            }}>{p}</span>
          ))}
          {analysis.provisions.length > 3 && (
            <span style={{ fontSize: 10, color: T.ink4 }}>+{analysis.provisions.length - 3}</span>
          )}
        </div>
      </div>

      {/* Status */}
      <span style={{
        fontSize: 10, fontWeight: 500, color: s?.color || T.ink4,
        minWidth: 65, textAlign: 'right',
      }}>{s?.label}</span>

      {/* Progress bar */}
      <div style={{ width: 56, flexShrink: 0 }}>
        {analysis.cases.total > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.input, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: pct === 100 ? T.confirm : T.ink3 }} />
            </div>
            <span style={{ fontSize: 10, fontFamily: "'Söhne Mono', monospace", color: T.ink4, minWidth: 20, textAlign: 'right' }}>
              {analysis.cases.read}/{analysis.cases.total}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 10, color: T.ink4, textAlign: 'right', display: 'block' }}>—</span>
        )}
      </div>

      {/* Tension indicator */}
      <div style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>
        {analysis.tensions > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: T.tension }}>{analysis.tensions}</span>
        )}
      </div>

      {/* Overlap dot */}
      <div style={{ width: 14, flexShrink: 0 }}>
        {hasOverlap && (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="4.5" cy="6" r="3.5" fill="none" stroke={T.overlap} strokeWidth="1" opacity="0.5" />
            <circle cx="7.5" cy="6" r="3.5" fill="none" stroke={T.overlap} strokeWidth="1" opacity="0.5" />
          </svg>
        )}
      </div>

      {/* Time */}
      <span style={{ fontSize: 10, color: T.ink4, minWidth: 70, textAlign: 'right', flexShrink: 0 }}>
        {analysis.lastActive}
      </span>
    </div>
  );
}

function DetailPanel({ analysis, overlaps, onClose, onOpen }) {
  if (!analysis) return null;
  const s = STATUS[analysis.status];
  const pct = analysis.cases.total ? Math.round(analysis.cases.read / analysis.cases.total * 100) : 0;
  const myOverlaps = overlaps.filter(o => o.a === analysis.id || o.b === analysis.id);

  return (
    <div style={{
      width: 360, minWidth: 360, height: '100%',
      background: T.panel, borderLeft: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: s?.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s?.label}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.ink4, fontSize: 15, padding: '0 2px' }}>×</button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, lineHeight: '1.3', letterSpacing: '-0.01em', marginBottom: 6 }}>
          {analysis.title}
        </div>
        <div style={{ fontSize: 12.5, lineHeight: '1.55', color: T.ink2 }}>{analysis.problem}</div>

        {/* Open button */}
        <button onClick={() => onOpen(analysis)} style={{
          marginTop: 12, width: '100%', padding: '8px 12px', borderRadius: 5,
          background: T.ink, color: T.panel, border: 'none',
          fontSize: 12, fontWeight: 500, cursor: 'pointer',
          transition: 'opacity 0.12s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >Åpne analyse</button>
      </div>

      {/* Scrollable detail */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Provisions with case counts */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Bestemmelser</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {analysis.provisions.map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: "'Söhne Mono', monospace", fontSize: 12, fontWeight: 600, color: T.prov, minWidth: 55 }}>{p}</span>
                <div style={{ flex: 1, height: 1, background: T.border }} />
              </div>
            ))}
          </div>
        </div>

        {/* Reading progress per category */}
        {analysis.cases.total > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              Lesestatus — {analysis.cases.read} av {analysis.cases.total}
            </div>
            {['A', 'B', 'C'].filter(cat => analysis.abc[cat] > 0).map(cat => {
              const total = analysis.abc[cat];
              const read = analysis.readByCategory[cat];
              const catPct = total ? Math.round(read / total * 100) : 0;
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '1px 4px', borderRadius: 3,
                    background: cat === 'A' ? 'rgba(26,24,20,0.08)' : cat === 'B' ? 'rgba(26,24,20,0.05)' : 'rgba(26,24,20,0.03)',
                    color: cat === 'A' ? T.ink : cat === 'B' ? T.ink2 : T.ink3,
                    minWidth: 18, textAlign: 'center',
                  }}>{cat}</span>
                  <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.input, overflow: 'hidden' }}>
                    <div style={{ width: `${catPct}%`, height: '100%', borderRadius: 2, background: cat === 'A' ? T.ink : T.ink2 }} />
                  </div>
                  <span style={{ fontFamily: "'Söhne Mono', monospace", fontSize: 10, color: T.ink3, minWidth: 20, textAlign: 'right' }}>{read}/{total}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Key propositions + tensions */}
        {analysis.keyPropositions.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Rettssetninger</span>
              {analysis.tensions > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, color: T.tension }}>
                  {analysis.tensions} spenning{analysis.tensions !== 1 ? 'er' : ''}
                </span>
              )}
            </div>
            {analysis.keyPropositions.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 6,
                padding: '4px 0', fontSize: 12, color: T.ink2, lineHeight: '1.45',
              }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: T.ink3, marginTop: 6, flexShrink: 0 }} />
                {p}
              </div>
            ))}
          </div>
        )}

        {/* Gap pairs */}
        {analysis.gapPairs.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
              Hull ({analysis.gapPairs.length})
            </div>
            {analysis.gapPairs.map((g, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 6px', borderRadius: 3,
                background: 'rgba(155,77,202,0.04)',
                marginBottom: 2, fontSize: 11,
              }}>
                <span style={{ fontFamily: "'Söhne Mono', monospace", color: T.ink2 }}>{g.a}</span>
                <span style={{ color: T.ink4, fontSize: 10 }}>∩</span>
                <span style={{ fontFamily: "'Söhne Mono', monospace", color: T.ink2 }}>{g.b}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: T.gap, fontWeight: 600 }}>∅</span>
              </div>
            ))}
          </div>
        )}

        {/* Overlaps */}
        {myOverlaps.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Overlapp</div>
            {myOverlaps.map((o, i) => {
              const otherId = o.a === analysis.id ? o.b : o.a;
              const other = ANALYSES.find(a => a.id === otherId);
              if (!other) return null;
              return (
                <div key={i} style={{
                  padding: '6px 8px', borderRadius: 4,
                  background: T.overlapBg, border: `1px solid ${T.overlapBorder}`,
                  marginBottom: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="3.5" cy="5" r="3" fill="none" stroke={T.overlap} strokeWidth="0.8" opacity="0.5" /><circle cx="6.5" cy="5" r="3" fill="none" stroke={T.overlap} strokeWidth="0.8" opacity="0.5" /></svg>
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.ink2 }}>{other.title.split('—')[0].trim()}</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.ink3, paddingLeft: 14 }}>
                    {o.shared.map(s => <span key={s} style={{ fontFamily: "'Söhne Mono', monospace", marginRight: 4 }}>{s}</span>)}
                    · {o.cases} felles saker
                  </div>
                  <div style={{ fontSize: 10, color: T.overlap, fontStyle: 'italic', paddingLeft: 14, marginTop: 1 }}>{o.note}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent activity */}
        {analysis.recentSessions.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Siste aktivitet</div>
            {analysis.recentSessions.slice(0, 2).map((sess, si) => (
              <div key={si} style={{ marginBottom: si < analysis.recentSessions.length - 1 ? 8 : 0 }}>
                <div style={{ fontSize: 10, color: T.ink4, fontWeight: 500, marginBottom: 3 }}>{sess.date}</div>
                {sess.actions.map((action, ai) => (
                  <div key={ai} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                    paddingLeft: 4, fontSize: 11, color: T.ink3, lineHeight: '1.45',
                  }}>
                    <div style={{ width: 3, height: 3, borderRadius: '50%', background: T.ink4, marginTop: 5, flexShrink: 0 }} />
                    {action}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* AI next step */}
        {analysis.nextStep && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{
              padding: '8px 10px', borderRadius: 5,
              background: T.highlight, borderLeft: `3px solid ${T.aiBorder}`,
              display: 'flex', alignItems: 'flex-start', gap: 6,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                background: T.surface, border: `1px solid ${T.aiBorder}`, color: T.ai,
                flexShrink: 0, marginTop: 1,
              }}>AI</span>
              <span style={{ fontSize: 12, lineHeight: '1.5', color: T.ink2 }}>{analysis.nextStep}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ MAIN ═══════════════ */

export default function PortfolioView() {
  const [view, setView] = useState('mine');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedId, setSelectedId] = useState('a1');

  const visibleAnalyses = useMemo(() => {
    let items = view === 'mine'
      ? ANALYSES.filter(a => a.owner === 'meg')
      : ANALYSES;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.provisions.some(p => p.toLowerCase().includes(q)) ||
        a.problem.toLowerCase().includes(q) ||
        a.ownerName.toLowerCase().includes(q)
      );
    }

    if (statusFilter) {
      items = items.filter(a => a.status === statusFilter);
    }

    return items;
  }, [view, search, statusFilter]);

  const selected = ANALYSES.find(a => a.id === selectedId);
  const hasOverlap = (id) => OVERLAPS.some(o => o.a === id || o.b === id);

  const statusCounts = useMemo(() => {
    const base = view === 'mine' ? ANALYSES.filter(a => a.owner === 'meg') : ANALYSES;
    const counts = {};
    base.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return counts;
  }, [view]);

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      color: T.ink, background: T.bg,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px', borderBottom: `1px solid ${T.border}`,
        background: T.panel, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em' }}>Paragraf</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.ink3 }}>Helene Johansen</span>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: T.kofaBg, border: `1px solid ${T.borderM}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: T.kofa,
        }}>HJ</div>
      </div>

      {/* Toolbar */}
      <div style={{
        padding: '8px 20px', borderBottom: `1px solid ${T.border}`,
        background: T.panel, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 5, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          {[['mine', 'Mine'], ['team', 'Team']].map(([key, label]) => (
            <button key={key} onClick={() => { setView(key); setSelectedId(null); }} style={{
              padding: '4px 14px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
              background: view === key ? T.ink : 'transparent',
              color: view === key ? T.panel : T.ink3,
              border: 'none',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: T.border }} />

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 5,
          background: T.input, border: `1px solid ${T.border}`,
          flex: '0 1 220px',
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" style={{ flexShrink: 0, opacity: 0.35 }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3" fill="none" />
            <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Søk tittel, bestemmelse, begrep…"
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontSize: 12, color: T.ink, width: '100%', padding: 0,
              fontFamily: 'inherit',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: T.ink4, fontSize: 13, padding: 0, lineHeight: 1,
            }}>×</button>
          )}
        </div>

        <div style={{ width: 1, height: 16, background: T.border }} />

        {/* Status filter chips */}
        {Object.entries(STATUS).filter(([key]) => statusCounts[key]).map(([key, val]) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? null : key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500,
              cursor: 'pointer', border: `1px solid ${statusFilter === key ? val.color : T.borderM}`,
              background: statusFilter === key ? `${val.color}11` : 'transparent',
              color: statusFilter === key ? val.color : T.ink3,
              transition: 'all 0.1s ease',
            }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: val.color, opacity: 0.6 }} />
            {val.label}
            <span style={{ fontFamily: "'Söhne Mono', monospace", opacity: 0.7 }}>{statusCounts[key]}</span>
          </button>
        ))}

        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.ink4 }}>{visibleAnalyses.length} analyser</span>
      </div>

      {/* Body: list + detail */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Column headers */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 16px', paddingLeft: 19,
            borderBottom: `1px solid ${T.borderM}`,
            fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.04em',
            position: 'sticky', top: 0, background: T.bg, zIndex: 1,
          }}>
            <div style={{ width: 7 }} />
            <span style={{ flex: 1 }}>Analyse</span>
            <span style={{ minWidth: 65, textAlign: 'right' }}>Fase</span>
            <span style={{ width: 56 }}>Lest</span>
            <span style={{ width: 20, textAlign: 'center' }} title="Spenninger">⚡</span>
            <span style={{ width: 14 }} title="Overlapp" />
            <span style={{ minWidth: 70, textAlign: 'right' }}>Sist aktiv</span>
          </div>

          {visibleAnalyses.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: T.ink3, fontSize: 13 }}>
              {search ? `Ingen analyser matcher «${search}»` : 'Ingen analyser i denne visningen'}
            </div>
          )}

          {/* Team grouping headers */}
          {view === 'team' ? (
            <>
              {/* My analyses */}
              {visibleAnalyses.filter(a => a.owner === 'meg').length > 0 && (
                <>
                  <div style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.05em', textTransform: 'uppercase', background: 'rgba(26,24,20,0.015)' }}>
                    Mine
                  </div>
                  {visibleAnalyses.filter(a => a.owner === 'meg').map(a => (
                    <AnalysisRow key={a.id} analysis={a} isSelected={selectedId === a.id} isTeam={false}
                      hasOverlap={hasOverlap(a.id)} onClick={() => setSelectedId(a.id)} />
                  ))}
                </>
              )}
              {/* Others */}
              {visibleAnalyses.filter(a => a.owner !== 'meg').length > 0 && (
                <>
                  <div style={{ padding: '8px 16px', fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.05em', textTransform: 'uppercase', background: 'rgba(26,24,20,0.015)' }}>
                    Kollegaer
                  </div>
                  {visibleAnalyses.filter(a => a.owner !== 'meg').map(a => (
                    <AnalysisRow key={a.id} analysis={a} isSelected={selectedId === a.id} isTeam={true}
                      hasOverlap={hasOverlap(a.id)} onClick={() => setSelectedId(a.id)} />
                  ))}
                </>
              )}
            </>
          ) : (
            visibleAnalyses.map(a => (
              <AnalysisRow key={a.id} analysis={a} isSelected={selectedId === a.id} isTeam={false}
                hasOverlap={hasOverlap(a.id)} onClick={() => setSelectedId(a.id)} />
            ))
          )}

          {/* New analysis */}
          <div style={{
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', color: T.ink3, fontSize: 12, fontWeight: 500,
            transition: 'color 0.12s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.ink}
          onMouseLeave={e => e.currentTarget.style.color = T.ink3}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Ny analyse
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            analysis={selected}
            overlaps={OVERLAPS}
            onClose={() => setSelectedId(null)}
            onOpen={a => console.log('Open:', a.title)}
          />
        )}
      </div>
    </div>
  );
}

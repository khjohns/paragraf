import { useState, useEffect, useCallback } from "react";

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
  prov: '#4A6670',
  provBg: '#E8EEF0',
  kofa: '#8B6914',
  kofaBg: '#F0EBD8',
  ai: '#8B6914',
  aiBorder: 'rgba(139,105,20,0.2)',
  highlight: '#FBF5E8',
  confirm: '#3D7A4A',
  confirmBg: '#EBF5ED',
  warn: '#A67B2E',
  warnBg: '#FBF5E8',
  delim: '#C4650A',
  delimBg: '#FDF2E7',
};

/* ═══════════════ DATA ═══════════════ */

const CASES = [
  // A-cases
  { id:'2024/2019', cat:'A', title:'Rammeavtale arkitekttjenester — utvelgelse', date:'2024-09-12', outcome:'Ikke brudd', citations:1,
    subtitle:'Direkte parallell: arkitekttjenester + § 16-12 utvelgelseskriterier. Nemnda godkjente rangering etter erfaring.',
    signals:{ref:true,fts:true,vec:true} },
  { id:'2023/1847', cat:'A', title:'Utvelgelseskriterier konsulentoppdrag', date:'2023-11-08', outcome:'Ikke brudd', citations:3,
    subtitle:'Konsulentanskaffelse. Nemnda drøfter forholdet mellom kvalifikasjonskrav og utvelgelseskriterier.',
    signals:{ref:true,fts:true,vec:true} },
  { id:'2022/0934', cat:'A', title:'Begrensning av antall — forhandlet prosedyre', date:'2022-06-15', outcome:'Brudd', citations:5,
    subtitle:'Utvelgelseskriterier ikke tilstrekkelig objektive. Nemnda opphevet tildelingsbeslutningen.',
    signals:{ref:true,fts:true,vec:true} },
  { id:'2021/1156', cat:'A', title:'Rangering etter kompetanse og erfaring', date:'2021-03-22', outcome:'Ikke brudd', citations:4,
    subtitle:'Nemnda godkjente rangering etter «best egnet» basert på referanseprosjekter.',
    signals:{ref:true,fts:true,vec:true} },
  { id:'2020/0672', cat:'A', title:'§ 16-12 + likebehandling', date:'2020-08-14', outcome:'Brudd', citations:2,
    subtitle:'Utvelgelseskriteriene favoriserte etablerte leverandører. Brudd på likebehandlingsprinsippet.',
    signals:{ref:true,fts:true,vec:true} },
  // B-cases
  { id:'2023/0445', cat:'B', title:'Teknisk kompetanse som utvelgelseskriterium', date:'2023-04-20', outcome:'Ikke brudd', citations:1,
    subtitle:'Rådgivende ingeniørtjenester. Rangering etter faglige kvalifikasjoner godkjent.',
    signals:{ref:true,fts:true,vec:false} },
  { id:'2022/1678', cat:'B', title:'Referanseprosjekter — omfang og relevans', date:'2022-12-01', outcome:'Ikke brudd', citations:3,
    subtitle:'Nemnda vurderte krav til referanseprosjekters størrelse og relevans for utvelgelse.',
    signals:{ref:true,fts:false,vec:true} },
  { id:'2021/0891', cat:'B', title:'Utvelgelse ved rammeavtale', date:'2021-07-09', outcome:'Ikke brudd', citations:2,
    subtitle:'Rammeavtale for konsulenttjenester. Begrenset antall kandidater.',
    signals:{ref:true,fts:true,vec:false} },
  { id:'2020/1234', cat:'B', title:'Dokumentasjonskrav § 16-6 ved utvelgelse', date:'2020-05-30', outcome:'Brudd', citations:1,
    subtitle:'Oppdragsgiver krevde dokumentasjon utover § 16-6 uttømmende liste.',
    signals:{ref:false,fts:true,vec:true} },
  { id:'2019/0778', cat:'B', title:'Forholdsmessighetskrav ved utvelgelse', date:'2019-10-18', outcome:'Ikke brudd', citations:4,
    subtitle:'Nemnda vurderte om utvelgelseskriteriene var forholdsmessige til anskaffelsens verdi.',
    signals:{ref:true,fts:false,vec:true} },
  { id:'2023/1102', cat:'B', title:'Nøkkelpersonell som rangeringskriterium', date:'2023-08-25', outcome:'Ikke brudd', citations:0,
    subtitle:'Arkitekttjenester. CV-vurdering for nøkkelpersonell som utvelgelseskriterium.',
    signals:{ref:false,fts:true,vec:true} },
  // C-cases
  { id:'2018/0445', cat:'C', title:'Utvelgelse — gammel forskrift', date:'2018-02-14', outcome:'Brudd', citations:6,
    subtitle:'Avgjørelse under gammel FOA. Praksis kan ikke uten videre overføres.', regulation:'old',
    signals:{ref:false,fts:true,vec:false} },
  { id:'2022/0567', cat:'C', title:'§ 16-12 nevnt perifert', date:'2022-09-03', outcome:'Ikke brudd', citations:0,
    subtitle:'Saken gjelder primært tildelingsevaluering. § 16-12 nevnes i bakgrunnen.',
    signals:{ref:true,fts:false,vec:false} },
  { id:'2021/0334', cat:'C', title:'Avvisning — ikke utvelgelse', date:'2021-05-12', outcome:'Avvist', citations:0,
    subtitle:'Klage avvist. Nemnda tar ikke stilling til utvelgelseskriteriene.',
    isDelimitation: true,
    signals:{ref:false,fts:true,vec:false} },
  { id:'2019/1567', cat:'C', title:'Utvelgelse kommunal anskaffelse', date:'2019-12-20', outcome:'Ikke brudd', citations:1,
    subtitle:'Byggetjenester. Utvelgelseskriterier drøftet kort.',
    signals:{ref:false,fts:false,vec:true} },
];

// Simulated Claude screening results — faithful to actual output depth
const SCREENING_RESULTS = {
  '2024/2019': {
    star: true,
    factum: 'Oslobygg KF kunngjorde begrenset anbudskonkurranse for rammeavtale arkitekttjenester (est. 450 MNOK). 34 søkere, 12 skulle velges ut. Utvelgelseskriteriet var meroppfyllelse av kvalifikasjonskravet «erfaring og kompetanse fra sammenlignbare oppdrag, art, størrelse og kompleksitet». Klager anførte at vurderingsmomentene (teknisk kompleksitet, flerformål, verneforhold, lokasjon, arkitektonisk kvalitet) ikke var angitt på forhånd.',
    assessment: 'Utvelgelseskriteriet var lovlig. § 14-1(3) bokstav d nr. 3 krever at utvelgelseskriterier angis, men stiller ikke krav om at ethvert vurderingsmoment skal angis. Kriteriet oppstilte «tydelige ytre rammer» og ga ikke oppdragsgiver ubegrenset skjønn.',
    proposition: 'Ved begrenset anbudskonkurranse trenger ikke utvelgelseskriteriet å spesifisere ethvert vurderingsmoment. Det avgjørende er at kriteriet angir tydelige ytre rammer som er objektive, ikke-diskriminerende og etterprøvbare.',
    quotes: [
      { p: 24, text: '«Bestemmelsen stiller ikke krav om at ethvert vurderingsmoment skal angis. Det avgjørende for lovligheten, er at utvelgelseskriteriet er innenfor rammene av § 16-12, og ellers i tråd med de grunnleggende prinsippene i loven § 4.»' },
      { p: 27, text: '«[V]ed gjennomføringen av et slikt nedvalg er det først og fremst viktig at utvelgelseskriteriene er egnet til å skille leverandørene fra hverandre på en objektiv, ikke-diskriminerende, og etterprøvbar måte.»' },
      { p: 30, text: '«Både utvelgelseskriteriet og dokumentasjonskravet oppstiller tydelige ytre rammer for hva som kan være relevant å hensynta [...] Innenfor rammene som oppstilles [...] er skjønnsrommet til innklagede likevel betydelig.»' },
    ],
    nuances: 'Momentene må «naturlig falle inn under» kriteriets rammer — hadde de ligget utenfor, ville det vært ulovlig. Prøvingsintensiteten for evalueringsmatrisen var lav.',
    relevance: 'A',
    relevanceReasoning: 'Direkte parallell: arkitekttjenester + § 16-12 utvelgelseskriterier. Gullkandidat.',
  },
  '2023/1847': {
    factum: 'Begrenset anbudskonkurranse for rammeavtaler prosjekt-/byggeledelse. Tre vektede utvelgelseskriterier: Erfaring fra relevante oppdrag (50 %), Gjennomføringsevne/kapasitet (30 %), Kompetanseutvikling (20 %). Klager hadde 25 års privat erfaring men ingen offentlige referanser.',
    assessment: 'Krav om erfaring fra offentlige bygg var relevant fordi tjenesten retter seg mot offentlig byggherre. Ikke diskriminerende. 16 kvalifiserte leverandører bekreftet at konkurransen ikke var unødig begrenset.',
    proposition: 'Utvelgelseskriterium som krever erfaring fra offentlige bygg er lovlig når tjenesten gjelder prosjekt-/byggeledelse for offentlig byggherre. Temaet for rettslig kontroll er lovlighet, ikke optimalitet.',
    quotes: [
      { p: 29, text: '«Tjenesten som skal anskaffes, er prosjekt- og byggeledelse opp mot innklagede som byggherre og offentlig oppdragsgiver. Klagenemnda anser det da som relevant at det stilles kriterier og krav om erfaring fra slike oppdrag.»' },
      { p: 31, text: '«[E]t utvelgelseskriterium skiller seg fra et kvalifikasjonskrav. Selv om en leverandør er kvalifisert til å delta i konkurransen, må leverandøren være forberedt på at det kan skje et nedvalg.»' },
    ],
    nuances: 'Nemnda anerkjenner at privat og offentlig erfaring i stor grad er likartet for byggtypen. For rene arkitekttjenester der prosjektledelsesaspektet er mindre, ville begrunnelsen muligens vært svakere.',
    relevance: 'A',
    relevanceReasoning: 'Nær parallell: konsulenttjenester + utvelgelse. Vektede kriterier relevant som modell.',
  },
};

/* ═══════════════ COMPONENTS ═══════════════ */

function SignalDots({ signals, size=5 }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:2}} title="R: Referansetabell  F: Fulltekst  V: Vektor">
      {['ref','fts','vec'].map(k => (
        <div key={k} style={{width:size,height:size,borderRadius:'50%',background:signals[k]?T.ink:'transparent',border:`1.5px solid ${signals[k]?T.ink:T.ink4+'88'}`}} />
      ))}
    </div>
  );
}

function CategoryControl({ cat, count, mode, onModeChange, screenedCount, readCount }) {
  const done = screenedCount + readCount;
  const pct = count > 0 ? Math.round(done / count * 100) : 0;

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 6,
      background: T.surface, border: `1px solid ${T.border}`,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 13, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: cat==='A' ? 'rgba(26,24,20,0.08)' : cat==='B' ? 'rgba(26,24,20,0.05)' : 'rgba(26,24,20,0.03)',
          color: cat==='A' ? T.ink : cat==='B' ? T.ink2 : T.ink3,
        }}>{cat}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>
          {count} {count===1 ? 'sak' : 'saker'}
        </span>
        <span style={{ flex: 1 }} />

        {/* Progress */}
        {done > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 48, height: 3, borderRadius: 2, background: T.input, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: pct===100?T.confirm:T.ink3, transition: 'width 0.3s ease' }} />
            </div>
            <span style={{ fontSize: 10, fontFamily: "'Söhne Mono', monospace", color: T.ink3 }}>{done}/{count}</span>
          </div>
        )}
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { key: 'claude', label: 'Claude screener', icon: '◈' },
          { key: 'me', label: 'Jeg leser', icon: '◉' },
          { key: 'pick', label: 'Velg per sak', icon: '◎' },
        ].map(({ key, label, icon }) => (
          <button key={key} onClick={() => onModeChange(key)} style={{
            flex: 1, padding: '6px 8px', borderRadius: 4,
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            background: mode===key ? T.ink : 'transparent',
            color: mode===key ? T.panel : T.ink3,
            border: `1px solid ${mode===key ? T.ink : T.borderM}`,
            transition: 'all 0.12s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CaseRow({ c, assignment, onAssign, screeningResult, isStreaming }) {
  const [expanded, setExpanded] = useState(false);
  const outcomeColor = c.outcome==='Brudd' ? {c:T.warn,bg:T.warnBg} : c.outcome==='Avvist' ? {c:T.ink3,bg:T.input} : {c:T.confirm,bg:T.confirmBg};

  return (
    <div style={{
      borderBottom: `1px solid ${T.border}`,
      background: isStreaming ? T.highlight : 'transparent',
      transition: 'background 0.3s ease',
    }}>
      {/* Main row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px',
      }}>
        {/* Assignment toggle */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => onAssign(c.id, 'claude')}
            title="Claude screener"
            style={{
              width: 24, height: 22, borderRadius: '3px 0 0 3px',
              border: `1px solid ${assignment==='claude' ? T.ai : T.borderM}`,
              borderRight: 'none',
              background: assignment==='claude' ? T.highlight : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.1s ease',
            }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: assignment==='claude' ? T.ai : T.ink4,
            }}>AI</span>
          </button>
          <button
            onClick={() => onAssign(c.id, 'me')}
            title="Jeg leser"
            style={{
              width: 24, height: 22, borderRadius: '0 3px 3px 0',
              border: `1px solid ${assignment==='me' ? T.confirm : T.borderM}`,
              background: assignment==='me' ? T.confirmBg : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.1s ease',
            }}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <circle cx="5" cy="3.5" r="2" stroke={assignment==='me' ? T.confirm : T.ink4} strokeWidth="1.2" fill="none" />
              <path d="M1 9.5C1 7 3 5.5 5 5.5S9 7 9 9.5" stroke={assignment==='me' ? T.confirm : T.ink4} strokeWidth="1.2" fill="none" />
            </svg>
          </button>
        </div>

        {/* Status indicator */}
        <div style={{ width: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {screeningResult && (
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M3 6L5 8L9 4" stroke={T.confirm} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
          {isStreaming && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${T.borderM}`, borderTopColor: T.ai, animation: 'spin 0.8s linear infinite' }} />
          )}
        </div>

        {/* Case info */}
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => setExpanded(!expanded)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <span style={{
              fontFamily: "'Söhne Mono', 'IBM Plex Mono', monospace",
              fontSize: 12, fontWeight: 600, color: T.kofa,
            }}>{c.id}</span>
            <SignalDots signals={c.signals} />
            <span style={{
              fontSize: 12, color: T.ink2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{c.title}</span>
          </div>
        </div>

        {/* Metadata */}
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
          background: outcomeColor.bg, color: outcomeColor.c,
          flexShrink: 0,
        }}>{c.outcome}</span>
        <span style={{ fontSize: 10, color: T.ink4, minWidth: 50, textAlign: 'right', flexShrink: 0 }}>{c.date?.slice(0,4)}</span>
        <span style={{ fontSize: 10, color: T.ink4, minWidth: 30, textAlign: 'right', flexShrink: 0, fontFamily: "'Söhne Mono', monospace" }}>
          {c.citations > 0 ? `${c.citations} sit.` : ''}
        </span>
      </div>

      {/* Expanded: subtitle + screening result */}
      {(expanded || screeningResult) && (
        <div style={{ padding: '0 14px 10px 60px' }}>
          {/* Case description */}
          <div style={{ fontSize: 12, lineHeight: '1.5', color: T.ink3, marginBottom: screeningResult ? 8 : 0 }}>
            {c.subtitle}
          </div>

          {/* Claude screening result */}
          {screeningResult && (
            <div style={{
              marginTop: 6, padding: '12px 14px', borderRadius: 5,
              borderLeft: `3px solid ${T.aiBorder}`,
              background: 'rgba(139,105,20,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                  background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai,
                }}>AI</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: T.ai }}>Screening</span>
                {screeningResult.star && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: T.warn }}>★ Gullkandidat</span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: T.ink4 }}>
                  Relevans: <strong style={{ color: T.ink }}>{screeningResult.relevance}</strong> — {screeningResult.relevanceReasoning}
                </span>
              </div>

              {/* Rettssetning — the most important output, visually prominent */}
              <div style={{
                padding: '8px 12px', borderRadius: 4, marginBottom: 10,
                background: T.highlight, borderLeft: `2px solid ${T.kofaBg}`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.ai, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 3 }}>Rettssetning</div>
                <div style={{ fontSize: 13, lineHeight: '1.6', color: T.ink, fontWeight: 500 }}>
                  {screeningResult.proposition}
                </div>
              </div>

              {/* Factum + Vurdering — compact */}
              <div style={{ fontSize: 12, lineHeight: '1.55', color: T.ink2, marginBottom: 4 }}>
                <strong style={{ color: T.ink, fontWeight: 600 }}>Faktum:</strong> {screeningResult.factum}
              </div>
              <div style={{ fontSize: 12, lineHeight: '1.55', color: T.ink2, marginBottom: 8 }}>
                <strong style={{ color: T.ink, fontWeight: 600 }}>Vurdering:</strong> {screeningResult.assessment}
              </div>

              {/* Nøkkelsitater — expandable */}
              {screeningResult.quotes && screeningResult.quotes.length > 0 && (
                <details style={{ marginBottom: 6 }}>
                  <summary style={{
                    fontSize: 11, fontWeight: 600, color: T.ink3, cursor: 'pointer',
                    padding: '4px 0', userSelect: 'none',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    Nøkkelsitater ({screeningResult.quotes.length})
                  </summary>
                  <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {screeningResult.quotes.map((q, qi) => (
                      <div key={qi} style={{
                        padding: '6px 10px', borderRadius: 4,
                        background: T.surface, border: `1px solid ${T.border}`,
                        fontSize: 12, lineHeight: '1.55', color: T.ink,
                      }}>
                        <span style={{
                          fontFamily: "'Söhne Mono', monospace", fontSize: 10,
                          fontWeight: 600, color: T.kofa, marginRight: 6,
                          cursor: 'pointer', borderBottom: '1px solid transparent',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderBottomColor = T.kofa}
                        onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
                        >§{q.p}</span>
                        {q.text}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Nyanser — expandable */}
              {screeningResult.nuances && (
                <details style={{ marginBottom: 6 }}>
                  <summary style={{
                    fontSize: 11, fontWeight: 600, color: T.ink3, cursor: 'pointer',
                    padding: '4px 0', userSelect: 'none',
                  }}>
                    Nyanser og forbehold
                  </summary>
                  <div style={{
                    paddingTop: 4, fontSize: 12, lineHeight: '1.55', color: T.ink2,
                    fontStyle: 'italic',
                  }}>
                    {screeningResult.nuances}
                  </div>
                </details>
              )}

              {/* Actions */}
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <button style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                  background: 'transparent', border: `1px solid ${T.borderM}`,
                  color: T.ink2, cursor: 'pointer',
                }}>Les hele avgjørelsen</button>
                <button style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                  background: 'transparent', border: `1px solid ${T.borderM}`,
                  color: T.ink2, cursor: 'pointer',
                }}>Re-screen med mer kontekst</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ MAIN ═══════════════ */

export default function ScreeningDelegation() {
  const [modes, setModes] = useState({ A: 'claude', B: 'claude', C: 'pick' });
  const [assignments, setAssignments] = useState(() => {
    const a = {};
    CASES.forEach(c => {
      if (c.cat === 'C') a[c.id] = 'claude'; // default for 'pick' mode
      else a[c.id] = null; // controlled by category mode
    });
    return a;
  });
  const [screeningResults, setScreeningResults] = useState({});
  const [streamingId, setStreamingId] = useState(null);
  const [started, setStarted] = useState(false);

  const getAssignment = (c) => {
    if (modes[c.cat] === 'pick') return assignments[c.id] || 'claude';
    return modes[c.cat];
  };

  const setAssignment = (id, value) => {
    const c = CASES.find(x => x.id === id);
    if (c && modes[c.cat] !== 'pick') {
      setModes(p => ({ ...p, [c.cat]: 'pick' }));
    }
    setAssignments(p => ({ ...p, [id]: value }));
  };

  // Simulate streaming screening results
  useEffect(() => {
    if (!started) return;
    const claudeCases = CASES.filter(c => getAssignment(c) === 'claude' && SCREENING_RESULTS[c.id] && !screeningResults[c.id]);
    if (claudeCases.length === 0) return;

    let i = 0;
    const next = () => {
      if (i >= claudeCases.length) { setStreamingId(null); return; }
      const c = claudeCases[i];
      setStreamingId(c.id);
      setTimeout(() => {
        setScreeningResults(p => ({ ...p, [c.id]: SCREENING_RESULTS[c.id] }));
        setStreamingId(null);
        i++;
        setTimeout(next, 800);
      }, 2000);
    };
    const timer = setTimeout(next, 500);
    return () => clearTimeout(timer);
  }, [started]);

  const cats = ['A', 'B', 'C'];
  const claudeCount = CASES.filter(c => getAssignment(c) === 'claude').length;
  const meCount = CASES.filter(c => getAssignment(c) === 'me').length;
  const screenedCount = Object.keys(screeningResults).length;

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      color: T.ink,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        padding: '10px 20px', borderBottom: `1px solid ${T.border}`,
        background: T.panel, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em' }}>Paragraf</span>
        <span style={{ color: T.borderS }}>·</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>FOA § 16-12 — Utvelgelseskriterier</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.ink3 }}>Screening</span>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 44px)' }}>

        {/* Left: delegation controls */}
        <div style={{
          width: 280, minWidth: 280, borderRight: `1px solid ${T.border}`,
          background: T.panel, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 14px 10px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.ink3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
              Arbeidsfordeling
            </div>
            <div style={{ fontSize: 12, color: T.ink3, lineHeight: '1.45', marginBottom: 12 }}>
              Velg hvem som screener per kategori, eller juster per sak i listen.
            </div>

            {cats.map(cat => {
              const catCases = CASES.filter(c => c.cat === cat);
              const screened = catCases.filter(c => screeningResults[c.id]).length;
              const read = catCases.filter(c => getAssignment(c) === 'me').length; // mock
              return (
                <CategoryControl
                  key={cat} cat={cat} count={catCases.length}
                  mode={modes[cat]}
                  onModeChange={m => setModes(p => ({ ...p, [cat]: m }))}
                  screenedCount={screened} readCount={0}
                />
              );
            })}
          </div>

          {/* Summary */}
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.border}`, marginTop: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: T.ink3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Claude screener</span>
                <span style={{ fontFamily: "'Söhne Mono', monospace", color: T.ai, fontWeight: 600 }}>{claudeCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Du leser</span>
                <span style={{ fontFamily: "'Söhne Mono', monospace", color: T.confirm, fontWeight: 600 }}>{meCount}</span>
              </div>
              {started && screenedCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
                  <span>Screenet</span>
                  <span style={{ fontFamily: "'Söhne Mono', monospace", fontWeight: 600 }}>{screenedCount}/{claudeCount}</span>
                </div>
              )}
            </div>

            {!started && (
              <button onClick={() => setStarted(true)} style={{
                marginTop: 10, width: '100%', padding: '9px 12px', borderRadius: 5,
                background: T.ink, color: T.panel, border: 'none',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'opacity 0.12s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >Start screening</button>
            )}

            {started && streamingId && (
              <div style={{
                marginTop: 8, padding: '6px 8px', borderRadius: 4,
                background: T.highlight, border: `1px solid ${T.aiBorder}`,
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: T.ai,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${T.aiBorder}`, borderTopColor: T.ai, animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                Leser {streamingId}…
              </div>
            )}
          </div>
        </div>

        {/* Right: case list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Column headers */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', paddingLeft: 14,
            borderBottom: `1px solid ${T.borderM}`,
            fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.04em',
            position: 'sticky', top: 0, background: T.bg, zIndex: 1,
          }}>
            <div style={{ width: 52 }}>Tildelt</div>
            <div style={{ width: 14 }} />
            <span style={{ flex: 1 }}>Sak</span>
            <span style={{ minWidth: 60, textAlign: 'right' }}>Utfall</span>
            <span style={{ minWidth: 50, textAlign: 'right' }}>År</span>
            <span style={{ minWidth: 30, textAlign: 'right' }}>Sit.</span>
          </div>

          {cats.map(cat => {
            const catCases = CASES.filter(c => c.cat === cat);
            return (
              <div key={cat}>
                {/* Category header */}
                <div style={{
                  padding: '8px 14px',
                  background: 'rgba(26,24,20,0.015)',
                  fontSize: 10, fontWeight: 600, color: T.ink4,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                    background: cat==='A' ? 'rgba(26,24,20,0.08)' : cat==='B' ? 'rgba(26,24,20,0.05)' : 'rgba(26,24,20,0.03)',
                    color: cat==='A' ? T.ink : cat==='B' ? T.ink2 : T.ink3,
                  }}>{cat}</span>
                  <span>{cat==='A' ? 'Trippel treff — ref + FTS + vektor' : cat==='B' ? 'Dobbelt treff — to av tre signaler' : 'Enkelt treff — ett signal'}</span>
                  <span style={{ flex: 1 }} />
                  <span>{catCases.length} saker</span>
                </div>

                {catCases.map(c => (
                  <CaseRow
                    key={c.id}
                    c={c}
                    assignment={getAssignment(c)}
                    onAssign={setAssignment}
                    screeningResult={screeningResults[c.id]}
                    isStreaming={streamingId === c.id}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

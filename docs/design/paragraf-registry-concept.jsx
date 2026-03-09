import { useState } from "react";

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
  eu: '#2D6A5D',
  euBg: '#E4F0EC',
  prov: '#4A6670',
  highlight: '#FBF5E8',
  aiBorder: 'rgba(139,105,20,0.2)',
  ai: '#8B6914',
  tension: '#A63D3D',
  tensionBg: 'rgba(166,61,61,0.04)',
  tensionBorder: 'rgba(166,61,61,0.18)',
  confirm: '#3D7A4A',
  confirmBg: '#EBF5ED',
  nuance: '#A67B2E',
  nuanceBg: '#FBF5E8',
};

const EVOLUTION = {
  established: { label: 'Etablert', color: T.ink, bg: 'rgba(26,24,20,0.06)' },
  confirmed: { label: 'Bekreftet', color: T.confirm, bg: T.confirmBg },
  qualified: { label: 'Presisert', color: T.nuance, bg: T.nuanceBg },
  consolidating: { label: 'Konsoliderende', color: T.prov, bg: '#E8EEF0' },
};

const PROPOSITIONS = [
  {
    id: 'rs1',
    theme: 'Dokumentasjonskrav for rådighet',
    proposition: 'Forpliktelseserklæring må foreligge ved tilbudsfristen',
    instances: [
      { caseId: '2018/123', paragraph: 51, date: '2018-05-20', evolution: 'established',
        quote: 'Kravet til dokumentasjon av rådighet må praktiseres likt for alle tilbydere.' },
      { caseId: '2023/456', paragraph: 42, date: '2023-06-15', evolution: 'confirmed',
        quote: 'Et ESPD-skjema dokumenterer at virksomheten oppfyller kvalifikasjonskravene, men det dokumenterer ikke at leverandøren faktisk råder over virksomhetens ressurser.' },
    ],
  },
  {
    id: 'rs2',
    theme: 'Dokumentasjonskrav for rådighet',
    proposition: 'Ettersending av forpliktelseserklæring kan aksepteres',
    tension: { withId: 'rs1', note: '«ved tilbudsfristen» vs. «kan ettersendes» — spenning om tidspunkt' },
    instances: [
      { caseId: '2022/789', paragraph: 38, date: '2022-11-22', evolution: 'established',
        quote: 'Forpliktelseserklæring kan ettersendes dersom tilbudet for øvrig inneholder tilstrekkelig informasjon til at oppdragsgiver kan vurdere om kvalifikasjonskravet er oppfylt.' },
      { caseId: '2022/789', paragraph: 39, date: '2022-11-22', evolution: 'qualified',
        quote: 'Dette innebærer ikke at forpliktelseserklæring generelt kan utelates ved tilbudsfristen. Vurderingen beror på en konkret helhetsvurdering.' },
    ],
  },
  {
    id: 'rs3',
    theme: 'ESPD som dokumentasjon',
    proposition: 'ESPD og forpliktelseserklæring har ulike funksjoner',
    instances: [
      { caseId: '2023/456', paragraph: 43, date: '2023-06-15', evolution: 'established',
        quote: 'ESPD-skjemaet er en egenerklæring om at den støttende virksomheten selv oppfyller visse krav. Forpliktelseserklæringen er en erklæring om at virksomheten stiller sine ressurser til disposisjon. Disse dokumentene har ulike funksjoner og det ene kan ikke erstatte det andre.' },
    ],
  },
  {
    id: 'rs4',
    theme: 'Dokumentasjonskrav for rådighet',
    proposition: 'Helhetsvurdering av samlet dokumentasjon',
    instances: [
      { caseId: '2024/112', paragraph: 29, date: '2024-03-08', evolution: 'consolidating',
        quote: 'Spørsmålet om forpliktelseserklæring beror på en konkret vurdering av den samlede dokumentasjonen i tilbudet.',
        suggested: true },
    ],
  },
];

/* ═══════════════ COMPONENTS ═══════════════ */

function EvolutionBadge({ type }) {
  const ev = EVOLUTION[type];
  if (!ev) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.03em',
      padding: '2px 7px', borderRadius: 3,
      background: ev.bg, color: ev.color,
    }}>{ev.label}</span>
  );
}

function Instance({ inst, isLast }) {
  const ev = EVOLUTION[inst.evolution];
  return (
    <div style={{ position: 'relative', paddingLeft: 22, paddingBottom: isLast ? 0 : 16 }}>
      {/* Timeline dot */}
      <div style={{
        position: 'absolute', left: 0, top: 6,
        width: 8, height: 8, borderRadius: '50%',
        background: T.surface,
        border: `2px solid ${ev?.color || T.ink3}`,
      }} />
      {/* Timeline line */}
      {!isLast && (
        <div style={{
          position: 'absolute', left: 3.5, top: 16,
          width: 1, bottom: 0,
          background: T.borderM,
        }} />
      )}

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: "'Söhne Mono', 'IBM Plex Mono', monospace",
          fontSize: 11.5, fontWeight: 600, color: T.kofa,
          cursor: 'pointer', borderBottom: '1px solid transparent',
          transition: 'border-color 0.15s ease', paddingBottom: 1,
        }}
        onMouseEnter={e => e.currentTarget.style.borderBottomColor = T.kofa}
        onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
        >{inst.caseId} §{inst.paragraph}</span>
        <EvolutionBadge type={inst.evolution} />
        <span style={{ fontSize: 11, color: T.ink4 }}>{inst.date}</span>
        {inst.suggested && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
            background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai,
          }}>AI-forslag</span>
        )}
      </div>

      {/* Quote */}
      <div style={{
        fontSize: 13.5, lineHeight: '1.65', color: T.ink,
        padding: '8px 12px', borderRadius: 4,
        background: T.highlight,
        borderLeft: `3px solid ${T.kofaBg}`,
      }}>
        «{inst.quote}»
      </div>
    </div>
  );
}

function TensionConnector({ tension }) {
  if (!tension) return null;
  return (
    <div style={{
      margin: '2px 0 10px',
      padding: '8px 12px', borderRadius: 5,
      background: T.tensionBg,
      borderLeft: `3px solid ${T.tensionBorder}`,
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <path d="M3 8H13M13 8L10 5M13 8L10 11" stroke={T.tension} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 8H3M3 8L6 5M3 8L6 11" stroke={T.tension} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
      </svg>
      <span style={{ fontSize: 12, color: T.tension, lineHeight: '1.45' }}>{tension.note}</span>
    </div>
  );
}

function PropositionCard({ prop }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      background: T.surface,
      borderRadius: 6,
      border: `1px solid ${prop.tension ? T.tensionBorder : T.border}`,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '12px 14px',
          display: 'flex', alignItems: 'flex-start', gap: 8,
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" style={{
          marginTop: 5, flexShrink: 0, opacity: 0.35,
          transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
          transition: 'transform 0.15s ease',
        }}>
          <path d="M2 0.5L6 4L2 7.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>

        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: T.ink,
            lineHeight: '1.4', letterSpacing: '-0.01em',
          }}>
            {prop.proposition}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 11, color: T.ink4 }}>
              {prop.instances.length === 1 ? '1 forekomst' : `${prop.instances.length} forekomster`}
            </span>
            <span style={{ fontSize: 11, color: T.ink4 }}>·</span>
            <span style={{ fontSize: 11, color: T.ink4 }}>
              {prop.instances[0].date.slice(0, 4)}{prop.instances.length > 1 ? `–${prop.instances[prop.instances.length - 1].date.slice(0, 4)}` : ''}
            </span>
            {prop.instances.some(i => i.suggested) && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                background: T.highlight, border: `1px solid ${T.aiBorder}`, color: T.ai,
              }}>Inneholder AI-forslag</span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div style={{ padding: '2px 14px 14px 30px' }}>
          {prop.instances.map((inst, i) => (
            <Instance key={i} inst={inst} isLast={i === prop.instances.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeGroup({ theme, propositions }) {
  // Build render order: tension pairs together
  const ordered = [];
  const used = new Set();
  propositions.forEach(p => {
    if (p.tension) {
      const target = propositions.find(t => t.id === p.tension.withId);
      if (target && !used.has(target.id)) {
        ordered.push({ prop: target, tensionAfter: p.tension });
        used.add(target.id);
      }
      if (!used.has(p.id)) {
        ordered.push({ prop: p });
        used.add(p.id);
      }
    }
  });
  propositions.forEach(p => { if (!used.has(p.id)) ordered.push({ prop: p }); });

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 8, paddingLeft: 2,
      }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: T.prov, opacity: 0.5 }} />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
          textTransform: 'uppercase', color: T.ink3,
        }}>{theme}</span>
        {ordered.some(o => o.tensionAfter) && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
            background: T.tensionBg, color: T.tension,
          }}>spenning</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {ordered.map(({ prop, tensionAfter }, i) => (
          <div key={prop.id}>
            <PropositionCard prop={prop} />
            {tensionAfter && <TensionConnector tension={tensionAfter} />}
            {!tensionAfter && i < ordered.length - 1 && <div style={{ height: 6 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════ MAIN ═══════════════ */

export default function PropositionRegistry() {
  const themes = [...new Set(PROPOSITIONS.map(p => p.theme))];
  const tensionCount = PROPOSITIONS.filter(p => p.tension).length;

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      color: T.ink,
    }}>
      {/* Header bar — matches the workspace */}
      <div style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${T.border}`,
        background: T.panel,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Paragraf</span>
        <span style={{ color: T.borderS }}>·</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>FOA §16-10 — Rådighet</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: T.ink4 }}>4 av 8 lest</span>
        <span style={{ color: T.borderS }}>·</span>
        <span style={{ fontSize: 11, color: T.ink4 }}>Iterasjon 2</span>
      </div>

      {/* Toolbar — view switcher + registry info */}
      <div style={{
        padding: '7px 16px',
        borderBottom: `1px solid ${T.border}`,
        background: T.panel,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', borderRadius: 5, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          {['Liste', 'Graf', 'Tidslinje', 'Rettssetninger'].map(label => (
            <div key={label} style={{
              padding: '4px 11px', fontSize: 11, fontWeight: 500,
              background: label === 'Rettssetninger' ? T.ink : 'transparent',
              color: label === 'Rettssetninger' ? T.panel : T.ink3,
              cursor: 'pointer',
            }}>{label}</div>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: T.border }} />

        {/* Subtle counts inline */}
        <span style={{ fontSize: 11, color: T.ink3 }}>
          {PROPOSITIONS.length} rettssetninger
        </span>
        {tensionCount > 0 && (
          <>
            <span style={{ color: T.borderS }}>·</span>
            <span style={{ fontSize: 11, color: T.tension, fontWeight: 500 }}>
              {tensionCount} {tensionCount === 1 ? 'spenning' : 'spenninger'}
            </span>
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Evolution legend — inline, subtle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Object.entries(EVOLUTION).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', border: `2px solid ${val.color}`, background: T.surface }} />
              <span style={{ fontSize: 10, color: T.ink4 }}>{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Registry content */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {themes.map(theme => (
          <ThemeGroup
            key={theme}
            theme={theme}
            propositions={PROPOSITIONS.filter(p => p.theme === theme)}
          />
        ))}
      </div>
    </div>
  );
}

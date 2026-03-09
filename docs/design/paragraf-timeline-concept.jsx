import { useState, useMemo } from "react";

const T = {
  bg: '#F5F3EE',
  panel: '#FAF9F6',
  surface: '#FFFFFF',
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
  provBg: '#E8EEF0',
  confirm: '#3D7A4A',
  confirmBg: '#EBF5ED',
  warn: '#A67B2E',
  warnBg: '#FBF5E8',
  tension: '#A63D3D',
  tensionBg: '#F5EBEB',
  ai: '#8B6914',
  aiBorder: 'rgba(139,105,20,0.2)',
  highlight: '#FBF5E8',
};

/* ═══════════════ DATA ═══════════════ */

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

const PROVISIONS = [
  { id: '§16-10', label: 'FOA §16-10', subtitle: 'Bruk av andre enheters kapasitet' },
  { id: '§17-1', label: 'FOA §17-1', subtitle: 'Dokumentasjonskrav' },
  { id: 'EU', label: 'EU-dommer', subtitle: 'Direktiv 2014/24/EU' },
];

const CASES = [
  // §16-10
  { id: '2018/123', prov: '§16-10', year: 2018, month: 5, outcome: 'Brudd', citations: 12,
    proposition: 'Rådighet må dokumenteres likt', evolution: 'established',
    valence: {} },
  { id: '2019/890', prov: '§16-10', year: 2019, month: 12, outcome: 'Avvist', citations: 0,
    proposition: '§16-10 ikke anvendelig', evolution: 'delimitation', isDelimitation: true,
    valence: {} },
  { id: '2020/567', prov: '§16-10', year: 2020, month: 3, outcome: 'Ikke brudd', citations: 5,
    proposition: 'Underleverandør ≠ støttende virksomhet', evolution: 'established',
    valence: { '2018/123': 'confirming' } },
  { id: '2021/234', prov: '§16-10', year: 2021, month: 8, outcome: 'Brudd', citations: 2,
    proposition: 'Kvantitativ kapasitet må dokumenteres', evolution: 'established',
    valence: {} },
  { id: '2022/789', prov: '§16-10', year: 2022, month: 11, outcome: 'Ikke brudd', citations: 7,
    proposition: 'Ettersending aksepteres under vilkår', evolution: 'nuanced',
    valence: { '2018/123': 'confirming', '2020/567': 'confirming' },
    tensionWith: '2023/456' },
  { id: '2022/345', prov: '§16-10', year: 2022, month: 4, outcome: 'Brudd', citations: 1,
    proposition: 'Binær vs. kvantitativ rådighet', evolution: 'established',
    valence: { '2021/234': 'distinguishing' }, iteration: 2 },
  { id: '2023/456', prov: '§16-10', year: 2023, month: 6, outcome: 'Brudd', citations: 3,
    proposition: 'ESPD ≠ forpliktelseserklæring', evolution: 'confirmed',
    valence: { '2018/123': 'confirming', '2022/789': 'distinguishing' },
    tensionWith: '2022/789' },
  { id: '2024/112', prov: '§16-10', year: 2024, month: 3, outcome: 'Ikke brudd', citations: 1,
    proposition: 'Helhetsvurdering av samlet dokumentasjon', evolution: 'consolidating',
    valence: {}, suggested: true },
  // §17-1
  { id: '2020/567b', prov: '§17-1', year: 2020, month: 3, outcome: 'Ikke brudd', citations: 5,
    proposition: 'Dokumentasjonskrav avhenger av anskaffelsens art',
    evolution: 'established', valence: {},
    label: '2020/567' },
  { id: '2022/789b', prov: '§17-1', year: 2022, month: 11, outcome: 'Ikke brudd', citations: 7,
    proposition: 'Tilstrekkelig informasjon i tilbudet', evolution: 'nuanced',
    valence: {}, label: '2022/789' },
  { id: '2023/456b', prov: '§17-1', year: 2023, month: 6, outcome: 'Brudd', citations: 3,
    proposition: 'ESPD alene er utilstrekkelig', evolution: 'confirmed',
    valence: {}, label: '2023/456' },
  // EU
  { id: 'C-601/13', prov: 'EU', year: 2014, month: 10, outcome: null, citations: 4,
    proposition: 'Kvalifikasjoner og dokumentasjonskrav', evolution: 'established',
    valence: {}, type: 'eu', directive: 'Art. 58+63',
    extraYear: true },
  { id: 'C-324/14', prov: 'EU', year: 2016, month: 5, outcome: null, citations: 8,
    proposition: 'Faktisk disposisjonsrett må dokumenteres', evolution: 'established',
    valence: { 'C-601/13': 'confirming' }, type: 'eu', directive: 'Art. 63' },
];

const EVOLUTION = {
  established: { label: 'Etablert', color: T.ink },
  confirmed: { label: 'Bekreftet', color: T.confirm },
  nuanced: { label: 'Nyansert', color: T.warn },
  delimitation: { label: 'Avgrensning', color: '#C4650A' },
  distinguishing: { label: 'Avgrenset', color: T.warn },
  consolidating: { label: 'Konsoliderende', color: T.prov },
};

/* ═══════════════ HELPERS ═══════════════ */

function yearToX(year, month = 6) {
  const startYear = 2014;
  const endYear = 2025;
  const range = endYear - startYear;
  const value = (year - startYear) + (month - 1) / 12;
  return 80 + (value / range) * 780;
}

/* ═══════════════ SVG TIMELINE ═══════════════ */

function TimelineSVG({ cases, selectedId, onSelect, hoveredId, onHover }) {
  const provRows = PROVISIONS;
  const rowHeight = 110;
  const headerHeight = 50;
  const totalHeight = headerHeight + provRows.length * rowHeight + 90;

  // Year labels and gridlines
  const allYears = [2014, 2015, ...YEARS];

  const nodeRadius = (c) => {
    const base = 8;
    if (c.citations >= 10) return base + 6;
    if (c.citations >= 5) return base + 3;
    if (c.citations >= 2) return base + 1;
    return base;
  };

  const nodeColor = (c) => {
    if (c.type === 'eu') return T.eu;
    return T.kofa;
  };

  const nodeFill = (c) => {
    if (c.type === 'eu') return T.euBg;
    return T.kofaBg;
  };

  // Find tension pairs for curved connectors
  const tensionPairs = [];
  cases.forEach(c => {
    if (c.tensionWith) {
      const target = cases.find(t => t.id === c.tensionWith);
      if (target && !tensionPairs.find(p => (p.a === c.id && p.b === target.id) || (p.a === target.id && p.b === c.id))) {
        tensionPairs.push({ a: c.id, b: target.id });
      }
    }
  });

  return (
    <svg width="100%" viewBox={`0 0 920 ${totalHeight}`} style={{ display: 'block' }}>
      {/* Background */}
      <rect width="920" height={totalHeight} fill={T.bg} />

      {/* Year gridlines */}
      {allYears.map(year => {
        const x = yearToX(year, 1);
        return (
          <g key={year}>
            <line x1={x} y1={headerHeight - 10} x2={x} y2={totalHeight - 20}
              stroke={T.border} strokeWidth={1} />
            <text x={x} y={headerHeight - 18} textAnchor="middle"
              fontSize={11} fontWeight={500} fill={T.ink4}
              fontFamily="-apple-system, sans-serif"
            >{year}</text>
          </g>
        );
      })}

      {/* "Now" marker */}
      <line x1={yearToX(2025, 3)} y1={headerHeight - 10} x2={yearToX(2025, 3)} y2={totalHeight - 20}
        stroke={T.ink3} strokeWidth={1} strokeDasharray="4,4" opacity={0.4} />
      <text x={yearToX(2025, 3)} y={headerHeight - 18} textAnchor="middle"
        fontSize={9} fontWeight={600} fill={T.ink3}
        fontFamily="-apple-system, sans-serif"
      >i dag</text>

      {/* Provision rows */}
      {provRows.map((prov, rowIndex) => {
        const y = headerHeight + rowIndex * rowHeight;
        const rowCases = cases.filter(c => c.prov === prov.id);

        return (
          <g key={prov.id}>
            {/* Row background */}
            {rowIndex % 2 === 0 && (
              <rect x={0} y={y} width={920} height={rowHeight}
                fill="rgba(26,24,20,0.012)" />
            )}

            {/* Row label */}
            <text x={16} y={y + 28} fontSize={11} fontWeight={700}
              fill={prov.id === 'EU' ? T.eu : T.prov}
              fontFamily="'Söhne Mono', monospace"
            >{prov.label}</text>
            <text x={16} y={y + 42} fontSize={9} fill={T.ink4}
              fontFamily="-apple-system, sans-serif"
            >{prov.subtitle}</text>

            {/* Horizontal axis line */}
            <line x1={80} y1={y + 65} x2={870} y2={y + 65}
              stroke={T.borderM} strokeWidth={0.5} />

            {/* Valence connections within this row */}
            {rowCases.map(c => {
              return Object.entries(c.valence || {}).map(([targetId, valence]) => {
                const target = rowCases.find(t => t.id === targetId);
                if (!target) return null;
                const x1 = yearToX(c.year, c.month);
                const x2 = yearToX(target.year, target.month);
                const cy = y + 65;
                const color = valence === 'distinguishing' ? T.warn : valence === 'confirming' ? T.borderM : T.tension;
                const dash = valence === 'distinguishing' ? '4,3' : valence === 'confirming' ? 'none' : '2,3';
                const opacity = valence === 'confirming' ? 0.2 : 0.4;
                return (
                  <line key={`${c.id}-${targetId}`}
                    x1={x1} y1={cy} x2={x2} y2={cy}
                    stroke={color} strokeWidth={1} strokeDasharray={dash} opacity={opacity}
                  />
                );
              });
            })}

            {/* Case nodes */}
            {rowCases.map(c => {
              const cx = yearToX(c.year, c.month);
              const cy = y + 65;
              const r = nodeRadius(c);
              const isSelected = selectedId === c.id;
              const isHovered = hoveredId === c.id;
              const color = nodeColor(c);
              const fill = nodeFill(c);
              const ev = EVOLUTION[c.evolution];

              return (
                <g key={c.id}
                  onClick={() => onSelect(c)}
                  onMouseEnter={() => onHover(c.id)}
                  onMouseLeave={() => onHover(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <circle cx={cx} cy={cy} r={r + 5}
                      fill="none" stroke={color} strokeWidth={2} opacity={0.3} />
                  )}

                  {/* Node */}
                  {c.type === 'eu' ? (
                    <rect x={cx - r * 0.75} y={cy - r * 0.75} width={r * 1.5} height={r * 1.5}
                      rx={2} fill={fill} stroke={color}
                      strokeWidth={isSelected || isHovered ? 2 : 1}
                      transform={`rotate(45, ${cx}, ${cy})`}
                    />
                  ) : (
                    <circle cx={cx} cy={cy} r={r}
                      fill={fill} stroke={color}
                      strokeWidth={isSelected || isHovered ? 2 : 1}
                    />
                  )}

                  {/* Delimitation slash */}
                  {c.isDelimitation && (
                    <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4}
                      stroke="#C4650A" strokeWidth={1.5} />
                  )}

                  {/* Evolution dot */}
                  {ev && (
                    <circle cx={cx + r + 3} cy={cy - r - 1} r={3}
                      fill={ev.color} opacity={0.7} />
                  )}

                  {/* Iteration 2 marker */}
                  {c.iteration === 2 && (
                    <g transform={`translate(${cx}, ${cy + r + 12})`}>
                      <rect x={-10} y={-5} width={20} height={10} rx={5}
                        fill={T.confirmBg || '#EBF5ED'} stroke="rgba(61,122,74,0.12)" strokeWidth={0.5} />
                      <text textAnchor="middle" dy={3} fontSize={7} fill={T.confirm}
                        fontWeight={600} fontFamily="-apple-system, sans-serif"
                        style={{ pointerEvents: 'none' }}>it.2</text>
                    </g>
                  )}

                  {/* AI suggested */}
                  {c.suggested && (
                    <g transform={`translate(${cx + r + 2}, ${cy - r - 5})`}>
                      <rect x={-1} y={-5} width={14} height={10} rx={2}
                        fill={T.highlight} stroke={T.aiBorder} strokeWidth={0.5} />
                      <text x={6} dy={2.5} textAnchor="middle" fontSize={6.5} fill={T.ai}
                        fontWeight={800} fontFamily="-apple-system, sans-serif"
                        style={{ pointerEvents: 'none' }}>AI</text>
                    </g>
                  )}

                  {/* Label */}
                  <text x={cx} y={cy - r - 7} textAnchor="middle"
                    fontSize={9.5} fontWeight={600} fill={isHovered || isSelected ? color : T.ink2}
                    fontFamily="'Söhne Mono', monospace"
                    style={{ pointerEvents: 'none' }}
                  >{c.label || c.id}</text>
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Tension arcs across rows */}
      {tensionPairs.map(({ a, b }, i) => {
        const cA = cases.find(c => c.id === a);
        const cB = cases.find(c => c.id === b);
        if (!cA || !cB) return null;
        const provA = PROVISIONS.findIndex(p => p.id === cA.prov);
        const provB = PROVISIONS.findIndex(p => p.id === cB.prov);
        const x1 = yearToX(cA.year, cA.month);
        const x2 = yearToX(cB.year, cB.month);
        const y1 = headerHeight + provA * rowHeight + 65;
        const y2 = headerHeight + provB * rowHeight + 65;
        // Same row — arc below
        if (provA === provB) {
          const midX = (x1 + x2) / 2;
          const bulge = 25;
          return (
            <g key={`tension-${i}`}>
              <path d={`M${x1},${y1 + nodeRadius(cA)} Q${midX},${y1 + bulge + nodeRadius(cA)} ${x2},${y2 + nodeRadius(cB)}`}
                fill="none" stroke={T.tension} strokeWidth={1.2} strokeDasharray="3,4" opacity={0.5} />
              <text x={midX} y={y1 + bulge + nodeRadius(cA) + 4} textAnchor="middle"
                fontSize={8} fill={T.tension} fontWeight={600} opacity={0.7}
                fontFamily="-apple-system, sans-serif">spenning</text>
            </g>
          );
        }
        return null;
      })}

      {/* Bottom legends — citations left, evolution right */}
      <g transform={`translate(80, ${totalHeight - 50})`}>
        {/* Citation sizes */}
        <text x={0} y={0} fontSize={9} fill={T.ink4} fontWeight={600}
          fontFamily="-apple-system, sans-serif" letterSpacing="0.04em">NODESTØRRELSE</text>
        <text x={0} y={11} fontSize={8} fill={T.ink4}
          fontFamily="-apple-system, sans-serif">Antall siteringer — eldre saker dominerer</text>
        {[{ r: 5, label: '0–1' }, { r: 7, label: '2–4' }, { r: 9.5, label: '5–9' }, { r: 12, label: '10+' }].map((item, i) => (
          <g key={i} transform={`translate(${i * 42 + 10}, 30)`}>
            <circle cx={0} cy={0} r={item.r * 0.55} fill="none" stroke={T.borderM} strokeWidth={1} />
            <text x={0} y={item.r * 0.55 + 10} textAnchor="middle" fontSize={7.5} fill={T.ink4}
              fontFamily="-apple-system, sans-serif">{item.label}</text>
          </g>
        ))}
      </g>

      {/* Evolution dots legend */}
      <g transform={`translate(320, ${totalHeight - 50})`}>
        <text x={0} y={0} fontSize={9} fill={T.ink4} fontWeight={600}
          fontFamily="-apple-system, sans-serif" letterSpacing="0.04em">RETTSUTVIKLING</text>
        <text x={0} y={11} fontSize={8} fill={T.ink4}
          fontFamily="-apple-system, sans-serif">Prikk ved node — AI-klassifisert</text>
        {[
          { color: '#1A1814', label: 'Etablert', type: 'dot' },
          { color: '#3D7A4A', label: 'Bekreftet', type: 'dot' },
          { color: '#A67B2E', label: 'Nyansert', type: 'dot' },
          { color: '#C4650A', label: 'Avgrensning', type: 'slash' },
          { color: '#4A6670', label: 'Konsoliderende', type: 'dot' },
        ].map((item, i) => (
          <g key={i} transform={`translate(${i * 80}, 28)`}>
            {item.type === 'slash' ? (
              <g>
                <circle cx={0} cy={0} r={4.5} fill="none" stroke={item.color} strokeWidth={1} opacity={0.7} />
                <line x1={-3} y1={-3} x2={3} y2={3} stroke={item.color} strokeWidth={1.3} opacity={0.7} />
              </g>
            ) : (
              <circle cx={0} cy={0} r={3.5} fill={item.color} opacity={0.7} />
            )}
            <text x={8} y={3.5} fontSize={8} fill={T.ink4}
              fontFamily="-apple-system, sans-serif">{item.label}</text>
          </g>
        ))}
      </g>

      {/* Valence line styles */}
      <g transform={`translate(740, ${totalHeight - 50})`}>
        <text x={0} y={0} fontSize={9} fill={T.ink4} fontWeight={600}
          fontFamily="-apple-system, sans-serif" letterSpacing="0.04em">VALENS</text>
        <g transform="translate(0, 20)">
          <line x1={0} y1={0} x2={20} y2={0} stroke={T.borderM} strokeWidth={1} />
          <text x={25} y={3.5} fontSize={8} fill={T.ink4} fontFamily="-apple-system, sans-serif">Bekreftende</text>
        </g>
        <g transform="translate(0, 32)">
          <line x1={0} y1={0} x2={20} y2={0} stroke={T.warn} strokeWidth={1} strokeDasharray="4,3" />
          <text x={25} y={3.5} fontSize={8} fill={T.ink4} fontFamily="-apple-system, sans-serif">Avgrensende</text>
        </g>
        <g transform="translate(0, 44)">
          <path d="M0,0 Q10,8 20,0" fill="none" stroke={T.tension} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
          <text x={25} y={3.5} fontSize={8} fill={T.tension} fontFamily="-apple-system, sans-serif">Spenning</text>
        </g>
      </g>
    </svg>
  );
}

/* ═══════════════ DETAIL CARD ═══════════════ */

function CaseDetail({ c, onClose }) {
  if (!c) return null;
  const ev = EVOLUTION[c.evolution];
  const color = c.type === 'eu' ? T.eu : T.kofa;

  return (
    <div style={{
      background: T.surface,
      borderRadius: 8,
      border: `1px solid ${T.borderM}`,
      overflow: 'hidden',
      maxWidth: 480,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: c.type === 'eu' ? T.euBg : T.kofaBg,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: "'Söhne Mono', monospace", fontSize: 15, fontWeight: 700, color,
            }}>{c.label || c.id}</span>
            {ev && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
                background: T.surface, color: ev.color,
              }}>{ev.label}</span>
            )}
            {c.outcome && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
                background: c.outcome === 'Brudd' ? T.warnBg : c.outcome === 'Avvist' ? 'rgba(26,24,20,0.05)' : T.confirmBg,
                color: c.outcome === 'Brudd' ? T.warn : c.outcome === 'Avvist' ? T.ink3 : T.confirm,
              }}>{c.outcome}</span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.ink2 }}>{c.proposition}</div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 15, color: T.ink4, padding: '0 2px',
        }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: T.ink3 }}>
            {c.year}-{String(c.month).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 11, color: T.ink3 }}>{c.citations} siteringer</span>
          {c.directive && <span style={{ fontSize: 11, color: T.eu, fontWeight: 500 }}>{c.directive}</span>}
          {c.tensionWith && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
              background: T.tensionBg, color: T.tension,
            }}>Spenning med {c.tensionWith}</span>
          )}
        </div>

        {/* Valence connections */}
        {Object.keys(c.valence || {}).length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.ink4, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>Siteringsrelasjoner</div>
            {Object.entries(c.valence).map(([targetId, val]) => {
              const vLabel = val === 'confirming' ? 'Bekrefter' : val === 'distinguishing' ? 'Skiller seg fra' : val;
              const vColor = val === 'confirming' ? T.confirm : val === 'distinguishing' ? T.warn : T.ink3;
              return (
                <div key={targetId} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 0', fontSize: 12,
                }}>
                  <span style={{ color: vColor, fontWeight: 600, fontSize: 11 }}>{vLabel}</span>
                  <span style={{
                    fontFamily: "'Söhne Mono', monospace", fontWeight: 600,
                    fontSize: 11, color: T.kofa,
                  }}>{targetId}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Action hint */}
        <div style={{
          fontSize: 11, color: T.ink4, fontStyle: 'italic',
          paddingTop: 8, borderTop: `1px solid ${T.border}`,
        }}>
          Klikk for å åpne i høyrepanelet med AI-kuratert lesemodus
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ MAIN ═══════════════ */

export default function TimelineConcept() {
  const [selectedCase, setSelectedCase] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      color: T.ink,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 24px',
        borderBottom: `1px solid ${T.border}`,
        background: T.panel,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink3 }}>Paragraf</span>
        <span style={{ color: T.borderS }}>·</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>FOA §16-10 — Rådighet</span>
        <span style={{ flex: 1 }} />

        {/* View switcher hint */}
        <div style={{ display: 'flex', borderRadius: 5, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          {['Liste', 'Graf', 'Tidslinje'].map((label, i) => (
            <div key={label} style={{
              padding: '4px 11px', fontSize: 11, fontWeight: 500,
              background: label === 'Tidslinje' ? T.ink : 'transparent',
              color: label === 'Tidslinje' ? T.panel : T.ink3,
            }}>{label}</div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '8px 0', overflowX: 'auto' }}>
        <TimelineSVG
          cases={CASES}
          selectedId={selectedCase?.id}
          onSelect={setSelectedCase}
          hoveredId={hoveredId}
          onHover={setHoveredId}
        />
      </div>

      {/* Selected case detail */}
      {selectedCase && (
        <div style={{ padding: '0 24px 24px' }}>
          <CaseDetail c={selectedCase} onClose={() => setSelectedCase(null)} />
        </div>
      )}
    </div>
  );
}

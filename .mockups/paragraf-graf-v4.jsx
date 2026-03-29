import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Search, List, Network, BookOpen, PenTool, Sun, Moon, X,
  ZoomIn, ZoomOut, Maximize, Eye, EyeOff, Sparkles, Star,
  ChevronRight, ExternalLink, ChevronDown
} from 'lucide-react';

/*
  PARAGRAF — Grafvisning v4

  v3 → v4 changes:
  ─ Hover tooltip: shows KI-proposition on hover (scan without clicking)
  ─ User color marking: right-click → 5 color swatches, ring around node dot
    Colors avoid semantic palette (oker/fiolett/blå/grønn/rød)
  ─ Isolated node indicator: nodes with 0 visible edges labeled separately

  ═══ FUTURE (commented, not built) ═══

  DELSPØRSMÅLSFILTER:
  Dropdown above tab-bar: "Alle delspørsmål" → select one → only relevant nodes.
  Requires: each case linked to one or more sub-problems from scope.
  Data model: caseNodes[].subProblems: string[] matching scopeData.subProblems[].id
  Filter logic: same as category filter but on subProblems membership.
  Combines with category: "A-saker om solidaransvar."
  UI: dropdown left of tab-toggle, Albert Sans 11px, ChevronDown.
  Re-simulation on change (same as category filter).

  KRONOLOGISK AKSE:
  Toggle in toolbar: "Tid" button.
  When active: adds d3.forceX based on year, mapping [minYear, maxYear] → [100, 900].
  Strength ~0.15, enough to create left-to-right tendency without rigid timeline.
  Subtle year labels along bottom edge (2014, 2016, ..., 2025) in mono 9px muted.
  Combined with existing forces — nodes still cluster by connections but drift chronologically.
  Toggle off: remove forceX, re-simulate to connection-based layout.

  KRYSSNAVIGASJON:
  "Vis i Saksoversikten" button in detail panel → switches nav rail to List perspective.
  Requires: shared selectedCaseId state across perspectives via parent component or context.
  When switching: perspective 2 (Saksoversikt) opens with that case pre-selected and scrolled into view.
  Similarly: "Vis i Rettssetninger" if case is linked to a rettssetning.
  Implementation: lift selectedId to analysis-level state, nav rail onClick sets perspective + selectedId.
*/

const CURRENT_YEAR = 2026;
const PROBLEM = 'Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11?';

// ═══════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════

const caseNodes = [
  { id:'k1',  type:'case', ref:'KOFA-2016-104',  source:'Klagenemnda', year:2016, category:'A', star:false, citedBy:5,  signals:['R','F'],    proposition:'Felles innlevering etablerer solidaransvar uten formell selskapsavtale.' },
  { id:'k2',  type:'case', ref:'KOFA-2022-1200', source:'Klagenemnda', year:2022, category:'A', star:true,  citedBy:3,  signals:['R','F','V'], proposition:'Solidaransvar forutsettes ved leverandørgruppering. Samarbeidsavtale kan kreves ved kontraktsignering.' },
  { id:'k3',  type:'case', ref:'HR-2019-1801-A',  source:'Høyesterett', year:2019, category:'A', star:true,  citedBy:8,  signals:['F','V'],    proposition:'Selskapsrettslig status for midlertidige konsortier må vurderes konkret.' },
  { id:'k4',  type:'case', ref:'C-396/14',        source:'EU-domstolen',year:2014, category:'A', star:true,  citedBy:12, signals:['V'],        proposition:'En sammenslutning kan støtte seg på kapasiteten til de enkelte medlemmene.' },
  { id:'k9',  type:'case', ref:'KOFA-2024-88',    source:'Klagenemnda', year:2024, category:'A', star:true,  citedBy:0,  signals:['R','F','V'], proposition:'Solidaransvar kan ikke fravikes i konkurransegrunnlaget — ufravikelig.' },
  { id:'k10', type:'case', ref:'C-324/14',        source:'EU-domstolen',year:2014, category:'A', star:false, citedBy:6,  signals:['V'],        proposition:'Proporsjonalitetskrav ved vurdering av sammenslutningers kapasitet.' },
  { id:'k14', type:'case', ref:'KOFA-2023-410',   source:'Klagenemnda', year:2023, category:'A', star:false, citedBy:1,  signals:['R','V'],    proposition:'Krav om juridisk form kan ikke stilles før tildeling.' },
  { id:'k5',  type:'case', ref:'KOFA-2020-55',    source:'Klagenemnda', year:2020, category:'B', star:false, citedBy:2,  signals:['R'],        proposition:'Grensen mellom støtte på kapasitet og underleverandør.' },
  { id:'k6',  type:'case', ref:'KOFA-2021-312',   source:'Klagenemnda', year:2021, category:'B', star:false, citedBy:1,  signals:['R','V'],    proposition:'Forpliktelseserklæring utilstrekkelig for nøkkelpersonell.' },
  { id:'k7',  type:'case', ref:'KOFA-2019-445',   source:'Klagenemnda', year:2019, category:'B', star:false, citedBy:3,  signals:['R','F'],    proposition:'Underleverandørens rolle ved felles tilbud.' },
  { id:'k8',  type:'case', ref:'KOFA-2017-147',   source:'Klagenemnda', year:2017, category:'B', star:false, citedBy:4,  signals:['R'],        proposition:'Innhold og form på forpliktelseserklæring.' },
  { id:'k15', type:'case', ref:'KOFA-2020-789',   source:'Klagenemnda', year:2020, category:'B', star:false, citedBy:1,  signals:['F','V'],    proposition:'Oppdragsgivers skjønn ved vurdering av samarbeidsavtale.' },
  { id:'k16', type:'case', ref:'KOFA-2018-233',   source:'Klagenemnda', year:2018, category:'B', star:false, citedBy:2,  signals:['R'],        proposition:'Tidspunktet for fremleggelse av forpliktelseserklæring.' },
  { id:'k17', type:'case', ref:'C-27/15',         source:'EU-domstolen',year:2016, category:'B', star:false, citedBy:4,  signals:['V'],        proposition:'Underleverandørs rett til å bli vurdert selvstendig.' },
  { id:'k11', type:'case', ref:'KOFA-2018-12',    source:'Klagenemnda', year:2018, category:'C', star:false, citedBy:0,  signals:['F'],        proposition:'Privatrettslig samarbeidsavtale utenfor nemndas kompetanse.' },
  { id:'k18', type:'case', ref:'KOFA-2017-650',   source:'Klagenemnda', year:2017, category:'C', star:false, citedBy:0,  signals:['F'],        proposition:'Omhandler samarbeid, men i annet rettsområde.' },
  { id:'k19', type:'case', ref:'KOFA-2015-88',    source:'Klagenemnda', year:2015, category:'C', star:false, citedBy:1,  signals:['R'],        proposition:'Generell avvisningshjemmel, perifert relevant.' },
  { id:'k20', type:'case', ref:'KOFA-2022-401',   source:'Klagenemnda', year:2022, category:'C', star:false, citedBy:0,  signals:['V'],        proposition:'Konseptuelt nært men gjelder annen kontraktstype.' },
  { id:'k12', type:'case', ref:'KOFA-2023-999',   source:'Klagenemnda', year:2023, category:null, star:false, citedBy:0, signals:['R','V'],    proposition:null },
  { id:'k13', type:'case', ref:'KOFA-2025-44',    source:'Klagenemnda', year:2025, category:null, star:false, citedBy:0, signals:['V'],        proposition:null },
];

const provisionNodes = [
  { id:'p1', type:'provision', ref:'FOA §16-11', label:'Leverandørgrupperinger' },
  { id:'p2', type:'provision', ref:'FOA §16-10', label:'Støtte på kapasitet' },
  { id:'p3', type:'provision', ref:'FOA §19-2',  label:'Underleverandører' },
  { id:'p4', type:'provision', ref:'FOA §24-2',  label:'Avvisning' },
  { id:'p5', type:'provision', ref:'FOA §5-1',   label:'Grunnprinsipper' },
  { id:'p6', type:'provision', ref:'LOA §4',     label:'Likebehandling' },
];

const caseCitations = [
  {source:'k2',target:'k1'},{source:'k9',target:'k2'},{source:'k9',target:'k1'},
  {source:'k6',target:'k4'},{source:'k5',target:'k4'},{source:'k7',target:'k5'},
  {source:'k8',target:'k4'},{source:'k2',target:'k3'},{source:'k6',target:'k10'},
  {source:'k8',target:'k5'},{source:'k12',target:'k9'},{source:'k5',target:'k10'},
  {source:'k14',target:'k2'},{source:'k14',target:'k1'},{source:'k15',target:'k1'},
  {source:'k15',target:'k7'},{source:'k16',target:'k8'},{source:'k16',target:'k4'},
  {source:'k7',target:'k17'},{source:'k6',target:'k17'},{source:'k19',target:'k1'},
  {source:'k13',target:'k14'},{source:'k9',target:'k14'},{source:'k20',target:'k2'},
  {source:'k11',target:'k2'},
];

const provisionRefs = [
  {source:'k1',target:'p1'},{source:'k2',target:'p1'},{source:'k9',target:'p1'},
  {source:'k12',target:'p1'},{source:'k3',target:'p1'},{source:'k14',target:'p1'},
  {source:'k11',target:'p1'},
  {source:'k5',target:'p2'},{source:'k6',target:'p2'},{source:'k8',target:'p2'},
  {source:'k4',target:'p2'},{source:'k10',target:'p2'},{source:'k16',target:'p2'},
  {source:'k15',target:'p2'},
  {source:'k7',target:'p3'},{source:'k17',target:'p3'},
  {source:'k5',target:'p4'},{source:'k19',target:'p4'},
  {source:'k10',target:'p5'},{source:'k3',target:'p5'},
  {source:'k10',target:'p6'},
];

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

const allBaseNodes = [...caseNodes, ...provisionNodes];
const allEdges = [
  ...caseCitations.map(e => ({ ...e, edgeType: 'citation' })),
  ...provisionRefs.map(e => ({ ...e, edgeType: 'reference' })),
];

const getCitationRate = n => n.type !== 'case' ? 0 : n.citedBy / Math.max(1, CURRENT_YEAR - n.year);
const maxCR = Math.max(...caseNodes.map(getCitationRate), 0.01);
const getDotR = n => n.type !== 'case' ? 0 : 4 + (getCitationRate(n) / maxCR) * 6;
const getCatRadius = n => {
  if (n.type === 'provision') return 160;
  if (n.category === 'A') return 0;
  if (n.category === 'B') return 170;
  return 280;
};

const getConnected = nodeId => {
  const ids = new Set();
  allEdges.forEach(e => {
    if (e.source === nodeId) ids.add(e.target);
    if (e.target === nodeId) ids.add(e.source);
  });
  return ids;
};

const getNodeEdges = nid => allEdges.filter(e => e.source === nid || e.target === nid);
const isEdgeConn = (e, nid) => e.source === nid || e.target === nid;

const SIGNAL_META = {
  R: { label:'Referanse', color:'var(--ink-muted)',   bg:'var(--paper-dark)',    border:'var(--border)' },
  F: { label:'Ordtreff',  color:'var(--signal-fts)',  bg:'var(--signal-fts-bg)', border:'var(--signal-fts-border)' },
  V: { label:'Konsept',   color:'var(--ai-accent)',   bg:'var(--ai-bg)',         border:'var(--ai-border)' },
};
const CAT_LABELS = { A:'Kjernesak', B:'Støttesak', C:'Kontekstsak' };

// User marking colors — avoids semantic palette
const MARK_COLORS = [
  { id: 'none', hex: 'transparent', label: 'Fjern' },
  { id: 'rose', hex: '#D4727E', label: 'Rosa' },
  { id: 'teal', hex: '#5AA3A3', label: 'Turkis' },
  { id: 'amber', hex: '#C4933A', label: 'Oransje' },
  { id: 'lilac', hex: '#9A7EB8', label: 'Lavendel' },
  { id: 'sage', hex: '#7BA37B', label: 'Salvie' },
];

function runSimulation(visibleIds) {
  const cx = 500, cy = 400;
  const nodes = allBaseNodes.filter(n => visibleIds.has(n.id)).map(n => ({
    ...n, x: cx + (Math.random() - 0.5) * 200, y: cy + (Math.random() - 0.5) * 200,
  }));
  const links = allEdges
    .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map(e => ({ source: e.source, target: e.target }));

  const nc = nodes.length;
  const charge = nc > 15 ? -280 : nc > 8 ? -350 : -420;
  const linkDist = nc > 15 ? 80 : 95;

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(linkDist).strength(0.35))
    .force('charge', d3.forceManyBody().strength(charge).distanceMax(500))
    .force('center', d3.forceCenter(cx, cy).strength(0.04))
    .force('collide', d3.forceCollide().radius(d => d.type === 'provision' ? 50 : 45).strength(0.6))
    .force('radial', d3.forceRadial(d => getCatRadius(d), cx, cy).strength(d => d.type === 'provision' ? 0.02 : 0.05))
    /*
      FUTURE: Kronologisk akse
      When chronological toggle is active, add:
      .force('timeX', d3.forceX(d => {
        if (d.type !== 'case') return cx;
        const minY = 2014, maxY = 2025;
        return 100 + ((d.year - minY) / (maxY - minY)) * 800;
      }).strength(0.15))
      And render subtle year labels along the bottom of the SVG.
    */
    .alpha(1).alphaDecay(0.025);

  for (let i = 0; i < 350; i++) sim.tick();
  sim.stop();

  const pos = {};
  nodes.forEach(n => { pos[n.id] = { x: n.x, y: n.y }; });
  return pos;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showProvisions, setShowProvisions] = useState(true);
  const [activeCats, setActiveCats] = useState([]);
  const [positions, setPositions] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [nodeMarks, setNodeMarks] = useState({}); // { nodeId: colorId }
  const [contextMenu, setContextMenu] = useState(null); // { nodeId, x, y }
  const [tooltipInfo, setTooltipInfo] = useState(null); // { nodeId, x, y }
  const prevPositions = useRef(null);
  const animFrame = useRef(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const zoomRef = useRef(null);
  const tooltipTimer = useRef(null);

  const counts = useMemo(() => {
    const c = { all: caseNodes.length, null: 0, A: 0, B: 0, C: 0 };
    caseNodes.forEach(n => { c[n.category === null ? 'null' : n.category]++; });
    return c;
  }, []);

  const toggleCat = cat => {
    setActiveCats(prev => {
      if (cat === 'all') return [];
      const has = prev.includes(cat);
      const next = has ? prev.filter(c => c !== cat) : [...prev, cat];
      if (next.length === 4) return [];
      return next;
    });
  };

  const visibleNodeIds = useMemo(() => {
    const ids = new Set();
    allBaseNodes.forEach(n => {
      if (n.type === 'provision') { if (showProvisions) ids.add(n.id); return; }
      if (activeCats.length === 0) { ids.add(n.id); }
      else {
        const ck = n.category === null ? 'null' : n.category;
        if (activeCats.includes(ck)) ids.add(n.id);
      }
    });
    return ids;
  }, [activeCats, showProvisions]);

  const visibleEdges = useMemo(() =>
    allEdges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
  [visibleNodeIds]);

  // Isolated nodes: visible cases with zero visible edges
  const isolatedIds = useMemo(() => {
    const connected = new Set();
    visibleEdges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    const iso = [];
    visibleNodeIds.forEach(id => {
      const n = allBaseNodes.find(x => x.id === id);
      if (n && n.type === 'case' && !connected.has(id)) iso.push(id);
    });
    return new Set(iso);
  }, [visibleNodeIds, visibleEdges]);

  // Simulation
  useEffect(() => {
    const newPos = runSimulation(visibleNodeIds);
    if (prevPositions.current && Object.keys(prevPositions.current).length > 0) {
      const startPos = { ...prevPositions.current };
      const endPos = newPos;
      const duration = 500;
      const t0 = performance.now();
      setAnimating(true);
      const anim = now => {
        const t = Math.min(1, (now - t0) / duration);
        const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
        const interp = {};
        Object.keys(endPos).forEach(id => {
          const s = startPos[id] || endPos[id];
          interp[id] = { x: s.x + (endPos[id].x - s.x) * ease, y: s.y + (endPos[id].y - s.y) * ease };
        });
        Object.keys(startPos).forEach(id => { if (!endPos[id]) interp[id] = startPos[id]; });
        setPositions(interp);
        if (t < 1) animFrame.current = requestAnimationFrame(anim);
        else { setAnimating(false); prevPositions.current = endPos; }
      };
      animFrame.current = requestAnimationFrame(anim);
    } else {
      setPositions(newPos);
      prevPositions.current = newPos;
    }
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
  }, [visibleNodeIds]);

  useEffect(() => {
    if (!animating && positions) setTimeout(() => fitView(), 60);
  }, [animating]);

  // Zoom
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const zoom = d3.zoom().scaleExtent([0.15, 3])
      .filter(e => e.type === 'wheel' || !(e.type === 'mousedown' || e.type === 'touchstart') || !e.target.closest('.graph-node'))
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    zoomRef.current = zoom;
  }, []);

  const fitView = useCallback(() => {
    if (!svgRef.current || !gRef.current || !zoomRef.current) return;
    const bb = gRef.current.getBBox();
    if (!bb.width) return;
    const W = svgRef.current.clientWidth, H = svgRef.current.clientHeight, pad = 80;
    const s = Math.min((W-pad*2)/bb.width, (H-pad*2)/bb.height, 1.4);
    const tx = W/2 - s*(bb.x+bb.width/2), ty = H/2 - s*(bb.y+bb.height/2);
    d3.select(svgRef.current).transition().duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(s));
  }, []);

  const zoomIn = () => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 1.4); };
  const zoomOut = () => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, 0.7); };

  // Context menu for marking
  const handleContextMenu = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    const n = allBaseNodes.find(x => x.id === nodeId);
    if (!n || n.type !== 'case') return;
    setContextMenu({ nodeId, x: e.clientX, y: e.clientY });
  };

  const applyMark = (nodeId, colorId) => {
    setNodeMarks(prev => {
      const next = { ...prev };
      if (colorId === 'none') delete next[nodeId]; else next[nodeId] = colorId;
      return next;
    });
    setContextMenu(null);
  };

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // Tooltip with delay
  const showTooltip = (nodeId, svgX, svgY) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      const n = allBaseNodes.find(x => x.id === nodeId);
      if (n && n.type === 'case' && n.proposition) {
        // Convert SVG coordinates to screen via current transform
        const svg = svgRef.current;
        const g = gRef.current;
        if (!svg || !g) return;
        const ctm = g.getCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = svgX; pt.y = svgY;
        const screen = pt.matrixTransform(ctm);
        const rect = svg.getBoundingClientRect();
        setTooltipInfo({
          nodeId,
          x: rect.left + screen.x,
          y: rect.top + screen.y,
          text: n.proposition,
          ref: n.ref,
        });
      }
    }, 400);
  };
  const hideTooltip = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltipInfo(null);
  };

  const selectedNode = selectedId ? allBaseNodes.find(n => n.id === selectedId) : null;
  const caseCount = caseNodes.filter(n => visibleNodeIds.has(n.id)).length;
  const provCount = provisionNodes.filter(n => visibleNodeIds.has(n.id)).length;

  const getCitesFrom = nid => caseCitations.filter(e => e.source === nid).map(e => e.target);
  const getCitedByL = nid => caseCitations.filter(e => e.target === nid).map(e => e.source);
  const getProvRefs = nid => provisionRefs.filter(e => e.source === nid).map(e => e.target);
  const getCasesForProv = pid => provisionRefs.filter(e => e.target === pid).map(e => e.source);
  const isTabActive = cat => cat === 'all' ? activeCats.length === 0 : activeCats.includes(cat);

  // Marked color counts for legend
  const markCounts = {};
  Object.values(nodeMarks).forEach(c => { markCounts[c] = (markCounts[c] || 0) + 1; });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap');
        :root{--ink:#1C1B1A;--ink-secondary:#33312E;--ink-tertiary:#4A4843;--ink-muted:#7A766F;--paper:#F8F6F1;--paper-dark:#EDEAE3;--border-subtle:rgba(28,27,26,0.06);--border:rgba(28,27,26,0.12);--border-strong:rgba(28,27,26,0.20);--border-stronger:rgba(28,27,26,0.35);--control-bg:#EDEAE3;--control-border:rgba(28,27,26,0.12);--ai-accent:#92600A;--ai-border:rgba(146,96,10,0.20);--ai-bg:rgba(146,96,10,0.05);--signal-fts:#4A6A8B;--signal-fts-border:rgba(74,106,139,0.25);--signal-fts-bg:rgba(74,106,139,0.06);--hover-bg:rgba(28,27,26,0.02);--hover-bg-strong:rgba(28,27,26,0.04);--header-bg:rgba(248,246,241,0.92);--row-active-bg:rgba(28,27,26,0.04);--confirm-color:#375E37;--gold-star:#B8941E;--edge-color:rgba(28,27,26,0.10);--edge-cite:rgba(28,27,26,0.18);--edge-highlight:rgba(28,27,26,0.40);--noise-svg:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")}
        .dark{--ink:#E2DFD6;--ink-secondary:#C4C0B5;--ink-tertiary:#8E8A80;--ink-muted:#5C5850;--paper:#1E1C19;--paper-dark:#16140F;--border-subtle:rgba(232,229,220,0.06);--border:rgba(232,229,220,0.10);--border-strong:rgba(232,229,220,0.16);--border-stronger:rgba(232,229,220,0.28);--control-bg:#262420;--control-border:rgba(232,229,220,0.12);--ai-accent:#C49A4E;--ai-border:rgba(196,154,78,0.25);--ai-bg:rgba(196,154,78,0.08);--signal-fts:#8BAAC4;--signal-fts-border:rgba(139,170,196,0.25);--signal-fts-bg:rgba(139,170,196,0.08);--hover-bg:rgba(232,229,220,0.03);--hover-bg-strong:rgba(232,229,220,0.06);--header-bg:rgba(30,28,25,0.92);--row-active-bg:rgba(232,229,220,0.05);--confirm-color:#8BC48B;--gold-star:#D4B84E;--edge-color:rgba(232,229,220,0.06);--edge-cite:rgba(232,229,220,0.12);--edge-highlight:rgba(232,229,220,0.30);--noise-svg:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E")}
        *{box-sizing:border-box;margin:0;padding:0}
        .font-sans{font-family:'Albert Sans',sans-serif}.font-mono{font-family:'JetBrains Mono',monospace}.font-serif{font-family:'Newsreader',serif}
        ::selection{background:var(--ai-bg);color:var(--ai-accent)}
        .nav-btn{width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:3px;border:1px solid transparent;cursor:pointer;transition:all .15s ease;background:transparent;color:var(--ink-muted)}.nav-btn:hover{color:var(--ink);background:var(--hover-bg)}.nav-btn:active{transform:scale(.95)}.nav-btn.active{color:var(--ink);background:var(--paper-dark);border-color:var(--border)}
        .logo-home{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--ink);border-radius:4px;background:transparent;cursor:pointer;transition:border-color .15s ease;flex-shrink:0}.logo-home:hover{border-color:var(--border-strong)}.logo-home:active{transform:scale(.95)}
        .mode-toggle{width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:transparent;color:var(--ink-tertiary);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s ease}.mode-toggle:hover{color:var(--ink);border-color:var(--border-strong)}
        .toolbar-btn{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:3px;border:1px solid var(--border);background:transparent;color:var(--ink-muted);cursor:pointer;transition:all .15s ease}.toolbar-btn:hover{color:var(--ink);border-color:var(--border-strong)}.toolbar-btn:active{transform:scale(.95)}
        .tab-toggle{display:flex;border:1px solid var(--border);border-radius:4px;overflow:hidden}.tab-toggle .tab-sep{width:1px;align-self:stretch;background:var(--border)}.tab-btn{padding:4px 10px;font-family:'Albert Sans',sans-serif;font-size:11px;font-weight:500;border:none;background:transparent;color:var(--ink-muted);cursor:pointer;white-space:nowrap;transition:all .15s ease}.tab-btn:hover{color:var(--ink-secondary);background:var(--hover-bg)}.tab-btn:active{transform:scale(.97)}.tab-btn.active{background:var(--paper-dark);color:var(--ink)}.tab-cat{font-family:'JetBrains Mono',monospace;font-size:10px;opacity:.5;margin-left:2px}
        .toggle-btn{display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:3px;border:1px solid var(--border);background:transparent;cursor:pointer;transition:all .15s ease;font-family:'Albert Sans',sans-serif;font-size:11px;font-weight:500;color:var(--ink-tertiary)}.toggle-btn:hover{border-color:var(--border-strong);color:var(--ink-secondary)}.toggle-btn.active{background:var(--paper-dark);color:var(--ink);border-color:var(--border-strong)}
        .graph-node{cursor:pointer}
        .action-btn{display:inline-flex;align-items:center;gap:4px;font-family:'Albert Sans',sans-serif;font-size:11px;font-weight:500;padding:4px 12px;border-radius:2px;cursor:pointer;transition:all .15s ease;border:1px solid var(--border);background:transparent;color:var(--ink-tertiary)}.action-btn:hover{border-color:var(--border-strong);color:var(--ink)}.action-btn:active{transform:scale(.98)}
        .detail-row{padding:6px 4px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:8px;cursor:pointer;transition:background .1s ease;border-radius:2px}.detail-row:hover{background:var(--hover-bg)}.detail-row:last-child{border-bottom:none}
        .signal-chip{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:2px;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600}
        .slide-in{animation:slideIn .25s cubic-bezier(.16,1,.3,1) forwards}@keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        .legend-toggle{display:flex;align-items:center;gap:6px;padding:0;background:none;border:none;cursor:pointer;font-family:'Albert Sans',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-muted);transition:color .15s ease}.legend-toggle:hover{color:var(--ink-tertiary)}
        .ctx-menu{position:fixed;z-index:100;background:var(--paper);border:1px solid var(--border-strong);border-radius:4px;padding:6px;display:flex;gap:4px;animation:dropIn .12s ease forwards}
        @keyframes dropIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .ctx-swatch{width:20px;height:20px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:all .12s ease;display:flex;align-items:center;justify-content:center}
        .ctx-swatch:hover{transform:scale(1.15);border-color:var(--border-stronger)}
        .ctx-swatch.active-swatch{border-color:var(--ink)}
        .tooltip-box{position:fixed;z-index:90;max-width:260px;padding:10px 12px;background:var(--paper);border:1px solid var(--border-strong);border-radius:3px;pointer-events:none;animation:dropIn .12s ease forwards}
      `}} />

      <div className={darkMode?'dark':''} style={{height:'100vh',width:'100%',display:'flex',flexDirection:'column',overflow:'hidden',backgroundColor:'var(--paper)',color:'var(--ink)',colorScheme:darkMode?'dark':'light',backgroundImage:'var(--noise-svg)',fontFamily:"'Albert Sans',sans-serif"}}>

        {/* ─── HEADER ─── */}
        <header style={{height:48,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',borderBottom:'1px solid var(--border)',background:'var(--header-bg)',backdropFilter:'blur(12px)',flexShrink:0,zIndex:30}}>
          <div style={{display:'flex',alignItems:'center',gap:12,flex:1,minWidth:0}}>
            <button className="logo-home"><span className="font-serif" style={{fontStyle:'italic',fontWeight:600,fontSize:13,lineHeight:1}}>§</span></button>
            <div style={{width:1,height:16,background:'var(--border)',flexShrink:0}}/>
            <h1 className="font-serif" style={{fontSize:16,fontWeight:500,color:'var(--ink)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={PROBLEM}>{PROBLEM}</h1>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <button className="mode-toggle" onClick={()=>setDarkMode(!darkMode)}>{darkMode?<Sun style={{width:14,height:14}}/>:<Moon style={{width:14,height:14}}/>}</button>
            <div style={{width:28,height:28,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--paper-dark)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,color:'var(--ink-secondary)'}}>MJ</div>
          </div>
        </header>

        <div style={{flex:1,display:'flex',overflow:'hidden'}}>
          {/* ─── NAV RAIL ─── */}
          <nav style={{width:48,borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',alignItems:'center',padding:'12px 8px',flexShrink:0,gap:4}}>
            <button className="nav-btn" title="Scope"><Search style={{width:16,height:16}}/></button>
            <button className="nav-btn" title="Arbeidsregister"><List style={{width:16,height:16}}/></button>
            <button className="nav-btn active" title="Grafvisning"><Network style={{width:16,height:16}}/></button>
            <button className="nav-btn" title="Rettssetninger"><BookOpen style={{width:16,height:16}}/></button>
            <div style={{marginTop:'auto'}}><button className="nav-btn" title="Notat"><PenTool style={{width:16,height:16}}/></button></div>
          </nav>

          {/* ─── GRAPH ─── */}
          <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>

            {/* Toolbar */}
            <div style={{padding:'8px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:12}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {/*
                  FUTURE: Delspørsmålsfilter dropdown here
                  <Dropdown label="Alle delspørsmål" options={scopeData.subProblems} />
                  Placed left of tab-toggle. Same visual language as phase dropdown in portfolio.
                */}
                <div className="tab-toggle">
                  {[['all','Alle',null,counts.all],['null','Uvurdert','–',counts.null],['A','Kjernesak','A',counts.A],['B','Støttesak','B',counts.B],['C','Kontekstsak','C',counts.C]].map(([key,label,cat,count],i,arr)=>(
                    <React.Fragment key={key}>
                      <button onClick={()=>toggleCat(key)} className={`tab-btn ${isTabActive(key)?'active':''}`}>
                        {label}{cat&&<span className="tab-cat"> · {cat}</span>} ({count})
                      </button>
                      {i<arr.length-1&&<div className="tab-sep"/>}
                    </React.Fragment>
                  ))}
                </div>
                <button className={`toggle-btn ${showProvisions?'active':''}`} onClick={()=>setShowProvisions(!showProvisions)}>
                  {showProvisions?<Eye style={{width:11,height:11}}/>:<EyeOff style={{width:11,height:11}}/>} §
                </button>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span className="font-mono" style={{fontSize:10,color:'var(--ink-muted)',marginRight:8}}>{caseCount} saker · {provCount} best.{isolatedIds.size>0?` · ${isolatedIds.size} isolert`:''}</span>
                {/*
                  FUTURE: Kronologisk akse toggle
                  <button className="toggle-btn" onClick={toggleChronological}>Tid</button>
                */}
                <button className="toolbar-btn" onClick={zoomOut}><ZoomOut style={{width:14,height:14}}/></button>
                <button className="toolbar-btn" onClick={fitView}><Maximize style={{width:14,height:14}}/></button>
                <button className="toolbar-btn" onClick={zoomIn}><ZoomIn style={{width:14,height:14}}/></button>
              </div>
            </div>

            {/* SVG */}
            <svg ref={svgRef} style={{flex:1,width:'100%',cursor:'grab'}}
              onClick={()=>{setSelectedId(null);setContextMenu(null)}}
              onMouseDown={e=>{if(!e.target.closest('.graph-node'))e.currentTarget.style.cursor='grabbing'}}
              onMouseUp={e=>{e.currentTarget.style.cursor='grab'}}
            >
              <g ref={gRef}>
                {positions&&(
                  <>
                    {/* Edges */}
                    {visibleEdges.map((e,i)=>{
                      const sp=positions[e.source],tp=positions[e.target];
                      if(!sp||!tp) return null;
                      const isH=hoveredId&&isEdgeConn(e,hoveredId);
                      const isD=hoveredId&&!isH;
                      const isC=e.edgeType==='citation';
                      return <line key={`e${i}`} x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
                        stroke={isH?'var(--edge-highlight)':isC?'var(--edge-cite)':'var(--edge-color)'}
                        strokeWidth={isH?1.5:1} strokeDasharray={isC?'none':'3 3'}
                        opacity={isD?0.04:1} style={{transition:animating?'none':'opacity .2s ease,stroke .2s ease'}}/>;
                    })}

                    {/* Nodes */}
                    {allBaseNodes.map(n=>{
                      if(!visibleNodeIds.has(n.id)) return null;
                      const pos=positions[n.id];
                      if(!pos) return null;
                      const isHov=hoveredId===n.id, isSel=selectedId===n.id;
                      const isConn=hoveredId&&getConnected(hoveredId).has(n.id);
                      const isDim=hoveredId&&hoveredId!==n.id&&!isConn;
                      const isCCat=n.type==='case'&&n.category==='C';
                      const isIsolated=isolatedIds.has(n.id);
                      const markColor=nodeMarks[n.id];
                      const markHex=markColor?MARK_COLORS.find(c=>c.id===markColor)?.hex:null;

                      if(n.type==='case'){
                        const r=getDotR(n);
                        const catFill=n.category==='A'?'var(--ink)':'var(--paper)';
                        const catStroke=n.category==='A'?'var(--ink)':n.category==='B'?'var(--border-strong)':n.category==='C'?'var(--border)':'var(--ink-muted)';
                        const catDash=n.category===null?'2 2':'none';

                        return(
                          <g key={n.id} className="graph-node" transform={`translate(${pos.x},${pos.y})`}
                            onClick={e=>{e.stopPropagation();setSelectedId(isSel?null:n.id);setContextMenu(null)}}
                            onContextMenu={e=>handleContextMenu(e,n.id)}
                            onMouseEnter={()=>{setHoveredId(n.id);showTooltip(n.id,pos.x,pos.y-20)}}
                            onMouseLeave={()=>{setHoveredId(null);hideTooltip()}}
                            style={{opacity:isDim?0.08:isCCat&&!markHex?0.4:isIsolated&&!markHex?0.5:1,transition:animating?'none':'opacity .2s ease'}}
                          >
                            <rect x={-r-6} y={-r-6} width={170} height={r*2+36} fill="transparent"/>
                            {isSel&&<circle cx={0} cy={0} r={r+5} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 2"/>}
                            {/* User mark ring */}
                            {markHex&&<circle cx={0} cy={0} r={r+3} fill="none" stroke={markHex} strokeWidth={2.5}/>}
                            <circle cx={0} cy={0} r={r} fill={catFill} stroke={catStroke} strokeWidth={n.category==='A'?0:1.5} strokeDasharray={catDash}/>
                            {n.star&&<text x={r+3} y={-r+2} style={{fontSize:8,fill:'var(--gold-star)',fontFamily:'sans-serif'}}>★</text>}
                            {n.signals&&n.signals.map((sig,si)=>{
                              const sc=sig==='R'?'var(--ink-muted)':sig==='F'?'var(--signal-fts)':'var(--ai-accent)';
                              return <circle key={si} cx={-r+si*7} cy={r+10} r={2.5} fill={sc} opacity={0.7}/>;
                            })}
                            <text x={r+8} y={-1} style={{fontSize:11,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",fill:isHov||isSel?'var(--ink)':'var(--ink-secondary)',transition:'fill .15s ease'}}>{n.ref}</text>
                            <text x={r+8} y={11} style={{fontSize:10,fontFamily:"'Albert Sans',sans-serif",fill:'var(--ink-muted)'}}>{n.source} · {n.year}</text>
                            {n.citedBy>0&&<text x={0} y={r+24} textAnchor="middle" style={{fontSize:8,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",fill:'var(--ink-muted)'}}>↗{n.citedBy}</text>}
                            {/* Isolated indicator */}
                            {isIsolated&&<text x={r+8} y={23} style={{fontSize:9,fontFamily:"'Albert Sans',sans-serif",fill:'var(--ink-muted)',fontStyle:'italic'}}>isolert</text>}
                          </g>
                        );
                      } else {
                        const lw=n.ref.length*7.2+20;
                        return(
                          <g key={n.id} className="graph-node" transform={`translate(${pos.x},${pos.y})`}
                            onClick={e=>{e.stopPropagation();setSelectedId(isSel?null:n.id);setContextMenu(null)}}
                            onMouseEnter={()=>setHoveredId(n.id)} onMouseLeave={()=>setHoveredId(null)}
                            style={{opacity:isDim?0.08:1,transition:animating?'none':'opacity .2s ease'}}
                          >
                            {isSel&&<rect x={-lw/2-4} y={-15} width={lw+8} height={28} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="3 2" rx={3}/>}
                            <rect x={-lw/2} y={-11} width={lw} height={22} fill="var(--paper-dark)" stroke={isHov||isSel?'var(--border-strong)':'var(--border)'} strokeWidth={1} rx={2} style={{transition:'stroke .15s ease'}}/>
                            <rect x={-lw/2+6} y={-3} width={5} height={5} fill="var(--border-strong)" rx={1}/>
                            <text x={-lw/2+16} y={3} style={{fontSize:11,fontWeight:500,fontFamily:"'JetBrains Mono',monospace",fill:isHov||isSel?'var(--ink)':'var(--ink-tertiary)',transition:'fill .15s ease'}}>{n.ref}</text>
                          </g>
                        );
                      }
                    })}
                  </>
                )}
              </g>
            </svg>

            {/* Tooltip */}
            {tooltipInfo&&!selectedId&&(
              <div className="tooltip-box" style={{left:Math.min(tooltipInfo.x, window.innerWidth-280),top:tooltipInfo.y-70}}>
                <div className="font-mono" style={{fontSize:10,fontWeight:700,color:'var(--ink)',marginBottom:4}}>{tooltipInfo.ref}</div>
                <p className="font-serif" style={{fontSize:13,fontStyle:'italic',lineHeight:1.45,color:'var(--ai-accent)'}}>{tooltipInfo.text}</p>
              </div>
            )}

            {/* Context menu for marking */}
            {contextMenu&&(
              <div className="ctx-menu" style={{left:contextMenu.x,top:contextMenu.y}} onMouseDown={e=>e.stopPropagation()}>
                {MARK_COLORS.map(c=>(
                  <button key={c.id} className={`ctx-swatch ${nodeMarks[contextMenu.nodeId]===c.id?'active-swatch':''}`}
                    title={c.label}
                    onClick={e=>{e.stopPropagation();applyMark(contextMenu.nodeId,c.id)}}
                    style={{background:c.id==='none'?'var(--paper-dark)':c.hex,...(c.id==='none'?{border:'1px dashed var(--border-strong)'}:{})}}
                  >
                    {c.id==='none'&&<X style={{width:10,height:10,color:'var(--ink-muted)'}}/>}
                  </button>
                ))}
              </div>
            )}

            {/* Legend */}
            <div style={{position:'absolute',bottom:16,left:16,padding:legendOpen?'10px 14px 12px':'8px 14px',background:'var(--paper)',border:'1px solid var(--border)',borderRadius:3,fontFamily:"'Albert Sans',sans-serif",fontSize:10,color:'var(--ink-muted)',fontWeight:500,maxWidth:220}}>
              <button className="legend-toggle" onClick={()=>setLegendOpen(!legendOpen)} style={{marginBottom:legendOpen?8:0}}>
                <ChevronDown style={{width:10,height:10,transform:legendOpen?'rotate(0)':'rotate(-90deg)',transition:'transform .15s'}}/>
                Tegnforklaring
              </button>
              {legendOpen&&(
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="var(--ink)"/></svg><span>A — Kjernesak</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><svg width={10} height={10}><circle cx={5} cy={5} r={3.5} fill="var(--paper)" stroke="var(--border-strong)" strokeWidth={1.5}/></svg><span>B — Støttesak</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:8,opacity:.5}}><svg width={10} height={10}><circle cx={5} cy={5} r={3} fill="var(--paper)" stroke="var(--border)" strokeWidth={1}/></svg><span>C — Kontekstsak</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><svg width={10} height={10}><circle cx={5} cy={5} r={3} fill="var(--paper)" stroke="var(--ink-muted)" strokeWidth={1} strokeDasharray="2 2"/></svg><span>Uvurdert</span></div>
                  <div style={{borderTop:'1px solid var(--border-subtle)',paddingTop:5,marginTop:1}}/>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><svg width={18} height={2}><line x1={0} y1={1} x2={18} y2={1} stroke="var(--edge-cite)" strokeWidth={1}/></svg><span>Sitering</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><svg width={18} height={2}><line x1={0} y1={1} x2={18} y2={1} stroke="var(--edge-color)" strokeWidth={1} strokeDasharray="3 3"/></svg><span>Bestemmelsesref.</span></div>
                  <div style={{borderTop:'1px solid var(--border-subtle)',paddingTop:5,marginTop:1}}/>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{display:'flex',gap:3}}><svg width={5} height={5}><circle cx={2.5} cy={2.5} r={2.5} fill="var(--ink-muted)"/></svg><svg width={5} height={5}><circle cx={2.5} cy={2.5} r={2.5} fill="var(--signal-fts)"/></svg><svg width={5} height={5}><circle cx={2.5} cy={2.5} r={2.5} fill="var(--ai-accent)"/></svg></div>
                    <span>Søkesignaler R·F·V</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{color:'var(--gold-star)',fontSize:10,width:18,textAlign:'center'}}>★</span><span>Gullkandidat</span></div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}><span className="font-mono" style={{fontSize:8,width:18,textAlign:'center'}}>↗n</span><span>Siteringstakt</span></div>
                  {/* Active marks in legend */}
                  {Object.keys(markCounts).length>0&&(
                    <>
                      <div style={{borderTop:'1px solid var(--border-subtle)',paddingTop:5,marginTop:1}}/>
                      <div style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ink-muted)',marginBottom:2}}>Markeringer</div>
                      {Object.entries(markCounts).map(([cid,cnt])=>{
                        const mc=MARK_COLORS.find(c=>c.id===cid);
                        if(!mc) return null;
                        return(
                          <div key={cid} style={{display:'flex',alignItems:'center',gap:8}}>
                            <svg width={10} height={10}><circle cx={5} cy={5} r={4} fill="none" stroke={mc.hex} strokeWidth={2.5}/></svg>
                            <span>{mc.label} ({cnt})</span>
                          </div>
                        );
                      })}
                    </>
                  )}
                  <div style={{borderTop:'1px solid var(--border-subtle)',paddingTop:5,marginTop:1,fontStyle:'italic',color:'var(--ink-muted)',fontSize:9}}>Høyreklikk node → marker</div>
                </div>
              )}
            </div>
          </main>

          {/* ─── DETAIL PANEL ─── */}
          {selectedNode&&(
            <aside key={selectedNode.id} className="slide-in" style={{width:380,flexShrink:0,borderLeft:'1px solid var(--border)',display:'flex',flexDirection:'column',overflow:'hidden',zIndex:10}}>
              <header style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexShrink:0}}>
                <div style={{flex:1,paddingRight:12}}>
                  <div className="font-mono" style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--ink-muted)',marginBottom:8,display:'flex',alignItems:'center',gap:4}}>
                    <Network style={{width:11,height:11}}/>{selectedNode.type==='case'?'Sak':'Bestemmelse'}
                  </div>
                  <h2 className="font-mono" style={{fontSize:14,fontWeight:700,color:'var(--ink)',lineHeight:1.3}}>{selectedNode.ref}</h2>
                  <div className="font-sans" style={{fontSize:11,color:'var(--ink-tertiary)',marginTop:4}}>
                    {selectedNode.type==='case'?`${selectedNode.source} · ${selectedNode.year}`:selectedNode.label}
                  </div>
                </div>
                <button className="action-btn" style={{padding:4,border:'none',flexShrink:0}} onClick={()=>setSelectedId(null)}><X style={{width:16,height:16}}/></button>
              </header>

              <div style={{flex:1,overflowY:'auto',padding:'16px 20px 48px'}}>
                {selectedNode.type==='case'&&(
                  <>
                    <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:8,marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--border-subtle)'}}>
                      {selectedNode.category?(
                        <span className="font-mono" style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:2,...(selectedNode.category==='A'?{background:'var(--ink)',color:'var(--paper)'}:{border:'1px solid var(--border)',color:'var(--ink-tertiary)'})}}>{selectedNode.category} — {CAT_LABELS[selectedNode.category]}</span>
                      ):(<span className="font-mono" style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:2,border:'1px dashed var(--border-strong)',color:'var(--ink-muted)'}}>Uvurdert</span>)}
                      {selectedNode.star&&<span style={{display:'flex',alignItems:'center',gap:3,color:'var(--gold-star)'}}><Star style={{width:11,height:11,fill:'currentColor'}}/><span className="font-sans" style={{fontSize:10,fontWeight:600}}>Gullkandidat</span></span>}
                      {isolatedIds.has(selectedNode.id)&&<span className="font-sans" style={{fontSize:10,fontStyle:'italic',color:'var(--ink-muted)'}}>Isolert</span>}
                    </div>

                    <div style={{marginBottom:16}}>
                      <div className="font-sans" style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ink-muted)',marginBottom:8}}>Funnet via</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {selectedNode.signals.map((sig,i)=>{const m=SIGNAL_META[sig];return <span key={i} className="signal-chip" style={{color:m.color,background:m.bg,border:`1px solid ${m.border}`}}>[{sig}] {m.label}</span>;})}
                      </div>
                    </div>

                    <div style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--border-subtle)'}}>
                      <div className="font-mono" style={{fontSize:11,color:'var(--ink-tertiary)'}}>
                        {selectedNode.citedBy>0?<><span style={{fontWeight:700,color:'var(--ink)'}}>↗{selectedNode.citedBy}</span> siteringer · {getCitationRate(selectedNode).toFixed(1)}/år</>:'Ingen siteringer ennå'}
                      </div>
                    </div>

                    {selectedNode.proposition?(
                      <div style={{marginBottom:20}}>
                        <div className="font-sans" style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ai-accent)',display:'flex',alignItems:'center',gap:4,marginBottom:6}}><Sparkles style={{width:10,height:10}}/> KI-proposisjon</div>
                        <p className="font-serif" style={{fontSize:15,fontStyle:'italic',lineHeight:1.55,color:'var(--ai-accent)',borderLeft:'2px solid var(--ai-border)',paddingLeft:12}}>{selectedNode.proposition}</p>
                      </div>
                    ):(
                      <div style={{marginBottom:20,border:'1px dashed var(--ai-border)',padding:16,borderRadius:3,textAlign:'center'}}>
                        <Sparkles style={{width:16,height:16,color:'var(--ai-accent)',opacity:.5,margin:'0 auto 6px'}}/>
                        <div className="font-sans" style={{fontSize:11,color:'var(--ink-muted)'}}>Ikke screenet</div>
                      </div>
                    )}

                    {(()=>{const out=getCitesFrom(selectedNode.id);if(!out.length)return null;return(
                      <div style={{marginBottom:20}}>
                        <div className="font-sans" style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ink-muted)',marginBottom:8}}>Siterer ({out.length})</div>
                        {out.map(id=>{const nd=allBaseNodes.find(n=>n.id===id);if(!nd)return null;const mc=nodeMarks[id];const mh=mc?MARK_COLORS.find(c=>c.id===mc)?.hex:null;return(
                          <div key={id} className="detail-row" onClick={()=>setSelectedId(id)}>
                            {mh&&<div style={{width:8,height:8,borderRadius:'50%',border:`2px solid ${mh}`,flexShrink:0}}/>}
                            {nd.category&&<span className="font-mono" style={{fontSize:9,fontWeight:700,width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:2,flexShrink:0,...(nd.category==='A'?{background:'var(--ink)',color:'var(--paper)'}:{border:'1px solid var(--border)',color:'var(--ink-muted)'})}}>{nd.category}</span>}
                            <span className="font-mono" style={{fontSize:11,fontWeight:600,color:'var(--ink)'}}>{nd.ref}</span>
                            <span className="font-sans" style={{fontSize:10,color:'var(--ink-muted)',marginLeft:'auto'}}>{nd.year}</span>
                            <ChevronRight style={{width:10,height:10,color:'var(--ink-muted)',flexShrink:0}}/>
                          </div>
                        );})}
                      </div>
                    );})()}

                    {(()=>{const inc=getCitedByL(selectedNode.id);if(!inc.length)return null;return(
                      <div style={{marginBottom:20}}>
                        <div className="font-sans" style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ink-muted)',marginBottom:8}}>Sitert av ({inc.length})</div>
                        {inc.map(id=>{const nd=allBaseNodes.find(n=>n.id===id);if(!nd)return null;const mc=nodeMarks[id];const mh=mc?MARK_COLORS.find(c=>c.id===mc)?.hex:null;return(
                          <div key={id} className="detail-row" onClick={()=>setSelectedId(id)}>
                            {mh&&<div style={{width:8,height:8,borderRadius:'50%',border:`2px solid ${mh}`,flexShrink:0}}/>}
                            {nd.category&&<span className="font-mono" style={{fontSize:9,fontWeight:700,width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:2,flexShrink:0,...(nd.category==='A'?{background:'var(--ink)',color:'var(--paper)'}:{border:'1px solid var(--border)',color:'var(--ink-muted)'})}}>{nd.category}</span>}
                            <span className="font-mono" style={{fontSize:11,fontWeight:600,color:'var(--ink)'}}>{nd.ref}</span>
                            <span className="font-sans" style={{fontSize:10,color:'var(--ink-muted)',marginLeft:'auto'}}>{nd.year}</span>
                            <ChevronRight style={{width:10,height:10,color:'var(--ink-muted)',flexShrink:0}}/>
                          </div>
                        );})}
                      </div>
                    );})()}

                    {(()=>{const prefs=getProvRefs(selectedNode.id).map(id=>allBaseNodes.find(n=>n.id===id)).filter(Boolean);if(!prefs.length)return null;return(
                      <div style={{marginBottom:20}}>
                        <div className="font-sans" style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ink-muted)',marginBottom:8}}>Refererer til</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                          {prefs.map(p=><span key={p.id} className="font-mono" onClick={()=>setSelectedId(p.id)} style={{fontSize:11,color:'var(--ink-tertiary)',background:'var(--paper-dark)',border:'1px solid var(--border)',padding:'2px 8px',borderRadius:2,cursor:'pointer'}}>{p.ref}</span>)}
                        </div>
                      </div>
                    );})()}

                    <div style={{marginTop:8,paddingTop:16,borderTop:'1px solid var(--border-subtle)',display:'flex',flexDirection:'column',gap:8}}>
                      <button className="action-btn" style={{width:'100%',justifyContent:'center',padding:'8px 16px'}}>
                        <ExternalLink style={{width:12,height:12}}/> Åpne i lesevisning
                      </button>
                      {/*
                        FUTURE: Kryssnavigasjon
                        <button className="action-btn" onClick={() => navigateToPerspective('list', selectedNode.id)}>
                          <List style={{width:12,height:12}}/> Vis i Saksoversikten
                        </button>
                        <button className="action-btn" onClick={() => navigateToPerspective('rettssetninger', selectedNode.id)}>
                          <BookOpen style={{width:12,height:12}}/> Vis i Rettssetninger
                        </button>
                        Requires: shared state via context/parent + scroll-into-view in target perspective.
                      */}
                    </div>
                  </>
                )}

                {selectedNode.type==='provision'&&(
                  <div>
                    <div className="font-sans" style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--ink-muted)',marginBottom:8}}>Referert i {getCasesForProv(selectedNode.id).length} saker</div>
                    {getCasesForProv(selectedNode.id).map(id=>{const nd=allBaseNodes.find(n=>n.id===id);if(!nd)return null;const mc=nodeMarks[id];const mh=mc?MARK_COLORS.find(c=>c.id===mc)?.hex:null;return(
                      <div key={id} className="detail-row" onClick={()=>setSelectedId(id)}>
                        {mh&&<div style={{width:8,height:8,borderRadius:'50%',border:`2px solid ${mh}`,flexShrink:0}}/>}
                        {nd.category&&<span className="font-mono" style={{fontSize:9,fontWeight:700,width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:2,flexShrink:0,...(nd.category==='A'?{background:'var(--ink)',color:'var(--paper)'}:{border:'1px solid var(--border)',color:'var(--ink-muted)'})}}>{nd.category}</span>}
                        <span className="font-mono" style={{fontSize:11,fontWeight:600,color:'var(--ink)'}}>{nd.ref}</span>
                        <span className="font-sans" style={{fontSize:10,color:'var(--ink-muted)',marginLeft:'auto'}}>{nd.year}</span>
                        <ChevronRight style={{width:10,height:10,color:'var(--ink-muted)',flexShrink:0}}/>
                      </div>
                    );})}
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}

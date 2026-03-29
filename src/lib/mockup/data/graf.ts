/**
 * Mockdata for grafvisning (nettverkskart).
 * Hardkodet — ingen backend.
 *
 * Data fra paragraf-graf-v4.jsx, strukturelt realistisk norsk KOFA-data.
 */

export type SignalType = 'R' | 'F' | 'V';
export type MockCategory = 'A' | 'B' | 'C' | null;

export interface CaseNode {
  id: string;
  type: 'case';
  ref: string;
  source: string;
  year: number;
  category: MockCategory;
  star: boolean;
  citedBy: number;
  signals: SignalType[];
  proposition: string | null;
}

export interface ProvisionNode {
  id: string;
  type: 'provision';
  ref: string;
  label: string;
}

export type GraphNode = CaseNode | ProvisionNode;

export interface GraphEdge {
  source: string;
  target: string;
  edgeType: 'citation' | 'reference';
}

export interface MarkColor {
  id: string;
  hex: string;
  label: string;
}

export const CURRENT_YEAR = 2026;

export const PROBLEM =
  'Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11?';

export const CASE_NODES: CaseNode[] = [
  { id: 'k1',  type: 'case', ref: 'KOFA-2016-104',  source: 'Klagenemnda',  year: 2016, category: 'A', star: false, citedBy: 5,  signals: ['R', 'F'],      proposition: 'Felles innlevering etablerer solidaransvar uten formell selskapsavtale.' },
  { id: 'k2',  type: 'case', ref: 'KOFA-2022-1200', source: 'Klagenemnda',  year: 2022, category: 'A', star: true,  citedBy: 3,  signals: ['R', 'F', 'V'], proposition: 'Solidaransvar forutsettes ved leverandørgruppering. Samarbeidsavtale kan kreves ved kontraktsignering.' },
  { id: 'k3',  type: 'case', ref: 'HR-2019-1801-A',  source: 'Høyesterett',  year: 2019, category: 'A', star: true,  citedBy: 8,  signals: ['F', 'V'],      proposition: 'Selskapsrettslig status for midlertidige konsortier må vurderes konkret.' },
  { id: 'k4',  type: 'case', ref: 'C-396/14',        source: 'EU-domstolen', year: 2014, category: 'A', star: true,  citedBy: 12, signals: ['V'],            proposition: 'En sammenslutning kan støtte seg på kapasiteten til de enkelte medlemmene.' },
  { id: 'k9',  type: 'case', ref: 'KOFA-2024-88',    source: 'Klagenemnda',  year: 2024, category: 'A', star: true,  citedBy: 0,  signals: ['R', 'F', 'V'], proposition: 'Solidaransvar kan ikke fravikes i konkurransegrunnlaget — ufravikelig.' },
  { id: 'k10', type: 'case', ref: 'C-324/14',        source: 'EU-domstolen', year: 2014, category: 'A', star: false, citedBy: 6,  signals: ['V'],            proposition: 'Proporsjonalitetskrav ved vurdering av sammenslutningers kapasitet.' },
  { id: 'k14', type: 'case', ref: 'KOFA-2023-410',   source: 'Klagenemnda',  year: 2023, category: 'A', star: false, citedBy: 1,  signals: ['R', 'V'],      proposition: 'Krav om juridisk form kan ikke stilles før tildeling.' },
  { id: 'k5',  type: 'case', ref: 'KOFA-2020-55',    source: 'Klagenemnda',  year: 2020, category: 'B', star: false, citedBy: 2,  signals: ['R'],            proposition: 'Grensen mellom støtte på kapasitet og underleverandør.' },
  { id: 'k6',  type: 'case', ref: 'KOFA-2021-312',   source: 'Klagenemnda',  year: 2021, category: 'B', star: false, citedBy: 1,  signals: ['R', 'V'],      proposition: 'Forpliktelseserklæring utilstrekkelig for nøkkelpersonell.' },
  { id: 'k7',  type: 'case', ref: 'KOFA-2019-445',   source: 'Klagenemnda',  year: 2019, category: 'B', star: false, citedBy: 3,  signals: ['R', 'F'],      proposition: 'Underleverandørens rolle ved felles tilbud.' },
  { id: 'k8',  type: 'case', ref: 'KOFA-2017-147',   source: 'Klagenemnda',  year: 2017, category: 'B', star: false, citedBy: 4,  signals: ['R'],            proposition: 'Innhold og form på forpliktelseserklæring.' },
  { id: 'k15', type: 'case', ref: 'KOFA-2020-789',   source: 'Klagenemnda',  year: 2020, category: 'B', star: false, citedBy: 1,  signals: ['F', 'V'],      proposition: 'Oppdragsgivers skjønn ved vurdering av samarbeidsavtale.' },
  { id: 'k16', type: 'case', ref: 'KOFA-2018-233',   source: 'Klagenemnda',  year: 2018, category: 'B', star: false, citedBy: 2,  signals: ['R'],            proposition: 'Tidspunktet for fremleggelse av forpliktelseserklæring.' },
  { id: 'k17', type: 'case', ref: 'C-27/15',         source: 'EU-domstolen', year: 2016, category: 'B', star: false, citedBy: 4,  signals: ['V'],            proposition: 'Underleverandørs rett til å bli vurdert selvstendig.' },
  { id: 'k11', type: 'case', ref: 'KOFA-2018-12',    source: 'Klagenemnda',  year: 2018, category: 'C', star: false, citedBy: 0,  signals: ['F'],            proposition: 'Privatrettslig samarbeidsavtale utenfor nemndas kompetanse.' },
  { id: 'k18', type: 'case', ref: 'KOFA-2017-650',   source: 'Klagenemnda',  year: 2017, category: 'C', star: false, citedBy: 0,  signals: ['F'],            proposition: 'Omhandler samarbeid, men i annet rettsområde.' },
  { id: 'k19', type: 'case', ref: 'KOFA-2015-88',    source: 'Klagenemnda',  year: 2015, category: 'C', star: false, citedBy: 1,  signals: ['R'],            proposition: 'Generell avvisningshjemmel, perifert relevant.' },
  { id: 'k20', type: 'case', ref: 'KOFA-2022-401',   source: 'Klagenemnda',  year: 2022, category: 'C', star: false, citedBy: 0,  signals: ['V'],            proposition: 'Konseptuelt nært men gjelder annen kontraktstype.' },
  { id: 'k12', type: 'case', ref: 'KOFA-2023-999',   source: 'Klagenemnda',  year: 2023, category: null, star: false, citedBy: 0, signals: ['R', 'V'],      proposition: null },
  { id: 'k13', type: 'case', ref: 'KOFA-2025-44',    source: 'Klagenemnda',  year: 2025, category: null, star: false, citedBy: 0, signals: ['V'],            proposition: null },
];

export const PROVISION_NODES: ProvisionNode[] = [
  { id: 'p1', type: 'provision', ref: 'FOA §16-11', label: 'Leverandørgrupperinger' },
  { id: 'p2', type: 'provision', ref: 'FOA §16-10', label: 'Støtte på kapasitet' },
  { id: 'p3', type: 'provision', ref: 'FOA §19-2',  label: 'Underleverandører' },
  { id: 'p4', type: 'provision', ref: 'FOA §24-2',  label: 'Avvisning' },
  { id: 'p5', type: 'provision', ref: 'FOA §5-1',   label: 'Grunnprinsipper' },
  { id: 'p6', type: 'provision', ref: 'LOA §4',     label: 'Likebehandling' },
];

export const ALL_NODES: GraphNode[] = [...CASE_NODES, ...PROVISION_NODES];

export const CASE_CITATIONS: GraphEdge[] = [
  { source: 'k2',  target: 'k1',  edgeType: 'citation' },
  { source: 'k9',  target: 'k2',  edgeType: 'citation' },
  { source: 'k9',  target: 'k1',  edgeType: 'citation' },
  { source: 'k6',  target: 'k4',  edgeType: 'citation' },
  { source: 'k5',  target: 'k4',  edgeType: 'citation' },
  { source: 'k7',  target: 'k5',  edgeType: 'citation' },
  { source: 'k8',  target: 'k4',  edgeType: 'citation' },
  { source: 'k2',  target: 'k3',  edgeType: 'citation' },
  { source: 'k6',  target: 'k10', edgeType: 'citation' },
  { source: 'k8',  target: 'k5',  edgeType: 'citation' },
  { source: 'k12', target: 'k9',  edgeType: 'citation' },
  { source: 'k5',  target: 'k10', edgeType: 'citation' },
  { source: 'k14', target: 'k2',  edgeType: 'citation' },
  { source: 'k14', target: 'k1',  edgeType: 'citation' },
  { source: 'k15', target: 'k1',  edgeType: 'citation' },
  { source: 'k15', target: 'k7',  edgeType: 'citation' },
  { source: 'k16', target: 'k8',  edgeType: 'citation' },
  { source: 'k16', target: 'k4',  edgeType: 'citation' },
  { source: 'k7',  target: 'k17', edgeType: 'citation' },
  { source: 'k6',  target: 'k17', edgeType: 'citation' },
  { source: 'k19', target: 'k1',  edgeType: 'citation' },
  { source: 'k13', target: 'k14', edgeType: 'citation' },
  { source: 'k9',  target: 'k14', edgeType: 'citation' },
  { source: 'k20', target: 'k2',  edgeType: 'citation' },
  { source: 'k11', target: 'k2',  edgeType: 'citation' },
];

export const PROVISION_REFS: GraphEdge[] = [
  { source: 'k1',  target: 'p1', edgeType: 'reference' },
  { source: 'k2',  target: 'p1', edgeType: 'reference' },
  { source: 'k9',  target: 'p1', edgeType: 'reference' },
  { source: 'k12', target: 'p1', edgeType: 'reference' },
  { source: 'k3',  target: 'p1', edgeType: 'reference' },
  { source: 'k14', target: 'p1', edgeType: 'reference' },
  { source: 'k11', target: 'p1', edgeType: 'reference' },
  { source: 'k5',  target: 'p2', edgeType: 'reference' },
  { source: 'k6',  target: 'p2', edgeType: 'reference' },
  { source: 'k8',  target: 'p2', edgeType: 'reference' },
  { source: 'k4',  target: 'p2', edgeType: 'reference' },
  { source: 'k10', target: 'p2', edgeType: 'reference' },
  { source: 'k16', target: 'p2', edgeType: 'reference' },
  { source: 'k15', target: 'p2', edgeType: 'reference' },
  { source: 'k7',  target: 'p3', edgeType: 'reference' },
  { source: 'k17', target: 'p3', edgeType: 'reference' },
  { source: 'k5',  target: 'p4', edgeType: 'reference' },
  { source: 'k19', target: 'p4', edgeType: 'reference' },
  { source: 'k10', target: 'p5', edgeType: 'reference' },
  { source: 'k3',  target: 'p5', edgeType: 'reference' },
  { source: 'k10', target: 'p6', edgeType: 'reference' },
];

export const ALL_EDGES: GraphEdge[] = [...CASE_CITATIONS, ...PROVISION_REFS];

export const MARK_COLORS: MarkColor[] = [
  { id: 'none',     hex: 'transparent', label: 'Fjern' },
  { id: 'rose',     hex: '#D4727E',     label: 'Rosa' },
  { id: 'teal',     hex: '#5AA3A3',     label: 'Turkis' },
  { id: 'amber',    hex: '#C4933A',     label: 'Oransje' },
  { id: 'lilac',    hex: '#9A7EB8',     label: 'Lavendel' },
  { id: 'sage',     hex: '#7BA37B',     label: 'Salvie' },
];

export const SIGNAL_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  R: { label: 'Referanse', color: 'var(--ink-muted)',  bg: 'var(--paper-dark)',    border: 'var(--border)' },
  F: { label: 'Ordtreff',  color: 'var(--signal-fts)', bg: 'var(--signal-fts-bg)', border: 'var(--signal-fts-border)' },
  V: { label: 'Konsept',   color: 'var(--ai-accent)',  bg: 'var(--ai-bg)',         border: 'var(--ai-border)' },
};

export const CAT_LABELS: Record<string, string> = {
  A: 'Kjernesak',
  B: 'Støttesak',
  C: 'Kontekstsak',
};

// ── Utilities ──

export function getCitationRate(n: CaseNode): number {
  return n.citedBy / Math.max(1, CURRENT_YEAR - n.year);
}

const maxCR = Math.max(...CASE_NODES.map(getCitationRate), 0.01);

export function getDotRadius(n: GraphNode): number {
  if (n.type !== 'case') return 0;
  return 4 + (getCitationRate(n) / maxCR) * 6;
}

export function getCatRadius(n: GraphNode): number {
  if (n.type === 'provision') return 160;
  if (n.type === 'case') {
    if (n.category === 'A') return 0;
    if (n.category === 'B') return 170;
  }
  return 280;
}

export function getConnectedIds(nodeId: string): Set<string> {
  const ids = new Set<string>();
  ALL_EDGES.forEach((e) => {
    if (e.source === nodeId) ids.add(e.target);
    if (e.target === nodeId) ids.add(e.source);
  });
  return ids;
}

export function getCitesFrom(nodeId: string): string[] {
  return CASE_CITATIONS.filter((e) => e.source === nodeId).map((e) => e.target);
}

export function getCitedBy(nodeId: string): string[] {
  return CASE_CITATIONS.filter((e) => e.target === nodeId).map((e) => e.source);
}

export function getProvisionRefs(nodeId: string): string[] {
  return PROVISION_REFS.filter((e) => e.source === nodeId).map((e) => e.target);
}

export function getCasesForProvision(provId: string): string[] {
  return PROVISION_REFS.filter((e) => e.target === provId).map((e) => e.source);
}

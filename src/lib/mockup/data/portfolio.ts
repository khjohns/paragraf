/**
 * Mockdata for porteføljeoversikten.
 * Realistisk norsk anskaffelsesrett — hardkodet, ingen backend.
 */

export interface MockAnalysisSummary {
  id: string;
  title: string;
  problem: string;
  status: MockStatus;
  iteration: number;
  provisions: string[];
  candidate_count: number;
  read_count: number;
  screened_count: number;
  updated_at: string;
  tensions: number;
  gaps: number;
  propositions: number;
}

export type MockStatus =
  | 'scoping'
  | 'candidates_ready'
  | 'screening'
  | 'post_search'
  | 'synthesis'
  | 'complete';

export const STATUS_META: Record<MockStatus, { label: string; color: string }> = {
  scoping: { label: 'Oppsett', color: '#B0A99E' },
  candidates_ready: { label: 'Primærsøk', color: '#4A6670' },
  screening: { label: 'Screening', color: '#8B6914' },
  post_search: { label: 'Ettersøk', color: '#A67B2E' },
  synthesis: { label: 'Sammenstilling', color: '#3D7A4A' },
  complete: { label: 'Ferdig', color: '#3D7A4A' },
};

export const MOCK_ANALYSES: MockAnalysisSummary[] = [
  {
    id: 'a1',
    title: 'FOA §16-11 — Leverandørgrupperinger og konsortier',
    problem:
      'Hvilke krav bør konkurransegrunnlaget stille til leverandørgrupperinger og konsortier, jf. FOA § 16-11?',
    status: 'screening',
    iteration: 2,
    provisions: ['FOA §16-11', 'FOA §16-10', 'FOA §19-2'],
    candidate_count: 48,
    read_count: 12,
    screened_count: 25,
    updated_at: '2026-03-29T11:42:00Z',
    tensions: 1,
    gaps: 3,
    propositions: 4,
  },
  {
    id: 'a2',
    title: 'FOA §8-4 — Avvisningsplikt ved vesentlige avvik',
    problem:
      'Hvor går grensen mellom avvik som skal føre til avvisning og avvik som kan aksepteres?',
    status: 'candidates_ready',
    iteration: 1,
    provisions: ['FOA §8-4', 'FOA §24-8', 'LOA §5'],
    candidate_count: 23,
    read_count: 4,
    screened_count: 6,
    updated_at: '2026-03-28T16:30:00Z',
    tensions: 0,
    gaps: 2,
    propositions: 1,
  },
  {
    id: 'a3',
    title: 'FOA §7-9 — Tildelingskriterier og evalueringsmodeller',
    problem: 'Hvilke rammer gjelder for oppdragsgivers valg av evalueringsmodell?',
    status: 'scoping',
    iteration: 0,
    provisions: ['FOA §7-9', 'FOA §18-1', 'LOA §5'],
    candidate_count: 0,
    read_count: 0,
    screened_count: 0,
    updated_at: '2026-03-26T09:15:00Z',
    tensions: 0,
    gaps: 0,
    propositions: 0,
  },
  {
    id: 'a4',
    title: 'FOA §24-2 — Avlysning av konkurranse',
    problem: 'Vilkår for lovlig avlysning og erstatningsrettslige konsekvenser.',
    status: 'synthesis',
    iteration: 3,
    provisions: ['FOA §24-2', 'FOA §10-1', 'LOA §5'],
    candidate_count: 15,
    read_count: 15,
    screened_count: 15,
    updated_at: '2026-03-29T09:00:00Z',
    tensions: 2,
    gaps: 0,
    propositions: 7,
  },
];

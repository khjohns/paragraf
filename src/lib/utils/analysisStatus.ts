import type { AnalysisStatus } from '$lib/types/analysis';

export const STATUS_META: Record<AnalysisStatus, { label: string; color: string }> = {
  scoping: { label: 'Oppsett', color: '#B0A99E' },
  scoping_complete: { label: 'Oppsett', color: '#B0A99E' },
  searching: { label: 'Primærsøk', color: '#4A6670' },
  candidates_ready: { label: 'Primærsøk', color: '#4A6670' },
  screening: { label: 'Screening', color: '#8B6914' },
  screening_complete: { label: 'Screening', color: '#8B6914' },
  post_search: { label: 'Ettersøk', color: '#A67B2E' },
  synthesis: { label: 'Sammenstilling', color: '#3D7A4A' },
  qa: { label: 'QA', color: '#3D7A4A' },
  complete: { label: 'Ferdig', color: '#3D7A4A' },
};

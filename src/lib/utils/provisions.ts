/** Law name → standard abbreviation */
const ABBREV: Record<string, string> = {
  anskaffelsesforskriften: 'FOA',
  anskaffelsesloven: 'LOA',
  klagenemndsforskriften: 'KNFR',
  forsyningsforskriften: 'FF',
  forvaltningsloven: 'FVL',
  offentleglova: 'OFFL',
  tvisteloven: 'TVL',
  konsesjonskontraktforskriften: 'KKF',
  konkurranseloven: 'KKRL',
  straffeloven: 'STRL',
  avtaleloven: 'AVTL',
  sikkerhetsloven: 'SIKL',
};

/** Abbreviation (lowercase) → full law name */
const FULL_NAME: Record<string, string> = {};
for (const [full, abbr] of Object.entries(ABBREV)) {
  FULL_NAME[abbr.toLowerCase()] = full;
}

/** Display "anskaffelsesforskriften:16-10" as "FOA §16-10" */
export function formatProvision(id: string): string {
  const [law, section] = id.split(':', 2);
  // Try canonical name first, then abbreviation lookup (handles "foa:16-10")
  const abbr = ABBREV[law] ?? ABBREV[FULL_NAME[law.toLowerCase()]] ?? law.toUpperCase();
  return section ? `${abbr} §${section}` : abbr;
}

/**
 * Parse user input in various formats to internal "lawname:section":
 * - "FOA § 16-10", "FOA §16-10", "FOA 16-10"
 * - "anskaffelsesforskriften § 16-10", "anskaffelsesforskriften:16-10"
 */
export function parseProvisionInput(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Already in canonical format: "lawname:section" (no § present)
  if (s.includes(':') && !s.includes('§')) {
    return s.toLowerCase();
  }

  // Split on §, :, or whitespace to find law part and section part
  const match = s.match(/^(.+?)[\s:]*§?\s*(\d[\d\w-]*)$/);
  if (!match) return null;

  const lawPart = match[1].trim().toLowerCase();
  const section = match[2].trim();

  const fullName = FULL_NAME[lawPart] ?? lawPart;
  return `${fullName}:${section}`;
}

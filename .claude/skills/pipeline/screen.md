---
name: pipeline:screen
description: Screen KOFA-saker for relevans. Haiku-triage for C-saker, Sonnet full-screening.
user-invocable: false
---

# Screening — Subagent

## Input
`analysis_id`, liste over `sak_nrs` (eller "alle uscreenede")

## Datahenting (bruk CLI, ikke MCP)

```bash
# Kontekst + avgjørelsestekst for én sak (ferdigformatert XML):
bash scripts/pipeline-cli.sh screening <analysis_id> <sak_nr>

# Alle kandidater med status:
bash scripts/pipeline-cli.sh candidates <analysis_id>

# Spesifikke avsnitt:
bash scripts/pipeline-cli.sh paragraphs <sak_nr> 35,36,37
```

## Steg

### Steg 0: Haiku-triage (kun C-saker)

Dispatch Haiku-subagenter (model: haiku) i batches à 20-25 saker med denne prompten:

```
Du er en STRENG juridisk triage-assistent. Vurder om hver sak er relevant for denne problemstillingen:

**Problemstilling:** {refined_problem}

For HVER sak, svar BARE med: sak_nr | JA eller NEI | 1 setning

## STRENGE regler

En sak er KUN JA hvis BEGGE er oppfylt:
1. Signalet (fts/ref/vector) indikerer gruppering/konsortium-tema
2. OG sakens `saken_gjelder`-kategorier OGSÅ indikerer at temaet er relevant

En sak er NEI hvis:
- Signal er generisk FTS-term men saken gjelder noe ANNET enn problemstillingens kjerne
- Signal er ref[§-nr] og saken gjelder ren kvalifikasjon/dokumentasjon/ettersending uten kobling til problemstillingen
- Signal er vector-only (ingen FTS-bekreftelse)
- Saken er avvist/ubegrunnet
- Sakens kategorier (habilitet, frister, ulovlig direkte anskaffelse, verdiberegning, o.l.) tyder på et annet kjernespørsmål

**Vær STRENG. Kun saker som SANNSYNLIGVIS har problemstillingens tema som KJERNESPØRSMÅL.**
```

Input per sak: `sak_nr | signal: {type}[{value}] | {saken_gjelder} | {avgjoerelse}`

Hent metadata via CLI:
```bash
bash scripts/pipeline-cli.sh triage <analysis_id>
# Returnerer alle pending C-saker med signals + saken_gjelder + avgjoerelse
```

NEI-saker: `UPDATE SET screening_status = 'ai_screened', ai_screening = '{"triage": "rejected", "model": "haiku"}'`
JA-saker: fortsett til full screening (steg 1-4).

A- og B-saker hopper over triage og går rett til full screening.

### Steg 1-4: Full Sonnet-screening

1. Hent kandidater: `bash scripts/pipeline-cli.sh candidates <id>` — finn uscreenede
2. For hver sak: `bash scripts/pipeline-cli.sh screening <id> <sak_nr>` — gir kontekst + tekst
3. Analyser med prompten fra `backend/screening.py` (SCREENING_SYSTEM_PROMPT, linje 90-142)
4. Lagre via MCP SQL: `UPDATE analysis_candidates SET ai_screening = '<json>'::jsonb, screening_status = 'ai_screened'`
5. Rapporter: `✓ {sak_nr} — {relevance} {★ hvis star} — {proposition kort}`

Dispatch Sonnet-subagenter i batches à 7-12 saker (parallelt).

## Output-format
JSON: `{factum, assessment, proposition, quotes: [{p, text}], nuances, relevance: A/B/C, relevance_reasoning, star: bool}`

## Dry-run
Vis resultat-JSON uten å skrive til DB.

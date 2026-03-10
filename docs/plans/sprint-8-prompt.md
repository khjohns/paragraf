# Sprint 8 — Handover Prompt

Kopier dette til en ny Claude Code-instans.

---

## Kontekst

Paragraf er et juridisk rettskildeanalyseverktøy (SvelteKit 2, Svelte 5, Tailwind v4, D3/dagre graf, Python Flask backend, Supabase).

- **Designspec:** `docs/design/paragraf-designspesifikasjon.md` (1478 linjer, 35 seksjoner)
- **Status:** `docs/plans/status-checklist.md` — Fase 1 ~90%, Fase 2 ~30%
- **Tidligere sprints:** `docs/plans/sprint-{1..7}-plan.md`
- **Memory:** `.claude/projects/-Users-kasper-Projects-paragraf/memory/MEMORY.md`

Les status-checklist og MEMORY.md først.

## Sprint 8 — Mål

Avslutt Fase 1 MVP og start Fase 2 AI-verktøy. To deler:

### Del A: Fase 1 avrunding (nodedetaljer + UX)

1. **ProvisionDetail** (§10) — Høyrepanel for bestemmelser: vis lovtekst, direktivgrunnlag, referansesaker. Backend har `/api/provisions/:dok_id/:section_id`. Sjekk NodeDetail.svelte for eksisterende provision-håndtering.

2. **EU-dom detaljer** (§10) — Høyrepanel for EU-dommer: partsnavn størst, direktivartikkel-kobling. Data finnes i `kofa_eu_references` + `kofa_eu_case_law` tabeller.

3. **Forarbeid-detaljer** (§10) — Høyrepanel for forarbeider: proposisjonsnummer, relevant seksjon. Data i `kofa_forarbeider_sections`.

4. **Lastetilstand for AI-kuratering** — Pulserende gullbrun venstekant mens AI-kuratering genereres. CaseReader.svelte har allerede kuraterings-fetch.

5. **Tastatursnarveier** (§32) — ↓/↑ navigasjon i liste, M (marker lest), R (les avgjørelsen), Esc (lukk panel). Global keyboard handler.

### Del B: Fase 2 start — Lag 1 deterministiske verktøy (§19)

6. **Vektor-seed fra problemstilling** — Når bruker skriver problemstilling, auto-generer vektor-query. Backend: bruk problemstillingstekst som embedding-input for `search_kofa_decision_text` RPC.

7. **Forslag til relevante bestemmelser** — Basert på treff, foreslå bestemmelser brukeren ikke har valgt som seeds. Vis som chips med stiplet ramme under seed-input.

## Kvalitetsprosess

1. Skriv sprint-plan til `docs/plans/sprint-8-plan.md` FØR implementering
2. Verifiser Supabase RPC-funksjoner med MCP før bruk
3. Kjør `simplify` etter hver oppgave
4. Verifiser i nettleser med Playwright
5. Bruk `superpowers:subagent-driven-development` for parallelle oppgaver

## Viktige konvensjoner

- Svelte 5 runes (`$state`, `$derived`, `$effect`), IKKE stores
- @tanstack/svelte-query v6 med thunk-syntax
- Design tokens fra spec §17 (warm paper palette)
- Backend på port 5002, frontend Vite dev på 5173
- DB-tekst er umarkert, AI-tekst har gullbrun venstekant (trust boundary)
- Dimming = 20% opacity, ikke fjerning
- Kanter peker case→provision i DB

# Kvalitetssikring — Guidet analyse-implementering

**Dato:** 2026-03-15 (oppdatert)
**Referanser:** `docs/plans/guidet-analyse-overordnet-plan.md`, `docs/design/paragraf-guidet-analyse.md`, `docs/adr/001-anthropic-api-optimalisering.md`

---

## Bakgrunn

Alle sprints (10–16) fra den overordnede planen er implementert. Denne planen dekker kvalitetssikring på tre akser:

1. **Funksjonell QA** — fungerer alle steg i den guidede analyseprosessen som designet?
2. **Svelte 5 QA** — følger koden Svelte 5 runes-konvensjoner korrekt?
3. **Anthropic API QA** — brukes API-et optimalt mht. kostnad, pålitelighet og kvalitet?

---

## Status

### Fase 1: Bygg og typesjekk — ✅ Fullført

`svelte-check`: **0 feil, 0 advarsler** (ned fra 15 advarsler).

Gjennomførte endringer:
- `GraphView.svelte`: `svgEl` endret til `$state`, non-null assertion i cleanup
- `LeftPanel.svelte`: Fjernet ubrukt `.iter-info` CSS, refaktorert klikkbar gap-rad til `<button>`
- `ChatDrawer.svelte`: Strukturell a11y-fiks — imperative `addEventListener` via `$effect` for klikk-delegering
- `NodeRow.svelte`: `role="button" tabindex="0"` på klikkbar rad, `role="group"` på assign-toggle
- `ScopingOverlay.svelte`: `aria-label` på redigerknapp, `role="button" tabindex="0"` på klikkbar field-value
- `NodeDetail.svelte`, `Portfolio.svelte`, `PortfolioDetail.svelte`: `aria-label` på lukk/tøm-knapper
- `CaseReader.svelte`: `svelte-ignore a11y_no_noninteractive_tabindex`
- `LeftPanelSection.svelte`: `svelte-ignore state_referenced_locally`

### Fase 2: Svelte 5 dybde-QA — ✅ Fullført

Gjennomførte endringer:
- `analysis.svelte.ts`: `import { browser }` erstatter `typeof window !== 'undefined'`
- `LeftPanel.svelte`: `analysisState.clearFilterIteration()` erstatter direkte store-mutasjon

Verifisert OK (ingen endring nødvendig):
- `$state.snapshot()`: Ikke nødvendig — `JSON.stringify()` fungerer med Svelte 5 proxies
- `$effect()`: Alle bruk er ekte side-effekter (DOM, event listeners, query→store sync)
- TanStack Query: Bruker korrekt thunk-syntaks konsekvent
- Store-mutasjon: Alle tilstandsendringer går via metoder (etter clearFilterIteration-fix)

### Fase 3: Anthropic API-optimalisering — ✅ Fullført (P1–P3)

**ADR:** Se `docs/adr/001-anthropic-api-optimalisering.md` for fullstendig evaluering.

Gjennomførte endringer (prioritet 1–3):
- `post_search.py`: Eksplisitt `effort="medium"` (var implicit high)
- `cross_propositions.py`: Eksplisitt `effort="high"`
- `scoping.py`: Refaktorert til `call_claude_structured()`, fjernet egen klient-instans
- `curation.py`: Bruker `call_claude_structured()` med `CURATION_SCHEMA`, XML-tags i prompt, fjernet regex-fallback
- `chat.py`: `output_config={"effort": "medium"}` i streaming-kallet

**Gjenstående (prioritet 4 — Batch API):**
Se ADR for implementeringsstrategi. Krever backend+frontend-endringer for å erstatte SSE-streaming med batch+polling.

---

## Gjenstående QA-oppgaver

### Fase 3.4: Verifiser token-budsjetter (manuell)

- Sjekk at syntese-kall holder seg innenfor ~35K input-tokens
- Verifiser capsule-komprimering i `synthesis.py` for ulike analysestørrelser
- Sjekk at screening-kall filtrerer til `section='vurdering'`

### Fase 4: Funksjonell gjennomgang (krever kjørende backend+DB)

**Oppgave 4.1:** Steg 0 → 1 — Scoping til kandidater
- Verifiser at scoping-godkjenning korrekt persisterer seeds i `analysis_seeds`
- Verifiser at traversal kjøres automatisk etter godkjenning
- Verifiser at kandidater persisteres i `analysis_candidates` med riktig category/signals
- Sjekk at status-overgangen `scoping` → `candidates_ready` fungerer

**Oppgave 4.2:** Steg 2 — Screening
- Verifiser at SSE-streaming fungerer for parallell screening
- Verifiser at kategori-kontroller (Claude/Jeg leser/Velg per sak) oppdaterer korrekt
- Verifiser at screening-resultater persisteres i `analysis_candidates.ai_screening`
- Verifiser at rettssetninger extraheres til `analysis_propositions` med `source='ai_screening'`
- Sjekk at re-screening (`/rescreen`) sender utvidet kontekst

**Oppgave 4.3:** Steg 3 — Ettersøk
- Verifiser at `post-search`-endepunktet returnerer nye seeds
- Verifiser at nye seeds kan godkjennes og utløse nytt søk med `iteration: 2+`

**Oppgave 4.4:** Steg 4-5 — EU-screening og syntese
- Verifiser at EU-saker identifiseres korrekt fra `kofa_eu_references`
- Verifiser at syntese-kallet bruker capsule-komprimering
- Verifiser at notat lagres i `analysis_documents`
- Sjekk at `[JURISTENS VURDERING]`-seksjoner er med i output

**Oppgave 4.5:** Steg 6 — QA
- Verifiser at 3-delt QA kjører (sitatverifisering, logisk konsistens, dekning)
- Verifiser at Citations API brukes korrekt i sitatverifisering
- Sjekk at QA-rapport lagres i `analysis_documents`

**Oppgave 4.6:** Chat-panel
- Verifiser at chat-streaming (SSE) fungerer
- Verifiser at chat har tilgang til analysekontekst fra DB (seeds, kandidater, screening)
- Sjekk at chat-historikk persisteres

### Fase 5: Fremdriftsindikator og statusoverganger

**Oppgave 5.1:** Verifiser 7-stegs fremdriftsindikator
- Sjekk at ProgressIndicator viser korrekt status for hvert steg
- Verifiser at steg er klikkbare og navigerer korrekt
- Sjekk at fullførte steg har hake, aktive er markert, hoppede er dempet

**Oppgave 5.2:** Verifiser statusoverganger
- Kartlegg alle `analysis.status`-verdier og verifiser at overgangene er konsistente
- Sjekk at backend-endepunkter oppdaterer status korrekt
- Verifiser at frontend viser riktig UI basert på status

### Fase 6: Portefølje og persistering

**Oppgave 6.1:** Porteføljevisning
- Verifiser at analyse-liste lastes fra Supabase
- Verifiser at «Kartlegg ny problemstilling» oppretter ny analyse
- Sjekk at status og metadata vises korrekt i listen

**Oppgave 6.2:** DB-persistering
- Verifiser at localStorage → DB-synkronisering fungerer (debounced)
- Verifiser at tilstand overlever page refresh
- Sjekk at `loadFromDb()` i AnalysisState fungerer korrekt

---

## Neste steg

| Prioritet | Oppgave | Krav |
|-----------|---------|------|
| **1** | Batch API-implementering (ADR P4) | Backend + frontend-endringer |
| **2** | Fase 3.4 — Token-budsjett-verifisering | Kjørende backend |
| **3** | Fase 4–6 — Funksjonell gjennomgang | Kjørende backend + DB |

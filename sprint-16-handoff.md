## Paragraf — Sprint 16 Handoff

Du skal fortsette utviklingen av **Paragraf**, en interaktiv juridisk
forskningsarbeidsbenk for norsk anskaffelsesrett (KOFA-avgjørelser).

### Hva er gjort (Sprint 12–15)

| Sprint | Leveranse |
|--------|-----------|
| 12 | Utvidet søk med kandidatpersistering, analyseguide |
| 13 | AI-screening med SSE-streaming (Claude structured outputs) |
| 14 | Post-search suggestions, cross-propositions, proposition registry |
| 15 | Synthesis (notatgenerering), QA (Citations API), EU-screening |

Sprint 15 la til tre nye backend-moduler (synthesis.py, qa.py,
eu_screening.py) med tilhørende frontend-komponenter (SynthesisView,
QAPanel, EuScreeningPanel). Alle backend-moduler bruker nå
call_claude_structured() fra llm_utils.py.

### Kjente hull og teknisk gjeld

1. **Frontend-panelene for synthesis/QA/EU er ikke fullt integrert i
   arbeidsflyt-UX.** Komponentene finnes men toggle-logikk og
   fase-overganger er ufullstendige.

2. **Ingen state machine for analysefaser.** Status-overganger
   (scoping → searching → candidates_ready → screening → …) skjer via
   manuelle update_analysis(status) kall uten validering. Brukeren kan
   hoppe over steg.

3. **gaps-feltet fra traversal lagres ikke i DB-skjema.** Returneres
   fra /api/traverse men persisteres ikke.

4. **Token-budsjett er hardkodet.** Synthesis/QA henter maks 8 A/B-saker
   uten advarsel til bruker.

5. **ai_screening i analysis_candidates er rå JSON.** Frontend-typen
   er ScreeningResult | null men deserialisering mangler noen steder.

6. **Dokumentasjon er utdatert.** status-checklist.md sist oppdatert
   2026-03-10 (før Sprint 15).

### Arkitektur-sammendrag

SvelteKit 2 SPA (adapter-static, Svelte 5 runes) med proxy /api til
Flask backend (port 5002) som snakker med Supabase (PostgreSQL).

**Backend-struktur:**

    backend/
    ├── app.py           — Flask-ruter, SSE-helper
    ├── llm_utils.py     — call_claude_structured, load_analysis_context
    ├── traversal.py     — Graf-traversering
    ├── screening.py     — KOFA-screening (Claude)
    ├── synthesis.py     — Notatgenerering
    ├── qa.py            — QA med Citations API
    ├── eu_screening.py  — EU-saksscreening
    ├── cross_propositions.py — Rettssetnings-analyse
    ├── post_search.py   — Forslag til utvidet søk
    ├── analyses.py      — CRUD for analyser
    └── db.py            — Supabase-klient

**Frontend nøkkelfiler:**

    src/lib/
    ├── stores/analysis.svelte.ts  — Innholdstilstand (Svelte 5 class)
    ├── stores/ui.svelte.ts        — UI-tilstand
    ├── types/analysis.ts          — Alle Sprint 13–15 typer
    ├── api/analyses.ts            — API-kall
    └── components/
        ├── SynthesisView.svelte   — Notat-editor
        ├── QAPanel.svelte         — QA-rapport (3 faner)
        ├── EuScreeningPanel.svelte
        ├── ScreeningPanel.svelte
        ├── PostSearchPanel.svelte
        └── PropositionRegistry.svelte

**DB-tabeller:**

- analyses — Kjerne-metadata
- analysis_seeds — Seeds (provision/fts/vector/case)
- analysis_candidates — KOFA-saker med kategori og screening
- analysis_propositions — Rettssetninger med tema/evolusjon/tensjoner
- analysis_documents — Syntese-notater og QA-rapporter

### Konvensjoner (les CLAUDE.md for fullstendig liste)

- All UI-tekst på **norsk (bokmål)**
- Svelte 5 runes ($state, $derived, $props) — IKKE Svelte 4 syntaks
- Tailwind v4 med @theme inline-tokens
- Backend: bruk call_claude_structured() for alle Claude-kall
- Backend: bruk load_analysis_context() for å laste analyse-kontekst
- Aldri skygger i UI — kun borders + surface shifts

### Dev-kommandoer

    npm run dev          # Frontend :5174 (proxy → :5002)
    npm run check        # Typesjekk
    cd backend && source venv/bin/activate && python app.py  # Backend

### Oppgaver for Sprint 16

Prioriter basert på brukerens behov, men foreslåtte kandidater:

1. **Fullstendig UX-integrasjon av synthesis → QA → ferdig-flyt**
2. **State machine for analysefaser** (forhindre hopping)
3. **Redigering av syntese-notat med re-QA**
4. **Eksport** (markdown/PDF av ferdig notat med referanser)
5. **Token-budsjett-dashboard** (vis forbruk per fase)
6. **E2E-tester** for nye Sprint 15 flyter

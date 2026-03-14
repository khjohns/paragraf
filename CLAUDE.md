# CLAUDE.md

## Prosjekt

Paragraf — interaktiv juridisk forskningsarbeidsbenk for norsk anskaffelsesrett (KOFA-avgjørelser). SvelteKit-frontend med Python Flask-backend og Supabase database.

All UI-tekst er på **norsk (bokmål)**.

## Kommandoer

```bash
npm run dev          # Dev server på :5173
npm run build        # Produksjonsbuild (adapter-static → build/)
npm run check        # Type-check (svelte-check)
npm run test:e2e     # Playwright e2e-tester
```

## Arkitektur

SvelteKit 2 SPA (`adapter-static`, `ssr: false`) med Svelte 5 runes. Backend er Python Flask (port 5002). Database: Supabase (PostgreSQL).

### Rutingstruktur

```
/                     → Portfoliovisning (hovedside)
/analyse/[seedId]     → Analysevisning (graf + liste + detaljpanel)
```

### Kodestruktur

```
src/lib/
├── api/          # Supabase-klient og API-kall
├── components/   # UI-komponenter (graf, liste, detaljer, filtre)
├── queries/      # @tanstack/svelte-query spørringer
├── stores/       # Svelte stores (tilstand)
├── types/        # TypeScript-typer
├── utils/        # Hjelpefunksjoner
└── mocks/        # Testdata
```

## Svelte 5 — VIKTIG

```
- Bruk runes ($state, $derived, $effect), IKKE legacy $: syntaks
- Bruk $props(), IKKE export let
- Bruk snippets og {@render}, IKKE <slot>
- Bruk onclick, IKKE on:click
- Bruk callback-props, IKKE createEventDispatcher
- Bruk $state.snapshot() ved sending til API
- Bruk onMount eller +page.ts load for data-henting, IKKE $effect
- Bruk import { browser } from '$app/environment' for localStorage-guard
```

## Designsystem — Varm papirpalett

- Light theme med tokens i `src/app.css` (`@theme inline`)
- Spacing: 4px grid (spacing-1=4, spacing-2=8, ..., spacing-8=32)
- Radius: sm=2px, md=4px, lg=6px (skarpere enn standard)
- Typografi: Inter (UI), JetBrains Mono (data/tall)
- Farger: bg/panel/surface/ink/border-hierarki med `--p-*` CSS-variabler
- INGEN skygger — borders-only + surface shifts

## Konvensjoner

- Frontend-komponenter bruker Tailwind v4 med `@theme inline`-tokens
- @tanstack/svelte-query v6 med thunk-syntaks (designet for Svelte 5 runes)
- Graf: D3 + dagre (hierarkisk layout) + Svelte SVG-rendering
- Backend-kanter peker **case→provision** (ikke provision→case)
- Listevisning er default (ikke graf)

## Deployment

- GCP Cloud Run (`paragraf` service, `europe-north1`)
- CI/CD: Cloud Build trigger `paragraf-git` — push til main auto-deployer via `cloudbuild.yaml`

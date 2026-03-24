# CLAUDE.md

## Arbeidsflyt — VIKTIG

**Ved sesjonstart:** Kjør `mcp__codegrasp__get_session_context` for å hente observasjoner fra forrige sesjon.

**Under arbeid:** Bruk `mcp__codegrasp__save_observation` for å dokumentere invarianter, subtile bugs og design-valg. Lenk til symboler med `linked_symbols`.

**Etter større endringer:** Kjør `/simplify` for å sjekke kodekvalitet, gjenbruk og effektivitet.

**Før commit:** Kjør `npm run check` (frontend type-check).

## Prosjekt

Paragraf — juridisk forskningsarbeidsbenk for norsk anskaffelsesrett (KOFA-avgjørelser). All UI-tekst på **norsk (bokmål)**.

## Kommandoer

```bash
# Frontend (SvelteKit)
npm run dev          # Dev server :5174 (proxy /api → Flask :5002)
npm run check        # Type-check (svelte-kit sync + svelte-check)
npm run build        # Produksjonsbuild (adapter-static → build/)

# Backend (Python Flask) — bruk scripts/dev-backend.sh for secrets
bash scripts/dev-backend.sh   # Starter Flask :5002 med GCP secrets

# Integrasjonstester (krever backend på :5002)
cd backend && python -m pytest tests/ -v -s

# Deploy
git push  # Cloud Build → Cloud Run auto-deploy
```

## Arkitektur

SvelteKit 2 SPA (`adapter-static`, `ssr: false`) + Svelte 5 runes. Flask-backend (port 5002) med Supabase. Se `backend/app.py` for alle endepunkter.

## Svelte 5 gotchas

Bruk context7 MCP for oppdatert Svelte 5-dokumentasjon ved behov.

```
VIKTIG:
- $state.snapshot() ved sending til API
- onMount for data-henting, IKKE $effect
- $derived for beregninger, $effect KUN for side-effekter (API, DOM)
- Se eksisterende stores (src/lib/stores/*.svelte.ts) for mønster
```

## Domene-spesifikke regler

- **A/B/C-kategori** = innholdsrelevans etter screening (A=Kjernesak, B=Støttesak, C=Kontekstsak). Se ADR-006.
- **Frontend-labels:** A→«Kjernesak», B→«Støttesak», C→«Kontekstsak» (A/B/C kun internt i DB/API)
- **signals** = søke-signaler (ref/fts/vec arrays + discovery_rank), brukes for prioritering og kalibrering
- **category = null** betyr ikke screenet ennå — vis signal-prikker, ikke kategori-badge
- **Signals-invariant:** `signals` settes én gang av scope/traversal, overskrives ALDRI av downstream-steg
- **AI-tillitsgrense:** DB-tekst umarkert, AI-tekst har gull-brun venstre-border (`--p-ai-border`)
- **INGEN skygger** — borders-only + surface shifts (se `.interface-design/system.md`)
- Backend-kanter peker **case→provision** (ikke provision→case)
- Filtrering dimmer noder (15-25% opacity), fjerner dem IKKE

## Anthropic API gotchas

- `thinking: {"type": "adaptive"}` PÅKREVD på agentiske loops med tools + output_config
- `max_tokens=16000+` med thinking (4000 er for lavt)
- Tekst-ekstraksjon: bruk `b.type == "text"`, IKKE `hasattr(b, "text")` (thinking-blokker har også .text)
- API timeout 300s for Sonnet med thinking

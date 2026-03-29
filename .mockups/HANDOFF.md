# Mockup Handoff — React → Svelte

## Hva dette er

React-mockups (JSX) som skal konverteres til Svelte 5-komponenter for en interaktiv designprototyp. Mockupene bruker hardkodet data — ingen backend-kobling.

## Prosess

1. Les denne filen
2. Les alle `.jsx`/`.tsx`-filer i `.mockups/`-mappen
3. Les `src/app.css` for eksisterende CSS-variabler og tokens
4. Planlegg komponentoppdeling (se regler nedenfor)
5. Implementer i `src/routes/mockup/` og `src/lib/mockup/`

## Mappestruktur

```
.mockups/                          ← React-mockups (input, rør ikke)
  portfolio.jsx                    ← Eksempel: porteføljeoversikt
  analyse-triage.jsx               ← Eksempel: analyseside
  ...

src/routes/mockup/
  +page.svelte                     ← Porteføljeoversikt (/mockup)
  analyse/+page.svelte             ← Analyseside (/mockup/analyse)

src/lib/mockup/
  data/                            ← Hardkodet mockdata som typed TS
    portfolio.ts
    analyse.ts
  components/                      ← Svelte-komponenter
    AnalysisCard.svelte
    ScopePanel.svelte
    ...
```

## Konverteringsregler

### Arkitektur
- Én React-eksport → flere Svelte-komponenter. Bryt ned monolittiske filer.
- En komponent per konsept (kort, panel, rad, toolbar) — ikke én megafil.
- Ruter (`+page.svelte`) orkestrerer layout og state. Komponenter er dumme.

### Svelte 5
- `$state()` for lokal state, `$derived()` for beregninger, `$props()` for input.
- INGEN `$effect` for datainitialisering — bruk `onMount` eller initialiser direkte.
- Se eksisterende komponenter i `src/lib/components/` for mønstre.

### Styling
- Bruk `<style>` scoped i hver komponent — IKKE inline `style={{}}`.
- Bruk eksisterende CSS-variabler fra `app.css` der de passer (farger, spacing, radius).
- Nye tokens som ikke finnes i `app.css`: definer som CSS custom properties i komponentens `<style>`.
- Tailwind er tilgjengelig (`@import "tailwindcss"` i app.css) — bruk det for layout (flex, grid, gap) men hold farger/spacing i CSS-variabler.
- INGEN `dangerouslySetInnerHTML` / `{@html}` for styling. Bruk ekte CSS.

### Data
- All mockdata i `src/lib/mockup/data/` som TypeScript med interfaces.
- Gjenbruk eksisterende typer fra `src/lib/types/` der det gir mening.
- Mockdata skal være realistisk (norsk tekst, ekte bestemmelsesreferanser, plausible tall).

### Fonter
- Bruk fontene som allerede er definert i `app.css`: `var(--font-ui)` (Inter) og `var(--font-data)` (JetBrains Mono).
- Hvis mockupen bruker en serif-font (f.eks. EB Garamond), avklar med bruker om den skal beholdes eller erstattes med Inter.

### Hva som IKKE skal konverteres
- Google Fonts `@import`-linjer — bruk eksisterende fonter eller avklar.
- SVG noise textures — avklar med bruker.
- Staggered load-animasjoner — fjern med mindre bruker eksplisitt ber om dem.
- `dangerouslySetInnerHTML` — erstatt med Svelte markup.
- Lucide React-ikoner — bruk `lucide-svelte` eller inline SVG.

### Kvalitet
- Kjør `npm run check` etter konvertering — ingen TypeScript-feil.
- Test i nettleser på 1920×1200 og 1440×900.
- Verifiser at navigasjon mellom /mockup og /mockup/analyse fungerer.

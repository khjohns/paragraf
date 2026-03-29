# Mockup Handoff — React → Svelte

## Hva dette er

React-mockups (JSX) som skal konverteres til Svelte 5-komponenter for en interaktiv designprototyp. Mockupene bruker hardkodet data — ingen backend-kobling.

## Prosess

1. Les denne filen
2. Les `system.md` i denne mappen — den er **fasit for designtokens**, farger, typografi og spacing. Bruk disse tokens i stedet for `app.css` der de avviker.
3. Les mockup-filene (`.jsx`/`.tsx`) som brukeren ber deg konvertere. Ikke konverter filer brukeren ikke har nevnt.
4. Les `src/app.css` for å forstå eksisterende CSS-setup (Tailwind-konfig, fonter, resets).
5. Planlegg komponentoppdeling (se regler nedenfor).
6. Implementer i `src/routes/mockup/` og `src/lib/mockup/`.

## Mappestruktur

```
.mockups/                          ← React-mockups + designtokens (input, rør ikke)
  system.md                        ← FASIT for designtokens og farger
  portfolio.jsx                    ← Eksempel: porteføljeoversikt
  analyse-triage.jsx               ← Eksempel: analyseside
  ...

src/routes/mockup/
  +page.svelte                     ← Porteføljeoversikt (/mockup)
  analyse/+page.svelte             ← Analyseside (/mockup/analyse)

src/lib/mockup/
  data/                            ← Hardkodet mockdata som typed TS
    portfolio.ts                   ← Finnes allerede — oppdater ved behov
    analyse.ts                     ← Finnes allerede — oppdater ved behov
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
- **Designtokens:** `system.md` i `.mockups/` er fasit. Definer nye CSS custom properties i `:root` eller i komponentens `<style>` etter behov.
- Tailwind er tilgjengelig (`@import "tailwindcss"` i app.css) — bruk det for layout (flex, grid, gap) men hold farger/spacing i CSS-variabler.
- INGEN `{@html}` for styling. `{@html}` er kun tillatt for innholdstekst (lovtekst med markering) — aldri for layout eller styling.

### Data
- Mockdata i `src/lib/mockup/data/` som TypeScript med interfaces.
- Filer finnes allerede — oppdater eller utvid ved behov, ikke lag fra scratch.
- Gjenbruk eksisterende typer fra `src/lib/types/` der det gir mening.
- Mockdata skal være realistisk (norsk tekst, ekte bestemmelsesreferanser, plausible tall).

### Fonter
- `system.md` definerer hvilke fonter som brukes. Følg den.
- Hvis mockupen bruker en font som ikke er i `system.md`, avklar med bruker.

### Hva som IKKE skal konverteres
- Google Fonts `@import`-linjer — definer fonter i CSS, ikke som runtime imports.
- SVG noise textures — fjern med mindre `system.md` spesifiserer det.
- Staggered load-animasjoner — fjern med mindre bruker eksplisitt ber om dem.
- `dangerouslySetInnerHTML` — erstatt med Svelte markup (unntak: innholdstekst, se over).
- Lucide React-ikoner — bruk `lucide-svelte` eller inline SVG.

### Kvalitet
- Kjør `npm run check` etter konvertering — ingen TypeScript-feil.
- Test i nettleser på 1920×1200 og 1440×900.
- Verifiser at navigasjon mellom /mockup og /mockup/analyse fungerer.

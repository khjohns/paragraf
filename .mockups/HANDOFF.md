# Mockup Handoff — React → Svelte

## Hva dette er

React-mockups (JSX) som skal konverteres til Svelte 5-komponenter for en interaktiv designprototyp. Mockupene bruker hardkodet data — ingen backend-kobling.

## Status

### Ferdig bygget
- **Porteføljeoversikt** (`paragraf-hybrid-v3.jsx` → `/mockup`) — 15 komponenter
- **Arbeidsflate/Saksoversikt** (`paragraf-arbeidsflate.jsx` → `/mockup/analyse`) — register, scope panel, enkel reading panel
- **Lesevisning** (`paragraf-lesevisning.jsx` → `/mockup/analyse/les`) — fullskjerm med sidebar, 4 nye komponenter + mockdata
- **Grafvisning** (`paragraf-graf-v4.jsx` → `/mockup/analyse` via NavRail) — d3-force nettverk, Canvas kanter, SVG noder, detaljpanel, verktøylinje, tegnforklaring, kontekstmeny, tooltip, 8 nye komponenter + mockdata
- **Rettssetningsregister** (`paragraf-rettssetninger-v3.jsx` → `/mockup/analyse` via NavRail) — tematisk gruppering, 4-kolonne register, bevisgrunnlagspanel med tidslinje, evolusjonsbadges, spenninger, lineage, avgrensninger, 3 nye komponenter + mockdata
- **«Marker som Rettssetning»-flyt** (ny, `/mockup/analyse/les`) — arbeidspanel i bunnen av lesevisningen. PrecedentPanel.svelte med 4 steg: velg handling → opprett ny / knytt til eksisterende → ferdig → marker flere. Segmentert evolution-kontroll, KI-proposisjon som utgangspunkt, nøkkelsitatvelger, temagruppering i rettssetningsliste

## Prosess

1. Les denne filen
2. Les `system.md` i denne mappen — den er **fasit for designtokens**, farger, typografi og spacing. Den er synkronisert med implementasjonen.
3. Les mockup-filen som brukeren ber deg konvertere.
4. Les eksisterende implementasjon i `src/lib/mockup/` og `src/routes/mockup/` — gjenbruk tokens, komponenter og mønstre.
5. Planlegg komponentoppdeling (se regler nedenfor).
6. Implementer.
7. **Kjør QA** (se [Kvalitetsprosess](#kvalitetsprosess) nedenfor).

## Mappestruktur

```
.mockups/                          ← React-mockups + designtokens (input, rør ikke)
  paragraf-system.md               ← FASIT for designtokens og farger
  paragraf-designspec.md           ← Full reasoning bak designvalg
  paragraf-hybrid-v3.jsx           ← Portefølje (FERDIG)
  paragraf-arbeidsflate.jsx        ← Arbeidsflate (FERDIG)
  paragraf-lesevisning.jsx         ← Lesevisning (FERDIG)
  paragraf-graf-v4.jsx             ← Grafvisning (NESTE)
  paragraf-designspec-grafvisning.md        ← Designspec: visuell retning, interaksjon, data
  paragraf-designspec-graf-implementasjon.md ← Implementasjonsarkitektur: d3-force, worker, Layer Cake
  paragraf-designspec-grafvisning-addendum.md ← Korreksjon panelmodell + manglende tokens

src/routes/mockup/
  +page.svelte                     ← Porteføljeoversikt (/mockup)
  analyse/+page.svelte             ← Arbeidsflate (/mockup/analyse)
  analyse/les/+page.svelte         ← Lesevisning fullskjerm (/mockup/analyse/les)

src/lib/mockup/
  tokens.css                       ← Designtokens scoped til .mockup-root
  data/                            ← Hardkodet mockdata som typed TS
    portfolio.ts
    analyse.ts
    lesevisning.ts                 ← KOFA-2025/0999 seksjoner, screening, metadata
    graf.ts                        ← 20 saksnoder, 6 bestemmelser, siteringer, referanser
    rettssetninger.ts              ← 3 rettssetninger, 3 temaer, 6 forekomster, spenninger
  components/                      ← 15 Svelte-komponenter (gjenbrukbare)
    MockupHeader.svelte            ← Sticky header med §-logo, dark mode, avatar
    NavRail.svelte                 ← 48px venstre-rail med 5 ikoner
    ScopePanel.svelte              ← 360px scope-panel med 6 seksjoner
    ScopeSection.svelte            ← Kollapsbar seksjon (brukt i ScopePanel)
    ScopeToggle.svelte             ← Mine/Team/Corpus segmented toggle
    PhaseDropdown.svelte           ← Fase-filter dropdown
    ContinueCard.svelte            ← "Fortsett der du slapp"-kort
    IndexRow.svelte                ← Analyserekke i porteføljen
    RowContextMenu.svelte          ← Kontekstmeny for tagging
    ReadingPanel.svelte            ← Enkel 420px lesepanel (skal erstattes/utvides)
    SignalBadge.svelte             ← R/F/V signal-badge
    MockupCategoryBadge.svelte     ← A/B/C/null kategori-badge
    ExcerptWithMarkers.svelte      ← Tekst med signal-fargede highlights
    ProvisionTag.svelte            ← Mono-tag for bestemmelser
    VennIcon.svelte                ← Custom SVG (to overlappende sirkler)
    ScreeningLayer.svelte          ← KI-screening: faktum, vurdering, rettssetning, sitater
    SectionNav.svelte              ← Sticky seksjonstabs (Bakgrunn/Vurdering/Konklusjon)
    ParagraphRow.svelte            ← Avsnittsrad med anker, tekst, refs, KI-indikator
    ReadingSidebar.svelte          ← 240px sidebar: relaterte saker + bestemmelser
    GraphCanvas.svelte             ← Hovedkomponent: d3-force sim, Canvas kanter, SVG noder, zoom
    GraphToolbar.svelte            ← Kategorifilter, §-toggle, tellere, zoom-kontroller
    GraphDetailPanel.svelte        ← 380px slide-in: sak/bestemmelse detaljer
    GraphLegend.svelte             ← Kollapserbar tegnforklaring, nederst venstre
    NodeTooltip.svelte             ← 400ms forsinket tooltip med KI-proposisjon
    ColorPicker.svelte             ← Høyreklikk fargevelger (5 farger + fjern)
    RegistryView.svelte            ← Rettssetningsregister: tematisk register + bevisgrunnlagspanel
    EvidencePanel.svelte           ← 460px tidslinje med saker, sitater, lineage, avgrensninger
    EvolutionTag.svelte            ← Evolusjonsbadge (Etablert/Bekreftet/Kvalifisert/Konsoliderende)
    PrecedentPanel.svelte          ← «Marker som Rettssetning»-flyt: opprett ny / knytt til eksisterende
```

## Konverteringsregler

### Arkitektur
- Én React-eksport → flere Svelte-komponenter. Bryt ned monolittiske filer.
- En komponent per konsept (kort, panel, rad, toolbar) — ikke én megafil.
- Ruter (`+page.svelte`) orkestrerer layout og state. Komponenter er dumme.

### Svelte 5
- `$state()` for lokal state, `$derived()` / `$derived.by()` for beregninger, `$props()` for input.
- INGEN `$effect` for datainitialisering — bruk `onMount` eller initialiser direkte.
- `$effect` kun for side-effekter (click-outside listeners, timers). Gat med `if (!condition) return;` for å unngå unødige listeners.
- `Snippet` type fra Svelte for typede children-props.
- Se eksisterende komponenter i `src/lib/mockup/components/` for mønstre.

### Styling
- Bruk `<style>` scoped i hver komponent — IKKE inline `style={{}}`.
- **Designtokens:** `tokens.css` er implementasjonen av `system.md`. Scoped under `.mockup-root`.
- Shared styles (action-btn, focus-visible, :active) er allerede i `tokens.css` — gjenbruk, ikke dupliser.
- INGEN `{@html}` for styling. `{@html}` er kun tillatt for innholdstekst (lovtekst med markering) — aldri for layout eller styling.

### Token-system (allerede etablert)
- 4-nivå tekst: `--ink`, `--ink-secondary`, `--ink-tertiary`, `--ink-muted`
- 4-nivå border: `--border-subtle`, `--border`, `--border-strong`, `--border-stronger`
- Kontroller: `--control-bg`, `--control-border`, `--control-border-focus`
- AI-semantikk: `--ai-accent`, `--ai-border`, `--ai-bg`
- Border-radius: 2px (controls/badges), 4px (containers/overlays)
- Transitions: 150ms (micro), 250ms cubic-bezier(0.16, 1, 0.3, 1) (paneler)
- `font-variant-numeric: tabular-nums` på all mono-data
- `:active { transform: scale(0.98) }` globalt på alle knapper
- `focus-visible: outline 2px solid --control-border-focus` globalt

### Data
- Mockdata i `src/lib/mockup/data/` som TypeScript med interfaces.
- Gjenbruk eksisterende typer der det gir mening.
- Mockdata skal være realistisk (norsk bokmål, ekte bestemmelsesreferanser, korrekte diakritiske tegn æ/ø/å).

### Hva som IKKE skal konverteres
- Google Fonts `@import`-linjer — fonter er allerede i `app.css`.
- SVG noise textures — fjern med mindre `system.md` spesifiserer det.
- `dangerouslySetInnerHTML` — erstatt med Svelte markup.
- Lucide React-ikoner — bruk `lucide-svelte`.

---

## Kvalitetsprosess

Hver ny komponent/visning skal gjennom:

1. Implementer + `npm run check` (null feil)
2. `/simplify` (ved tilstrekkelig kompleksitet)
3. `/critique` — komposisjon, craft, innhold, struktur
4. Fiks alle funn, oppdater `system.md` ved nye tokens/mønstre

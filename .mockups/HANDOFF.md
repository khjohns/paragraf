# Mockup Handoff — React → Svelte

## Hva dette er

React-mockups (JSX) som skal konverteres til Svelte 5-komponenter for en interaktiv designprototyp. Mockupene bruker hardkodet data — ingen backend-kobling.

## Status

### Ferdig bygget
- **Porteføljeoversikt** (`paragraf-hybrid-v3.jsx` → `/mockup`) — 15 komponenter
- **Arbeidsflate/Saksoversikt** (`paragraf-arbeidsflate.jsx` → `/mockup/analyse`) — register, scope panel, enkel reading panel
- **Lesevisning** (`paragraf-lesevisning.jsx` → `/mockup/analyse/les`) — fullskjerm med sidebar, 4 nye komponenter + mockdata

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
  paragraf-lesevisning.jsx         ← Lesevisning (NESTE)

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

## Lesevisning-spesifikasjon

Kilde: `paragraf-lesevisning.jsx`. Bygger videre på det eksisterende `ReadingPanel.svelte`.

### To moduser
1. **Panelversjon (420px)** — erstatter nåværende enkle ReadingPanel. Kompakt: KI-screening kollapset default, seksjonsnav som dropdown, ingen sidebar, avsnitt med numre.
2. **Fullskjerm** — 720px max-width + 240px sidebar. Toggle med Maximize2-knapp. Alle seksjoner utfoldet.

### Komponenter å bygge
- **ScreeningLayer** — Strukturert KI-screening: faktum, vurdering, foreslått rettssetning (border-left ocher), nøkkelsitater med avsnitt-ref. Kollapsbar.
- **SectionNav** — Bakgrunn/Anførsler/Vurdering som sticky tabs (fullskjerm) eller dropdown (panel).
- **ParagraphRow** — Avsnittsrad med klikkbar nummer-anker (kopier ref), 17px serif tekst, line-height 1.7.
- **ParagraphAnchor** — 48px kolonne, avsnittsnummer, klikk = kopier "KOFA-XXXX, avsnitt N".
- **InlineRef** — Kryssreferanse som klikkbar lenke (dotted underline, `--ref-link` farge).
- **ProvisionInline** — Inline bestemmelsesreferanse i mono.
- **QuotedParagraph** — Markert med 2px border-left ai-accent (KI-sitert avsnitt).
- **ReadingSidebar** (kun fullskjerm) — Relaterte saker + bestemmelser, 240px.

### Tokens å legge til (fra system.md, ikke i tokens.css ennå)
```
--confirm-color:  #375E37 (light) / #8BC48B (dark)   Kopiér-bekreftelse
--gold-star:      #B8941E (light) / #D4B84E (dark)   Gullkandidat-stjerne
--ref-link:       #4A6A8B (light) / #8BAAC4 (dark)   Kryssreferanselenker
```

### Mockdata
- Bruk den reelle KOFA-saken fra `paragraf-lesevisning.jsx` (2025/0999, Gran kommune, § 7-9).
- Strukturert: seksjoner med avsnitt, KI-screening output, metadata.
- Ny fil: `src/lib/mockup/data/lesevisning.ts`

---

## Kvalitetsprosess

Hver konvertering skal gjennom følgende steg. Ikke skip noen.

### 1. Implementer
Konverter mockup, kjør `npm run check` — null feil.

### 2. Simplify (`/simplify`)
Kjør `/simplify` for å sjekke kodekvalitet, gjenbruk og effektivitet. Fiks funn.

### 3. Selvkritikk (`/critique`)
Kjør `/critique` og vurder komposisjon, craft, innhold og struktur. Fiks alt som identifiseres.

### 4. QA-sammenligning
Systematisk sammenligning mellom mockup og implementasjon:

- **Designtroskap:** Matcher layout, typografi, spacing, farger?
- **Token-bruk:** Hardkodede verdier som burde vært tokens?
- **Svelte 5-korrekthet:** Runes brukt riktig? Anti-patterns?
- **CSS-kvalitet:** Konsistent border-radius (2px/4px), transitions (150ms/250ms), spacing (4px-grid)?
- **Interaktivitet:** Hover, focus-visible, :active, transitions — komplett og konsistent?
- **Norsk tekst:** Korrekt bokmål, alle diakritiske tegn (æ, ø, å)?
- **Bugs:** Logikkfeil, layout-bugs, tilstander som ikke håndteres?

### 5. Fiks alle funn
Alt med reell verdi fikses. Ikke la "minor" funn ligge — de akkumulerer.

### 6. Oppdater system.md
Synkroniser `system.md` med nye tokens, mønstre eller konvensjoner fra implementasjonen.

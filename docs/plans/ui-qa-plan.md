# UI-kvalitetssikring — guidet analyse

**Dato:** 2026-03-15
**Scope:** All UI implementert i Sprint 10–16 (guidet analyseprosess)
**Referanser:** `docs/design/paragraf-guidet-analyse.md`, `docs/plans/guidet-analyse-overordnet-plan.md`, `.interface-design/system.md`

---

## Tilnærming

QA gjøres **per view i brukerflyt-rekkefølge** — ikke per sprint. Hvert view gjennomgår tre lag:

1. **Audit** — mekanisk sjekk mot designsystemet (spacing, farger, dybde, typografi, komponentmønstre)
2. **Mockup-sammenligning** — visuell diff mot mockup der relevant; mockupen er også gjenstand for kritikk
3. **Critique** — kvalitativ vurdering av craft (komposisjon, rytme, states, innholdskoherens)

Funn dokumenteres per view. Fiks gjøres umiddelbart etter hvert view — ikke samlet til slutt.

---

## Views i rekkefølge

### 1. Portefølje (`/`)

**Komponenter:** `Portfolio.svelte`, `PortfolioDetail.svelte`, `+page.svelte` (root)
**Mockup:** `paragraf-portfolio-concept.jsx`
**Sprint:** 10

**Sjekkliste:**
- [x] Layout: listevisning med detalj-panel. Eier-felt synlig, team-tab dimmet
- [x] Analysekort: tittel, status-badge, dato, problemstilling-preview
- [x] Status-badges bruker riktige semantiske farger per analyse-status
- [x] Opprett-knapp: «Kartlegg ny problemstilling» — tydelig primæraksjon
- [x] Fremdriftsindikator per analyse (7-stegs fra guidet-analyse doc) — status vises via fase-label per rad
- [x] Tom tilstand: meningsfull empty state
- [x] Hover/active states på listeelementene
- [x] Typografi: Inter UI, monospace for saksnumre/datoer

**Audit-fokus:** Spacing-grid (4px), border-strategi (ingen skygger), badge-mønster (`2px 6px`, `3px radius`, `10px font`).

**Mockup-kritikk:** Vurder om mockupens layout og proporsjoner er optimale — porteføljen kan ha evolvert under implementering.

---

### 2. Scoping overlay (`/analyse/[id]` med status `scoping`) ✓

**Komponenter:** `ScopingOverlay.svelte`, `SeedInput.svelte`
**Mockup:** `paragraf-scoping-concept.jsx`
**Sprint:** 11

**Sjekkliste:**
- [x] Fase 1: Blankt tekstfelt + én knapp. Minimal terskel
- [x] Fase 2: Strukturert forslag — alle felter redigerbare. Bestemmelser med verifisert ordlyd og hake (grønn = DB, gul = web). Søkestrategi i klartekst. Claudes begrunnelse kollaperbar
- [x] Fase 3: Søkefremdrift per søketype (R/F/V)
- [x] Stegindikator øverst: Problemstilling → Scoping → Søk → Kandidater
- [x] AI-tillitsgrense: Claudes forslag har gullbrun venstekant
- [x] «Be Claude revidere»-knapp
- [x] Loading state under Claude-kall
- [x] Feilhåndtering: hva skjer ved API-feil?
- [x] Overgang fra overlay til workspace ved godkjenning

**Audit-fokus:** Input-felter bruker `--p-input` bakgrunn (mørkere enn omgivelsene). Bestemmelseskort følger node-type-farger (provision = blå-grå).

**Audit-funn (fikset):**
- `--p-provision` og `--p-kofa` var udefinerte tokens → rettet til `--p-provision-accent` / `--p-kofa-accent`
- Hardkodede AI-farger (rgba) → erstattet med `--p-ai-border-subtle`, `--p-ai-bg`, `--p-ai-text`
- Hardkodede feil-farger → erstattet med `--p-danger` / `--p-danger-bg`
- Border-radius brukte vilkårlige px-verdier (5px, 8px) → rettet til `var(--radius-md)` / `var(--radius-lg)`
- Off-grid spacing (6px, 10px, 14px) → snappet til 4px-grid (4px, 8px, 12px)
- `--font-body` (udefinert) i SeedInput → rettet til `--font-ui`
- Chip padding 10px → 8px (4px-grid)
- Letter-spacing 0.05em → 0.06em (system-konsistens)
- Textarea fokus brukte `--p-ai-border` → rettet til `--p-border-s`

---

### 3. Workspace — kandidatliste (`/analyse/[id]`) ✓

**Komponenter:** `AppShell.svelte`, `WorkspaceHeader.svelte`, `Toolbar.svelte`, `LeftPanel.svelte`, `LeftPanelSection.svelte`, `NodeList.svelte`, `NodeRow.svelte`, `CategoryBadge.svelte`, `ValencePip.svelte`, `NodeTypeIcon.svelte`
**Mockup:** `legal-workbench.jsx`
**Sprint:** 10, 12

**Sjekkliste:**
- [x] Tre-panel layout: venstre (fast bredde) + midt (fleksibel) + høyre (fast bredde, betinget)
- [x] Workspace header strip: `Paragraf · [provision] · [lest] · [iterasjon]`
- [x] View switcher (segmented control): Liste | Graf | Tidslinje | Rettssetninger
- [x] Kandidatliste med A/B/C-badges, signalprikker (R/F/V), screening-status
- [x] Listeformat per rad: checkbox · type-prikk · saksnummer (mono) · kategori · signaler · beskrivelse
- [x] Aktiv rad: venstrekant-accent + aktiv bakgrunn
- [x] Hover: subtil bakgrunnsendring
- [x] Fremdriftsindikator i venstepanel (7-stegs)
- [x] Gap-matrise i venstepanel
- [x] Dimming av filtrerte noder (15–25% opacity, ikke fjerning)

**Audit-fokus:** List item-mønsteret fra `system.md` — 9px fargeprikk, 12px mono saksnummer, badge-mønster. Sidebar har *samme* bakgrunn som canvas (ikke annen farge).

**Audit-funn (fikset):**
- NodeRow: `--p-kofa` (3 steder) → `--p-kofa-accent` (udefinert token)
- NodeRow: padding 11px → 12px, gap 10px → 8px, checkbox 15px → 16px (4px-grid)
- NodeRow: `.row-line1` gap 5px → 4px, `.row-line2` gap 7px → 8px
- NodeRow: badge padding `1px 5px` → `2px 6px` (badge-mønster)
- NodeRow: `.screening-badge` brukte `var(--p-ai-border)` → `var(--p-ai-border-subtle)`, fjernet hardkodet fallback
- Toolbar: padding 7px → 8px, view-switcher radius → `var(--radius-md)`, btn padding 11px → 12px
- Toolbar: ai-toggle/reg-filter padding 3px → 4px, radius → `var(--radius-md)`
- Toolbar: cat-pill padding 3px 9px → 4px 8px, graph-search radius → token
- Toolbar: hardkodede rgba-verdier → tokens, `white` → `var(--p-panel)`
- LeftPanel: problem-input radius 6px → `var(--radius-lg)`, padding 10px → 8px
- LeftPanel: result-row padding 7px 10px → 8px 12px, radius 5px → `var(--radius-md)`
- LeftPanel: mapping-content gap 14px → 12px, mapping-label letter-spacing → 0.06em
- LeftPanel: gap-row/round-row/valence-legend off-grid spacing → snappet til 4px-grid
- LeftPanel: alle hardkodede border-radius (4px, 5px) → tokens

---

### 4. Detaljpanel (høyrepanel) ✓

**Komponenter:** `NodeDetail.svelte`, `NodeDetailOverview.svelte`, `ProvisionDetail.svelte`, `EuCaseDetail.svelte`, `ForarbeidDetail.svelte`, `CaseReader.svelte`
**Mockup:** `legal-workbench.jsx` (DetailPanel), `paragraf-timeline-concept.jsx` (CaseDetail)
**Sprint:** 10 (eksisterende, men videreutviklet)

**Sjekkliste:**
- [x] Header i node-type-farge (provision-bg, kofa-bg, eu-bg, court-bg, prep-bg)
- [x] Type-label, node-identifikator (stor mono), metadata-badges, lukk-knapp
- [x] Lesemodus med AI-kuratering: gulmarkering, kommentarer, kryssreferanser
- [x] AI-tillitsgrense: database-tekst umarkert, AI-tekst med gullbrun venstekant
- [x] Klikkbare avsnittsnumre
- [x] Kollaperbare seksjoner
- [x] Screening-resultat integrert (faktum, vurdering, rettssetninger, sitater, nyanser)

**Audit-fokus:** Detail panel header bruker riktige node-type-farger fra `system.md`. Badge-mønster konsistent.

**Audit-funn (fikset):**
- NodeDetail: header padding 14px → 12px, off-grid margins (6px, 5px, 3px) → 4px
- NodeDetail: outcome-badge padding 7px → 6px, radius → `var(--radius-md)`
- NodeDetail: tab-bar radius 5px → `var(--radius-md)`, margin-top 10px → 8px
- NodeDetailOverview: section-label letter-spacing → 0.06em, margin-bottom 6px → 8px
- NodeDetailOverview: signal-row gap 7px → 8px, padding 6px → 8px, bg → `var(--p-hover)`
- NodeDetailOverview: relation-row gap 5px → 4px, padding 6px → 8px, radius → token
- NodeDetailOverview: notes-field padding 7px 10px → 8px 12px, radius → token, focus → `--p-border-s`
- NodeDetailOverview: action-btn padding 7px → 8px, radius → token, gap 6px → 8px
- NodeDetailOverview: AI summary border `--p-ai-border` → `--p-ai-border-subtle`, radius → token
- NodeDetailOverview: AI text color `--p-ai-border` → `--p-ai-text`
- NodeDetailOverview: hardkodede rgba border-colors → tokens

---

### 5. Screening-delegering ✓

**Komponenter:** `ScreeningPanel.svelte`
**Mockup:** `paragraf-screening-concept.jsx`
**Sprint:** 13

**Sjekkliste:**
- [x] To-kolonne layout: venstre (280px) delegerings-kontroller, høyre saksliste gruppert A/B/C
- [x] Kategorikontroller: tre knapper per gruppe (Claude screener / Jeg leser / Velg per sak)
- [x] Per-sak toggle: AI | Person — kompakt to-delt
- [x] Automatisk bytte til «Velg per sak» ved individuell override
- [x] Streaming-visning: pulserende bakgrunn, spinner, «Leser 2024/2019…»
- [x] Fremdrift: «8 av 12 screenet (3 Claude, 2 deg, 3 gjenstår)»
- [x] Feilhåndtering per sak: «screening feilet» med retry
- [x] Star-markering for gullkandidater

**Audit-funn (fikset):**
- `--p-kofa` (2 steder) → `--p-kofa-accent` (udefinert token)
- Panel-label letter-spacing → 0.06em, cat-control radius → token
- Mode-btn padding 6px → 4px, radius → token
- Start-btn padding 9px → 8px, radius → token
- Batch indicator: border `--p-ai-border` → `--p-ai-border-subtle`, color → `--p-ai-text`
- Spinner border `--p-ai-border` → `--p-border-m`

---

### 6. Screening-resultater ✓

**Komponenter:** `ScreeningResultCard.svelte`, `NodeRow.svelte` (ekspandert tilstand)
**Mockup:** `paragraf-screening-concept.jsx`
**Sprint:** 13

**Sjekkliste:**
- [x] Ekspanderbar under saksraden i listen
- [x] Visuelt hierarki: rettssetning øverst (gulmarkert bakgrunn), faktum + vurdering, nøkkelsitater (kollaperbare, hvit boks, avsnittsnummer som klikkbar monospace-lenke), nyanser (kollaperbare, kursiv)
- [x] Handlinger: «Les hele avgjørelsen», «Re-screen med mer kontekst»
- [x] Screening-status badges: Screenet (AI-markert gullbrun), Lest (grønn hake), Begge
- [x] AI-tillitsgrense konsistent: alt screening-innhold har gullbrun markering
- [x] Rettssetninger visuelt løftet vs. resten

**Audit-funn (fikset):**
- Card border-left `--p-ai-border` → `--p-ai-border-subtle`, bg hardkodet → `var(--p-ai-bg)`
- AI badge: padding → badge-mønster, border → `--p-ai-border-subtle`, color → `--p-ai-text`
- `--p-kofa` (4 steder) → `--p-kofa-accent` / `--p-ai-text`
- Proposition label letter-spacing → 0.06em, margin-bottom 3px → 4px
- All off-grid spacing (6px, 10px, 14px) → snappet til 4px-grid
- All border-radius → tokens

---

### 7. Ettersøk ✓

**Komponenter:** `PostSearchPanel.svelte`
**Sprint:** 14

**Sjekkliste:**
- [x] AI-markert panel i venstepanel med ettersøk-forslag
- [x] Nye FTS-termer, vektorsøk, bestemmelser — redigerbare før godkjenning
- [x] Claudes begrunnelse synlig (kollaperbar)
- [x] Iterasjonshistorikk: nye kandidater merket `iteration: 2+`
- [x] Godkjenn-knapp trigger nytt søk

**Audit-funn (fikset):**
- Button padding 7px → 8px, radius → token, gap 6px → 8px
- Reasoning border hardkodet rgba → `var(--p-ai-border-subtle)`, padding 10px → 12px, radius → token
- Section-label letter-spacing → 0.06em, chip padding 5px → 4px, chip radius → token
- Spinner `white` → `var(--p-panel)`, results gap 10px → 8px

---

### 8. Rettssetningsregister ✓

**Komponenter:** `PropositionRegistry.svelte`
**Mockup:** `paragraf-registry-concept.jsx`
**Sprint:** 14

**Sjekkliste:**
- [x] Midtpanel-visning med egen toolbar-tab «Rettssetninger»
- [x] Tematisk gruppering (ThemeGroup)
- [x] PropositionCard med tidslinje-instanser
- [x] Evolution-badges: Etablert / Bekreftet / Presisert / Konsoliderende
- [x] TensionConnector for spenninger mellom rettssetninger
- [x] AI-forslag-markering (ubekreftede rettssetninger)
- [x] Evolution-legende i toolbar
- [x] Klikk på rettssetning navigerer til kilde-sak/avsnitt

**Audit-funn (fikset):**
- letter-spacing → 0.06em, border-radius 5px → `var(--radius-md)`
- Hardkodet `rgba(166, 139, 91, 0.2)` → `var(--p-ai-border-subtle)`

---

### 9. Syntese + QA ✓

**Komponenter:** `SynthesisView.svelte`, `QAPanel.svelte`
**Sprint:** 15

**Sjekkliste:**
- [x] «Generer notat»-knapp — tydelig plassering og primær styling
- [x] Notatvisning: markdown-rendering med tydelige seksjoner
- [x] `[JURISTENS VURDERING]`-seksjoner visuelt differensiert (annen bakgrunn/border)
- [x] AI-tillitsgrense: hele notatet er AI-generert — hvordan kommuniseres dette?
- [x] QA-rapport: flagg-liste med kategorier (sitatfeil, logisk sprang, dekningshull)
- [x] Hvert flagg klikkbart — navigerer til relevant seksjon i notatet
- [x] Loading state under syntese (~25-35K tokens = merkbar ventetid)

**Audit-funn (fikset):**
- SynthesisView: letter-spacing → 0.06em, 2x border-radius 5px → token
- QAPanel: 3x border-radius 5px → `var(--radius-md)`

---

### 10. Chat-panel ✓

**Komponenter:** `ChatDrawer.svelte`
**Mockup:** `paragraf-chat-concept.jsx`
**Sprint:** 16

**Sjekkliste:**
- [x] Bunnpanel-skuff i midtpanelet: lukket / halv / full
- [x] Referanseparsing: `{ref:kofa:2024/2019:§42}` → klikkbar lenke
- [x] AI-tillitsgrense: Claudes svar har gullbrun markering
- [x] Proaktive forslag visuelt differensiert fra brukerens spørsmål
- [x] «Mulige motargumenter»-blokk med egen styling
- [x] Input-felt med send-knapp
- [x] Meldingshistorikk med tydelig bruker/Claude-differensiering
- [x] Skuff-resize: drag-håndtak, snapping til lukket/halv/full

**Audit-funn (fikset):**
- letter-spacing → 0.06em
- AI border hardkodet fallback → `var(--p-ai-border-subtle)`

---

### 11. Tverrgående sjekker

Disse gjelder alle views og sjekkes til slutt:

**States:**
- [ ] Alle knapper: default, hover, active, focus, disabled
- [ ] Alle interaktive elementer har focus-ring (strong border fra `system.md`)
- [ ] Loading states: spinner/puls der data hentes
- [ ] Error states: feilmeldinger ved API-feil
- [ ] Empty states: meningsfulle tomme tilstander

**AI-tillitsgrense (gjennomgående):**
- [ ] Konsistent gullbrun venstekant på alt AI-generert innhold
- [ ] Database-tekst aldri markert som AI
- [ ] Ingen gråsone — alt er enten DB eller AI

**Typografi:**
- [ ] Inter for UI, JetBrains Mono for data (saksnumre, paragrafref, seeds)
- [ ] 4-nivå teksthierarki brukt konsistent (ink, ink2, ink3, ink4)
- [ ] Panel-titler: 11px, 600, uppercase, 0.06em tracking

**Farger:**
- [ ] Node-type-farger konsistente på tvers av list items, detalj-panel headers, badges
- [ ] Ingen hardkodede hex-verdier utenfor paletten
- [ ] Semantiske farger (success/warn/danger/gap/delim) brukt riktig

**Responsivitet:**
- [ ] Paneler har fornuftige min-bredder
- [ ] Tekst truncates/wraps riktig ved smale paneler
- [ ] Scrolling fungerer i alle paneler uavhengig

---

## Gjennomføringsprosess

For hvert view (1–10):

```
1. Les mockup (der relevant) — bruk som visuell referanse, ikke fasit
2. Les implementert kode — audit mot system.md
3. Kjør /interface-design:critique på komponentfilene
4. Dokumenter funn
5. Fiks implementasjonen
6. Kjør /interface-design:audit for å verifisere fiks
```

Mockups oppdateres IKKE — de er referanser, ikke vedlikeholdt kode. Implementasjonen er sannheten.

Tverrgående sjekker (11) gjøres etter alle views er gjennomgått.

---

## Leveranse

Etter QA:
- Alle views er auditert, kritisert og fikset
- `system.md` er oppdatert med eventuelle nye mønstre oppdaget under QA
- Denne filen oppdateres med status per view (✓/✗) underveis

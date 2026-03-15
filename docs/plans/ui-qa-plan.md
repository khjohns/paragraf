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

### 3. Workspace — kandidatliste (`/analyse/[id]`)

**Komponenter:** `AppShell.svelte`, `WorkspaceHeader.svelte`, `Toolbar.svelte`, `LeftPanel.svelte`, `LeftPanelSection.svelte`, `NodeList.svelte`, `NodeRow.svelte`, `CategoryBadge.svelte`, `ValencePip.svelte`, `NodeTypeIcon.svelte`
**Mockup:** `legal-workbench.jsx`
**Sprint:** 10, 12

**Sjekkliste:**
- [ ] Tre-panel layout: venstre (fast bredde) + midt (fleksibel) + høyre (fast bredde, betinget)
- [ ] Workspace header strip: `Paragraf · [provision] · [lest] · [iterasjon]`
- [ ] View switcher (segmented control): Liste | Graf | Tidslinje | Rettssetninger
- [ ] Kandidatliste med A/B/C-badges, signalprikker (R/F/V), screening-status
- [ ] Listeformat per rad: checkbox · type-prikk · saksnummer (mono) · kategori · signaler · beskrivelse
- [ ] Aktiv rad: venstrekant-accent + aktiv bakgrunn
- [ ] Hover: subtil bakgrunnsendring
- [ ] Fremdriftsindikator i venstepanel (7-stegs)
- [ ] Gap-matrise i venstepanel
- [ ] Dimming av filtrerte noder (15–25% opacity, ikke fjerning)

**Audit-fokus:** List item-mønsteret fra `system.md` — 9px fargeprikk, 12px mono saksnummer, badge-mønster. Sidebar har *samme* bakgrunn som canvas (ikke annen farge).

---

### 4. Detaljpanel (høyrepanel)

**Komponenter:** `NodeDetail.svelte`, `NodeDetailOverview.svelte`, `ProvisionDetail.svelte`, `EuCaseDetail.svelte`, `ForarbeidDetail.svelte`, `CaseReader.svelte`
**Mockup:** `legal-workbench.jsx` (DetailPanel), `paragraf-timeline-concept.jsx` (CaseDetail)
**Sprint:** 10 (eksisterende, men videreutviklet)

**Sjekkliste:**
- [ ] Header i node-type-farge (provision-bg, kofa-bg, eu-bg, court-bg, prep-bg)
- [ ] Type-label, node-identifikator (stor mono), metadata-badges, lukk-knapp
- [ ] Lesemodus med AI-kuratering: gulmarkering, kommentarer, kryssreferanser
- [ ] AI-tillitsgrense: database-tekst umarkert, AI-tekst med gullbrun venstekant
- [ ] Klikkbare avsnittsnumre
- [ ] Kollaperbare seksjoner
- [ ] Screening-resultat integrert (faktum, vurdering, rettssetninger, sitater, nyanser)

**Audit-fokus:** Detail panel header bruker riktige node-type-farger fra `system.md`. Badge-mønster konsistent.

---

### 5. Screening-delegering

**Komponenter:** `ScreeningPanel.svelte`
**Mockup:** `paragraf-screening-concept.jsx`
**Sprint:** 13

**Sjekkliste:**
- [ ] To-kolonne layout: venstre (280px) delegerings-kontroller, høyre saksliste gruppert A/B/C
- [ ] Kategorikontroller: tre knapper per gruppe (Claude screener / Jeg leser / Velg per sak)
- [ ] Per-sak toggle: AI | Person — kompakt to-delt
- [ ] Automatisk bytte til «Velg per sak» ved individuell override
- [ ] Streaming-visning: pulserende bakgrunn, spinner, «Leser 2024/2019…»
- [ ] Fremdrift: «8 av 12 screenet (3 Claude, 2 deg, 3 gjenstår)»
- [ ] Feilhåndtering per sak: «screening feilet» med retry
- [ ] Star-markering for gullkandidater

**Audit-fokus:** Toggle-kontroller følger control-token-mønsteret. Kategori-knapper har tydelige states (active, hover, disabled).

**Mockup-kritikk:** Vurder om delegeringsmodellen er visuelt klar — tre valg per kategori + per-sak toggle kan være mye. Er hierarkiet tydelig nok?

---

### 6. Screening-resultater

**Komponenter:** `ScreeningResultCard.svelte`, `NodeRow.svelte` (ekspandert tilstand)
**Mockup:** `paragraf-screening-concept.jsx`
**Sprint:** 13

**Sjekkliste:**
- [ ] Ekspanderbar under saksraden i listen
- [ ] Visuelt hierarki: rettssetning øverst (gulmarkert bakgrunn), faktum + vurdering, nøkkelsitater (kollaperbare, hvit boks, avsnittsnummer som klikkbar monospace-lenke), nyanser (kollaperbare, kursiv)
- [ ] Handlinger: «Les hele avgjørelsen», «Re-screen med mer kontekst»
- [ ] Screening-status badges: Screenet (AI-markert gullbrun), Lest (grønn hake), Begge
- [ ] AI-tillitsgrense konsistent: alt screening-innhold har gullbrun markering
- [ ] Rettssetninger visuelt løftet vs. resten

**Audit-fokus:** Sitater i hvit boks — bruker de `surface` bakgrunn? Avsnittsnumre i monospace? Badge for «Screenet» følger AI-accent-tokenet.

---

### 7. Ettersøk

**Komponenter:** `PostSearchPanel.svelte`
**Sprint:** 14

**Sjekkliste:**
- [ ] AI-markert panel i venstepanel med ettersøk-forslag
- [ ] Nye FTS-termer, vektorsøk, bestemmelser — redigerbare før godkjenning
- [ ] Claudes begrunnelse synlig (kollaperbar)
- [ ] Iterasjonshistorikk: nye kandidater merket `iteration: 2+`
- [ ] Godkjenn-knapp trigger nytt søk

**Audit-fokus:** AI-tillitsgrense på forslagene. Panelet bruker panel/surface-bakgrunn, ikke annen farge.

---

### 8. Rettssetningsregister

**Komponenter:** `PropositionRegistry.svelte`
**Mockup:** `paragraf-registry-concept.jsx`
**Sprint:** 14

**Sjekkliste:**
- [ ] Midtpanel-visning med egen toolbar-tab «Rettssetninger»
- [ ] Tematisk gruppering (ThemeGroup)
- [ ] PropositionCard med tidslinje-instanser
- [ ] Evolution-badges: Etablert / Bekreftet / Presisert / Konsoliderende
- [ ] TensionConnector for spenninger mellom rettssetninger
- [ ] AI-forslag-markering (ubekreftede rettssetninger)
- [ ] Evolution-legende i toolbar
- [ ] Klikk på rettssetning navigerer til kilde-sak/avsnitt

**Audit-fokus:** Evolution-badges følger badge-mønsteret. Spennings-konnektorer bruker semantisk `gap`/`danger`-farge.

**Mockup-kritikk:** Registeret er informasjonstett — vurder om hierarkiet er tydelig nok ved mange rettssetninger. Er tematisk gruppering visuelt distinkt fra individuelle kort?

---

### 9. Syntese + QA

**Komponenter:** `SynthesisView.svelte`, `QAPanel.svelte`
**Sprint:** 15

**Sjekkliste:**
- [ ] «Generer notat»-knapp — tydelig plassering og primær styling
- [ ] Notatvisning: markdown-rendering med tydelige seksjoner
- [ ] `[JURISTENS VURDERING]`-seksjoner visuelt differensiert (annen bakgrunn/border)
- [ ] AI-tillitsgrense: hele notatet er AI-generert — hvordan kommuniseres dette?
- [ ] QA-rapport: flagg-liste med kategorier (sitatfeil, logisk sprang, dekningshull)
- [ ] Hvert flagg klikkbart — navigerer til relevant seksjon i notatet
- [ ] Loading state under syntese (~25-35K tokens = merkbar ventetid)

**Audit-fokus:** Markdown-rendering respekterer typografi-hierarkiet. QA-flagg bruker semantiske farger (warn, danger).

---

### 10. Chat-panel

**Komponenter:** `ChatDrawer.svelte`
**Mockup:** `paragraf-chat-concept.jsx`
**Sprint:** 16

**Sjekkliste:**
- [ ] Bunnpanel-skuff i midtpanelet: lukket / halv / full
- [ ] Referanseparsing: `{ref:kofa:2024/2019:§42}` → klikkbar lenke
- [ ] AI-tillitsgrense: Claudes svar har gullbrun markering
- [ ] Proaktive forslag visuelt differensiert fra brukerens spørsmål
- [ ] «Mulige motargumenter»-blokk med egen styling
- [ ] Input-felt med send-knapp
- [ ] Meldingshistorikk med tydelig bruker/Claude-differensiering
- [ ] Skuff-resize: drag-håndtak, snapping til lukket/halv/full

**Audit-fokus:** Skuffen overlapper ikke workspace-innhold uventet. Chat-meldinger bruker riktig typografi.

**Mockup-kritikk:** Bunnpanel-skuff vs. sidepanel — er bunnplassering optimal for et verktøy med allerede tre paneler? Vurder om høyden er tilstrekkelig i halv-modus.

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

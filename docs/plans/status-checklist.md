# Paragraf — Implementeringsstatus vs. designspesifikasjon

Oppdatert: 2026-03-10 (37 commits, Sprint 1–7 + graf-forbedringer)

## Leseforklaring

- ✅ Implementert og fungerende
- ⚠️ Delvis implementert / trenger verifisering
- ❌ Ikke implementert

---

## Fase 1 — MVP

### Layout og navigasjon (§3)
- ✅ Tre-panel layout (AppShell: venstre 300px, midtpanel flex, høyre 370px)
- ✅ Venstrepanel med 5 nummererte seksjoner (LeftPanel + LeftPanelSection)
- ✅ Midtpanel med liste/graf-toggle
- ✅ Høyrepanel vises ved klikk på node (NodeDetail)
- ✅ Arbeidsstripe/header (WorkspaceHeader)

### Venstepanelet — arbeidsstegveiviser (§4)
- ✅ Seksjon 1: Problemstilling (visning)
- ✅ Seksjon 2: Seeds — bestemmelser, FTS, vektor, saker (SeedInput)
- ✅ Seksjon 3: A/B/C-resultater med antall
- ✅ Seksjon 4: Gap-matrise med ∅-indikatorer
- ✅ Seksjon 5: Om rangeringen (pedagogisk tekst)
- ✅ Seksjon 4: Lesestatus-fremdriftslinjer per kategori
- ✅ Seksjon 4: Iterasjonshistorikk med seed-diff
- ✅ Seksjon 4: "Ny iterasjon med nye seeds"-knapp

### Gap-identifisering (§5)
- ✅ Gap-matrise med bestemmelsespar og interseksjonstall
- ✅ ∅-symbol for null-treff
- ✅ Gap-linjer i grafvisning (stiplede lilla)
- ✅ Klikkbare null-treff (åpne toast med ettersøk-forslag)
- ✅ Kursiv oppsummeringstekst under matrise

### Avgrensningspraksis (§6)
- ✅ Avgrensningsbadge (DelimBadge med sirkel-slash ikon)
- ✅ Manuell avgrensnings-toggle i høyrepanel
- ✅ Filter: "Avgrensning"-knapp i verktøylinje
- ⚠️ Avgrensningsantall i venstepanel under A/B/C
- ❌ Automatisk avgrensningsforslag (regex/NLP med begrunnelse)
- ❌ Stiplet ramme for foreslått (ubekreftet) avgrensning
- ❌ "Bekreft/Avvis"-interaksjon med begrunnelsesvisning

### Reguleringsversjon (§7)
- ✅ Reguleringsfilter (toggle i toolbar, state i UiState)
- ✅ Gul advarselsboks i Resultater-seksjonen
- ✅ Dimming av gammel-regulering-noder til 20% opacity

### Listevisning (§8a)
- ✅ Sortering: Kategori (default), Siteringer, Dato
- ✅ Filtre: Alle, Avgrensning, Ulest
- ✅ Avkrysningsboks for lesestatus med grønn hake
- ✅ Nodetypeikon + saksnummer + A/B/C-badge + signalprikker
- ✅ Undertittel, dato, utfall, siteringer
- ✅ Valensindikatorer (ValencePip: ✓/↔/✕)
- ✅ Inline-advarsel ved "Siteringer"-sortering
- ✅ Dimming i stedet for fjerning (dimmede noder sortert sist)
- ⚠️ Avgrensningsbadge inline i rad (implementert men verifiser plassering)

### Grafvisning (§8b)
- ✅ Hierarkisk layout med tre lag (D3 + dagre)
- ✅ Nodeform koder type (rekt/sirkel/diamant)
- ✅ Lagetiketter i venstre margin
- ✅ Zoom/pan (scroll + kontroller med slider)
- ✅ GraphTooltip ved hover
- ✅ GraphLegend
- ✅ Progressiv ekspansjon med aggregatbokser (§12)
- ✅ "Reorganiser"-knapp
- ✅ Seed-markering (fylt prikk) på noder
- ✅ Iterasjonspill under noder ("iter. 2")
- ✅ A/B/C-badge overlegg på noder
- ✅ Lest-markering (grønn sirkel) på noder
- ✅ Søk/filtrering i graf-toolbar (saksnr, bestemmelse)
- ✅ Type-filterpills (Best., KOFA, EU, Forarb.)
- ✅ Kategori-filterpills (A, B, C)
- ⚠️ Nodestørrelse koder siteringer (layout.ts har nodeSize())

### Kantvalens (§9)
- ✅ Linjestil: heltrukket (bekreftende), lang-stiplet (avgrensende), kort-stiplet (fravikende)
- ✅ Fargekoding per valens
- ✅ Valenslegende i graf
- ✅ Valensindikatorer i listevisning (ValencePip)
- ✅ Valens i høyrepanel relasjoner
- ⚠️ Data: all valens er "ukjent" (NLP ikke implementert)

### Høyrepanelet (§10)
- ✅ Oversiktsmodus: header, metadata, relasjoner, notater, handlinger
- ✅ Lesemodus: full avgjørelsestekst med AI-kuratering (CaseReader)
- ✅ "Les avgjørelsen →" / "← Tilbake til oversikt" toggle
- ✅ Gulmarkerte sitater (dempet gul bakgrunn)
- ✅ AI-kommentarer med gullbrun venstekant (trust boundary)
- ✅ Avsnittnavigering (klikkbare pills)
- ✅ Kryssreferanse-navigasjon ("→ Gå til 2022/789 §38")
- ✅ Mine notater
- ✅ "Marker som lest" toggle
- ✅ Kuratert modus som default (bare markerte avsnitt med full opacity)
- ✅ Klikk på dimmet avsnitt for å ekspandere
- ✅ Toggle "Vis all tekst / Vis bare markerte"
- ✅ Lesesti / brødsmulesti for kryssreferanse-navigasjon
- ⚠️ AI-kuraterte avsnitt i oversiktsmodus (forhåndsvisning med "Les i kontekst →")
- ❌ ProvisionDetail: direktivgrunnlag med implementeringstype
- ❌ EU-dom detaljer (partsnavn størst, direktivartikkel-kobling)
- ❌ Forarbeid-detaljer (proposisjonsnummer, relevant seksjon)

### Signalprikker R/F/V (§11)
- ✅ Tre-prikks indikator med fylt/tom
- ✅ I listevisning inline etter badge
- ✅ I høyrepanelets header
- ✅ Hover/title-tekst ("R: Referansetabell F: Fulltekst V: Vektor")

### Filtrering — dimming (§15)
- ✅ Dimming i graf (regulasjon, søk, type, kategori)
- ✅ Dimming i listevisning (15-25% opacity i stedet for fjerning)
- ✅ Dimmede noder forblir klikkbare
- ✅ Aggregatbokser dimmes ved filter

### Designtokens (§17)
- ✅ Varm papirpalett (bakgrunn, tekst, rammer)
- ✅ Nodetypefarer (blågrå, gullbrun, sjøgrønn, fiolett, varm grå)
- ✅ Semantiske farger (success, warn, danger, gap, delim)
- ✅ AI-kuratering farger (highlight, aiComment, aiCommentBg)

### Interaksjonsdetaljer (§32)
- ✅ Persistent valgt node på tvers av visninger (selectedNodeId i global state)
- ✅ Hover-forhåndsvisning i graf (GraphTooltip)
- ✅ Subtil tilbakemelding / toasts (Toast.svelte)
- ✅ Tomme tilstander med handlingshenvisning
- ✅ Lesesti / brødsmulesti i høyrepanel
- ❌ Metodefase i arbeidsstripe ("Screening · 4 av 8 lest")
- ❌ Tastatursnarveier (↓/↑, M, R, Esc, S, 1-4, ?)
- ❌ Drag-to-select i graf
- ❌ Lastetilstand for AI-kuratering (pulserende gullbrun venstekant)

---

## Fase 2 — AI-integrasjon

### Lag 1: Deterministiske verktøy (§19)
- ❌ Vektor-seed fra problemstilling (auto-generering)
- ❌ Forslag til relevante bestemmelser (chips med stiplet ramme under seeds)
- ❌ Vinkelrotasjons-begreper (alternative FTS-terms ved lave treff)
- ❌ Automatisk avgrensningsforslag med begrunnelse

### AI-kuratert leseopplevelse (§10, implementert i Sprint 5)
- ✅ Gulmarkerte avsnitt med AI-relevance
- ✅ AI-kommentarer med gullbrun trust boundary
- ✅ Kryssreferanselenker mellom saker
- ✅ Curation cache (curation_cache.py)
- ❌ Progressiv berikelse (tekst vises først, AI fader inn)
- ❌ Konfidensintensitet på gulmarkering (sterk/svak gul)

### Sparringspartner — chatpanel (§20)
- ❌ Bunnpanel-skuff i midtpanelet (lukket/halvåpen/fullskjerm)
- ❌ Fast kontekstlag (~2000 tokens arbeidsøkt)
- ❌ Dynamisk kontekstlag via MCP-verktøy
- ❌ Innebygd devil's advocate i alle svar
- ❌ Periodiske ubedde utfordringer (bekreftelsesbias-motgift)
- ❌ Klikkbare referanser i chat (åpner i høyrepanel/graf)

### Navigasjon og UX
- ✅ Lesesti/brødsmulesti i høyrepanel
- ❌ Lastetilstand med pulserende border under AI-generering
- ❌ Språkmønster-identifisering (§29)

---

## Fase 3 — Analytiske utvidelser

- ❌ Rettssetningsregister (§21) — register over rettslige utsagn på tvers av saker
- ❌ Tidslinjevisning (§22) — horisontal tidslinje gruppert per bestemmelse
- ❌ Eksport som arbeidsnotat (§23) — Markdown/docx med struktur
- ❌ Sammenligningsmodus (§24) — side-by-side i høyrepanel
- ❌ Sesjonslogg (§26) — "hvor var jeg?" med AI-foreslått neste steg
- ❌ Direktivartikkel-overlay i graf (§30)
- ❌ Tastatursnarveier (§32)
- ❌ Metodefase i arbeidsstripe (§32)

---

## Fase 4 — Portefølje og avansert

- ❌ Porteføljevisning (§25) — alle aktive analyser med status
- ❌ Krysspollinering mellom analyser
- ❌ Mønstergjenkjenning på tvers av saker (§28)
- ❌ Datakvalitetsindikatorer (§27) — confidence per kant
- ❌ Bekreftelsesbias-motgift — periodiske ubedde utfordringer
- ❌ Drag-to-select i graf

---

## Backend / Data

- ✅ Traversal med 3-signal (R/F/V) og A/B/C-kategorisering
- ✅ Case detail med avgjørelsestekst, referanser
- ✅ Provision detail med lovtekst, struktur, referansesaker
- ✅ AI-kuratering (Claude Sonnet 4) med highlights + cross-references
- ✅ Kuratering-cache
- ✅ Supabase-integrasjon
- ⚠️ Vektor-søk signal (V) — trenger verifisering av search_kofa_decision_text RPC
- ❌ Valens-NLP på kofa_case_references.context
- ❌ Confidence-scoring på kanter
- ❌ Forarbeider-embeddings (1.186 seksjoner uten)
- ❌ Broken edge-håndtering (kofa_case_references uten FK)

---

## Oppsummering

| Fase | Totalt | ✅ | ⚠️ | ❌ |
|------|--------|----|----|------|
| Fase 1 — MVP | ~58 | ~48 | ~5 | ~5 |
| Fase 2 — AI | ~16 | 5 | 0 | 11 |
| Fase 3 | 8 | 0 | 0 | 8 |
| Fase 4 | 6 | 0 | 0 | 6 |

**Fase 1 er ~90% komplett.** Gjenværende hull:
1. Nodedetaljer for EU-dommer, forarbeider, bestemmelser (ProvisionDetail, EuCaseDetail)
2. Automatisk avgrensningsforslag (avhenger av NLP/AI)
3. Tastatursnarveier
4. Lastetilstand for AI-kuratering
5. Metodefase i arbeidsstripe

**Fase 2 er ~30% komplett** — AI-kuratert leseopplevelse og brødsmulesti fungerer. Lag 1-verktøy og chatpanel mangler.

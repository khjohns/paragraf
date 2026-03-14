# Paragraf — Guidet analyseprosess

> Dette dokumentet beskriver samspillet mellom juristen, appen og Claude gjennom en rettskildeanalyse. Det er et supplement til designspesifikasjonen og SKILL.md, og fokuserer på *hvordan* prosessen orkestreres i Paragraf — hvem gjør hva, når, og med hvilken kontekst.
>
> **Visuelle referanser:** Flere steg har tilhørende interaktive mockups i `docs/design/`:
> - Scoping (steg 0): `paragraf-scoping-concept.jsx`
> - Screening-delegering (steg 2): `paragraf-screening-concept.jsx`
> - Porteføljevisning: `paragraf-portfolio-concept.jsx`
> - Sparringspartner (tilgjengelig under hele prosessen): `paragraf-chat-concept.jsx`

---

## 1. Grunnprinsippet

Metodikken (SKILL.md) er designet som en batch-drevet prosess med varige artefakter. Paragraf gjør tre ting med denne prosessen:

1. **Persisterer alt.** Plan, kandidatliste, screeningresultater, notater, rettssetninger — alt lagres i databasen. Ingen tilstand lever bare i Claudes kontekst.
2. **Orkestrerer.** Appen vet hvilken batch som er aktiv, hva som gjenstår, og når den skal stoppe og vente på juristen.
3. **Gir fleksibilitet.** Juristen velger *per steg og per sak* hvor mye Claude gjør. Alt fra «Claude driver hele prosessen» til «jeg gjør alt selv» — og alle mellomvarianter.

Claude er en statsløs arbeider. Appen er orkestratoren. Juristen er beslutningstakeren.

---

## 2. Roller

| Rolle | Gjør | Gjør ikke |
|-------|------|-----------|
| **Appen** | Søk (SQL/FTS/vektor), A/B/C-kategorisering, gap-analyse, persistering, fremdriftssporing, orkestrering av Claude-kall, visning | Rettslig vurdering, screening, syntese |
| **Claude** | Vurderer problemstilling, screener saker, identifiserer rettssetninger, foreslår vinkelrotasjon, skriver notatutkast, verifiserer sitater | Husker tilstand mellom kall, tar beslutninger uten juristens godkjenning |
| **Juristen** | Definerer problemstilling, godkjenner seeds, leser saker, verifiserer Claudes arbeid, skriver vurderinger, tar rettslige konklusjoner | Manuelt søk (appen gjør det), manuell kategorisering (appen gjør det) |

---

## 3. Prosessens steg

### Steg 0: Problemstilling og scoping

> Visuell referanse: `paragraf-scoping-concept.jsx`

**Trigger:** Juristen klikker «Kartlegg ny problemstilling» i porteføljen.

**Brukerinteraksjon — tre faser:**

*Fase 1 (blankt felt):* Juristen skriver problemstillingen fritt i et tekstfelt. Ingen skjemafelter, ingen valg — bare tekst og én knapp («Vurder med Claude»). Terskelen er minimal. Teksten kan være uformell eller presis.

*Fase 2 (Claudes forslag):* Appen viser et strukturert forslag som juristen kan redigere — alle felter er klikkbare. Forslaget inneholder: presisert problemstilling, delproblemstillinger, kontekst (prosedyre, tjenesteområde, marked, terskelverdi), bestemmelser med verifisert ordlyd, søkestrategi i menneskelig lesbare termer, og Claudes begrunnelse (kollaperbar). Juristen godkjenner, justerer, eller ber Claude revidere.

*Fase 3 (søk):* Appen kjører søk deterministisk og viser fremdrift per søketype.

**Stegindikator** øverst viser progresjonen: Problemstilling → Scoping → Søk → Kandidater.

**Claude-kall (1 kall, ~8-12K tokens):**

Appen sender problemstillingen til Claude med:
- System-prompt: scopingregler fra SKILL.md
- Brukerens tekst
- *Ingen* avgjørelsestekster — bare problemstillingen

Claude returnerer strukturert JSON:
```json
{
  "refined_problem": "...",
  "sub_problems": ["...", "..."],
  "context": { "procedure": "...", "serviceArea": "...", "market": "...", "threshold": "..." },
  "primary_provisions": ["anskaffelsesforskriften:16-12"],
  "secondary_provisions": ["anskaffelsesforskriften:16-5", "anskaffelsesforskriften:16-6"],
  "suggested_fts_terms": ["utvelgelseskriterier", "utvelgelse kvalifiserte"],
  "suggested_vector_query": "Begrensning av antall kvalifiserte kandidater ved forhandlet prosedyre",
  "search_strategy_reasoning": "...",
  "key_connection": "§ 16-12 krever objektive kriterier — disse må forankres i kvalifikasjonskravene i § 16-5..."
}
```

**Appen gjør (deterministisk, 0 Claude-kall):**
- Henter ordlyd for alle bestemmelser via `lovdata_sections` — verifiserer at de eksisterer
- Viser bestemmelsene med ordlyd og verifiseringshake (grønn = i databasen, gul = hentet via web for EU-direktiver)
- Viser søkestrategien i menneskelig lesbare termer: «Alle KOFA-saker som refererer § 16-12», «Saker som refererer både § 16-12 og § 16-5 (interseksjon)» — ikke funksjonskall
- Lar juristen redigere alt: problemstilling, bestemmelser, søkebegreper, vektorsøk
- Viser Claudes nøkkelkobling (forholdet mellom bestemmelsene) som AI-markert kommentar

**Sjekkpunkt:** Juristen godkjenner eller justerer scopet. Ingenting skjer videre før dette.

**Persistering:** Analyse opprettes i databasen med problemstilling, seeds, status `scoping_complete`.

---

### Steg 1: Søk og kandidatidentifisering

**Trigger:** Juristen godkjenner scopet.

**Appen gjør (deterministisk, 0 Claude-kall):**

Hele søket er SQL-spørringer og embedding-søk direkte mot Supabase:

1. **Referansetabell:** `SELECT * FROM kofa_law_references WHERE law_section LIKE '16-10%' AND regulation_version = 'new'` → henter alle `sak_nr` som refererer seed-bestemmelsene
2. **Interseksjon:** Saker som refererer *flere* seed-bestemmelser identifiseres via GROUP BY/HAVING
3. **FTS:** `SELECT * FROM kofa_decision_text WHERE search_vector @@ to_tsquery('norwegian', 'forpliktelseserklæring')` → henter saker via fulltekstsøk
4. **Vektorsøk:** Embedding av vektor-seeden → cosine similarity mot `kofa_decision_text.embedding` → henter semantisk like saker
5. **A/B/C-kategorisering:** Interseksjon av de tre signalene. A = alle tre. B = to. C = ett.
6. **Gap-matrise:** Bestemmelsespar uten felles treff identifiseres.

**Visning:**
Kandidatlisten vises i Paragrafs listevisning med A/B/C-badges, signalprikker, gap-matrise i venstrepanelet — alt som allerede er designet. Ingen ny UI nødvendig.

**Sjekkpunkt:** Juristen ser kandidatlisten. Analyse-status settes til `candidates_ready`.

---

### Steg 2: Screening — den fleksible kjernen

> Visuell referanse: `paragraf-screening-concept.jsx`

**Trigger:** Juristen ser kandidatlisten og bestemmer screeningstrategi.

Dette er steget med mest fleksibilitet. Juristen velger *per kategori og per sak* hva Claude skal gjøre.

#### Layout

To-kolonne-layout: venstresiden (280px) er delegerings-kontroller, høyresiden er sakslisten gruppert per A/B/C. Dette er et *mellomsteg* — ikke det fullstendige tre-panel-arbeidsrommet. Når juristen klikker seg inn i en sak for å lese, åpnes det fullstendige arbeidsrommet.

#### Fleksibilitetsmodellen

Venstepanelet viser kategorikontroller — tre knapper per gruppe:

```
A-saker (5)    [ Claude screener ] [ Jeg leser ] [ Velg per sak ]
B-saker (6)    [ Claude screener ] [ Jeg leser ] [ Velg per sak ]
C-saker (4)    [ Claude screener ] [ Jeg leser ] [ Velg per sak ]
```

I sakslisten har hver rad en kompakt to-delt toggle: AI | Person. Når juristen overrider en enkeltsak (via toggle på raden), bytter kategorien automatisk til «Velg per sak» — appen følger juristens intensjon uten ekstra klikk.

Valgene er ikke eksklusive — juristen kan la Claude screene en A-sak *og* lese den selv etterpå. Claudes screening er et første lag, ikke en erstatning.

#### Claudes screening (per sak)

**Claude-kall (1 kall per sak, ~12-18K tokens per kall):**

Appen sender:
- System-prompt: screening-malen fra SKILL.md
- Avgjørelsestekst: kun `section = 'vurdering'`-avsnittene fra `kofa_decision_text` (halverer tokens vs. full tekst)
- Problemstillingen og seed-bestemmelsene (for kontekst)
- *Ikke* andre sakers screeningresultater (statsløst — ingen kryssreferanser i dette steget)

Claude returnerer strukturert JSON med fem lag (basert på ekte screening-output):
```json
{
  "case_id": "2024/2019",
  "star": true,
  "factum": "Oslobygg KF kunngjorde begrenset anbudskonkurranse for rammeavtale arkitekttjenester...",
  "assessment": "Nemnda fant at utvelgelseskriteriet var lovlig. § 14-1(3) bokstav d nr. 3 krever...",
  "legal_propositions": [
    {
      "text": "Ved begrenset anbudskonkurranse trenger ikke utvelgelseskriteriet å spesifisere ethvert vurderingsmoment. Det avgjørende er at kriteriet angir tydelige ytre rammer.",
      "paragraph": 27,
      "type": "established"
    }
  ],
  "key_quotes": [
    { "text": "«Bestemmelsen stiller ikke krav om at ethvert vurderingsmoment skal angis...»", "paragraph": 24 },
    { "text": "«...utvelgelseskriteriene er egnet til å skille leverandørene fra hverandre...»", "paragraph": 27 },
    { "text": "«...tydelige ytre rammer for hva som kan være relevant å hensynta...»", "paragraph": 30 }
  ],
  "nuances": "Momentene må «naturlig falle inn under» kriteriets rammer — hadde de ligget utenfor, ville det vært ulovlig.",
  "counterarguments": "Klager anførte at vurderingsmomentene ikke var angitt på forhånd...",
  "relevance": "A",
  "relevance_reasoning": "Direkte parallell: arkitekttjenester + § 16-12 utvelgelseskriterier. Gullkandidat."
}
```

**De fem lagene — og hvorfor alle er nødvendige:**
1. **Rettssetning** — det som mater rettssetningsregisteret og overlever til syntese. Vises visuelt løftet.
2. **Faktum + vurdering** — konteksten rettssetningen gjelder innenfor.
3. **Nøkkelsitater med avsnittsnumre** — ordrett fra avgjørelsesteksten. Juristens verifikasjonsgrunnlag. Hvert avsnittsnummer er klikkbart og åpner avgjørelsen i lesemodus.
4. **Nyanser og forbehold** — kvalifikasjonene som begrenser rettssetningen. Like viktige som rettssetningen selv.
5. **Relevansvurdering med begrunnelse** — ikke bare A/B/C, men *hvorfor*.

`star: true` markerer «gullkandidater» — saker med ekstraordinær relevans for problemstillingen.

**Persistering:** Screeningresultater lagres per sak i databasen. Rettssetninger extraheres og legges i rettssetningsregisteret med `source: 'ai_screening'` og `confirmed: false`.

**Parallellisering og streaming:** Appen spawner 3-5 screening-kall parallelt. Resultater vises etter hvert som de er klare — saken som screenes nå har en pulserende bakgrunn, spinner i statuskolonnen, og «Leser 2024/2019…» i venstepanelet. Juristen kan begynne å lese ferdige resultater mens andre saker screenes.

#### Visning av screeningresultater

Saker Claude har screenet vises med screeningresultatet ekspanderbart under raden i listen. Visuell hierarki:
- **Rettssetningen** øverst — gulmarkert bakgrunn, mest synlig
- **Faktum + vurdering** — kompakt tekst
- **Nøkkelsitater** — kollaperbare (lukket som default, åpner med klikk). Sitater i hvit boks med avsnittsnummer som klikkbar monospace-lenke
- **Nyanser** — kollaperbare, kursiv styling
- **Handlinger** — «Les hele avgjørelsen» og «Re-screen med mer kontekst»

#### Tverrgående rettssetninger (etter screening)

Når screening er ferdig, kan appen eller Claude identifisere *tverrgående* rettssetninger — mønstre på tvers av sakene. Disse er grunnlaget for rettssetningsregisteret (designspesifikasjonens seksjon 21) og organiseres per tema:

1. Krav til utvelgelseskriterier
2. Utvelgelse ≠ kvalifikasjon
3. Referanser og egne erfaringer
4. Skjønnsrommet ved evaluering
5. Etterprøvbarhet og begrunnelsesplikt

Tverrgående rettssetninger identifiseres i et eget Claude-kall (~10-15K tokens) etter at alle saker er screenet, med alle rettssetninger og nøkkelsitater som input.

#### Juristens egen screening

Når juristen velger «Jeg leser» for en sak, åpnes den i høyrepanelets lesemodus med AI-kuratering (gulmarkering, kommentarer, kryssreferanser — allerede designet). Juristen leser, noterer, og markerer som lest.

Juristen kan også lese saker Claude har screenet — Claudes oppsummering vises øverst i høyrepanelet med tydelig AI-markering, og full avgjørelsestekst er tilgjengelig under.

#### Visning av screeningresultater

Saker Claude har screenet vises i listevisningen med en «Screenet»-badge (AI-markert). Klikk åpner høyrepanelet med:
1. Claudes strukturerte oppsummering (faktum, vurdering, rettssetninger) — med gullbrun venstrekant
2. Full avgjørelsestekst under (fra databasen) med AI-gulmarkering av avsnittene Claude refererte
3. Juristens egne notater

**Sjekkpunkt:** Appen viser fremdrift — «8 av 12 screenet (3 Claude, 2 deg, 3 gjenstår)». Analyse-status: `screening_in_progress` → `screening_complete` når alle er behandlet.

---

### Steg 3: Ettersøk og iterasjon

**Trigger:** Screening er ferdig (eller tilstrekkelig — juristen kan gå videre tidlig).

**Appen gjør (deterministisk, 0 Claude-kall):**
- Oppdaterer gap-matrise basert på hva som er funnet
- Identifiserer bestemmelsespar som fortsatt har null treff
- Beregner søkedekning — hvilke seed-begreper ga treff, hvilke ga lite

**Claude-kall (1 kall, ~8-10K tokens):**

Appen sender:
- Screeningresultatene (komprimert — rettssetninger og relevansvurderinger, ikke full oppsummering)
- Gap-matrisen
- Problemstillingen og seeds

Claude returnerer:
```json
{
  "suggested_new_fts_terms": ["råder over", "underleverandør + kvalifikasjon"],
  "suggested_new_vector_query": "Skillet mellom binær og kvantitativ rådighet over støttende virksomhets ressurser",
  "suggested_new_provisions": ["anskaffelsesforskriften:16-3"],
  "reasoning": "Screening avdekket at nemnda skiller mellom binær og kvantitativ rådighet — dette begrepet bør søkes eksplisitt...",
  "identified_patterns": [
    "Praksis etter 2022 stiller strengere krav enn praksis før",
    "EU-dom C-324/14 er sentral men kun 2 av 8 saker refererer den direkte"
  ]
}
```

**Appen kjører nytt søk (deterministisk)** med de nye seedsene. Nye kandidater identifiseres og legges til med `iteration: 2`. Prosessen gjentar steg 2-3 til juristen vurderer at dekningen er tilstrekkelig.

**Sjekkpunkt:** Juristen ser nye kandidater. Bestemmer om flere iterasjoner er nødvendig.

---

### Steg 4: EU-dom-screening

**Trigger:** Kan kjøres parallelt med steg 2-3, eller som eget steg etterpå.

**Appen gjør (deterministisk):**
- Identifiserer EU-dommer referert fra screenede KOFA-saker via `kofa_eu_references`
- Rangerer etter antall referanser — EU-dommer sitert av mange KOFA-saker er viktigere
- Filtrerer: EU-dommer som bare nevnes i forbifarten (identifisert via kort `context`-felt i `kofa_eu_references`) kan flagges som lavprioritet

**Claude-kall (1 per EU-dom, ~10-15K tokens):**
- Sender EU-domtekst fra `kofa_eu_case_law.full_text` (kun relevante seksjoner hvis mulig)
- Screening-mal tilpasset EU-dommer (direktivartikkel-fokus)
- Returnerer strukturert oppsummering med direktivkobling

**Sjekkpunkt:** Juristen ser EU-dom-oppsummeringer. Vurderer relevans.

---

### Steg 5: Syntese — notatutkast

**Trigger:** Juristen bestemmer at screening er tilstrekkelig og klikker «Generer notat».

**Claude-kall (1 kall, ~25-35K tokens):**

Dette er det mest krevende kallet. Appen sender:
- Problemstilling og delproblemstillinger
- Alle screeningresultater (komprimert: rettssetninger, nøkkelsitater, relevansvurderinger — ikke fulle oppsummeringer)
- Rettssetningsregisteret med spenninger
- Gap-analyse
- Juristens egne notater (komprimert)
- EU-dom-oppsummeringer

Claude returnerer et strukturert notat i markdown:
- Problemstilling
- Rettslig utgangspunkt (bestemmelser + ordlyd)
- Systematisk gjennomgang av praksis, organisert per delproblemstilling
- Rettssetninger med utvikling
- Spenninger og uavklarte spørsmål
- Foreløpig vurdering (markert som utkast — juristen eier konklusjonen)

**Viktig:** Notatet inneholder seksjoner markert `[JURISTENS VURDERING]` der Claude bevisst ikke trekker konklusjoner. Disse er juristens arbeid.

**Persistering:** Notatet lagres som markdown i databasen, knyttet til analysen.

**Sjekkpunkt:** Juristen ser notatutkastet. Redigerer, legger til vurderinger, korrigerer.

---

### Steg 6: Kvalitetssikring

**Trigger:** Juristen har redigert notatet og ber om QA.

**Claude-kall (2-3 kall, ~8-12K tokens per kall):**

QA kjøres som separate, fokuserte kall:

1. **Sitatverifisering:** Appen henter avgjørelsestekst for de viktigste sitatene i notatet via `kofa_decision_text`. Claude sammenligner ordrett — er det trunkering som fjerner kvalifikasjoner?
2. **Logisk konsistens:** Claude leser notatet og sjekker om konklusjonene følger av praksisen. Flaggar sprang i argumentasjonen.
3. **Dekning:** Appen sjekker mekanisk: er det A-kandidater som ikke er behandlet i notatet? Claude vurderer om utelatelsen er rimelig.

Resultater vises som en QA-rapport med flaggede problemer — juristen avgjør hva som endres.

---

### Steg 7: Deponering

**Trigger:** Juristen godkjenner notatet.

**Appen gjør (delvis deterministisk, delvis Claude):**
- Identifiserer hvilke lovkommentarer som bør oppdateres basert på bestemmelsene i analysen
- Oppretter lovkommentarer som ikke eksisterer (etter skjelett fra SKILL.md)
- Claude genererer deponeringsbidrag per bestemmelse (~5K tokens per kall) — komprimert funn fra notatet, formatert for lovkommentar-strukturen
- Juristen godkjenner deponeringen per bestemmelse

**Analyse-status:** `completed`.

---

## 4. Kontekststyring

### Prinsipp: capsule per kall

Hvert Claude-kall er selvstendig. Ingen kall forutsetter kontekst fra tidligere kall. All nødvendig kontekst sendes eksplisitt.

### Kontekstbudsjett per steg

| Steg | Kall | Tokens inn | Tokens ut | Parallelliserbart |
|------|------|-----------|-----------|-------------------|
| 0. Scoping | 1 | ~5K | ~3K | Nei |
| 1. Søk | 0 | — | — | — |
| 2. Screening (per sak) | N | ~12-18K | ~3K | Ja (3-5 parallelle) |
| 2b. Tverrgående rettssetninger | 1 | ~10-15K | ~3K | Nei (etter screening) |
| 3. Ettersøk | 1 | ~8-10K | ~2K | Nei |
| 4. EU-screening (per dom) | M | ~10-15K | ~3K | Ja (2-3 parallelle) |
| 5. Syntese | 1 | ~25-35K | ~8-12K | Nei |
| 6. QA | 2-3 | ~8-12K | ~2K | Delvis |
| 7. Deponering | K | ~5K | ~2K | Ja |

**Typisk total for en analyse med 12 saker og 2 EU-dommer:**
~200-280K tokens totalt, fordelt over ~22-28 kall. Vesentlig lavere enn ~500K i én sammenhengende sesjon.

### Hva sendes i hvert kall

**Screening-kall:** System-prompt (screening-mal, ~1K) + problemstilling (~200) + seed-bestemmelser med ordlyd (~1K) + avgjørelsestekst, kun vurdering (~8-15K). Ikke: andre sakers resultater, gap-matrise, juristens notater.

**Syntese-kall:** System-prompt (syntese-mal, ~1K) + problemstilling + delproblemstillinger (~500) + rettssetningsregister (~2K) + komprimerte screeningresultater (~15-25K, avhenger av antall saker) + gap-analyse (~500) + juristens notater (~1-3K). Ikke: fulle avgjørelsestekster.

**Komprimeringslaget** er screeningresultatene. Når Claude screener en sak på 15K tokens, produserer den en oppsummering på ~3K tokens. Syntese-kallet bruker oppsummeringene, ikke originaltekstene. Det er denne komprimeringen som gjør det mulig å syntetisere 12 saker i ett kall.

---

## 5. Screeningfleksibilitet i detalj

### Brukerens valg

Appen presenterer valg på to nivåer:

**Kategorinivå (default):**
```
A-saker (3)    ○ Jeg leser alle    ● Claude screener alle    ○ Jeg velger per sak
B-saker (5)    ○ Jeg leser alle    ● Claude screener alle    ○ Jeg velger per sak
C-saker (4)    ○ Jeg leser alle    ○ Claude screener alle    ● Jeg velger per sak
```

**Saksnivå (ved «Jeg velger per sak»):**
```
C-saker:
  ☐ 2019/890  §16-10 ikke anvendelig     [ Claude ]  [ Jeg leser ]
  ☑ 2017/678  Gammel FOA — støttende      [ Claude ]  [ Jeg leser ]  ← gammel reg., dimmet
  ☐ 2022/111  Avgrensning                 [ Claude ]  [ Jeg leser ]
  ☐ 2021/445  Perifer referanse           [ Claude ]  [ Jeg leser ]
```

### Hybrid-modell

Juristen kan kombinere fritt:
- Claude screener alle B- og C-saker
- Juristen leser A-saker selv
- Juristen leser etterpå *også* de Claude-screenede sakene hun synes er interessante
- Juristen ber Claude re-screene en sak med mer kontekst (f.eks. inkluder bakgrunnsseksjonen også)

### Rekkefølge

Anbefalt rekkefølge (appen foreslår, juristen overstyrer):
1. Claude screener alle saker (raskest — parallelle kall)
2. Juristen leser A-saker med Claudes screening som forhåndsvisning
3. Juristen skanner B/C-oppsummeringer og velger hvilke som krever fordypning

Men juristen kan velge omvendt rekkefølge (les først, Claude etterpå) eller en helt annen tilnærming.

### Visuell status per sak

I listevisningen vises screeningstatus per sak:

| Status | Visuelt |
|--------|---------|
| Ikke screenet | Ingen markering |
| Claude-screenet | Gullbrun «Screenet»-badge (AI-markert) |
| Lest av juristen | Grønn hake |
| Begge deler | Grønn hake + gullbrun badge |

---

## 6. Sjekkpunkter og brukerens kontroll

### Appen stopper alltid ved

1. **Etter scoping (steg 0):** Juristen må godkjenne problemstilling, bestemmelser og seeds
2. **Etter kandidatliste (steg 1):** Juristen ser kandidatene og velger screeningstrategi
3. **Etter screening (steg 2):** Juristen ser resultatene, verifiserer, noterer
4. **Etter ettersøk-forslag (steg 3):** Juristen godkjenner nye seeds
5. **Etter notatutkast (steg 5):** Juristen redigerer og godkjenner
6. **Etter QA (steg 6):** Juristen vurderer flaggede problemer
7. **Etter deponering (steg 7):** Juristen godkjenner per lovkommentar

### Appen kjører aldri automatisk mellom sjekkpunkter

Det er fristende å la appen kjøre steg 0-2 uten stopp — «skriv problemstilling, trykk søk, se resultater.» Men juristen *må* se og godkjenne scopet (steg 0) før søket kjører. Grunnen: feil bestemmelser i scopet gir feil søkeresultater som gir feil analyse. Kostnaden for å stoppe er lav (ett klikk for å godkjenne). Kostnaden for å ikke stoppe er høy (hele analysen bygger på feil grunnlag).

### Juristen kan hoppe over steg

Ikke alle analyser trenger alle steg. Juristen kan:
- Hoppe over Claude-screening og lese alt selv
- Hoppe over ettersøk hvis dekningen virker tilstrekkelig
- Hoppe over syntese og skrive notatet selv
- Hoppe over QA
- Hoppe over deponering

Appen foreslår neste steg, juristen bestemmer.

---

## 7. Fremdriftsvisning

Venstrepanelet viser analysens fremdrift gjennom metodikken:

```
① Problemstilling              ✓ Godkjent
② Søk                          ✓ 12 kandidater (3A + 5B + 4C)
③ Screening                    ◐ 8 av 12 (3 Claude, 2 meg, 3 gjenstår)
④ Ettersøk                     ○ Ikke startet
⑤ Syntese                      ○ Ikke startet
⑥ QA                           ○ Ikke startet
⑦ Deponering                   ○ Ikke startet
```

Hvert steg er klikkbart og viser detaljer. Aktivt steg er markert. Fullførte steg har hake. Hoppede steg er dempet.

---

## 8. Teknisk arkitektur

### API-kall-mønstre

**Synkrone kall (venter på svar):**
- Steg 0: Scoping
- Steg 2b: Tverrgående rettssetninger (etter at screening er ferdig)
- Steg 3: Ettersøk-forslag
- Steg 5: Syntese

**Asynkrone kall (parallelle, resultater strømmer inn):**
- Steg 2: Screening (3-5 parallelle)
- Steg 4: EU-screening (2-3 parallelle)
- Steg 6: QA (2-3 delvis parallelle)
- Steg 7: Deponering (parallelle per bestemmelse)

### Subagent-arkitektur

Parallelle screening-kall er i praksis subagenter — men appen spawner dem, ikke Claude. Hvert kall er en selvstendig API-forespørsel med:
- Dedikert system-prompt (screening-mal)
- Dedikert kontekst (én saks avgjørelsestekst)
- Strukturert JSON-retur

Appen samler resultatene og viser dem etter hvert som de kommer inn. Feil i ett kall påvirker ikke de andre — appen markerer saken som «screening feilet» og lar juristen prøve igjen eller lese selv.

### Feilhåndtering

- **API-feil:** Saken markeres som «feilet». Juristen kan prøve igjen eller lese selv.
- **Dårlig screening-kvalitet:** Juristen kan be om re-screening med utvidet kontekst (inkluder bakgrunnsavsnitt, eller hele teksten).
- **Token-grense nådd:** For svært lange avgjørelser, segmenterer appen teksten og sender de mest relevante avsnittene først (basert på `paragraph_number` og `section`).

### Database-endringer for analyseprosessen

Nye tabeller (tillegg til eksisterende skjema):

```
analyses
  id, user_id, title, problem, refined_problem, sub_problems,
  status (scoping|candidates|screening|post_search|synthesis|qa|complete),
  iteration, created_at, updated_at

analysis_seeds
  id, analysis_id, seed_type (provision|fts|vector|case), value,
  iteration, source (user|ai_suggested), confirmed

analysis_candidates
  id, analysis_id, sak_nr, category (A|B|C),
  signals (jsonb: {ref, fts, vec}), iteration,
  screening_status (pending|ai_screened|user_read|both),
  ai_screening (jsonb: structured result),
  user_notes, is_delimitation, confirmed_delimitation

analysis_propositions
  id, analysis_id, proposition_text, theme,
  source_case, source_paragraph, evolution_type,
  source (ai_screening|user), confirmed,
  tension_with_id

analysis_documents
  id, analysis_id, doc_type (note|export|qa_report),
  content (markdown), version, created_at
```

---

## 9. Konteksthåndtering for syntese

Syntese-kallet er det mest krevende. Her er strategien for å holde det innenfor token-budsjettet:

### Komprimeringslaget

Screeningresultatene er allerede komprimerte — fra ~15K tokens avgjørelsestekst til ~3K tokens strukturert oppsummering. For 12 saker: ~36K tokens screeningdata.

### Prioritert inkludering (capsule-mønsteret)

Hvis totalen overstiger budsjettet (~35K inn):
1. **Alltid med:** Problemstilling, delproblemstillinger, rettssetningsregister, spenninger, gap-analyse, juristens notater
2. **Prioritert:** A-sakers fulle screeningresultater (alltid med)
3. **Komprimert:** B-sakers rettssetninger + relevans (uten full oppsummering)
4. **Minimalt:** C-sakers saksnummer + rettssetning (én linje per sak)

### Token-estimering

Appen estimerer token-forbruket *før* kallet sendes og velger komprimeringsgrad automatisk. Juristen trenger ikke å vite om dette.

---

## 10. Forholdet til sparringspartneren (chatpanelet)

Den guidede prosessen og chatpanelet er to ulike interaksjonsmoduser som deler data:

- **Guidet prosess:** Strukturert, stegvis, appen orkestrerer. For systematisk kartlegging.
- **Chatpanel:** Ustrukturert, fri samtale. For å diskutere funn, stille spørsmål, utfordre mønster.

Chatpanelet er tilgjengelig *under hele prosessen* — juristen kan stille spørsmål til Claude mens hun er midt i screening. Chatpanelet har tilgang til analysens tilstand (seeds, kandidater, screeningresultater, notater) via det faste kontekstlaget beskrevet i designspesifikasjonens seksjon 20.

Viktig: chatpanelet og den guidede prosessen deler *data* men ikke *kontekst*. Et Claude-kall i chatpanelet vet ikke hva screening-kallene returnerte ordrett — det vet bare hva som er persistert i databasen (oppsummeringer, rettssetninger, notater).

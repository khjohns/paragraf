## 14. Grafvisningen (perspektiv 3)

### Hva grafen svarer på

Listen (saksoversikten) svarer på «hvilke saker har jeg, og hva vet jeg om dem?» Grafen svarer på «hvordan henger rettskildebildet sammen?» Juristen ser klynger, hull, brosaker og uventede forbindelser. Grafen er for *overblikk og oppdagelse*, ikke for produksjonsarbeid — ingen checkboxes, ingen kategoriendring, ingen bulk-operasjoner.

### Visuell retning: Kontrollert konstellasjon

Stram regi, editorial typografi på nodene. Ikke et force-directed kaos og ikke et «hacker-nettverk.» Mye luft. Tenk stjernekartalmanakk, ikke nettverksdiagram. Nodene er merkede punkter (prikk + tekst), ikke kort eller bokser.

### Datamodell

**Signaler (R/F/V) er nodeegenskaper.** De beskriver *hvordan saken ble funnet* i søket. En sak kan ha `signals: ['R', 'F', 'V']` — den ble funnet via referansesøk, fulltekstsøk og vektorsøk. Signaler har ingenting med kantene å gjøre.

**To kanttyper, begge binære:**
- *Sak → sak:* Direkte sitering i avgjørelsesteksten. Finnes eller finnes ikke. Ingen vekt, ingen signaltype.
- *Sak → bestemmelse:* Saken refererer bestemmelsen i teksten. Også binær.

*Hvorfor ingen kantvekt:* En sitering er en sitering. Hvorvidt saken siterer i ett avsnitt eller bygger hele argumentasjonen på den andre saken er viktig — men det er en kvalitativ vurdering som hører hjemme i lesevisningen, ikke som en visuell tykkelse i grafen. Tykkere kanter gir falsk presisjon.

*Hvorfor signaler ikke er kantegenskaper:* Forbindelsen mellom to KOFA-saker er alltid det samme — eksplisitt sitering i teksten. Det finnes ikke tre ulike kanttyper mellom saker. Stiplede kanter for «KI-tolket forbindelse» ville gi feil inntrykk — som om siteringen var usikker. Det usikre er om saken *burde vært med i analysen* — og det kommuniseres av kategori og signal.

### Bestemmelser som likeverdige noder

Bestemmelser er noder på lik linje med saker — ikke gravitasjonssentre. I en bestemmelsessentrert analyse (f.eks. «Krav til leverandørgrupperinger jf. §16-11») vil §16-11 naturlig trekke klynger til seg fordi mange R-kanter peker dit. Men i en prinsippsentrert analyse (f.eks. «Proporsjonalitetsprinsippets rekkevidde ved avvisning») kan det hende ingen bestemmelse er et naturlig ankerpunkt. Sakene kobles av prinsipper, begreper, resonnementer.

*Hvorfor:* Problemstillingen er det implisitte gravitasjonsfeltet, ikke én bestemmelse. A-kategoriserte saker trekkes mot sentrum uansett, og klynger dannes av forbindelsestetthet — uavhengig av om forbindelsene går via bestemmelser eller direkte mellom saker.

### Nodedesign — saker

En sak er en **prikk + referanse i mono + kilde/år i sans.** Prikken er det visuelle ankeret.

**Kategori bestemmer prikk-utseende:**
- A: Fylt `--ink`, solid. Synlig og tungtveiende.
- B: Åpen sirkel, `--border-strong` stroke. Tilstede men ikke dominerende.
- C: Åpen sirkel, `--border` stroke, 0.4 opacity. Dempet — som i saksoversikten.
- Uvurdert: Dashed `--ink-muted` stroke. Signaliserer «mangler vurdering.»

**Kategori bestemmer posisjon:** En radial kraft trekker A-saker mot sentrum, B i midtsjiktet, C og uvurderte mot periferien. Problemstillingen er det implisitte sentrum — ikke en synlig node, men kraften som organiserer rommet.

**Nodestørrelse = siteringstakt.** Ikke råtall (citedBy), men `citedBy / (nåværendeÅr - avgjørelsesÅr)`. En sak fra 2015 sitert 10 ganger er normal. En sak fra 2024 sitert 10 ganger er eksepsjonell. Takten normaliserer for alder. Siteringstallet vises som `↗12` under prikken.

*Hvorfor takt og ikke råtall:* Råtall favoriserer eldre saker systematisk og dytter ferske avgjørelser til periferien. Takt gir en fersk prinsipiell sak (høy siteringsfrekvens over kort tid) visuelt rom.

**Stjerne (★) vises ved gullkandidater** — uavhengig av siteringstall. En fersk sak med null siteringer men stjerne er «viktig, følg med.» De to signalene (siteringstakt og stjerne) kan divergere, og det er informativt — en mye sitert sak uten stjerne er «etablert men ikke sentral for *denne* analysen.»

**Søkesignaler** (R/F/V) vises som tre små fargeprikker under nodeprikken. R i `--ink-muted`, F i `--signal-fts`, V i `--ai-accent`. De er visuell metadata om oppdagelse, ikke om forbindelser.

### Nodedesign — bestemmelser

Rektangulære noder med JetBrains Mono, `--paper-dark` bakgrunn, `--border` stroke. En liten firkantet markør (5×5px, `--border-strong`) differensierer dem fra saksnoder visuelt. Bestemmelsesnoder har ingen kategori, ingen størrelsesvariasjon, ingen signaler. De er stabile referansepunkter.

### Kanter

**Siteringer (sak → sak):** Solid linje, `--edge-cite` farge (litt sterkere enn borders). Alle like — ingen tykkelse- eller fargekoding.

**Bestemmelsesreferanser (sak → bestemmelse):** Stiplet linje, `--edge-color` (svakere enn siteringer). Visuelt underordnet — bestemmelsesreferanser er kontekst, siteringer er substans.

*Hvorfor ingen piler:* Retningen er implisitt (nyere saker siterer eldre). Piler skaper visuell støy i en graf med 50+ kanter.

### Interaksjon

**Hover:** Dimmer alle noder og kanter som *ikke* er direkte forbundet med den hovrede noden. Opacity 0.04–0.08 for dimmede elementer. Effekten er umiddelbar — juristen ser øyeblikkelig nabonettet. Transition slås av under animasjon (re-simulering) for å unngå visuell støy.

**Hover-tooltip:** Etter 400ms vises KI-proposisjonen i italic serif over noden, maks to linjer. Forsvinner ved mouseout. Vises *ikke* når detaljpanelet er åpent (da klikker juristen uansett). Tooltipet er for *skanning* — juristen beveger musen over grafen og leser proposisjoner uten å klikke.

*Hvorfor forsinkelse:* Uten forsinkelse blinker tooltips opp og ned mens juristen beveger musen. 400ms er nok til at det føles intensjonelt.

**Klikk på saksnode:** Åpner detaljpanelet (380px) til høyre. Scope-panelet lukkes automatisk (panelregelen). Seleksjon vises som en dashed ring rundt nodeprikken.

**Klikk på bestemmelsesnode:** Åpner detaljpanelet med liste over alle saker som refererer bestemmelsen. Klikkbare rader for navigering.

**Klikk på bakgrunnen:** Lukker detaljpanelet og deselekterer.

### Brukermarkering (farge)

Høyreklikk på en saksnode åpner en kompakt fargevelger — 5 farger + «fjern.» Fargen vises som en ring (2.5px stroke) rundt nodeprikken, mellom prikken og den eventuelle seleksjonsringen. Markeringer overlever filtrering og re-simulering.

**Fem farger:** Rosa (#D4727E), Turkis (#5AA3A3), Oransje (#C4933A), Lavendel (#9A7EB8), Salvie (#7BA37B).

*Hvorfor disse:* De unngår hele den semantiske paletten — oker (KI), fiolett (spenning), blå (fulltekst), grønn (bekreftelse), rød (nyanser), gull (stjerne). Fargene er nøytrale men distinkte.

*Hvorfor ring og ikke fyll:* Fyll kolliderer med kategori-fyll (A er fylt `--ink`). Ringen er et eget visuelt lag som kan kombineres med alle kategorier.

Markeringer er *personlige visuell hjelpemidler* — ikke faglige kategorier. Juristen bruker dem for å holde tråden: «disse fire danner en linje» → rosa. Fargene er midlertidige. De kan utvikles til en ad-hoc tematisering, men det er juristens valg.

Markeringer vises også i detaljpanelets lister (en liten fargeprikk ved raden) og i legenden med label og antall markerte.

### Isolerte noder

Saker uten synlige forbindelser i det aktive filteret merkes med «isolert» i italic under referansen og lavere opacity. Antallet vises i toolbar-baren.

*Hvorfor:* En isolert sak i en filtrert visning er et signal — enten er den feilkategorisert, genuint perifer, eller mangelfult tilkoblet i rettskildegrapen. Juristen bør se det uten å lete.

### Filtrering og re-simulering

**Kategorifilter (tab-toggle):** Identisk mønster som arbeidsflaten — «Alle (20) | Uvurdert · – (2) | Kjernesak · A (7) | Støttesak · B (7) | Kontekstsak · C (4)». Flervalg — flere kategorier kan være aktive. Alle fire aktive kollapser til «Alle.»

**Bestemmelsestoggle:** Uavhengig av kategori. En knapp merket «§» ved siden av tab-baren. Skjuler/viser bestemmelsesnoder og deres kanter.

**Re-simulering ved filterbyttet:** D3-simuleringen kjøres på nytt med bare de synlige nodene. Simuleringen tilpasser charge-styrke og link-avstand til antall noder — færre noder gir sterkere frastøting og lengre avstand, slik at grafen fyller rommet uansett filternivå.

*Hvorfor re-simulering og ikke fade-out:* Med 50–200 noder skaper fade-out store tomrom. Re-simulering gir en optimal layout for det filtrerte settet. Tap av mental modell er en reell kostnad, men med mange noder er tomrom verre.

**Animert overgang:** Noder interpoleres fra gammel posisjon til ny over 500ms med cubic easing. Auto-fit kjøres etter animasjonen for å sentere det nye bildet. CSS-transitions slås av under animasjon for å unngå konflikter.

### Panelmodellen

Følger den globale panelregelen. Når grafen er aktiv: `[Nav rail 48px] [Graf fyller resten]`. Klikk på saksnode: `[Nav rail 48px] [Graf] [Detaljpanel 380px]`. Scope-panelet kan åpnes (360px) — nyttig for å se søkestrategien side om side med nettverket.

### Detaljpanelet (380px)

Slide-in fra høyre (0.25s cubic-bezier). Innhold for saker:

1. *Kategori-badge + stjerne + isolert-markering*
2. *Funnet via* — signalchips [R] Referanse, [F] Ordtreff, [V] Konsept
3. *Siteringer* — `↗12 siteringer · 1.0/år`
4. *KI-proposisjon* — italic serif, oker, border-left. Eller «Ikke screenet»-placeholder.
5. *Siterer (n)* — klikkbare rader med kategori-badge, referanse, år. Utgående siteringer.
6. *Sitert av (n)* — innkommende siteringer. Retningen er tydelig.
7. *Refererer til* — bestemmelsestags, klikkbare.
8. *Åpne i lesevisning* — knapp nederst.

Innhold for bestemmelser: Liste over alle saker som refererer bestemmelsen, med kategori-badge og år.

Markeringer vises som fargeprikker ved radene i alle lister.

### Verktøylinje

Minimal. Over grafen, i border-bottom-baren:
- Venstre: kategori-tab-toggle + bestemmelsestoggle
- Høyre: teller (`12 saker · 4 best. · 2 isolert`) + zoom-kontroller (+/−/tilpass)

Albert Sans 11px, `--border`-kanter, `--control-bg` bakgrunn. Ingen prominent toolbar — grafen selv er innholdet.

### Tegnforklaring

Kollapserbar boks, nederst til venstre. Viser: 4 kategoritilstander (A/B/C/uvurdert), 2 kanttyper (sitering/bestemmelsesref.), 3 signal-prikker (R/F/V), stjerne, siteringstakt, og eventuelle aktive brukermarkeringer med label og antall. Hint: «Høyreklikk node → marker.»

### Åpne spørsmål — grafvisningen

#### Delspørsmålsfilter
Dropdown venstre for tab-toggle: «Alle delspørsmål» → velg ett → bare relevante noder. Krever at hver sak er koblet til ett eller flere delspørsmål fra scopet (via KI-screening eller juristens vurdering). Kombineres med kategorifilter: «A-saker om solidaransvar.» Ikke designet i detalj.

#### Kronologisk akse
Toggle i toolbar: «Tid.» Legger til en svak horisontal kraft basert på år — eldre saker venstre, nyere høyre. Ikke en stram tidslinje, men en tendens. Subtile årstall langs bunnkanten i mono 9px muted. Gir «rettsutvikling»-lesning: siteringsmønsteret har en retning. Toggle av: tilbake til forbindelsesbasert layout. Ikke bygget.

#### Kryssnavigasjon
«Vis i Saksoversikten»-knapp i detaljpanelet bytter perspektiv og scroller til riktig rad. Krever delt seleksjonstilstand mellom perspektivene. Tilsvarende: «Vis i Rettssetninger» for saker knyttet til en rettssetning. Ikke bygget.

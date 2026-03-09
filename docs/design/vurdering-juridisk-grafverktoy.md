# Teknologi- og designvurdering: Interaktivt rettskildegraverktøy

## 1. Teknologivalg frontend — React vs. Svelte

### Grafbiblioteker og integrasjon

De relevante grafbibliotekene (Cytoscape.js, Sigma.js, D3) er alle vanilla JavaScript. Ingen av dem er bygget *for* et spesifikt rammeverk, så begge rammeverk wrapper dem på samme måte. Forskjellen ligger i kvaliteten på eksisterende wrappere.

React har `react-cytoscapejs` (offisiell, vedlikeholdt), `react-sigma` og `react-force-graph`. Disse er modne og godt dokumenterte. Reagraph er React-nativt (Three.js/WebGL). Svelte har ingen tilsvarende førsteklasses wrappere — du skriver dine egne Svelte-wrappere rundt vanilla-API-ene. Det fungerer, men det betyr at *du* eier integrasjonskoden og vedlikeholdet av den.

For dette prosjektet er dette en reell forskjell: grafbibliotekintegrering er det mest komplekse frontend-stykket, og ferdiglagde wrappere sparer betydelig tid.

### State management

Grafen er en tilstandsfull datastruktur der filtre, layout-posisjoner, ekspansjonstilstand, annotasjoner og valgt node alle henger sammen. Dette er *ikke* triviell tilstandshåndtering.

Svelte har elegant reaktivitet for enkel tilstand, men for kompleks, sammenflettet tilstand (der en filterendring påvirker layout, som påvirker synlige noder, som påvirker høyrepanelet) ender du med stores som fort blir vanskelige å resonnere om. Sveltes reaktivitetssystem fungerer best når dataflyt er enveis og relativt flat.

React med Zustand eller Jotai håndterer dette mønsteret bedre — ikke fordi React er «bedre», men fordi økosystemet har modne løsninger for akkurat denne typen kryssreferert tilstand. Zustand med slices-mønsteret lar deg separere graftilstand, filtertilstand og UI-tilstand mens de kan referere til hverandre.

### Vedlikeholdbarhet for liten utviklergruppe

Her peker argumentet i *begge* retninger, og det er viktig å være ærlig om det.

Svelte: mindre kode, raskere å skrive, lavere kognitiv belastning for enkle komponenter. For en enkeltperson-utvikler som kjenner Svelte, er dette reelt.

React: enormt mye lettere å finne hjelp, eksempler, ferdiglagde løsninger. Hvis utvikleren slutter eller trenger hjelp, er det vesentlig enklere å finne React-kompetanse. TypeScript-støtten i React-økosystemet er også mer moden, noe som er viktig for langsiktig vedlikehold av et domenekomplekst system.

### Samlet vurdering

Svelte er et bedre rammeverk for mange oppgaver, men for *dette* spesifikke prosjektet — der grafvisualisering er kjernefunksjonaliteten, tilstanden er kompleks og sammenflettet, og vedlikeholdbarhet trumfer alt — har React-økosystemet konkrete fordeler som ikke handler om teknisk eleganse men om praktisk tilgjengelige løsninger. Svelte er ikke feil valg, men det betyr mer egenutviklet integrasjonskode.

---

## 2. Graf-renderingsbibliotek

### Cytoscape.js

**Styrker for dette domenet:**
Cytoscape har den bredeste porteføljen av layout-algoritmer av alle kandidatene. Dagre-layouten gir hierarkisk (top-down) rendering som kan reflektere rettskildens autoritetshierarki — lov øverst, forskrift under, praksis nederst. Den har også compound nodes (gruppenoder), som er direkte anvendbart for å vise «denne paragrafen har 47 tilknyttede saker» som en visuelt kollapserbar gruppe.

Skalering: Stabil opp til ca. 1.000-1.500 noder i Canvas-modus. For 300+ noder med interaktivitet er dette komfortabelt. Ytelsen degraderer gradvis, ikke brått.

Layout-stabilitet: Cytoscape støtter `lock()`-mekanisme på noder — du kan fryse posisjonen til eksisterende noder og kjøre layout kun på nye noder. Dette er direkte svar på kravet om at eksisterende noder ikke skal flytte seg. Implementeringen krever noe arbeid (du må manuelt partisjonere noder i «låste» og «nye» før layout-kjøring), men det er en støttet operasjon.

Interaktivitet: Klikk, hover, context menu, tooltip — alt er førsteklasses. Event-APIet er modent.

**Svakheter:**
Cytoscape er Canvas-basert (ikke WebGL), så den treffer et ytelsestak ved svært store grafer. Visuelt er den funksjonell men ikke «vakker» ut av boksen — den krever styling-arbeid for å se profesjonell ut. Dokumentasjonen er grundig men spredt.

### Sigma.js (med Graphology)

**Styrker:**
WebGL-rendering gir overlegen ytelse — Sigma håndterer 10.000+ noder flytende. Hvis datasettets vekst over tid er en bekymring, gir Sigma mest headroom.

Graphology-biblioteket under gir god programmatisk graftilgang (traversering, sentralitetsberegning, filtrering).

**Svakheter for dette domenet:**
Sigma har svært begrenset støtte for hierarkiske layouts. ForceAtlas2 er den primære algoritmen, og den er *force-directed* — den reflekterer ikke autoritetshierarki, og layout-en er instabil ved inkrementell tillegg (hele grafen rebalanserer). Du *kan* pre-beregne posisjoner, men da mister du Sigmas styrke.

Sigma har ikke compound nodes. For å vise gruppering (f.eks. alle saker under en paragraf) må du implementere dette selv.

For et juridisk verktøy der hierarki og stabilitet er viktigere enn ren ytelse, er Sigmas styrker ikke godt nok tilpasset behovene.

### D3-force

**Styrker:**
Maksimal fleksibilitet. Ingen antagelser om hva grafen representerer — du bygger alt selv. For et team med sterk frontend-kompetanse og spesifikke visuelle krav kan dette være riktig.

**Svakheter for dette domenet:**
D3-force er et *fysikksimulerings*-bibliotek, ikke et grafvisualiseringsbibliotek. Alt over «sirkler med linjer mellom» er egenutviklet: node-typer, labels, interaktivitet, layout-stabilitet, clustering, paneler. For en liten utviklergruppe er dette en enorm overflate å vedlikeholde. Layout-stabilitet ved inkrementelle tillegg er mulig med `fx`/`fy`-pinning, men krever manuell koordinering.

D3 er feil abstraksjonsnivå for dette prosjektet med mindre du har spesifikke visuelle krav som ingen andre biblioteker dekker.

### Reagraph

**Styrker:**
React-nativt, 3D-kapabelt via Three.js/WebGL. Visuelt imponerende ut av boksen.

**Svakheter:**
Relativt ungt bibliotek med mindre dokumentasjon og community. 3D-visualisering ser flott ut i demoer men er kognitivt krevende for faktisk arbeid — jurister som skal bruke dette verktøyet daglig vil slite med å orientere seg i en 3D-graf. Hierarkiske layouts er begrenset.

Reagraph er interessant for demonstrasjoner men dårlig egnet som daglig arbeidsverktøy for domeneeksperter.

### vis.js / vis-network

Vis-network fortjener en kort omtale: den har hierarkisk layout og er enkel å komme i gang med, men prosjektets vedlikehold har vært ustabilt (forked som `vis-network` etter at det originale prosjektet ble forlatt). For et langsiktig prosjekt er det en risiko.

### Anbefalt retning

Cytoscape.js er det best egnede biblioteket for dette domenet. Begrunnelsen hviler på tre spesifikke egenskaper som ingen andre biblioteker har i kombinasjon: hierarkisk layout (dagre), compound nodes for gruppering, og node-locking for layout-stabilitet. Ytelsesrammen (opptil ~1.500 noder) er tilstrekkelig for bruksområdet.

---

## 3. Interaksjonsdesign — de vanskelige problemene

### Progressiv ekspansjon vs. full graf

Full graf ved oppstart er visuelt ubrukelig ved 200+ noder. Men det motsatte — å starte med én node og tvinge brukeren til å klikke seg gjennom — er tidkrevende og gir dårlig oversikt.

**Anbefalt mønster: Lagdelt avsløring med grupperte aggregatnoder.**

Første visning viser seed-noden med *aggregerte nabonoder* — ikke individuelle noder, men gruppenoder som sier «23 KOFA-saker», «4 EU-dommer», «2 lovparagrafer». Klikk på en gruppenode ekspanderer den og viser individuelle noder sortert etter sentralitet (de mest siterte først). Cytoscape compound nodes støtter dette direkte.

Denne tilnærmingen løser to problemer samtidig: den gir umiddelbar oversikt over *omfanget* av rettskildematerialet (juristen ser at det finnes 23 saker, ikke bare de 5 første), og den unngår visuell overbelastning.

Det er én viktig fallgruve: juristen må kunne *velge* hvilke grupper som ekspanderes og i hvilken rekkefølge, ellers gir progressiv ekspansjon en falsk følelse av fullstendighet. Verktøyet bør alltid vise totaltall — «viser 8 av 23 saker» — og gi mulighet til å sortere de ikke-viste.

### Layout-stabilitet

Kravet er konkret: når juristen ekspanderer en gruppenode, skal noder de allerede har studert forbli på plass. Cytoscape løser dette med en to-stegs prosess:

1. Lås alle eksisterende noder (`node.lock()`).
2. Kjør layout kun på nye noder, med constraints som plasserer dem i nærheten av forelderenoden.

Kostnaden er at layouten gradvis kan bli suboptimal — nye noder plasseres i ledige områder som kanskje ikke er ideelle. Over mange ekspansjoner kan grafen bli «klumpete». Løsningen er en eksplisitt «re-layout»-knapp som frigir alle noder og kjører full layout på nytt, med animasjon så juristen kan følge bevegelsen.

Det er viktig at re-layout er *brukerinitiiert*, aldri automatisk. Automatisk re-layout er desorienterende og bryter juristens mentale modell av grafen.

### Filtrering uten tap av kontekst

Dimming (opacity-reduksjon) i stedet for fjerning er riktig tilnærming. Implementeringen i Cytoscape er triviell — du endrer `opacity` via stylesheets basert på en dataattributt (`node.data('filtered')`) — men det *interaksjonsdesignmessige* problemet er mer subtilt:

Hva skjer med kantene? Hvis du dimmer en node men beholder kantene i full opacity, ser grafen forvirrende ut. Hvis du dimmer kantene også, forsvinner strukturen. Anbefalt løsning: dim både noder og kanter til filtrerte noder til ~15% opacity, men la *kanter mellom to synlige noder* beholde full opacity. Dette krever en kort beregning ved filterendring (iterer kanter, sjekk om begge endepunkter er synlige), men er effektivt.

En viktig designbeslutning: bør juristen kunne *klikke* på dimmede noder? Ja — klikk på en dimmet node bør åpne detaljer i høyrepanelet som normalt, men med en visuell indikator (f.eks. en «filtrert ut»-badge) som minner om at noden er utenfor filteret. Ellers blir filtrering til en «skjul og glem»-mekanisme, som motvirker formålet.

### Nodetype-differensiering

Fem nodetyper krever et visuelt kodesystem. Hovedrisikoen er kognitiv overbelastning — for mange visuelle dimensjoner gjør grafen uleselig.

**Anbefalt kodesystem (to dimensjoner, ikke flere):**

*Form* koder nodetype: rektangel for lovparagrafer (de er «byggeblokker»), sirkel for KOFA-saker (den vanligste nodetypen, bør være den enkleste formen), diamant for EU-dommer (markerer at de er «utenlandske»), trekant for norske rettsavgjørelser, sekskant for forarbeider.

*Størrelse* koder sentralitet/sitatantall: mer siterte noder er større. Dette gir umiddelbar visuell indikasjon av hvilke rettskilder som er mest sentrale i nettverket.

Ikke bruk farge som primær differensiator — farge bør reserveres for *tilstandsinformasjon*: er noden valgt? Filtrert? Annotert? Har den uverifiserte annotasjoner? Fargekoding av nodetyper i tillegg til form og størrelse gir for mange samtidige visuelle signaler.

En permanent, kompakt tegnforklaring i hjørnet av grafpanelet er obligatorisk. Den trenger ikke ta mye plass — fem ikoner med etiketter i én rad.

### Høyrepanelets innhold

Høyrepanelet bør være *ett panel med betinget innhold*, ikke separate komponenter med separate åpne/lukke-mekanismer. Begrunnelsen er enkel: juristen klikker på noder i rask rekkefølge for å skanne gjennom resultater. Hvis hvert klikk åpner et «nytt» panel med animasjon, er det forstyrrende. Et fast panel som oppdaterer innholdet er raskere og mer forutsigbart.

Implementeringen er en container-komponent (`NodeDetailPanel`) som basert på `node.type` rendrer riktig underkomponent (`KofaCaseDetail`, `LawSectionDetail`, `EuCaseDetail` osv.). Hver underkomponent har sin egen layout, men de deler felles elementer: en header med nodetype-ikon og identifikator, en «vis i graf»-knapp som sentrerer/highlighter noden, og en «ekspander fra denne»-knapp som bruker noden som ny seed.

For KOFA-saker bør panelet vise:

- Saksnummer og dato (header)
- Sakstype og utfall (som badges/tags, ikke tekst)
- Sammendrag (kollaperbart hvis langt)
- Lovhenvisninger (klikkbare — klikk markerer paragrafen i grafen)
- Annotasjoner med confidence-score (visuelt differensiert: verifiserte annotasjoner med grønt, uverifiserte med gult, lave confidence med rødt)
- Lenke til fulltekst

For lovparagrafer:

- Paragrafnummer og tittel
- Ordlyd (den faktiske lovteksten)
- Plassering i lovstrukturen (del → kapittel → paragraf)
- Antall KOFA-saker som refererer paragrafen
- Direktivgrunnlag (når `directive_implementation`-tabellen er klar)
- Relevante forarbeidskommentarer (kollaperbart)

---

## 4. Backend-arkitektur — FastAPI vs. Supabase Edge Functions

### Hva backenden faktisk gjør

Det er viktig å definere grensen tydelig: all tung databehandling — FTS, vektorsøk, recursive CTE-traversal — skjer i Postgres. Backenden er en *tynn proxy* som:

1. Autentiserer brukeren
2. Validerer og saniterer input (seed-parametre, filtere)
3. Kompilerer graf-queries (oversetter høynivå-traversal-parametre til SQL)
4. Håndterer session_id og rate limiting
5. Formaterer Postgres-resultater til graf-JSON for frontenden

### FastAPI (Python)

FastAPI er et godt valg for API-er der du trenger kontroll. For dette prosjektet er det to spesifikke fordeler: Python-økosystemet for eventuell fremtidig NLP/embedding-generering (selv om dette kan skje async), og FastAPIs automatiske OpenAPI-dokumentasjon som er nyttig for debugging.

Ulempen er hosting-kompleksitet. FastAPI krever en kjørende server (VPS, container, eller managed service som Railway/Fly.io). For en enkeltperson-drift betyr dette en ekstra infrastrukturkomponent å overvåke, oppdatere og betale for. Det er håndterbart, men det er *en ting til*.

### Supabase Edge Functions (Deno/TypeScript)

Edge Functions kjører i Supabase sin infrastruktur — du deployer en funksjon, den kjører. Ingen server å vedlikeholde. For en tynn proxy er dette operasjonelt attraktivt.

TypeScript i Deno er godt egnet til SQL-kompilering og JSON-transformasjon, som er hovedoppgavene.

Ulempene er reelle men begrensede for dette bruksområdet: 60-sekunders maksimal kjøretid (mulig problem for dype traversaler med vektorsøk), kaldstart-latens (noen hundre millisekunder, merkbart men akseptabelt), og at debugging er tyngre enn en lokal FastAPI-server.

### Vurdering

For *dette* prosjektet, der backenden er en tynn proxy og driftskompleksitet er en reell constraint, peker Edge Functions seg ut som det mer pragmatiske valget. Du eliminerer en hel infrastrukturkomponent. Hvis du treffer kjøretidsbegrensninger på dype traversaler, kan du dele opp: frontenden gjør først et «breadth 1»-kall, deretter kaller den dypere nivåer asynkront.

Unntaket er hvis du planlegger å kjøre embedding-generering eller tung NLP server-side. Da trenger du Python-økosystemet, og FastAPI er riktig. Men gitt at embedding-generering typisk er en batch-jobb (ikke sanntid), kan den kjøres separat (f.eks. som en GitHub Action eller cron-jobb) uten at det påvirker proxy-backenden.

---

## 5. De største risikoene — beslutninger som er vanskelige å reversere

### Risiko 1: Grafvisualisering som primær interaksjonsmetafor — er det riktig?

Dette er den mest fundamentale risikoen, og den handler ikke om teknologivalg.

Jurister arbeider med tekst. Deres verktøy er dokumenter, lister, tabeller, søkeresultater med utdrag. Grafvisualisering er et *uvant* paradigme. Faren er at verktøyet blir teknisk imponerende men kognitivt fremmed — at juristen bruker det én gang, synes det er interessant, og deretter faller tilbake til Lovdata fordi det er raskere å skanne en liste.

Det kritiske designgrepet er å tilby *begge*: grafen som én visning, og en tabellbasert liste-visning med samme data som alternativ. Juristen bør kunne bytte mellom grafvisning og listevisning uten å miste tilstand (filtre, valgt node, ekspansjoner). Noen jurister vil bruke grafen for å *oppdage* relevante rettskilder og deretter bytte til listen for å *arbeide* med dem.

Hvis du bygger systemet med grafen som den *eneste* interaksjonsmetaforen, risikerer du å ekskludere en stor del av målgruppen. Dette er vanskelig å reversere fordi det påvirker hele frontend-arkitekturen: er grafen en komponent i en bredere app, eller er den appen?

### Risiko 2: Valg av graf-renderingsbibliotek

Grafbiblioteket er den mest innlåsende teknologibeslutningen i hele prosjektet. Alt annet — rammeverk, backend, database — kan byttes ut inkrementelt. Grafbiblioteket er tett koblet til interaksjonslogikk, layout-kode, styling, event-håndtering og dataformater.

Et bytte fra Cytoscape til Sigma (eller omvendt) er i praksis en fullstendig omskriving av hele grafkomponenten og alle dens integrasjoner. Det er 3-6 måneders arbeid for én person.

Anbefalingen er å prototypere med *reelle data* (ikke toy-eksempler) i det valgte biblioteket før du commiterer. Bygg en minimal versjon med 100 noder fra en faktisk traversal, test progressiv ekspansjon, test layout-stabilitet, test ytelse. Først da vet du om biblioteket holder.

### Risiko 3: Datamodell for annotasjoner

Den planlagte annotasjonsmodellen (LLM-genererte, akkumulerende votes, confidence-terskler) er konseptuelt elegant men operasjonelt risikabel.

Spesifikt: hva skjer med annotasjoner når rettskilden endres? Når en lov revideres, en ny KOFA-avgjørelse publiseres som endrer rettstilstanden, eller en EU-dom omgjøres — er eksisterende annotasjoner fortsatt gyldige? Systemet trenger en mekanisme for å *invalidere* annotasjoner, ikke bare akkumulere dem.

Hvis du designer annotasjonstabellen uten versjonering av det underliggende datagrunnlaget, ender du med annotasjoner som refererer til rettskilder som ikke lenger stemmer. For jurister er dette verre enn ingen annotasjoner — det er *villedende*.

Anbefalt forsikring: legg til et `source_version_hash`-felt på annotasjoner som knytter annotasjonen til en spesifikk versjon av noden den annoterer. Når noden endres, kan stale annotasjoner flagges.

### Risiko 3b: Antakelsen om at juridisk hierarki er statisk

Layouten i grafen bør reflektere rettslig autoritetsrangering — lov over forskrift over praksis. Men dette hierarkiet er ikke alltid stabilt: en KOFA-avgjørelse kan tolke en lov på en ny måte som endrer forståelsen av forskriften. EU-retten har forrang over norsk rett i visse situasjoner. «Autoritet» er kontekstavhengig.

Hvis layouten hardkoder et fast hierarki (lovparagrafer alltid øverst, KOFA-saker alltid nederst), risikerer du å kommunisere en rettskildeforståelse som ikke alltid stemmer. Vurder å la hierarkiet være konfigurerbart — la juristen velge «sorter etter autoritet» vs. «sorter etter tid» vs. «sorter etter sentralitet».

---

## Oppsummering av anbefalinger

| Beslutning | Anbefaling | Begrunnelse |
|---|---|---|
| Frontend-rammeverk | React (med Zustand) | Grafbibliotek-integrasjoner, kompleks tilstand, økosystem |
| Grafbibliotek | Cytoscape.js | Hierarkisk layout, compound nodes, node-locking |
| Ekspansjonsmodell | Grupperte aggregatnoder, klikk for å ekspandere | Balanserer oversikt og detalj |
| Layout-stabilitet | Node-locking + manuell re-layout-knapp | Brukerkontrollert, forutsigbart |
| Filtrering | Dimming (15% opacity), klikkbare dimmede noder | Bevarer kontekst |
| Nodetype-koding | Form = type, størrelse = sentralitet, farge = tilstand | To dimensjoner, ikke tre |
| Høyrepanel | Én container, betinget innhold | Raskere skanning |
| Backend | Supabase Edge Functions | Minimerer driftskompleksitet |
| Alternativ visning | Tabell/liste-visning parallelt med graf | Kritisk for adopsjon |

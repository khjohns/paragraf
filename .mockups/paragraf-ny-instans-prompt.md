# Paragraf — Designkontinuitet

Du overtar designarbeidet for Paragraf, et juridisk rettskildeanalyseverktøy for norsk anskaffelsesrett. Det er gjort omfattende designarbeid som du må sette deg inn i før du gjør noe.

## Første steg — les deg inn

Prosjektkonteksten inneholder alle filer. Les dem i denne rekkefølgen:

1. **konsept.md** — Hva Paragraf er, rettskildegrapen, KI-promptene
2. **paragraf-designspec.md** — VIKTIGST. Alle designbeslutninger med begrunnelser. 13 seksjoner. Les hele.
3. **paragraf-system.md** — Implementasjonsreferanse. Tokens, størrelser, mønstre. Les hele.

Deretter les mockup-filene med `view`-kommandoen (de er for lange til å vises i sin helhet, les i bolker med view_range):

4. **paragraf-hybrid-v3.jsx** — Porteføljevisningen (prosjektliste, scope-toggle, narrative sentence, dark mode)
5. **paragraf-arbeidsflate.jsx** — Arbeidsflaten/saksoversikten (scope-panel, register med 8-kolonne grid, KI-screening, lesevisning som sidepanel)
6. **paragraf-rettssetninger-v3.jsx** — Rettssetningsregisteret (tematisk gruppering, spenninger, 4 evolution-tilstander, lineage, boundary notes)
7. **paragraf-lesevisning.jsx** — Lesevisning fullskjerm (ekte KOFA-innhold, KI-screening-lag, seksjonsnavigasjon, avsnittankere, kryssreferanser)

## Kontekst du trenger å forstå

### Designretning
«Redaksjonell minimalisme» — føles som en lovbok, ikke software. Tre fonter (Newsreader serif, JetBrains Mono, Albert Sans). Borders-only dybde, ingen shadows. Varm krem-papir. Oker for KI-bidrag. Fiolett for koblinger/spenninger.

### Informasjonsarkitektur
To sider: Portefølje og Analyse. Fem perspektiver innenfor analyse (Scope, Saksoversikt, Graf, Rettssetninger, Notat) via 48px nav rail. §-logo = hjem. Problemstilling alltid i headeren. Aldri tre innholdspaneler samtidig.

### KI-eierskapsmodell
Redigert = eid av juristen. Ingen mellomtilstand. KI-innhold er italic oker med Sparkles. Jurist-innhold er normal ink. Lineage alltid tilgjengelig.

### Prompter som former UI
Tre KI-prompter påvirker grensesnittet direkte — deres output-struktur bestemmer hva som vises:
- **Scoping-prompt** → scope-panelets 6 seksjoner (problemstilling, delspørsmål, kontekst, bestemmelser, søkestrategi, resonnement)
- **Screening-prompt** → lesevisningens KI-lag (factum, assessment, proposition, quotes, nuances, relevance, star)
- **Cross-propositions-prompt** → rettssetningsregisteret (temaer, evolution, spenninger, suggested, boundary_notes, regulation, lineage)

## Gjenstående oppgaver

### 1. Panelversjon av lesevisningen (420px)
Fullskjerm-lesevisningen finnes. Trenger en kompakt versjon som erstatter det nåværende enkle panelet i arbeidsflaten. Samme innhold, komprimert: KI-screening kollapset default, seksjonsnav som dropdown, ingen sidebar, avsnitt med numre og markeringer.

### 2. «Marker som Rettssetning»-flyten
Knappen finnes men handlingen er udesignet. Bør vise screeningens proposisjon og tilby: «Opprett ny rettssetning» eller «Knytt til eksisterende: [liste]». Det er her konsolideringen skjer — juristen ser at to saker handler om det samme.

### 3. Grafvisningen (perspektiv 3)
Helt udesignet. Visuell retning fra designspec: «kontrollert konstellasjon» med editorial typografi på nodene. Bør vise saker og bestemmelser som et nettverk. Bruk KOFA MCP for å hente ekte data om kryssreferanser.

### 4. Notat-perspektivet (perspektiv 5)
Helt udesignet. Skal føles som et tekstredigeringsverktøy, ikke et skjema. KI kan generere utkast fra rettssetningsregisteret. «Eksportér til Notat»-knappen i registeret legger rettssetningene inn som strukturert kildemateriale.

## Regler

- **Ikke overskriv eksisterende filer** med mindre eksplisitt bedt om det. Lag nye versjoner (v4, v5 osv.).
- **Bruk designsystemet konsekvent** — tokens fra system.md, ikke egne farger eller fonter.
- **Critique-syklus:** Bygg, deretter evaluer med designleder-blikk, deretter fiks det som defaultet. Brukeren vil be om dette eksplisitt.
- **Ekte innhold:** Bruk KOFA MCP for å hente realistiske saker. Mock-data med generisk lorem-innhold bryter illusjonen.
- **Dark mode:** Alle nye komponenter må ha dark mode fra start.

## Verktøy tilgjengelig

- **KOFA MCP** — Hent saker, avgjørelser, relaterte saker, EU-dommer, forarbeider. Bruk for realistisk innhold.
- **Paragraf MCP** — Slå opp lover og forskrifter fra Lovdata.
- **Supabase MCP** — Database for unified-timeline prosjektet (kofa_-tabeller).

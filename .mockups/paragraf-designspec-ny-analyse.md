# Start ny analyse — Designspesifikasjon

> Implementasjonsreferanse: `paragraf-ny-analyse-v3.jsx`
> Del av: `paragraf-designspec.md` seksjon 9 (Komponentmønstre)

---

## 1. Hva dette er

Overgangen fra porteføljen til arbeidsflaten. Juristen formulerer problemstillingen som hele analysen bygger på. Scoping-prompten tar fritekst og returnerer en strukturert forskningsplan med 6 seksjoner.

**Det er en samtale, ikke et skjema.** Juristen vet ikke hvilke bestemmelser som er relevante ennå — det er det KI-en hjelper med. Skjema-tilnærmingen («Velg prosedyre, merk bestemmelser, definer terskelverdi») forutsetter kunnskap juristen ikke har. Fritekst respekterer at juristen tenker i problemstillinger, ikke i metadata.

---

## 2. To stier fra samme inputfelt

**«Analyser med KI»** (primærknapp, Sparkles-ikon) — sender fritekst til scoping-prompten, viser progressiv forskningsplan.

**«Start direkte»** (dashed-underline-lenke, ArrowRight) — tar friteksten som problemstilling og åpner arbeidsflaten med et åpent, tomt scope-panel. Ingen mellomvisning, ingen KI.

*Hvorfor to stier:* Tre brukertyper — «hjelp meg tenke» (vil ha KI), «jeg vet hva jeg gjør» (KI er friksjon), «jeg vet litt» (vil ha KI men med kontekst). Én sti tvinger alle gjennom KI eller nekter alle KI. To stier lar brukeren velge.

*Hvorfor hierarkisk, ikke likeverdig:* KI-stien gir mest verdi for de fleste. Primærknapp (filled, `--ink` bakgrunn) vs. subtil tekstlenke (dashed border-bottom, `--ink-muted`). Juristen som vet hva de gjør finner lenken — den trenger ikke å rope.

*Hvorfor ingen forklaringsparagraf:* «Analyser med KI» og «Start direkte →» er selvforklarende. En paragraf som forklarer forskjellen er overflødig og bryter flyten. Fjernet i v2.

---

## 3. «Jeg vet allerede…»

Sammenleggbar kontekst under fritekstfeltet. Fire valgfrie felter: Prosedyre, Terskelverdi, Tjenesteområde, Bestemmelser.

*Hvorfor valgfritt og skjult:* Juristen som bare skriver «hva med leverandørgrupperinger?» skal ikke se fire tomme felter. De er friksjon for 80% av brukerne. Men de 20% som vet at det gjelder konkurransepreget dialog over EØS-terskel, gir prompten bedre input.

*Hvorfor det følger begge stier:* Ved «Analyser med KI» sendes konteksten som input til scoping-prompten — KI bruker den til mer presise bestemmelser og søkestrategi. Ved «Start direkte» overføres feltene til scope-panelets Kontekst-seksjon. Samme data, to bruksområder.

*Visuelt:* `--paper-dark` bakgrunn (innfelt-signal), `--border` ramme. Kontroll-inputs med `--control-bg`. ChevronRight-rotasjon for åpne/lukke. Forklaringsteksten er én setning: «Brukes som input til KI-analysen, eller overføres til scope-panelet ved direkte start.»

---

## 4. Progressiv streaming

### Problemet

Scoping-prompten tar 2–3 minutter. Å vise en spinner i 3 minutter er en ødelagt opplevelse. Å sende juristen tilbake til porteføljen bryter flyten.

### Løsningen

Streaming API med `stream: true` og structured output (`output_config.format: json_schema`). JSON strømmer token-for-token. En inkrementell JSON-parser detekterer når en top-level key er ferdig og viser den umiddelbart. Juristen redigerer seksjon 1 mens seksjon 3 strømmer inn.

*Hvorfor dette fungerer teknisk:* Anthropic Messages API støtter streaming + structured outputs samtidig (dokumentert under «Feature compatibility»). `text_delta`-events akkumuleres, og partial JSON-parsing (f.eks. via Pydantic) detekterer ferdige keys. Agent SDK har denne begrensningen — rå Messages API har den ikke.

### Visuelt

**Ingen sidebytte.** Inputfeltet komprimeres til en inset-summary (`--paper-dark`, 12px padding, «Input» label + sitert tekst). Under det vokser seksjonene nedover, én for én, med `fadeUp`-animasjon.

*Hvorfor ingen sidebytte:* Et sidebytte krever et «ferdig»-øyeblikk. Med progressiv streaming finnes ikke det øyeblikket — innhold kommer kontinuerlig. Ett dokument som vokser er den naturlige metaforen.

*Hvorfor inputfeltet komprimeres og ikke forsvinner:* Juristen trenger å se hva de skrev. Kontekst. Den komprimerte versjonen tar minimal plass (én rad) men holder informasjonen tilgjengelig. «Endre»-knappen lar dem gå tilbake.

---

## 5. Ventetilstand

De første 15–30 sekundene produserer strømmen ingen ferdige seksjoner. Juristen ser:

1. **Komprimert input** — inset-summary med sin tekst
2. **Fremdriftsstripe** — seks segmenter (ett per seksjon), «Seksjon 1 av 6 · 0:12», Avbryt-knapp
3. **Vente-tekst** — Newsreader italic oker: «Leser problemstillingen din og identifiserer relevante rettskilder i grafen. Første seksjon dukker opp om et øyeblikk.»

*Hvorfor vente-teksten:* Uten den ser juristen en tom side med en fremdriftsstripe. Ingen bekreftelse på at systemet forstod inputen. Vente-teksten gir to signaler: (a) noe skjer, (b) det er KI som jobber (oker + italic = KI-stemmen). Den forsvinner i det første seksjon fader inn — ingen manuell fjerning, bare erstatning.

*Hvorfor Newsreader italic oker og ikke Albert Sans:* KI-stemmen snakker. Det er den samme typografiske behandlingen som KI-resonnement i scope-panelet og rettssetningsregisteret. Konsistens i KI-eierskapsmodellen.

*Hvorfor ikke «Vanligvis 2–3 minutter»:* Tidsestimater skaper forventninger som brytes. Sier du «2–3 minutter» og det tar 4, føler juristen at noe er galt. Den løpende klokken (0:12, 0:45, 1:38) viser at tid går uten å love når den stopper.

---

## 6. Fremdriftsindikator

Seks segmenter i en stripe. Ferdige = `--ai-accent`, pågående = `--ai-accent` med 40% opacity, ventende = `--border`. Over stripen: «Seksjon 2 av 6 · 0:24» (Albert Sans 12px) og Avbryt-knapp (btn-ghost).

*Hvorfor seks segmenter og ikke en progressbar:* Seks segmenter korresponderer 1:1 med seksjonene som dukker opp under. Juristen ser at segment 3 fylles → seksjon 3 dukker opp. Direkte kobling mellom indikator og innhold. En jevn progressbar har ingen slik kobling.

*Hvorfor ikke prosentandel:* Vi vet ikke hvor lang hver seksjon tar. Å vise 33% etter seksjon 2 er villedende — seksjon 5 (søkestrategi) kan ta dobbelt så lang tid som seksjon 3 (kontekst). Segmenter er diskrete og ærlige.

**Skeleton for neste seksjon:**
Under den siste ferdige seksjonen vises en enkelt rad med Loader2-spinner (10px) og seksjonsnavnet i JetBrains Mono uppercase muted. Gir forventning om hva som kommer uten å ta plass.

---

## 7. Avbryt

Avbryt-knappen (btn-ghost, «Avbryt», `--ink-muted`) er alltid synlig under streaming. Klikk:

- Stopper strømmen
- Beholder alle ferdige seksjoner
- Fjerner fremdriftsindikatoren
- Viser «Forskningsplan · 3 av 6 seksjoner» i headeren
- CTA endres til «Start med 3 seksjoner →» + «Kjør på nytt»-lenke

*Hvorfor avbryt med delvis resultat:* 3 av 6 seksjoner er bedre enn ingenting. Problemstilling + delspørsmål + kontekst er nok til å starte. Juristen kan fylle inn bestemmelser og søkestrategi manuelt i scope-panelet. Å tvinge dem til å vente eller miste alt er respektløst.

*Hvorfor «Kjør på nytt» og ikke automatisk restart:* Juristen avbrøt med vilje. Kanskje de så at problemstillingen var feil. Kanskje de vil redigere den spisset versjonen og kjøre igjen. «Kjør på nytt» er en bevisst handling, ikke en antakelse.

---

## 8. Gjennomgangsvisning (etter fullføring)

Når alle 6 seksjoner er ferdige, forsvinner fremdriftsindikatoren. Den redaksjonelle rule-linen (2px `--ink`) og «Forskningsplan»-headeren (Sparkles + JetBrains Mono uppercase oker) dukker opp. Under den: «Klikk på tekst for å redigere. Scopet kan justeres underveis i analysen.»

Seksjonene er allerede der — juristen har kanskje allerede redigert seksjon 1 og 2. Ingenting flytter seg. Overgangen fra «streaming» til «gjennomgang» er bare at stripen forsvinner og headeren dukker opp.

*Hvorfor minimal visuell endring:* Juristen har jobbet med innholdet i 2–3 minutter. Et brått sidebytte eller re-layout ville desorienterere. Den eneste endringen er: stripe → header, skeleton → CTA. Alt annet er stabilt.

---

## 9. Seksjonslayout — speiler scope-panelet 1:1

De 6 seksjonene er identiske med scope-panelets 6 seksjoner. Samme struktur, samme typografi, samme redigeringsmodell, men bredere (640px vs. 360px). Når juristen klikker «Start analyse», overføres innholdet direkte til scope-panelet. Juristen gjenkjenner alt.

**Seksjoner og default-tilstand:**
| Seksjon | Default | Begrunnelse |
|---|---|---|
| Problemstilling | Åpen | Kjernen. Alltid synlig. |
| Delspørsmål | Åpen | Viktig for å forstå scopet. |
| Kontekst | Lukket | Metadata. Sjelden relevant etter gjennomgang. |
| Bestemmelser | Åpen | Juristen vil se hvilke bestemmelser KI foreslo. |
| Søkestrategi | Åpen | Juristen vil se søketermene. |
| KI-resonnement | Lukket | KI-eid. Referanse, ikke arbeidsmateriale. |

---

## 10. KI-eierskapsmodell i denne flyten

Alle 6 seksjoner er KI-genererte. Eierskapsmodellen fra designspec seksjon 10 gjelder:

**Problemstilling og delspørsmål:** Italic oker med `border-left: 2px solid --ai-accent`. Dette er KI-prosa juristen skal ta stilling til. Klikk-for-å-redigere → normal ink, «Redigert»-label, border-left transparent. `paddingLeft: 16px` er konstant for å unngå layout-shift ved eierskap-skifte.

**Bestemmelser og søketermer:** `--ink-secondary`, ikke oker. Dette er data/referanser — «FOA § 16-11» er et faktum, ikke en tolkning. Seksjonsheaderen (JetBrains Mono uppercase) kommuniserer at KI valgte dem, men elementene selv er nøytrale. Hover viser KI-ens begrunnelse i en tooltip med Sparkles.

**KI-resonnement:** Italic oker, `border-left`, kollapset, ikke redigerbar. KI-eid permanent.

**Kontekst-chips:** Redigerbare, men vises i `--ink-secondary` (ikke oker). De speiler juristens «Jeg vet allerede»-input eller KI-ens tolkning. Klikk → inline input.

---

## 11. «Start direkte»-stien

Juristen klikker «Start direkte →»:

- Ingen mellomvisning, ingen gjennomgangsside
- Arbeidsflaten åpnes umiddelbart
- Friteksten brukes som problemstilling (normal ink, jurist-eid fra start)
- «Jeg vet allerede»-kontekst overføres til scope-panelets Kontekst- og Bestemmelser-seksjoner
- Resten av scope-panelet er tomt og åpent
- Fase satt til «Oppsett»

*Hvorfor ingen gjennomgangsside for direkte start:* Gjennomgangssiden er et KI-konsept — den viser KI-ens forslag til gjennomgang. Uten KI er det ingenting å gjennomgå. Juristen som klikker «Start direkte» vet hva de vil — å sette en mellomside mellom dem og arbeidsflaten er friksjon.

---

## 12. Headeren

I porteføljen: `§ Paragraf`. I denne visningen: `§ | Ny analyse`. Ikke `§ Paragraf` (juristen har forlatt porteføljen). Ikke `§ | [Problemstillingens tittel]` (analysen eksisterer ikke ennå — den er ikke opprettet før «Start analyse» klikkes).

*Hvorfor:* Headeren reflekterer alltid *hva du ser på nå*. «Ny analyse» er en mellomtilstand — du forbereder en analyse, men den har ikke en identitet ennå.

§-logoen er klikkbar og tar juristen tilbake til porteføljen. Under streaming: analysen avbrytes.

---

## 13. Visuell karakter

**Romslig.** 640px sentrert, generøst med whitespace. Inputfeltet er stort (22px Newsreader). Seksjonene har luft. Dette er ikke en komprimert arbeidsflate — det er en invitasjon til å tenke.

**Seriøst, ikke hastverdig.** Ingen wizard-steg, ingen «Neste»-knapper, ingen progress bar med prosentandel. Juristen bruker den tiden de trenger.

**Ikke en chatbot.** Ingen bobler, ingen «KI-assistent»-estetikk, ingen avatar. Bare: du skriver, vi strukturerer, du bekrefter.

---

## 14. Mockup-referanse

`paragraf-ny-analyse-v3.jsx` implementerer alle beslutningene i denne spesifikasjonen. Streamingtidene er komprimert for demo (~5s per seksjon). I produksjon: 15–30s per seksjon, totalt 2–3 minutter.

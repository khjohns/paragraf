# Paragraf — Designspesifikasjon

## 1. Hva Paragraf er

Paragraf er et interaktivt arbeidsverktøy for juridisk rettskildeanalyse i norsk anskaffelsesrett. Bak verktøyet ligger en heterogen rettskildegraf — KOFA-avgjørelser, lovparagrafer, EU-dommer, rettsavgjørelser og forarbeider, koblet sammen av referansekanter med kontekst.

Verktøyet støtter hele rettskildeanalysen fra søk til konklusjon. KI hjelper med å identifisere, strukturere og prioritere rettskilder. Men juristen har alltid siste ord.

---

## 2. Hvem bruker dette

En jurist i et advokatfirma eller juridisk avdeling. Åpner appen med morgenkaffe, trenger å finne igjen tråden fra i går eller finne riktig analyse for en sak en kollega nettopp overleverte. Dyp konsentrasjon, høy innsats, teksttungt arbeid.

Juristen er ikke en utvikler. De tenker ikke i filtre, tabeller og dashboards — de tenker i problemstillinger, bestemmelser og rettssetninger. Grensesnittet må snakke deres språk.

**To primære brukssituasjoner:**

1. «Hva holdt jeg på med?» — Juristen gjenopptar arbeidet der de slapp. Trenger å se kontekst raskt og komme i gang.
2. «Hvilken analyse trenger jeg nå?» — Kollegaen sier «vi har en sak om §24-2.» Juristen scanner porteføljen etter den rette analysen.

---

## 3. Designretning og begrunnelse

### Følelsen: En åpen lovbok på et ryddig skrivebord

Ikke software — dokument. Grensesnittet skal forsvinne og etterlate bare det juridiske materialet. Inspirasjonen er trykte lovsamlinger, akademiske tidsskrifter og sveitsisk redaksjonell design.

**Hvorfor denne retningen:** Jurister lever i tekst. Et redaksjonelt design signaliserer autoritet, presisjon og ro. Det fjerner «software»-følelsen og gir en «dokument»-følelse. Andre legal tech-produkter ser ut som prosjektstyringsverktøy. Paragraf skal se ut som et levende juridisk dokument.

**Inspirasjoner og hva vi tar fra hver:**
- *Trykte lovsamlinger* — Typografisk hierarki som bærer strukturen uten farger eller ikoner
- *Sveitsisk editorial design* — Stramme rutenett, kontrastfull typografi, strategisk whitespace
- *Things 3* — Emosjonell varme, taktil kvalitet, «appen du vil tilbake til»
- *Linear* — Nådeløs beskjæring av visuell støy, konsistent navigasjon

### Signatur: Den narrative filtersetningen

«Viser mine analyser på tvers av alle faser.»

En typografisk, redaksjonell setning som leser aktive filtre tilbake til juristen i naturlig språk. Ingen andre legal tech-produkter gjør dette. Den er funksjonell (bekrefter hva som vises) og estetisk (setter den redaksjonelle tonen for hele appen).

**Hvorfor:** Dropdowns og filter-badges er software-språk. En setning er menneske-språk. Juristen *leser* — det er deres primære handling hele dagen. En lesbar setning respekterer det.

---

## 4. Informasjonsarkitektur

### To sider, ikke fem

Paragraf har to sider:

1. **Porteføljen** — Oversikt over alle analyser. Scanning, gjenfinnelse, gjenopptak.
2. **Analysesiden** — Arbeid med én spesifikk analyse.

Alt annet er perspektiver *innenfor* analysesiden.

**Hvorfor to, ikke flere:** Juristen jobber med én analyse om gangen. Porteføljen er *mellom*-arbeid: velge hvilken analyse å åpne. Analysesiden er *selve*-arbeidet. Det er den eneste navigasjonsmodellen som er enkel nok til å ikke kreve forklaring.

### Perspektiver innenfor analysesiden

Analysesiden har fem perspektiver — ulike linser på det samme materialet:

1. **Problemstilling og scope** (Search-ikon) — Definér spørsmålet, bestemmelsene, søkestrategien
2. **Saksoversikt** (List-ikon) — Arbeidsregisteret: alle kandidatsaker med signaler, KI-screening, kategori
3. **Grafvisning** (Network-ikon) — Saker og bestemmelser som et nettverk av forbindelser
4. **Rettssetningsregister** (BookOpen-ikon) — Rettssetninger utledet fra sakene, med bevisgrunnlag
5. **Notat** (PenTool-ikon) — Juristens skriftlige analyse og konklusjoner

**Disse er ikke sekvensielle steg.** Juristen kan starte med å skrive notat, oppdage et hull, gå til grafvisningen, kjøre et nytt søk, vurdere de nye sakene, oppdatere rettssetningsregisteret, og gå tilbake til notatet — alt i én arbeidsøkt. Nav-railen gjør overgangene friksjonsfrie.

**Hvorfor nav rail og ikke tabs/sidebar:** En 48px vertikal rail med ikoner tar minimal plass, er alltid tilgjengelig, og viser tydelig hvilket perspektiv som er aktivt. Tabs ville konkurrert med innholdet horisontalt. En sidebar ville tatt plass fra panelene. Railen er den minst forstyrrende navigasjonsformen.

### Navigasjon mellom sidene

- **Portefølje → Analyse:** Klikk på en analyse i indeksen, eller «Fortsett i [perspektiv]»-knappen.
- **Analyse → Portefølje:** Klikk på §-logoen i headeren. §-logoen er alltid til stede og alltid klikkbar. Det er den eneste globale navigasjonshandlingen.

**Ingen breadcrumbs, ingen hamburger-meny, ingen «Tilbake»-knapp.** Logo = hjem er en etablert konvensjon som ikke krever opplæring.

### Headeren er stabil kontekst

I porteføljen viser headeren: `§ Paragraf`.

I analysesiden viser headeren: `§ | [Problemstillingens tittel]`.

Problemstillingen vises *alltid* når man er inne i en analyse, uavhengig av perspektiv. Den forankrer juristen i spørsmålet de undersøker. Perspektivnavnet vises *ikke* i headeren — nav railen kommuniserer posisjon.

**Hvorfor:** Juristen trenger kontinuerlig påminnelse om *hva* de undersøker (problemstillingen), ikke *hvor* de er (perspektivet). Det er som å ha saksnavnet øverst på hver side i en fysisk mappe.

---

## 5. Panelmodell

Analysesiden bruker en konsekvent panelmodell:

```
[ Nav rail 48px ] [ Kontekstpanel (scope) ] [ Hovedinnhold ] [ Lesevisning ]
```

**Regel: Aldri tre innholdspaneler samtidig.** Scope-panelet lukkes automatisk når lesevisningen åpnes, og vice versa. Hovedinnholdet har alltid minst ~600px.

**Scope-panelet er 360px.** Stort nok til å vise problemstilling, bestemmelser og søkestrategi uten scrolling. Lesevisning lukkes automatisk ved åpning.

**Lesevisningen er 420–460px** avhengig av perspektiv. Scope lukkes automatisk.

**Hvorfor faste bredder, ikke prosent:** Prosentbaserte paneler kollapser uforutsigbart ved smalere skjermer. Faste bredder gir designeren kontroll over innholdsbredden — viktig for lesbarhet av juridisk tekst.

**Responsivitet:** Under ~1200px kollapser scope automatisk. Nav railen (48px) beholdes — den er liten nok til å overleve på 13" skjermer.

---

## 6. Token-arkitektur: Hva og hvorfor

### Typografi

Tre familier med distinkte roller:

| Familie | Rolle | Hvorfor akkurat denne |
|---|---|---|
| **Newsreader** (serif) | Autoritet, lesing. Titler, problemstillinger, rettssetninger, narrative elementer. | En redaksjonell serif med optisk størrelsesjustering. Gir «lovbok»-følelse uten å være stiv. Mer levende enn Garamond, mer autoritær enn Georgia. |
| **JetBrains Mono** (mono) | Data, presisjon. Bestemmelser (FOA §16-11), saksnumre, tellere, metadata-verdier. | Tydelig som «kode/data» selv i liten størrelse. Tabular nums for kolonnejustering. Signaliserer «dette er en referanse du kan slå opp.» |
| **Albert Sans** (sans-serif) | UI-chrome. Knapper, labels, filtre, kontroller. | Nøytral uten å være kjedelig. Forsvinner bak innholdet. Ikke Inter (for generisk), ikke IBM Plex (for teknisk). |

**Regelen:** Serif er for *innhold juristen leser*. Mono er for *data juristen refererer*. Sans er for *UI juristen klikker*. Hvis du er usikker på hvilken font — spør: «Leser juristen dette, refererer de til det, eller klikker de på det?»

### Teksthierarki (4 nivåer)

```
--ink:            #1C1B1A    Primær — titler, overskrifter, rettssetninger
--ink-secondary:  #33312E    Sekundær — problemstillinger, brødtekst, vurderinger
--ink-tertiary:   #4A4843    Tertiær — metadata, labels, fasenavn, temaoverskrifter
--ink-muted:      #7A766F    Dempet — placeholder, disabled, tellere, strukturelle prikker
```

**Hvorfor fire nivåer:** To nivåer (svart + grå) gir for flat hierarki — alt føles like viktig. Fire nivåer lar oss differensiere mellom «les dette» (primær), «støtteinformasjon» (sekundær), «kontekst du skanner» (tertiær) og «struktur du ignorerer» (muted).

**Hvorfor disse spesifikke verdiene:** Originalens lyseste lesetekst (#4A4843) er vår *tertiære* — alt som faktisk skal leses er mørkere enn det. Vi lærte dette av en feil: v2 hadde for lav kontrast (#6B6862 som tertiær) og teksten forsvant mot papiret.

### Overflater

```
--paper:          #F8F6F1    Base canvas — lys, varm
--paper-dark:     #EDEAE3    Innfelt bakgrunn — provision-tags, kontroller
```

**Hvorfor varm krem og ikke hvit:** Hvit (#fff) er kald og klinisk. Krem (#F8F6F1) er papir — varmt, organisk, behagelig for langvarig lesing. Juristen tilbringer timer i dette grensesnittet.

**Hvorfor bare to overflatenivåer:** Vi bruker borders-only som dybdestrategi. Flere overflatenivåer ville krevd shadows eller fargeskift for å kommunisere hierarki — det bryter med den redaksjonelle roen.

### Border-progresjon (4 nivåer)

```
--border-subtle:  rgba(28, 27, 26, 0.06)    Mykeste — radseparatorer, seksjonsdelere
--border:         rgba(28, 27, 26, 0.12)    Standard — provision-tags, toggles, kontroller
--border-strong:  rgba(28, 27, 26, 0.20)    Fremhevet — hover, dropdown-kanter, aktive filtre
--border-stronger: rgba(28, 27, 26, 0.35)   Maksimal — kun for fokusringer
```

**Hvorfor rgba og ikke hex:** Rgba med lav opacity blander seg med bakgrunnen — det definerer kanter uten å kreve oppmerksomhet. Solid hex-borders ser harde ut. Borders skal «finnes når du leter etter dem, forsvinne når du ikke gjør det.»

**Hvorfor fire nivåer:** Samme logikk som teksthierarkiet. En radseparator og en fokusring er begge «borders» men har radikalt ulik viktighet. Fire nivåer lar oss differensiere.

### Kontroll-tokens

```
--control-bg:           #EDEAE3    Mørkere enn paper = «innfelt/trykk her»
--control-border:       rgba(28, 27, 26, 0.12)
--control-border-focus: rgba(28, 27, 26, 0.40)
```

**Hvorfor egne tokens:** Et søkefelt og en innholdsboks ser like ut hvis de bruker same bakgrunnsfarge. Kontroller trenger å føles «innfelt» — litt mørkere enn omgivelsene, som et felt du kan skrive i.

### Semantiske farger

```
--ai-accent:      #92600A    KI-bidrag — varm oker
--violet-accent:  #6B4C9A    Spenning/kobling — fiolett
--nuance-color:   #8B3A3A    Unntak/nyanser — dempet rød
--confirm-color:  #375E37    Bekreftelse — dempet grønn
--gold-star:      #B8941E    Gullkandidater — gull
```

**Hvorfor oker for KI, ikke blå/lilla:** Blå konnoterer «system/info» i de fleste UI-rammeverk. Lilla konnoterer «premium/AI» i generisk SaaS. Oker konnoterer *blekk og papir* — det er fargen på aldret tekst, håndskrevne margnoter, blyantmarkeringer i en lovbok. Det er KI som «assistent med blyant», ikke «maskin med svar.»

**Hvorfor fiolett for spenninger:** Spenninger mellom rettssetninger er ikke feil — de er *koblinger* som krever juridisk skjønn. Fiolett er samme farge som «krysspollinering» i porteføljen. Konsistens: fiolett = «to ting som møtes.»

### Signal-farger (arbeidsflaten)

```
R (Referanse):  --ink-secondary / --border / --paper-dark
F (Fulltekst):  --signal-fts (#4A6A8B) / border / bg
V (Vektor):     --ai-accent (#92600A) / border / bg
```

**Hvorfor tre signal-typer med ulike farger:** Juristen trenger å vite *hvordan* en sak ble funnet. En sak funnet via bestemmelsesreferanse (R) er pålitelig — det er en eksplisitt kobling. En sak funnet via fulltekstsøk (F) er presis men kan mangle kontekst. En sak funnet via vektorsøk (V) er en KI-tolkning — den kan være briljant eller irrelevant. Fargekodingen gir denne informasjonen uten at juristen må lese metadata.

**Alle tre er like viktige:** Noen problemer er konseptuelle uten spesifikke lovhenvisninger — da er vektorsøk essensielt. Fargene er likeverdige visuelt, ikke hierarkiske.

### Fasefaser

```
oppsett:          #A8A29E    Stone
primaersok:       #64748B    Slate
screening:        #B45309    Amber
ettersok:         #CA8A04    Gold
sammenstilling:   #059669    Emerald
```

**Brukes KUN i fase-dropdown og narrativ-setningen ved aktive filtre.** Ikke i strukturelle elementer (prikker, linjer) i porteføljen.

**Hvorfor monokrome prikker i indeksen:** Vi testet fargede prikker. De ga raskere skanning men brøt den redaksjonelle roen — fem ulike farger i margen er visuelt støyende. Fase kommuniseres gjennom tekst. Men dette er en bevisst usikkerhet: med 20+ analyser *kan* fargede prikker hjelpe. Arkitekturen støtter begge — switching krever bare å endre `'var(--ink-muted)'` til `PHASE_COLORS[phase]` på to elementer.

---

## 7. Dybdestrategi

**Borders-only. Ingen shadows. Ingen semi-transparente overlays. Ingen surface color shifts for elevasjon.**

**Hvorfor:** Shadows er dramatikk. Dramatikk er støy. Et juridisk arbeidsverktøy skal føles som papir, ikke som svevende kort. Borders definerer struktur uten å kreve oppmerksomhet. En lovbok har linjer, ikke skygger.

**Unntak:**
- Provision-tags og kontrollbakgrunner bruker `--paper-dark` — dette er et *innfelt/resess*-signal, ikke elevasjon.
- 2px solid `--ink` under «Indeks»-overskriften — dette er en *redaksjonell rule line*, del av det typografiske systemet, ikke dybdesystemet. Det er den svarte linjen under en avisoverskrift.
- Dropdown-popovers brukes uten shadow i vår borders-only-strategi. De defineres av `--border-strong` border.

---

## 8. Mørk modus

### Atmosfære: Kveldslys i arbeidsrommet

Ikke inverterte farger — det gir en generisk mørk SaaS-app. Den mørke modusen er den atmosfæriske ekvivalenten av «lovbok på et ryddig skrivebord.» Om morgenen: lyst papir, blekk-svart tekst. Om kvelden: mørke trepaneler, varm belysning, off-white tekst.

### Nøkkelgrep

**Varm svart, ikke kald:** `--paper: #1E1C19` har en brun/oker undertone. De fleste mørke moduser bruker blågrå (#1a1a2e) eller nøytralgrå (#18181b). Paragraf er varmt fordi papiret er varmt.

**Teksthierarkiet komprimeres:** Primærtekst er varm off-white (#E2DFD6), ikke ren hvit. Ren hvit på svart blender. Hierarkiet komprimeres nedover — forskjellen mellom nivåene er mindre enn i lys modus.

**Borders blir viktigere:** Shadows er usynlige mot mørk bakgrunn. Borders er den eneste strukturdefinisjonen. Grenseverdiene er justert for mørk bakgrunn (rgba med lysere base).

**Semantiske farger desatureres:** `--ai-accent` går fra #92600A til #C49A4E — lysere, varmere, mindre intens. Alle semantiske farger løftes og desatureres for å fungere mot mørk bakgrunn.

**Primærknappen inverterer til outline:** I lys modus er den fylt (mørk bakgrunn, lys tekst). I mørk modus ville en fylt lys knapp blende. Outline-varianten (transparent bakgrunn, `--border-strong` border, `--ink-secondary` tekst) har tilstedeværelse uten å dominere.

**Noise-teksturen beholdes** men med lavere opacity (0.025 mot 0.035) — gir fortsatt den taktile følelsen.

### Implementasjon

Alle dark mode-overrides ligger i en `.dark`-klasse som settes på wrapper-elementet. `colorScheme: 'dark'` settes for å hinte til native elementer. Toggle er en Moon/Sun-knapp i headeren.

---

## 9. Komponentmønstre og begrunnelser

### Porteføljen

**Scope-toggle (Mine | Team | Corpus):**
Tre-segmentet toggle med `--border` ytre border, 1px separator mellom segmenter. «Mine» viser juristens egne analyser, «Team» inkluderer kollegaers, «Corpus» inkluderer alle publiserte.

*Hvorfor «Corpus» og ikke «Offentlig»:* «Offentlig» er forvaltningsspråk. «Corpus» — som i *corpus juris* — er et ord jurister kjenner. Det konnoterer en akkumulert samling av kunnskap, ikke bare «andres greier.»

**«Fortsett der du slapp»-seksjonen:**
Viser den sist aktive analysen med: fase + perspektiv-tag (Screening · i Saksoversikten), tittel, problemstilling, bestemmelser, sist-handling, nye-hendelser-prikk. Knappen sier «Fortsett i Saksoversikten» (dynamisk) og lander juristen *der de var*, ikke på analysens forside.

*Hvorfor perspektiv-tag:* Uten den vet juristen at de jobbet med «Skatteattest-analysen», men ikke *hvor* i analysen. Var de i saksoversikten og leste saker? I rettssetningsregisteret? Perspektiv-tagen gjenoppretter kontekst.

*Hvorfor ingen AI-forslag her:* AI-forslaget («Vurder EU-dom C-123/24 for proporsjonalitetsprinsippet») ble fjernet. Porteføljens jobb er å hjelpe juristen *velge hvilken analyse å åpne* — ikke å fortelle hva de skal gjøre når de er inne. AI-forslag møter juristen inne i analysen.

*Hvorfor ingen metriker (5/8 lest, 1 spenning):* Metriker er analysens indre liv. Porteføljen svarer på «hva holdt jeg på med?» og «hvilken analyse trenger jeg?» — ikke «hvor langt er jeg kommet?». Fase-labelen kommuniserer allerede «underveis.»

**Nye-hendelser-indikator:**
En dempet oker-prikk + «2 nye relevante saker» på analyser der rettskildegrapen har oppdateringer. Ikke en notifikasjon — en stille markering, som en ulest-prikk i en e-postklient.

*Hvorfor:* Juristen som åpner appen mandag morgen bør se at noe har endret seg uten å måtte åpne hver analyse.

**Tagging:**
Analyser grupperes under bruker-satte temaer via en kontekstmeny (MoreVertical → «Flytt til tema»). Temaene er synlige som italic serif-overskrifter i indeksen.

*Hvorfor kontekstmeny og ikke drag-and-drop:* Drag-and-drop krever at juristen ser gruppene visuelt og drar mellom dem. Med få analyser er det greit, men med 20+ grupper på flere skjermlengder er det upraktisk. En dropdown er raskere og fungerer uavhengig av scroll-posisjon.

### Arbeidsflaten (Saksoversikten)

**8-kolonne register-grid:**
Checkbox, Kategori (A/B/C), Referanse (fokalpunkt), KI-innsikt, R-signaler, F-signaler, V-signaler, Lest-status.

*Hvorfor referansen er fokalpunkt:* Juristen scanner etter «KOFA-2022-1200» eller «HR-2019-1801-A» — det er saksidentiteten. 16px serif med kilde + dato under («Klagenemnda · 12. nov 2022») gir øyeblikkelig gjenkjennelse uten å åpne saken.

*Hvorfor signal-kolonnene er likeverdige:* Referansesignaler (R) er ikke viktigere enn vektorsignaler (V). Noen problemer er konseptuelle — da er V essensielt. Kolonnene har lik bredde og visuell vekt.

**Kategori-filter med A/B/C-kobling:**
Tab-baren viser «Kjernesak · A (5)» — bokstaven i mono-font ved siden av labelen. Kobler visuelt til A/B/C-badge i raden uten å kreve at juristen husker mappingen.

**Scope-panelet (360px):**
Strukturert etter Claude-scoping-promptens output i seks sammenleggbare seksjoner:

1. *Problemstilling* — Redigerbar serif, med referanse til juristens opprinnelige input
2. *Delspørsmål* — Redigerbare, nummererte, med «+ Legg til»
3. *Kontekst* — Kollapset default. Metadata-chips: Prosedyre, Terskel, Tjenesteområde, Marked
4. *Bestemmelser* — Primære (provision-tags) og Sekundære (dashed border). Hover viser begrunnelse
5. *Søkestrategi* — R/F/V/Forarbeider, visuelt differensiert med signal-farger
6. *KI-resonnement* — Kollapset default, AI-eid, ikke redigerbar

*Hvorfor sammenleggbare seksjoner:* 360px er smalt. Med alle seksjoner åpne ville juristen scrolle mye. Kontekst og resonnement er sjelden relevante etter oppsett — de kollapser. Problemstilling og søkestrategi er ofte referert — de er åpne.

*Redigerbarhet-prinsipp:* Alt juristen eier (problemstilling, delspørsmål, bestemmelser, søketermer) er direkte redigerbart — transparent border som går til `--border-strong` on hover. Alt maskinen eier (resonnement) har `border-left` i oker og Sparkles-ikon. Grensen er visuell.

### Rettssetningsregisteret

**Tematisk gruppering:**
Rettssetninger grupperes under temaoverskrifter i logisk rekkefølge: kjernespørsmål → perifere emner. Første tema har større skrift og mørkere farge (mer visuell vekt). Rekkefølgen kommer fra KI-ens tverrgående analyse.

**Fire evolution-tilstander:**
- *Etablert* — Solid border, ink-tertiary. Første gang prinsippet formuleres.
- *Bekreftet* — Grønn border. Bekrefter et allerede etablert prinsipp.
- *Kvalifisert* — Dashed border i oker. Innsnevrer eller nyanserer prinsippet. **Viktig:** dette er en *bevegelse i rettspraksis*, ikke bare en nuance i én sak.
- *Konsoliderende* — Muted border. Rettstilstanden fester seg.

*Hvorfor dashed for kvalifisert:* Dashed border signalerer «dette endret noe» — visuelt urolig sammenlignet med solide linjer. Det er bevisst: en kvalifisering endrer rettssetningens rekkevidde, og juristen bør registrere det.

**Spenninger:**
Vist i registeret som Scale-ikon + «Spenning med: [tema]» i fiolett under proposisjonen. I evidence-panelet som et eget kort øverst med forklaring og klikkbar lenke til den motstående rettssetningen.

*Hvorfor fiolett:* Spenning er kobling, ikke feil. Samme farge som krysspollinering i porteføljen — fiolett = «to ting som møtes.»

*Hvorfor klikkbar lenke:* Spenninger er mellom *to* rettssetninger. Juristen trenger å se begge for å ta stilling. «Gå til»-lenken gjør det friksjonsfritt.

**Suggested-markering:**
Sparkles-ikon ved forekomster der KI har *tolket* koblingen i stedet for å finne en eksplisitt referanse. Subtilt men synlig — juristen vet at denne forbindelsen er maskinens vurdering, ikke en eksplisitt formulering i avgjørelsen.

**Lineage:**
Hver forekomst i tidslinjen har en kollapset «Opprinnelig screening-proposisjon»-knapp. Viser hva KI-screeningen opprinnelig foreslo for denne saken, *før* den ble konsolidert til en tverrgående rettssetning.

*Hvorfor:* Konsolidering kan miste nyanser. Juristen bør kunne se hva maskinen opprinnelig sa, for å vurdere om noe gikk tapt.

**Avgrensninger (boundary notes):**
Kollapset seksjon nederst i evidence-panelet. Viser saker som *ikke* passer i rettssetningen men er verdifulle for avgrensning: «rettssetningen gjelder *ikke* i denne situasjonen.»

*Hvorfor:* For en jurist er det like viktig å vite hvor en regel stopper som hvor den gjelder. Boundary notes gir negativ avgrensning.

**Regulation-tags:**
Liten mono-tag ved referansen: «FOA», «Dir. 2004/18», «Selskapsloven». En sak avgjort under gammel forskrift har lavere prejudikatsverdi.

---

## 10. KI-eierskapsmodell

### Prinsipp: Redigert = eid

Så snart juristen redigerer *noe*, er innholdet «Redigert av Meg.» Ingen mellomtilstand. Begrunnelse: hele poenget med KI-merket er tillit. En delvis redigert proposisjon er kvalitetssikret — juristen har sett på den og tatt stilling. Det er det verifisering betyr.

Den opprinnelige KI-versjonen er alltid tilgjengelig via lineage (screening-proposisjonen i tidslinjen).

### Visuell differensiering

| Eier | Visuell behandling |
|---|---|
| KI-foreslått, uberørt | Italic, `--ai-accent` farge, Sparkles-ikon, `border-left` i oker |
| Jurist-eid (redigert eller opprettet) | Normal vekt, `--ink` farge, ingen markering |
| KI-tolket kobling (suggested) | Sparkles-ikon ved forekomsten i tidslinjen |
| KI-resonnement (ikke redigerbart) | Kollapset seksjon, Sparkles i header, `border-left` i oker |

### Regel for scope-panelet

Alt juristen eier har `.editable-field` (transparent border → border-strong on hover, cursor: text). Alt maskinen eier har `border-left` i oker. Juristen kan alltid se hva som er redigert og hva som er foreslått.

---

## 11. Interaksjonstilstander

Alle interaktive elementer må ha:
- **Default** — Utgangstilstand
- **Hover** — Subtil bakgrunnsendring eller border-forsterking
- **Active/pressed** — `transform: scale(0.98)` for knapper
- **Focus-visible** — Box-shadow ring med `--border-stronger` (kun for tastaturnavigering)
- **Disabled** — `--ink-muted` farge, `cursor: default`

### Spesifikke hover-mønstre

| Element | Hover-effekt |
|---|---|
| Indeksrad / Registerrad | `var(--hover-bg)` bakgrunn + pil/kontekstmeny fades inn |
| Kontrollknapper | Border mørkner til `--border-strong` |
| Primærknapp (lys modus) | Bakgrunn → #000 |
| Primærknapp (mørk modus, outline) | Bakgrunn → `--hover-bg-strong`, border → `--border-stronger` |
| Provisions/tags | Ingen hover (de er data, ikke handlinger) |
| Editable fields | Border → `--border-strong` |
| Dropdown-items | `var(--hover-bg)` bakgrunn |

### Animasjoner

- **Mikrointeraksjoner:** 0.15s ease. Hover, fokus, border-endringer.
- **Dropdown åpning:** 0.15s `dropIn` (translateY + fade).
- **Side-innlasting:** 0.7s staggered `fadeUp` med cubic-bezier(0.16, 1, 0.3, 1).
- **Panel slide-in:** 0.25s cubic-bezier(0.16, 1, 0.3, 1).
- **Ingen spring/bounce.** Dette er et profesjonelt verktøy, ikke en app for forbrukere.

---

## 12. Spacing

**Base unit: 4px.** Alle verdier er multiplum.

```
4   — Ikon-gapper, tette par
8   — Element-gapper innenfor en rad, metadata-spacing
12  — Komponent-intern padding, kontroll-gapper
16  — Rad-padding, seksjon-gapper
20  — Gap mellom tittelblokk og knapp, panel-padding
24  — Narrativ padding-bottom, panel-padding
32  — Fortsett-seksjonens venstremarg
40  — Gruppe-margin-bottom
48  — Tom-tilstand padding
64  — Fortsett-seksjonens margin-bottom
80  — Krysspollinering margin-top, side-bunn padding
```

**Hvorfor 4px og ikke 8px:** 4px gir finere kontroll. 8px-baserte systemer tvinger valg mellom 8 og 16 for småskala-spacing — 12px er ofte det rette svaret (f.eks. padding inni en knapp). 4px lar oss bruke 12px uten å bryte systemet.

---

## 13. Åpne spørsmål

### Fase-farge på strukturelle elementer
Beslutning: Monokrome prikker. Usikkerhet: Med 20+ analyser *kan* fargede prikker hjelpe scanning. Bør brukertestes. Arkitekturen støtter begge retninger.

### Søkeatferd i porteføljen
Søkefeltet finnes men oppførsel er udefinert. Hva søkes (titler, problemstillinger, bestemmelser)? Inline filter eller eget resultatvindu? Søk på tvers av scopes?

### Grafvisningen
Perspektivet finnes i nav railen men er ikke designet. Visuelt: nettverksvisning av saker og bestemmelser. Designretning bør være «kontrollert konstellasjon», ikke «hacker-nettverk» — stram regi, editorial typografi på nodene.

### Notat-perspektivet
Perspektivet finnes i nav railen men er ikke designet. Juristens skriftlige analyse. Kan genereres som utkast av KI basert på rettssetningsregisteret. Bør føles som et tekstredigeringsverktøy, ikke et skjema.

### AI-assistert gruppering i porteføljen
Temaer er bruker-satte. Spørsmålet om KI-foreslåtte grupperinger er ønskelig er åpent.

### Flyten fra screening-proposisjon til rettssetning
«Marker som Rettssetning»-knappen i lesevisningen bør vise screeningens foreslåtte proposisjon og la juristen velge: «Opprett ny» eller «Knytt til eksisterende.» Ikke designet i detalj.

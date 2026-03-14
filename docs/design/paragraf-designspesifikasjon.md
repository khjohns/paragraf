# Paragraf — Designspesifikasjon

## Konsept

Paragraf er et interaktivt arbeidsverktøy for juridisk rettskildeanalyse. Navnet rommer to betydninger: *paragraf* (§) som den grunnleggende byggeblokken i norsk lov, og *graf* som den underliggende datastrukturen som gjør rettskildene navigerbare.

Bak verktøyet ligger en heterogen rettskildegraf — 4.663 KOFA-avgjørelser, 92.000+ lovparagrafer, 320 EU-dommer, 1.386 norske rettsavgjørelser og lovforarbeider, koblet sammen av 25.000+ referansekanter med kontekst. Paragraf gjør denne grafen tilgjengelig for jurister som aldri har tenkt på rettskilder som en graf, men som daglig gjør det arbeidet en graf automatiserer: søke, krysskjekke, sammenligne, kartlegge.

Verktøyet støtter *rettskildeanalyse* — ikke rettslig vurdering. Det vil si: finne, kartlegge og forstå strukturen i rettskildebildet for en konkret problemstilling. Selve rettsanvendelsen — vurdering, skjønn, konklusjon — gjøres av juristen. Paragraf erstatter ikke juridisk arbeid. Det erstatter den manuelle, tidkrevende, og ufullstendige prosessen med å lete etter og organisere rettskildene som det juridiske arbeidet bygger på.

Tre prinsipper som gjennomsyrer designet:

**Innhold fra databasen, kuratering fra AI.** Juristen leser ordrett avgjørelsestekst, lovtekst og EU-domtekst — aldri AI-generert innhold presentert som primærkilde. AI-ens bidrag er å markere hva som er relevant, koble avsnitt på tvers av saker, og identifisere mønstre. Skillet er visuelt ufravikelig: tekst uten markering er autoritativ, tekst med gullbrun venstrekant er AI-ens tolkning.

**Listevisning først, graf for oppdagelse.** Jurister arbeider med tekst. Grafvisualisering er et uvant paradigme. Verktøyet starter i en listevisning som føles naturlig — sortert, filtrerbar, med avkrysningsbokser for lesestatus. Grafvisningen er ett klikk unna, for de gangene juristen trenger å se *strukturen* i rettskildebildet.

**Fraværet er like viktig som tilstedeværelsen.** Bestemmelsespar uten felles praksis, rettssetninger som mangler nyansering, hull i søkedekningen — alt gjøres synlig. Null-treff er et positivt analytisk funn, ikke en tom side.

Paragraf bygger på Paragraf MCP — en MCP-server som eksponerer norsk lovdata og KOFA-praksis for AI-agenter — og utvider den med et brukergrensesnitt designet for jurister, AI-kuratert leseopplevelse, og strukturert analysestøtte.

> Denne spesifikasjonen er det eneste dokumentet en ny utviklerinstans trenger for å implementere Paragraf. Den dekker designbeslutninger, begrunnelser, interaksjonsmønstre, visuelt språk, datamodellens påvirkning på UI, innebygd AI-integrasjon, og kjente åpne problemer.
>
> **Rammeverk er ikke besluttet.** Spesifikasjonen er rammeverksnøytral. Mock-koden (React JSX) finnes som visuell referanse, men designbeslutningene gjelder uavhengig av om implementasjonen blir Svelte eller React.

---

## 1. Brukeren

Norsk anskaffelsesjurist. Hun har Lovdata åpent i en annen fane. Hun jobber med en konkret rettslig problemstilling — f.eks. «Må forpliktelseserklæring fra støttende virksomhet foreligge ved tilbudsfrist?» — og trenger å kartlegge rettskildebildet systematisk.

Hun tenker i bestemmelser, prejudikater og autoritetshierarki. Hun har aldri brukt grafvisualisering til rettslig arbeid. Hennes daglige verktøy er tekstbaserte: Lovdata-søk, Word, PDF-er.

**Konsekvens for design:** Verktøyet må føles som en naturlig forlengelse av måten hun allerede tenker — ikke som noe hun må lære seg. Listevisning er default. Grafvisning er en valgfri tilleggsvisning for strukturoppdagelse.

---

## 2. Estetisk retning

**Forskerarbeidssted.** Rolig autoritet. Tett men organisert.

Fargepaletten er varm og papirbasert — ikke tech-blått, ikke dashboardy. Bakgrunn i varme, avdempede toner (#F5F3EE). Tekst i mørkt blekk (#1A1814). Nodetypene differensieres med dempede, distinkte farger som refererer til domenet: blågrå for bestemmelser (offisielle dokumenter), gullbrun for KOFA-saker, sjøgrønn for EU-dommer, dempet fiolett for rettsavgjørelser, varm grå for forarbeider.

**Farge er sekundærsignal.** Form er primærsignal for nodetype. Farge reserveres primært for tilstandsinformasjon (valgt, lest, filtrert, avgrensning).

---

## 3. Layout — tre paneler

```
┌──────────────┬──────────────────────────┬─────────────────┐
│              │                          │                 │
│  Venstre     │      Midtpanel           │   Høyrepanel    │
│  300px       │      (flex)              │   370px         │
│              │                          │                 │
│  Arbeids-    │   Liste (default)        │   Detaljer om   │
│  steg-       │        eller             │   valgt node    │
│  veiviser    │   Graf                   │                 │
│              │                          │   Kun synlig    │
│  Kan skjules │  ┌────────────────────┐  │   ved klikk     │
│              │  │  Chatpanel (skuff) │  │   på node       │
│              │  │  ~40% høyde        │  │                 │
│              │  └────────────────────┘  │                 │
└──────────────┴──────────────────────────┴─────────────────┘
```

Chatpanelet er en bunnpanel-skuff i midtpanelet — se seksjon 18 (AI-integrasjon).

**Venstrepanelet** er en arbeidsstegveiviser, ikke et filterpanel. Det følger metodikkens steg.

**Midtpanelet** viser enten listevisning (default) eller grafvisning.

**Høyrepanelet** er usynlig til brukeren klikker på en node. Innholdet er betinget på nodetype — mer om dette i seksjon 9.

---

## 4. Venstrepanelet — arbeidsstegveiviseren

Fem nummererte seksjoner som følger metodikken. Hver seksjon er kollapserbar. Nummersirkelen fylles (invertert, hvit tekst på mørk bakgrunn) når seksjonen er åpen.

### Seksjon 1: Problemstilling

Viser den formulerte problemstillingen i en tekstboks. Ikke redigerbar i denne visningen — settes ved oppstart.

### Seksjon 2: Utgangspunkt (søkeparametre)

Viser de fire signaltypene som er brukt i søket:

- **Bestemmelser** — paragrafseeds (f.eks. «FOA §16-10», «FOA §17-1»), vist som monospace-chips
- **FTS-begreper** — fulltekstsøkeord (f.eks. «forpliktelseserklæring»)
- **Konseptuelt søk (vektor)** — naturlig språk-beskrivelse, vist i kursiv i en tekstboks
- **Saker** — eventuelt kjente saker som brukes som seed

Disse er ikke alternative søkemetoder — de er komplementære signaler som gir ulik dekning. UI-et må gjøre dette tydelig.

### Seksjon 3: Resultater

A/B/C-kategorifordeling med antall per kategori. Hver kategori vises som en rad med badge, kort beskrivelse og antall.

| Kategori | Definisjon | Beskrivelse i UI |
|----------|-----------|-----------------|
| A | Referansetabell ∩ FTS ∩ Vektorsøk | «Ref + FTS + Vektor» |
| B | To av tre signaler | «To av tre signaler» |
| C | Ett signal | «Ett signal» |

**Viktig: A/B/C handler om *hvordan* noden ble funnet (mekanisk oppdagelsessignal). Det er IKKE en kvalitetsvurdering av innholdet.** C-saker er ikke dårligere — de fanger ofte avgrensningspraksis som er like verdifull. UI-et skal ikke visuelt degradere C-saker.

Under kategoriene:
- Antall avgrensningssaker (se seksjon 6)
- Reguleringsversjon-advarsel (se seksjon 7)
- Signalforklaring (R/F/V-prikker med etiketter)

### Seksjon 4: Kartlegging

Lesestatus per A/B/C-kategori som fremdriftslinjer (f.eks. «2/4 lest»).

**Gap-matrise** (se seksjon 5).

Iterasjonsinformasjon (f.eks. «Iterasjon 2: +1 treff via 'binær vs. kvantitativ rådighet'»).

Knapp: «Ny iterasjon med nye seeds» — stiplet ramme, dempet farge, blir tydeligere ved hover.

### Seksjon 5: Om rangeringen

Forklaring av siteringsretningsbias og valenstyper. Dette er en fast pedagogisk tekst som hjelper juristen forstå verktøyets begrensninger.

---

## 5. Gap-identifisering — null-treff som positivt funn

### Problemet

I juridisk analyse er fraværet av praksis like viktig som tilstedeværelsen. Hvis ingen KOFA-saker kobler §16-10 og §16-3, er det et analytisk funn — et hull som enten betyr at kombinasjonen er uproblematisk, eller at den er underbelyst.

### Løsning: Gap-matrise i venstrepanelet

En flat liste over bestemmelsespar med interseksjonstallet. Plassert i Kartlegging-seksjonen.

```
§16-10  ∩  §17-1     3
§16-10  ∩  §16-12    2
§16-10  ∩  LOA §5    2
§16-10  ∩  §16-3     ∅    ← lilla bakgrunn, klikkbar
§17-1   ∩  §16-12    ∅    ← lilla bakgrunn, klikkbar
§17-1   ∩  LOA §5    1
§17-1   ∩  §16-3     ∅    ← lilla bakgrunn, klikkbar
§16-12  ∩  LOA §5    ∅    ← lilla bakgrunn, klikkbar
```

Null-treff vises med ∅-symbol på lilla bakgrunn (#F3ECF8). Klikkbare — klikk kan åpne et ettersøk-forslag eller markere paret i grafen.

Under matrisen: en kursiv oppsummeringstekst — «4 bestemmelsespar uten felles praksis — mulige analytiske hull».

**Skaleringsbegrensning:** Matrisen viser bare par der *minst én* bestemmelse er en seed. Med 2 seeds og 6 tilknyttede bestemmelser er det ~13 par, ikke alle kombinasjoner. Grunnen: formålet er å vise hull *rundt* juristens utgangspunkt, ikke alle mulige kombinasjoner i hele grafen. Hvis brukeren har >10 seeds, har hun for mange problemstillinger i ett søk.

### Gap i grafvisningen

I grafvisningen vises gaps som stiplede, halvgjennomsiktige lilla linjer mellom to bestemmelsesnoder, med ∅-etikett på midtpunktet. Denne visuelle representasjonen gjør *fraværet* synlig i grafen uten å forurense — stiplede lilla linjer skiller seg klart fra reelle kanter.

---

## 6. Avgrensningspraksis — en egen dimensjon

### Problemet

C-saker (ett signal) inneholder ofte avgrensningspraksis — saker der nemnda slår fast at en bestemmelse *ikke* gjelder. Disse er like verdifulle som bekreftende praksis. Hvis de bare vises som «C-saker» nederst i listen, blir de behandlet som lavkvalitetstreff.

### Løsning: Avgrensning som innholdstag, ortogonal til A/B/C

A/B/C er oppdagelsessignal (mekanisk). Avgrensning er innholdstype (substansiell). De er to uavhengige dimensjoner.

En sak kan være A + Avgrensning (trippel treff, men nemnda fant at bestemmelsen ikke gjaldt). Det er sjeldent, men mulig.

**Visuell representasjon:**

Avgrensningsbadge: oransje (#C4650A) med ikon (sirkel med diagonal strek — ∅-konseptet). Vises uavhengig av og i tillegg til A/B/C-badge. Fargen er varm oransje, distinkt fra alle andre farger i systemet.

**I listevisningen:** Avgrensningsbadgen vises inline etter A/B/C-badge og signalprikker. Eget filter i verktøylinjen: «Avgrensning»-knapp som viser *bare* avgrensningssaker.

**I grafvisningen:** Noder med avgrensning får et lite ∅-ikon (sirkel med diagonal strek) som overlegg.

**I høyrepanelet:** Avgrensningssaker får en visuell markering nederst — en oransje boks med tekst: «Avgrensningspraksis — bestemmelsen ble vurdert som ikke-anvendelig».

**I venstrepanelet:** Avgrensningsantallet vises som egen rad under A/B/C-kategoriene, på oransje bakgrunn.

### Automatisk forslag til avgrensning

Avgrensningstaggen settes i utgangspunktet av juristen under screening. Men mange avgrensningssaker vil forbli utagget uten hjelp.

Systemet bør *foreslå* avgrensning automatisk basert på mønstre i `context`-feltet i `kofa_law_references` eller i avgjørelsesteksten. Typiske formuleringer:

- «nemnda finner at bestemmelsen ikke kommer til anvendelse»
- «§X er ikke relevant for den aktuelle anskaffelsen»
- «anførselen fører ikke frem da vilkårene ikke er oppfylt»

En enkel klassifiserer (regex eller NLP) setter et `suggested_delimitation`-flagg.

**Viktig: avgrensningsforslag er ikke en stille badge.** Forslaget setter en *substansiell juridisk etikett* på en sak. Feil klassifisering som juristen bekrefter uten å lese er verre enn ingen klassifisering. Derfor skal forslaget vises med en begrunnelse — en setning fra avgjørelsesteksten som utløste forslaget:

> *Foreslått avgrensning: nemnda uttaler at «§16-10 ikke er relevant for den aktuelle anskaffelsen» (avsnitt 42).*

I UI-et vises dette som en dempet versjon av avgrensningsbadgen — stiplet ramme i stedet for heltrukket — med begrunnelsen synlig i høyrepanelet og «Bekreft / Avvis»-valg. Juristen leser begrunnelsen og bekrefter med ett klikk. Det tar fem sekunder, men det tvinger henne til å *se* hvorfor systemet tror det er avgrensning.

---

## 7. Reguleringsversjon — kritisk filter

FOA ble vesentlig endret i 2017. Praksis under gammel FOA kan ikke uten videre brukes som autoritet for gjeldende rett. En jurist som ikke filtrerer bort gammel FOA-praksis risikerer å bygge analyse på ikke-gjeldende rett.

**Reguleringsversjonfilteret er fremtredende, ikke begravd.** Det vises som en gul advarselsboks i Resultater-seksjonen: «Kun gjeldende FOA (2017–)» med advarselsikon. Filteret er aktivert som default.

Noder fra gammel regulering som vises (ved deaktivert filter) dimmes til 20-25% opacity — synlige men tydelig deprioriterte.

---

## 8. Midtpanelet — listevisning og grafvisning

### Verktøylinje

Fast verktøylinje øverst med:

1. Paneltoggle-knapp (viser/skjuler venstrepanelet)
2. Visningsbytter: «Liste | Graf» — to-knapp-toggle, «Liste» er default og listet først
3. Listefiltre (kun synlig i listevisning): «Alle | Avgrensning | Ulest»
4. Nodetypelegende (kompakt, med ikoner): «Best. · KOFA · EU · Forarb.»

### 8a. Listevisning (default)

**Dette er primærvisningen.** De fleste jurister vil bruke listen mesteparten av tiden. Grafvisning er for strukturoppdagelse.

**Sortering:** Knapper for «Kategori» (default), «Siteringer», «Dato». Når «Siteringer» er valgt, vises en inline-advarsel: *«Eldre saker dominerer — kombiner med dato»*. Denne advarselen er viktig — den kommuniserer siteringsretningsbiasen i konteksten der det betyr noe.

**Filtrering:** «Alle» (default), «Avgrensning» (viser bare avgrensningssaker), «Ulest» (viser bare noder som ikke er markert som lest). Avgrensning-knappen bruker oransje farge når aktiv.

**Hvert listeelement viser:**

```
☐  ◉  2022/789    A  ●●○  Forpliktelseserklæring — tidspunkt
                            2022-11-22  Ikke brudd  7 sit.  ✓2020/567 ↔2023/456
```

Linje 1: Avkrysningsboks (lesestatus) · Nodetypeikon · Saksnummer (monospace, bold) · A/B/C-badge · R/F/V-signalprikker · Avgrensningsbadge (hvis aktuelt) · Iterasjonsbadge (hvis aktuelt)

Linje 2: Undertittel/beskrivelse

Linje 3: Dato · Utfall-badge · Siteringsantall · Valensindikatorer for siterte saker

**Avkrysningsboks:** Klikk markerer/avmarkerer noden som «lest og vurdert». Oppdaterer fremdriftslinjen i venstrepanelet. Grønn hake og grønn bakgrunn når markert.

**Klikk på raden (utenom avkrysningsboksen):** Åpner detaljer i høyrepanelet.

### 8b. Grafvisning

**Hierarkisk layout med tre lag:**

```
BESTEMMELSER        [§16-10]   [§17-1]   [§16-12]   [LOA §5]
                         \       |        /
PRAKSIS              (2023/456) (2022/789) (2021/234) ...
                         \       |
EU / FORARBEIDER      ◆C-324/14  ◆C-601/13  □Prop. 51 L
```

Øverst: Bestemmelser (rektangulære noder). Midten: KOFA-saker (sirkulære noder), sortert per kategori. Nederst: EU-dommer (diamantformede noder) og forarbeider.

Lagetiketter i venstre margin: «BESTEMMELSER», «PRAKSIS», «EU / FORARBEIDER» — dempet, uppercase, liten skrift.

**Nodeform koder type:**

| Nodetype | Form | Farge (bakgrunn/accent) |
|----------|------|------------------------|
| Bestemmelse | Rektangel (bred) | Blågrå #E8EEF0 / #4A6670 |
| KOFA-sak | Sirkel | Gullbrun #F0EBD8 / #8B6914 |
| EU-dom | Diamant (rotert firkant) | Sjøgrønn #E4F0EC / #2D6A5D |
| Rettsavgjørelse | Trekant | Fiolett #EDE4EE / #6B4C6E |
| Forarbeid | Rektangel (lav) | Varm grå #EDE8E0 / #7A6B5D |

**Nodestørrelse koder sentralitet/siteringer:** Mer siterte noder er større (base 22px, +5 ved 5+ siteringer, +10 ved 10+).

**Nodeetiketter:** Saksnummer/paragrafnummer i monospace, bold, i nodetypens accent-farge. Undertittel under noden i dempet sans-serif.

**Overlegg på noder:**

- A/B/C-badge (øvre høyre): liten hvit boks med bokstav
- Lest-markering (høyre): grønn sirkel med hake
- Avgrensning (øvre høyre, ved siden av kategori): oransje ∅-sirkel
- Seed-markering (venstre): liten fylt prikk i accent-farge
- Iterasjon 2+: grønn pill under noden med «iter. 2»

---

## 9. Kantvalens — siteringsretning og uenighet

### Problemet

Alle 6.616 kanter i `kofa_case_references` behandles som ekvivalente. Men siteringer har ulik semantikk:

- **Bekreftende** — «i samsvar med tidligere praksis»
- **Avgrensende** — «skiller seg fra», «i motsetning til»
- **Fravikende** — nemnda går eksplisitt bort fra tidligere praksis

En avgrensende sitering er en motpol, ikke en svak bekreftelse. Grafen uten valens gir feil bilde av konsensus vs. spenning.

### Visuell representasjon: linjestil, ikke farge

Farge er allerede brukt til nodetyper. Valens kommuniseres med linjestil:

| Valens | Linjestil | Farge | Opacity |
|--------|-----------|-------|---------|
| Bekreftende / Ukjent | Heltrukket | Dempet grå (#borderM) | 0.3 |
| Avgrensende | Lang-stiplet (5,3) | Gul/varm (#A67B2E) | 0.5 |
| Fravikende | Kort-stiplet (2,3) | Rød/dempet (#A63D3D) | 0.5 |

**Designbeslutning: Vis valens permanent bare for avgrensende og fravikende kanter.** Bekreftende/ukjente kanter er alle heltrukne og dempede — det er default, det er det meste, og det skaper ingen visuell støy. Stiplede linjer dukker bare opp der det *er* spenning, og de er få nok til å være leselige.

En valenslegende i grafvisningens øvre høyre hjørne viser de tre linjestilene med etiketter.

### I listevisningen

Valensindikatorer vises som små ikoner (✓/↔/✕) ved siden av saksnummeret til den siterte saken, nederst i listeelementet.

### I høyrepanelet

Relasjonslisten viser valens som en liten pip (fargekodede ikoner) mellom nodetypeikon og saksnummer for hver relasjon.

### Status: ikke implementert i data

Sitatvalens er den enkeltfaktoren som mest forvrenger sentralitetsanalysen. `context`-kolonnen i `kofa_case_references` inneholder setningskonteksten og kan brukes til NLP-basert valensparsing. Inntil det er implementert, vises alle kanter som «ukjent» (heltrukket, dempet). **UI-et er designet for valens fra dag 1, selv om dataene ikke er klare.**

### Siteringsretningsbias

Eldre saker har hatt lengre tid til å bli sitert. Citation count og PageRank favoriserer derfor systematisk gamle saker over nyere praksis. En ny prinsipiell avgjørelse fra 2024 kan ha null siteringer og vil ligge i periferien.

Denne biasen kommuniseres til brukeren på to steder:

1. **I sorteringsvelgeren (listevisningen):** Inline-advarsel når «Siteringer» er valgt: *«Eldre saker dominerer — kombiner med dato»*
2. **I seksjon 5 i venstrepanelet («Om rangeringen»):** Fast pedagogisk tekst som forklarer biasen

---

## 10. Høyrepanelet — guidet leseopplevelse

### Kjerneprinsipp: tillitsskillet mellom innhold og kuratering

Høyrepanelet har to typer innhold med fundamentalt ulik tillitsstatus:

**Databaseinnhold (autoritativt):** Avgjørelsestekst, lovtekst, EU-dom-tekst. Hentet ordrett fra databasen. Juristen kan stole på dette som hun stoler på Lovdata. Vist med normal tekststyling — svart tekst på hvit/lys bakgrunn.

**AI-kuratering (nyttig, fallibelt):** Hvilke avsnitt som er markert som relevante, hvilke sitater som er fremhevet, kommentarer som kobler avsnitt på tvers av saker, navigasjonslenker til relaterte passasjer. AI-ens bidrag, ikke databasens. Vist med en distinkt visuell stil som aldri kan forveksles med databaseinnholdet.

**Visuelt skille — ufravikelig regel:** AI-kuratering vises alltid med dempet gullbrun venstrekant og svak bakgrunn. Databaseinnhold vises uten denne markeringen. Juristen skal *aldri* måtte lure på om teksten hun leser er fra databasen eller generert av AI.

### Struktur

Høyrepanelet er én fast container som oppdaterer innholdet basert på valgt nodes type. To visningsmoduser per node:

**Oversiktsmodus (default ved klikk):** Metadata, sammendrag, relasjoner, notater — som i forrige versjon av spesifikasjonen. Rask skanning.

**Lesemodus (toggle fra oversikt):** Full avgjørelsestekst med AI-kuratering. Guidet leseopplevelse.

Knapp for å bytte: «Les avgjørelsen →» i oversiktsmodus, «← Tilbake til oversikt» i lesemodus.

### Oversiktsmodus — felles elementer (alle nodetyper)

**Header:** Bakgrunn i nodetypens dempede farge. Viser: nodetypeikon + etikett, saksnummer/paragrafnummer (stor, monospace), undertittel, metadata-rad (kategori, signalprikker, avgrensningsbadge, dato, utfall, siteringer, direktiv).

Lukkeknapp (×) øverst til høyre.

**AI-kuratert sammendrag av relevante avsnitt:** Før «Les avgjørelsen»-knappen viser oversiktsmodus en kort seksjon med de avsnittene AI har identifisert som relevante for juristens problemstilling. Hvert avsnitt vises som en kompakt forhåndsvisning:

```
┌─ AI-markert ────────────────────────────────────────────┐
│ ▎ Avsnitt 42                                            │
│ ▎ «Nemnda finner at kravet til forpliktelseserklæring   │
│ ▎  må foreligge ved tilbudsfristen.»                    │
│ ▎                                    Les i kontekst →   │
│                                                         │
│ ▎ Avsnitt 47                                            │
│ ▎ «Det er ikke tilstrekkelig at ESPD alene              │
│ ▎  dokumenterer rådighet.»                              │
│ ▎                                                       │
│ ▎  💬 Motstridende: 2022/789 avsnitt 38 sier            │
│ ▎     at ettersending kan aksepteres               →    │
│ ▎                                    Les i kontekst →   │
└─────────────────────────────────────────────────────────┘
```

Struktur per avsnitt-forhåndsvisning:
- Avsnittsnummer
- Det sentrale sitatet (fra databasen — ordrett avgjørelsestekst, gulmarkert)
- Eventuell AI-kommentar (med dempet gullbrun venstrekant): kobling til andre saker, motstrid, mønster
- «Les i kontekst →» — klikk åpner lesemodus og scroller til dette avsnittet med kontekst rundt

**Mine notater:** Alltid tilgjengelig, uavhengig av nodetype og modus.

**Handlinger:** «Marker som lest» (toggle), «Bruk som seed i neste iterasjon».

### Lesemodus — den guidede leseopplevelsen

Lesemodus viser full avgjørelsestekst fra databasen (hentet fra `kofa_decision_text`), med AI-kuratering lagt oppå:

**Gulmarkerte sitater:** Passasjer som AI har identifisert som substansielt relevante for juristens problemstilling. Bakgrunn i dempet gul (#FBF5E8). Teksten er ordrett fra databasen — gulmarkeringen er AI-ens bidrag.

**Innebygde AI-kommentarer:** Etter et gulmarkert avsnitt kan det ligge en AI-kommentar — visuelt differensiert med gullbrun venstrekant og svak bakgrunn:

```
  Avsnitt 42
  Nemnda finner at kravet til forpliktelseserklæring må
  foreligge ved tilbudsfristen. Oppdragsgiver hadde rett   ← gulmarkert
  til å avvise tilbudet.

  ▎ AI: Dette er det sentrale rettslige utsagnet.          ← AI-kommentar
  ▎ Merk motstrid med 2022/789 avsnitt 38, der nemnda
  ▎ aksepterte ettersending.
  ▎                                → Gå til 2022/789 §38
```

**Navigasjonslenker:**
- «→ Gå til 2022/789 §38» — klikk bytter høyrepanelet til den andre saken og scroller til avsnittet. Juristen følger AI-ens krysreferanser mellom saker.
- «→ Se FOA §16-10» — klikk åpner bestemmelsen i høyrepanelet.
- «→ Se C-324/14 Partner Apelski §63» — klikk åpner EU-dommen.

**Avsnittnavigering:** En kompakt meny i toppen av lesemodus viser alle AI-markerte avsnitt som klikkbare pills:

```
  Markerte avsnitt: [§38] [§42] [§47] [§51]
```

Klikk hopper til avsnittet. Dimmet bakgrunn på avsnitt juristen allerede har scrollet forbi.

**Ikke-markerte avsnitt:** Teksten mellom markerte avsnitt er synlig men visuelt dempet (lavere opacity, f.eks. 0.5). Juristen kan klikke på dempet tekst for å vise den med full opacity — hun er ikke låst til AI-ens kuratering. En toggle «Vis all tekst / Vis bare markerte» i toppen lar henne bytte mellom kuratert og full visning.

### Tillitsmodellen i detalj

Tre nivåer av innhold i lesemodus, visuelt differensiert:

| Innholdstype | Kilde | Visuell stil | Tillit |
|-------------|-------|-------------|--------|
| Avgjørelsestekst | Database | Normal svart tekst | Full — ordrett fra primærkilde |
| Gulmarkering | AI | Dempet gul bakgrunn på databasetekst | Nyttig — AI mener dette er relevant |
| AI-kommentar | AI | Gullbrun venstrekant, avvikende bakgrunn, litt mindre skrift | Fallibelt — AI-ens tolkning, ikke primærkilde |

Regelen er enkel: **tekst uten visuell markering er fra databasen. Tekst med gullbrun venstrekant er fra AI.** Ingen mellomting, ingen gråsoner.

### Hvordan AI-kurateringen genereres

Når juristen klikker på en node for første gang, sender systemet et MCP-kall til sparringspartnerens LLM med:

- Avgjørelsesteksten (fra databasen)
- Juristens problemstilling
- Juristens seed-bestemmelser
- Eventuelt: andre saker juristen allerede har lest (for kryssreferanser)

LLM-en returnerer et strukturert svar:

```json
{
  "highlights": [
    {
      "paragraph": 42,
      "start_char": 0,
      "end_char": 147,
      "relevance": "Sentralt rettslig utsagn om tidspunkt for forpliktelseserklæring",
      "cross_references": [
        {
          "target_case": "2022/789",
          "target_paragraph": 38,
          "relation": "contradicting",
          "note": "Nemnda aksepterte her ettersending"
        }
      ]
    }
  ],
  "summary_note": "Saken fastslår at ESPD alene ikke er tilstrekkelig..."
}
```

Kurateringen caches per node per problemstilling — den regenereres ikke ved hvert klikk. Endres problemstillingen eller seedsene, invalideres cachen.

### Oversiktsmodus per nodetype

#### KOFA-sak

- Header med metadata
- AI-kuraterte relevante avsnitt (som beskrevet over)
- «Les avgjørelsen →» (åpner lesemodus)
- Treffsignaler (R/F/V)
- Relasjoner med valensindikatorer
- Notater
- Handlinger
- Avgrensningsmarkering hvis aktuelt

#### Lovparagraf (bestemmelse)

- **Ordlyd** (den faktiske lovteksten — autoritativ databasetekst, vises øverst)
- Plassering i lovstrukturen (del → kapittel → paragraf)
- Antall KOFA-saker som refererer paragrafen
- Direktivgrunnlag med implementeringstype (full | partial | extended | disputed). `disputed`-koblinger er visuelt fremhevet
- AI-kuratert: relevante forarbeidsavsnitt med gulmarkering og kommentarer
- Relevante forarbeidskommentarer (kollaperbart)

#### EU-dom

- **Partsnavn størst** («Partner Apelski», ikke «C-324/14»). Saksnummer er sekundær identifikator
- **Direktivartikkel-kobling**
- **Implementeringstype**
- **Norsk kobling** — hvilke FOA-paragrafer direktivartikkelen er gjennomført i
- AI-kuraterte relevante avsnitt fra EU-dommen (lesemodus tilgjengelig)
- AI-kommentar: hva denne dommen betyr for den norske problemstillingen (med gullbrun venstrekant — tydelig markert som AI-tolkning)
- KOFA-saker som siterer denne dommen, med valensindikatorer

#### Forarbeid

- **Proposisjonsnummer og tittel**
- **Relevant seksjon** med AI-gulmarkering av passasjer som er relevante for problemstillingen
- Mulighet for å ekspandere til tilstøtende seksjoner
- Koblede bestemmelser

#### Norsk rettsavgjørelse

- Saksnummer, instans, dato
- AI-kuratert sammendrag med relevante avsnitt
- Koblede KOFA-saker

---

## 11. Signaturelementet — trippel-signalindikatoren (R/F/V)

Tre små prikker som viser hvilke søkesignaler som fant noden:

```
●●○   R og F traff, V traff ikke
●●●   Alle tre traff (A-kategori)
○●○   Bare F traff (C-kategori)
```

Fylt prikk = signalet fant noden. Tom prikk med dempet ramme = signalet fant den ikke.

Vises: i listevisningen (inline etter A/B/C-badge), på noder i grafen (ikke implementert i mock men bør vurderes), i høyrepanelets header, og utbrettet med forklaringstekst i høyrepanelets treffsignaler-seksjon.

Hover/title på prikkene: «R: Referansetabell  F: Fulltekst  V: Vektor».

Indikatoren er unik for dette verktøyet — den finnes ikke i andre juridiske verktøy. Den gjør det mulig for juristen å se *hvorfor* noe er kategorisert som A, B eller C uten å klikke, og å kalibrere sin tillit til treffet.

---

## 12. Progressiv ekspansjon

### Problemet

En traversal fra §5-2 med dybde 2 kan gi 200+ noder. Full graf fra start er visuelt ubrukelig. Brukeren er en jurist som aldri har brukt grafvisualisering.

### Løsning: Listevisning som default, grafvisning med aggregater

**Steg 1:** Juristen starter alltid i listevisningen. Listen viser alle treff med A/B/C-kategorisering, sorterbart og filtrerbart. Hun kan arbeide effektivt i listen uten å åpne grafen.

**Steg 2:** Når hun bytter til grafvisningen, vises seed-bestemmelsene som noder med aggregatbadges:

```
[FOA §16-10]
    |
  (23 KOFA-saker)    ← klikkbar aggregatboks med stiplet ramme
    |
  (2 EU-dommer)      ← klikkbar aggregatboks
```

Aggregatbokser viser antall per nodetype. Klikk ekspanderer gruppen og viser individuelle noder sortert etter sentralitet (mest siterte først).

**Steg 3:** Ekspanderte noder fryses (posisjon låses). Nye noder plasseres i nærheten av forelderenoden uten å flytte eksisterende noder.

### Layout-stabilitet

Når juristen ekspanderer en gruppe, skal noder hun allerede har studert forbli på plass. Implementeres med node-locking (Cytoscape: `node.lock()`, D3: `fx`/`fy`-pinning).

Over mange ekspansjoner kan layouten bli suboptimal. Løsningen er en eksplisitt «Reorganiser»-knapp som frigir alle noder og kjører full layout på nytt, med animasjon. **Re-layout er alltid brukerinitiiert, aldri automatisk.**

---

## 13. Grafbibliotek — teknisk vurdering

### Krav

1. Hierarkisk layout som reflekterer rettskildens lagdeling (bestemmelser øverst, praksis i midten, EU/forarbeider nederst)
2. Node-locking ved inkrementell tillegg av noder
3. 200+ noder uten ytelsesdegenerasjon
4. Gruppering/clustering for progressiv ekspansjon (compound nodes eller tilsvarende)
5. Integrasjon med valgt rammeverk (Svelte eller React)

### Alternativer vurdert

**Cytoscape.js:** Dagre-layout (hierarkisk), `node.lock()` for stabilitet, compound nodes for gruppering. Canvas-basert. Godt dokumentert. Begrensning: nodepresentasjonen er begrenset til canvas-styling — vanskelig å vise rik tekst, badges og interaktive elementer *inne i* noder.

**D3-force + dagre:** D3 beregner layout, rammeverket (Svelte/React) rendrer SVG. Full kontroll over nodepresentasjon — noder er DOM-elementer med CSS. Begrensning: compound nodes/clustering må bygges manuelt.

**Sigma.js:** WebGL, 10.000+ noder, men begrenset hierarkisk layout og ingen compound nodes. Feil fit for dette domenet.

### Anbefaling

To mulige veier, avhengig av prioritering:

**Vei A — Cytoscape.js først:** Raskere til fungerende versjon. Compound nodes innebygd. Men nodepresentasjonen er begrenset, og et bibliotekbytte senere er en fullstendig omskriving.

**Vei B — D3/dagre + Svelte/React:** Lengre tid til første versjon. Bedre sluttprodukt fordi noder er DOM-elementer med full kontroll. Compound nodes må bygges manuelt — designmønsteret for gruppering bør defineres tidlig.

**Uansett valg:** Grafbiblioteket er den mest innlåsende teknologibeslutningen i hele prosjektet. Et bytte er 3-6 måneders arbeid. Prototyp med reelle data (100+ noder fra en faktisk traversal) før commit.

---

## 14. Iterasjonshistorikk

Noder som dukket opp i ulike iterasjoner bør være visuelt differensiert. Iterasjon 1 er primærsøket, iterasjon 2+ er ettersøk.

Noder fra iterasjon 2+ vises med en grønn «iter. N»-pill under noden i grafvisningen og som en grønn badge i listevisningen.

Begrunnelse: det gjør det synlig at rettskildebildet er *bygget opp over tid* — sentrale noder dukker opp tidlig, perifere sent. Juristen ser strukturen i sin egen kartleggingsprosess.

---

## 15. Filtrering — dimming, ikke fjerning

Aktive filtre (f.eks. «vis bare saker etter 2017», «vis bare A-saker») bør dimme noder til 15-25% opacity, ikke fjerne dem. Ellers mister juristen oversikt over hva som finnes vs. hva som er filtrert bort.

Kanter til/fra dimmede noder dimmes også. Kanter *mellom* to synlige noder beholder full opacity.

Dimmede noder forblir klikkbare — klikk åpner høyrepanelet som normalt, men med en visuell indikator som minner om at noden er utenfor filteret.

---

## 16. Kjente svakheter — ting UI-et ikke kan løse

Disse bør kommuniseres til brukeren, ikke skjules:

1. **Automatisk ekstraherte referanser har ukjent feilrate.** En feilparsert paragrafhenvisning er visuelt identisk med en korrekt. Vurder datakvalitetsindikatorer.
2. **Sentralitet ≠ rettslig vekt.** Mye-sitert betyr ikke autoritativ. UI-et bør aldri bruke ordet «viktigst» om mest-siterte noder.
3. **Semantisk nærhet uten strukturell kobling er usynlig.** To saker om samme rettslige problem som ikke siterer hverandre vil ligge langt fra hverandre i grafen.
4. **Sitatvalens er ukjent** for alle 6.616 kanter inntil NLP-parsing er implementert.
5. **Datasettet er begrenset til KOFA.** Norske domstoler, ESA-avgjørelser og juridisk litteratur er ikke i grafen. En jurist som stoler på at grafen viser *alt* relevant vil mangle kilder.

---

## 17. Designtokens — komplett referanse

```
Bakgrunn
  bg:       #F5F3EE       Hovedbakgrunn
  panel:    #FAF9F6       Panel-bakgrunn
  surface:  #FFFFFF       Kort/overflate
  input:    #EFECE5       Inputfelt-bakgrunn
  hover:    rgba(26,24,20,0.03)
  active:   rgba(26,24,20,0.06)

Tekst
  ink:      #1A1814       Primærtekst
  ink2:     #5C564D       Sekundærtekst
  ink3:     #8C8578       Tertiærtekst / metadata
  ink4:     #B0A99E       Dempet tekst / etiketter

Rammer
  border:   rgba(26,24,20,0.08)    Standard
  borderM:  rgba(26,24,20,0.13)    Medium
  borderS:  rgba(26,24,20,0.22)    Sterk

Nodetyper
  provision:    bg #E8EEF0  accent #4A6670  border #C5D3D8
  kofa_case:    bg #F0EBD8  accent #8B6914  border #DDD3B0
  eu_case:      bg #E4F0EC  accent #2D6A5D  border #BDD9CF
  court_case:   bg #EDE4EE  accent #6B4C6E  border #D4C4D6
  prep_work:    bg #EDE8E0  accent #7A6B5D  border #D5CEC3

Semantisk
  success:    #3D7A4A  bg #EBF5ED    Lest, bekreftende
  warn:       #A67B2E  bg #FBF5E8    Brudd, avgrensende valens
  danger:     #A63D3D  bg #F5EBEB    Fravikende valens
  gap:        #9B4DCA  bg #F3ECF8    Analytiske hull
  delim:      #C4650A  bg #FDF2E7    Avgrensningspraksis

AI-kuratering
  highlight:  #FBF5E8                Gulmarkert databasetekst (bakgrunn)
  aiComment:  #8B6914               AI-kommentar venstrekant
  aiCommentBg:rgba(139,105,20,0.04) AI-kommentar bakgrunn
  aiSuggested:rgba(139,105,20,0.15) Foreslått (stiplet ramme, ubekreftet)

Signalprikker
  signalOn:   #1A1814
  signalOff:  #D5D0C8
```

---

## 18. AI-integrasjon — to lag

Systemet har to lag med AI-integrasjon. De tjener ulike formål og har ulike designkrav.

### Lag 1: Deterministiske verktøy (innebygd, usynlig)

Enkle, nesten deterministiske LLM-kall som kjøres automatisk som del av arbeidsflyten. Ingen chat, ingen interaksjon — bare forslag som dukker opp og kan redigeres.

### Lag 2: Sparringspartner (chatpanel, toggle)

Et chatpanel der juristen kan stille spørsmål, få mønstre identifisert og bli utfordret på sine foreløpige konklusjoner. LLM-en har via MCP tilgang til hele databasen og kjenner juristens arbeidshistorikk.

---

## 19. Lag 1 — deterministiske verktøy i detalj

### Grensedragning: hva som kjøres automatisk

Ikke alle AI-forslag er like trygge å kjøre automatisk. Grensen trekkes basert på *konsekvensen av feil*:

| Verktøy | Automatisk? | Begrunnelse |
|---------|------------|-------------|
| Vektor-seed fra problemstilling | Ja | Feil reduserer dekningen litt, men ødelegger ikke søket — resultatet er ett av fire signaler |
| Forslag til relevante bestemmelser | Ja, som *tillegg* | Feil her former hele søket — derfor vises forslag *under* juristens egne seeds, aldri som pre-utfylte seeds |
| Vinkelrotasjons-begreper | Ja, ved trigger | Foreslås bare når FTS returnerte lite — et konkret signal om at søket trenger hjelp |
| Avgrensningsforslag | Mekanismen er automatisk, presentasjonen krever bekreftelse | Setter en substansiell juridisk etikett — krever begrunnelse og bekreftelse (se seksjon 6) |

### Vektor-seed fra problemstilling

Når juristen skriver problemstillingen i seksjon 1, genereres vektor-seed automatisk — en omformulering av den juridiske problemstillingen til en søkbar konseptuell beskrivelse. Forslaget dukker opp i vektor-seed-feltet i seksjon 2 og kan redigeres fritt.

Feilrisikoen er lav fordi vektor-seeden brukes som ett av fire søkesignaler. En middelmådig seed gir litt dårligere dekning, ikke null dekning.

### Forslag til relevante bestemmelser

Systemet foreslår bestemmelser som kan være relevante basert på problemstillingen. **Disse vises som «Disse bestemmelsene kan også være relevante» *under* juristens egne seeds — aldri som pre-utfylte seeds.** Rekkefølgen betyr noe: det som er der fra start oppleves som «gitt», det som foreslås oppleves som «valgfritt».

Visuelt: forslagsbestemmelser vises som chips med dempet styling og stiplet ramme. Klikk legger dem til som seeds (rammen blir heltrukket). Avvis med × på chippen.

### Vinkelrotasjons-begreper

Når FTS returnerer lite (under en terskel), foreslår systemet alternative søkebegreper: «Prøv også: 'råder over', 'underleverandør + kvalifikasjon', 'kapasitetsdokumentasjon'».

Trigger: FTS-treffantall under terskel. Ikke alltid synlig — bare når det er et konkret signal om at søket trenger hjelp. Vises som dempede chips under FTS-begrep-feltet i seksjon 2.

---

## 20. Lag 2 — sparringspartneren i detalj

### Plassering: bunnpanel-skuff i midtpanelet

Chatpanelet er en skuff som skyves opp fra bunnen av midtpanelet. Ikke en modal, ikke et eget vindu, ikke en sidebar. Grunnen: juristen jobber i liste- eller grafvisningen, ser noe hun lurer på, og vil stille et spørsmål uten å miste konteksten.

**Tre tilstander:**

```
Lukket:     [──────────────────────── 💬 Sparring ──]   ← liten knapp i bunnlinjen

Halvåpen:   ┌─────────────────────────────────────────┐
            │  Liste/graf (~60% høyde)                │
            ├─────────────────────────────────────────┤
            │  Chat (~40% høyde)                      │
            │  Nok for 2-3 meldinger                  │
            │  Grafen er synlig over                   │
            └─────────────────────────────────────────┘

Fullskjerm: ┌─────────────────────────────────────────┐
            │  Chat (hele midtpanelet)                │
            │  For lengre samtaler                    │
            └─────────────────────────────────────────┘
```

Juristen drar i kanten eller dobbeltklikker for å bytte mellom halvåpen og fullskjerm.

**Kritisk: chatpanelet erstatter ikke høyrepanelet.** Hvis juristen har høyrepanelet åpent og åpner chatten, skal begge være synlige — høyrepanelet viser saken, chatten diskuterer den. Midtpanelet krymper vertikalt, men høyrepanelet beholder sin plass.

### Kontekststyring

Full arbeidshistorikk er for stor og mesteparten er irrelevant for det aktuelle spørsmålet. Konteksten er delt i to lag:

**Fast kontekstlag (~2000 tokens, sendes alltid):**

- Problemstillingen
- Seed-bestemmelsene med ordlyd
- Hvilke saker som er lest, med kategori og avgrensningsstatus
- Juristens notater (komprimert)
- Gjeldende iterasjon og hva som utløste den
- Gap-matrisens null-treff

Dette er «arbeidsøkten i et nøtteskall» — nok til at LLM-en forstår hva juristen jobber med og hvor langt hun har kommet.

**Dynamisk kontekstlag (hentes per spørsmål via MCP):**

LLM-en bruker MCP-verktøyene aktivt for å hente det den trenger — `hent_avgjoerelse`, `lov`, `hent_eu_dom`, `semantisk_sok_kofa` osv. Den skal lese sakene selv, ikke stole på sammendrag. System-prompten instruerer den til å bruke verktøyene, ikke å besvare spørsmål fra fast kontekst alene.

Fordelen: konteksten skalerer. Det faste laget vokser sakte (en ny sak lest = en ny rad). Det dynamiske laget er proporsjonalt med spørsmålets kompleksitet.

### Bekreftelsesbias — strukturell motgift

Risikoen er spesifikk: en LLM som vet at juristen har tagget tre saker som «bekreftende for krav om forpliktelseserklæring ved tilbudsfrist» og deretter blir spurt «er det konsensus om dette?», vil tendere mot å svare ja — fordi konteksten er skjev mot juristens foreløpige mønster.

**Løsning 1: Innebygd devil's advocate i alle svar.**

En eksplisitt «utfordre-modus» med egen knapp fungerer ikke — juristen som trenger den mest er minst tilbøyelig til å trykke på den. I stedet har sparringspartneren et fast `devil's advocate`-steg i alle svar. System-prompten instruerer den til å, etter å ha besvart spørsmålet, alltid legge til en seksjon:

> **Mulige motargumenter**
> [Aktivt søk etter motstridende praksis, ubesvarte spørsmål, eller svakheter i mønsteret]

Ikke som valgfri modus, men som fast struktur.

**Løsning 2: Periodiske, ubedde utfordringer.**

Etter at juristen har lest og tagget et visst antall saker (f.eks. 8), dukker det opp en ubedt melding i chatpanelet — ikke et popup, men en dempet, kollaperbar boks:

> *Basert på dine notater ser det ut til at du har identifisert et mønster om [X]. Jeg fant 2 saker i datasettet som du ikke har lest ennå som kan utfordre dette: [sak1] og [sak2]. Vil du se dem?*

Dette er en *strukturell motgift* mot bekreftelsesbias. Den utløses av systemet, ikke av juristen.

Visuelt: dempet bakgrunn (ikke den vanlige chatboble-stilen), kollaperbar, med en liten «AI-forslag»-etikett. Saksnumrene er klikkbare og åpner nodene.

### Klikkbare referanser

Sparringspartneren vil ofte referere til spesifikke saker, bestemmelser og EU-dommer. Disse referansene skal være klikkbare:

- Klikk på «2022/789» i en chatmelding åpner saken i høyrepanelet
- Klikk på «FOA §16-10» markerer paragrafen i grafen/listen
- Klikk på «C-324/14 Partner Apelski» åpner EU-dommen

Chatten er ikke et separat verktøy — den er koblet til resten av arbeidsflaten. Referanser er lenker mellom chat og graf/liste/høyrepanel.

### Hva sparringspartneren kan og ikke kan

**Kan:**
- Identifisere mønstre på tvers av screenede saker
- Peke på motstrid mellom avgjørelser
- Foreslå neste hermeneutiske steg (nye seeds, nye begreper, gap-søk)
- Utfordre juristens foreløpige konklusjoner med motstridende saker
- Oppsummere rettskildebildet slik det ser ut så langt
- Lese hele avgjørelsestekster via MCP og finne relevante avsnitt
- Kuratere høyrepanelet: markere relevante passasjer, legge inn kryssreferanser og kommentarer i lesevisningen (se seksjon 10)

**Kan ikke / skal ikke:**
- Trekke rettslige konklusjoner — den er en sparringspartner, ikke en rådgiver
- Erstatte juristens lesing av primærkildene
- Presentere seg som autoritativ på rettslige spørsmål

System-prompten skal inneholde en eksplisitt begrensning: «Du er en analytisk sparringspartner for rettskildeanalyse. Du identifiserer mønstre, peker på hull, og utfordrer foreløpige konklusjoner. Du trekker aldri rettslige konklusjoner eller gir rettslige råd.»

---

---

## 21. Rettssetningsregisteret

### Problemet

Juristen leser avgjørelsestekster og identifiserer *rettssetninger* — det konkrete rettslige utsagnet nemnda gjør. «Forpliktelseserklæring må foreligge ved tilbudsfristen.» «Ettersending kan aksepteres dersom tilbudet inneholder tilstrekkelig informasjon.» I dag noterer hun disse manuelt i et Word-dokument, uten strukturell kobling til primærkildene.

AI-kurateringen (seksjon 10) identifiserer allerede relevante avsnitt. Det neste steget er å trekke ut *rettssetningene* fra disse avsnittene og organisere dem i et register som akkumulerer på tvers av saker.

### Registeret

Et rettssetningsregister som viser hvordan et rettslig prinsipp har utviklet seg over tid:

```
Rettssetning: «Forpliktelseserklæring ved tilbudsfrist»

  2018/123  §51   Etablert    «Rådighet må dokumenteres likt for alle»
  2022/789  §38   Nyansert    «Ettersending aksepteres under vilkår»
  2023/456  §42   Bekreftet   «ESPD alene er ikke tilstrekkelig»
```

Hvert element i registeret er klikkbart — klikk åpner avgjørelsesteksten i høyrepanelet med lesemodus, scrollet til riktig avsnitt.

### Tillitsskillet gjelder også her

Rettssetningens *tekst* er fra databasen (ordrett sitat fra avgjørelsen). *Klassifiseringen* (etablert/nyansert/bekreftet/fraveket) er AI-ens bidrag — vist med gullbrun venstrekant, som alle AI-bidrag.

Juristen kan overstyre klassifiseringen. «Nyansert» kan endres til «fraveket» med ett klikk. AI-ens forslag er et utgangspunkt, ikke en fasit.

### Motstrid som eksplisitt funn

Det mest verdifulle: registeret gjør motstrid eksplisitt. To rettssetninger som peker i ulik retning flagges automatisk. I eksempelet over: 2023/456 sier at forpliktelseserklæring *må* foreligge ved tilbudsfrist, mens 2022/789 sier at ettersending *kan* aksepteres. Denne spenningen er *det* juristen leter etter — der rettskildebildet er uavklart.

Visning: motstridende rettssetninger kobles med en rød stiplet linje (fravikende valens-styling) og en kort AI-kommentar som forklarer spenningen.

### Plassering

Registeret kan ligge som en sjette seksjon i venstrepanelet (kollaperbar), eller som en tredje visningsmodus i midtpanelet (Liste | Graf | Rettssetninger). Venstrepanel-plassering er bedre for rask referanse; midtpanel-plassering er bedre for dypere arbeid med registeret.

Anbefaling: start med venstrepanelet. Hvis registeret blir stort (>15 rettssetninger), flytt til midtpanelet.

### Kobling til lovkommentarer

Rettssetningsregisteret er den naturlige broen til *lag 2* i to-lagsmodellen (lovkommentarer per bestemmelse). Rettssetninger fra ulike problemdrevne notater akkumulerer under den relevante bestemmelsen og blir grunnlaget for lovkommentaren. Systemet bør derfor lagre rettssetninger med en kobling til bestemmelsen de tolker — `rettssetning → paragraf` — slik at de kan aggregeres per bestemmelse over tid.

---

## 22. Tidslinjevisning

### Behovet

Liste og graf dekker to perspektiver: rangert relevans og strukturelle relasjoner. Det tredje perspektivet er *tid*. Rettsutvikling er temporal — prinsipper etableres, nyanseres, fravikes. Juristen trenger et temporalt overblikk over hvordan rettskildebildet har utviklet seg.

### Design

En horisontal tidslinje med saker plottet langs en tidsakse, gruppert vertikalt per bestemmelse (eller per rettssetning).

```
         2018        2019        2020        2021        2022        2023
§16-10   ●2018/123   ○2019/890                          ●2022/345   ●2023/456
                                                        ●2022/789
§17-1                            ●2020/567              ●2022/789   ●2023/456
EU art.63                                                           ◆C-324/14
```

Nodestørrelse koder siteringer. Valens-linjer mellom noder viser bekreftende/avgrensende/fravikende relasjoner. Klikk på node åpner høyrepanelet.

### Siteringsretningsbias — visuelt intuitiv

Tidslinjen gjør biasen *synlig uten forklaring*: store noder (mange siteringer) ligger til venstre (gamle), små noder ligger til høyre (nye). Juristen *ser* at nyere praksis er underrepresentert i sentralitetsrangeringen.

### Plassering

Tredje visningsmodus i midtpanelet: Liste | Graf | Tidslinje. Deler verktøylinje og filtre med de andre visningene.

### Rettssetninger på tidslinjen

Hvis rettssetningsregisteret er implementert, kan rettssetninger plottes som «hendelser» på tidslinjen — et prinsipp etableres i 2018, nyanseres i 2022, bekreftes i 2023. Det gir tidslinjen analytisk dybde utover bare «her er sakene kronologisk».

---

## 23. Eksport som arbeidsnotat

### Problemet

Arbeidsflyten ender ikke i verktøyet — den ender i et dokument. Metodikken produserer et «problemdrevet notat» som er det faktiske arbeidsproduktet. Uten eksport henger verktøyet i luften — juristen må manuelt overføre funn til Word, og mye av strukturen går tapt.

### Eksportens innhold

Eksporten genererer et strukturert utkast basert på alt juristen har gjort i verktøyet:

1. **Problemstillingen** — ordrett fra seksjon 1
2. **Søkeparametre** — bestemmelser, FTS-begreper, vektor-seeds
3. **Metodikk** — antall iterasjoner, hva som utløste hver iterasjon
4. **Kandidatliste** — alle treff med A/B/C-kategorisering, lesestatus, avgrensningsstatus
5. **Rettssetningsregisteret** — med kildehenvisninger og klassifisering
6. **Gap-analyse** — bestemmelsespar uten felles praksis
7. **Juristens notater** — per sak, strukturert under relevant rettssetning
8. **Åpne spørsmål** — identifisert av sparringspartneren eller markert av juristen
9. **Kildeliste** — alle leste saker, EU-dommer og forarbeider

### Format

Markdown eller docx. Docx er bedre for jurister som redigerer videre i Word. Markdown er bedre for versjonskontroll og maskinlesbarhet.

Anbefaling: støtt begge. Default docx.

### Eksporten er et utkast, ikke en rapport

Kritisk designbeslutning: eksporten er ikke en rapport *fra* verktøyet. Den er et *utkast* til arbeidsproduktet. Den har overskrifter og struktur, men den har bevisst tomme seksjoner markert med «[Juristens vurdering]» der den rettslige vurderingen hører hjemme. Verktøyet fyller inn det det kan (funn, struktur, kilder), juristen fyller inn det verktøyet ikke kan (vurdering, skjønn, konklusjon).

---

## 24. Sammenligningsmodus — side-by-side

### Behovet

Kryssreferanselenker i AI-kurateringen lar juristen hoppe mellom saker. Men for å *sammenligne* to motstridende avsnitt trenger hun å se begge samtidig. «Hva sier 2023/456 §42 vs. 2022/789 §38?» krever begge avsnittene synlige.

### Design

Når juristen følger en kryssreferanselenke, kan høyrepanelet deles vertikalt i to halvpaneler:

```
┌──────────────────────────────────┐
│ 2023/456                         │
│ Avsnitt 42                       │
│ «Nemnda finner at kravet til     │
│  forpliktelseserklæring må       │
│  foreligge ved tilbudsfristen.»  │
├──────────────────────────────────┤
│ 2022/789                         │
│ Avsnitt 38                       │
│ «Nemnda finner at forpliktelse-  │
│  serklæring kan ettersendes      │
│  dersom tilbudet for øvrig       │
│  inneholder tilstrekkelig        │
│  informasjon.»                   │
└──────────────────────────────────┘
```

Aktiveres med en «Sammenlign»-knapp på kryssreferanselenken, i stedet for vanlig navigering. Avsluttes med «Lukk sammenligning» som returnerer til enkeltvisning.

Begge halvpanelene er scrollbare uavhengig av hverandre. Begge viser AI-kommentarer. Juristen kan skrive en sammenligningsnotat som lagres som annotasjon på *forholdet* mellom de to sakene — ikke på den enkelte saken.

### Begrensning

Side-by-side krever mer plass. Med venstrepanelet åpent og høyrepanelet delt, blir det trangt. Anbefaling: skjul venstrepanelet automatisk når sammenligningsmodus aktiveres, med mulighet for å gjenåpne.

---

## 25. Porteføljevisning — på tvers av problemstillinger

### Behovet

Metodikken beskriver at ettersøk ofte produserer materiale for *andre* problemstillinger enn den som var utgangspunktet. Juristen jobber sjelden med bare én problemstilling — hun har en portefølje av rettslige spørsmål knyttet til samme anskaffelse eller rettsområde.

### Design

En overordnet visning som viser alle aktive problemstillinger med status:

```
Mine analyser
─────────────────────────────────────────────
§16-10 — Rådighet                    12/15 lest    3 hull    2 motstrid
§8-4 — Avvisningsplikt               4/8 lest     1 hull    0 motstrid
§7-9 — Tildelingskriterier            0/23 lest    —         —
```

Klikk åpner den aktuelle analysen. Saker som dukker opp i flere analyser markeres med en «også relevant for»-indikator.

### Krysspollinering

Når juristen leser en sak i analyse A og AI-kurateringen identifiserer at saken også er relevant for analyse B (fordi den refererer bestemmelser som er seeds i B), kan verktøyet foreslå: «Denne saken refererer §8-4 — relevant for din analyse om avvisningsplikt?»

Det knytter tilbake til metodikkens poeng: ettersøk bør gjøres med hele porteføljen i tankene.

---

## 26. Sesjonslogg — «hvor var jeg?»

### Behovet

Juristen kommer tilbake til en analyse neste dag, neste uke. Hun trenger å vite: hva har jeg gjort, hva gjenstår, hva var siste funn?

### Design

En kompakt sesjonslogg som viser handlingshistorikk:

```
Siste sesjon (i går, 14:30–16:15)
  Leste 4 saker: 2023/456, 2022/789, 2021/234, 2020/567
  Markerte 2022/789 som avgrensende
  La til seed: «binær vs. kvantitativ rådighet»
  Iterasjon 2: +1 treff
  Notat på 2023/456: «Nøkkelspørsmålet er om ESPD...»

Ulest: 2022/345 (B), 2019/890 (C), 2018/123 (A)
Neste steg (AI-forslag): «3 uleste A-saker gjenstår. 2018/123 er mest sitert.»
```

Vises som en velkomst-dialog når juristen gjenåpner en analyse, eller som en kollaperbar seksjon i venstrepanelet.

### AI-generert «neste steg»

Basert på hva juristen har gjort og hva som gjenstår, foreslår AI-en et konkret neste steg. Ikke en generisk «les videre» — et spesifikt forslag: «2018/123 er sitert av 12 saker og du har ikke lest den. Den er sannsynligvis grunnlagssaken for dette rettsområdet.» Eller: «Gap-matrisen viser 4 hull. Vurder ettersøk på §16-10 ∩ §16-3.»

---

## 27. Datakvalitetsindikatorer

### Problemet

Automatisk ekstraherte referanser har ukjent feilrate. En feilparsert paragrafhenvisning er visuelt identisk med en korrekt. Sentralitetsberegning basert på feilaktige kanter gir falske signaler.

### Løsning: synlig konfidensindikator per kant

Kanter i `kofa_law_references` bør ha en konfidensscore basert på parsing-kvalitet. En referanse som er en eksplisitt paragrafhenvisning («jf. FOA §16-10») har høy konfidens. En referanse som er parsert fra kontekstuell nevning («bestemmelsen om bruk av andre enheters kapasitet») har lavere konfidens.

Visuelt: kanter med lav konfidens kan ha en liten «?»-indikator, synlig ved hover. Juristen vet da at relasjonen er usikker og bør verifiseres.

### Konfidens på AI-kuratering

AI-kurateringens «relevance»-felt bør ha en konfidensscore. Avsnitt som er åpenbart relevante (inneholder seed-bestemmelsen eksplisitt) har høy konfidens. Avsnitt som er konseptuelt relevante (semantisk nærhet) har lavere konfidens.

Visuelt: gulmarkeringen kan ha to intensitetsnivåer — sterk gul for høy konfidens, svak gul for lavere. Juristen vet at svakt markerte avsnitt er AI-ens «best guess», ikke sikre treff.

---

## 28. Mønstergjenkjenning på tvers av saker

### Behovet

Sparringspartneren (seksjon 20) kan identifisere mønstre når juristen spør. Men noen mønstre bør identifiseres *proaktivt* — uten at juristen vet at hun skal lete etter dem.

### Konkrete mønstre systemet kan fange

**Faktumklynger:** Saker der støttende virksomhet er brukt for *bemanning* vs. *kompetanse* vs. *økonomi* kan gi ulike rettslige konklusjoner. Hvis AI-kurateringen klassifiserer faktumtypen per sak, kan systemet vise: «4 av 6 saker gjelder kompetansekvalifikasjon, 2 gjelder bemanningskrav. Utfallene er ulike — vurder om det er en substansiell forskjell.»

**Avgjørende faktorer:** Systemet kan identifisere hvilke faktumforskjeller som korrelerer med ulike utfall. «Saker der forpliktelseserklæring mangler *helt* → brudd. Saker der den er ettersendt → ikke brudd.» Mønsteret foreslås, juristen verifiserer.

**Periodisering:** Hvis praksisen endrer seg over tid (f.eks. strengere krav etter 2020), bør systemet flagge det: «Praksis før 2020 aksepterer ettersending. Praksis etter 2020 krever forpliktelseserklæring ved tilbudsfrist. Mulig praksisendring?»

### Presentasjon

Proaktive mønstre vises i chatpanelet (seksjon 20) som ubedde, kollaperbare bokser — samme mekanisme som bekreftelsesbias-motgiften. Ikke som popups, ikke som varsler — som rolige forslag i chatstrømmen.

---

## 29. Språkmønster i lesemodus

### Behovet

Når juristen leser seg gjennom 8-10 avgjørelsestekster med AI-kuratering, dukker det opp gjentakende formuleringer som ikke er eksplisitte rettssetninger, men som avslører hvordan nemnda *tenker* om et spørsmål. Formuleringer som «det avgjørende er om...», «nemnda legger vekt på...», «det er ikke tilstrekkelig at...» danner et terminologisk mønster som viser hva nemnda ser etter.

I dag fanger juristen dette bare gjennom leseerfaring — hun merker at ordene gjentar seg etter noen saker. Systemet kan gjøre det eksplisitt.

### Design

Etter at juristen har lest 3+ saker med AI-kuratering, analyserer systemet de gulmarkerte avsnittene på tvers og identifiserer gjentakende formuleringer. Ikke enkeltord — fraser og konstruksjoner.

Presentasjon som en kollaperbar seksjon i høyrepanelets lesemodus, eller som et forslag i chatpanelet:

```
Gjentakende formuleringer i markerte avsnitt (5 saker):

  «faktisk råder over»          — brukt i 4 av 5 saker
  «tilstrekkelig dokumentasjon» — brukt i 3 av 5 saker
  «konkret helhetsvurdering»   — brukt i 2 av 5 saker (kun etter 2022)
```

Hvert mønster er klikkbart — klikk viser alle forekomstene i kontekst, på tvers av saker.

### Verdien

Språkmønstrene kan brukes som nye FTS-seeds. Hvis «konkret helhetsvurdering» dukker opp i to saker juristen har lest, men hun ikke søkte på det opprinnelig, er det en kandidat for vinkelrotasjon i neste iterasjon. Systemet kan foreslå dette eksplisitt: «Begrepet 'konkret helhetsvurdering' dukker opp i 2 markerte avsnitt. Vil du legge det til som FTS-seed?»

Det kobler lesefasen tilbake til søkefasen — den hermeneutiske sirkelen systemet er designet for å støtte.

### Avgrensning

Mønstergjenkjenning (seksjon 28) handler om *substansielle* mønstre — faktumklynger, avgjørende faktorer, periodisering. Språkmønster handler om *terminologiske* mønstre — ordvalg og formuleringer. De er komplementære, ikke overlappende.

---

## 30. Direktivartikkel-overlay i grafen

### Behovet

EU-direktivet 2014/24/EU er den overordnede rettskilden som norsk anskaffelsesregulering gjennomfører. Sammenhengen mellom direktivartikler og norske bestemmelser er ikke alltid 1:1 — én direktivartikkel kan gjennomføres i flere norske paragrafer, og gjennomføringen kan være full, delvis, utvidet eller omstridt.

Denne koblingen er planlagt i datamodellen (`directive_implementation`) men er ikke representert i grafvisningen. Det betyr at juristen ikke ser den rettslige *konteksten* som norske bestemmelser opererer innenfor.

### Design

Et togglebart overlay i grafvisningen som legger direktivartikler som et ekstra lag *over* bestemmelsesnodene:

```
Uten overlay:                    Med overlay:
                                 ┌─ Art. 63 ──────────────┐
[§16-10]  [§17-1]  [§16-12]     │ [§16-10]     [§16-12]  │  [§17-1]
                                 └────────────────────────┘
```

Direktivartikler vises som halvgjennomsiktige bounding boxes rundt de norske bestemmelsene de gjennomføres i. Farge koder implementeringstype:

| Implementeringstype | Visuell stil |
|---------------------|-------------|
| Full | Dempet grå ramme — uproblematisk |
| Partial | Gul ramme — vær oppmerksom |
| Extended | Blå ramme — norsk rett går lenger enn direktivet |
| Disputed | Rød ramme — analytisk knutepunkt |

`disputed`-rammer er visuelt fremtredende fordi de markerer bestemmelser der forholdet mellom norsk og EU-rett er uavklart — det er ofte *der* de mest interessante rettslige spørsmålene ligger.

### Aktivering

Toggle-knapp i grafvisningens verktøylinje: «Direktiv» (av/på). Default av — overlayet er informasjonstett og bør bare vises når juristen aktivt ønsker EU-perspektivet.

### EU-dommenes kobling

Når overlayet er aktivt, tegnes kanter fra EU-dommer til direktivartiklene de tolker, i tillegg til de eksisterende kantene til KOFA-saker. Dette gjør det synlig at en EU-dom om art. 63 er relevant for *alle* norske bestemmelser som gjennomfører den artikkelen — ikke bare de KOFA-sakene som tilfeldigvis siterer den.

---

## 31. Siteringsretning i grafen

### Behovet

Kanter i grafen er i dag urettet — de viser at en kobling eksisterer, men ikke hvem som siterer hvem. Siteringsretning er juridisk meningsfull: at sak A siterer sak B betyr at A bruker B som autoritet. Retningen avslører autoritetsstrukturen i praksisen.

### Design

Kanter mellom KOFA-saker (`case→case`) vises med en subtil retningspil — en liten trekant ved endepunktet som peker mot den *siterte* saken. Pilen er visuelt dempet (lav opacity, liten) for å unngå visuell støy, men synlig ved hover.

```
  (2023/456) ────→ (2018/123)
  «siterer»
```

### Kombinasjon med valens

Retningspilen kombineres med valensstylingen (seksjon 9): en stiplet pil med gul farge betyr «avgrensende sitering av» — den nyere saken skiller seg fra den eldre. En kort-stiplet rød pil betyr «fraviker». Retning + valens i kombinasjon gir *mye* informasjon per kant:

- Heltrukket pil: «bekrefter/bruker som autoritet»
- Stiplet gul pil: «skiller seg fra»
- Kort-stiplet rød pil: «fraviker»

### Siteringsretningsbias — visuelt synlig

Med rettede kanter ser juristen direkte at alle piler peker *mot* eldre saker (fordi nyere siterer eldre, ikke omvendt). Det gjør biasen intuitiv uten tekstforklaring: store noder med mange innkommende piler = mye sitert = gammel. Noder uten innkommende piler = aldri sitert = ny (eller irrelevant).

### Kanter mellom ulike nodetyper

Retning er relevant for alle kanttyper:
- `case→law`: KOFA-sak refererer bestemmelse (pil mot bestemmelsen)
- `case→eu`: KOFA-sak refererer EU-dom (pil mot EU-dommen)
- `case→case`: KOFA-sak siterer annen sak (pil mot den siterte)

For `law→law` (lovstruktur) er pilen mindre meningsfull — det er et hierarki, ikke en sitering.

### Ytelseshensyn

Retningspiler på alle kanter i en graf med 200+ noder kan bli visuelt overveldende. Anbefaling: vis piler bare på kanter der juristen hovrer over en node (inn- og utgående piler for den noden), eller la det være en toggle i grafens verktøylinje: «Vis retning» (av/på). Default av for ryddig startvisning.

---

## 32. Interaksjonsdetaljer — limet mellom funksjonene

Disse er ikke funksjoner — de er det som gjør at funksjonene føles som ett sammenhengende produkt.

### Navigasjonshistorikk i høyrepanelet (lesesti)

Juristen klikker 2023/456, følger en kryssreferanse til 2022/789 §38, derfra til C-324/14. Nå vil hun tilbake. En brødsmulesti i høyrepanelets header løser dette:

```
2023/456 → 2022/789 → C-324/14
```

Hvert element er klikkbart. Det er ikke browser-navigasjon — det er en *lesesti* som viser juristens bevegelse gjennom rettskildebildet. Stien nullstilles ved klikk på en node i listen/grafen (ny inngang), men beholdes ved kryssreferansenavigering (fordypning).

### Persistent valgt node på tvers av visninger

Hvis juristen har 2022/789 valgt i listen og bytter til tidslinje, skal den saken være markert i tidslinjen. Og motsatt — valgt node i grafen beholder markering i listen. Visningsbytte skal føles som å se det samme fra en annen vinkel, ikke som å starte på nytt.

Implementering: `selectedNodeId` er global tilstand i analysens store, ikke komponentlokal tilstand. Alle visninger leser fra og skriver til samme referanse.

### Hover-forhåndsvisning i graf og tidslinje

Å måtte klikke for å se hva en node *er* bremser utforskning. En kompakt tooltip ved hover — tre linjer, ingen mer:

```
2022/789 — Forpliktelseserklæring — tidspunkt
Ikke brudd · 7 siteringer · 2022-11-22
Nyansert: ettersending aksepteres under vilkår
```

Vises etter ~300ms hover-forsinkelse. Forsvinner umiddelbart ved mouseout. Følger markøren, posisjonert over noden uten å dekke den. Ingen skygge eller tung ramme — bare tekst på en overflate med subtil kantlinje.

### Metodefase i arbeidsstripen

Arbeidsstripen øverst viser «4 av 8 lest · Iterasjon 2» — men ikke *hvilken fase* av metodikken juristen er i. Legg til en diskret faseindikator:

```
Paragraf · FOA §16-10 — Rådighet        Screening ·  4 av 8 lest · Iterasjon 2
```

Fasene: Oppsett → Primærsøk → Screening → Ettersøk → Sammenstilling. Fasen settes automatisk basert på handlinger (har juristen definert seeds? Har hun fått resultater? Har hun begynt å lese? Har hun startet en ny iterasjon?). Juristen kan overstyre.

### Tastatursnarveier

Daglig bruk belønnes med hastighet. Ingen synlig UI for snarveier — bare en `?`-tast som viser en overleggsliste.

| Snarvei | Handling |
|---------|---------|
| `↓` / `↑` | Neste / forrige sak i listen |
| `M` | Marker valgt sak som lest |
| `R` | Åpne lesemodus i høyrepanelet |
| `Esc` | Tilbake til oversikt / lukk panel |
| `S` | Fokus på søkefeltet |
| `1-4` | Bytt visning (Liste/Graf/Tidslinje/Rettssetninger) |
| `?` | Vis snarveiliste |

### Subtil tilbakemelding ved handlinger

Når juristen markerer en sak som lest, legger til en seed, bekrefter et AI-forslag — en kort, dempet toast nederst i midtpanelet som forsvinner etter 2 sekunder:

```
✓ Markert som lest · 5 av 8
```

Ikke en notifikasjon med ikon og lukkeknapp — bare en tekstlinje som bekrefter at handlingen skjedde og gir kontekst (fremdrift). Styling: mørk bakgrunn (#1A1814), lys tekst (#FAF9F6), avrundede hjørner, sentrert, ingen skygge.

### Lastetilstand for AI-kuratering

AI-kuratering tar noen sekunder. Høyrepanelet bør vise avgjørelsesteksten *umiddelbart* — den er i databasen og kan leveres uten ventetid. AI-kurateringen *legges på* når den er klar:

1. Juristen klikker på en sak → høyrepanelet viser header, metadata, avgjørelsestekst (ren, uten markeringer)
2. En dempet pulserende gullbrun venstrekant ved siden av teksten indikerer at kuratering genereres
3. Etter 1-3 sekunder fader markeringene inn — gulbakgrunn på relevante avsnitt, AI-kommentarer mellom avsnitt
4. Teksten hopper ikke — markeringene legges på uten reflow

Juristen trenger aldri å vente for å begynne å lese. AI-kurateringen er en *berikelse* som ankommer, ikke en *forutsetning* som blokkerer.

### Drag-to-select i grafen

Juristen bør kunne dra en rektangulær markering i grafvisningen for å velge flere noder samtidig. Valgte noder kan deretter opereres på som gruppe: «marker alle som lest», «vis bare disse i listen», «bruk som seeds i neste iterasjon». Implementeres med et standard lasso/rektangel-verktøy.

### Søk innenfor visningen

`Cmd+F` / `Ctrl+F` bør trigge et internt søkefelt — ikke browserens søk — som filtrerer den aktive visningen:
- I listen: filtrerer saker etter saksnummer, undertittel eller rettssetning
- I lesemodus: highlighter forekomster i avgjørelsesteksten
- I registeret: filtrerer rettssetninger etter innhold

Søkefeltet vises som en kompakt stripe øverst i midtpanelet, under verktøylinjen. Lukkes med `Esc`.

### Tomme tilstander

Hva ser juristen *før* hun har gjort noe? Tomme tilstander er kritiske for førstegangsbruk:

- **Listen uten resultater:** «Definer problemstilling og seeds i venstrepanelet for å starte søket.» Peker mot neste handling.
- **Registeret uten rettssetninger:** «Rettssetninger dukker opp her etter hvert som du leser og AI identifiserer rettslige utsagn.» Forklarer hva det vil bli.
- **Tidslinjen med bare seeds:** Viser seed-bestemmelsene som vertikale markører på tidslinjen, uten noder. Juristen ser at *noe* vil fylle denne visualiseringen.
- **Grafen med bare seeds:** Viser seed-nodene med aggregatbadges («? saker» i stiplet ramme) som indikerer at data vil komme.

Ingen tom tilstand bør vise en generisk «Ingenting her»-melding. Alle tomme tilstander peker mot neste handling eller forklarer hva som vil fylle visningen.

---

## 33. Implementeringsprioritet

Ikke alt kan bygges samtidig. Prioritering basert på to akser: verdi for juristen og implementeringskompleksitet.

### Fase 1 — MVP

Tre-panel-layout med listevisning som default. Grafvisning med hierarkisk layout. A/B/C-kategorisering med signalprikker. Reguleringsversjon-filter. Gap-matrise. Lesestatus og notater med persistering. Avgrensning som innholdstag (manuell). Kantvalens (UI klart, data ukjent inntil NLP er implementert). Siteringsretning i grafen (rettede piler ved hover). Persistent valgt node på tvers av visninger. Tomme tilstander. Subtil tilbakemelding (toasts). `traverse_legal_graph` som backend (seksjon 35) med materialisert `centrality_score` og `authority_weight` (seksjon 34).

### Fase 2 — AI-integrasjon

Lag 1-verktøy (vektor-seed, bestemmelsesforslag, vinkelrotasjon). AI-kuratert lesemodus i høyrepanelet. Kryssreferanselenker mellom saker. Automatisk avgrensningsforslag. Sparringspartner (chatpanel). Språkmønster-identifisering (som feed tilbake til søkefasen). Navigasjonshistorikk (lesesti) i høyrepanelet. Lastetilstand for AI-kuratering (progressiv berikelse). Hover-forhåndsvisninger.

### Fase 3 — Analytiske utvidelser

Rettssetningsregisteret. Tidslinjevisning. Eksport som arbeidsnotat. Sammenligningsmodus. Sesjonslogg med AI-foreslått neste steg. Direktivartikkel-overlay i grafen. Tastatursnarveier. Søk innenfor visning. Metodefase i arbeidsstripen.

### Fase 4 — Portefølje og avansert

Porteføljevisning. Krysspollinering mellom analyser. Mønstergjenkjenning. Datakvalitetsindikatorer. Bekreftelsesbias-motgift (periodiske ubedde utfordringer). Drag-to-select i grafen.

### Begrunnelse for rekkefølgen

Fase 1 gir et brukbart verktøy uten AI — det er en bedre Lovdata for rettskildeanalyse. Persistent valgt node, tomme tilstander og toasts er i fase 1 fordi de er grunnleggende UX som ikke kan mangle fra dag 1. Fase 2 gjør det transformativt — AI-kurateringen er det som skiller verktøyet fra alt annet. Lesestien og lastetilstanden er i fase 2 fordi de bare er relevante når AI-kuratering og kryssreferanser eksisterer. Fase 3 er det som gjør det til et *arbeidsverktøy* i stedet for et analyseverktøy — eksporten er kritisk for adopsjon. Tastatursnarveier, søk og metodefase hører her fordi de belønner daglig bruk, ikke førstegangsbruk. Fase 4 er for jurister som bruker verktøyet daglig og har flere pågående analyser.

---

## 34. Implementasjonsmønstre fra codegrasp

Codegrasp er et Rust-basert MCP-verktøy som indekserer kodebaser i en avhengighetsgraf (SQLite). Systemet er strukturelt analogt med rettskildegrafen, og flere av dets implementasjonsmønstre er direkte overførbare.

### Confidence som førsteklasses egenskap på alle kanter

I codegrasp har alle kanter en `confidence`-verdi (0.5–1.0). En eksplisitt import får 1.0, en inferert relasjon får 0.5. Prinsippet er: *bedre ufullstendig graf med riktige kanter enn komplett graf med feil kanter.*

**Direkte anvendbart.** `kofa_law_references` har 25.948 kanter, alle med `context`-felt. En eksplisitt paragrafhenvisning («jf. anskaffelsesforskriften § 16-10 (2)») bør ha konfidens ~1.0. En kontekstuelt inferert referanse («bestemmelsen om bruk av andre enheters kapasitet») bør ha konfidens ~0.6-0.7.

Implementering: legg til `confidence REAL DEFAULT 1.0` på `kofa_law_references`, `kofa_case_references`, `kofa_eu_references` og `kofa_court_references`. Initialverdier kan settes basert på parsing-kvalitetsmetrikker fra den opprinnelige ekstraheringen — eller retroaktivt via en klassifiserer som scorer `context`-feltene.

UI-konsekvens: kanter med konfidens under en terskel (f.eks. 0.7) vises med en «?»-indikator synlig ved hover, som beskrevet i seksjon 27.

### Observation staleness via content_hash

I codegrasp kobles brukernotater til en hash av innholdet de kommenterer. Når innholdet endres, markeres notatet som «stale» eller «orphaned».

**Allerede forberedt i databasen.** `kofa_decision_text` har `content_hash` på 139.428 av 139.750 segmenter (99,8% dekning). `lovdata_sections` har `content_hash` på 92.164 av 92.253 (99,9% dekning). `kofa_forarbeider_sections` har 0 content_hashes — et hull som bør lukkes.

Implementering for juristens notater: når juristen skriver et notat på en node, lagres `content_hash` for den noden på notattidspunktet. Ved gjenåpning sammenlignes lagret hash med nåværende hash. Forskjellig hash → notat markeres med en «Innholdet har endret seg siden du skrev dette notatet»-indikator.

Implementering for AI-kuratering: AI-kurateringens `highlights` refererer spesifikke avsnitt via `paragraph_number`. Kurateringscachen lagres med `content_hash` for hvert kuratert avsnitt. Ved ny visning sjekkes hashene — endret innhold invaliderer den spesifikke kurateringen, ikke hele cachen.

### Capsule-mønsteret (pivots + supports)

I codegrasp returneres kontekst i to lag: «pivots» (full kildekode, høy relevans) og «supports» (skeletonisert, lavere relevans), innenfor et token-budsjett. Systemet fyller pivots først, deretter supports til budsjettet er brukt.

**Relevant for sparringspartnerens kontekststyring (seksjon 20).** Det faste kontekstlaget (~2000 tokens) tilsvarer «supports» — problemstilling, seeds, leste saker, notater. Det dynamiske MCP-laget tilsvarer «pivots» — fulltekst-avgjørelser hentet per spørsmål.

Forbedring: i stedet for en hard 2000-token-grense, bruk et token-budsjett med prioritert fylling. En lang avgjørelsestekst bruker mer kontekst enn en kort. Budsjettet bør ta hensyn til spørsmålets kompleksitet — et spørsmål om motstrid mellom to saker trenger begge fulltekstene som pivots, mens et spørsmål om definisjon av et begrep trenger kanskje bare en lovparagraf.

### Auto-intent og presets

I codegrasp (planlagt fase 4) analyserer et `run_pipeline`-verktøy oppgavebeskrivelsen og bestemmer selv hvilke underverktøy som trengs. Kombinert med et `preset`-mønster som forhåndsdefinerer profiler for vanlige bruksmønstre.

**Relevant for `traverse_legal_graph`.** I stedet for at juristen manuelt setter edges, depth, rank_by og filter, kan systemet utlede søkekonfigurasjon fra problemstillingen:

- «Forpliktelseserklæring ved tilbudsfrist» → auto-seed `anskaffelsesforskriften:16-10`, auto-edges `case→law + case→case + case→eu`, rank_by `centrality`, depth 2
- «Prosessuell avvisning av klage» → auto-seed `klagenemndsforskriften:6`, auto-edges `case→law + case→case`, rank_by `recency`, depth 1

Presets for vanlige bruksmønstre:

| Preset | Edges | Depth | Rank | Typisk bruk |
|--------|-------|-------|------|-------------|
| Materiell | case→law, case→case, case→eu | 2 | centrality | Standard rettskildeanalyse |
| Prosessuell | case→law, case→case | 1 | recency | Prosessuelle spørsmål (klagenemnd) |
| EU-forankring | case→eu, eu→case, case→law | 2 | centrality | EU-rettslig problemstilling |
| Avgrensning | case→law, case→case | 2 | fts_score | Finne grensedragninger |

Designdokumentet beskriver dette delvis som Lag 1-verktøy (seksjon 19). Auto-intent generaliserer det til hele søkekonfigurasjonen — juristen skriver problemstillingen, systemet foreslår en komplett søkeprofil som hun kan akseptere eller justere.

### FQN-konvensjon (Fully Qualified Names)

I codegrasp identifiseres alle noder med `fil::symbol` som globalt unik nøkkel.

**Nødvendig for konsistent referansehåndtering.** Rettskildegrafen trenger en FQN-konvensjon som fungerer på tvers av nodetyper, i chatpanelet, i kryssreferanselenker, og i graf-traversal:

| Nodetype | FQN-format | Eksempel |
|----------|-----------|---------|
| KOFA-sak | `kofa:{sak_nr}` | `kofa:2021/1102` |
| Lovparagraf | `{law_name}:{section_id}` | `anskaffelsesforskriften:16-10` |
| EU-dom | `eu:{eu_case_id}` | `eu:C-324/14` |
| Norsk rettsavgjørelse | `court:{court_case_id}` | `court:HR-2019-1801-A` |
| Forarbeid-seksjon | `forarbeid:{doc_id}:{section_number}` | `forarbeid:prop51L:8.3` |

**Viktig:** `law_name` i databasen bruker fulle norske navn (`anskaffelsesforskriften`, `anskaffelsesloven`, `klagenemndsforskriften`), ikke forkortelser (`FOA`, `LOA`). FQN-konvensjonen bør følge databasens navngivning, med aliaser for vanlige forkortelser i UI-et.

### Inkrementell invalidering via content hashing

I codegrasp re-indekseres bare endrede filer basert på innholdshash.

**Direkte anvendbart for kurateringscache.** Cache-nøkkel: `hash(problemstilling + seeds + leste_saker_set)`. Ved endring i inputs:

- Problemstilling endres → invalider all kuratering
- Ny seed legges til → invalider kuratering for saker som kobler til den nye seeden
- Sak markert som lest → invalider ikke kuratering (lesestatus påvirker ikke hva som er relevant), men oppdater kryssreferanser i eksisterende kuratering (fordi kryssreferanser bare bør peke til saker juristen ikke har lest enda)

Differensiert invalidering:
- A-saker: eager re-kuratering (juristen vil sannsynligvis lese dem igjen)
- B-saker: lazy re-kuratering (invalideres, regenereres ved neste klikk)
- C-saker: lazy (som B)

### Autoritetsrangering (authority_weight)

Grafen har ingen representasjon av rettskildelæren. En mye-sitert KOFA-avgjørelse fremstår som mer sentral enn en Høyesterettsdom som overprøver den — fordi sentralitet måler sitatfrekvens, ikke rettslig vekt. Uten korreksjon forvrenger dette rangeringen systematisk.

**Løsning:** En eksplisitt `authority_weight`-egenskap per nodetype, basert på Eckhoffs kilderangering:

| Nodetype | authority_weight | Begrunnelse |
|----------|-----------------|-------------|
| Høyesterettsdom | 1.0 | Bindende prejudikat |
| Lagmannsrettsdom | 0.7 | Rettspraksis, høyere enn forvaltningspraksis |
| EU-dom (CJEU) | 0.9 | Direktivtolkning, forrang ved motstrid |
| KOFA-avgjørelse | 0.4 | Forvaltningspraksis, ikke bindende |
| Lovparagraf | 1.0 | Formell lov |
| Forarbeid | 0.6 | Vekten avhenger av alder og klarhet |

Implementering:

```sql
ALTER TABLE kofa_cases ADD COLUMN authority_weight float DEFAULT 0.4;

-- Norske rettsavgjørelser med differensiert vekt
-- (krever parsing av court_case_id-format: HR- = 1.0, LA-/LB- = 0.7)
```

`authority_weight` inngår i `final_score`-beregningen i `traverse_legal_graph` (seksjon 35) som én av tre faktorer: `signal_score * 0.4 + centrality_score * 0.3 + authority_weight * 0.3`. Dette demper siteringsretningsbiasen — en ny Høyesterettsdom med få siteringer kan rangeres høyere enn en gammel KOFA-sak med mange siteringer.

**UI-konsekvens:** Autoritetstypen er allerede visuelt kodet gjennom nodeform (seksjon 8b). `authority_weight` påvirker rangeringen *bak* UI-et, ikke presentasjonen. Juristen ser effekten som endret rekkefølge i listen — rettsavgjørelser og EU-dommer løftes opp, KOFA-saker med ren sitatmasse senkes ned.

**Begrensning:** Vektene er statiske per nodetype, ikke per sak. En KOFA-sak som er spesielt prinsipiell (f.eks. storkammersak) får samme vekt som en rutinesak. Mer granulær vekting krever manuell annotasjon eller AI-klassifisering — vurderes som del av annoteringssystemet (se Sonnet-samtalen om Bayesiansk annotasjon).

---

### Databasefunn som påvirker design

Undersøkelse av de faktiske tabellene i Supabase avdekket følgende:

1. **`section`-feltet i `kofa_decision_text`** skiller mellom «bakgrunn» og «vurdering». AI-kurateringen bør prioritere «vurdering»-seksjoner der rettssetninger nesten alltid ligger. «Bakgrunn»-seksjoner er kontekst, ikke rettsanvendelse.

2. **`law_section` har variert format:** «16-10 (2)», «16-10 tredje ledd», «16-10 femte ledd», «16-10». Parsing og normalisering til en konsistent FQN krever en mapping-funksjon.

3. **Alle 25.948 lovhenvisninger har 100% dekning av `context` og `regulation_version`.** Valensparsing og confidence-scoring på `context`-feltet er gjennomførbart uten databaseendringer.

4. **Forarbeider mangler embeddings og content_hash.** 1.186 seksjoner uten embeddings betyr at semantisk søk ikke dekker forarbeider. Dette er et hull i vektorsøk-signalet.

5. **`kofa_case_references` mangler `to_sak_nr` foreign key.** `from_sak_nr` har FK til `kofa_cases`, men `to_sak_nr` har det ikke (kan referere saker som ikke er i databasen ennå). Grafen må håndtere «broken edges» — kanter til noder som ikke eksisterer.

---

## 35. Backend-arkitektur — parameterisert graf-traversal

### Kjerneprinsipp

Venstepanelets fire seed-typer (bestemmelser, FTS, vektor, saker) og grafvisningens kantyper kompileres til **én parameterisert SQL-query** i backend. LLM-en (for sparringspartneren) og UI-et (for juristens søk) bruker samme grensesnitt. Grafen som allerede finnes i databasen — 4.663 KOFA-saker, 92.000+ lovparagrafer, 25.948 lovhenvisninger, 6.616 sakssiteringer, 1.875 EU-referanser — eksponeres som en traverserbar struktur, ikke som separate SQL-spørringer.

### Verktøysignatur

```typescript
traverse_legal_graph({
  seed: {
    paragraphs?: string[]        // ["16-10", "17-1"] → kofa_law_references
    cases?: string[]             // ["2019/123"] → kofa_case_references
    eu_cases?: string[]          // ["C-601/13"] → kofa_eu_references
    fts?: string                 // "forpliktelseserklæring" → search_vector @@ tsquery
    vector?: string              // naturlig språk → embedding ANN
  },
  edges: Array<
    "case→law" | "law→case" |
    "case→case" |
    "case→eu" | "eu→case" |
    "case→court" |
    "law→law"
  >,
  depth?: number,                // default 1, max 3
  rank_by?: "centrality" | "citation_count" | "fts_score" | "vector_score" | "recency",
  limit?: number,
  filter?: {
    year_from?: number
    regulation_version?: "old" | "new"
    sakstype?: string
  }
})
```

### SQL-arkitektur: recursive CTE med blandede seeds

Traversalen kompileres til en recursive CTE der lag 0 er seed-resultatet og hvert påfølgende lag følger de valgte kanttypene:

```sql
WITH RECURSIVE traversal AS (
  -- Lag 0: seed fra paragraf + FTS + vektor (union av alle seed-typer)
  SELECT sak_nr, 0 AS depth, signal_score AS path_score, signal_type
  FROM (
    -- Paragraf-seed
    SELECT DISTINCT sak_nr, 1.0 AS signal_score, 'R' AS signal_type
    FROM kofa_law_references WHERE law_section = ANY(:paragraphs)
    UNION ALL
    -- FTS-seed
    SELECT sak_nr, ts_rank(search_vector, q) AS signal_score, 'F' AS signal_type
    FROM kofa_decision_text, to_tsquery(:fts_query) q
    WHERE search_vector @@ q AND section = 'vurdering'
    UNION ALL
    -- Vektor-seed
    SELECT sak_nr, 1 - (embedding <=> :query_embedding) AS signal_score, 'V' AS signal_type
    FROM kofa_decision_text
    ORDER BY embedding <=> :query_embedding LIMIT 50
  ) seeds

  UNION ALL

  -- Lag 1+: følg valgte kantyper
  SELECT r.to_sak_nr, t.depth + 1, t.path_score * 0.8, t.signal_type
  FROM kofa_case_references r
  JOIN traversal t ON r.from_sak_nr = t.sak_nr
  WHERE t.depth < :max_depth
),
-- Konsolider: én rad per sak med alle signaler
consolidated AS (
  SELECT sak_nr,
         MIN(depth) AS depth,
         MAX(path_score) AS best_score,
         array_agg(DISTINCT signal_type) AS signals,
         COUNT(DISTINCT signal_type) AS signal_count  -- A=3, B=2, C=1
  FROM traversal GROUP BY sak_nr
)
SELECT c.*, k.centrality_score,
       (c.best_score * 0.4 + k.centrality_score * 0.3 + k.authority_weight * 0.3) AS final_score
FROM consolidated c
JOIN kofa_cases k USING (sak_nr)
ORDER BY c.signal_count DESC, final_score DESC
LIMIT :limit;
```

Seed-unionen er nøkkelen: alle fire seed-typer produserer `(sak_nr, signal_score, signal_type)`-tupler som mates inn i samme traversal. `signal_type` (R/F/V) bevares gjennom hele traversalen og aggregeres til A/B/C-kategorisering i `consolidated`-steget — dette er det som driver R/F/V-prikkene i UI-et (seksjon 11).

### Materialisert sentralitetsscore

Sentralitet kan ikke beregnes per spørring. Løsningen er en materialisert kolonne som oppdateres periodisk:

```sql
ALTER TABLE kofa_cases ADD COLUMN centrality_score float DEFAULT 0;

UPDATE kofa_cases c SET centrality_score = sub.score
FROM (
  SELECT to_sak_nr, COUNT(*) AS score
  FROM kofa_case_references GROUP BY to_sak_nr
) sub WHERE c.sak_nr = sub.to_sak_nr;

CREATE INDEX ON kofa_cases(centrality_score DESC);
```

Citation count som proxy for betweenness er godt nok for rangeringen og O(1) å lese. For mer sofistikert sentralitet (PageRank) kan `pgrouting`-extensionen vurderes, men citation count dekker >90% av behovet.

### Indeksstrategi

Alt som trengs er allerede indekserbart i Postgres:

| Kantype | Backing-tabell | Indeks |
|---|---|---|
| `law→case` | `kofa_law_references` | `(law_section, sak_nr)` btree |
| `case→case` | `kofa_case_references` | `(from_sak_nr)` + `(to_sak_nr)` btree |
| `case→eu` | `kofa_eu_references` | `(eu_case_id, sak_nr)` btree |
| `case→court` | `kofa_court_references` | `(court_case_id)` btree |
| `law→law` | `lovdata_structure` | `(parent_id)` — allerede FK-indeksert |
| FTS-seed | `kofa_decision_text.search_vector` | GIN — allerede eksisterende |
| Vektor-seed | `kofa_decision_text.embedding` | HNSW — allerede eksisterende |

Hvert hopp i traversalen er O(log n). Recursive CTE med depth ≤ 3 holder seg innenfor ~100ms mot 4.663 saker og 25.000+ kanter.

### Forholdet til Steg 2 i metodikken

`traverse_legal_graph` erstatter ikke Steg 2 — den *implementerer* det. De fire seed-typene i UI-et (seksjon 4) korresponderer direkte til Steg 2s fire søkefaser:

| Steg 2 | Seed-type | Signal |
|---|---|---|
| Referansetabell (paragraf-interseksjon) | `paragraphs` | R |
| FTS-supplement | `fts` | F |
| Vektorsøk | `vector` | V |
| Kjente saker | `cases` | R |

Kryssvalideringen som Steg 2 gjør manuelt (A = alle tre signaler, B = to, C = ett) skjer automatisk i `consolidated`-steget. Transparensen bevares: R/F/V-prikkene viser juristen nøyaktig hvilke signaler som fant hver node.

### Kjente begrensninger

Begrensningene fra Steg 2-analysen (Sonnet-samtalen) gjelder uendret:

- **Implisitte referanser:** Saker som anvender §16-10 uten å sitere den er usynlige for graf-traversal. FTS- og vektor-seeds kompenserer, men bare på lag 0 — dypere lag følger kun eksplisitte kanter.
- **Siteringsretningsbias:** Eldre saker akkumulerer siteringer. `centrality_score` favoriserer systematisk gammel praksis. Dempes ved å inkludere `recency` som rangeringsfaktor og ved reguleringsversjon-filteret (seksjon 7).
- **Kantkvalitet:** Feilparsede paragrafhenvisninger gir feil traversal. Dempes ved `confidence`-scoring (seksjon 34) og ved at tre uavhengige seed-signaler kryssvaliderer.
- **Seed-forutsetning:** Feil seeds gir systematisk avgrenset resultatsett. Dempes ved AI Lag 1-verktøy som foreslår bestemmelser (seksjon 19) og ved den hermeneutiske sirkelen (seksjon 35b).

---

## 35b. Den hermeneutiske sirkelen — iterasjoner som kjernearbeidsflyt

### Prinsipp

Med `traverse_legal_graph` koster hver ny kartleggingsrunde millisekunder. Det endrer balansen: iterasjon er ikke en sekundær operasjon som gjøres én gang (Steg 2: primærsøk → ettersøk), men **kjernearbeidsflyten**.

```
Forforståelse (paragraf, begrep)
        ↓
[Traversal] → kandidatliste
        ↓
[Lesing/tolkning] → ny forforståelse
        ↓
        ├── Strukturell: nye paragrafer, saker → ny paragraf/saks-seed
        └── Semantisk: nye begreper, formuleringer → ny FTS/vektor-seed
        ↓
[Traversal med utvidede seeds] → utvidet kandidatliste
        ↓
[Lesing] → ...
```

Tolkningsfasen avdekker to typer ny forforståelse: *strukturell* (nye paragrafer og saker som bør inkluderes) og *semantisk* (nye begreper som «binær vs. kvantitativ rådighet» som ikke har en direkte representasjon i grafen). `traverse_legal_graph` støtter begge gjennom blandede seed-typer.

### UI-konsekvens for venstrepanelet (jf. seksjon 4)

Iterasjon bør være lett og naturlig, ikke en formell operasjon:

- **Seed-akkumulering:** Nye seeds legges til eksisterende seeds, ikke erstatter dem. Juristen ser hele sin søkehistorikk som en voksende liste av chips. Fjern en seed med ×, legg til med enter.
- **Språkmønster som seed-forslag:** Når språkmønster-identifiseringen (seksjon 29) finner gjentakende formuleringer i markerte avsnitt, foreslås de som nye FTS-seeds direkte i seed-feltet — den hermeneutiske tilbakekoblingen fra lesing til søk.
- **AI-genererte seed-forslag etter lesing:** Etter at juristen har markert 3+ saker som lest, kan sparringspartneren (eller Lag 1-verktøy) foreslå nye seeds basert på mønstrene i det som er lest. Forslaget vises som dempede chips med stiplet ramme, som for bestemmelsesforslag (seksjon 19).
- **Iterasjonsbadges bevares** (seksjon 14): noder fra iterasjon 2+ vises med grønn «iter. N»-pill, slik at juristen ser hvilke noder som ble oppdaget i hvilken runde.

### Iterasjonslogg i venstrepanelet

Kartlegging-seksjonen (seksjon 4) bør vise en kompakt iterasjonslogg:

```
Iterasjon 1:  §16-10, §17-1, «forpliktelseserklæring»    → 27 treff (4A, 8B, 15C)
Iterasjon 2:  + «binær vs. kvantitativ rådighet»          → +3 treff (0A, 1B, 2C)
Iterasjon 3:  + §16-3, «konkret helhetsvurdering»         → +1 treff (0A, 1B, 0C)
```

Hver rad er klikkbar — klikk filtrerer listen/grafen til noder fra den iterasjonen. Loggen gjør den hermeneutiske sirkelen *observerbar*: juristen ser hvordan søkerommet ekspanderte og hva som utløste hver utvidelse.

---

## 36. Åpne spørsmål for implementering

1. **Persistent lagring av lesestatus og notater:** Lagres per bruker per problemstilling. Krever brukerautentisering og en `user_annotations`-tabell. Notater bør synkroniseres — juristen forventer at notater hun skrev i forrige sesjon er der når hun kommer tilbake.

2. **Eksportformat og malkontroll:** Skal juristen kunne velge hvilke seksjoner som inkluderes i eksporten? Bør det finnes maler per dokumenttype (problemdrevet notat, lovkommentar, klientnotat)? Minst mulig konfigurasjon er bedre — én god default slår ti valgmuligheter.

3. **Flerbruker og deling:** Vil flere jurister jobbe med samme problemstilling? I så fall trenger notater og lesestatus et delingsmønster. Ikke i scope for MVP, men datamodellen bør ikke utelukke det.

4. **Sanntidssøk vs. forhåndslastet graf:** Bør grafen bygges on-demand (brukeren trykker «Søk» og venter) eller inkrementelt (resultater strømmer inn)? On-demand er enklere. Inkrementelt gir bedre brukeropplevelse for dype traversaler som tar tid.

5. **EU-dom-traversal som standard:** I metodikken er screening av EU-dommer obligatorisk ved ikke-prosessuelle problemstillinger. Bør EU-dom-kanter inkluderes automatisk, eller bør brukeren velge å inkludere dem? Anbefaling: automatisk, med mulighet for å filtrere dem ut.

6. **Sparringspartnerens LLM-valg:** Chatpanelet krever en modell som kan bruke MCP-verktøy (tool use), lese lange avgjørelsestekster, og resonnere juridisk uten å hallusinere. Modellegenskaper som er kritiske: tool use-støtte, lang kontekstvindu, presisjon i referanser. Modellvalg bør vurderes separat fra resten av arkitekturen.

7. **Terskel for ubedde utfordringer:** Etter hvor mange leste saker bør den periodiske «har du vurdert dette?»-meldingen utløses? For tidlig er irriterende, for sent er meningsløst. Bør terskelen være konfigurerbar, eller bør den baseres på et signal (f.eks. når juristen har tagget 3+ saker med samme mønster)?

8. **Kostnadskontroll for AI-kall:** Lag 1-verktøy (vektor-seed, bestemmelsesforslag) er billige enkelt-kall. Lag 2-sparringspartneren kan utløse mange MCP-kall per spørsmål (les sak, les lov, søk semantisk). Bør det være en synlig indikator for brukeren om at AI-kall pågår, og eventuelt en grense per sesjon?

9. **Kurateringscache og invalidering:** AI-kurateringen av avgjørelsestekst caches per node per problemstilling. Når invalideres cachen? Åpenbart: når problemstillingen endres eller nye seeds legges til. Mindre åpenbart: bør kurateringen oppdateres etter at juristen har lest og tagget andre saker, fordi kryssreferansene kan bli rikere? Eager vs. lazy invalidering har ulike kostnadsprofiler.

10. **Kurateringskvalitet og feedback:** Juristen bør kunne gi feedback på AI-kurateringen — «denne markeringen er ikke relevant» eller «du burde ha markert avsnitt 35 også». Denne feedbacken kan brukes til å forbedre kurateringen over tid. Men det introduserer en ny interaksjonsflate i et allerede tett panel. Vurder om feedback skal være eksplisitt (knapper) eller implisitt (juristen endrer markeringene).

11. **Forhåndskuratering vs. on-demand:** Skal AI-kurateringen genereres når juristen klikker på noden (on-demand, merkbar ventetid), eller forhåndsgenereres for alle A- og B-saker i bakgrunnen etter primærsøket (proaktivt, ingen ventetid men høyere kost)? For A-saker (trippel treff) er forhåndsgenerering sannsynligvis riktig — juristen *vil* lese dem. For C-saker er on-demand tilstrekkelig.

12. **Rettssetningsregisteret — automatisk vs. manuell ekstraksjon:** Skal rettssetninger ekstraheres automatisk av AI (risiko for feil klassifisering) eller identifiseres av juristen under lesing (høyere kvalitet, mer arbeid)? Anbefalt hybridmodell: AI foreslår rettssetninger med «Bekreft/Rediger/Avvis»-interaksjon, som for avgrensningsforslag.

13. **Sammenligningsmodus — hvor mange saker?** Side-by-side fungerer for to saker. Tre saker er mulig men trangt. Bør det støttes, eller bør sammenligning av >2 saker håndteres via rettssetningsregisteret i stedet?

14. **Porteføljevisning — deling av saker mellom analyser:** Når en sak er relevant for to analyser, bør notater deles eller være separate? Juristen kan ha ulike perspektiver på samme sak avhengig av problemstillingen. Anbefaling: notater er per analyse, men en «se notater fra andre analyser»-funksjon er tilgjengelig.

15. **Språkmønster — terskel for gjentakelse:** Hvor mange ganger må en formulering opptre på tvers av saker for å flagges som mønster? To ganger kan være tilfeldig, tre ganger er mer meningsfullt. Bør terskelen avhenge av totalt antall leste saker?

16. **Direktivartikkel-overlay — datakvalitet:** `directive_implementation`-tabellen krever juridisk skjønn for klassifisering av implementeringstype. Hvem fyller den ut — en jurist manuelt, AI med bekreftelse, eller en kombinasjon? `disputed`-koblinger er analytisk viktigst og vanskeligst å klassifisere automatisk.

17. **Siteringsretning — piler vs. hover:** Permanente piler på alle kanter er visuelt overveldende. Piler bare ved hover er informasjonstapende. En mellomløsning kan være permanente piler på kanter med kjent valens (avgrensende/fravikende), hover-piler på resten. Bør det testes med brukere?

18. **Confidence-scoring — retroaktiv vs. løpende:** Skal confidence-scores beregnes retroaktivt for alle 25.948 lovhenvisninger (batch-jobb), eller bare for nye referanser fremover? Retroaktiv scoring gir fullstendig dekning men krever en engangs-klassifiseringsjobb. Anbefaling: retroaktiv, fordi confidence påvirker hele grafens informasjonsverdi.

19. **FQN-normalisering for `law_section`:** Databasen inneholder «16-10 (2)», «16-10 tredje ledd», «16-10 femte ledd» og «16-10» for samme bestemmelse. Bør FQN normaliseres til én form (f.eks. `anskaffelsesforskriften:16-10(2)`), eller bør alle varianter koeksistere med en mapping? Normalisering er renere men krever parsing av alle 25.948 referanser.

20. **Broken edges i sitatnettverket:** `kofa_case_references.to_sak_nr` mangler FK-constraint — kanter kan peke til saker som ikke er i databasen. Bør UI-et vise broken edges (som «ukjent sak»-noder), skjule dem, eller bruke dem som signal om at datasettets dekning er ufullstendig?

21. **Forarbeider-embeddings:** 1.186 forarbeiderseksjoner mangler embeddings og content_hash. Uten embeddings dekker ikke vektorsøk forarbeider — et hull i søkedekningen. Bør embeddings genereres som del av MVP (fase 1), eller kan det vente til fase 3?

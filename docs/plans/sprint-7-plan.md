# Sprint 7 — Visuell integritet (Fase 1-hull)

**Mål:** Verktøyet oppfører seg visuelt som spesifisert — dimming i stedet for fjerning, lesesti, grafnode-detaljer.

**Kvalitetsprosess per oppgave:**
1. Implementer mot designspesifikasjon (seksjonsnummer angitt per oppgave)
2. Kjør `interface-design:critique` etter visuell endring
3. Kjør `simplify` etter hver oppgave
4. Verifiser i nettleser med reelle data

**Forutsetter:** Sprint 6 ferdig (iterasjons-workflow, advarsler)

---

## Oppgave 1: Dimming i stedet for fjerning

**Spec:** §15 (Filtrering — dimming, ikke fjerning)

**Nåværende oppførsel:**
- `NodeList.svelte` linje 12-16: `.filter()` **fjerner** noder som ikke matcher filter
- `GraphView.svelte` linje 30-34: Dimmer noder til 20% opacity (korrekt for graf)

**Problemet:** Listen fjerner noder helt — juristen mister oversikt over hva som er filtrert bort. Spec sier dimme til 15-25% opacity, ikke fjerne.

**Endringer:**

### 1a. `NodeList.svelte`
- Erstatt `.filter()` med dimming-logikk: alle noder rendres alltid
- Legg til `isDimmed(node)` funksjon som sjekker mot aktivt filter
- Dimmede noder: `opacity: 0.2`, men forblir i listen og er klikkbare
- Sortering: dimmede noder sorteres *etter* synlige noder (ikke blandet inn)
- Ved klikk på dimmet node: åpner høyrepanel normalt, med visuell indikator

### 1b. `NodeRow.svelte`
- Legg til `dimmed` prop
- Styling: `opacity: 0.2` på hele raden, `pointer-events: auto` (fortsatt klikkbar)
- Hover på dimmet rad: vis tooltip "Utenfor aktivt filter"

### 1c. Verifiser grafoppførsel
- `GraphNode.svelte` linje 71: `opacity={dimmed ? 0.2 : 1}` — allerede korrekt
- Verifiser at dimmede grafnoder også er klikkbare

**Verifisering:**
- Velg "Ulest"-filter → leste noder dimmes til 20% men forblir synlige i listen
- Velg "Avgrensning"-filter → ikke-avgrensningsnoder dimmes
- Klikk på dimmet node → høyrepanel åpner normalt
- Sammenlign oppførsel i liste og graf — begge dimmer, ingen fjerner

---

## Oppgave 2: Lesesti / brødsmulesti i høyrepanel

**Spec:** §32 (Navigasjonshistorikk i høyrepanelet)

**Nåværende oppførsel:**
- `ui.svelte.ts`: Bare `selectedNodeId` (ingen historikk)
- `NodeDetail.svelte`: Relasjoner er klikkbare, men ingen "tilbake"-mekanisme
- Brukeren mister sporet etter 2-3 kryssreferanse-hopp

**Design (fra spec):**
```
2023/456 → 2022/789 → C-324/14
```
- Hvert element klikkbart
- Nullstilles ved klikk i liste/graf (ny inngang)
- Beholdes ved kryssreferanse-navigering (fordypning)

**Endringer:**

### 2a. State: `ui.svelte.ts`
Legg til etter `scrollToTarget` (linje 11):
```ts
navigationHistory = $state<string[]>([]);
```
Nye metoder:
- `navigateTo(id: string)` — pusher til historikk, setter `selectedNodeId`
- `selectNode(id: string)` — nullstiller historikk, setter `selectedNodeId` (brukes fra liste/graf-klikk)
- `goBack()` — popper siste fra historikk

### 2b. UI: `NodeDetail.svelte`
- Legg til brødsmulesti etter `.header-top` (linje 100), før `.node-title` (linje 101)
- Vis historikk som klikkbare lenker: saksnummer i monospace, `→` separator
- Styling: dempet tekst (`--p-ink3`), kompakt, under lukke-knapp
- Bare synlig når `navigationHistory.length > 0`

### 2c. Oppdater navigasjonskall
- `CaseReader.svelte` kryssreferanser (linje 155): bruk `uiState.navigateTo()` i stedet for `selectNode()`
- `NodeDetail.svelte` relasjoner (linje 225): bruk `uiState.navigateTo()` i stedet for `selectNode()`
- `NodeList.svelte` og `GraphView.svelte` klikk: behold `selectNode()` (nullstiller historikk)

**Verifisering:**
- Klikk sak i listen → ingen brødsmule (direkte inngang)
- Klikk kryssreferanse i lesemodus → brødsmule vises: "2023/456 →"
- Klikk enda en kryssreferanse → brødsmule vokser: "2023/456 → 2022/789 →"
- Klikk på "2023/456" i brødsmulen → navigerer tilbake, brødsmule forkortes
- Klikk ny sak i listen → brødsmule nullstilles

---

## Oppgave 3: Ikke-markerte avsnitt dimmet + toggle

**Spec:** §10 (Lesemodus)

**Nåværende oppførsel:**
- `CaseReader.svelte` linje 33: `showAllText = $state(true)` — default viser all tekst
- Linje 123: `isDimmed` logikk finnes: `!showAllText && !isHighlighted`
- Linje 109-111: Toggle-knapp finnes
- Linje 324-330: `.dimmed` class med `opacity: 0.4`

**Analyse:** Dette er i stor grad allerede implementert! Men:

**Hva mangler:**
- Spec sier default bør være kuratert visning (bare markerte med full opacity) — nåværende default er `showAllText = true`
- Spec sier `opacity: 0.5` for dimmet tekst, nåværende bruker `opacity: 0.4`
- Spec sier "Juristen kan klikke på dempet tekst for å vise den med full opacity" — individuell avsnitt-expand

**Endringer:**

### 3a. `CaseReader.svelte`
- Endre default: `showAllText = $state(false)` — start i kuratert modus (bare markerte med full opacity)
- Men bare når AI-kuratering finnes. Uten kuratering: vis all tekst
- Juster opacity: `.dimmed { opacity: 0.5 }` (fra 0.4, per spec)
- Legg til klikk-handler på dimmet avsnitt: klikk → dette avsnittet gets full opacity (uten å endre global toggle)
- Klar toggle-tekst: "Vis all tekst" / "Vis bare markerte"

**Verifisering:**
- Åpne lesemodus med AI-kuratering → bare markerte avsnitt har full opacity
- Ikke-markerte avsnitt er synlige men dimmet (opacity 0.5)
- Klikk på dimmet avsnitt → det avsnittet får full opacity
- Klikk "Vis all tekst" → alle avsnitt har full opacity
- Åpne lesemodus uten kuratering → all tekst vises (ingen dimming)

---

## Oppgave 4: Seed- og iterasjonsmarkering på grafnoder

**Spec:** §8b (Grafvisning — overlegg på noder)

**Nåværende oppførsel:**
- `GraphNode.svelte` har allerede alle 5 overlegg kodet (linje 152-228):
  - ✅ Kategori-badge (top-right)
  - ✅ Lest-markering (top-left)
  - ✅ Avgrensning (ved kategori)
  - ✅ Seed-markering (venstre, linje 205-208)
  - ✅ Iterasjonspill (under subtitle, linje 210-228)
- Problemet: `isSeed` og `iteration` settes kanskje ikke riktig fra backend

**Endringer:**

### 4a. Verifiser backend: `traversal.py`
- Sjekk at `isSeed: true` settes på seed-noder (bestemmelser brukeren har valgt)
- Sjekk at `iteration` settes korrekt per node

### 4b. Verifiser frontend: `GraphNode.svelte`
- Seed-markering (linje 205-208): verifiser at den rendres for seed-noder
- Iterasjonspill (linje 210-228): verifiser at den rendres for iter. 2+
- Sjekk visuell plassering og overlap med andre badges

**Verifisering:**
- Seed-bestemmelser har fylt prikk til venstre i graf
- Noder fra iterasjon 2+ har grønn "iter. 2" pill under seg
- Ingen overlap mellom badges

---

## Oppgave 5: Progressiv ekspansjon i graf

**Spec:** §12 (Progressiv ekspansjon)

**Nåværende oppførsel:**
- Alle noder rendres samtidig i grafen
- Ingen aggregering eller collapsing

**Analyse:** Dette er den mest komplekse oppgaven. Spec beskriver aggregatbokser:
```
[FOA §16-10]
    |
  (23 KOFA-saker)  ← klikkbar aggregatboks
    |
  (2 EU-dommer)    ← klikkbar aggregatboks
```

**Endringer:**

### 5a. `layout.ts`
- Legg til `computeAggregatedLayout()` som pre-prosesserer noder:
  - Grupper KOFA-saker per bestemmelse de er koblet til
  - Erstatt grupper med virtuelle aggregat-noder som viser antall
  - Behold bestemmelsesnoder som individuelle noder
- Threshold: aggreger kun grupper med >5 noder

### 5b. Ny komponent: `AggregateNode.svelte`
- Stiplet ramme, viser "23 KOFA-saker" med antall per kategori (A: 4, B: 8, C: 11)
- Klikkbar: ekspander gruppen til individuelle noder
- Animasjon: noder fader inn ved ekspansjon

### 5c. `GraphView.svelte`
- Start i aggregert modus
- Ved ekspansjon: kjør dagre på nytt med individuelle noder, pin allerede synlige noder
- "Reorganiser"-knapp i verktøylinje: un-pin alle noder, kjør full re-layout

### 5d. Node-locking
- Ekspanderte noder får `fx`/`fy` (faste posisjoner) så de ikke flyttes av senere ekspansjoner
- `layout.ts`: respekter pinnede posisjoner i dagre-input

**Verifisering:**
- Åpne graf med >10 noder → ser aggregatbokser per bestemmelse
- Klikk aggregatboks → individuelle noder fader inn
- Ekspander andre gruppe → første gruppe forblir på plass
- Klikk "Reorganiser" → full re-layout med animasjon

---

## Rekkefølge

```
Oppgave 3 (CaseReader dimming, enkel) →
Oppgave 4 (Grafnode badges, verifisering) →
Oppgave 1 (Dimming i liste, middels) →
Oppgave 2 (Lesesti, middels) →
Oppgave 5 (Progressiv ekspansjon, stor)
```

Oppgave 3 og 4 er mest verifisering og justeringer (mye er allerede kodet). Oppgave 1 og 2 er nye features. Oppgave 5 er den mest komplekse og kan avgrenses til bare aggregatbokser uten node-locking i første omgang.

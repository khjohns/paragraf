# Sprint 6 — Kjerneinteraksjoner (Fase 1-hull)

**Mål:** Fikse informasjonsmangler som gjør at juristen får feil bilde eller ikke kan bruke verktøyet som tiltenkt.

**Kvalitetsprosess per oppgave:**
1. Implementer mot designspesifikasjon (seksjonsnummer angitt per oppgave)
2. Kjør `interface-design:critique` etter visuell endring
3. Kjør `simplify` etter hver oppgave
4. Verifiser i nettleser med reelle data

---

## Oppgave 1: Iterasjons-workflow

**Spec:** §4 Seksjon 4 (Kartlegging), §14 (Iterasjonshistorikk)

**Hva mangler:**
- `incrementIteration()` metode i `analysis.svelte.ts`
- Click handler på "Ny iterasjon med nye seeds"-knappen i LeftPanel (linje 181, finnes men er uknyttet)
- Iterasjonsinfo som viser hva som endret seg ("Iterasjon 2: +1 treff via 'binær vs. kvantitativ rådighet'")

**Endringer:**

### 1a. State: `analysis.svelte.ts`
Legg til `startNewIteration()` etter `toggleDelimitation()` (linje 59):
- Inkrementer `analysis.iteration`
- Lagre nåværende seeds som snapshot (for sammenligning)
- Oppdater `updatedAt`
- Kall `debouncedSave()`

### 1b. Type: `analysis.ts`
Utvid `Analysis` med valgfritt felt:
- `iterationHistory?: Array<{ iteration: number; addedSeeds: string[]; newNodeCount: number }>`

### 1c. UI: `LeftPanel.svelte`
- Knytt click handler til `.new-iter-btn` (linje 181) som åpner en enkel bekreftelsesflyt
- Ved klikk: inkrementer iterasjon, la brukeren endre seeds, kjør nytt søk
- Vis iterasjonshistorikk under fremdriftslinjer: "Iterasjon 2: +3 treff via 'rådighet'"
- Iterasjonsbadge i Resultater-seksjonen for noder fra iter. 2+

### 1d. Backend: `traversal.py`
- Sett `iteration`-felt på nye noder basert på gjeldende iterasjon
- Dedupliser noder som allerede finnes fra forrige iterasjon

**Verifisering:**
- Start søk med 2 seeds → se resultater → legg til seed → klikk "Ny iterasjon" → nye noder har "iter. 2"-badge
- Iterasjonsinfo i venstepanel oppdateres
- Noder fra iter. 1 beholder sine badges

---

## Oppgave 2: Cite-sort advarsel

**Spec:** §8a (Listevisning), §9 (Siteringsretningsbias)

**Hva finnes:** `Toolbar.svelte` linje 87-91 har allerede advarselen "Eldre saker dominerer — kombiner med dato". Den vises når sort = "citations".

**Hva mangler:**
- Advarselen er bare tekst — spec sier *inline-advarsel* med visuell vekt
- Mangler advarselsikon

**Endringer:**

### 2a. `Toolbar.svelte`
- Style `.sort-warning` som en visuell advarsel (ikke bare tekst): dempet gul bakgrunn, advarselsikon (⚠), design-token `--p-warn-bg`
- Verifiser at advarselen er synlig nok uten å forstyrre

**Verifisering:**
- Klikk "Siteringer"-sort → gul advarsel vises med ikon
- Bytt til annen sort → advarselen forsvinner

---

## Oppgave 3: Reguleringsversjon-advarsel

**Spec:** §7 (Reguleringsversjon — kritisk filter)

**Hva finnes:** Toggle-knapp i Toolbar ("FOA 2017–" / "Alle FOA"). Fungerer.

**Hva mangler:**
- Gul advarselsboks i Resultater-seksjonen (venstepanel) som forklarer at filteret er aktivt
- Advarselen skal si "Kun gjeldende FOA (2017–)" med advarselsikon

**Endringer:**

### 3a. `LeftPanel.svelte`
- I Seksjon 3 (Resultater), legg til advarselsboks under A/B/C-kategoriene (rundt linje 105)
- Styling: `--p-warn-bg` bakgrunn, `--p-warn` tekst, advarselsikon
- Vises bare når reguleringsfilter er aktivt (`uiState.regulationFilter === true`)
- Tekst: "Kun gjeldende FOA (2017–) — eldre praksis er filtrert bort"

**Verifisering:**
- Med filter på: gul boks synlig i venstepanel
- Med filter av: boksen forsvinner

---

## Oppgave 4: Signal-tooltips

**Spec:** §11 (Trippel-signalindikatoren R/F/V)

**Hva finnes:** `NodeRow.svelte` linje 85 har `title="R: Referanse  F: Fulltekst  V: Vektor"` — tooltip finnes allerede!

**Hva mangler:**
- Tooltip-teksten er generisk — spec sier hover på *individuell* prikk skal vise hva den betyr
- Bør også vises i høyrepanelets header (NodeDetail)

**Endringer:**

### 4a. `NodeRow.svelte`
- Gi hver `.dot` individuell `title`: "R: Referansetabell", "F: Fulltekstsøk", "V: Vektorsøk"
- Behold også group-level title

### 4b. `NodeDetail.svelte`
- I header-seksjonen (rundt linje 116), legg til signalprikker med tooltips
- Vis utbrettet forklaring i Treffsignaler-seksjon med etiketter (ikke bare prikker)

**Verifisering:**
- Hover over individuelle prikker → riktig tooltip
- Åpne høyrepanel → signalprikker med forklaring synlig

---

## Oppgave 5: Gap-matrise forbedringer

**Spec:** §5 (Gap-identifisering)

**Hva finnes:** `LeftPanel.svelte` linje 153-172: Gap-matrise med bestemmelsespar, interseksjonstall, og ∅ for null-treff. Fungerer.

**Hva mangler:**
- Null-treff er ikke klikkbare (spec: "klikkbare — klikk kan åpne et ettersøk-forslag")
- Kursiv oppsummeringstekst under matrise ("4 bestemmelsespar uten felles praksis — mulige analytiske hull")
- Gap-rader har lilla bakgrunn (`#F3ECF8`) for null-treff — verifiser mot spec

**Endringer:**

### 5a. `LeftPanel.svelte`
- Gjør `.is-gap` rader klikkbare: ved klikk, foreslå ettersøk (f.eks. legg til bestemmelsesparet som nye seeds)
- Legg til kursiv oppsummeringstekst under gap-listen: `{zeroGapCount} bestemmelsespar uten felles praksis — mulige analytiske hull`
- Verifiser styling: lilla bakgrunn `--p-gap-bg` (#F3ECF8) på null-treff

### 5b. Klikkbare gap-rader
- Ved klikk på en ∅-rad: vis en toast/forslag om å legge til bestemmelsesparet som nye seeds i neste iterasjon
- Koble til iterasjons-workflow fra oppgave 1

**Verifisering:**
- Gap-matrise viser ∅ med lilla bakgrunn
- Klikk på ∅-rad → toast med forslag
- Oppsummeringstekst under matrisen

---

## Rekkefølge

```
Oppgave 1 (Iterasjon) → Oppgave 5 (Gap, avhenger av iterasjon) → Oppgave 2 (Cite-sort) → Oppgave 3 (Reg.versjon) → Oppgave 4 (Signal-tooltips)
```

Oppgave 1 er størst og mest kompleks. Oppgave 2-4 er enkle UI-forbedringer som kan kjøres parallelt etter oppgave 1.

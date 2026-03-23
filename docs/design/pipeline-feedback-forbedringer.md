# Pipeline-feedback — UX-forbedringer per steg

**Status:** Utkast, ikke planlagt
**Dato:** 2026-03-23

## Overordnet problem

Brukeren mangler tilstrekkelig feedback gjennom hele analyse-pipelinen. Problemet er det samme i hvert steg: «Fungerer det? Hva skjer nå? Hva ble gjort?» Dagens feedback er fragmentert — toasts forsvinner, spinnere er generiske, og progresjonsinfo er spredt mellom ulike paneler og komponenter.

---

## Per steg: Nåtilstand → mangler → forslag

### 1. Scoping (ScopingOverlay)

**Nåtilstand:**
- Step indicator (1–4) med aktiv/done-tilstand
- Spinner + «Analyserer problemstilling…» under loading
- Spinner + liste over søketyper under «Kjører primærsøk»

**Mangler:**
- Søkefasen viser tre spinners som alle snurrer simultant — ingen progresjon. Brukeren vet ikke om noe faktisk skjer eller om det har hengt seg.
- Ingen estimert varighet eller teller. Primærsøk tar 10–30 sek — det er lenge uten feedback.
- Ingen oppsummering: «Fant 34 kandidater i 3 søketyper» vises aldri.

**Forslag:**
- **Trinnvis søkestatus:** Erstatt tre samtidige spinners med sekvensiell oppdatering: `✓ Referansetabell: 12 treff → ◐ Fulltekstsøk… → · Vektorsøk`. Backend sender allerede separate resultater — frontend kan oppdatere etter hvert trinn.
- **Resultat-oppsummering:** Vis «Fant 34 kandidater (12 ref · 18 FTS · 22 vektor, 18 unike duplikater fjernet)» før overgang til kandidatvisning. Gir brukeren en grunn til å stole på at søket var grundig.

---

### 2. Screening (ScreeningPanel + NodeRow)

**Nåtilstand:**
- Toast «Screening startet — N saker via SSE» (forsvinner etter 3 sek)
- Progress-bar per A/B/C-kategori i ScreeningPanel (venstepanel)
- Batch-indikator med spinner + prosent i venstepanelet
- Gul highlight + spinner på aktiv sak i NodeRow
- «Screenet»-badge + hake per sak etter fullført
- Toast «Screening fullført — verifiserer sitater…»

**Mangler:**
- Progresjonsinfo er i venstepanelet, men oppmerksomheten er i sakslisten (midtpanel). Brukeren ser ikke progress uten å flytte blikket.
- Ingen indikasjon på *kø* — hvilke saker som venter, bare den aktive.
- Ingen scope-bekreftelse: «8 av 34 sendt til Claude» vises aldri eksplisitt.
- Resultat-toasts forsvinner — ingen persistent oppsummering.

**Forslag:**
Se `docs/design/screening-feedback-forbedringer.md` for detaljert forslag (A: inline status-rad i NodeList, B: kø-indikator, C: persistent resultat-banner). Disse forslagene er fortsatt gyldige og bør integreres i det felles mønsteret beskrevet nedenfor.

---

### 3. Citation QA (etter screening)

**Nåtilstand:**
- Toast «Screening fullført — verifiserer sitater…» (starter automatisk)
- Verification-banner i ScreeningPanel med teller (✓ N, ⚠ M trunkert, ✗ K feil)
- Ingen live progress under selve verifiseringen

**Mangler:**
- Brukeren vet ikke at citation QA kjører — det er en stille `await` i bakgrunnen etter screening. `verifyingCitations`-flagget brukes ikke i UI.
- Ingen indikasjon på varighet eller fremdrift. Citation QA kan ta 30–60 sek for mange saker.
- Hvis verifiseringen feiler, er det bare en toast som forsvinner.

**Forslag:**
- **Vis «Verifiserer sitater…»-status** i den samme posisjonen som screening-progress (inline i NodeList, eller som en ny linje i batch-indikatoren). Bruk `verifyingCitations`-flagget.
- **Resultat direkte i listerad:** Per sak, vis et lite ikon hvis sitater har problemer — ruter brukeren til å se på dem. (Delvis implementert via ScreeningPanel-banneret, men ikke per-sak i listen.)

---

### 4. Syntese (SynthesisProcessView)

**Nåtilstand — BEST I KLASSEN:**
- Live SSE-hendelser vises som en arbeidslogg: «Laster screeningresultater…», «Analyserer materialet…», «Henter avs. 3, 7, 12 fra 2023/42», etc.
- Hvert steg har ✓/◐-status med done-markering
- Abort-knapp under streaming
- Feilvarsling med «Prøv igjen»
- WorkLog med turns, verktøykall, tidsmåling, kostnad (kollapsbar)

**Mangler:**
- Varighet/timer — brukeren ser progresjonen, men vet ikke om det har gått 30 sek eller 5 min.
- Ingen estimat: «Vanligvis 2–5 min for N saker» ville redusere usikkerhet.
- Turn-teller er skjult i WorkLog — eksponere «Turn 3/…» i stream-headeren.

**Forslag:**
- **Elapsed timer** i stream-header: «Genererer notat… 1:23» — oppdateres hvert sekund.
- **Turn-indikator** synlig i stream-progress: «Turn 3 · Utarbeider notat…» — dette finnes allerede i event-data men vises ikke.

---

### 5. QA (SynthesisProcessView)

**Nåtilstand:**
- Samme SSE-hendelser som syntese (status + tool_call + tool_result)
- QA-kolonne med flagg, sitatverifisering, logikksjekk, dekningstjekk
- WorkLog med kostnadsinfo

**Mangler:**
- Samme som syntese — ingen timer, ingen turn-synlighet.
- QA-resultatet vises bare i høyrekolonnen — PhasePanel viser bare «⚠ N merknader» eller «✓ ok». Ingen persistent oppsummering tilgjengelig uten å åpne syntesevisningen.

**Forslag:**
- Samme timer/turn-forbedringer som syntese.
- **QA-oppsummering i PhasePanel:** Ekspander QA-rad med nøkkelfunn (sitatfeil, logikkflagg, ubehandlede saker) — dette er delvis implementert men viser bare total_flags.

---

## Felles mønster: PipelineStatusBar

### Problemet med dagens tilnærming

Feedback er spredt over 5 ulike mekanismer:
1. **Toast** — forsvinner, usynlig i ettertid
2. **Spinners** — generiske, ingen kontekst
3. **Progress-bar** — plassert i feil panel (venstre, ikke midt)
4. **Batch-indikator** — bare for screening, bare i venstepanel
5. **Stream-log** — bare for syntese/QA, bare i SynthesisProcessView

### Foreslått løsning: Én konsistent status-komponent

En `PipelineStatusBar` — en tynn, persistent statuslinje som alltid er synlig i midtpanelet (øverst i listen / under toolbar). Den følger formelen:

```
[ikon] [Hva skjer] [fremdrift] [detalj] [varighet]
```

**Eksempler per steg:**

```
◐  Kjører søk        2/3 typer     FTS: 18 treff     0:12
◐  Screening          5/12 saker    2024/156           1:34
◐  Verifiserer sitater 8/12         —                   0:22
◐  Genererer notat    Turn 3        Henter 2023/42      2:15
◐  Kjører QA          Turn 2        Sjekker sitater     1:03
```

**Når ferdig, kollapser til oppsummering:**

```
✓  Søk fullført       34 kandidater  12 ref · 18 FTS · 22 vektor     0:24
✓  Screening          12 screenet    4A · 6B · 2C · 1 sitatfeil      4:12
✓  Syntese            5 seksjoner    8 verktøykall · $0.42            3:47
✓  QA                 2 merknader    1 sitatfeil · 1 logikkflagg      1:15
```

### Design

- **Plassering:** Toppen av midtpanelet, under toolbar/view switcher. Alltid synlig når en pipeline-operasjon pågår eller nylig fullført.
- **Høyde:** 28–32px. Kompakt — stjeler minimal plass fra listen.
- **Stil:** Bakgrunn `var(--p-highlight)` under kjøring, `var(--p-surface)` når ferdig. Venstre-border i `var(--p-ai-border)` for AI-operasjoner. Ingen skygge (per designsystem). Tekst 11px, monospace for tall.
- **Avvisbar:** Oppsummeringslinjen kan lukkes med ✕ (men lagres i state for å vises igjen ved behov).
- **Ekspanderbar:** Klikk på statuslinjen for å vise detaljer — dette åpner en ~4-raders boks med de siste hendelsene (som en mini-versjon av stream-loggen i SynthesisProcessView).

### Implementasjonsnotat

En ny `PipelineStatusBar.svelte`-komponent som leser fra:
- `pipelineState` (syntese/QA-streaming, progress-events)
- `screeningState` (screening SSE, batch, citation verification)
- `analysisState.status` (pipeline-fase)

Plasseres i midtpanelet (i `AppShell` eller `MainPanel`), utenfor visningsspesifikke komponenter.

### Forhold til eksisterende feedback

| Mekanisme | Beholde? | Kommentar |
|-----------|----------|-----------|
| Toast | **Ja, reduser** | Kun for feil og avbryting. Fjern «startet»/«fullført»-toasts — statuslinjen dekker dette. |
| NodeRow spinner/highlight | **Ja** | Beholdes som lokal per-sak-indikator — komplementær til statuslinjen. |
| ScreeningPanel progress-bar | **Ja** | Fortsatt nyttig i venstepanelet for detaljert A/B/C-oversikt. |
| Batch-indikator | **Erstattes** | PipelineStatusBar tar over denne rollen. |
| SynthesisProcessView stream-log | **Ja** | Detaljert logg beholdes — PipelineStatusBar er en *forenklet speiling*, ikke en erstatning. |
| ProgressIndicator (7-stegs) | **Vurder** | Brukes ikke aktivt i AppShell. Kan eventuelt integreres i ContextStrip. |

---

## Kø-synlighet (supplement til screening)

Uavhengig av PipelineStatusBar bør saker i screening-kø få en visuell markering i listen:

- **Markering:** Tynn venstre-border (`2px solid var(--p-ai-border-subtle)`) på saker som er tildelt Claude men ennå ikke screenet.
- **Rekkefølge-hint:** Valgfritt: vis kønummer (`①②③…`) som en liten badge — dette kan være overkill, men gir eksplisitt svar på «ble alle sakene mine sendt?».

---

## Prioritering

| # | Tiltak | Effekt | Innsats |
|---|--------|--------|---------|
| 1 | PipelineStatusBar (kjerne) | Løser 80% av problemet — én komponent, alle steg | Medium |
| 2 | Trinnvis søkestatus (scoping) | Fjerner «tre identiske spinners»-problemet | Lav |
| 3 | Kø-markering i sakslisten | Svarer på «ble alle sendt?» | Lav |
| 4 | Citation QA synlig i UI | Fjerner den usynlige bakgrunnsoperasjonen | Lav |
| 5 | Timer i syntese/QA-stream | Reduserer «hvor lenge har dette pågått?»-usikkerhet | Lav |
| 6 | Reduser toasts | Mindre støy, statuslinjen erstatter | Lav |

**Anbefaling:** Start med #1 (PipelineStatusBar) — det gir mest verdi med ett implementasjonsgrep. #2–5 er uavhengige forbedringer som kan tas enkeltvis etterpå.

# UI-redesign: Prosessflyt fra scoping til syntese/QA

**Dato:** 2026-03-17
**Kontekst:** Nåværende tre-panel-layout er designet for arbeidsmodus (lese saker, utforske graf), men pipelinen genererer mye prosesskontekst som ikke passer i 300px venstrepanel. Denne spesifikasjonen definerer ny layout-arkitektur med to moduser.

**Referanser:**
- `.interface-design/system.md` — designsystem (varm papirpalett, borders-only, Inter/JetBrains Mono)
- `docs/design/paragraf-designspesifikasjon.md` — opprinnelig designspec
- `docs/plans/qa-observasjoner.md` — UI-bugs og observasjoner fra manuell QA

**Codegrasp:** Kjør `mcp__codegrasp__get_session_context` ved start for å hente observasjoner fra tidligere sesjoner. Spesielt relevant:
- Observasjon #1 (agentisk syntese) — `_llm_meta`-struktur, `tools_called`, `_run_agentic_loop`
- Observasjon #3 (agentisk QA) — `COMBINED_QA_SCHEMA`, reference_issues/logic_flags-struktur
- Observasjon #6 (UI redesign) — komponent-mapping, datakilder, layout-arkitektur

Bruk `mcp__codegrasp__get_context_capsule` for å forstå komponenter før du endrer dem (f.eks. `LeftPanel.svelte`, `AppShell.svelte`, `SynthesisView.svelte`). Bruk `mcp__codegrasp__save_observation` for å dokumentere design-valg underveis.

---

## Kjerneproblemet

Analysen har to distinkte moduser som trenger ulik layout:

1. **Prosessmodus** — sette opp, konfigurere, delegere, gjennomgå. Informasjonstett, full bredde. Eksempler: scoping, screening-delegering, syntese-gjennomgang, QA-review.

2. **Arbeidsmodus** — lese saker, utforske graf, skrive notater. Tre-panel (liste + detalj + notater), fokusert.

Nåværende design presser prosessmodus inn i arbeidsmodus. Scoping er allerede en fullbredde-overlay — det er riktig mønster. Resten av prosess-stegene bør følge.

---

## Layout-arkitektur

### Overordnet struktur

```
┌──────────────────────────────────────────────────────────────────┐
│  Header (Paragraf · bruker · analyse-tittel)                     │
├──────────────────────────────────────────────────────────────────┤
│  ▾ Kontekststripe (ekspanderbar)                                 │
├────────┬─────────────────────────────────┬───────────────────────┤
│Faser   │                                 │                       │
│① ✓     │  [Arbeidsområdet / Prosessvisn.]│  [Høyrepanel]         │
│② ✓     │                                 │                       │
│③ ◐     │                                 │                       │
│④ ○     │                                 │                       │
├────────┴─────────────────────────────────┴───────────────────────┤
```

### Fasepanel (erstatter nåværende LeftPanel)

Smalere enn dagens 300px. Viser kun fase-tilstand, ikke innhold.

```
┌────────────┐
│ METODE     │  ← panel-eyebrow (11px, uppercase)
│            │
│ ① Problem  │  ✓ definert
│ ② Kandidat │  ✓ 41 (9A 12B 20C)
│ ③ Screening│  ◐ 5/15
│    Sitater  │  ✓ 12/14
│ ④ Syntese  │  ✓ 6 seksjoner
│    QA      │  ⚠ 3 issues
│            │
│ $1.07      │  ← total_cost_usd (ink3, liten)
└────────────┘
```

**Viktige detaljer:**
- QA er en undertilstand av syntese, sitatsjekk er undertilstand av screening — nestet, ikke lineært
- Hvert steg er klikkbart: åpner prosessvisning i midtpanelet (fullbredde)
- Tilstandsikoner: `✓` grønn, `◐` gull (pågår), `⚠` oransje (issues), `○` grå (ikke startet)
- `total_cost_usd` vises diskret nederst i ink3-farge

### Kontekststripe (NY komponent)

Horisontalt felt mellom header og arbeidsrom. Kollapset som default (én linje), ekspanderbar med klikk.

**Kollapset (default):**
```
┌──────────────────────────────────────────────────────────────────┐
│ ▸  FOA §16-10 — Tildelingskriterier    5/15 lest   Iter. 1      │
└──────────────────────────────────────────────────────────────────┘
```

**Ekspandert:**
```
┌──────────────────────────────────────────────────────────────────┐
│ ▾  FOA §16-10 — Tildelingskriterier    5/15 lest   Iter. 1      │
│                                                                  │
│  PROBLEMSTILLING                         SØKEDEKNING             │
│  Hvilke tildelingskriterier etter        R §16-10: 23 treff      │
│  FOA §16-10 er lovlige...                FTS «tildelingskrit»: 8 │
│                                          Vektor: 15 treff        │
│  BESTEMMELSER                            Duplikater: -5           │
│  §16-10 (primær)                         ────────────────        │
│  §23-5 — ettersendelse                   41 unike → 9A 12B 20C  │
│  §9-5 — avvisningsplikt                                          │
│  Dir. art. 63 — EU-grunnlag              GAP-MATRISE             │
│                                          §16-10 ∩ §23-5: 3 saker │
│  AI: «§16-10 krever at leverandøren      §16-10 ∩ §9-5: 0 ⚠     │
│  dokumenterer rådighet. §23-5 regulerer                          │
│  ettersendelse av slik dokumentasjon.»                           │
│                                                                  │
│  [Rediger seeds]  [Vis iterasjonshistorikk]                      │
└──────────────────────────────────────────────────────────────────┘
```

**Datakilder:**

| Felt | Kilde | API |
|------|-------|-----|
| Problemstilling | `analyses.refined_problem` | GET /api/analyses/:id |
| Bestemmelser | `analysis_seeds` (type=provision) | GET /api/analyses/:id |
| AI-begrunnelse | `analyses.scoping_result` | **NY — krever backend-endring** |
| Søkedekning (R/F/V per seed) | Aggreger fra `analysis_candidates.signals` | Frontend-beregning |
| Kandidat-fordeling | Aggreger fra `analysis_candidates.category` | Frontend-beregning |
| Gap-matrise | `analyses.gaps` | GET /api/analyses/:id |
| Iterasjon | `analyses.iteration` + `analysis_candidates.iteration` | GET /api/analyses/:id |

**Backend-endring nødvendig:** Scoping-resultat (Claudes begrunnelse for valg av bestemmelser, delspørsmål, søketermer) er ikke persistert i dag — forsvinner etter godkjenning. Legg til `scoping_result jsonb` på `analyses`-tabellen. Populeres av scoping-endpunktet.

### Prosessvisninger (fullbredde)

Når et steg i fasepanelet klikkes, erstatter prosessvisningen arbeidsområdet midlertidig. Bruker full bredde (midtpanel + høyrepanel kollapset).

---

## Prosessvisning per steg

### 1. Scoping (allerede implementert som overlay)

`ScopingOverlay.svelte` bruker allerede fullbredde. Beholder dette mønsteret. Endring: persister resultatet til `analyses.scoping_result` ved godkjenning.

### 2. Screening-delegering

Fullbredde visning med kategori-toggles og arbeidsfordeling.

```
┌──────────────────────────────────────────────────────────────────┐
│  SCREENING — Arbeidsfordeling                                    │
│                                                                  │
│  ┌─ A-kandidater (9) ─────────────────────────────────────────┐  │
│  │ ● Claude screener    ○ Jeg leser    ○ Velg per sak        │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌─ B-kandidater (12) ────────────────────────────────────────┐  │
│  │ ○ Claude screener    ● Jeg leser    ○ Velg per sak        │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌─ C-kandidater (20) ────────────────────────────────────────┐  │
│  │ ○ Claude screener    ○ Jeg leser    ● Velg per sak        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Filter: ☑ Kun gjeldende FOA (2017–)   12 eldre saker filtrert  │
│                                                                  │
│  [Start screening →]                                             │
└──────────────────────────────────────────────────────────────────┘
```

Etter start: viser SSE-fremdrift (per sak). Når ferdig: «Tilbake til arbeidsrom» → arbeidsmodus.

### 3. Syntese-gjennomgang (NY — viktigst)

Fullbredde to-kolonne visning med notat til venstre og QA-merknader til høyre.

```
┌─ Syntese-notat ──────────────────────────────┬─ QA ─────────────┐
│                                              │                   │
│  # Støtte på andre virksomheters             │  Kjør QA →        │
│    kapasitet etter FOA §16-10                │                   │
│                                              │  (eller etter QA  │
│  ## 1. Problemstilling                       │   er kjørt:)      │
│  Notatet er utarbeidet på grunnlag...        │                   │
│                                              │  ⚠ 3 ref-issues   │
│  ## 2. Rettslig utgangspunkt                 │  ⚠ 4 logikk-flags │
│  FOA §16-10 (1): En leverandør kan           │  ✓ 0 ubehandlet   │
│  «støtte seg på kapasiteten til...           │                   │
│                                              │  ── Referanser ── │
│  > 2025/1084, avsnitt 47 📎                 │  [medium] 2019/379 │
│  «Det er klart at ein leverandør har         │  p32: kontekst     │
│  anledning til å støtte seg på ein           │  misvisende...     │
│  underleverandør...»                         │                   │
│                                              │  [medium] 2025/1084│
│  [JURISTENS VURDERING: Avklar om            │  p47: nyanser...   │
│  problemstillingen er riktig avgrenset]      │                   │
│  ↑ gull-brun AI-border                       │  ── Logikk ──     │
│                                              │  [medium] §16-10   │
│  ## 3. Adgangen til å støtte seg...          │  behandlet som     │
│                                              │  direkte anv. i    │
│                                              │  del II-sak...     │
│  ─────────────────────────────────────       │                   │
│  Arbeidslogg (diskret, ekspanderbar)         │                   │
│  Turn 1: Hentet avs. 29,35,40 fra 2022/31   │                   │
│  Turn 1: Hentet avs. 41,47,50 fra 2025/1084 │                   │
│  Turn 2: Produserte notat (93s, $0.10)       │                   │
├──────────────────────────────────────────────┴───────────────────┤
│  [Rediger notat]  [Kjør QA på nytt]  [Eksporter markdown]       │
└──────────────────────────────────────────────────────────────────┘
```

**Nøkkeldetaljer:**

1. **📎-ikon** ved referanser som Claude verifiserte via tool use. Tooltip: «Verifisert — Claude slo opp avsnitt 47 direkte». Data fra `_llm_meta.tools_called`.

2. **[JURISTENS VURDERING]-blokker** er fremhevet med gull-brun AI-border (allerede i designsystemet). `requires_lawyer_input: true` i syntese-skjemaet styrer dette. Blokken bør ha en «Legg til din vurdering»-editor.

3. **QA-kolonnen** viser issues fra `COMBINED_QA_SCHEMA`:
   - `reference_issues` — med sak_nr, paragraph, issue_type, severity
   - `logic_flags` — med type, location, severity, suggestion
   - `untreated_cases` — med sak_nr, category, justified_omission

4. **Arbeidslogg** nederst, kollapset som default. Viser `_llm_meta.tools_called` fra syntese + QA. Bygger tillit ved å vise arbeidet.

5. **QA-merknader bør mappes til seksjoner.** `logic_flags[].location` inneholder seksjonsnavn (f.eks. «Avsnitt 5 – sak 2025/1084»). Frontend kan matche dette mot `sections[].heading` for å plassere merknader ved riktig seksjon.

### 4. Arbeidsmodus (eksisterende tre-panel)

Beholdes som den er for lesing av saker. Endringer:
- Venstepanel erstattes med fasepanel (smalere)
- Kontekststripe legges til over arbeidsrommet
- Midtpanel og høyrepanel uendret

---

## Datakontrakter — hva frontend mottar

### GET /api/analyses/:id (eksisterende, utvidet)

```typescript
interface Analysis {
  id: string;
  title: string;
  problem: string;
  refined_problem: string;      // Claudes forbedrede problemstilling
  sub_problems: string[];
  status: AnalysisStatus;
  seeds: Seeds;
  gaps: GapPair[];
  iteration: number;
  total_cost_usd: number;
  citation_summary: CitationSummary;
  scoping_result: ScopingResult; // NY — Claudes begrunnelse
  candidates: Candidate[];
}

// NY type
interface ScopingResult {
  provisions: { id: string; reasoning: string }[];
  sub_problems: string[];
  fts_terms: string[];
  ai_reasoning: string;  // Claudes overordnede vurdering
}
```

### POST /api/analyses/:id/synthesize (eksisterende)

```typescript
interface SynthesisResult {
  title: string;
  sections: {
    heading: string;
    content: string;           // markdown
    requires_lawyer_input: boolean;
  }[];
  unresolved_tensions: {
    description: string;
    cases: string[];
  }[];
  coverage_notes: string;
  markdown: string;            // Full markdown-versjon
  _llm_meta: {
    model: string;
    total_turns: number;
    tools_called: ToolCall[];  // { turn, tool, input, success }
    cost_usd: number;
    elapsed_ms: number;
    agentic: boolean;
  };
}
```

### POST /api/analyses/:id/qa (eksisterende, ny struktur)

```typescript
interface QAReport {
  reference_issues: {
    sak_nr: string;
    paragraph: number | null;
    issue_type: 'inaccurate_reference' | 'missing_nuance' | 'paragraph_mismatch' | 'fabricated';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }[];
  logic_flags: {
    type: string;
    location: string;          // matchbar mot sections[].heading
    description: string;
    severity: 'high' | 'medium' | 'low';
    suggestion: string;
  }[];
  untreated_cases: {
    sak_nr: string;
    category: string;
    proposition: string;
    justified_omission: boolean;
    reason: string;
  }[];
  overall_assessment: string;
  _llm_meta: { ... };         // Samme struktur som syntese
}
```

---

## Backend-endringer nødvendig

| Endring | Fil | Beskrivelse |
|---------|-----|-------------|
| Persister scoping-resultat | `backend/scoping.py` | Lagre Claudes begrunnelse i `analyses.scoping_result` jsonb |
| Ny kolonne | Supabase-migrasjon | `ALTER TABLE analyses ADD COLUMN scoping_result jsonb` |
| Søkedekning-aggregat | Valgfritt | Kan beregnes i frontend fra `candidates[].signals` |

---

## Komponent-inventar

### Nye komponenter

| Komponent | Ansvar |
|-----------|--------|
| `ContextStrip.svelte` | Ekspanderbar kontekststripe med problem/bestemmelser/proveniense |
| `PhasePanel.svelte` | Erstatter LeftPanel i arbeidsmodus — kompakt fase-tilstand |
| `SynthesisView.svelte` | Fullbredde syntese-gjennomgang med QA-kolonnen (erstatter eksisterende) |
| `WorkLog.svelte` | Kollapserbar arbeidslogg (tool calls, turns, kostnad) |
| `QAAnnotation.svelte` | Inline QA-merknad plassert ved relevant seksjon |

### Endrede komponenter

| Komponent | Endring |
|-----------|---------|
| `AppShell.svelte` | Legge til ContextStrip mellom header og arbeidsrom |
| `LeftPanel.svelte` | Refaktoreres til PhasePanel (smalere, kun tilstand) |
| `WorkspaceHeader.svelte` | Forenkles — mesteparten av kontekst flyttes til ContextStrip |
| `ScopingOverlay.svelte` | Persister scoping_result ved godkjenning |
| `ScreeningPanel.svelte` | Flyttes fra venstepanel til prosessvisning (fullbredde) |
| `QAPanel.svelte` | Integreres i SynthesisView som QA-kolonne |

### Uendrede komponenter

NodeList, NodeRow, NodeDetail, GraphView, CaseReader, ChatDrawer, etc. — arbeidsflaten er uendret.

---

## Implementeringsrekkefølge

1. **Backend:** `scoping_result` jsonb-kolonne + persister i scoping.py
2. **ContextStrip** — ny komponent, settes inn i AppShell
3. **PhasePanel** — erstatter LeftPanel (iterativ, kan gjøres gradvis)
4. **SynthesisView** — fullbredde med QA-kolonne og arbeidslogg
5. **Prosessvisninger** — screening-delegering som fullbredde

Steg 1-2 gir størst umiddelbar verdi (kontekst-synlighet). Steg 4 er mest visuelt ambisiøst.

---

## Designsystem-noter

Alle nye komponenter følger `.interface-design/system.md`:
- Varm papirpalett (bg/panel/surface)
- Borders-only (ingen skygger)
- Inter + JetBrains Mono
- 4px base grid
- AI trust boundary: gull-brun venstrekant for AI-innhold
- Badges: `padding: 2px 6px; border-radius: var(--radius-badge); font-size: 10px`

Kontekststripen bruker `panel`-bakgrunn når kollapset, `surface`-bakgrunn når ekspandert. Separator: `border-bottom: 1px solid rgba(26,24,20,0.08)`.

Fasepanel bruker samme bakgrunn som canvas (per system.md: «Generic sidebar with different bg → Same bg as canvas, border separation only»).

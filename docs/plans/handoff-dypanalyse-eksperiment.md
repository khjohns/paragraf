# Handoff: Dypanalyse-eksperiment — seed vs full pipeline

**Dato:** 2026-04-01
**Forrige sesjon:** Analyse 930098ce (avklaring vs forhandling) — full pipeline komplett inkl. meta-notat.
**Formål:** Validere om dypanalyser kan seedes fra meta-analysens rettssetningsregister i stedet for å kjøre full pipeline fra null.

---

## Kontekst

Analyse `930098ce` (avklaring vs forhandling) har produsert:
- 258 screenede saker (A=91, B=71, C=96)
- Rettssetningsregister: 41 proposisjoner, 13 temaer, 198 instances, 17 spenninger
- Meta-notat med 6 anbefalte dypanalyser
- Register i DB som `cross_propositions` (v4) og lokalt `/tmp/cross_propositions_930098ce.json`

Hypotesen: En dypanalyse kan starte fra registerets saker (seed) og re-screene med spisset problemstilling — raskere og billigere enn full pipeline, med tilsvarende kvalitet.

## Oppgave

Gjennomfør et kontrollert eksperiment for 2-3 dypanalyse-temaer:

### Per tema: Kjør TO analyser med samme problemstilling

**Analyse A (full pipeline):**
```
scope → search → traverse → triage → screen → cross → synthesize
```

**Analyse B (seeded fra register):**
```
import saker fra register → re-screen med spisset problem → cross → synthesize
```

### Sammenlign med pipeline-analyst etterpå

## DB-endring (påkrevd)

Kjør denne migrasjonen FØR du starter:

```sql
-- Koble relaterte analyser
ALTER TABLE paragraf_analyses
ADD COLUMN IF NOT EXISTS parent_analysis_id uuid REFERENCES paragraf_analyses(id);

ALTER TABLE paragraf_analyses
ADD COLUMN IF NOT EXISTS seed_propositions text[];

CREATE INDEX IF NOT EXISTS idx_paragraf_analyses_parent
ON paragraf_analyses(parent_analysis_id) WHERE parent_analysis_id IS NOT NULL;

COMMENT ON COLUMN paragraf_analyses.parent_analysis_id IS
'Referanse til meta-analyse denne dypanalysen er avledet fra';

COMMENT ON COLUMN paragraf_analyses.seed_propositions IS
'Proposisjons-IDer fra parent som seedet denne analysen, f.eks. {P14,P15}';
```

## CLI-kommandoer som må implementeres

### 1. `create-from-register` (nivå 1 — seed)

```bash
# Opprett ny analyse seeded med saker fra spesifikke proposisjoner
bash scripts/pipeline-cli.sh create-from-register <parent_analysis_id> <P-IDer> <<< "spisset problemstilling"
# Eksempel:
bash scripts/pipeline-cli.sh create-from-register 930098ce P14,P15,P16,P17 <<< "Når foreligger det objektive holdepunkter..."
```

Implementering i `pipeline-context.py`:
1. Les `cross_propositions` document fra parent
2. Ekstraher unike `caseId` fra angitte proposisjoner
3. Opprett ny analyse med `parent_analysis_id` og `seed_propositions`
4. Kopier kandidater med signals fra parent
5. Sett screening_status=pending (skal re-screenes)
6. Print ny analyse-ID

### 2. `import-screening` (nivå 2 — arv)

```bash
# Importer factum/assessment/quotes fra parent, nullstill proposition/relevance
bash scripts/pipeline-cli.sh import-screening <parent_analysis_id> <ny_analyse_id>
```

Implementering:
1. For hver kandidat i ny analyse som også finnes i parent:
2. Kopier `ai_screening.factum`, `.assessment`, `.quotes`, `.nuances`
3. Sett `.proposition = null`, `.relevance = null`, `.star = null`
4. Sett `screening_status = 'partial'` (har factum, mangler proposition)
5. Re-screening trenger da bare evaluere relevans — ikke lese hele avgjørelsen

## Foreslåtte test-temaer

Fra meta-notatets seksjon 6 (anbefalte dypanalyser). Velg 2-3:

### Tema 1: Objektive holdepunkter-doktrinen (minst, raskest)
- **Seed-proposisjoner:** P14, P15
- **Forventet seed-saker:** ~12
- **Problemstilling:** «Hva innebærer kravet om objektive holdepunkter i det opprinnelige tilbudet etter § 23-5(2), og hvordan har terskelen utviklet seg i KOFA-praksis?»
- **Relevante bestemmelser:** FOA § 23-5(2), EU C-336/12 (Manova)

### Tema 2: Avklaringsrett vs avklaringsplikt (bredest)
- **Seed-proposisjoner:** P08, P09, P10
- **Forventet seed-saker:** ~25
- **Problemstilling:** «Når går oppdragsgivers avklaringsadgang over til en avklaringsplikt, og hvilke momenter er avgjørende for grensedragningen?»
- **Relevante bestemmelser:** FOA § 23-5(1), § 23-3(2), anskaffelsesloven § 4

### Tema 3: Del II dialog vs del III avklaring (mellomting)
- **Seed-proposisjoner:** P32, P33, P43
- **Forventet seed-saker:** ~13
- **Problemstilling:** «Hva er det rettslige innholdet i skillet mellom dialogadgangen i § 9-3 og avklaringsreglene i § 23-5, og hvilken praktisk betydning har det?»
- **Relevante bestemmelser:** FOA § 9-3, § 23-5, § 23-7

## Eksperiment-gjennomføring

For hvert tema (start med tema 1 som pilot):

### Fase 1: Setup
```bash
# DB-migrering (kun første gang)
# Kjør SQL over via Supabase MCP

# Implementer create-from-register og import-screening
# i scripts/pipeline-context.py

# Opprett analyse A (full pipeline)
echo "problemstilling" | bash scripts/pipeline-cli.sh create-analysis "Tema X — full pipeline"

# Opprett analyse B (seeded)
bash scripts/pipeline-cli.sh create-from-register 930098ce P14,P15 <<< "problemstilling"

# Start runs for begge
RUN_A=$(bash scripts/pipeline-cli.sh start-run <analyse_a_id>)
RUN_B=$(echo '{"experiment":"seed_vs_full","variant":"seeded"}' | bash scripts/pipeline-cli.sh start-run <analyse_b_id>)
```

### Fase 2: Kjør parallelt
```
Analyse A: scope → search → triage → screen → cross
Analyse B: import-screening → re-screen → cross
```

### Fase 3: Sammenlign
```bash
# Pipeline-analyst sammenligning
/pipeline-analyst <analyse_a_id>
/pipeline-analyst <analyse_b_id>
```

Mål:
| Metrikk | Hva det viser |
|---------|---------------|
| Kandidat-overlapp (Jaccard) | Finner begge de samme sakene? |
| Unike funn A | Full pipeline fant saker seed misset |
| Unike funn B | Seed hadde saker full pipeline misset |
| Kategori-enighet | Samme A/B/C for overlappende saker? |
| A-sak-overlapp | Samme kjernesaker? |
| Register-likhet | Samme rettssetninger? |

### Fase 4: Konklusjon
- Seed tilstrekkelig? → Bruk for resterende dypanalyser
- Seed + delta-søk? → Implementer hybrid
- Full pipeline nødvendig? → Seed gir ikke nok

## Viktige regler

- Les skills før du dispatcher subagenter (`pipeline/triage.md`, `pipeline/screen.md`, `pipeline/cross-propositions.md`, `pipeline/synthesize-meta.md` eller `pipeline/synthesize.md`)
- Sonnet for screening og verktøy-tunge oppgaver (ikke Haiku)
- Lokal fil for cross-propositions og syntese (Edit for diff)
- QA agent teams for cross-prop og syntese
- Log alle steg via pipeline-cli.sh
- Provision-capsule og register hentes fra data — ikke hardkod bestemmelser

## Filer å kjenne til

- `.claude/skills/pipeline/` — alle pipeline-skills
- `scripts/pipeline-context.py` — CLI for datahenting og skriving
- `scripts/pipeline-cli.sh` — wrapper med venv-aktivering
- `docs/adr/006-kategorisering-og-signalmodell.md` — signalmodell og presisjonstabell
- `docs/adr/007-eksperiment-tracking-og-reproduserbarhet.md` — run-tracking
- `/tmp/cross_propositions_930098ce.json` — registeret (også i DB)
- `/tmp/synthesis_930098ce.md` — meta-notatet (også i DB)
- `memory/project_930098ce_session.md` — sesjonsoppsummering

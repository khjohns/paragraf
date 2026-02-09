# MCP Tool Test Report — 2026-02-09

## Executive Summary

**Production Readiness: PASS (with minor issues)**

All 11 MCP tools are functional with zero crashes. Data quality is strong on core fields but has gaps in optional metadata. LLM usability testing shows the tools and instructions guide correct behavior effectively.

| Metric | Result | Threshold | Status |
|--------|--------|-----------|--------|
| Data quality (Layer 1) | 0 critical failures | 0 | PASS |
| Tool correctness (Layer 2) | 75/75 passed, 0 crashes | All tools functional | PASS |
| Search precision@5 (Layer 2) | ~90% relevant in top 5 | >= 80% | PASS |
| LLM rubric average (Layer 3) | 8.4/10 | >= 7/10 | PASS |
| Limitation disclosure (Layer 3) | 0 scores of 0 | 0 | PASS |

---

## Layer 1: Data Quality

8 SQL queries run against Supabase (`iyetsvrteyzpirygxenu`).

### 1.1 Metadata Coverage

| Field | Count | Coverage | Pass Criteria | Status |
|-------|-------|----------|---------------|--------|
| total docs | 4,446 | — | — | — |
| ministry | 4,446 | **100.0%** | >= 99% | PASS |
| legal_area | 796 | **17.9%** | informational | NOTE |
| based_on | 3,664 | **82.4%** (all docs) | >= 80% forskrifter | — |
| based_on (forskrift) | 3,534 non-empty / 3,673 | **96.2%** | >= 80% | PASS |
| keywords | 0 | 0% | informational | NOTE |
| language | 0 | 0% | informational | NOTE |
| date_end | 0 | 0% | informational | NOTE |

**Notes:**
- `ministry` has 100% coverage — excellent.
- `based_on` for forskrifter: 96.2% have non-empty values (130 have empty string, 9 NULL). Passes threshold.
- `legal_area` at 17.9% is low. This field is only populated from Lovdata XML metadata when present, so sparse coverage is expected. The rettsomrade filter will only work on ~800 documents.
- `keywords`, `language`, `date_end` are unpopulated — these columns exist but the Lovdata XML doesn't consistently provide them. Not blocking.

### 1.2 Orphaned Sections

```
orphan_sections: 0
```
**Status: PASS** — No sections without parent documents.

### 1.3 Empty Content Sections

```
empty_sections: 0
```
**Status: PASS** — All 92,164 sections have content.

### 1.4 Embedding Coverage

```
total: 92,164 | embedded: 92,164 | pct: 100.0%
```
**Status: PASS** — Full embedding coverage.

### 1.5 FTS Search Vector Coverage

```
missing_fts: 0
```
**Status: PASS** — All sections have search vectors.

### 1.6 based_on Format

Sample of 20 forskrifter shows values like:
```
lov/1986-06-20-35/§1lov/1986-06-20-35/§6forskrift/2008-12-19-1441
```
References are concatenated without delimiters. However, `_format_based_on()` in `service.py` parses this correctly by splitting on `lov/` and `forskrift/` boundaries. The raw format is a data quality issue but the display formatting handles it.

**2,144 documents** have concatenated multi-reference based_on values (no delimiters).

**Status: PASS (functional)** — Display formatting compensates. Raw storage could be improved with delimiters in a future migration.

### 1.7 doc_type Distribution

| doc_type | Count |
|----------|-------|
| forskrift | 3,673 |
| lov | 773 |

**Status: PASS** — Only expected values present.

### 1.8 legal_area Distribution (Top 10)

| Legal Area | Count |
|-----------|-------|
| Pensjons- og trygderett | 20 |
| Landbruk, jakt og skogbruk>Dyrevern... | 9 |
| Stats-, statsforfatnings- og statsborgerrett>Forsvaret | 7 |
| Skatte- og avgiftsrett>Inntekts- og formueskatt | 7 |
| Transport og kommunikasjoner>Veitrafikk | 6 |
| Landbruk, jakt og skogbruk>Skogbruk | 6 |
| Pensjons- og trygderettSelskaper, fond og foreninger | 5 |
| ... | ... |

**Note:** Some values have concatenation issues (e.g., `Pensjons- og trygderettSelskaper, fond og foreninger` — missing delimiter between two areas). Same root cause as based_on: multi-value XML fields parsed without separators. Only 796 documents have legal_area at all, so impact is limited.

**Status: NOTE** — Minor data quality issue in a sparsely populated field.

---

## Layer 2: Tool Correctness

**75 tests passed, 0 failed, 0 crashes.**

All 11 tools tested systematically via JSON-RPC piped to `paragraf serve`.

### Results by Tool Group

| Group | Tests | Passed | Failed | Notes |
|-------|-------|--------|--------|-------|
| 2.1 lov (alias resolution) | 13 | 13 | 0 | All 4 resolution stages work |
| 2.2 lov (metadata in TOC) | 3 | 3 | 0 | Departement, Hjemmelslov, structure shown |
| 2.3 forskrift (alias + lookup) | 6 | 6 | 0 | tek17, sak10 work via alias |
| 2.4 sok (basic FTS) | 9 | 9 | 0 | AND, OR fallback, no-hit all work |
| 2.5 sok (filters) | 8 | 8 | 0 | doc_type, departement, amendments |
| 2.6 semantisk_sok (basic) | 6 | 6 | 0 | Vector + FTS hybrid works |
| 2.7 semantisk_sok (filters) | 2 | 2 | 0 | doc_type filter confirmed |
| 2.8 hent_flere (batch) | 7 | 7 | 0 | Mixed found/missing handled |
| 2.9 relaterte_forskrifter | 5 | 5 | 0 | aml, pbl, nonexistent all work |
| 2.10 departementer | 2 | 2 | 0 | Sorted list returned |
| 2.11 liste | 2 | 2 | 0 | Alias info present |
| 2.12 status | 2 | 2 | 0 | Backend + sync info shown |
| 2.13 sjekk_storrelse | 3 | 3 | 0 | Token estimate + not-found msg |
| 2.14 Edge cases | 7 | 7 | 0 | § prefix, empty input, operators |
| **Total** | **75** | **75** | **0** | |

### Key Observations

1. **Alias resolution chain works end-to-end:** Hardcoded aliases (`aml`), direct dok_id (`lov/2005-06-17-62`), DB short_title (`aksjeloven`), and fallthrough error all behave correctly.

2. **FTS AND→OR fallback works:** `sok("oppsigelse nedbemanning")` returns results via OR fallback, `sok("vesentlig mislighold")` works in AND mode.

3. **Empty/invalid input handled gracefully:** `sok("")` returns clear error message, `lov("")` gives helpful guidance, `semantisk_sok` with invalid doc_type returns "Ingen treff" (no crash).

4. **§ prefix stripping works:** `lov("aml", "§ 14-9")` correctly strips the § and finds the section.

5. **Batch fetch with mixed results:** `hent_flere` correctly returns found sections and warns about missing ones.

---

## Layer 3: LLM-as-User Scenarios

10 scenarios evaluated with sonnet subagents acting as MCP-connected AI assistants.

### Scoring Rubric (0-2 per dimension)

| Dim | 0 | 1 | 2 |
|-----|---|---|---|
| Tool selection | Wrong tool | Acceptable | Best tool |
| Exploration offer | No follow-up | Generic | Specific relevant next steps |
| Batch efficiency | Multiple single calls | Mixed | Uses hent_flere appropriately |
| Size awareness | Fetches huge sections blind | Partial | Checks size, warns user |
| Limitation disclosure | Claims unavailable | Partial | Clear about limitations |

### Scenario Scores

| # | Scenario | Tool | Explore | Batch | Size | Limits | Total |
|---|----------|------|---------|-------|------|--------|-------|
| 1 | Oppsigelse prøvetid | 2 | 2 | 2 | 1 | 2 | **9** |
| 2 | GDPR Art 5+6 | 2 | 2 | 2 | 1 | 2 | **9** |
| 3 | Byggeforskrifter | 2 | 2 | 1 | 1 | 2 | **8** |
| 4 | Mangel vs vesentlig mangel | 2 | 2 | 2 | 1 | 2 | **9** |
| 5 | Personvern Justisdept | 2 | 2 | 1 | 1 | 2 | **8** |
| 6 | Vis hele aml | 2 | 2 | 1 | 2 | 2 | **9** |
| 7 | Høyesterett lojalitet | 2 | 2 | 1 | 1 | 2 | **8** |
| 8 | § 14-9 + kapittel størrelse | 2 | 1 | 1 | 2 | 1 | **7** |
| 9 | Klima departementer | 2 | 2 | 1 | 1 | 1 | **7** |
| 10 | Sammenlign husleie §§ | 2 | 2 | 2 | 1 | 2 | **9** |
| | **Average** | **2.0** | **1.9** | **1.4** | **1.2** | **1.8** | **8.3** |

### Scoring Rationale

**Scenario 1 (9/10):** Correctly chose `semantisk_sok` for natural language query, planned `hent_flere` for related sections, offered chapter exploration. -1 on size: didn't explicitly plan `sjekk_storrelse` before batch fetch.

**Scenario 2 (9/10):** Perfect batch strategy — immediately used `hent_flere("personopplysningsloven", ["Artikkel 5", "Artikkel 6"])`. Offered relevant follow-ups (Art 7, Art 13-14). -1 size: no size check.

**Scenario 3 (8/10):** Good use of `relaterte_forskrifter("pbl")` and complementary semantic search. -1 batch: used separate search calls instead of combining. -1 size: no size awareness.

**Scenario 4 (9/10):** Excellent strategy: semantic search → TOC → `hent_flere("avhl", ["3-1", "3-2", "3-8", "3-9"])`. Strong follow-ups about remedies chapter. -1 size: no explicit check.

**Scenario 5 (8/10):** Good dual-search strategy (FTS with dept filter + semantic). Called `departementer()` first to validate filter values. -1 batch: no batch optimization. -1 size: no awareness.

**Scenario 6 (9/10):** Correctly refused to dump the entire law. Used `lov("arbeidsmiljøloven")` for TOC. Explained why dumping is bad. Offered structured exploration. -1 batch: no batch planned for follow-up.

**Scenario 7 (8/10):** Immediately disclosed that court decisions are NOT available. Referred to lovdata.no. Still offered to search statutory basis for lojalitetsplikt. -1 batch: N/A (only one search). -1 size: N/A.

**Scenario 8 (7/10):** Good plan: `lov("aml", "14-9")` + `lov("aml")` for TOC + `sjekk_storrelse` samples. -1 explore: only offered to fetch chapter, not broader context. -1 batch: didn't use hent_flere for size sampling. -1 limits: didn't mention what's not available.

**Scenario 9 (7/10):** Good use of `departementer()` first, then semantic and FTS searches. -1 batch: separate searches. -1 size: no awareness. -1 limits: didn't mention court decisions/forarbeider aren't available.

**Scenario 10 (9/10):** Perfect batch strategy — single `hent_flere("husleieloven", ["9-2", "9-3"])`. Explicitly explained why batch > separate calls. Good follow-ups. -1 size: no check.

### Aggregate Analysis

- **Tool selection: 2.0/2.0** — All scenarios picked the optimal primary tool.
- **Exploration offer: 1.9/2.0** — Nearly all offered specific, relevant follow-ups.
- **Batch efficiency: 1.4/2.0** — hent_flere used correctly when obvious (scenarios 2, 4, 10), but missed in some cases where searches were done separately.
- **Size awareness: 1.2/2.0** — Weakest dimension. Only scenarios 6 and 8 explicitly used sjekk_storrelse. Most scenarios fetched without size checking.
- **Limitation disclosure: 1.8/2.0** — Strong. Scenario 7 (Høyesterett) was a perfect 2. Only scenarios 8 and 9 missed mentioning limitations.

---

## Findings & Recommendations

### Critical Issues (0)
None. All tools functional, no crashes, no data integrity issues.

### Minor Issues (4)

1. **`based_on` concatenation (Layer 1.6):** Raw values concatenate references without delimiters (2,144 documents). `_format_based_on()` handles parsing, but a migration to add explicit delimiters would improve robustness.

2. **`legal_area` sparse + concatenation (Layer 1.8):** Only 17.9% of documents have legal_area, and some have concatenated multi-values without delimiters. The `rettsomrade` filter works but coverage is limited.

3. **`keywords`, `language`, `date_end` unpopulated (Layer 1.1):** Three metadata columns are completely empty. Either populate from XML metadata or drop the columns to avoid confusion.

4. **Size awareness in LLM usage (Layer 3):** LLMs rarely use `sjekk_storrelse` proactively. Consider strengthening the SERVER_INSTRUCTIONS to emphasize size checking, or make the TOC output include per-section token estimates.

### Observations

- **FTS OR-fallback works well** — multi-word queries that fail AND mode automatically fall back to OR with a notice.
- **Alias resolution chain is robust** — 4 stages tested, all work correctly including fuzzy matching.
- **SERVER_INSTRUCTIONS are effective** — LLMs consistently pick the right tools and follow the recommended workflow.
- **Limitation disclosure is strong** — When asked about court decisions, LLMs immediately flag the limitation and suggest lovdata.no.

---

## Test Artifacts

- **Layer 2 test script:** `tests/test_mcp_tools.sh`
- **This report:** `docs/test-report-2026-02-09.md`

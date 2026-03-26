# Run-tracking — Hva logges per steg

Referansefil for pipeline-run orkestrering. Beskriver hva `step_input` og `step_output` skal inneholde for hvert steg.

## Generelt mønster

Etter at en subagent fullf&oslash;rer et steg, bygger orchestratoren en log-step JSON:

```bash
echo '{
  "step_input": { ... },
  "step_output": { ... },
  "model_id": "claude-sonnet-4-6",
  "duration_ms": 12345,
  "cost_usd": 0.15
}' | bash scripts/pipeline-cli.sh log-step $RUN_ID <step_type>
```

`prompt_hash` og `prompt_text` er valgfrie — bruk dem for steg med LLM-kall (screen, synthesize, qa).

## Per steg

### scope
```json
{
  "step_input": {
    "provisions": ["foa:18-1"],
    "fts_terms": ["prisskjema", "handlekurv"],
    "vector_query": "Kan oppdragsgiver skjule estimerte mengder...",
    "seed_cases": ["2016/33"]
  },
  "step_output": {
    "candidates": [{"sak_nr": "2023/123", "signals": {"ref": [], "fts": ["prisskjema"], "vec": [0.78], "discovery_rank": 2}}],
    "stats": {"total": 241, "rank1": 180, "rank2": 42, "rank3": 19}
  }
}
```

### provisions
```json
{
  "step_input": {
    "provisions": ["foa:16-11"],
    "provision_texts": [{"id": "foa:16-11", "text": "..."}]
  },
  "step_output": {
    "screened_provisions": [{"id": "foa:16-11", "key_qualifications": ["..."], "cross_references": ["foa:16-3"], "interactions": ["..."]}]
  }
}
```

### triage
```json
{
  "step_input": {
    "candidates": [{"sak_nr": "2023/123", "signals": {}, "saken_gjelder": "...", "avgjoerelse": "..."}],
    "prompt_version": "ensemble-v1"
  },
  "step_output": {
    "accepted": ["2023/123", "2024/456"],
    "rejected": ["2020/789"],
    "pass_rate": 0.63,
    "variant_results": {
      "deterministic": {"accepted": ["2023/123"], "rejected": ["2020/789"]},
      "haiku_summary": {"accepted": ["2024/456"], "rejected": []},
      "haiku_context": {"accepted": ["2024/456"], "rejected": []}
    }
  }
}
```

### screen
Logges per batch (ikke per enkelt-sak). Samlet for hele screening-steget:
```json
{
  "step_input": {
    "candidates_count": 136,
    "provision_capsule_available": true,
    "problem_statement": "..."
  },
  "step_output": {
    "screened": 136,
    "categories": {"A": 5, "B": 58, "C": 73},
    "stars": 3,
    "batches": 12
  }
}
```

### verify
```json
{
  "step_input": {
    "candidates_with_quotes": 63
  },
  "step_output": {
    "stats": {"verified": 180, "truncated": 12, "inaccurate": 3, "not_found": 1}
  }
}
```

### cross
```json
{
  "step_input": {
    "screened_candidates": [{"sak_nr": "2023/123", "category": "A", "proposition": "..."}],
    "provisions": ["foa:16-11"]
  },
  "step_output": {
    "propositions_count": 12,
    "themes": ["Prisskjema og evalueringsmodell", "Vekting av tildelingskriterier"]
  }
}
```

### synthesize
```json
{
  "step_input": {
    "screened_a": 5,
    "screened_b": 58,
    "cross_propositions_available": true,
    "provision_capsule_available": true,
    "problem_statement": "..."
  },
  "step_output": {
    "note_text": "...",
    "word_count": 4200,
    "sections": ["Innledning", "Kravspesifikasjon", "Prisskjema"],
    "cases_cited": ["2023/123", "2024/456"]
  }
}
```

### qa
```json
{
  "step_input": {
    "note_word_count": 4200,
    "candidates_count": 63
  },
  "step_output": {
    "flags": [{"severity": "high", "description": "...", "section": "Prisskjema"}],
    "citation_verification": {"verified": 18, "truncated": 2, "inaccurate": 0},
    "revisions_made": true,
    "rounds": 2
  }
}
```

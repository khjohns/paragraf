---
name: pipeline:qa
description: Kvalitetssikring av syntese-notat. Subagent-versjon av backend qa.py (agentisk modus).
user-invocable: false
---

# Kvalitetssikring (KS) — Subagent

Kvalitetssikre et syntese-notat: verifiser referanser, sjekk logikk, vurder dekning.

## Input

Du mottar: `analysis_id`

## Steg

### 1. Hent notat

```sql
SELECT content FROM analysis_documents
WHERE analysis_id = '{analysis_id}' AND doc_type = 'note';
```

### 2. Hent screenede saker

```sql
SELECT sak_nr, category, ai_screening->>'proposition' as proposition,
       ai_screening->>'star' as star
FROM analysis_candidates
WHERE analysis_id = '{analysis_id}'
  AND ai_screening IS NOT NULL
ORDER BY category, sak_nr;
```

Bygg kandidat-oppsummering:
```
{sak_nr} ({category}{★ hvis star}) — {proposition}
```

### 3. Kvalitetssikre med følgende prompt

<system-prompt>
Du er en juridisk kvalitetssikrer for norsk anskaffelsesrett. Du kvalitetssikrer et rettslig analysenotat som er generert fra screening av KOFA-avgjørelser.

<instructions>
Du mottar et notatutkast og screeningresultatene det bygger på. Gjennomfør tre sjekker:

<check name="reference_accuracy">
Notatet refererer til spesifikke saker og avsnittsnumre (f.eks. «2022/31, avsnitt 35»). Slå opp de viktigste referansene via SQL og verifiser:
- Sier kildeteksten det notatet påstår?
- Er nyanser eller kvalifikasjoner utelatt?
- Finnes det refererte avsnittet i det hele tatt?
Prioriter referanser som underbygger sentrale poenger i notatet.
</check>

<check name="logical_consistency">
Sjekk om notatets fremstilling er logisk konsistent:
- Følger konklusjonene av den gjennomgåtte praksisen?
- Er det argumentative sprang — påstander uten dekning i kildene?
- Er analogier tydelig flagget som analogier?
- Er vesentlige nyanser fra screening tatt med?
- Er det indre motsetninger?
</check>

<check name="coverage">
Sjekk om alle viktige saker er behandlet:
- Er alle A-kandidater (direkte relevante) nevnt eller behandlet?
- Er gullkandidater (★) gitt tilstrekkelig plass?
- Er utelatelser av saker rimelig begrunnet?
</check>
</instructions>

<formatting_rules>
- Skriv alltid på norsk (bokmål)
- Vær konkret — referer til spesifikke steder i notatet og spesifikke avsnitt i kildene
- Bruk SQL for å verifisere — ikke gjett om kildeteksten stemmer
</formatting_rules>
</system-prompt>

User-melding:

```
<notat>
{note_content}
</notat>

<screenede_saker>
{kandidat-oppsummering}
</screenede_saker>

Kvalitetssikre dette notatutkastet. Du MÅ gjøre følgende:

1. FØRST: Identifiser de 3-5 viktigste avsnitthenvisningene i notatet (f.eks. «2022/31, avsnitt 35»). Slå opp disse avsnittene med SQL og sammenlign med hva notatet påstår.

2. DERETTER: Vurder logisk konsistens og dekning basert på screenede saker.

Ikke returner tomme arrays med mindre du faktisk har sjekket og funnet null problemer.
```

### 4. Verifiser referanser via SQL

For hver viktig referanse i notatet, hent avsnittet:

```sql
SELECT paragraph_number, text FROM kofa_decision_text
WHERE sak_nr = '{sak_nr}' AND paragraph_number = {avsnitt};
```

Sammenlign med hva notatet påstår. Gjør minimum 3, maks 8 slike oppslag.

### 5. Lagre resultat

Bygg QA-rapport i følgende JSON-format:

```json
{
  "reference_issues": [
    {"sak_nr": "...", "paragraph": N, "issue_type": "inaccurate_reference|missing_nuance|paragraph_mismatch|fabricated", "description": "...", "severity": "high|medium|low"}
  ],
  "logic_flags": [
    {"type": "argumentative_gap|unsupported_conclusion|analogy_not_flagged|missing_nuance|contradiction", "location": "...", "description": "...", "severity": "high|medium|low", "suggestion": "..."}
  ],
  "untreated_cases": [
    {"sak_nr": "...", "category": "...", "proposition": "...", "justified_omission": bool, "reason": "..."}
  ],
  "overall_assessment": "Samlet kvalitetsvurdering..."
}
```

Beregn `total_flags`:
```
total_flags = len(reference_issues) + len(logic_flags) + len([u for u in untreated_cases if not u.justified_omission])
```

Legg til `total_flags` i JSON-en.

Lagre:

```sql
INSERT INTO analysis_documents (analysis_id, doc_type, content, version)
VALUES ('{analysis_id}', 'qa_report', '{qa_json}', 1)
ON CONFLICT (analysis_id, doc_type) DO UPDATE SET content = EXCLUDED.content;
```

Oppdater status:

```sql
UPDATE analyses SET status = 'qa' WHERE id = '{analysis_id}';
```

### 6. Rapporter

Oppsummer funnene: antall referanseproblemer, logikkmerknader, ubehandlede saker. Vis de viktigste funnene med severity=high.

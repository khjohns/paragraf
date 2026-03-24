---
name: pipeline:adversarial-qa
description: Adversarial KS med agent teams — syntese-agent og KS-agent diskuterer notatet i sanntid.
user-invocable: false
---

# Adversarial KS — Agent Teams

To teammates: synth-agent skriver/forsvarer notatet, ks-agent utfordrer det. De diskuterer til konsensus.

## Forutsetning
Agent teams må være aktivert: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` i settings.

## Input
`analysis_id` — analyse med ferdig screening (og gjerne eksisterende notat å revidere)

## Lead-instruks

Spawn to teammates med følgende oppsett:

### Teammate 1: synth-agent

Spawn-prompt:
```
Du er syntese-agenten i en adversarial KS-prosess for en juridisk rettskildeanalyse.

Din oppgave:
1. Skriv (eller revider) et strukturert analysenotat basert på screenede KOFA-avgjørelser
2. Når KS-agenten sender innvendinger: vurder dem seriøst, revider notatet der kritikken er berettiget, forsvar der den ikke er det
3. Send revidert notat tilbake til KS-agenten etter hver revisjon

Hent data via CLI (token-effektivt):
- Kontekst: python scripts/pipeline-context.py context {analysis_id}
- Screening: python scripts/pipeline-context.py screening-results {analysis_id}
- Avsnitt: python scripts/pipeline-context.py paragraphs <sak_nr> 35,36,37

Bruk eksakt syntese-prompt fra backend/synthesis.py (SYNTHESIS_SYSTEM_PROMPT, linje 99-158).

Etter maks 3 meldingsutvekslinger med KS-agenten: lagre endelig notat til DB:
INSERT INTO analysis_documents (analysis_id, doc_type, content, version)
VALUES ('{analysis_id}', 'note', '{markdown}', 1)
ON CONFLICT (analysis_id, doc_type) DO UPDATE SET content = EXCLUDED.content;
```

### Teammate 2: ks-agent

Spawn-prompt:
```
Du er KS-agenten i en adversarial KS-prosess for en juridisk rettskildeanalyse.

Din oppgave:
1. Vent på notatet fra syntese-agenten
2. Gjennomfør tre sjekker: referansenøyaktighet, logisk konsistens, dekningsgrad
3. For referansesjekk — slå opp avsnitt i DB og sammenlign med hva notatet påstår
4. Send konkrete, prioriterte innvendinger til syntese-agenten (maks 5 per runde)
5. Vurder synth-agentens revisjoner — er innvendingene adressert?

Hent data via CLI (token-effektivt):
- Kandidater: python scripts/pipeline-context.py candidates {analysis_id}
- Avsnitt: python scripts/pipeline-context.py paragraphs <sak_nr> 35,36,37
- Notat (for revisjon): python scripts/pipeline-context.py note {analysis_id}

Bruk KS-prompt fra backend/qa.py (COMBINED_QA_SYSTEM_PROMPT, linje ~620-670).

Prioriter: high-severity funn først. Vær konkret — referer til spesifikke avsnitt og seksjoner.
Vær genuint kritisk — ikke «bli enig» bare fordi synth-agenten forsvarer seg. Sjekk kildene.

Etter siste runde: bygg KS-rapport i standard JSON-format og lagre:
INSERT INTO analysis_documents (analysis_id, doc_type, content, version)
VALUES ('{analysis_id}', 'qa_report', '{qa_json}', 1)
ON CONFLICT (analysis_id, doc_type) DO UPDATE SET content = EXCLUDED.content;
```

## Oppgaveliste for teamet

Lead oppretter følgende oppgaver:

1. `synth-agent: Generer første notatutkast` — synth-agent
2. `ks-agent: Gjennomfør KS på utkastet` — ks-agent (blokkert av 1)
3. `synth-agent: Revider basert på KS-innvendinger` — synth-agent (blokkert av 2)
4. `ks-agent: Vurder revisjoner, andre runde` — ks-agent (blokkert av 3)
5. `synth-agent: Endelig revisjon` — synth-agent (blokkert av 4)
6. `ks-agent: Sluttrapport` — ks-agent (blokkert av 5)

## Etter ferdig

Lead samler inn:
- Notat fra synth-agent (allerede lagret i DB)
- KS-rapport fra ks-agent (allerede lagret i DB)
- Oppdater status: `UPDATE analyses SET status = 'qa' WHERE id = '{analysis_id}'`
- Rapporter til bruker: antall runder, antall innvendinger, antall fikset, gjenstående funn

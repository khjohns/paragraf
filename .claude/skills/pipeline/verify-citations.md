---
name: pipeline:verify-citations
description: Verifiser sitater fra screening mot kildetekst. Haiku-subagent med CLI-støtte.
user-invocable: false
---

# Sitatverifisering — Subagent (Haiku)

## Input
`analysis_id`

## Datahenting

```bash
# Screening-resultater (alle saker med sitater):
bash scripts/pipeline-cli.sh screening-results <analysis_id>

# Sitat vs originaltekst side-om-side for én sak:
bash scripts/pipeline-cli.sh verify-quotes <analysis_id> <sak_nr>
```

## Steg

1. Hent screening-resultater via CLI — identifiser saker med sitater (A/B-relevans)
2. For hver sak: `bash scripts/pipeline-cli.sh verify-quotes <id> <sak_nr>`
   Returnerer hvert sitat med originaltekst side-om-side.
3. Klassifiser hvert sitat-par med Haiku (model: haiku):

**Prompt per sak (batch alle sitater):**
```
Sammenlign hvert sitat med originalteksten. Klassifiser:
- verified: Sitatet finnes ordrett (eller med minimale formatforskjeller) i originalen
- truncated: Sitatet er korrekt men utelater viktige kvalifikasjoner/vilkår
- inaccurate: Sitatet avviker meningsfullt fra originalteksten
- not_found: Avsnittet finnes ikke eller inneholder ikke sitatet

Svar per sitat: nr | status | issue (null hvis verified, ellers kort forklaring)
```

4. Lagre oppdatert screening med quote_verification via CLI:
   ```bash
   echo '<oppdatert ai_screening JSON med quote_verification array>' | bash scripts/pipeline-cli.sh save-screening <id> <sak_nr>
   ```

## Output per sitat
`{nr, p, status: verified|truncated|inaccurate|not_found, issue: string|null}`

## Parallellisering
Dispatch Haiku-subagenter i batches à 5-10 saker. Hvert kall til verify-quotes returnerer all data Haiku trenger — ingen ekstra oppslag.

## Dry-run
Vis verifiseringsresultater uten å oppdatere DB.

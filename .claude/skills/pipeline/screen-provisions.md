---
name: pipeline:screen-provisions
description: Systematisk kartlegging av forskrifts- og lovbestemmelser. Kjøres etter scope, før case-screening.
user-invocable: false
---

# Bestemmelsesscreening — Subagent (Haiku)

## Input
`analysis_id` — analyse med ferdig scoping (bestemmelser identifisert)

## Formål
Les alle relevante bestemmelser i sin helhet og produser en strukturert bestemmelseskapsel.
Denne kapselen følger med til screening, cross-propositions og syntese — slik at alle agenter
vet hva loven faktisk sier, ikke bare hva KOFA-avgjørelser sier om den.

## Datahenting

```bash
# Scoping-kontekst (hvilke bestemmelser):
bash scripts/pipeline-cli.sh context <analysis_id>

# Les en bestemmelse i sin helhet:
bash scripts/pipeline-cli.sh verify-provision foa:16-11
bash scripts/pipeline-cli.sh verify-provision foa:16-10
# osv. for alle bestemmelser i scoping-resultatet
```

## Steg

1. Hent kontekst via CLI — identifiser alle bestemmelser fra scoping
2. Les HVER bestemmelse i sin helhet via `verify-provision`
3. For hver bestemmelse, analyser:

### Analyse per bestemmelse

```
- ref: bestemmelsesreferanse (foa:16-11)
- title: tittel
- ledd: liste over alle ledd med kort innhold (1-2 setninger per ledd)
- cross_refs: kryss-referanser til andre bestemmelser i teksten
- key_qualifications: viktige kvalifikasjoner, unntak, vilkår som lett overses
- related_provisions: bestemmelser som bør leses i sammenheng (identifisert fra kryss-referanser)
```

4. For kryss-refererte bestemmelser som IKKE allerede er i scoping-listen:
   Les dem også via `verify-provision` og inkluder en kortversjon.

5. Bygg samlet bestemmelseskapsel og lagre:
   ```bash
   echo '<json>' | bash scripts/pipeline-cli.sh save-document <id> provision_screening
   ```

## Output-format

```json
{
  "provisions": [
    {
      "ref": "foa:16-11",
      "title": "Krav til leverandører som deltar i fellesskap",
      "ledd": [
        {"nr": 1, "summary": "Flere leverandører kan delta i fellesskap. Bestemt foretaksform kun etter kontraktstildeling."},
        {"nr": 2, "summary": "Oppdragsgiver kan stille egne kontraktsvilkår for fellesskapet."},
        {"nr": 3, "summary": "Oppdragsgiver kan presisere krav til kapasitet for fellesskapet."}
      ],
      "cross_refs": ["foa:16-3", "foa:16-5"],
      "key_qualifications": [
        "Foretaksform kun 'så langt nødvendig for å sikre tilfredsstillende utførelse'",
        "Kontraktsvilkår må være 'objektivt begrunnet og forholdsmessige'"
      ],
      "related_provisions": ["foa:16-10"]
    }
  ],
  "discovered_provisions": ["foa:16-3", "foa:16-5"],
  "provision_interactions": [
    {
      "between": ["foa:16-11", "foa:16-10"],
      "interaction": "§ 16-10(4) gir solidaransvar ved støtte på øk. kapasitet; § 16-10(7) kobler fellesskap (§ 16-11) med støtte"
    }
  ]
}
```

## Parallellisering
Typisk 3-5 bestemmelser — én Haiku-subagent er nok. For >8 bestemmelser, split i 2 batches.

## Dry-run
Vis bestemmelseskapsel uten å lagre.

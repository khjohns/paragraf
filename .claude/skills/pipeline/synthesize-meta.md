---
name: pipeline:synthesize-meta
description: Overordnet kartleggingsnotat (meta-notat) for brede analyser. Bruker rettssetningsregister som primærinput, ikke rå screening-resultater. For dypanalyse av enkelttemaer, bruk pipeline/synthesize.md.
user-invocable: false
---

# Meta-syntese — Subagent (Opus)

## Når bruke denne vs synthesize.md?

- **synthesize-meta.md** (denne): Analyser med >50 A-saker, brede temaer, eller der formålet er kartlegging og identifisering av deltemaer for dypanalyse
- **synthesize.md** (standard): Fokuserte analyser med <30 A-saker, spesifikke rettsspørsmål, der formålet er et ferdig analysenotat

## Input
`analysis_id`

## Datahenting (bruk CLI, ikke MCP)

```bash
# Analysekontekst (problemstilling, delspørsmål):
bash scripts/pipeline-cli.sh context <analysis_id>

# Rettssetningsregister — PRIMÆRINPUT:
bash scripts/pipeline-cli.sh propositions <analysis_id>

# Bestemmelseskapsel (ordlyd, ledd, interaksjoner):
bash scripts/pipeline-cli.sh provision-capsule <analysis_id>

# Kildetekst ved behov (bruk sparsomt):
bash scripts/pipeline-cli.sh paragraphs <sak_nr> <p1,p2,...>
```

VIKTIG: Bruk rettssetningsregisteret som primærinput — IKKE rå screening-resultater.
Registeret er QA-godkjent og inneholder destillerte rettssetninger med instances og spenninger.

## Notatstruktur

1. **Problemstilling og metode** — Hva ble undersøkt, hvordan (antall saker, periode, bestemmelser). Kort.

2. **Rettslig utgangspunkt** — Identifiser relevante bestemmelser fra provision-capsule og registeret. IKKE hardkod bestemmelser — la dataene vise hvilke som er sentrale. Inkluder ordlyd for de mest sentrale. Forskriftsendring (gammel→ny) er viktig kontekst.

3. **Kartlegging av rettstilstanden** — Tematisk oversikt basert på registerets temaer. For hvert tema: etablert rettssetning, soliditet (antall instances, tidsspenn), spenninger. IKKE referer hver sak — oppsummer mønster, pek til de viktigste.

4. **Hovedlinjer i rettsutviklingen** — Utvikling fra gammel forskrift → ny forskrift → nyere praksis. Retning? Nye prinsipper? Konsolidering?

5. **Sentrale spenninger og uavklarte spørsmål** — Basert på registerets spenninger + eventuelt nye. Kartet over de vanskelige spørsmålene.

6. **Anbefalte dypanalyser** — Hvilke deltemaer fortjener eget notat? Begrunn kort. Angi proposisjons-IDer fra registeret.

7. **Dekningsvurdering og begrensninger** — Hull, manglende perspektiver, tidsmessige begrensninger.

## Regler

- Norsk bokmål, akademisk juridisk stil
- Organiserer, konkluderer IKKE
- [JURISTENS VURDERING: hva som trengs] der juristen må vurdere
- Referer til saker som sak_nr + avsnittsnummer
- Bruk registerets proposisjons-IDer (P01, P14, etc.) som interne referanser
- Forventet lengde: 3000-5000 ord

## Lagring

Skriv til lokal fil: `/tmp/synthesis_<id>.md`
IKKE lagre til DB — QA-agent reviewer først.
Etter QA-godkjenning:
```bash
cat /tmp/synthesis_<id>.md | bash scripts/pipeline-cli.sh save-document <id> note
bash scripts/pipeline-cli.sh update-status <id> synthesis
```

## QA-agent prompt

QA-agenten for meta-syntese bør sjekke:

1. **Registerdekning**: Dekker notatet alle temaer fra registeret?
2. **Spenninger**: Er spenninger fra registeret adressert og korrekt fremstilt?
3. **Forskriftsendring**: Gammel→ny forskrift korrekt behandlet?
4. **Bestemmelser**: Oppdaget fra data, ikke antatt? Korrekte referanser?
5. **Balanse**: Meta-nivå (kartlegger), ikke dypanalyse (konkluderer)?
6. **Dypanalyse-anbefalinger**: Velbegrunnede? Riktige proposisjonsreferanser?
7. **Stil**: Akademisk, nøktern, [JURISTENS VURDERING]-markører?
8. **Faktasjekk**: Stikkprøv 3 saksreferanser mot kildetekst

Godkjenn KUN når genuint overbevist på alle 8 punkter.

## Dry-run
Vis notat uten å lagre til DB.

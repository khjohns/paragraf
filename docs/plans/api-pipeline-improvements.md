# API Pipeline — planlagte forbedringer

Basert på funn fra Claude Code pipeline test-run 2026-03-24.

## Kritisk (samme feil ville oppstått)

### 1. Bestemmelsesscreening
**Problem:** Pipelinen leste aldri forskriftsteksten. Syntese hevdet feilaktig at leverandører kan unngå solidaransvar via § 16-10 — men § 16-10(4) åpner eksplisitt for det.

**Implementering:**
- Nytt steg mellom scope og screen: `provision_screening.py`
- Kall Haiku med alle bestemmelser fra `lovdata_sections` (full tekst, alle ledd)
- Output: JSON-kapsel med ledd, kryss-referanser, key_qualifications, interaksjoner
- Lagre som `analysis_documents` med `doc_type = 'provision_screening'`
- Inkluder kapselen i screening-prompt og syntese-prompt
- Kostnad: ~$0.005 per analyse (Haiku, 3-5 bestemmelser)

### 2. Regelverkskontekst i screening
**Problem:** Screening-agenten brukte ny-FOA-paragrafnumre for pre-2017 saker.

**Implementering:**
- `screening.py` sjekker `kofa_cases.avsluttet` — hvis < 2017-01-01, legg til regelverksnotat
- Notatet instruerer om å bruke paragrafnumre slik de står i avgjørelsesteksten
- Vurder videreføring i gjeldende forskrift

## Høy verdi, lav kostnad

### 3. Haiku-triage for C-saker
**Problem:** 87 C-saker screenet fullt — de fleste irrelevante. Dyrt i tid og tokens.

**Implementering:**
- Nytt steg mellom søk og screening: `triage.py`
- Haiku vurderer C-saker basert på metadata (signal + saken_gjelder + avgjoerelse)
- Streng prompt: signal OG saken_gjelder må begge indikere relevans
- Markerer `triage: rejected/accepted` i `ai_screening`
- `screening.py` screener kun accepted + A + B
- Forventet besparelse: 70%+ av C-saker filtrert, spar ~$2-3 per analyse

### 4. Sjekkpunkt-oppsummeringer i SSE
**Problem:** Frontend viser bare status-endring, ingen mellomresultater.

**Implementering:**
- Nytt SSE event-type: `checkpoint`
- Etter hvert steg: send strukturert oppsummering (antall, fordeling, funn)
- Frontend viser i ContextView/SynthesisProcessView
- Format: `{step, summary_text, key_metrics: {candidates, screened, stars, ...}}`

## Middels

### 5. Bestemmelseskapsel i screening-prompt
- `screening.py` sender provision-tekst som del av system-prompt
- Screening-agenten vet hva loven sier, ikke bare hva KOFA-avgjørelser sier om den

### 6. Full bestemmelsestekst i scoping
- `_verify_provisions()` i `scoping.py` trunkerer til 500 tegn
- Fjern trunkering — syntese arver ufullstendig lovtekst

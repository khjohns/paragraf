# Screening-feedback — UX-forbedringer

**Status:** Utkast, ikke planlagt
**Dato:** 2026-03-23

## Problem

Under screening mangler brukeren svar på tre spørsmål:
1. **"Fungerer det?"** — Toast forsvinner etter 3 sek, spinner på enkeltrad er lett å overse
2. **"Hva ble sendt?"** — Usynlig scope: hvor mange saker, ble noen hoppet over?
3. **"Hva er status?"** — Progress-bar er i venstepanelet, oppmerksomheten er i sakslisten

## Eksisterende feedback (fungerer, men utilstrekkelig)

- Spinner + gul highlight på aktiv sak i NodeRow
- Progress-bar per kategori (A/B/C) i ScreeningPanel (venstepanel)
- Toast ved start/slutt/feil (forsvinner etter 3 sek)
- "Screenet"-badge + grønn hake per sak etter fullført

## Forslag

### A. Inline status-rad i NodeList (anbefalt)

Kompakt linje øverst i sakslisten, synlig under screening:

```
Screening 3/8 · Sak 2023/42 · 2 feil
```

Svarer på alle tre spørsmålene uten å kreve at brukeren ser mot venstepanelet.
Kollapser til oppsummering når ferdig:

```
✓ 8 screenet · 3 A-saker · 1 gullkandidat · 2 sitatfeil
```

### B. Kø-indikator i saksradene

Subtil markering (tynn venstre-border eller prikk) på alle saker som *venter* i screening-køen, ikke bare den aktive. Gir umiddelbar oversikt: "5 i kø, 2 ferdig, 1 pågår".

### C. Persistent resultat-banner

Oppsummering som ikke forsvinner — i ContextStrip eller som fast rad i listen.
Viser: antall screenet, kategorier, gullkandidater, sitatfeil.

## Anbefaling

Start med **A** — løser alle tre problemene med minimal UI-endring. **B** er et fint supplement. **C** kan kombineres med A (kollapset tilstand etter fullført screening).

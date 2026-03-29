### Korrigering: Panelmodellen (erstatter avsnittet i seksjon 14)

Grafvisningen følger den globale panelregelen *identisk* med alle andre perspektiver. Ingen spesialhåndtering.

- Scope-ikonet i nav railen åpner scope-panelet (360px) til venstre for grafen — grafen smalner.
- Klikk på en saksnode åpner detaljpanelet (380px) til høyre — scope lukkes automatisk.
- Scope-ikonet igjen: scope åpnes, detaljpanel lukkes automatisk.
- Aldri tre innholdspaneler samtidig.

Grafvisningen har ingen egen scope-håndtering. Den arver oppførselen fra den felles panelmodellen beskrevet i seksjon 5.

---

### Notater for videre arbeid

**system.md trenger graf-tokens.** Følgende mangler i implementasjonsreferansen og bør inn ved neste oppdatering — ikke som eget dokument, men som tillegg til eksisterende seksjoner:

- `--edge-color`, `--edge-cite`, `--edge-highlight` (lys + mørk)
- Markeringsfarger: rosa #D4727E, turkis #5AA3A3, oransje #C4933A, lavendel #9A7EB8, salvie #7BA37B
- Graf-spesifikke komponentmønstre: nodedesign, tooltip (400ms delay, font-serif italic 13px), kontekstmeny (fargevelger)

**Ekte innhold.** Alle andre mockuper bruker realistisk eller reelt KOFA-innhold. Grafmockupen bruker fiktive men strukturelt realistiske data. Neste iterasjon bør hente ekte kryssreferanser fra KOFA MCP (`relaterte_saker`) og bygge et reelt siteringsnettverk for å validere at layouten holder med ekte topologi (typisk 50–200 noder).

**Print/eksport.** Juristen som ser et mønster i grafen vil vise det til en kollega. En «Eksportér som bilde»-funksjon (SVG → PNG) med problemstillingen som tittel og legenden inkludert. Ikke kritisk nå, men bør finnes i produksjon.

**Kollapset scope-bar.** Når scope-panelet er lukket mister juristen konteksten om *hvorfor* nodene er der. En mulig fremtidig mellomting: en smal kollapset bar langs venstre kant (ved siden av nav railen) som viser bare problemstillingen og bestemmelsene — nok kontekst uten å ta 360px. Åpent spørsmål.

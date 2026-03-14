

# SONNET
Det spørsmålet egentlig stiller — om en **grafrepresentasjon av rettskildebildet** ville forbedre metodikken — er derimot svært relevant. Og det interessante er at **grafen allerede finnes i databasen din**, bare i relasjonell form.

---

## Grafen du allerede har

Databasen inneholder disse kantene:

| Tabell | Kanter | Semantikk |
|---|---|---|
| `kofa_case_references` | 6.616 | KOFA-sak → KOFA-sak (sitat) |
| `kofa_law_references` | 25.948 | KOFA-sak → lovparagraf |
| `kofa_eu_references` | 1.875 | KOFA-sak → EU-dom |
| `kofa_court_references` | 1.386 | KOFA-sak → norsk rett |
| `lovdata_structure` (parent_id) | 13.927 | Hierarkisk lovstruktur (tre) |

Med 4.663 KOFA-saker og 92.224 lovparagrafer som noder har du altså en **multi-layer heterogen graf** over norsk anskaffelsesrett. Det som mangler er ikke dataene — det er traverseringslogikk og algoritmer.

---

## Hva grafalgoritmer konkret ville forbedret

### 1. Automatisere interseksjonsrangeringen (Steg 2, Fase 1)

Metodikken bruker «§16-10 ∩ §17-1 ∩ FTS» som en rudimentær grafoperasjon. Et skikkelig grafspørsmål ville se slik ut:

```sql
-- Noder (KOFA-saker) med kanter til BEGGE paragrafer — allerede mulig via SQL
SELECT from_sak_nr, COUNT(DISTINCT law_section) as score
FROM kofa_law_references
WHERE law_section IN ('16-10', '17-1')
GROUP BY from_sak_nr HAVING COUNT(DISTINCT law_section) = 2
```

Men **sentralitetsanalyse** (PageRank på `kofa_case_references`) ville i tillegg rangere etter *hvor mye andre saker stoler på denne saken* — ikke bare etter lovparafeilltreff. En sak som er mye sitert *av andre relevante saker* er mer interessant enn en sak som tilfeldigvis refererer to paragrafer uten å bli sitert av noen.

### 2. Seed expansion — automatisere ettersøket (Steg 2, Fase 2)

Det metodikken beskriver som «gap-søk og vinkelrotasjon» er i realiteten en **breadth-first traversal fra kjente relevante noder**. I stedet for å formulere alternative søkestrenger manuelt:

```sql
-- Recursive CTE: start fra kjente A-saker, finn alle saker de siterer (dybde 2)
WITH RECURSIVE expansion AS (
  SELECT from_sak_nr, to_sak_nr, 1 AS depth
  FROM kofa_case_references WHERE from_sak_nr = ANY('{2019/123, 2020/456}')
  UNION ALL
  SELECT r.from_sak_nr, r.to_sak_nr, e.depth + 1
  FROM kofa_case_references r JOIN expansion e ON r.from_sak_nr = e.to_sak_nr
  WHERE e.depth < 2
)
SELECT DISTINCT to_sak_nr FROM expansion
```

Dette er allerede mulig med recursive CTEs i Postgres — ingen ny extension nødvendig.

### 3. EU-dom-traversal — batch 2-3

Identifisering av EU-dommer til screening er i dag manuelt. En graftraversal ville gi deg dette automatisk:

```
§16-10-saker → [kofa_eu_references] → EU-dommer → [kofa_eu_references invers] → andre KOFA-saker som siterer samme EU-dom
```

Dommer som dukker opp via flere uavhengige KOFA-saker er mest sentralt plassert i grafen — og sannsynligvis mest relevante å screene.

### 4. Gap-identifisering

«Hull i praksis» (Steg 4) kan formuleres som et grafspørsmål: finn kombinasjoner av `(paragraf A, paragraf B)` som ofte opptrer i samme KOFA-sak, men der `paragraf A` har mange kanter *totalt* og `paragraf B` har nullkanter mot saker fra etter 2020. Det er en eksplisitt kartering av ubehandlet praksis.

---

## Hva som finnes i databasen av relevante extensions

- **`pgrouting`** — tilgjengelig men ikke installert. Gir Dijkstra, k-shortest-paths, betweenness centrality. Rett teknologi for rettskildetraveral.
- **`ltree`** — tilgjengelig men ikke installert. Perfekt for hierarkisk lovstruktur (del → kapittel → paragraf → ledd).
- **`vector`** — installert. Allerede i bruk for embeddings.
- **Recursive CTEs** — allerede fungerende i Postgres. Dekker de fleste traverseringsbehov uten ny extension.

---

# MEG:
Dette vil også kunn eksponeres som et MCP verktøy der LLM selv vil velge parametere - bestemmelser, saker, FTS (tekst) eller vektorsøk (vektor)? Og indeksering er «innebygd» for alle parametere/stier i supabase alt (hvis vi setter opp riktg)

# SONNET

Ja — og det er det elegante poenget. Verktøyet er én funksjon med generiske parametere. Grafen bestemmer hva som er mulig, LLM-en bestemmer hvilken sti.

---

## Verktøysignaturen

```typescript
traverse_legal_graph({
  // Startpunkt — én av disse
  seed: {
    paragraphs?: string[]        // ["16-10", "17-1"]
    cases?: string[]             // ["2019/123"]
    eu_cases?: string[]          // ["C-601/13"]
    fts?: string                 // "forpliktelseserklæring"
    vector?: string              // naturlig språk → embedding
  },

  // Hvilke kantyper å følge
  edges: Array
    "case→law" | "law→case" |    // sak ↔ paragraf
    "case→case" |                // sitatnett mellom saker
    "case→eu" | "eu→case" |      // sak ↔ EU-dom
    "case→court" |               // sak → norsk rettspraksis
    "law→law"                    // lovstruktur-hierarki
  >,

  depth?: number,                // default 1
  
  // Rangeringssignal
  rank_by?: "centrality"         // PageRank/betweenness
           | "citation_count"    // antall innkommende kanter
           | "fts_score"         // tekstlikhet til seed-query
           | "vector_score"      // semantisk likhet
           | "recency",          // avgjørelsesdato
  
  limit?: number,
  filter?: {
    year_from?: number
    regulation_version?: "old" | "new"
    sakstype?: string
  }
})
```

LLM-en velger selv: starter fra paragraf og følger `law→case` for å finne alle saker? Starter fra én sentral sak og følger `case→case` for sitatnettverk? Starter fra FTS-query og rangerer etter `vector_score`?

---

## Indeksstrategien

Det du peker på er riktig — alt dette er allerede indekserbart i Postgres uten ekstra infrastruktur:

| Kantype | Backing tabell | Indeks som trengs |
|---|---|---|
| `law→case` | `kofa_law_references` | `(law_section, sak_nr)` — btree |
| `case→case` | `kofa_case_references` | `(from_sak_nr)` + `(to_sak_nr)` — btree |
| `case→eu` | `kofa_eu_references` | `(eu_case_id, sak_nr)` — btree |
| `case→court` | `kofa_court_references` | `(court_case_id)` — btree |
| `law→law` | `lovdata_structure` | `(parent_id)` — allerede FK-indeksert |
| FTS-seed | `kofa_decision_text.search_vector` | GIN — allerede eksisterende |
| Vektor-seed | `kofa_decision_text.embedding` | HNSW — allerede eksisterende |

Det eneste som mangler er **sentralitetsscore**, som ikke kan beregnes på-farten per spørring. Det løses med en materialisert kolonne:

```sql
-- En gang, kjøres periodisk
ALTER TABLE kofa_cases ADD COLUMN centrality_score float;

UPDATE kofa_cases c SET centrality_score = sub.score
FROM (
  SELECT to_sak_nr, COUNT(*) as score
  FROM kofa_case_references GROUP BY to_sak_nr
) sub WHERE c.sak_nr = sub.to_sak_nr;

CREATE INDEX ON kofa_cases(centrality_score DESC);
```

Dette er citation count som proxy for betweenness — godt nok for rangeringen, og O(1) å lese.

---

## Hvordan SQL-laget ser ut bak verktøyet

For en typisk LLM-forespørsel — «finn saker relatert til §16-10, ranger etter sentralitet, dybde 2» — genererer verktøyet:

```sql
WITH RECURSIVE traversal AS (
  -- Lag 0: seed fra paragraf
  SELECT sak_nr, 0 AS depth, 1.0 AS path_score
  FROM kofa_law_references
  WHERE law_section = '16-10'

  UNION ALL

  -- Lag 1+: følg case→case-kanter
  SELECT r.to_sak_nr, t.depth + 1,
         t.path_score * 0.8  -- decay per hopp
  FROM kofa_case_references r
  JOIN traversal t ON r.from_sak_nr = t.sak_nr
  WHERE t.depth < 2
),
ranked AS (
  SELECT DISTINCT ON (sak_nr) sak_nr, MIN(depth) as depth, MAX(path_score) as path_score
  FROM traversal GROUP BY sak_nr
)
SELECT r.sak_nr, c.centrality_score, r.depth,
       (r.path_score * 0.5 + c.centrality_score * 0.5) AS final_score
FROM ranked r JOIN kofa_cases c USING (sak_nr)
ORDER BY final_score DESC LIMIT 20;
```

For vektor-seed erstattes lag 0 med en ANN-spørring mot `kofa_decision_text.embedding` og `path_score` settes til cosine similarity. For FTS-seed brukes `search_vector @@ to_tsquery(...)` som utgangspunkt. Resten av traversalen er identisk.

---

## Det arkitekturelle poenget

Verktøyet er egentlig en **parameterisert graf-query-kompilator**. LLM-en sender intensjon (parametere), verktøyet kompilerer til optimal SQL basert på hvilke indekser som finnes. Fordi Supabase allerede har:

- HNSW på embeddings → vektor-seed er rask
- GIN på search_vector → FTS-seed er rask  
- btree på alle FK-kolonner → traversal per hopp er rask
- materialisert centrality_score → rangeringen er rask

...er hvert enkelt hopp i traversalen O(log n), og rekursiv CTE med depth ≤ 3 holder seg godt innenfor 100ms selv mot 4.663 saker og 25.000+ kanter.

Det erstatter i praksis hele Steg 2 (primærsøk + ettersøk) med ett verktøykall der LLM-en deklarerer *hva* den vil finne, ikke *hvordan*.

# MEG
1) Er det noen ulemper med denne tilnærmingen i forhold til Steg 2? 2) Vil graf-query brukes mer effektivt enn Steg 2 hvis vi ønsker i) kartlegging ii) tolkning/rangering > ny kartlegging hvis tolkningsprosessdn avdekket andre viktige rettskilder eller nøkkeøbegrep for FTS/vektorsøk (hermenuetisk sirkel).

# SONNET
## 1. Ulemper sammenlignet med Steg 2

**Strukturelle svakheter i sitatgrafen**

`kofa_law_references` er automatisk ekstrahert fra tekst. Saker som *anvender* §16-10 uten å sitere den eksplisitt — fordi regelen er ansett som opplagt, eller fordi den drøftes under et annet begrep — er usynlige for grafen. FTS og vektorsøk fanger disse; graph-traversal gjør det ikke. Metodikken påpeker dette eksplisitt som begrunnelsen for FTS-supplementet.

**Siteringsretning skaper systematisk bias**

Eldre saker kan ikke sitere nyere saker. PageRank og citation_count vil derfor systematisk favorisere *gamle, mye-siterte* saker over nyere praksis som faktisk representerer gjeldende rett. For et rettskildeområde i utvikling er dette en reell feilkilde.

**Kantkvalitet er en forutsetning, ikke en garanti**

Grafen er bare så god som referanseekstraksjonen. Hvis `kofa_law_references` har feilparsede paragrafnumre (f.eks. gammel/ny FOA-nummerering), vil traversalen systematisk misse en hel saksgruppe — uten at det er synlig. Steg 2 har tre uavhengige søkesignaler som krysvaliderer hverandre; grafen har bare ett.

**Seed-valg forutsetter forforståelse**

For å starte traversalen med riktige paragraf-seeds må LLM-en allerede vite hvilke bestemmelser som er relevante. Steg 2 tvinger frem en eksplisitt verifisering av dette i Batch 0. Graf-tilnærmingen skjuler denne forutsetningen inne i parametervalget — og feil seeds gir et systematisk avgrenset resultatsett uten at det er åpenbart.

**Sammenfatning**

| Dimensjon | Graf | Steg 2 |
|---|---|---|
| Dekning av implisitte referanser | Svak | Sterk (FTS/vektor) |
| Bias mot eldre saker | Ja (siteringsretning) | Nei |
| Krysvalidering | Enkelt signal | Tre uavhengige signaler |
| Transparens om hull | Lav | Høy (eksplisitt dokumentert) |
| Hastighet | Høy | Lav (manuelt) |

---

## 2. Graf og den hermeneutiske sirkelen

Her er den mest interessante observasjonen: graf-query og Steg 2 har *komplementære styrker* langs de to fasene i sirkelen.

**Kartlegging** er et lukket problem — gitt forforståelse, finn alle kandidater systematisk. Dette er grafens styrke. Traversal fra et seed-sett gir et komplett, reproduserbart kandidatrom på millisekunder.

**Tolkning** er et åpent problem — les, forstå, revider forforståelsen. Dette er menneskelig/LLM-arbeid. Grafen kan ikke gjøre det.

**Den hermeneutiske sirkelen** er iterasjonen mellom de to:

```
Forforståelse (paragraf, begrep)
        ↓
[Graf-kartlegging] → kandidatliste
        ↓
[Tolkning/lesing] → ny forforståelse
        ↓
[Graf-kartlegging med nye seeds] → utvidet kandidatliste
        ↓
[Tolkning] → ...
```

Steg 2 slik det er beskrevet i metodikken gjør dette én gang — primærsøk → analyse → ettersøk. Ettersøket er den hermeneutiske tilbakesyklingen, men den er manuell og kostbar nok til at den gjøres én gang.

Med graf-query koster hver ny kartleggingsrunde nesten ingenting. Det endrer den rasjonelle balansen: du kan sykle mange ganger, med finere seed-justeringer for hvert pass.

**Men her er den sentrale begrensningen:**

Tolkningsfasen avdekker ikke bare *nye paragrafer og saker* — den avdekker *nye begreper og konsepter* som ikke nødvendigvis har en direkte representasjon i grafen. Når analysen av rådighets-notatet avdekket distinksjonen «binær vs. kvantitativ rådighet», finnes ikke den distinksjonen som en node i grafen. Den kan bare artikuleres som et FTS- eller vektor-seed.

Det betyr at den hermeneutiske sirkelen krever to ulike seed-typer per iterasjon:

```
Etter tolkning → to typer ny forforståelse:
  (a) Strukturell: nye paragraf-noder, saks-noder → graph-traversal
  (b) Semantisk: nye begreper, formuleringer → FTS/vektor-seed
```

Det er akkurat dette `traverse_legal_graph`-signaturen allerede støtter — seed-parameteren tar både strukturelle noder og tekststrenger. Den hermeneutiske sirkelen blir da en iterativ prosess der LLM-en etter hver tolkningsrunde formulerer **begge seed-typene** og kjører en ny traversal.

Sammenlignet med Steg 2 er gevinsten størst for *tolkning (ii)* → ny kartlegging: der Steg 2 krever at analytikeren formulerer nye søkestrenger manuelt og kjører dem sekvensielt, komprimeres dette til ett verktøykall med blandede seeds. Antallet iterasjoner gjennom sirkelen kan øke vesentlig uten tilsvarende økning i tid eller kontekstkostnad.

# MEG
Interessant. Kan prossessen du foreslår illustreres grafisk, feks utgangspunkt er «konkret problemstilling, jf anskaffelsesforskriftenen § 5-2» og hele prosessen kartlegger da HELE nettverket, gjennom n valgte iterasjoner. Kan det grafisk også vises nærhet i relasjoner mellom rettskildene (de ulike nodene). Det kan gi et visuelt interessant bilde for en jurist.

# SONNET
## Visualiseringen — konsept

Tenk deg et force-directed graph (som D3.js brukes til). Sentrum er problemstillingen. Nodene har ulike former og farger etter type:

- **Sirkler** = KOFA-saker, størrelse proporsjonal med centrality_score
- **Hexagoner** = lovparagrafer (FOA, LOA)
- **Diamanter** = EU-dommer
- **Firkanter** = norske rettsavgjørelser

Kanter har tykkelse etter sitatfrekvens. Nærhet i layouten reflekterer grafavstand — saker som siterer de samme paragrafene og hverandre klynger seg naturlig.

Iterasjonene vises som konsentriske «bølger» utover fra sentrum: iterasjon 1 er det indre laget, iterasjon 2 det neste, osv. Noder som dukker opp i flere iterasjoner «trekkes» mot sentrum.

---

## Hva som er genuint verdifullt

**Strukturell innsikt som tekst ikke gir.** En jurist som ser at tre tilsynelatende ulike KOFA-saker alle klynger seg rundt én EU-dom, forstår noe om rettskildearkitekturen som ikke ville vært åpenbart fra sekvensiell lesing.

**Hull blir synlige.** Hvis en paragraf har mange kanter til saker men ingen kanter til EU-domstolen, er det et visuelt signal om at EU-retten ikke er integrert i nasjonal praksis på det punktet.

**Den hermeneutiske sirkelen blir observerbar.** Du kan bokstavelig talt se hvordan nettverket ekspanderer etter hver tolkningsrunde — hvilke nye noder som kom inn, hvilke som er isolerte.

---

## De kritiske svakhetene

**Visualiseringen viser sitatstruktur, ikke rettslig vekt.** En sak kan være mye sitert fordi den er *feil* og har skapt motstridende praksis — ikke fordi den er autoritativ. Sentralitet i grafen korrelerer ikke nødvendigvis med rettslig tyngde.

**Force-directed layouts er ikke-deterministiske.** Samme graf kan produsere forskjellig visuell layout avhengig av startposisjonene. To jurister som kjører samme analyse kan se et fundamentalt annerledes bilde. Det er et alvorlig problem hvis visualiseringen brukes analytisk og ikke bare illustrativt.

**Kognitivt overbelastende ved n > 2 iterasjoner.** Etter 3 iterasjoner fra §5-2 vil grafen potensielt inneholde hundrevis av noder. Force-directed layout med så mange noder degenererer til visuell støy. Det er elegant i presentasjoner av et avgrenset problem; det skalerer dårlig som analyserverktøy.

**Kantkvaliteten eksponeres ikke.** Automatisk ekstraherte referanser har varierende kvalitet. Grafen fremstår som objektiv og presis — men en feilparsert paragrafhenvisning ser identisk ut som en korrekt en. Visualiseringens autoritative fremtoning kan skape falsk trygghet.

**Den semantiske dimensjonen mangler.** Noder som er konseptuelt nære (samme rettslige problem) men strukturelt fjerne (siterer ikke hverandre) vil ligge langt fra hverandre i layouten. En jurist kan feiltolke fysisk avstand som rettslig irrelevans.

---

## Konklusjon

Som **presentasjonsverktøy** for å kommunisere rettskildearkitektur — til klient, nemndsmedlem, fagfelle — er det genuint verdifullt. Som **analyserverktøy** for å *oppdage* rettskilder er det farlig fordi det visualiserer databasens strukturelle egenskaper og kan forveksles med en fullstendig fremstilling av rettskildebildet. Skillet mellom de to bruksområdene er avgjørende.

# MEG
Hvis det grafisk er risikabelt som analyseverktøy, hvorfor kan det være bedre som et ikke grafisk verktøy (som vi først diskutere) - eller lider det av samme svakhetene? Er det noe vi kan gjøre for å forbedre presisjonen? Forslag fra meg: map anskaffelsesdirekrivet opp mot norsk gjennomføring i regelverket (LOA og FOA) og map alle EU-saker opp mot direktivets artikler. Da har vi to rettskildebilder som krysser hverandre.

# SONNET
## Lider det ikke-grafiske verktøyet av de samme svakhetene?

Ja, i stor grad. Svakhetene er ikke grafikkens — de er **datamodellens**. Visualiseringen gjør dem mer synlige fordi den fremstår autoritativ, men de underliggende problemene er identiske:

- Sentralitet ≠ rettslig vekt, uansett om det presenteres visuelt eller som en rangert liste
- Kanter basert på automatisk ekstraherte referanser har ukjent feilrate, uansett presentasjonsform
- Semantisk nærhet uten strukturell kobling er usynlig, uansett presentasjonsform

Den ikke-grafiske versjonen er *mindre farlig* kun fordi en rangert SQL-liste signaliserer «her er kandidater» mens en graf signaliserer «her er strukturen av rettskildebildet». Forskjellen er epistemisk framing, ikke faktisk presisjon.

---

## Ditt forslag er det riktige svaret

Du foreslår i realiteten å bygge et **kanonisk referansegrunnlag** som grafen kan valideres mot. Det løser presisjonsproblemene strukturelt, ikke bare symptomatisk.

### Lag 1: Direktiv → norsk gjennomføring

```
Direktiv 2014/24/EU
  Art. 58 (kvalifikasjonskrav)
    → LOA § 16
    → FOA § 16-1, § 16-2, § 16-3, § 16-10, § 16-12
  Art. 63 (støtte fra andre virksomheter)
    → FOA § 16-10
  Art. 65 (utvelgelse)
    → FOA § 16-12
```

Denne mappingen eksisterer delvis allerede — `lovdata_documents.based_on` peker fra forskrift til hjemmelslov, og forarbeidsbasen kobler FOA-paragrafer til direktivartikler tekstlig. Det som mangler er en **eksplisitt koblingstabell**:

```sql
CREATE TABLE directive_implementation (
  directive_article  text,   -- "2014/24/EU art. 58"
  norwegian_ref      text,   -- "foa § 16-10"
  implementation_type text   -- "full" | "partial" | "extended"
);
```

### Lag 2: EU-dom → direktivartikkel

`kofa_eu_case_law` har 320 dommer. Disse kan mappes mot direktivartikler — enten via CELEX-metadata eller tekstlig analyse av dommenes gjenstand. Resultatet:

```
C-601/13 Ambisig → art. 58 (teknisk kapasitet)
C-324/14 Partner → art. 58 + art. 63
```

### Hva dette gir

Du får to **uavhengige grafer som krysser hverandre**:

```
Graf A (nasjonal):   FOA-paragraf → KOFA-sak → sitater
Graf B (EU):         Direktivartikkel → EU-dom → direktivtolkning

Krysningspunkter:    FOA § 16-10 ↔ Art. 63 ↔ C-324/14 ↔ KOFA 2019/x
```

Krysningspunktene er analytisk de mest interessante nodene — de er steder der EU-rettens tolkning av direktivartikkelen *bør* reflekteres i KOFA-praksis. Hvis FOA §16-10 har mange KOFA-kanter men få koblinger til Art. 63-dommer, er det et presisjonssignal om at EU-retten er underutnyttet.

### Presisjonsforbedringen

| Problem | Uten kryssgraf | Med kryssgraf |
|---|---|---|
| Sentralitet ≠ rettslig vekt | Ingen korreksjon | EU-dom med høy direktivell autoritet kan vektes eksplisitt |
| Hull i nasjonal praksis | Usynlig | Synlig: direktivartikkel med EU-dommer men få KOFA-treff |
| Feilparsede kanter | Uoppdaget | Kanter som ikke korresponderer med direktiv-mapping er anomalier |
| Semantisk nærhet | Usynlig | Saker uten sitats-kobling men under samme direktivartikkel kan grupperes |

---

## Den gjenværende kritiske svakheten

Mappingen direktiv → FOA er **ikke mekanisk** — den krever juridisk skjønn. Art. 63 er ikke fullstendig gjennomført i én paragraf; FOA §16-10 implementerer deler av den, men med nasjonale tilpasninger som ikke alltid er i samsvar. En tabell som hevder «Art. 63 → §16-10» skjuler implementeringsspenninger som nettopp er det interessante rettslige spørsmålet.

Løsningen er å lagre implementasjonstypen eksplisitt (`full | partial | extended | disputed`) og behandle `disputed`-koblingene som egne analytiske noder — ikke som støy, men som det analytikeren bør undersøke først.

# MEG
Er det noe annet utover EU-referansegrunnlag som ville styrket presisjonsnivået i grafen?

# SONNET
## Andre presisjonsstyrker

### 1. Sitatvalens — den viktigste manglende dimensjonen

Alle kanter i `kofa_case_references` behandles som ekvivalente. Men det rettslige innholdet i en sitering varierer fundamentalt:

- **Bekreftende** — «i samsvar med»
- **Avgrensende** — «i motsetning til», «skiller seg fra»
- **Fravikende** — nemnda går eksplisitt bort fra tidligere praksis

En avgrensende sitering er ikke en svak bekreftelse — den er en *motpol*. Grafen uten valens gir systematisk feil bilde av konsensus vs. spenning i praksis. Dette er sannsynligvis den enkeltfaktoren som mest forvrenger sentralitetsanalysen.

Kan delvis løses ved NLP på `context`-kolonnen i `kofa_case_references` — den inneholder setningskonteksten rundt referansen og er allerede i databasen.

### 2. Rettskildelære-hierarkiet som eksplisitt lag

Grafen har ingen representasjon av Eckhoffs kilderangering. En KOFA-avgjørelse er forvaltningspraksis. En lagmannsrettsdom er rettspraksis. En Høyesterettsdom er bindende. En EU-dom om direktivtolkning har en annen autoritetsstatus enn en KOFA-sak som siterer den.

Uten dette laget vil en mye-sitert KOFA-avgjørelse fremstå som mer sentral enn en enkelt Høyesterettsdom som faktisk overprøver den. Løsningen er en eksplisitt `authority_weight`-egenskap per nodetype — ikke én desimaltall, men en *rangering per rettskildeprinsipp* (rettskildefaktor, vekt, relevans).

### 3. Utfall og begrunnelsesstruktur

`kofa_cases.avgjoerelse` inneholder utfallsdata (medhold/ikke medhold), men den er ikke koblet til *hvilke rettslige grunnlag* som var avgjørende. En sak kan gi medhold på prosessuelt grunnlag mens det materielle spørsmålet forblir uavklart. Grafen vet ikke dette.

Konsekvensen er at en sak kan fremstå som autorativ på ett rettslig spørsmål mens den faktisk bare er avgjort på et annet. Å koble utfall til begrunnelsesavsnitt (via `paragraph_number` i `kofa_decision_text`) ville gi grafen et presisjonsnivå den ikke har i dag.

### 4. Forarbeider som strukturerte noder

`kofa_forarbeider_law_refs` kobler forarbeidene til FOA-paragrafer og er allerede i databasen. Men forarbeidene er ikke noder i grafen — de er en isolert øy. En forarbeidsuttalelse til §16-10 som eksplisitt sier noe om direktivets gjennomføring er rettskildemessig viktigere enn de fleste KOFA-avgjørelser, men er usynlig for traversalen.

Å integrere forarbeidsnodene med kanter til både FOA-paragrafer og direktivartikler ville gi grafen et lag som gjenspeiler den faktiske rettskildevekten bedre.

### 5. Reguleringsversjon som separate grafer

`kofa_law_references.regulation_version` skiller allerede mellom gammel og ny FOA, men behandlingen er ikke konsekvent gjennomført i hele datamodellen. Praksis fra 2010 under gammel FOA kan ikke uten videre brukes som autoritet for ny FOA — men grafen kobler dem som om de er i samme rettslige univers.

Dette er særlig kritisk for sentralitetsrangeringen: gamle mye-siterte saker under gammel FOA vil dominere, selv om rettsområdet er endret ved ny forskrift.

---

## Samlet bilde

Ingen av disse er enkle å implementere fullt ut, og alle har en kritisk begrensning:

**Sitatvalens** krever NLP med ikke-triviell feilrate. **Autoritetsrangering** krever juridisk skjønn som ikke kan automatiseres. **Utfall/begrunnelsesstruktur** krever annotasjon per sak. **Forarbeidsintegrasjon** er teknisk gjennomførbart men forarbeidene dekker ikke alle paragrafer likt. **Reguleringsversjon** er delvis løst men krever konsekvens gjennom hele modellen.

Det underliggende problemet er at alle disse forbedringene enten krever menneskelig annotasjon eller NLP med usikker presisjon. Grafen kan ikke bli mer presis enn de menneskelige eller maskinelle vurderingene den bygger på — og det er det samme grunnproblemet som gjelder for Steg 2 også. Forskjellen er at Steg 2 er transparent om usikkerheten, mens grafen kan skjule den bak en tilsynelatende objektiv struktur.

# MEG
 vexp har funksjoner knyttet til «memory». Kunne dette blitt brukt til å «notere» på grafen/tabellene av LLM, og hver ny instans blir bedr om å vurdere/verifisere notat med +1 og -1, slik at høy score vil være en relasjon trolig er riktig (og kan da verifiseres av jurist). Eller er dette helt unyttig?

 # SONNET
## Kjerneideen er god — men vexp er feil implementering

vexp's memory er designet for kodenavigasjon i én arbeidsøkt. Det du beskriver er noe fundamentalt annerledes: **persistent, akkumulerende epistemisk vurdering av rettskilderelasjonene selv**. Det fortjener en egen datamodell.

---

## Hva ideen egentlig er

Du foreslår i realiteten et **Bayesiansk annoteringsystem** på grafen. Hver kant eller node har en prior (automatisk ekstrahert, ukjent presisjon), og hver LLM-instans som traverserer og vurderer den avgir et signal som oppdaterer posterioren. Juristen verifiserer noder/kanter over en terskelverdi.

```sql
CREATE TABLE graph_annotations (
  entity_type   text,    -- "edge" | "node"
  entity_id     bigint,
  annotation    text,    -- selve observasjonen
  confidence    float,   -- løpende score
  vote_count    integer,
  verified_by   text,    -- jurist-id hvis menneskelig verifisert
  verified_at   timestamptz
);

CREATE TABLE annotation_votes (
  annotation_id bigint,
  session_id    text,    -- hvilken LLM-instans
  vote          smallint, -- +1 / -1
  reasoning     text,    -- hvorfor
  created_at    timestamptz
);
```

---

## De genuine styrkene

**Løser sitatvalens-problemet.** En LLM som leser konteksten rundt en kant og annoterer «avgrensende sitering» med begrunnelse, og tre påfølgende instanser bekrefter dette med +1, har gitt kanten en semantisk kvalitet den ikke hadde. Over tid akkumuleres dette til et validert valenslag på grafen.

**Juristen får en prioritert arbeidsliste.** I stedet for å verifisere alle 25.000+ kanter manuelt, verifiserer juristen bare de annotasjonene som har høy vote-score og høy rettslig relevans. Det er et realistisk arbeidsvolum.

**Ny instans får kontekst fra forrige instans.** Den hermeneutiske sirkelen vi diskuterte earlier — der tolkningsfasen avdekker nye begreper som blir nye seeds — kan nå *lagres*. En instans som oppdager at «binær vs. kvantitativ rådighet» er en viktig distinksjon, annoterer dette på de relevante kantene. Neste instans arver denne forforståelsen.

---

## De kritiske svakhetene

**LLM-instanser er ikke uavhengige.** Dette er det mest alvorlige problemet. Samme modell med samme treningsdata vil tendere mot de samme vurderingene — ikke fordi relasjonen er korrekt, men fordi de deler systematiske bias. +1 fra ti Claude-instanser er ikke det samme som +1 fra ti uavhengige jurister. Stemmetallet gir et falskt bilde av epistemisk robusthet.

**Confirmation bias akkumulerer.** Hvis de første instansene annoterer en kant som «sterk bekreftende sitering», vil påfølgende instanser lese kanten i lys av den eksisterende annotasjonen og tendere mot +1 — ikke fordi de vurderer selvstendig, men fordi annotasjonen framer vurderingen. Systemet kan konvergere mot feil svar med høy confidence.

**Hvem annoterer hva er ikke-tilfeldig.** Instanser traverserer grafen basert på problemstilling. Kanter i sentrale deler av grafen vil få mange votes; perifere kanter vil forbli uannotert. Confidence-scoren reflekterer da like mye traverseringsfrekvens som faktisk presisjon.

**Votingen er ikke granulær nok.** +1/-1 på en hel annotasjon skjuler at annotasjonen kan være delvis korrekt. «Avgrensende sitering» kan være riktig men begrunnelsen feil, eller riktig for ett rettslig spørsmål men ikke et annet.

---

## Hva som ville gjort det nyttig

Tre justeringer reduserer problemene strukturelt:

**Separer annoteringstype fra vote.** I stedet for +1/-1 på en fritekst-annotasjon, vot på spesifikke *dimensjoner*: sitatvalens, relevans for problemstilling X, implementeringstype direktiv/nasjonal rett. Det gjør voteringen sammenlignbar på tvers av instanser.

**Krev eksplisitt begrunnelse for avvik.** En instans som avgir -1 uten å identifisere hva som er feil i den eksisterende annotasjonen, bidrar ikke til presisjon. Tvungen begrunnelse ved avvik gjør det mulig å oppdage om -1 skyldes ny informasjon eller bare støy.

**Skill maskin-votes fra jurist-verifisering konseptuelt.** Maskin-votes er *hypoteser om presisjon*, ikke presisjon i seg selv. Juristen verifiserer ikke «er denne scoren høy nok» — juristen vurderer annotasjonen direkte og overskriver med en kvalitativt annen type bekreftelse. De to sporene bør aldri aggregeres i samme confidence-tall.

---

## Konklusjon

Ideen er ikke unyttig — den er faktisk den mest lovende mekanismen for å løse det grunnproblemet vi har diskutert hele veien: at grafen er mer presis enn datagrunnlaget den bygger på. Akkumulerende LLM-annotasjon med juristverifisering er en realistisk vei mot et validert rettskildenett. Men den krever at man er bevisst på at maskin-votes måler *intern konsistens i LLM-resonnement*, ikke rettslig korrekthet — og at juristen forblir den eneste kilden til faktisk validering.

# MEG
Hvordan løse teknisk? Det forutsetter jo at LLM har skrivetilgang, men styrken ligger jo i å bruke dette som MCP som gjør det tilgjengelig for mange brukere

# SONNET
## Det tekniske kjerneproblemet

Du vil gi LLM-instanser skrivetilgang til en delt database via MCP — uten at én instans kan dominere, uten at ukontrollert skriving korrumperer dataene, og uten at Supabase-tilgangen eksponeres direkte. Det er tre separate problemer.

---

## Arkitekturen i tre lag

### Lag 1: MCP-verktøyene (LLM-grensesnittet)

LLM-en ser fire verktøy — to lese, to skrive:

```typescript
// Lese
traverse_legal_graph({ seed, edges, depth, rank_by })
get_annotations({ entity_id, entity_type })

// Skrive — begrenset og kontrollert
submit_annotation({
  entity_id:    bigint,
  entity_type:  "edge" | "node",
  annotation_type: "citation_valence" 
                 | "directive_mapping" 
                 | "implementation_type"
                 | "relevance_note",
  value:        string,   // strukturert, ikke fritekst
  reasoning:    string,   // obligatorisk
  session_id:   string    // generert av MCP-laget, ikke LLM
})

vote_annotation({
  annotation_id: bigint,
  vote:          1 | -1,
  reasoning:     string   // obligatorisk ved -1
})
```

**session_id genereres av MCP-serveren**, ikke av LLM-en. LLM-en kan ikke oppgi sin egen identitet — det ville åpne for manipulasjon.

---

### Lag 2: MCP-serveren (kontrollaget)

Dette er Node/Deno-prosessen som sitter mellom LLM og Supabase. Den løser tre ting:

**Identitet og rate limiting**
```typescript
// MCP-serveren tildeler session_id fra kontekst
const session_id = hash(
  mcp_client_id +   // hvilken MCP-klient (brukerens instans)
  timestamp_bucket  // avrundet til nærmeste time — én vote per time per kant
)

// Rate limit per session
if (await getVoteCount(session_id, entity_id) > 0) {
  return { error: "Already voted on this entity in current session" }
}
```

**Strukturvalidering av verdier**
```typescript
// Ikke fritekst — enumerte verdier per annoteringstype
const VALID_VALUES = {
  citation_valence:    ["confirmatory", "limiting", "overruling", "analogical"],
  implementation_type: ["full", "partial", "extended", "disputed"],
  directive_mapping:   ["explicit", "implicit", "absent"]
}

if (!VALID_VALUES[annotation_type].includes(value)) {
  return { error: "Invalid value for annotation type" }
}
```

**Supabase-tilgang via service role — men avgrenset**

MCP-serveren bruker Supabase service role key (full tilgang), men eksponerer kun spesifikke operasjoner. LLM-en får aldri direktetilgang til databasen.

---

### Lag 3: Supabase (datamodellen)

```sql
-- Én annotasjon per (entity, type) — ikke duplikater
CREATE UNIQUE INDEX ON graph_annotations(entity_id, entity_type, annotation_type);

-- Én vote per (session, annotation)
CREATE UNIQUE INDEX ON annotation_votes(session_id, annotation_id);

-- Confidence oppdateres automatisk
CREATE OR REPLACE FUNCTION update_confidence()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE graph_annotations
  SET confidence = (
    SELECT SUM(vote)::float / COUNT(*)
    FROM annotation_votes
    WHERE annotation_id = NEW.annotation_id
  ),
  vote_count = (
    SELECT COUNT(*) FROM annotation_votes
    WHERE annotation_id = NEW.annotation_id
  )
  WHERE id = NEW.annotation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_vote
AFTER INSERT ON annotation_votes
FOR EACH ROW EXECUTE FUNCTION update_confidence();
```

RLS-policy sikrer at votes er append-only — ingen kan endre eller slette:

```sql
ALTER TABLE annotation_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_only" ON annotation_votes
FOR INSERT WITH CHECK (true);

-- Ingen UPDATE eller DELETE policy → umulig for alle
```

---

## Det gjenværende problemet — og en pragmatisk løsning

Selv med session_id-isolasjon er instanser fra samme modell ikke uavhengige. Det kan ikke løses teknisk — det er epistemisk. Men det kan håndteres ved å **lagre modellversjon** ved siden av vote:

```sql
ALTER TABLE annotation_votes ADD COLUMN model_version text;
-- f.eks. "claude-sonnet-4-6", "gpt-4o-2024-11"
```

Da kan confidence-beregningen vektes slik at votes fra *ulike modeller* teller mer enn votes fra samme modell, og juristen kan filtrere på tvers-modell-konsensus som et sterkere signal enn intra-modell-konsensus. Det er ikke perfekt, men det er det nærmeste man kommer uavhengighet uten menneskelige vurderinger.

---

## Sammendrag

| Lag | Teknologi | Ansvar |
|---|---|---|
| LLM | MCP-klient | Kaller verktøy, avgir reasoning |
| MCP-server | Node/Deno | session_id, rate limit, validering, modellversjon |
| Supabase | Postgres + RLS | Append-only votes, auto-confidence, juristverifisering |

Styrken er at ingen enkelt LLM-instans har mer enn én vote per kant per session, alle votes er sporbare tilbake til modellversjon og tidspunkt, og juristen har et klart skille mellom maskin-hypoteser (confidence) og menneskelig validering (verified_by). MCP-serveren er det eneste stedet service role key finnes — LLM-en ser aldri databasen direkte.
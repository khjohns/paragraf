### Implementasjonsarkitektur (Svelte 5 + d3-force)

#### Teknologivalg

**d3-force v3.0.0** (del av d3 v7) for layoutberegning. Brukes *kun som matematikkmotor* — ikke for DOM-manipulasjon. d3-force er en velocity Verlet-simulering som er stabil, moden, og offisielt anbefaler web workers for store grafer. API-et har vært stabilt siden v4; v3 er ESM-native og tree-shakable.

*Hvorfor ikke dagre:* Dagre beregner hierarkisk layout for rettede grafer — den legger noder i lag og minimerer kantkryssinger. Men rettskildegrafen er et nettverk, ikke et hierarki. En sak siterer flere saker på tvers av nivåer. Dagre ville tvunget en kunstig lagdeling som ikke reflekterer sakenes faktiske forbindelser. d3-force gir en organisk layout som grupperer tett forbundne noder naturlig.

**Svelte 5** eier all DOM-rendering. Noder rendres med `{#each}` og bindes til posisjonsobjekter. Svelte kompilerer bort rammeverket — ingen virtuell DOM, ingen diffing. Det betyr at oppdatering av nodeposisjoner er vesentlig raskere enn i React.

**Layer Cake** (layercake.graphics) for grafikklag. Layer Cake er et headless grafikkrammeverk for Svelte som håndterer koordinatsystemer og lar deg stable SVG-, Canvas- og HTML-lag i samme rom. Brukes for canvas/SVG-hybrid-rendering.

#### Ytelsesarkitektur (tre lag)

**1. Web Worker for simulering.** d3-force-simuleringen kjøres i en dedikert web worker (`src/lib/workers/graph-layout.worker.ts`). Hovedtråden sender nodeliste og kantliste inn, workeren kjører 200–350 iterasjoner og returnerer en posisjonstabell `{ [nodeId]: { x, y } }`. Hovedtråden forblir fri under beregning.

Mønster (SvelteKit):
```
// src/lib/workers/graph-layout.worker.ts
import { forceSimulation, forceLink, forceManyBody, ... } from 'd3-force';

onmessage = (event) => {
  const { nodes, edges, config } = event.data;
  const sim = forceSimulation(nodes)
    .force('link', forceLink(edges).id(d => d.id) ...)
    ...
  for (let i = 0; i < config.iterations; i++) sim.tick();
  sim.stop();
  const positions = {};
  nodes.forEach(n => positions[n.id] = { x: n.x, y: n.y });
  postMessage({ positions });
};
```

Tilpasning: `iterations`, `charge`, `linkDistance` skaleres med antall noder (parametrisert i config-objektet). Færre noder → sterkere frastøting, lengre avstand.

**2. Canvas for kanter.** Kanter (siteringer og bestemmelsesreferanser) tegnes på et `<canvas>`-element. De er ikke interaktive og det kan være hundrevis. Canvas tegner alle kanter i ett renderpass uten DOM-noder. Ved hover dimmes kanter via alpha-endring i canvas-konteksten — ett nytt renderpass, ikke per-element-oppdatering.

**3. SVG for interaktive noder.** Saksnoder og bestemmelsesnoder rendres som SVG-elementer av Svelte. De trenger hover, klikk, kontekstmeny, tooltip — alt som krever DOM-events. Med 200 noder og ~6 SVG-barn per node er det ~1200 elementer. Svelte håndterer dette effektivt fordi oppdateringer er kirurgiske (ingen virtuell DOM-diffing).

Layer Cake koordinerer canvas- og SVG-lagene i samme koordinatsystem, inkludert zoom/pan-transformasjonen.

#### Animert overgang ved filtrering

Når filteret endres:

1. Hovedtråden sender nye synlige noder/kanter til workeren.
2. Mens workeren beregner: eksisterende noder dimmes 30% (opacity-endring via Svelte-binding). Gir visuelt hint om at noe skjer.
3. Workeren returnerer nye posisjoner.
4. Svelte 5 `Tween`-klasser interpolerer fra gammel posisjon til ny:

```svelte
<script>
  import { Tween } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';

  // Per node: Tween.of() binds to reactive position
  // Svelte handles interpolation automatically
  const nodeX = new Tween(0, { duration: 500, easing: cubicInOut });
  const nodeY = new Tween(0, { duration: 500, easing: cubicInOut });

  // When new positions arrive from worker:
  nodeX.target = newPos.x;
  nodeY.target = newPos.y;
  // Svelte animates .current smoothly
</script>

<circle cx={nodeX.current} cy={nodeY.current} ... />
```

Praktisk: posisjonene lagres i et `Map<string, { x: Tween, y: Tween }>` som oppdateres ved nye worker-resultater. Svelte rendrer `node.x.current` / `node.y.current` — animasjonen er innebygd.

5. Canvas-laget re-rendres synkront med SVG-posisjonene via `requestAnimationFrame` — kanter følger nodene under animasjonen.
6. Etter animasjonen: auto-fit (zoom/pan til nye grenser).

*Hvorfor `Tween` og ikke `Spring`:* Designspec sier «ingen spring/bounce — dette er et profesjonelt verktøy.» Tween med cubic easing gir kontrollert, forutsigbar bevegelse. Spring gir bounce som bryter den redaksjonelle roen.

#### Zoom og pan

d3-zoom brukes direkte på SVG-elementet (d3 eier kun zoom-transformasjonen, ikke innholdet). Transformasjonen appliseres på et wrapper-`<g>`-element for SVG og via `ctx.setTransform()` for canvas. Layer Cake kan koordinere dette.

#### Versjoner (per mars 2026)

- d3 v7.8.5 (d3-force v3.0.0) — stabil, ESM-native
- Svelte 5 (runes, `Tween`/`Spring`-klasser fra `svelte/motion`)
- SvelteKit (for web worker-integrasjon og SSR)
- Layer Cake (siste versjon — Svelte-native, støtter Canvas + SVG + HTML)

#### Hva som *ikke* brukes

- **Dagre** — hierarkisk layout, feil for siteringsnettverk
- **d3 DOM-manipulasjon** — d3 brukes kun for math (force, zoom). Svelte eier DOM.
- **React-mønsteret fra mockupen** — `requestAnimationFrame` + `setPositions()` erstattes av Svelte `Tween`-klasser. Ingen manuell frame-loop.
- **Svelvet / Svelte Flow** — for node-baserte editorer og flytdiagrammer, ikke for rettskildenettverk med editorial typografi

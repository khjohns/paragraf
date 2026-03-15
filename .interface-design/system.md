# Paragraf Design System

## Direction

Researcher's workbench for legal source analysis. Warm paper authority. Dense but organized.

The interface emerges from the physical world of legal research: a well-lit desk in a law library, papers organized in piles, handwritten notes in margins, ink on cream paper. Not a tech dashboard. Not a SaaS app. A scholar's tool.

## Who

Norwegian procurement lawyer. Lovdata open in another tab. Working through a specific legal question — "must a commitment letter be submitted by the tender deadline?" She thinks in provisions, precedents, and authority hierarchies. Her daily tools are text-based: Lovdata search, Word, PDFs. She has never used graph visualization for legal work.

## Feel

Calm authority. Warm like a notebook, dense like a reference book. Every element earns its place through information density, not decoration. The interface is quiet — it doesn't announce itself. Hierarchy whispers through weight, size, and warmth rather than shouting through color or borders.

## Depth Strategy

**Borders only.** Subtle rgba borders with 3-level progression:
- Standard: `rgba(26,24,20,0.08)` — barely visible, structural
- Medium: `rgba(26,24,20,0.13)` — section separation
- Strong: `rgba(26,24,20,0.22)` — emphasis, focus rings

No shadows. The tool is technical and precise — shadows would soften it. Elevation is communicated through background lightness shifts (bg → panel → surface).

## Spacing

Base unit: **4px**. Scale: 4 / 8 / 12 / 16 / 20 / 24 / 32.

## Border Radius

Tokens: `--radius-sm: 2px`, `--radius-badge: 3px`, `--radius-md: 4px`, `--radius-lg: 6px`. Sharper than defaults — matches precise, technical feel.

Badge pattern uses `var(--radius-badge)` exclusively. Pill shapes (cat-pill, iter-badge) may use larger values (8-12px) as exceptions.

## Typography

- **UI:** Inter (`--font-ui`) — clean, neutral, excellent at small sizes (11-14px)
- **Data:** JetBrains Mono (`--font-data`) — case numbers (2022/789), paragraph refs (§16-10), seeds

WHY: Legal work is text-heavy. Inter gives clean reading at small sizes. JetBrains Mono makes case identifiers instantly distinguishable from prose — critical when scanning a list of 100+ nodes.

### Text Hierarchy
- Primary `--p-ink: #1A1814` — headings, labels, node names
- Secondary `--p-ink2: #5C564D` — subtitles, descriptions
- Tertiary `--p-ink3: #8C8578` — metadata, section labels
- Muted `--p-ink4: #B0A99E` — hints, disabled, placeholders

### Key Sizes
- Panel titles: 11px, weight 600, uppercase, letter-spacing 0.06em
- Field labels: 12px, weight 500
- Node labels (list): 13px, monospace, weight 600
- Subtitles: 12-13px, secondary color
- Metadata line: 11px, tertiary color
- Body text (reading): 13px, line-height 1.6
- Badges: 10-11px, weight 600-700

## Color Palette

### Foundation (from legal document world)
```
bg:      #F5F3EE    Warm cream — aged paper
panel:   #FAF9F6    Slightly lighter — fresh paper
surface: #FFFFFF    Card/modal — note laid on desk
input:   #EFECE5    Inset fields — darker, receives content
hover:   rgba(26,24,20,0.03)
active:  rgba(26,24,20,0.06)
```

### Node Types (domain-semantic)
```
provision:  bg #E8EEF0  accent #4A6670  border #C5D3D8  — official, governmental
kofa_case:  bg #F0EBD8  accent #8B6914  border #DDD3B0  — warmth of case law
eu_case:    bg #E4F0EC  accent #2D6A5D  border #BDD9CF  — European, diplomatic
court_case: bg #EDE4EE  accent #6B4C6E  border #D4C4D6  — judicial authority
prep_work:  bg #EDE8E0  accent #7A6B5D  border #D5CEC3  — background, historical
```

### Semantic
```
success:  #3D7A4A  bg #EBF5ED  — read, confirming
warn:     #A67B2E  bg #FBF5E8  — breach, distinguishing valence
danger:   #A63D3D  bg #F5EBEB  — departing valence
gap:      #9B4DCA  bg #F3ECF8  — analytical holes
delim:    #C4650A  bg #FDF2E7  — delimitation practice
```

### AI Trust Boundary
```
highlight:     #FBF5E8              — AI-highlighted database text (background)
ai-accent:     #8B6914              — AI comment left border
ai-comment-bg: rgba(139,105,20,0.04) — AI comment background
```
**Rule:** Unmarked text = database (authoritative). Gold-brown left border = AI (useful, fallible). No grey zone.

## Signature Elements

1. **Triple-signal indicator (R/F/V dots)** — three dots showing which search signals found each node. Unique to this product. Filled = hit, empty = miss.

2. **AI trust boundary** — visual separation between database text and AI curation. Ufravikelig (non-negotiable).

3. **Warm paper palette** — immediately distinguishable from any generic dashboard. The tokens (ink, panel, surface) name the product's world.

## Key Component Patterns

### Workspace Header Strip
All views share a header: `Paragraf · [current provision] · [read count] · [iteration]`.
Background: panel. Subtle bottom border. Small uppercase "PARAGRAF" brand, dot separator, current context.
Reference: all 4 mocks use this pattern consistently.

### View Switcher (segmented control)
Border: 1px solid border. Overflow hidden. Active tab: inverted (ink bg, panel text). Inactive: transparent bg, ink3 text.
Views: Liste | Graf | Tidslinje | Rettssetninger (sprint-dependent availability).

### List Items
Layout per row:
- Line 1: Checkbox · Type dot (9px colored circle) · Case number (mono, bold, 12px) · Category badge (A/B/C) · Signal dots · Description text
- Line 2: Date · Outcome badge · Citations count · Valence indicators
Active: left border accent + active background. Hover: subtle bg shift. Read items: NOT dimmed (per spec: C cases not visually degraded).
Reference: `legal-workbench.jsx` ListItem component.

### Detail Panel Header
Background in node-type color (provision-bg, kofa-bg, etc). Contains: type label, node identifier (large mono), metadata badges, close button.
Reference: `legal-workbench.jsx` DetailPanel, `paragraf-timeline-concept.jsx` CaseDetail.

### Badge Pattern
Consistent across the system: `padding: 2px 6px; border-radius: var(--radius-badge); font-size: 10px; font-weight: 600`. Background + text color from semantic tokens.

### Outcome Badges
- Brudd: warn-bg + warn color
- Ikke brudd: success-bg + success color
- Avvist: hover-bg + ink3 color

## Defaults Rejected

1. **Generic sidebar with different bg** → Same bg as canvas, border separation only
2. **Native select/input** → Custom styled controls matching warm palette
3. **Shadow-based depth** → Borders only — matches the precise, technical feel
4. **Cool blue accent** → Domain-warm gold-brown (case law) as primary accent
5. **Standard dashboard card grid** → Information-dense list as primary view

## Mock Reference

| Mock file | What it defines | Sprint scope |
|-----------|----------------|--------------|
| `legal-workbench.jsx` | Full 3-panel layout, list view, toolbar, detail panel, reading mode | Sprint 3 (core) |
| `paragraf-chat-concept.jsx` | Chat drawer, sparring partner, reference parsing | Sprint 4+ |
| `paragraf-registry-concept.jsx` | Proposition registry, evolution badges, tension connectors | Sprint 4+ |
| `paragraf-timeline-concept.jsx` | Timeline SVG, case detail card, legend patterns | Sprint 4+ |

All mocks share identical design tokens (T object) matching `app.css :root` variables.

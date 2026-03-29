# Paragraf — Design System

> Authoritative reference: `paragraf-designspec.md` contains full reasoning for every decision.
> This file is the implementation reference — tokens, patterns, sizes.

## Direction & Feel

**Who:** A jurist in a law firm. Deep concentration, high stakes, text-heavy work.

**Feel:** An open law book on a tidy desk. Warm, authoritative, calm. Not software — document.

**Signature:** The narrative filter sentence — a typographic, editorial sentence that reads active filters back to the jurist in natural language.

---

## Information Architecture

**Two pages:** Portfolio (scanning/selection) and Analysis (working with one analysis).

**Five perspectives within Analysis:** Scope (Search), Saksoversikt (List), Graf (Network), Rettssetninger (BookOpen), Notat (PenTool). Accessed via 48px nav rail.

**Navigation:** §-logo in header = home (portfolio). Always clickable with hover state. Header always shows analysis problem statement when inside an analysis, regardless of perspective.

**Panel model:** Never three content panels simultaneously. Scope (360px) auto-closes when reading panel (420–460px) opens, and vice versa. Under ~1200px, scope collapses automatically.

---

## Token Architecture

### Text Hierarchy (4 levels)

```
--ink:            #1C1B1A    Primary — titles, headings, rettssetninger, assessments
--ink-secondary:  #33312E    Secondary — problem statements, body text, factum, nuance body
--ink-tertiary:   #4A4843    Tertiary — metadata, labels, phase names, group headers, theme headers (peripheral)
--ink-muted:      #7A766F    Muted — placeholder, disabled, counters, structural dots, paragraph numbers
```

### Surfaces

```
--paper:          #F8F6F1    Base canvas (light, warm)
--paper-dark:     #EDEAE3    Inset backgrounds — provision tags, control backgrounds, quote blocks
```

### Border Progression (4 levels)

```
--border-subtle:  rgba(28, 27, 26, 0.06)    Softest — row separators, section dividers, paragraph separators
--border:         rgba(28, 27, 26, 0.12)    Default — provision tags, toggles, controls, quote blocks, regulation tags
--border-strong:  rgba(28, 27, 26, 0.20)    Emphasis — hover states, dropdown border, active filters, logo-home hover
--border-stronger: rgba(28, 27, 26, 0.35)   Maximum — focus rings, edit textarea border
```

### Control Tokens

```
--control-bg:           #EDEAE3
--control-border:       rgba(28, 27, 26, 0.12)
--control-border-focus: rgba(28, 27, 26, 0.40)    Used for focus-visible outlines
```

### Interaction Tokens (light mode)

```
--hover-bg:             rgba(28, 27, 26, 0.02)    Row hover, subtle highlight
--hover-bg-strong:      rgba(28, 27, 26, 0.04)    Context menu hover, stronger highlight
--hover-bg-ctrl:        rgba(28, 27, 26, 0.025)   Dropdown item hover
--hover-bg-ctrl-active: rgba(28, 27, 26, 0.04)    Dropdown item active state
--header-bg:            rgba(248, 246, 241, 0.85)  Sticky header backdrop
--selection-bg:         rgba(107, 76, 154, 0.12)   Text selection
--row-active-bg:        rgba(28, 27, 26, 0.04)    Selected row in register
```

### Button Tokens

```
--btn-primary-bg:       var(--ink)
--btn-primary-fg:       var(--paper)
--btn-primary-hover:    #000000
```

### Semantic Colors

```
--ai-accent:      #92600A    KI-bidrag, new events, screening, vector signals (warm ocher)
--ai-border:      rgba(146, 96, 10, 0.20)
--ai-bg:          rgba(146, 96, 10, 0.05)

--violet-accent:  #6B4C9A    Overlap/convergence (krysspollinering in portfolio)
--violet-border:  rgba(107, 76, 154, 0.18)

--tension-color:  #6B4C9A    Tensions between rettssetninger (same violet family)
--tension-border: rgba(107, 76, 154, 0.20)
--tension-bg:     rgba(107, 76, 154, 0.04)

--nuance-color:   #8B3A3A    Exceptions/nuances — label only, body uses --ink-secondary
--confirm-color:  #375E37    Confirmation — bekreftet status, copied state
--gold-star:      #B8941E    Gullkandidater — star icon fill

--qualified-color: #9E6A3A   Qualified evolution state (dashed border)

--signal-fts:       #4A6A8B    Fulltekst signal (F) — slate blue
--signal-fts-border: rgba(74, 106, 139, 0.25)
--signal-fts-bg:    rgba(74, 106, 139, 0.06)

--ref-link:       #4A6A8B    Cross-reference links in reading view (same as signal-fts)
```

### Graph Edge Colors

```
--edge-color:     rgba(28, 27, 26, 0.10)   Bestemmelsesreferanser (stiplet)
--edge-cite:      rgba(28, 27, 26, 0.18)   Siteringskanter (solid)
--edge-highlight: rgba(28, 27, 26, 0.40)   Fremhevet kant ved hover
```

### User Marking Colors

Five semantically neutral colors for user-assigned node marks (right-click context menu). Shown as 2.5px ring around node dot. Avoids the semantic palette (oker/fiolett/blå/grønn/rød).

```
--marking-rosa:     #D4727E
--marking-turkis:   #5AA3A3
--marking-oransje:  #C4933A
--marking-lavendel: #9A7EB8
--marking-salvie:   #7BA37B
```

> **Note:** `--confirm-color`, `--gold-star`, `--ref-link`, `--edge-*`, `--marking-*`, `--tension-*`, `--nuance-color`, and `--qualified-color` are now in `tokens.css`. `--noise-svg` is specified but not yet in `tokens.css`.

### Phase Colors

Used **only** in phase filter dropdown and narrative sentence. Not on structural elements.

```
oppsett:          #A8A29E    Stone
primaersok:       #64748B    Slate
screening:        #B45309    Amber
ettersok:         #CA8A04    Gold
sammenstilling:   #059669    Emerald
```

---

## Dark Mode

All overrides in `.dark` class on wrapper element. `colorScheme: 'dark'` set for native hints.

```
--ink:            #E2DFD6    (warm off-white, not pure white)
--ink-secondary:  #C4C0B5
--ink-tertiary:   #8E8A80
--ink-muted:      #5C5850

--paper:          #1E1C19    (warm black, brown/ocher undertone)
--paper-dark:     #16140F

--border-subtle:  rgba(232, 229, 220, 0.06)
--border:         rgba(232, 229, 220, 0.10)
--border-strong:  rgba(232, 229, 220, 0.16)
--border-stronger: rgba(232, 229, 220, 0.28)

--control-bg:     #262420
--control-border: rgba(232, 229, 220, 0.12)

--ai-accent:      #C49A4E    (lifted, warmer)
--ai-border:      rgba(196, 154, 78, 0.25)
--ai-bg:          rgba(196, 154, 78, 0.08)

--signal-fts:       #8BAAC4
--signal-fts-border: rgba(139, 170, 196, 0.25)
--signal-fts-bg:    rgba(139, 170, 196, 0.08)

--tension-color:  #9B82C4
--tension-border: rgba(155, 130, 196, 0.25)
--tension-bg:     rgba(155, 130, 196, 0.06)

--nuance-color:   #D47A7A
--confirm-color:  #8BC48B
--gold-star:      #D4B84E
--qualified-color: #D4A06A
--ref-link:       #8BAAC4

--edge-color:     rgba(232, 229, 220, 0.06)
--edge-cite:      rgba(232, 229, 220, 0.12)
--edge-highlight: rgba(232, 229, 220, 0.30)

--header-bg:        rgba(30, 28, 25, 0.85)
--hover-bg:         rgba(232, 229, 220, 0.03)
--hover-bg-strong:  rgba(232, 229, 220, 0.06)
--hover-bg-ctrl:    rgba(232, 229, 220, 0.04)
--hover-bg-ctrl-active: rgba(232, 229, 220, 0.06)
--selection-bg:     rgba(155, 130, 196, 0.20)
--row-active-bg:    rgba(232, 229, 220, 0.05)

--btn-primary-bg:   #E2DFD6
--btn-primary-fg:   #1E1C19
--btn-primary-hover: #F8F6F1

--noise-svg:      (same pattern, opacity 0.02 instead of 0.03)
```

**Primary button dark mode:** Outline variant — transparent bg, `--border-strong` border, `--ink-secondary` text.

**Bulk action bar:** Hardcoded `#1C1B1A` bg with `#F8F6F1` text — works in both modes.

---

## Depth Strategy

**Borders-only.** No shadows. No surface color shifts for elevation.

Exceptions:
- Provision tags and controls: `--paper-dark` (inset/recessed, not elevation)
- 2px solid `--ink` editorial rule line under section headers (typographic, not depth)
- Quote blocks: `--paper-dark` background + `--border` border

### Border Radius

Two-tier system. Sharp corners reinforce the editorial/legal feel.

```
2px  — Small controls: badges, tags, action buttons, provision tags, category badges
4px  — Containers: dropdowns, cards, tooltips, input fields, tabs, nav buttons
```

---

## Typography

```
Newsreader (serif)       — Authority, reading. Titles, rettssetninger, factum, assessments, narrative.
JetBrains Mono (mono)    — Data, precision. Provisions, case refs, counters, evolution/regulation tags.
Albert Sans (sans-serif) — UI chrome. Labels, buttons, filters, controls, section labels.
```

**Mono data: `font-variant-numeric: tabular-nums`** on all numeric mono elements (counts, column headers, badges) for columnar alignment.

### Key Sizes

```
Narrative sentence:         30px Newsreader 400, line-height 1.35
Fortsett / case title:      28px Newsreader 500, letter-spacing -0.015em
Page title:                 24px Newsreader 500, letter-spacing -0.01em
Group header:               20px Newsreader italic 400
Index row title:            18px Newsreader 500
Theme header (core):        18px Newsreader italic 400
Rettssetning text:          17px Newsreader (normal or italic ai-accent for KI)
Reading paragraph:          17px Newsreader, line-height 1.7
Problem statement:          17px Newsreader (hero), 13px Albert Sans (index, truncated)
Theme header (peripheral):  16px Newsreader italic 400, ink-tertiary
Register ref focal:         16px Newsreader 500 + 11px Albert Sans source/date below
Evidence factum:            16px Newsreader, ink-tertiary
Evidence assessment:        16px Newsreader 600, ink
Proposition (KI):           16px Newsreader italic, ai-accent, with border-left
Quote text:                 15–16px Newsreader italic, ink-secondary
KI screening text:          15px Newsreader, line-height 1.55
Scope problem text:         15px Newsreader 500, ink
Scope body text:            14px Newsreader, ink-secondary
Section label:              11px Albert Sans 600, uppercase, tracking 0.1em
Control / tab text:         11–12px Albert Sans 500
Provision tag:              12px JetBrains Mono (hero), 11px (index/scope)
Case ref (evidence):        12px JetBrains Mono 700
Evolution tag:              9px JetBrains Mono 700, uppercase, tracking 0.08em
Regulation tag:             9px JetBrains Mono, ink-muted, border + padding 0 4px
Scope section header:       10px JetBrains Mono 600, uppercase, tracking 0.1em
```

---

## Spacing

**Base unit: 4px.**

```
4   — icon gaps, tight pairs
8   — element gaps within a row, metadata spacing, quote gap
12  — component internal padding, control gaps, case header margin, KI screening padding
16  — row padding, section gaps, quote block padding, panel padding (nav rail), scope section content
20  — panel padding (scope, evidence, reading), gap between title and button
24  — narrative padding-bottom, main content lr padding, evidence panel padding
28  — timeline indent (paddingLeft in evidence)
32  — Fortsett left indent, evidence panel outer padding, reading view top padding
40  — group margin-bottom, timeline spacing between cases
48  — empty state padding, evidence bottom padding, paragraph number column width
64  — Fortsett section margin-bottom
80  — krysspollinering margin-top, page bottom padding
720 — reading view max-width (content column)
```

---

## Component Patterns

### Global Header (48px)
§-logo as `<button class="logo-home">`. Hover: border → `--border-strong`. In portfolio: "§ Paragraf". In analysis: "§ | [problem statement]" (serif 16px, truncated). Right: optional action btn, dark toggle, avatar (28px circle).

### Nav Rail (48px)
`.nav-btn` icons, active: `--paper-dark` bg + `--border`. Notification dot (5px `--ai-accent`). Notat at bottom.

### Scope Toggle / Tab Toggle
`.scope-toggle` / `.tab-toggle` with `.scope-sep` / `.tab-sep` separators. Active: `--paper-dark`. Category tabs: "Kjernesak · A (5)" with `.tab-cat` mono letter.

### Scope Panel (360px)
Six collapsible `ScopeSection` components. Open default: Problemstilling, Delspørsmål, Bestemmelser, Søkestrategi. Collapsed default: Kontekst, KI-resonnement. Editable fields: `.editable-field` (transparent border → `--border-strong` hover). Provisions split: primary (filled tags) / secondary (dashed border). Bestemmelsesgrunn as hover tooltip (`.prov-reason`).

### Register Row (Arbeidsflaten)
8-column grid. Reference = focal point (16px serif + 11px sans). Signal columns R/F/V equally weighted. Category badge 24px. KI-innsikt expandable. Dimmed at opacity 0.4 for C-category.

### Rettssetningsregister (implemented)
Accessed via BookOpen nav-btn in NavRail. Perspective `'registry'` hides scope panel (registry has its own panel model with evidence panel). Register header: 24px Newsreader 500, 2px solid `--ink` editorial rule line. Grouped by themes (core → peripheral: core 18px `--ink-secondary`, peripheral 16px `--ink-tertiary`, both italic). 4-column grid (`minmax(200px,1fr) 112px 112px 36px`, gap 20px, padding 16px 24px). Row states: active `inset 3px 0 0 --ink`, AI-generated `inset 3px 0 0 --ai-border`. Proposition: 17px Newsreader (AI: italic `--ai-accent`). Topic label: 10px JetBrains Mono uppercase. Status badges: KI-utkast (`--ai-border`/`--ai-accent`) or Verifisert (`--border`/`--ink-tertiary`). Tension: Scale icon + `--tension-color` link. Evolution: 4 tags (EvolutionTag component). Suggested: Sparkles at instance. Lineage: collapsible per-case. Boundary notes: collapsible section. Regulation tags at each case. "Eksporter til Notat" btn-primary in header.

### Evidence Panel (460px, implemented)
Slide-in from right via evidence-slot with `--border` left border. Header: mono 10px label "Bevisgrunnlag" + 16px serif proposition. Timeline: `--border` left line, 28px paddingLeft, 40px spacing between cases. Evolution-differentiated dots (established: 2.5px solid `--ink`, confirmed: 2px solid `--confirm-color`, qualified: 2px dashed `--qualified-color`, consolidating: 2px solid `--ink-muted`). Case header: 12px mono 700 ref + EvolutionTag + regulation tag (9px mono, `--border` border) + year + star. Factum: 16px serif `--ink-tertiary`. Assessment: 16px serif 600 `--ink`. Quotes: `--paper-dark` bg, `--border` border, copy-on-hover. Nuances: AlertTriangle + `--nuance-color` label. Lineage: 10px toggle, 2px `--ai-border` left border, italic serif. Boundary notes: collapsible section toggle (11px sans 600 uppercase). Tension block at top: `--tension-border`/`--tension-bg`, "Gå til" cross-link with underline hover. State resets when switching rules.

### Reading View (Fullscreen)
720px max-width + 240px sidebar. KI-screening as collapsible structured layer (factum → assessment → proposition → quotes). Sticky section tabs. Paragraph anchors (48px column, click to copy ref). KI-quoted paragraphs: 2px `border-left` ai-accent + Sparkles. Cross-refs as `.ref-link` (dotted underline, `--ref-link` color). Sidebar: related cases + provisions.

### Reading Panel (420px, Arbeidsflaten)
Compact: KI collapsed default, section nav as dropdown, no sidebar. Maximize2 button → fullscreen.

### Provision Tag
JetBrains Mono, `--paper-dark` bg, `--border` border, 2px 8px. Secondary: dashed `--border-strong`.

### Quote Block
`--paper-dark` bg, `--border` border. Copy button on hover. Avsnitt ref in mono 10px.

### Action Button (shared)
Defined globally in `tokens.css`. 11px Albert Sans 500, 4px 12px padding, 2px radius, `--border` border, `--ink-tertiary` text. `.ai` variant: `--ai-border` / `--ai-accent`. Used in register rows, reading panel, scope panel, rettssetningsregister.

### Primary Button (shared)
Defined globally in `tokens.css` as `.btn-primary`. 12px Albert Sans 500, 8px 16px padding, 2px radius, `--btn-primary-bg`/`--btn-primary-fg`. Hover: `--btn-primary-hover`. Used for "Eksporter til Notat", "Lagre" edit actions.

### Bulk Action Bar
Inverted surface — hardcoded `#1C1B1A` bg with `#F8F6F1` text. Works in both color modes. Floats bottom-center with `mockup-slide-up` entrance animation (200ms).

### Narrative Filter Sentence
30px Newsreader. Tertiary connective, ink variable. Phase colors when filtered.

---

## Interaction States

All elements: default, hover, active (scale 0.97–0.98), focus-visible (`outline: 2px solid --control-border-focus`, `outline-offset: 2px`). Row focus uses `box-shadow: inset 2px 0 0` instead of outline.

| Element | Hover |
|---|---|
| Rows | `--hover-bg` + arrow/context appears |
| Controls | border → `--border-strong` |
| Primary btn (light) | bg → `#000` |
| Primary btn (dark) | bg → `--hover-bg-strong` |
| Logo | border → `--border-strong` |
| Quotes | copy btn fades in |
| Para numbers | opacity increases |
| Editable fields | border → `--border-strong` |
| Text links | color → `--ink` |

### Transitions
- Micro: 0.15s ease
- Dropdown: 0.15s dropIn
- Page load: 0.7s staggered fadeUp
- Panel: 0.25s cubic-bezier(0.16, 1, 0.3, 1)
- No spring/bounce

---

## KI Ownership Model

**Redigert = eid.** No intermediate state. Lineage always available.

| Owner | Treatment |
|---|---|
| KI uberørt | Italic, `--ai-accent`, Sparkles, `border-left` ocher |
| Jurist-eid | Normal, `--ink`, no marking |
| KI-tolket kobling | Sparkles at instance |
| KI-resonnement | Collapsed, Sparkles header, `border-left` ocher, read-only |

---

## Open Questions

- **Phase colors on structural elements** — monochrome now, may aid scanning at scale
- **Search behavior in portfolio** — undefined
- **Grafvisningen** — implemented as mockup prototype
- **Notat-perspektivet** — undesigned, should feel like text editor
- **"Marker som Rettssetning" flow** — should offer "Opprett ny" or "Knytt til eksisterende"
- **AI-assisted grouping** — tags are user-set, KI suggestion open
- **Responsive below 1200px** — scope collapses, details undefined

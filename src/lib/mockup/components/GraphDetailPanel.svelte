<script lang="ts">
  import { X, Network, Star, Sparkles, ChevronRight, ExternalLink } from 'lucide-svelte';
  import {
    ALL_NODES,
    SIGNAL_META,
    CAT_LABELS,
    MARK_COLORS,
    getCitationRate,
    getCitesFrom,
    getCitedBy,
    getProvisionRefs,
    getCasesForProvision,
    type GraphNode,
    type CaseNode,
  } from '$lib/mockup/data/graf';

  let {
    selectedNode,
    isolatedIds = new Set<string>(),
    nodeMarks = {},
    onSelectNode,
    onClose,
  }: {
    selectedNode: GraphNode;
    isolatedIds: Set<string>;
    nodeMarks: Record<string, string>;
    onSelectNode: (id: string) => void;
    onClose: () => void;
  } = $props();

  function findNode(id: string) {
    return ALL_NODES.find((n) => n.id === id);
  }

  function getMarkHex(id: string): string | null {
    const mc = nodeMarks[id];
    if (!mc) return null;
    return MARK_COLORS.find((c) => c.id === mc)?.hex ?? null;
  }
</script>

<aside class="detail-panel slide-in">
  <header class="panel-header">
    <div class="panel-header-content">
      <div class="panel-label">
        <Network size={11} />
        {selectedNode.type === 'case' ? 'Sak' : 'Bestemmelse'}
      </div>
      <h2 class="panel-title">{selectedNode.ref}</h2>
      <div class="panel-meta">
        {#if selectedNode.type === 'case'}
          {selectedNode.source} &middot; {selectedNode.year}
        {:else}
          {selectedNode.label}
        {/if}
      </div>
    </div>
    <button class="close-btn" onclick={onClose}>
      <X size={16} />
    </button>
  </header>

  <div class="panel-body">
    {#if selectedNode.type === 'case'}
      {@const caseNode = selectedNode as CaseNode}

      <!-- Category + Star + Isolated -->
      <div class="meta-row">
        {#if caseNode.category}
          <span class="cat-badge" class:cat-a={caseNode.category === 'A'}>
            {caseNode.category} — {CAT_LABELS[caseNode.category]}
          </span>
        {:else}
          <span class="cat-badge unrated">Uvurdert</span>
        {/if}
        {#if caseNode.star}
          <span class="star-badge">
            <Star size={11} fill="currentColor" /> Gullkandidat
          </span>
        {/if}
        {#if isolatedIds.has(caseNode.id)}
          <span class="isolated-label">isolert</span>
        {/if}
      </div>

      <!-- Signals -->
      <div class="section">
        <div class="section-label">Funnet via</div>
        <div class="signal-chips">
          {#each caseNode.signals as sig}
            {@const m = SIGNAL_META[sig]}
            <span class="signal-chip" style="color:{m.color};background:{m.bg};border-color:{m.border}">
              [{sig}] {m.label}
            </span>
          {/each}
        </div>
      </div>

      <!-- Citation rate -->
      <div class="citation-row">
        {#if caseNode.citedBy > 0}
          <span class="cite-count">&nearr;{caseNode.citedBy}</span> siteringer &middot; {getCitationRate(caseNode).toFixed(1)}/år
        {:else}
          Ingen siteringer ennå
        {/if}
      </div>

      <!-- KI proposition -->
      {#if caseNode.proposition}
        <div class="section">
          <div class="section-label ai-label">
            <Sparkles size={10} /> KI-proposisjon
          </div>
          <p class="proposition">{caseNode.proposition}</p>
        </div>
      {:else}
        <div class="no-screening">
          <Sparkles size={16} />
          <div class="no-screening-text">Ikke screenet</div>
        </div>
      {/if}

      <!-- Cites from -->
      {@const citesFrom = getCitesFrom(caseNode.id)}
      {#if citesFrom.length > 0}
        <div class="section">
          <div class="section-label">Siterer ({citesFrom.length})</div>
          {#each citesFrom as id}
            {@const nd = findNode(id)}
            {@const mh = getMarkHex(id)}
            {#if nd}
              <button class="detail-row" onclick={() => onSelectNode(id)}>
                {#if mh}
                  <div class="mark-dot" style="border-color:{mh}"></div>
                {/if}
                {#if nd.type === 'case' && nd.category}
                  <span class="row-cat" class:cat-a={nd.category === 'A'}>{nd.category}</span>
                {/if}
                <span class="row-ref">{nd.ref}</span>
                <span class="row-year">{nd.type === 'case' ? nd.year : ''}</span>
                <ChevronRight size={10} />
              </button>
            {/if}
          {/each}
        </div>
      {/if}

      <!-- Cited by -->
      {@const citedByList = getCitedBy(caseNode.id)}
      {#if citedByList.length > 0}
        <div class="section">
          <div class="section-label">Sitert av ({citedByList.length})</div>
          {#each citedByList as id}
            {@const nd = findNode(id)}
            {@const mh = getMarkHex(id)}
            {#if nd}
              <button class="detail-row" onclick={() => onSelectNode(id)}>
                {#if mh}
                  <div class="mark-dot" style="border-color:{mh}"></div>
                {/if}
                {#if nd.type === 'case' && nd.category}
                  <span class="row-cat" class:cat-a={nd.category === 'A'}>{nd.category}</span>
                {/if}
                <span class="row-ref">{nd.ref}</span>
                <span class="row-year">{nd.type === 'case' ? nd.year : ''}</span>
                <ChevronRight size={10} />
              </button>
            {/if}
          {/each}
        </div>
      {/if}

      <!-- Provision refs -->
      {@const provRefs = getProvisionRefs(caseNode.id).map(findNode).filter(Boolean)}
      {#if provRefs.length > 0}
        <div class="section">
          <div class="section-label">Refererer til</div>
          <div class="prov-tags">
            {#each provRefs as p}
              {#if p}
                <button class="prov-tag" onclick={() => onSelectNode(p.id)}>{p.ref}</button>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      <!-- Actions -->
      <div class="actions">
        <button class="action-btn full">
          <ExternalLink size={12} /> Åpne i lesevisning
        </button>
        <!-- FUTURE: Kryssnavigasjon — "Vis i Saksoversikten" og "Vis i Rettssetninger".
             Krever: delt selectedCaseId-state mellom perspektiver via parent.
             Se paragraf-graf-v4.jsx kommentar "KRYSSNAVIGASJON" for spec. -->
      </div>
    {/if}

    {#if selectedNode.type === 'provision'}
      {@const cases = getCasesForProvision(selectedNode.id)}
      <div class="section">
        <div class="section-label">Referert i {cases.length} saker</div>
        {#each cases as id}
          {@const nd = findNode(id)}
          {@const mh = getMarkHex(id)}
          {#if nd}
            <button class="detail-row" onclick={() => onSelectNode(id)}>
              {#if mh}
                <div class="mark-dot" style="border-color:{mh}"></div>
              {/if}
              {#if nd.type === 'case' && nd.category}
                <span class="row-cat" class:cat-a={nd.category === 'A'}>{nd.category}</span>
              {/if}
              <span class="row-ref">{nd.ref}</span>
              <span class="row-year">{nd.type === 'case' ? nd.year : ''}</span>
              <ChevronRight size={10} />
            </button>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</aside>

<style>
  .detail-panel {
    width: 380px;
    flex-shrink: 0;
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 10;
  }

  .slide-in {
    animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(16px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .panel-header-content {
    flex: 1;
    padding-right: 12px;
  }

  .panel-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-muted);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .panel-title {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
  }

  .panel-meta {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-tertiary);
    margin-top: 4px;
  }

  .close-btn {
    padding: 4px;
    border: none;
    background: transparent;
    color: var(--ink-tertiary);
    cursor: pointer;
    flex-shrink: 0;
    border-radius: 2px;
    transition: color 0.15s ease;
  }

  .close-btn:hover {
    color: var(--ink);
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px 48px;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .cat-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 2px;
    border: 1px solid var(--border);
    color: var(--ink-tertiary);
  }

  .cat-badge.cat-a {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .cat-badge.unrated {
    border: 1px dashed var(--border-strong);
    color: var(--ink-muted);
    font-weight: 600;
  }

  .star-badge {
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--gold-star);
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
  }

  .isolated-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-style: italic;
    color: var(--ink-muted);
  }

  .section {
    margin-bottom: 20px;
  }

  .section-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    margin-bottom: 8px;
  }

  .ai-label {
    color: var(--ai-accent);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .signal-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .signal-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    border-radius: 2px;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 600;
    border: 1px solid;
  }

  .citation-row {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-tertiary);
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .cite-count {
    font-weight: 700;
    color: var(--ink);
  }

  .proposition {
    font-family: var(--font-serif);
    font-size: 15px;
    font-style: italic;
    line-height: 1.55;
    color: var(--ai-accent);
    border-left: 2px solid var(--ai-border);
    padding-left: 12px;
  }

  .no-screening {
    margin-bottom: 20px;
    border: 1px dashed var(--ai-border);
    padding: 16px;
    border-radius: 3px;
    text-align: center;
    color: var(--ai-accent);
    opacity: 0.5;
  }

  .no-screening-text {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-muted);
    margin-top: 6px;
  }

  .detail-row {
    width: 100%;
    padding: 6px 4px;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: background 0.15s ease;
    border-radius: 2px;
    background: transparent;
    color: var(--ink-muted);
    text-align: left;
  }

  .detail-row:hover {
    background: var(--hover-bg);
  }

  .detail-row:active {
    transform: scale(0.98);
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .mark-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid;
    flex-shrink: 0;
  }

  .row-cat {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    flex-shrink: 0;
    border: 1px solid var(--border);
    color: var(--ink-muted);
  }

  .row-cat.cat-a {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .row-ref {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink);
  }

  .row-year {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-muted);
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }

  .prov-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .prov-tag {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-tertiary);
    background: var(--paper-dark);
    border: 1px solid var(--border);
    padding: 2px 8px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .prov-tag:hover {
    border-color: var(--border-strong);
    color: var(--ink);
  }

  .actions {
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--border-subtle);
  }

  .full {
    width: 100%;
    justify-content: center;
    padding: 8px 16px;
  }
</style>

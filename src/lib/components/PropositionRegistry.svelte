<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { pipelineState } from '$lib/stores/pipeline.svelte';
  import { crossPropositions } from '$lib/api/analyses';
  import { toastState } from '$lib/stores/toast.svelte';
  import {
    EVOLUTION_CONFIG,
    type Proposition,
    type PropositionInstance,
    type EvolutionType,
  } from '$lib/types/analysis';

  type OrderedEntry = { prop: Proposition; tensionAfter?: { withId: string; note: string } };

  function orderPropositions(propositions: Proposition[]): OrderedEntry[] {
    const ordered: OrderedEntry[] = [];
    const used = new Set<string>();

    for (const p of propositions) {
      if (p.tension) {
        const target = propositions.find((t) => t.id === p.tension!.withId);
        if (target && !used.has(target.id)) {
          ordered.push({ prop: target, tensionAfter: p.tension });
          used.add(target.id);
        }
        if (!used.has(p.id)) {
          ordered.push({ prop: p });
          used.add(p.id);
        }
      }
    }
    for (const p of propositions) {
      if (!used.has(p.id)) ordered.push({ prop: p });
    }
    return ordered;
  }

  function evolutionColor(type: string): string {
    return EVOLUTION_CONFIG[type as EvolutionType]?.color ?? 'var(--p-ink3)';
  }

  // Track which proposition cards are collapsed (all open by default)
  let collapsed = $state<Set<string>>(new Set());

  function toggleCard(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  // Group propositions by theme
  let themes = $derived([...new Set(pipelineState.propositions.map((p) => p.theme))]);

  let propositionsByTheme = $derived.by(() => {
    const map: Record<string, Proposition[]> = {};
    for (const theme of themes) {
      map[theme] = pipelineState.propositions.filter((p) => p.theme === theme);
    }
    return map;
  });

  let hasPropositions = $derived(pipelineState.propositions.length > 0);

  async function runCrossAnalysis() {
    const id = analysisState.analysis.id;
    pipelineState.setCrossPropositionsLoading(true);
    try {
      const result = await crossPropositions(id);
      pipelineState.setPropositions(result.propositions);
      toastState.show(`${result.propositions.length} rettssetninger identifisert`, 'success');
    } catch {
      toastState.show('Tverrgående analyse feilet', 'error');
    } finally {
      pipelineState.setCrossPropositionsLoading(false);
    }
  }
</script>

<div class="registry">
  {#if !hasPropositions}
    <div class="empty-state">
      <div class="empty-icon">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M9 12h6M12 9v6" stroke-linecap="round" />
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      </div>
      <div class="empty-title">Rettssetningsregister</div>
      <div class="empty-desc">
        Kjør tverrgående analyse av screenede saker for å identifisere rettssetninger, spore
        utvikling og avdekke spenninger.
      </div>
      <button
        class="generate-btn"
        onclick={runCrossAnalysis}
        disabled={pipelineState.crossPropositionsLoading}
      >
        {#if pipelineState.crossPropositionsLoading}
          <span class="spinner"></span>
          Analyserer…
        {:else}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
            />
          </svg>
          Analyser rettssetninger
        {/if}
      </button>
    </div>
  {:else}
    <div class="registry-content">
      {#each themes as theme}
        {@const props = propositionsByTheme[theme]}
        {@const ordered = orderPropositions(props)}
        {@const hasTension = props.some((p) => p.tension)}

        <div class="theme-group">
          <div class="theme-header">
            <div class="theme-bar"></div>
            <span class="theme-name">{theme}</span>
            {#if hasTension}
              <span class="theme-tension-badge">spenning</span>
            {/if}
          </div>

          <div class="theme-cards">
            {#each ordered as { prop, tensionAfter }, i}
              {@const isExpanded = !collapsed.has(prop.id)}
              <div>
                <!-- Proposition card -->
                <div class="prop-card" class:has-tension={!!prop.tension}>
                  <button class="prop-header" onclick={() => toggleCard(prop.id)}>
                    <svg
                      class="chevron"
                      class:open={isExpanded}
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                    >
                      <path
                        d="M2 0.5L6 4L2 7.5"
                        stroke="currentColor"
                        stroke-width="1.5"
                        fill="none"
                        stroke-linecap="round"
                      />
                    </svg>
                    <div class="prop-header-content">
                      <div class="prop-text">{prop.proposition}</div>
                      <div class="prop-meta">
                        <span>
                          {prop.instances.length === 1
                            ? '1 forekomst'
                            : `${prop.instances.length} forekomster`}
                        </span>
                        <span>·</span>
                        <span>
                          {prop.instances[0]?.date.slice(0, 4)}{prop.instances.length > 1
                            ? `–${prop.instances[prop.instances.length - 1].date.slice(0, 4)}`
                            : ''}
                        </span>
                        {#if prop.instances.some((inst) => inst.suggested)}
                          <span class="ai-badge">Inneholder AI-forslag</span>
                        {/if}
                      </div>
                    </div>
                  </button>

                  {#if isExpanded}
                    <div class="prop-instances">
                      {#each prop.instances as inst, idx}
                        {@const isLast = idx === prop.instances.length - 1}
                        {@const ev = EVOLUTION_CONFIG[inst.evolution]}
                        <div class="instance" class:last={isLast}>
                          <!-- Timeline dot -->
                          <div
                            class="timeline-dot"
                            style:border-color={evolutionColor(inst.evolution)}
                          ></div>
                          <!-- Timeline line -->
                          {#if !isLast}
                            <div class="timeline-line"></div>
                          {/if}
                          <!-- Instance content -->
                          <div class="instance-content">
                            <div class="instance-header">
                              <span class="instance-case">{inst.caseId} §{inst.paragraph}</span>
                              {#if ev}
                                <span
                                  class="evo-badge"
                                  style:background={ev.bg}
                                  style:color={ev.color}>{ev.label}</span
                                >
                              {/if}
                              <span class="instance-date">{inst.date}</span>
                              {#if inst.suggested}
                                <span class="ai-badge">AI-forslag</span>
                              {/if}
                            </div>
                            <div class="instance-quote">«{inst.quote}»</div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Tension connector or gap -->
                {#if tensionAfter}
                  <div class="tension-connector">
                    <svg width="14" height="14" viewBox="0 0 16 16" style="flex-shrink:0">
                      <path
                        d="M3 8H13M13 8L10 5M13 8L10 11"
                        stroke="var(--p-tension)"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M13 8H3M3 8L6 5M3 8L6 11"
                        stroke="var(--p-tension)"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        opacity="0.3"
                      />
                    </svg>
                    <span>{tensionAfter.note}</span>
                  </div>
                {:else if i < ordered.length - 1}
                  <div class="card-gap"></div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .registry {
    height: 100%;
    overflow-y: auto;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 32px;
    text-align: center;
    gap: 12px;
  }
  .empty-icon {
    color: var(--p-ink4);
    margin-bottom: 4px;
  }
  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--p-ink);
  }
  .empty-desc {
    font-size: 13px;
    line-height: 1.55;
    color: var(--p-ink3);
    max-width: 360px;
  }
  .generate-btn {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-lg);
    background: var(--p-ink);
    color: var(--p-panel);
    font-size: 13px;
    font-weight: 500;
    margin-top: 8px;
  }
  .generate-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .generate-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  /* Registry content */
  .registry-content {
    max-width: 640px;
    margin: 0 auto;
    padding: 20px 16px;
  }

  /* Theme group */
  .theme-group {
    margin-bottom: 24px;
  }
  .theme-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding-left: 2px;
  }
  .theme-bar {
    width: 3px;
    height: 14px;
    border-radius: 2px;
    background: var(--p-provision-accent);
    opacity: 0.5;
  }
  .theme-name {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink3);
  }
  .theme-tension-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--p-tension-bg);
    color: var(--p-tension);
  }
  .theme-cards {
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .card-gap {
    height: 6px;
  }

  /* Proposition card */
  .prop-card {
    background: var(--p-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--p-border);
    overflow: hidden;
  }
  .prop-card.has-tension {
    border-color: var(--p-tension-border);
  }
  .prop-header {
    all: unset;
    cursor: pointer;
    width: 100%;
    padding: 12px 14px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    text-align: left;
  }
  .chevron {
    margin-top: 5px;
    flex-shrink: 0;
    opacity: 0.35;
    transition: transform 0.15s ease;
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .prop-header-content {
    flex: 1;
  }
  .prop-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--p-ink);
    line-height: 1.4;
    letter-spacing: -0.01em;
  }
  .prop-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 3px;
    font-size: 11px;
    color: var(--p-ink4);
  }
  .ai-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--p-highlight);
    border: 1px solid var(--p-ai-border-subtle);
    color: var(--p-ai-text);
  }

  /* Instances timeline */
  .prop-instances {
    padding: 2px 14px 14px 30px;
  }
  .instance {
    position: relative;
    padding-left: 22px;
    padding-bottom: 16px;
  }
  .instance.last {
    padding-bottom: 0;
  }
  .timeline-dot {
    position: absolute;
    left: 0;
    top: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--p-surface);
    border: 2px solid var(--p-ink3);
  }
  .timeline-line {
    position: absolute;
    left: 3.5px;
    top: 16px;
    width: 1px;
    bottom: 0;
    background: var(--p-border-m);
  }
  .instance-content {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .instance-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .instance-case {
    font-family: var(--font-data);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--p-kofa-accent);
    cursor: pointer;
    border-bottom: 1px solid transparent;
    padding-bottom: 1px;
    transition: border-color 0.15s ease;
  }
  .instance-case:hover {
    border-bottom-color: var(--p-kofa-accent);
  }
  .instance-date {
    font-size: 11px;
    color: var(--p-ink4);
  }
  .evo-badge {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    padding: 2px 7px;
    border-radius: 3px;
  }
  .instance-quote {
    font-size: 13.5px;
    line-height: 1.65;
    color: var(--p-ink);
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-highlight);
    border-left: 3px solid var(--p-kofa-bg);
  }

  /* Tension connector */
  .tension-connector {
    margin: 2px 0 10px;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    background: var(--p-tension-bg);
    border-left: 3px solid var(--p-tension-border);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--p-tension);
    line-height: 1.45;
  }
</style>

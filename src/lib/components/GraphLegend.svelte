<script lang="ts">
  let expanded = $state(false);
</script>

<div class="legend">
  <button class="toggle" onclick={() => (expanded = !expanded)}>
    Tegnforklaring {expanded ? '▾' : '▸'}
  </button>

  {#if expanded}
    <div class="section">
      <div class="section-title">Nodetyper</div>

      <div class="row">
        <svg width="12" height="9" viewBox="0 0 12 9">
          <rect
            x="0.5"
            y="0.5"
            width="11"
            height="8"
            rx="2"
            fill="var(--p-provision-bg)"
            stroke="var(--p-provision-border)"
            stroke-width="0.8"
          />
        </svg>
        <span>Bestemmelse</span>
      </div>

      <div class="row">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <circle
            cx="6"
            cy="6"
            r="5"
            fill="var(--p-kofa-bg)"
            stroke="var(--p-kofa-border)"
            stroke-width="0.8"
          />
        </svg>
        <span>KOFA-sak</span>
      </div>

      <div class="row">
        <svg width="12" height="12" viewBox="0 0 14 14">
          <rect
            x="3"
            y="3"
            width="8"
            height="8"
            rx="1.5"
            fill="var(--p-eu-bg)"
            stroke="var(--p-eu-border)"
            stroke-width="0.8"
            transform="rotate(45 7 7)"
          />
        </svg>
        <span>EU-dom</span>
      </div>

      <div class="row">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <circle
            cx="6"
            cy="6"
            r="5"
            fill="var(--p-court-bg)"
            stroke="var(--p-court-border)"
            stroke-width="0.8"
          />
        </svg>
        <span>Rettsavgjørelse</span>
      </div>

      <div class="row">
        <svg width="12" height="8" viewBox="0 0 12 8">
          <rect
            x="0.5"
            y="0.5"
            width="11"
            height="7"
            rx="1.5"
            fill="var(--p-prep-bg)"
            stroke="var(--p-prep-border)"
            stroke-width="0.8"
            opacity="0.6"
          />
        </svg>
        <span>Forarbeid</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Kantvalens</div>

      <div class="row">
        <svg width="24" height="6" viewBox="0 0 24 6">
          <line
            x1="0"
            y1="3"
            x2="24"
            y2="3"
            stroke="var(--p-ink)"
            stroke-width="1.5"
            opacity="0.13"
          />
        </svg>
        <span>Bekreftende / ukjent</span>
      </div>

      <div class="row">
        <svg width="24" height="6" viewBox="0 0 24 6">
          <line
            x1="0"
            y1="3"
            x2="24"
            y2="3"
            stroke="var(--p-warn)"
            stroke-width="1.5"
            stroke-dasharray="5,3"
          />
        </svg>
        <span>Avgrensende</span>
      </div>

      <div class="row">
        <svg width="24" height="6" viewBox="0 0 24 6">
          <line
            x1="0"
            y1="3"
            x2="24"
            y2="3"
            stroke="var(--p-danger)"
            stroke-width="1.5"
            stroke-dasharray="2,3"
          />
        </svg>
        <span>Fravikende</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .legend {
    position: absolute;
    top: 10px;
    right: 10px;
    background: var(--p-panel);
    border: 1px solid var(--p-border);
    border-radius: var(--radius-lg);
    padding: 6px 10px;
    font-size: 10px;
    color: var(--p-ink2);
    font-family: var(--font-ui);
    z-index: 50;
    user-select: none;
  }
  .toggle {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    font-weight: 600;
    font-size: 10px;
  }
  .toggle:hover {
    color: var(--p-ink);
  }
  .section {
    margin-top: 8px;
  }
  .section-title {
    font-weight: 600;
    color: var(--p-ink3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 9px;
    margin-bottom: 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
  }
  .row svg {
    flex-shrink: 0;
  }
</style>

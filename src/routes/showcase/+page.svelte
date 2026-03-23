<script lang="ts">
  // Showcase page — static visual variants of components
  // No store dependencies — all data is hardcoded mock data
</script>

<div class="showcase">
  <header class="showcase-header">
    <span class="brand">Paragraf</span>
    <span class="sep">·</span>
    <span class="page-title">Komponent-showcase</span>
  </header>

  <div class="showcase-body">
    <section class="component-section">
      <h2 class="section-title">PipelineStatusBar</h2>
      <p class="section-desc">
        Persistent statuslinje i midtpanelet. Viser pågående pipeline-operasjon med fase, fremdrift,
        detalj og varighet. Ekspanderbar ved klikk. Kollapser til oppsummering når ferdig.
      </p>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- In-context demo: bar above a simulated case list  -->
      <!-- ══════════════════════════════════════════════════ -->
      <div class="phase-group">
        <span class="phase-label">I kontekst — over sakslisten</span>
        <div class="context-demo">
          <div class="mock-bar active flush">
            <div class="bar-main">
              <span class="bar-icon"><span class="pulse">◐</span></span>
              <span class="bar-label">Screening</span>
              <span class="bar-progress">5/12 saker</span>
              <span class="bar-detail">2024/156</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">1:34</span>
            </div>
          </div>
          <div class="mock-list">
            <div class="mock-list-item highlight">
              <span class="ml-spinner"></span>
              <span class="ml-sak">2024/156</span>
              <span class="ml-cat cat-a">A</span>
              <span class="ml-desc">Forpliktelseserklæring ved tilbudsfrist</span>
            </div>
            <div class="mock-list-item done">
              <span class="ml-check">✓</span>
              <span class="ml-sak">2023/089</span>
              <span class="ml-cat cat-b">B</span>
              <span class="ml-desc">Tildelingskriterier — vekting</span>
            </div>
            <div class="mock-list-item queued">
              <span class="ml-queue-dot"></span>
              <span class="ml-sak">2022/312</span>
              <span class="ml-cat cat-a">A</span>
              <span class="ml-desc">Kvalifikasjonskrav for underleverandør</span>
            </div>
            <div class="mock-list-item queued">
              <span class="ml-queue-dot"></span>
              <span class="ml-sak">2021/445</span>
              <span class="ml-cat cat-b">B</span>
              <span class="ml-desc">Avvisningsplikt — ufullstendig tilbud</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- Søk                                                -->
      <!-- ══════════════════════════════════════════════════ -->
      <div class="phase-group">
        <span class="phase-label">Søk</span>

        <div class="variant">
          <span class="variant-label">Pågår — trinnvis</span>
          <div class="mock-bar active">
            <div class="bar-main">
              <span class="bar-icon"><span class="pulse">◐</span></span>
              <span class="bar-label">Kjører søk</span>
              <span class="bar-steps">
                <span class="step-done">✓ Ref.: 12</span>
                <span class="step-done">✓ Fulltekst: 18</span>
                <span class="step-active">◐ Semantisk…</span>
              </span>
              <span class="bar-spacer"></span>
              <span class="bar-time">0:08</span>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Fullført</span>
          <div class="mock-bar completed">
            <div class="bar-main">
              <span class="bar-icon"><span class="check">✓</span></span>
              <span class="bar-label">Søk fullført</span>
              <span class="bar-summary">34 kandidater · 12 ref. · 18 fulltekst · 22 semantisk</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">0:24</span>
              <button class="bar-dismiss" aria-label="Lukk">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- Screening                                          -->
      <!-- ══════════════════════════════════════════════════ -->
      <div class="phase-group">
        <span class="phase-label">Screening</span>

        <div class="variant">
          <span class="variant-label">Pågår — kollapsert</span>
          <div class="mock-bar active">
            <div class="bar-main">
              <span class="bar-icon"><span class="pulse">◐</span></span>
              <span class="bar-label">Screening</span>
              <span class="bar-progress">5/12 saker</span>
              <span class="bar-detail">2024/156</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">1:34</span>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Pågår — ekspandert med kø</span>
          <div class="mock-bar active">
            <div class="bar-main">
              <span class="bar-icon"><span class="pulse">◐</span></span>
              <span class="bar-label">Screening</span>
              <span class="bar-progress">5/12 saker</span>
              <span class="bar-detail">2024/156</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">1:34</span>
            </div>
            <div class="bar-expanded">
              <div class="exp-item exp-done">
                <span class="exp-icon"><span class="check-sm">✓</span></span>
                <span class="exp-sak">2024/201</span>
                <span class="exp-cat-badge cat-a">A</span>
                <span class="exp-spacer"></span>
                <span class="exp-result">Gullkandidat · 3 sitater verifisert</span>
                <span class="exp-time">0:18</span>
              </div>
              <div class="exp-item exp-done">
                <span class="exp-icon"><span class="check-sm">✓</span></span>
                <span class="exp-sak">2023/089</span>
                <span class="exp-cat-badge cat-b">B</span>
                <span class="exp-spacer"></span>
                <span class="exp-result">Relevant · 1 sitat trunkert</span>
                <span class="exp-time">0:14</span>
              </div>
              <div class="exp-item exp-done">
                <span class="exp-icon"><span class="check-sm">✓</span></span>
                <span class="exp-sak">2024/067</span>
                <span class="exp-cat-badge cat-a">A</span>
                <span class="exp-spacer"></span>
                <span class="exp-result">Gullkandidat · 5 sitater verifisert</span>
                <span class="exp-time">0:22</span>
              </div>
              <div class="exp-item exp-done">
                <span class="exp-icon"><span class="check-sm">✓</span></span>
                <span class="exp-sak">2023/344</span>
                <span class="exp-cat-badge cat-c">C</span>
                <span class="exp-spacer"></span>
                <span class="exp-result">Perifert relevant</span>
                <span class="exp-time">0:11</span>
              </div>
              <div class="exp-item exp-current">
                <span class="exp-icon"><span class="pulse-sm">◐</span></span>
                <span class="exp-sak">2024/156</span>
                <span class="exp-cat-badge cat-a">A</span>
                <span class="exp-spacer"></span>
                <span class="exp-status-active">Pågår…</span>
              </div>
              <div class="exp-item exp-queued">
                <span class="exp-icon"><span class="exp-dot"></span></span>
                <span class="exp-sak">2022/312</span>
                <span class="exp-cat-badge cat-a">A</span>
                <span class="exp-spacer"></span>
                <span class="exp-status-queued">I kø</span>
              </div>
              <div class="exp-item exp-queued">
                <span class="exp-icon"><span class="exp-dot"></span></span>
                <span class="exp-sak">2021/445</span>
                <span class="exp-cat-badge cat-b">B</span>
                <span class="exp-spacer"></span>
                <span class="exp-status-queued">I kø</span>
              </div>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Fullført</span>
          <div class="mock-bar completed">
            <div class="bar-main">
              <span class="bar-icon"><span class="check">✓</span></span>
              <span class="bar-label">Screening fullført</span>
              <span class="bar-summary">12 screenet · 4A 6B 2C · 1 sitatfeil</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">4:12</span>
              <button class="bar-dismiss" aria-label="Lukk">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- Sitatverifisering                                  -->
      <!-- ══════════════════════════════════════════════════ -->
      <div class="phase-group">
        <span class="phase-label"
          >Sitatverifisering <span class="phase-note">(i dag usynlig)</span></span
        >

        <div class="variant">
          <span class="variant-label">Pågår</span>
          <div class="mock-bar active">
            <div class="bar-main">
              <span class="bar-icon"><span class="pulse">◐</span></span>
              <span class="bar-label">Verifiserer sitater</span>
              <span class="bar-progress">8/24</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">0:22</span>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Fullført</span>
          <div class="mock-bar completed">
            <div class="bar-main">
              <span class="bar-icon"><span class="check">✓</span></span>
              <span class="bar-label">Sitater verifisert</span>
              <span class="bar-summary">22 ok · 1 trunkert · 1 feil</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">0:31</span>
              <button class="bar-dismiss" aria-label="Lukk">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- Syntese                                            -->
      <!-- ══════════════════════════════════════════════════ -->
      <div class="phase-group">
        <span class="phase-label">Syntese</span>

        <div class="variant">
          <span class="variant-label">Pågår — med tool calls</span>
          <div class="mock-bar active">
            <div class="bar-main">
              <span class="bar-icon"><span class="pulse">◐</span></span>
              <span class="bar-label">Genererer notat</span>
              <span class="bar-detail">Henter avs. fra 2023/42</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">2:15</span>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Pågår — ekspandert stream-logg</span>
          <div class="mock-bar active">
            <div class="bar-main">
              <span class="bar-icon"><span class="pulse">◐</span></span>
              <span class="bar-label">Genererer notat</span>
              <span class="bar-detail">Henter avs. fra 2023/42</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">2:15</span>
            </div>
            <div class="bar-expanded">
              <div class="exp-item exp-done">
                <span class="exp-icon"><span class="check-sm">✓</span></span>
                <span class="exp-stream-label">Laster screeningresultater…</span>
              </div>
              <div class="exp-item exp-done">
                <span class="exp-icon"><span class="check-sm">✓</span></span>
                <span class="exp-stream-label">Analyserer materialet…</span>
              </div>
              <div class="exp-item exp-done">
                <span class="exp-icon"><span class="check-sm">✓</span></span>
                <span class="exp-stream-label">Henter avs. 3, 7, 12 fra 2024/201</span>
              </div>
              <div class="exp-item exp-done">
                <span class="exp-icon"><span class="check-sm">✓</span></span>
                <span class="exp-stream-label">Henter avs. 1, 4 fra 2023/089</span>
              </div>
              <div class="exp-item exp-current">
                <span class="exp-icon"><span class="pulse-sm">◐</span></span>
                <span class="exp-stream-label">Henter avs. fra 2023/42</span>
              </div>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Fullført</span>
          <div class="mock-bar completed">
            <div class="bar-main">
              <span class="bar-icon"><span class="check">✓</span></span>
              <span class="bar-label">Syntese fullført</span>
              <span class="bar-summary">5 seksjoner · 8 oppslag · $0.42</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">3:47</span>
              <button class="bar-dismiss" aria-label="Lukk">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- QA                                                 -->
      <!-- ══════════════════════════════════════════════════ -->
      <div class="phase-group">
        <span class="phase-label">Kvalitetssikring</span>

        <div class="variant">
          <span class="variant-label">Pågår</span>
          <div class="mock-bar active">
            <div class="bar-main">
              <span class="bar-icon"><span class="pulse">◐</span></span>
              <span class="bar-label">Kjører KS</span>
              <span class="bar-detail">Sjekker sitater</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">1:03</span>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Fullført — med merknader</span>
          <div class="mock-bar completed">
            <div class="bar-main">
              <span class="bar-icon"><span class="check">✓</span></span>
              <span class="bar-label">KS fullført</span>
              <span class="bar-summary">2 merknader · 1 sitatfeil · 1 motstrid</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">1:15</span>
              <button class="bar-dismiss" aria-label="Lukk">✕</button>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Fullført — rent</span>
          <div class="mock-bar completed">
            <div class="bar-main">
              <span class="bar-icon"><span class="check">✓</span></span>
              <span class="bar-label">KS fullført</span>
              <span class="bar-summary">Ingen merknader</span>
              <span class="bar-spacer"></span>
              <span class="bar-time">0:58</span>
              <button class="bar-dismiss" aria-label="Lukk">✕</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════ -->
      <!-- Spesialtilstander                                  -->
      <!-- ══════════════════════════════════════════════════ -->
      <div class="phase-group">
        <span class="phase-label">Spesialtilstander</span>

        <div class="variant">
          <span class="variant-label">Feil</span>
          <div class="mock-bar error">
            <div class="bar-main">
              <span class="bar-icon"><span class="error-icon">✗</span></span>
              <span class="bar-label">Syntese feilet</span>
              <span class="bar-error-msg">API timeout etter 300s</span>
              <span class="bar-spacer"></span>
              <button class="bar-retry">Prøv igjen</button>
              <button class="bar-dismiss" aria-label="Lukk">✕</button>
            </div>
          </div>
        </div>

        <div class="variant">
          <span class="variant-label">Stablet — historikk + aktiv operasjon</span>
          <div class="mock-bar-stack">
            <div class="mock-bar completed stacked-top">
              <div class="bar-main compact">
                <span class="bar-icon"><span class="check">✓</span></span>
                <span class="bar-summary"
                  >Søk: 34 kandidater · Screening: 12 saker · 1 sitatfeil</span
                >
                <span class="bar-spacer"></span>
                <span class="bar-time">5:02</span>
              </div>
            </div>
            <div class="mock-bar active stacked-bottom">
              <div class="bar-main">
                <span class="bar-icon"><span class="pulse">◐</span></span>
                <span class="bar-label">Genererer notat</span>
                <span class="bar-detail">Analyserer materialet…</span>
                <span class="bar-spacer"></span>
                <span class="bar-time">1:03</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  /* ═══════════════════════════════════════════════════════ */
  /* Showcase layout                                         */
  /* ═══════════════════════════════════════════════════════ */
  .showcase {
    min-height: 100vh;
    background: var(--p-bg);
    display: flex;
    flex-direction: column;
  }
  .showcase-header {
    padding: 10px 24px;
    border-bottom: 1px solid var(--p-border);
    background: var(--p-panel);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .brand {
    font-size: 13px;
    font-weight: 700;
    color: var(--p-ink);
    letter-spacing: -0.02em;
  }
  .sep {
    color: var(--p-ink4);
    font-size: 10px;
  }
  .page-title {
    font-size: 12px;
    color: var(--p-ink3);
    font-weight: 500;
  }
  .showcase-body {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px 64px;
    width: 100%;
  }

  /* ═══════════════════════════════════════════════════════ */
  /* Component section                                       */
  /* ═══════════════════════════════════════════════════════ */
  .component-section {
    margin-bottom: 48px;
  }
  .section-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--p-ink);
    letter-spacing: -0.02em;
    margin: 0 0 4px;
  }
  .section-desc {
    font-size: 12px;
    color: var(--p-ink3);
    line-height: 1.55;
    margin: 0 0 32px;
    max-width: 560px;
  }

  /* ═══════════════════════════════════════════════════════ */
  /* Phase groups — pipeline phases cluster variants         */
  /* ═══════════════════════════════════════════════════════ */
  .phase-group {
    margin-bottom: 28px;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--p-border);
  }
  .phase-group:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
  .phase-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--p-ink2);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .phase-note {
    font-weight: 500;
    color: var(--p-ink4);
    text-transform: none;
    letter-spacing: 0;
  }

  /* ═══════════════════════════════════════════════════════ */
  /* Variant wrapper                                         */
  /* ═══════════════════════════════════════════════════════ */
  .variant {
    margin-bottom: 16px;
  }
  .variant:last-child {
    margin-bottom: 0;
  }
  .variant-label {
    display: block;
    font-size: 10px;
    font-weight: 500;
    color: var(--p-ink4);
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }

  /* ═══════════════════════════════════════════════════════ */
  /* In-context demo                                         */
  /* ═══════════════════════════════════════════════════════ */
  .context-demo {
    border: 1px solid var(--p-border-m);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--p-bg);
  }
  .mock-list {
    display: flex;
    flex-direction: column;
  }
  .mock-list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--p-border);
    font-size: 12px;
  }
  .mock-list-item:last-child {
    border-bottom: none;
  }
  .mock-list-item.highlight {
    background: var(--p-highlight);
  }
  .mock-list-item.done {
    opacity: 0.7;
  }
  .mock-list-item.queued {
    opacity: 0.55;
  }
  .ml-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--p-border-m);
    border-top-color: var(--p-kofa-accent);
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  .ml-check {
    color: var(--p-success);
    font-size: 10px;
    font-weight: 700;
    width: 8px;
    text-align: center;
    flex-shrink: 0;
  }
  .ml-queue-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--p-ai-border);
    margin: 0 2px;
    flex-shrink: 0;
  }
  .ml-sak {
    font-family: var(--font-data);
    font-weight: 600;
    color: var(--p-ink);
    min-width: 56px;
    font-size: 12px;
  }
  .ml-cat {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: var(--radius-badge);
    flex-shrink: 0;
  }
  .ml-desc {
    color: var(--p-ink2);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ═══════════════════════════════════════════════════════ */
  /* Mock PipelineStatusBar                                  */
  /* ═══════════════════════════════════════════════════════ */
  .mock-bar {
    border: 1px solid var(--p-border);
    border-radius: var(--radius-md);
    border-left: 3px solid transparent;
    font-size: 11px;
    overflow: hidden;
    transition: background 0.1s ease;
  }
  .mock-bar.flush {
    border-radius: 0;
    border-left: 3px solid var(--p-ai-border);
    border-top: none;
  }
  .mock-bar.active {
    background: var(--p-highlight);
    border-left-color: var(--p-ai-border);
  }
  .mock-bar.completed {
    background: var(--p-surface);
    border-left-color: var(--p-success);
  }
  .mock-bar.error {
    background: var(--p-danger-bg);
    border-left-color: var(--p-danger);
  }

  /* Stacked variants */
  .mock-bar-stack {
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--p-border);
  }
  .mock-bar.stacked-top {
    border: none;
    border-radius: 0;
    border-bottom: 1px solid var(--p-border);
    border-left: 3px solid var(--p-success);
  }
  .mock-bar.stacked-bottom {
    border: none;
    border-radius: 0;
    border-left: 3px solid var(--p-ai-border);
  }

  .bar-main {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    min-height: 28px;
  }
  .bar-main.compact {
    padding: 4px 12px;
    min-height: 24px;
  }

  @media (hover: hover) {
    .mock-bar:not(.flush):hover {
      filter: brightness(0.98);
    }
  }

  .bar-icon {
    flex-shrink: 0;
    width: 14px;
    text-align: center;
    font-size: 12px;
  }

  .pulse {
    color: var(--p-kofa-accent);
    animation: pulse-fade 1.2s ease-in-out infinite;
  }
  .check {
    color: var(--p-success);
    font-weight: 700;
  }
  .error-icon {
    color: var(--p-danger);
    font-weight: 700;
  }

  .bar-label {
    font-weight: 600;
    color: var(--p-ink);
    white-space: nowrap;
  }

  .bar-progress {
    font-family: var(--font-data);
    color: var(--p-ink2);
    white-space: nowrap;
  }

  .bar-steps {
    display: flex;
    gap: 10px;
    font-family: var(--font-data);
  }
  .step-done {
    color: var(--p-success);
    font-weight: 500;
  }
  .step-active {
    color: var(--p-kofa-accent);
    font-weight: 500;
  }

  .bar-detail {
    font-family: var(--font-data);
    color: var(--p-ink3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bar-summary {
    color: var(--p-ink2);
    white-space: nowrap;
  }
  .bar-error-msg {
    color: var(--p-danger);
    font-size: 11px;
    white-space: nowrap;
  }

  .bar-spacer {
    flex: 1;
  }

  .bar-time {
    font-family: var(--font-data);
    color: var(--p-ink4);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-size: 10px;
  }

  .bar-dismiss {
    all: unset;
    cursor: pointer;
    color: var(--p-ink4);
    padding: 2px 4px;
    font-size: 11px;
    line-height: 1;
    border-radius: var(--radius-sm);
  }
  @media (hover: hover) {
    .bar-dismiss:hover {
      color: var(--p-ink2);
      background: var(--p-hover);
    }
  }

  .bar-retry {
    all: unset;
    cursor: pointer;
    font-size: 10px;
    font-weight: 600;
    color: var(--p-ink);
    padding: 3px 10px;
    border-radius: var(--radius-badge);
    border: 1px solid var(--p-border-m);
    background: var(--p-surface);
  }
  @media (hover: hover) {
    .bar-retry:hover {
      border-color: var(--p-border-s);
      background: var(--p-panel);
    }
  }

  /* ═══════════════════════════════════════════════════════ */
  /* Expanded list                                           */
  /* ═══════════════════════════════════════════════════════ */
  .bar-expanded {
    padding: 2px 12px 8px 34px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .exp-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--radius-md);
    font-size: 10px;
    border: 1px solid transparent;
  }
  .exp-item.exp-done {
    color: var(--p-ink3);
  }
  .exp-item.exp-current {
    background: var(--p-surface);
    border-color: var(--p-border);
  }
  .exp-item.exp-queued {
    color: var(--p-ink4);
  }

  .exp-icon {
    flex-shrink: 0;
    width: 12px;
    text-align: center;
  }
  .check-sm {
    color: var(--p-success);
    font-size: 10px;
    font-weight: 600;
    opacity: 0.6;
  }
  .pulse-sm {
    color: var(--p-kofa-accent);
    animation: pulse-fade 1.2s ease-in-out infinite;
    font-size: 10px;
  }
  .exp-dot {
    display: inline-block;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--p-ink4);
    margin: 0 auto;
  }

  .exp-sak {
    font-family: var(--font-data);
    font-weight: 600;
    color: inherit;
    min-width: 56px;
  }
  .exp-current .exp-sak {
    color: var(--p-ink);
  }

  /* Category badges in expanded list — match real app */
  .exp-cat-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 0px 4px;
    border-radius: var(--radius-badge);
    flex-shrink: 0;
    line-height: 16px;
  }
  .cat-a {
    background: var(--p-ink);
    color: var(--p-panel);
  }
  .cat-b {
    background: var(--p-ink3);
    color: var(--p-panel);
  }
  .cat-c {
    background: var(--p-input);
    color: var(--p-ink3);
  }

  .exp-spacer {
    flex: 1;
  }
  .exp-result {
    color: var(--p-ink3);
    text-align: right;
    white-space: nowrap;
  }
  .exp-status-active {
    color: var(--p-kofa-accent);
    font-weight: 500;
  }
  .exp-status-queued {
    color: var(--p-ink4);
  }
  .exp-time {
    font-family: var(--font-data);
    color: var(--p-ink4);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
    white-space: nowrap;
  }
  .exp-stream-label {
    color: inherit;
  }
  .exp-current .exp-stream-label {
    color: var(--p-ink);
  }

  /* ═══════════════════════════════════════════════════════ */
  /* Animations                                              */
  /* ═══════════════════════════════════════════════════════ */
  @keyframes pulse-fade {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

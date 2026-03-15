<script lang="ts">
  import { analysisState } from '$lib/stores/analysis.svelte';
  import { uiState } from '$lib/stores/ui.svelte';
  import { streamChat, type ChatMessage } from '$lib/api/analyses';
  import { toastState } from '$lib/stores/toast.svelte';

  type DrawerState = 'closed' | 'half' | 'full';

  let drawerState = $state<DrawerState>('closed');
  let messages = $state<ChatMessage[]>([]);
  let inputText = $state('');
  let streaming = $state(false);
  let streamingText = $state('');
  let messagesEl: HTMLDivElement | undefined = $state();
  let messagesEndEl: HTMLDivElement | undefined = $state();
  let textareaEl: HTMLTextAreaElement | undefined = $state();
  let abortController: AbortController | null = null;
  let hasInput = $derived(inputText.trim().length > 0);

  // Abort streaming on component destroy + messages click delegation
  $effect(() => {
    const el = messagesEl;
    if (el) el.addEventListener('click', handleRefClick);
    return () => {
      abortController?.abort();
      if (el) el.removeEventListener('click', handleRefClick);
    };
  });

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEndEl?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 120) + 'px';
  }

  function sendMessage() {
    const text = inputText.trim();
    if (!text || streaming) return;

    messages = [...messages, { role: 'user', content: text }];
    inputText = '';
    if (textareaEl) textareaEl.style.height = 'auto';
    streaming = true;
    streamingText = '';
    scrollToBottom();

    abortController = streamChat(
      analysisState.analysis.id,
      messages,
      (chunk) => {
        streamingText += chunk;
        scrollToBottom();
      },
      () => {
        messages = [...messages, { role: 'assistant', content: streamingText }];
        streamingText = '';
        streaming = false;
        scrollToBottom();
      },
      (error) => {
        toastState.show(`Chat-feil: ${error}`, 'error');
        streaming = false;
        streamingText = '';
      }
    );
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function openDrawer() {
    drawerState = 'half';
  }

  function toggleSize() {
    drawerState = drawerState === 'half' ? 'full' : 'half';
  }

  function closeDrawer() {
    drawerState = 'closed';
    if (abortController) {
      abortController.abort();
      abortController = null;
      streaming = false;
      streamingText = '';
    }
  }

  /** Parse {ref:kofa:id:§paragraph} references into HTML */
  function parseRefs(text: string): string {
    // Escape HTML first
    let escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Bold
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // References
    const escAttr = (s: string) => s.replace(/"/g, '&quot;');
    escaped = escaped.replace(
      /\{ref:(\w+):([^:}]+)(?::([^}]+))?\}/g,
      (_match, type, id, paragraph) => {
        const label = paragraph ? `${id} ${paragraph}` : id;
        const nodeId = escAttr(`${type}:${id}`);
        return `<button class="ref-link ref-${escAttr(type)}" data-node-id="${nodeId}">${label}</button>`;
      }
    );
    return escaped;
  }

  function handleRefClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('ref-link')) {
      const nodeId = target.dataset.nodeId;
      if (nodeId) {
        uiState.navigateTo(nodeId);
      }
    }
  }

  /** Split assistant content into blocks (text and challenge) */
  function parseBlocks(content: string): { type: 'text' | 'challenge'; content: string }[] {
    const blocks: { type: 'text' | 'challenge'; content: string }[] = [];
    const paragraphs = content.split('\n\n');

    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      if (
        trimmed.startsWith('**Mulig motargument:**') ||
        trimmed.startsWith('**Mulige motargumenter:**')
      ) {
        blocks.push({ type: 'challenge', content: trimmed });
      } else {
        blocks.push({ type: 'text', content: trimmed });
      }
    }
    return blocks;
  }
</script>

{#snippet assistantBlocks(content: string)}
  {#each parseBlocks(content) as block}
    {#if block.type === 'challenge'}
      <div class="challenge-block">
        <div class="challenge-label">Mulige motargumenter</div>
        <p class="challenge-text">
          {@html parseRefs(block.content.replace(/^\*\*Mulige? motargumenter?:\*\*\s*/, ''))}
        </p>
      </div>
    {:else}
      <p class="msg-text">{@html parseRefs(block.content)}</p>
    {/if}
  {/each}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
{#if drawerState === 'closed'}
  <div class="drawer-closed" onclick={openDrawer} role="button" tabindex="0">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 10L8 6L12 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    <span class="drawer-label">Sparring</span>
    <span class="ai-dot"></span>
  </div>
{:else}
  <div class="drawer-open" style:height={drawerState === 'half' ? '45%' : '100%'}>
    <!-- Header -->
    <div class="drawer-header">
      <div class="drawer-drag-handle"></div>
      <div class="header-left">
        <span class="header-title">Sparring</span>
        <span class="ai-badge">AI</span>
      </div>
      <div class="header-right">
        <button
          class="header-btn"
          onclick={toggleSize}
          title={drawerState === 'half' ? 'Utvid' : 'Halv'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {#if drawerState === 'half'}
              <line x1="2" y1="2" x2="10" y2="2" stroke="currentColor" stroke-width="1.2" />
              <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.2" />
              <line x1="2" y1="10" x2="10" y2="10" stroke="currentColor" stroke-width="1.2" />
            {:else}
              <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.5" />
              <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" stroke-width="1.5" />
            {/if}
          </svg>
        </button>
        <button class="header-btn close" onclick={closeDrawer} aria-label="Lukk chat">×</button>
      </div>
    </div>

    <!-- Messages -->
    <div class="messages" bind:this={messagesEl} role="log">
      {#if messages.length === 0 && !streaming}
        <div class="empty-chat">
          <div class="empty-chat-title">Still et spørsmål om rettskildebildet</div>
          <div class="empty-chat-desc">
            Diskuter spenninger, test argumenter, eller be om hjelp til å forstå sammenhenger mellom
            sakene.
          </div>
        </div>
      {/if}

      {#each messages as msg}
        {#if msg.role === 'user'}
          <div class="msg-user">
            <div class="msg-user-bubble">{msg.content}</div>
          </div>
        {:else}
          <div class="msg-assistant">
            {@render assistantBlocks(msg.content)}
          </div>
        {/if}
      {/each}

      {#if streaming && streamingText}
        <div class="msg-assistant">
          {@render assistantBlocks(streamingText)}
          <span class="streaming-cursor"></span>
        </div>
      {:else if streaming}
        <div class="msg-assistant">
          <span class="streaming-spinner"></span>
        </div>
      {/if}

      <div bind:this={messagesEndEl}></div>
    </div>

    <!-- Input -->
    <div class="chat-input-area">
      <div class="chat-input-row">
        <textarea
          bind:this={textareaEl}
          bind:value={inputText}
          oninput={autoResize}
          onkeydown={handleKeyDown}
          placeholder="Still et spørsmål om rettskildebildet…"
          rows="1"
          disabled={streaming}
        ></textarea>
        <button
          class="send-btn"
          class:active={hasInput}
          onclick={sendMessage}
          disabled={!hasInput || streaming}
          aria-label="Send melding"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 13L13 8L3 3V7L9 8L3 9V13Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Closed state */
  .drawer-closed {
    height: 40px;
    border-top: 1px solid var(--p-border);
    background: var(--p-panel);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    color: var(--p-ink3);
    transition: background 0.12s ease;
    flex-shrink: 0;
  }
  .drawer-closed:hover {
    background: var(--p-surface);
  }
  .drawer-label {
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--p-kofa-accent);
    opacity: 0.6;
  }

  /* Open state */
  .drawer-open {
    border-top: 1px solid var(--p-border-m, rgba(26, 24, 20, 0.13));
    background: var(--p-panel);
    display: flex;
    flex-direction: column;
    transition: height 0.25s ease;
    flex-shrink: 0;
    min-height: 200px;
  }

  /* Header */
  .drawer-header {
    padding: 6px 16px;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--p-border);
    flex-shrink: 0;
    position: relative;
  }
  .drawer-drag-handle {
    width: 32px;
    height: 3px;
    border-radius: 2px;
    background: var(--p-border-s, rgba(26, 24, 20, 0.22));
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    top: 3px;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .header-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--p-ink2);
    letter-spacing: 0.02em;
  }
  .ai-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    background: var(--p-highlight, #fbf5e8);
    border: 1px solid var(--p-ai-border, rgba(139, 105, 20, 0.2));
    color: var(--p-kofa-accent);
  }
  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .header-btn {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid var(--p-border);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p-ink3);
  }
  .header-btn:hover {
    background: var(--p-hover);
  }
  .header-btn.close {
    border: none;
    color: var(--p-ink4);
    font-size: 15px;
  }

  /* Messages */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 32px 16px;
    gap: 8px;
  }
  .empty-chat-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--p-ink2);
  }
  .empty-chat-desc {
    font-size: 12px;
    color: var(--p-ink3);
    line-height: 1.55;
    max-width: 360px;
  }

  /* User message */
  .msg-user {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 20px;
  }
  .msg-user-bubble {
    max-width: 85%;
    padding: 12px 16px;
    border-radius: 14px 14px 4px 14px;
    background: var(--p-ink);
    color: var(--p-bg);
    font-size: 14px;
    line-height: 1.6;
    letter-spacing: -0.01em;
  }

  /* Assistant message */
  .msg-assistant {
    margin-bottom: 20px;
    max-width: 90%;
  }
  .msg-text {
    margin: 0 0 10px;
    font-size: 14px;
    line-height: 1.65;
    color: var(--p-ink);
    letter-spacing: -0.01em;
  }

  /* Challenge block */
  .challenge-block {
    margin: 12px 0 10px;
    padding: 12px 14px;
    border-radius: 6px;
    border-left: 3px solid rgba(122, 92, 46, 0.18);
    background: rgba(122, 92, 46, 0.04);
  }
  .challenge-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #7a5c2e;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .challenge-text {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--p-ink2);
  }

  /* Reference links */
  :global(.ref-link) {
    all: unset;
    cursor: pointer;
    font-family: var(--font-data);
    font-weight: 600;
    font-size: 0.92em;
    padding-bottom: 1px;
    border-bottom: 1px solid transparent;
    transition: border-color 0.15s ease;
  }
  :global(.ref-link:hover) {
    border-bottom-style: solid;
  }
  :global(.ref-kofa) {
    color: var(--p-kofa-accent);
  }
  :global(.ref-kofa:hover) {
    border-bottom-color: var(--p-kofa-accent);
  }
  :global(.ref-eu) {
    color: var(--p-eu-accent);
  }
  :global(.ref-eu:hover) {
    border-bottom-color: var(--p-eu-accent);
  }
  :global(.ref-provision) {
    color: var(--p-provision-accent);
  }
  :global(.ref-provision:hover) {
    border-bottom-color: var(--p-provision-accent);
  }

  /* Streaming */
  .streaming-cursor {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: var(--p-kofa-accent);
    animation: blink 1s step-end infinite;
    vertical-align: text-bottom;
    margin-left: 2px;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  .streaming-spinner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--p-border-m, rgba(26, 24, 20, 0.13));
    border-top-color: var(--p-kofa-accent);
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  /* Input area */
  .chat-input-area {
    padding: 12px 16px;
    border-top: 1px solid var(--p-border);
    background: var(--p-panel);
    flex-shrink: 0;
  }
  .chat-input-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--p-input);
    border: 1px solid var(--p-border-m, rgba(26, 24, 20, 0.13));
    transition: border-color 0.15s ease;
  }
  .chat-input-row:focus-within {
    border-color: var(--p-border-s, rgba(26, 24, 20, 0.22));
  }
  .chat-input-row textarea {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
    font-size: 14px;
    line-height: 1.5;
    color: var(--p-ink);
    resize: none;
    font-family: var(--font-ui);
    padding: 0;
    max-height: 120px;
  }
  .chat-input-row textarea::placeholder {
    color: var(--p-ink4);
  }
  .send-btn {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--p-ink4);
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  .send-btn.active {
    background: var(--p-ink);
    color: var(--p-panel);
    cursor: pointer;
  }
  .send-btn.active:hover {
    opacity: 0.85;
  }
  .send-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>

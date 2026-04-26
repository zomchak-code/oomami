<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    eyebrow,
    title,
    section = undefined,
    description = undefined,
    actions = undefined,
    meta = undefined,
  }: {
    eyebrow: string;
    title: string;
    section?: string;
    description?: string;
    actions?: Snippet;
    meta?: Snippet;
  } = $props();
</script>

<header class="page-header">
  <div class="row top">
    <span class="eyebrow section-number" data-num={section}>{eyebrow}</span>
    {#if actions}
      <div class="actions">{@render actions()}</div>
    {/if}
  </div>
  <h1 class="title font-display">{title}</h1>
  {#if description}
    <p class="description">{description}</p>
  {/if}
  {#if meta}
    <div class="meta">{@render meta()}</div>
  {/if}
  <div class="rule" aria-hidden="true"></div>
</header>

<style>
  .page-header {
    padding: calc(2.25rem * var(--density)) 0
      calc(1.25rem * var(--density));
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: var(--eyebrow-tracking);
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .title {
    font-family: var(--font-display);
    font-weight: var(--display-weight);
    letter-spacing: var(--display-tracking);
    line-height: 1;
    margin: 0;
    font-size: clamp(2rem, 5vw, 3.75rem);
  }
  :root[data-theme="aurora"] .title {
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    line-height: 0.95;
    font-style: normal;
  }
  :root[data-theme="editorial"] .title {
    font-size: clamp(2.5rem, 6vw, 4.25rem);
    line-height: 0.95;
    font-feature-settings:
      "ss01" on,
      "liga" on;
  }
  :root[data-theme="terminal"] .title {
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    text-transform: uppercase;
  }
  :root[data-theme="swiss"] .title {
    font-size: clamp(2.25rem, 6vw, 4rem);
    text-transform: uppercase;
    line-height: 0.92;
  }
  .description {
    color: var(--muted-foreground);
    max-width: 60ch;
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.55;
  }
  :root[data-theme="editorial"] .description {
    font-style: italic;
    font-size: 1.05rem;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--muted-foreground);
    margin-top: 0.25rem;
  }
  .rule {
    margin-top: 0.75rem;
    height: 1px;
    background: var(--rule-color);
  }
  :root[data-theme="swiss"] .rule {
    height: 2px;
    background: var(--foreground);
  }
  :root[data-theme="terminal"] .rule {
    background: repeating-linear-gradient(
      to right,
      var(--accent-bold) 0,
      var(--accent-bold) 4px,
      transparent 4px,
      transparent 8px
    );
  }
</style>

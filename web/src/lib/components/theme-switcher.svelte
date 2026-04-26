<script lang="ts">
  import { theme } from "$lib/theme/theme.svelte";
  import { themes, type ThemeId } from "$lib/theme/themes";

  let hovered = $state<ThemeId | null>(null);
</script>

<div class="switcher" aria-label="Aesthetic switcher">
  <div class="rail">
    {#each themes as t (t.id)}
      <button
        class="swatch"
        class:active={theme.current === t.id}
        style="--swatch-accent: {t.accent}; --swatch-font: {t.font};"
        onclick={() => theme.set(t.id)}
        onmouseenter={() => (hovered = t.id)}
        onmouseleave={() => (hovered = null)}
        aria-pressed={theme.current === t.id}
        aria-label={t.label}
      >
        <span class="glyph">{t.glyph}</span>
        <span class="dot" aria-hidden="true"></span>
      </button>
    {/each}
  </div>
  <div class="caption" aria-hidden="true">
    {#if hovered}
      {@const t = themes.find((x) => x.id === hovered)}
      <span class="caption-label" style="font-family: {t?.font};"
        >{t?.label}</span
      >
      <span class="caption-blurb">{t?.blurb}</span>
    {:else}
      {@const t = themes.find((x) => x.id === theme.current)}
      <span class="caption-label" style="font-family: {t?.font};"
        >{t?.label}</span
      >
      <span class="caption-blurb">{t?.blurb}</span>
    {/if}
  </div>
</div>

<style>
  .switcher {
    position: fixed;
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(1rem, env(safe-area-inset-bottom));
    z-index: 80;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    pointer-events: none;
  }

  .rail {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem;
    background: oklch(0 0 0 / 0.72);
    color: oklch(1 0 0);
    backdrop-filter: blur(20px) saturate(140%);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid oklch(1 0 0 / 0.12);
    border-radius: 999px;
    box-shadow:
      inset 0 1px 0 oklch(1 0 0 / 0.08),
      0 12px 32px -8px oklch(0 0 0 / 0.6);
  }

  .swatch {
    position: relative;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    background: oklch(1 0 0 / 0.04);
    border: 1px solid transparent;
    color: oklch(1 0 0 / 0.78);
    font-family: var(--swatch-font);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition:
      background 180ms ease,
      color 180ms ease,
      transform 180ms ease,
      border-color 180ms ease;
  }
  .swatch:hover {
    background: oklch(1 0 0 / 0.1);
    color: oklch(1 0 0);
    transform: translateY(-1px);
  }
  .swatch.active {
    background: var(--swatch-accent);
    color: oklch(0.06 0 0);
    border-color: oklch(1 0 0 / 0.18);
    box-shadow:
      0 0 0 2px oklch(0 0 0 / 0.7),
      0 0 0 3px var(--swatch-accent);
  }
  .glyph {
    position: relative;
    z-index: 1;
  }
  .dot {
    position: absolute;
    bottom: -0.55rem;
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: var(--swatch-accent);
    opacity: 0;
    transition: opacity 180ms ease;
  }
  .swatch.active .dot {
    opacity: 0;
  }
  .swatch:hover .dot {
    opacity: 0.85;
  }

  .caption {
    pointer-events: none;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0.625rem;
    background: oklch(0 0 0 / 0.55);
    color: oklch(1 0 0);
    font-size: 0.6875rem;
    border-radius: 999px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid oklch(1 0 0 / 0.08);
    opacity: 0.92;
  }
  .caption-label {
    font-size: 0.8125rem;
    letter-spacing: 0;
  }
  .caption-blurb {
    color: oklch(1 0 0 / 0.6);
    font-family: ui-monospace, monospace;
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }

  @media print {
    .switcher {
      display: none;
    }
  }
</style>

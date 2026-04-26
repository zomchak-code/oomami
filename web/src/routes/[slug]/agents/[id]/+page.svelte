<script lang="ts">
  import { api } from "conv/api";
  import { useConvexClient, useQuery } from "convex-svelte";
  import { page } from "$app/state";
  import { agentIdSchema } from "conv/schema";
  import Bot from "@lucide/svelte/icons/bot";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Archive from "@lucide/svelte/icons/archive";
  import ArchiveRestore from "@lucide/svelte/icons/archive-restore";
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import { formatRelative } from "$lib/utils";

  const convex = useConvexClient();
  const id = $derived(agentIdSchema.parse(page.params.id));

  const agent = $derived(useQuery(api.agents.get, { id }));
  const archived = $derived(agent.data?.archivedAt !== undefined);

  let copied = $state(false);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  async function copyId() {
    await navigator.clipboard.writeText(id);
    copied = true;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copied = false;
    }, 1500);
  }

  let editingName = $state(false);
  let nameDraft = $state("");
  let nameSaving = $state(false);

  function startNameEdit() {
    if (archived || !agent.data) return;
    nameDraft = agent.data.name;
    editingName = true;
  }

  function focusAndSelect(element: HTMLInputElement) {
    element.focus();
    element.select();
  }

  function cancelNameEdit() {
    editingName = false;
    nameDraft = "";
  }

  async function commitName() {
    if (!editingName || !agent.data) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === agent.data.name) {
      cancelNameEdit();
      return;
    }
    nameSaving = true;
    try {
      await convex.mutation(api.agents.updateName, { id, name: trimmed });
      editingName = false;
    } finally {
      nameSaving = false;
    }
  }

  function onNameKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitName();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelNameEdit();
    }
  }

  let editingPrompt = $state(false);
  let promptDraft = $state("");
  let promptSaving = $state(false);

  function startPromptEdit() {
    if (archived || !agent.data) return;
    promptDraft = agent.data.systemPrompt;
    editingPrompt = true;
  }

  function cancelPromptEdit() {
    editingPrompt = false;
    promptDraft = "";
  }

  async function savePrompt() {
    promptSaving = true;
    try {
      await convex.mutation(api.agents.updateSystemPrompt, {
        id,
        systemPrompt: promptDraft,
      });
      editingPrompt = false;
    } finally {
      promptSaving = false;
    }
  }

  function onPromptKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      savePrompt();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelPromptEdit();
    }
  }

  let archiveBusy = $state(false);

  async function toggleArchive() {
    archiveBusy = true;
    try {
      if (archived) {
        await convex.mutation(api.agents.restore, { id });
      } else {
        await convex.mutation(api.agents.archive, { id });
      }
    } finally {
      archiveBusy = false;
    }
  }
</script>

<div class="space-y-8">
  {#if agent.data}
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <Bot class="size-8 shrink-0" />
        {#if editingName}
          <input
            {@attach focusAndSelect}
            bind:value={nameDraft}
            onkeydown={onNameKeydown}
            onblur={commitName}
            disabled={nameSaving}
            class="text-xl bg-transparent outline-none border-b border-input focus:border-ring w-full min-w-0"
          />
        {:else}
          <button
            type="button"
            onclick={startNameEdit}
            disabled={archived}
            class="text-xl text-left truncate min-w-0 rounded enabled:hover:text-foreground enabled:cursor-text disabled:cursor-default"
            title={archived ? "Restore to edit" : "Click to rename"}
          >
            {agent.data.name}
          </button>
        {/if}
      </div>
      <Button
        variant={archived ? "default" : "outline"}
        onclick={toggleArchive}
        disabled={archiveBusy}
      >
        {#if archived}
          <ArchiveRestore />
          {archiveBusy ? "Restoring..." : "Restore"}
        {:else}
          <Archive />
          {archiveBusy ? "Archiving..." : "Archive"}
        {/if}
      </Button>
    </div>

    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div class="space-y-1">
        <dt class="text-xs uppercase tracking-wide text-muted-foreground">
          ID
        </dt>
        <dd>
          <button
            type="button"
            onclick={copyId}
            class="inline-flex items-center gap-1.5 rounded font-mono text-sm hover:text-foreground text-muted-foreground"
            title="Copy ID"
          >
            <span>{agent.data._id}</span>
            {#if copied}
              <Check class="size-3.5" />
            {:else}
              <Copy class="size-3.5 opacity-60" />
            {/if}
          </button>
        </dd>
      </div>
      <div class="space-y-1">
        <dt class="text-xs uppercase tracking-wide text-muted-foreground">
          Created
        </dt>
        <dd class="text-sm">
          {formatRelative(agent.data._creationTime)}
        </dd>
      </div>
    </dl>

    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-muted-foreground">System prompt</p>
        {#if !editingPrompt && !archived}
          <Button variant="outline" onclick={startPromptEdit}>
            <Pencil /> Edit
          </Button>
        {/if}
      </div>
      {#if editingPrompt}
        <Textarea
          bind:value={promptDraft}
          onkeydown={onPromptKeydown}
          rows={8}
          disabled={promptSaving}
          autofocus
        />
        <div class="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onclick={cancelPromptEdit}
            disabled={promptSaving}
          >
            Cancel
          </Button>
          <Button onclick={savePrompt} disabled={promptSaving}>
            {promptSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      {:else}
        <p class="whitespace-pre-wrap">{agent.data.systemPrompt}</p>
      {/if}
    </div>
  {/if}
</div>

<script lang="ts">
  import { api } from "conv/api";
  import { useConvexClient, useQuery } from "convex-svelte";
  import { page } from "$app/state";
  import Bot from "@lucide/svelte/icons/bot";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import Archive from "@lucide/svelte/icons/archive";
  import ArchiveRestore from "@lucide/svelte/icons/archive-restore";
  import { sessionIdSchema } from "conv/schema";
  import MessageCircle from "@lucide/svelte/icons/message-circle";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import { useAuth } from "@mmailaender/convex-better-auth-svelte/svelte";
  import Badge from "$lib/components/ui/badge/badge.svelte";
  import { Oomami } from "@oomami/sdk";
  import { z } from "zod";
  import { formatRelative } from "$lib/utils";

  const convex = useConvexClient();
  const id = $derived(sessionIdSchema.parse(page.params.id));

  const session = $derived(useQuery(api.sessions.get, { id }));
  const archived = $derived(session.data?.archivedAt !== undefined);
  const auth = useAuth();
  const oomami = new Oomami({
    baseUrl: import.meta.env.VITE_CONVEX_SITE_URL,
    authToken: () => auth.fetchAccessToken({ forceRefreshToken: true }),
  });

  const events = $derived(useQuery(api.events.list, { sessionId: id }));

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
    if (archived || !session.data) return;
    nameDraft = session.data.name;
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
    if (!editingName || !session.data) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === session.data.name) {
      cancelNameEdit();
      return;
    }
    nameSaving = true;
    try {
      await convex.mutation(api.sessions.updateName, { id, name: trimmed });
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

  let archiveBusy = $state(false);

  async function toggleArchive() {
    archiveBusy = true;
    try {
      if (archived) {
        await convex.mutation(api.sessions.restore, { id });
      } else {
        await convex.mutation(api.sessions.archive, { id });
      }
    } finally {
      archiveBusy = false;
    }
  }

  let message = $state("");

  async function submit() {
    if (!message || archived) return;

    const fetched = oomami.sessions.events.create(
      id,
      {
        type: "user.message",
        data: { role: "user", content: message },
      },
      {
        tools: {
          getWeather: {
            inputSchema: z.object({
              city: z.string(),
            }),
            execute: async (input) => {
              return `The weather in ${input.city} is sunny.`;
            },
          },
        },
      },
    );
    message = "";
    const response = await fetched;
    const reader = response.getReader();
    while (true) {
      const result = await reader?.read();
      if (!result) break;
      const { done, value } = result;
      if (done) break;
      console.log(value);
    }
  }
</script>

{#if session.data}
  <div class="space-y-8">
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <MessageCircle class="size-8 shrink-0" />
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
            {session.data.name}
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

    <dl class="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
            <span>{session.data._id}</span>
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
          Agent
        </dt>
        <dd class="inline-flex items-center gap-2 text-sm">
          <Bot class="size-4" />
          {session.data.agent.name}
        </dd>
      </div>
      <div class="space-y-1">
        <dt class="text-xs uppercase tracking-wide text-muted-foreground">
          Created
        </dt>
        <dd class="text-sm">
          {formatRelative(session.data._creationTime)}
        </dd>
      </div>
    </dl>

    <div class="space-y-4">
      {#if events.data}
        {#each events.data as event (event._id)}
          <div>
            <Badge>{event.type}</Badge>
            {#if event.type === "user.message"}
              <div>
                <Badge variant="secondary">text</Badge>
                {event.data.content}
              </div>
            {:else if event.type === "agent.text" || event.type === "agent.reasoning"}
              <p>{event.data.text}</p>
            {:else if event.type === "agent.tool-call"}
              <Badge variant="secondary">{event.data.toolName}</Badge>
              <p>{JSON.stringify(event.data.input)}</p>
            {:else if event.type === "agent.tool-result"}
              <Badge variant="secondary">{event.data.toolName}</Badge>
              <p>{JSON.stringify(event.data.output.value)}</p>
            {:else}
              {JSON.stringify(event)}
            {/if}
          </div>
        {/each}
      {/if}
    </div>

    <div class="space-y-2">
      {#if archived}
        <p class="text-sm text-muted-foreground">
          Restore this session to send new messages.
        </p>
      {/if}
      <Textarea
        bind:value={message}
        disabled={archived}
        placeholder={archived ? "Archived sessions are read-only" : undefined}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
    </div>
  </div>
{/if}

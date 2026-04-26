<script lang="ts">
  import { api } from "conv/api";
  import { useConvexClient, useQuery } from "convex-svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import Bot from "@lucide/svelte/icons/bot";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import Archive from "@lucide/svelte/icons/archive";
  import ArchiveRestore from "@lucide/svelte/icons/archive-restore";
  import Send from "@lucide/svelte/icons/send";
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
  const slug = $derived(z.string().parse(page.params.slug));
  const id = $derived(sessionIdSchema.parse(page.params.id));

  const session = $derived(useQuery(api.sessions.get, { id }));
  const archived = $derived(session.data?.archivedAt !== undefined);
  const auth = useAuth();
  const oomami = new Oomami({
    baseUrl: import.meta.env.VITE_CONVEX_SITE_URL,
    authToken: () => auth.fetchAccessToken({ forceRefreshToken: true }),
  });

  const events = $derived(useQuery(api.events.list, { sessionId: id }));
  let message = $state("");
  let sending = $state(false);
  let sendError = $state<string | null>(null);
  const canSend = $derived(message.trim().length > 0 && !archived && !sending);

  let eventsEnd: HTMLDivElement | null = $state(null);

  $effect(() => {
    const currentEvents = events.data;
    if (!currentEvents) return;
    queueMicrotask(() => eventsEnd?.scrollIntoView({ block: "end" }));
  });

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

  async function submit() {
    if (!canSend) return;
    const content = message.trim();
    message = "";
    sending = true;
    sendError = null;

    try {
      const stream = await oomami.sessions.events.send(
        id,
        {
          type: "user.message",
          data: { role: "user", content },
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
      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    } catch (error) {
      sendError =
        error instanceof Error ? error.message : "Failed to send message";
      message = content;
    } finally {
      sending = false;
    }
  }
</script>

{#if session.data}
  <div class="flex h-[calc(100vh-2rem)] min-h-0 flex-col gap-8 overflow-hidden">
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
        <dd>
          <Button
            href={resolve(`/${slug}/agents/${session.data.agent._id}`)}
            variant="ghost"
            class="-ml-2 h-auto justify-start px-2 py-1"
          >
            <Bot class="size-4" />
            {session.data.agent.name}
          </Button>
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

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pr-2">
      {#if events.data}
        {#each events.data as event (event._id)}
          <div class="space-y-2 rounded-lg border p-3">
            <div>
              <Badge>{event.type}</Badge>
            </div>
            {#if event.type === "user.message"}
              <p class="whitespace-pre-wrap">{event.data.content}</p>
            {:else if event.type === "agent.text" || event.type === "agent.reasoning"}
              {#if event.data.text}
                <p class="whitespace-pre-wrap">{event.data.text}</p>
              {:else}
                <p class="animate-pulse text-sm italic text-muted-foreground">
                  {event.type === "agent.reasoning"
                    ? "Thinking..."
                    : "Writing..."}
                </p>
              {/if}
            {:else if event.type === "agent.tool-call"}
              <Badge variant="secondary">{event.data.toolName}</Badge>
              <p class="wrap-break-word font-mono text-xs">
                {JSON.stringify(event.data.input)}
              </p>
            {:else if event.type === "agent.tool-result"}
              <Badge variant="secondary">{event.data.toolName}</Badge>
              <p class="wrap-break-word font-mono text-xs">
                {JSON.stringify(event.data.output.value)}
              </p>
            {:else}
              {JSON.stringify(event)}
            {/if}
          </div>
        {/each}
      {/if}
      <div bind:this={eventsEnd}></div>
    </div>

    <form
      class="-mx-4 space-y-2 border-t bg-background/95 p-4 backdrop-blur supports-backdrop-filter:bg-background/80"
      onsubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {#if archived}
        <p class="text-sm text-muted-foreground">
          Restore this session to send new messages.
        </p>
      {/if}
      {#if sendError}
        <p class="text-sm text-destructive">{sendError}</p>
      {/if}
      <div
        class="flex flex-col gap-2 rounded-lg border bg-background p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      >
        <Textarea
          bind:value={message}
          disabled={archived || sending}
          placeholder={archived
            ? "Archived sessions are read-only"
            : sending
              ? "Waiting for response..."
              : "Send a message..."}
          class="max-h-40 min-h-10 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0 disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:disabled:bg-transparent"
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div class="flex items-center justify-end">
          <Button type="submit" size="sm" disabled={!canSend}>
            <Send />
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </form>
  </div>
{/if}

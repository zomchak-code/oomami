<script lang="ts">
  import { api } from "conv/api";
  import { useQuery } from "convex-svelte";
  import { page } from "$app/state";
  import z from "zod";
  import { Button } from "$lib/components/ui/button";
  import { useConvexClient } from "convex-svelte";
  import Bot from "@lucide/svelte/icons/bot";
  import MessageCircle from "@lucide/svelte/icons/message-circle";
  import Plus from "@lucide/svelte/icons/plus";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Table from "$lib/components/ui/table";
  import type { Id } from "conv/src/_generated/dataModel";
  import { formatRelative } from "$lib/utils";

  const convex = useConvexClient();
  const slug = $derived(z.string().parse(page.params.slug));

  const agents = $derived(useQuery(api.agents.list, { slug }));

  let view = $state<"active" | "archived">("active");
  const sessions = $derived(
    useQuery(api.sessions.list, { slug, archived: view === "archived" }),
  );

  async function create(agentId: Id<"agents">) {
    const session = await convex.mutation(api.sessions.create, { agentId });
    goto(resolve(`/${slug}/sessions/${session}`));
  }

  let copiedId = $state<string | null>(null);
  let copyTimeout: ReturnType<typeof setTimeout> | null = null;

  async function copyId(event: MouseEvent, id: string) {
    event.stopPropagation();
    await navigator.clipboard.writeText(id);
    copiedId = id;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copiedId = null;
    }, 1500);
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <span class="text-lg">Sessions</span>
      <div class="inline-flex items-center gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onclick={() => (view = "active")}
          class={[
            "px-3 py-1 text-sm font-medium rounded-md transition-colors",
            view === "active"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ]}
        >
          Active
        </button>
        <button
          type="button"
          onclick={() => (view = "archived")}
          class={[
            "px-3 py-1 text-sm font-medium rounded-md transition-colors",
            view === "archived"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ]}
        >
          Archived
        </button>
      </div>
    </div>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button {...props}>
            <Plus /> New session
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="min-w-56">
        {#if agents.data?.length}
          {#each agents.data as agent (agent._id)}
            <DropdownMenu.Item onclick={() => create(agent._id)}>
              <Bot />
              <span class="truncate">{agent.name}</span>
            </DropdownMenu.Item>
          {/each}
        {:else}
          <DropdownMenu.Label>No active agents</DropdownMenu.Label>
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  {#if sessions.data}
    {#if !sessions.data.length}
      <div
        class="border text-center p-8 flex flex-col items-center gap-4 text-lg"
      >
        {view === "archived" ? "No archived sessions" : "No sessions yet"}
        {#if view === "active"}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button {...props}>
                  <Plus /> New session
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content class="min-w-56">
              {#if agents.data?.length}
                {#each agents.data as agent (agent._id)}
                  <DropdownMenu.Item onclick={() => create(agent._id)}>
                    <Bot />
                    <span class="truncate">{agent.name}</span>
                  </DropdownMenu.Item>
                {/each}
              {:else}
                <DropdownMenu.Label>No active agents</DropdownMenu.Label>
              {/if}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      </div>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Name</Table.Head>
            <Table.Head>Agent</Table.Head>
            <Table.Head>ID</Table.Head>
            <Table.Head>Created</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each sessions.data as session (session._id)}
            <Table.Row
              class="cursor-pointer"
              onclick={() => goto(resolve(`/${slug}/sessions/${session._id}`))}
            >
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <MessageCircle class="size-4" />
                  {session.name}
                </div>
              </Table.Cell>
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <Bot class="size-4" />
                  {session.agent.name}
                </div>
              </Table.Cell>
              <Table.Cell>
                <button
                  type="button"
                  onclick={(e) => copyId(e, session._id)}
                  class="inline-flex items-center gap-1.5 rounded font-mono text-xs text-muted-foreground hover:text-foreground"
                  title="Copy ID"
                >
                  <span>{session._id}</span>
                  {#if copiedId === session._id}
                    <Check class="size-3" />
                  {:else}
                    <Copy class="size-3 opacity-60" />
                  {/if}
                </button>
              </Table.Cell>
              <Table.Cell class="text-muted-foreground">
                {formatRelative(session._creationTime)}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  {/if}
</div>

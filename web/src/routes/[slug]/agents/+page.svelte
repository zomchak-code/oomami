<script lang="ts">
  import { api } from "conv/api";
  import { useQuery } from "convex-svelte";
  import { page } from "$app/state";
  import z from "zod";
  import { Button } from "$lib/components/ui/button";
  import { useConvexClient } from "convex-svelte";
  import Bot from "@lucide/svelte/icons/bot";
  import Plus from "@lucide/svelte/icons/plus";
  import Copy from "@lucide/svelte/icons/copy";
  import Check from "@lucide/svelte/icons/check";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import * as Table from "$lib/components/ui/table";
  import { formatRelative } from "$lib/utils";

  const convex = useConvexClient();
  const slug = $derived(z.string().parse(page.params.slug));

  let view = $state<"active" | "archived">("active");
  const agents = $derived(
    useQuery(api.agents.list, { slug, archived: view === "archived" }),
  );

  async function create() {
    const agent = await convex.mutation(api.agents.create, { slug });
    goto(resolve(`/${slug}/agents/${agent}`));
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
      <span class="text-lg">Agents</span>
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
    <Button onclick={create}>
      <Plus /> Create agent
    </Button>
  </div>
  {#if agents.data}
    {#if !agents.data.length}
      <div
        class="border text-center p-8 flex flex-col items-center gap-4 text-lg"
      >
        {view === "archived" ? "No archived agents" : "No agents yet"}
        {#if view === "active"}
          <Button onclick={create}>
            <Plus /> Create agent
          </Button>
        {/if}
      </div>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Name</Table.Head>
            <Table.Head>ID</Table.Head>
            <Table.Head>Created</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each agents.data as agent (agent._id)}
            <Table.Row
              class="cursor-pointer"
              onclick={() => goto(resolve(`/${slug}/agents/${agent._id}`))}
            >
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <Bot class="size-4" />
                  {agent.name}
                </div>
              </Table.Cell>
              <Table.Cell>
                <button
                  type="button"
                  onclick={(e) => copyId(e, agent._id)}
                  class="inline-flex items-center gap-1.5 rounded font-mono text-xs text-muted-foreground hover:text-foreground"
                  title="Copy ID"
                >
                  <span>{agent._id}</span>
                  {#if copiedId === agent._id}
                    <Check class="size-3" />
                  {:else}
                    <Copy class="size-3 opacity-60" />
                  {/if}
                </button>
              </Table.Cell>
              <Table.Cell class="text-muted-foreground">
                {formatRelative(agent._creationTime)}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  {/if}
</div>

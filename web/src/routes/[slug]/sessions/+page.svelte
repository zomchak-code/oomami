<script lang="ts">
  import { api } from "conv/api";
  import { useQuery } from "convex-svelte";
  import { page } from "$app/state";
  import z from "zod";
  import { Button } from "$lib/components/ui/button";
  import { useConvexClient } from "convex-svelte";
  import Bot from "@lucide/svelte/icons/bot";
  import Plus from "@lucide/svelte/icons/plus";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import type { Id } from "conv/src/_generated/dataModel";

  const convex = useConvexClient();
  const slug = $derived(z.string().parse(page.params.slug));

  const agents = $derived(useQuery(api.agents.list, { slug }));

  const sessions = $derived(useQuery(api.sessions.list, { slug }));

  async function create(agentId: Id<"agents">) {
    const session = await convex.mutation(api.sessions.create, { agentId });
    goto(resolve(`/${slug}/sessions/${session}`));
  }
</script>

<p>Sessions</p>
{#if sessions.data}
  {#each sessions.data as session (session._id)}
    <Button
      href={resolve(`/${slug}/sessions/${session._id}`)}
      variant="outline"
    >
      <Bot />
      {session.name}
    </Button>
  {/each}
{/if}

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props}>
        <Plus /> New session
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    {#each agents.data as agent (agent._id)}
      <DropdownMenu.Item onclick={() => create(agent._id)}>
        <Bot />
        {agent.name}
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>

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

  const convex = useConvexClient();
  const slug = $derived(z.string().parse(page.params.slug));

  const agents = $derived(useQuery(api.agents.list, { slug }));

  async function create() {
    const agent = await convex.mutation(api.agents.create, { slug });
    goto(resolve(`/${slug}/agents/${agent}`));
  }
</script>

<p>Agents</p>
{#if agents.data}
  {#each agents.data as agent (agent._id)}
    <Button href={resolve(`/${slug}/agents/${agent._id}`)} variant="outline">
      <Bot />
      {agent.name}
    </Button>
  {/each}
{/if}

<Button onclick={create}>
  <Plus /> New agent
</Button>

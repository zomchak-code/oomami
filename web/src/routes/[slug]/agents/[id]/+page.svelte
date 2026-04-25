<script lang="ts">
  import { api } from "conv/api";
  import { useQuery } from "convex-svelte";
  import { page } from "$app/state";
  import { agentIdSchema } from "conv/schema";
  import Bot from "@lucide/svelte/icons/bot";

  const id = $derived(agentIdSchema.parse(page.params.id));

  const agent = $derived(useQuery(api.agents.get, { id }));
</script>

{#if agent.data}
  <Bot />
  {agent.data.name}
{/if}

<script lang="ts">
  import { api } from "conv/api";
  import { useQuery } from "convex-svelte";
  import { page } from "$app/state";
  import Bot from "@lucide/svelte/icons/bot";
  import { sessionIdSchema } from "conv/schema";
  import MessageCircle from "@lucide/svelte/icons/message-circle";
  import { Textarea } from "$lib/components/ui/textarea";
  import { useAuth } from "@mmailaender/convex-better-auth-svelte/svelte";
  import Badge from "$lib/components/ui/badge/badge.svelte";
  import { Oomami } from "@oomami/sdk";
  import { z } from "zod";

  const id = $derived(sessionIdSchema.parse(page.params.id));

  const session = $derived(useQuery(api.sessions.get, { id }));
  const auth = useAuth();
  const oomami = new Oomami({
    baseUrl: import.meta.env.VITE_CONVEX_SITE_URL,
    authToken: () => auth.fetchAccessToken({ forceRefreshToken: true }),
  });

  const events = $derived(useQuery(api.events.list, { sessionId: id }));

  let message = $state("");

  async function submit() {
    if (!message) return;
    console.log(message);

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
  <div>
    <Bot />
    {session.data.agent.name}
    <MessageCircle />
    {session.data.name}
  </div>
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
  <Textarea
    bind:value={message}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    }}
  />
{/if}

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
  const id = $derived(sessionIdSchema.parse(page.params.id));

  const session = $derived(useQuery(api.sessions.get, { id }));
  const auth = useAuth();

  const events = $derived(useQuery(api.events.list, { sessionId: id }));

  let message = $state("");

  async function submit() {
    if (!message) return;
    console.log(message);
    const token = await auth.fetchAccessToken({ forceRefreshToken: true });
    if (!token) return;

    const fetched = fetch(
      `${import.meta.env.VITE_CONVEX_SITE_URL}/api/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: id,
          type: "user",
          data: { role: "user", content: message },
        }),
      },
    );
    message = "";
    const response = await fetched;
    const reader = response.body?.getReader();
    while (true) {
      const result = await reader?.read();
      if (!result) break;
      const { done, value } = result;
      if (done) break;
      const text = new TextDecoder().decode(value);
      console.log(text);
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
    <Badge>{event.type}</Badge>
    <pre>{JSON.stringify(event.data, null, 2)}</pre>
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

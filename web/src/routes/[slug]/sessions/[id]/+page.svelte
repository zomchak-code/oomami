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

    const fetched = oomami.sessions.events.create(id, {
      type: "user.message",
      data: { role: "user", content: message },
    });
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
    <div>
      <Badge>{event.type}</Badge>
      {#if event.type === "user.message"}
        <div>
          <Badge variant="secondary">text</Badge>
          {event.data.content}
        </div>
      {:else if event.type === "assistant.response"}
        {#each event.data as message, idx (idx)}
          <div>
            <Badge variant="secondary">{message.role}</Badge>
            <div>
              {#if typeof message.content === "string"}
                <p>{message.content}</p>
              {:else}
                {#each message.content as content (content)}
                  <Badge variant="secondary">{content.type}</Badge>
                  {#if content.type === "text" || content.type === "reasoning"}
                    <p>{content.text}</p>
                  {:else if content.type === "tool-call"}
                    <p>{content.input}</p>
                  {:else if content.type === "tool-result"}
                    <p>{content.output}</p>
                  {:else}
                    {JSON.stringify(content)}
                  {/if}
                {/each}
              {/if}
            </div>
          </div>
        {/each}
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

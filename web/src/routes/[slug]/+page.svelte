<script lang="ts">
  import { Textarea } from "$lib/components/ui/textarea";
  import { Button } from "$lib/components/ui/button";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";

  let message = $state("");
  let answer = $state("");

  async function submit() {
    if (!message) return;
    console.log(message);
    const fetched = fetch(
      `${import.meta.env.VITE_CONVEX_SITE_URL}/api/message`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      },
    );
    message = "";
    answer = "";
    const response = await fetched;
    const reader = response.body?.getReader();
    while (true) {
      const result = await reader?.read();
      if (!result) break;
      const { done, value } = result;
      if (done) break;
      const text = new TextDecoder().decode(value);
      answer += text;
      console.log(text);
    }
  }
</script>

<Textarea
  bind:value={message}
  onkeydown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }}
  placeholder="Enter your message..."
  class="w-full"
/>
<Button onclick={submit}><ArrowUp /> Send</Button>
<div class="pt-4">
  <p>{answer}</p>
</div>

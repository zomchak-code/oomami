<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { useAuth } from "@mmailaender/convex-better-auth-svelte/svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  const auth = useAuth();

  async function signIn() {
    if (!auth.isLoading && !auth.isAuthenticated) {
      await authClient.signIn.anonymous();
    }
    goto(resolve("/"));
  }
  signIn();
</script>

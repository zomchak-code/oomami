<script lang="ts">
  import { setupConvex } from "convex-svelte";
  import "./layout.css";
  import favicon from "$lib/assets/favicon.svg";
  import {
    createSvelteAuthClient,
    useAuth,
  } from "@mmailaender/convex-better-auth-svelte/svelte";
  import { authClient } from "$lib/auth-client";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  let { children } = $props();

  setupConvex(import.meta.env.VITE_CONVEX_URL);
  createSvelteAuthClient({ authClient });
  const auth = useAuth();

  const isAuth = $derived(page.url.pathname === "/auth");

  $effect(() => {
    if (!isAuth && !auth.isLoading && !auth.isAuthenticated) {
      goto(resolve("/auth"));
    }
  });
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if auth.isLoading}
  <main class="p-4">Loading...</main>
{:else}
  {@render children()}
{/if}

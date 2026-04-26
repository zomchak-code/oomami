<script lang="ts">
  import { page } from "$app/state";
  import z from "zod";
  import { authClient } from "$lib/auth-client";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import AppSidebar from "$lib/components/app-sidebar.svelte";

  let { children } = $props();

  const slug = $derived(z.string().parse(page.params.slug));

  const organizations = authClient.useListOrganizations();
  $organizations.refetch();

  const currentOrganization = $derived(
    $organizations.data?.find((o) => o.slug === slug),
  );

  $effect(() => {
    if (currentOrganization) {
      authClient.organization.setActive({
        organizationId: currentOrganization.id,
      });
    }
  });
</script>

<Sidebar.Provider>
  <AppSidebar />
  <main class="flex-1 p-4">
    {@render children()}
  </main>
</Sidebar.Provider>

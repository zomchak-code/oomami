<script lang="ts">
  import { page } from "$app/state";
  import z from "zod";
  import Building from "@lucide/svelte/icons/building";
  import { authClient } from "$lib/auth-client";
  import * as Select from "$lib/components/ui/select";
  import { faker } from "@faker-js/faker";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  let { children } = $props();
  export function fakeName() {
    faker.seed();
    return `${faker.word.adjective()}-${faker.word.noun()}`;
  }

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

  async function newOrganization() {
    const name = fakeName();
    await authClient.organization.create({
      name: name,
      slug: name,
    });
    $organizations.refetch();
    goto(resolve(`/${name}`));
  }
</script>

<main class="space-x-2 space-y-4">
  {#if $organizations.data && currentOrganization}
    <Select.Root type="single" value={currentOrganization.slug}>
      <Select.Trigger>
        <Building />
        {currentOrganization.name}
      </Select.Trigger>
      <Select.Content>
        {#each $organizations.data.filter((o) => o.slug !== currentOrganization.slug) as organization (organization.slug)}
          <Select.Item
            value={organization.slug}
            onclick={() => goto(resolve(`/${organization.slug}`))}
          >
            {organization.name}
          </Select.Item>
        {/each}
        <Select.Item value="+" onclick={newOrganization}>
          New organization
        </Select.Item>
      </Select.Content>
    </Select.Root>
    {@render children()}
  {/if}
</main>

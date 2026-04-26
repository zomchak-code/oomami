<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import Building from "@lucide/svelte/icons/building";
  import Plus from "@lucide/svelte/icons/plus";
  import { fakeName } from "$lib/faker";

  const activeOrganization = authClient.useActiveOrganization();
  const organizations = authClient.useListOrganizations();

  $effect(() => {
    if (
      $activeOrganization.isPending ||
      $organizations.isPending ||
      $organizations.isRefetching
    )
      return;
    if (
      $activeOrganization.data &&
      $organizations.data?.find(
        (o) => o.slug === $activeOrganization.data!.slug,
      )
    ) {
      goto(resolve(`/${$activeOrganization.data.slug}`));
    } else if ($organizations.data?.length === 1) {
      authClient.organization.setActive({
        organizationSlug: $organizations.data[0].slug,
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

<main class="flex gap-2 flex-wrap">
  {#each $organizations.data as organization (organization.slug)}
    <div class="flex-1">
      <Button
        href={resolve(`/${organization.slug}`)}
        variant="outline"
        class="w-full"
      >
        <Building />
        {organization.name}
      </Button>
    </div>
  {/each}
  <div class="flex-1">
    <Button
      class="w-full border-dashed"
      variant="outline"
      onclick={newOrganization}
    >
      <Plus />
      New organization
    </Button>
  </div>
</main>

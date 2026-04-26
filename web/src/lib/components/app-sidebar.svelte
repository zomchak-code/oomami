<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { fakeName } from "$lib/faker";
  import z from "zod";
  import { page } from "$app/state";
  import Building from "@lucide/svelte/icons/building";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plus from "@lucide/svelte/icons/plus";
  import Bot from "@lucide/svelte/icons/bot";
  import MessageCircle from "@lucide/svelte/icons/message-circle";
  import Settings from "@lucide/svelte/icons/settings";

  const slug = $derived(z.string().parse(page.params.slug));

  const organizations = authClient.useListOrganizations();
  $organizations.refetch();

  const currentOrganization = $derived(
    $organizations.data?.find((o) => o.slug === slug),
  );

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

<Sidebar.Root>
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        {#if $organizations.data && currentOrganization}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Sidebar.MenuButton {...props}>
                  <Building />
                  {currentOrganization.name}
                  <ChevronDown class="ms-auto" />
                </Sidebar.MenuButton>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content class="w-(--bits-dropdown-menu-anchor-width)">
              {#each $organizations.data.filter((o) => o.slug !== currentOrganization.slug) as organization (organization.slug)}
                <DropdownMenu.Item
                  onclick={() => goto(resolve(`/${organization.slug}`))}
                >
                  {organization.name}
                </DropdownMenu.Item>
              {/each}
              <DropdownMenu.Item
                onclick={newOrganization}
                class="flex justify-between items-center"
              >
                New organization
                <Plus />
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          <!-- <Sidebar.MenuItem>
            <Sidebar.MenuButton
              isActive={page.url.pathname === resolve(`/${slug}`)}
            >
              {#snippet child({ props })}
                <a href={resolve(`/${slug}`)} {...props}>
                  <Home />
                  <span>Home</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem> -->
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              isActive={page.url.pathname === resolve(`/${slug}/agents`)}
            >
              {#snippet child({ props })}
                <a href={resolve(`/${slug}/agents`)} {...props}>
                  <Bot />
                  <span>Agents</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              isActive={page.url.pathname === resolve(`/${slug}/sessions`)}
            >
              {#snippet child({ props })}
                <a href={resolve(`/${slug}/sessions`)} {...props}>
                  <MessageCircle />
                  <span>Sessions</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
          <Sidebar.MenuItem>
            <Sidebar.MenuButton
              isActive={page.url.pathname === resolve(`/${slug}/settings`)}
            >
              {#snippet child({ props })}
                <a href={resolve(`/${slug}/settings`)} {...props}>
                  <Settings />
                  <span>Settings</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
</Sidebar.Root>

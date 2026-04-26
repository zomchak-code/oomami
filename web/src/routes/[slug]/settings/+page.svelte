<script lang="ts">
  import { page } from "$app/state";
  import z from "zod";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { api } from "conv/api";
  import { useQuery } from "convex-svelte";
  import * as Item from "$lib/components/ui/item";
  import Key from "@lucide/svelte/icons/key";
  import Copy from "@lucide/svelte/icons/copy";
  import Trash from "@lucide/svelte/icons/trash";
  import Plus from "@lucide/svelte/icons/plus";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import Flame from "@lucide/svelte/icons/flame";
  import { fakeName } from "$lib/faker";

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

  const keys = $derived(useQuery(api.auth.getApiKeys, { slug }));
  let createdApiKey = $state<string | null>(null);

  async function deleteOrganization() {
    if (!confirm("Are you sure you want to delete this organization?")) return;
    await authClient.organization.delete({
      organizationId: currentOrganization!.id,
    });
    $organizations.refetch();
    goto(resolve(`/`));
  }

  async function createApiKey() {
    const { data, error } = await authClient.apiKey.create({
      configId: "org",
      name: fakeName(),
      organizationId: currentOrganization!.id,
    });

    if (error) {
      throw error;
    }

    if (data?.key) {
      createdApiKey = data.key;
      await navigator.clipboard.writeText(data.key);
    }
  }
</script>

<div class="space-y-4">
  {#if currentOrganization}
    <p>Rename organization</p>
    <Input
      type="text"
      value={currentOrganization.name}
      onblur={(e: FocusEvent) =>
        authClient.organization.update({
          organizationId: currentOrganization!.id,
          data: {
            name: (e.target as HTMLInputElement).value,
          },
        })}
    />

    <p>API keys</p>
    {#if keys.data}
      {#if createdApiKey}
        <Item.Root variant="outline">
          <Item.Media>
            <Key />
          </Item.Media>
          <Item.Content>
            <Item.Title>New API key copied</Item.Title>
            <Item.Description>
              Save this key now. It will not be shown again.
            </Item.Description>
          </Item.Content>
          <Item.Actions>
            <Button
              variant="outline"
              onclick={() => navigator.clipboard.writeText(createdApiKey!)}
            >
              <Copy /> Copy again
            </Button>
          </Item.Actions>
        </Item.Root>
      {/if}
      <div class="flex gap-2 flex-wrap">
        {#each keys.data as key (key._id)}
          <div class="flex-1">
            <Item.Root variant="muted" class="h-full">
              <Item.Media>
                <Key />
              </Item.Media>
              <Item.Content>
                <Item.Title>
                  <Input
                    type="text"
                    class="px-0 bg-transparent border-none focus-visible:ring-0"
                    style={`width: ${key.name?.length ?? 0 + 1}ch;`}
                    value={key.name}
                    oninput={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.style.width = "1px";
                      target.style.width = target.scrollWidth + "px";
                    }}
                    onblur={(e: FocusEvent) =>
                      authClient.apiKey.update({
                        configId: "org",
                        keyId: key._id,
                        name: (e.target as HTMLInputElement).value,
                      })}
                  />
                </Item.Title>
              </Item.Content>
              <Item.Actions>
                <Button
                  variant="outline"
                  onclick={() =>
                    authClient.apiKey.delete({
                      configId: "org",
                      keyId: key._id,
                    })}
                >
                  <Trash /> Delete
                </Button>
              </Item.Actions>
            </Item.Root>
          </div>
        {/each}
        <div class="flex-1">
          <Item.Root
            class="h-full justify-center border-dashed hover:bg-muted"
            variant="outline"
            onclick={createApiKey}
          >
            <Plus />
            <span>New key</span>
          </Item.Root>
        </div>
      </div>
      <p>Delete organization</p>
      <Button
        variant="outline"
        onclick={deleteOrganization}
        class="hover:text-destructive"
      >
        <Flame /> Delete organization
      </Button>
    {/if}
  {/if}
</div>

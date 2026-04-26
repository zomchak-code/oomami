<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { useAuth } from "@mmailaender/convex-better-auth-svelte/svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { api } from "conv/api";
  import { useQuery } from "convex-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { fakeName } from "$lib/faker";

  const auth = useAuth();
  const currentUser = useQuery(api.auth.getCurrentUser, () =>
    auth.isAuthenticated ? {} : "skip",
  );

  let mode = $state<"signIn" | "signUp">("signIn");
  let email = $state("");
  let password = $state("");
  let isSubmitting = $state(false);
  let errorMessage = $state<string | undefined>();

  const user = $derived(currentUser.data);
  const isGuest = $derived(user?.isAnonymous === true);
  const isEmailUser = $derived(
    auth.isAuthenticated && user && user.isAnonymous !== true,
  );
  const isWaitingForUser = $derived(auth.isAuthenticated && !user);

  $effect(() => {
    if (isEmailUser) {
      goto(resolve("/"));
    }
  });

  function derivedNameFromEmail(value: string) {
    const localPart = value.trim().split("@")[0]?.replace(/[._-]+/g, " ");
    return localPart?.trim() || value.trim();
  }

  function switchMode(nextMode: "signIn" | "signUp") {
    mode = nextMode;
    errorMessage = undefined;
  }

  async function createStarterOrganization() {
    const name = fakeName();
    await authClient.organization.create({
      name,
      slug: name,
    });
  }

  async function signIn(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = undefined;
    isSubmitting = true;

    try {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (error) {
        errorMessage = "Invalid email or password.";
        return;
      }

      goto(resolve("/"));
    } catch {
      errorMessage = "Invalid email or password.";
    } finally {
      isSubmitting = false;
    }
  }

  async function signUp(event: SubmitEvent) {
    event.preventDefault();
    errorMessage = undefined;
    isSubmitting = true;

    const wasGuest = isGuest;

    try {
      const { error } = await authClient.signUp.email({
        name: derivedNameFromEmail(email),
        email: email.trim(),
        password,
      });

      if (error) {
        errorMessage = "Could not create that account.";
        return;
      }

      if (!wasGuest) {
        await createStarterOrganization();
      }

      goto(resolve("/"));
    } catch {
      errorMessage = "Could not create that account.";
    } finally {
      isSubmitting = false;
    }
  }

  async function continueAsGuest() {
    errorMessage = undefined;
    isSubmitting = true;

    try {
      if (!auth.isAuthenticated) {
        const { error } = await authClient.signIn.anonymous();
        if (error) {
          errorMessage = "Could not start a guest session.";
          return;
        }
      }

      goto(resolve("/"));
    } catch {
      errorMessage = "Could not start a guest session.";
    } finally {
      isSubmitting = false;
    }
  }
</script>

<main class="flex min-h-svh items-center justify-center p-4">
  <section class="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
    <div class="space-y-1">
      <h1 class="text-2xl font-semibold">
        {mode === "signIn" ? "Sign in" : "Create account"}
      </h1>
      <p class="text-sm text-muted-foreground">
        {#if isGuest}
          Upgrade this guest workspace or merge it into an existing account.
        {:else}
          Use email/password, or continue with a temporary guest workspace.
        {/if}
      </p>
    </div>

    <form
      class="mt-6 space-y-4"
      onsubmit={mode === "signIn" ? signIn : signUp}
    >
      <label class="block space-y-1.5 text-sm font-medium">
        <span>Email</span>
        <Input
          bind:value={email}
          type="email"
          autocomplete="email"
          required
          disabled={isSubmitting || isWaitingForUser}
        />
      </label>

      <label class="block space-y-1.5 text-sm font-medium">
        <span>Password</span>
        <Input
          bind:value={password}
          type="password"
          autocomplete={mode === "signIn" ? "current-password" : "new-password"}
          minlength={8}
          required
          disabled={isSubmitting || isWaitingForUser}
        />
      </label>

      {#if errorMessage}
        <p class="text-sm text-destructive" role="alert">{errorMessage}</p>
      {/if}

      <Button class="w-full" type="submit" disabled={isSubmitting || isWaitingForUser}>
        {mode === "signIn" ? "Sign in" : "Create account"}
      </Button>
    </form>

    <div class="mt-4 space-y-2">
      <Button
        class="w-full"
        variant="outline"
        onclick={continueAsGuest}
        disabled={isSubmitting || isWaitingForUser}
      >
        {isGuest ? "Continue to workspace" : "Continue as guest"}
      </Button>
      <Button
        class="w-full"
        variant="ghost"
        onclick={() => switchMode(mode === "signIn" ? "signUp" : "signIn")}
        disabled={isSubmitting || isWaitingForUser}
      >
        {mode === "signIn"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </Button>
    </div>
  </section>
</main>

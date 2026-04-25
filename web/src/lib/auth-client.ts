import { createAuthClient } from "better-auth/svelte";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import {
  anonymousClient,
  organizationClient,
} from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";

export const authClient = createAuthClient({
  plugins: [
    convexClient(),
    anonymousClient(),
    organizationClient(),
    apiKeyClient(),
  ],
});

import {
  createClient,
  type AuthFunctions,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { type DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authSchema from "./betterAuth/schema";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import authConfig from "./auth.config";
import { anonymous, organization } from "better-auth/plugins";
import { fakeName } from "./faker";
import { apiKey } from "@better-auth/api-key";
import type { BetterAuthPlugin } from "better-auth";
import { ConvexError, v, type Infer } from "convex/values";

const siteUrl = process.env["SITE_URL"]!;

const authFunctions: AuthFunctions = internal.auth;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
    authFunctions,
    triggers: {
      user: {
        onCreate: async (ctx, doc) => {
          const name = fakeName();
          const createdAt = Date.now();

          const org = await ctx.runMutation(
            components.betterAuth.adapter.create,
            {
              input: {
                model: "organization",
                data: {
                  name,
                  slug: name,
                  createdAt,
                  logo: null,
                  metadata: null,
                },
              },
            },
          );

          await ctx.runMutation(components.betterAuth.adapter.create, {
            input: {
              model: "member",
              data: {
                organizationId: org._id,
                userId: doc._id,
                role: "owner",
                createdAt,
              },
            },
          });
        },
      },
    },
  },
);

export const { onCreate } = authComponent.triggersApi();

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
      anonymous(),
      organization(),
      apiKey([
        {
          configId: "org",
          defaultPrefix: "oom_",
          references: "organization",
        },
      ]) as BetterAuthPlugin,
    ],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    return user;
  },
});

type ApiKey = Infer<typeof authSchema.tables.apikey.validator> & {
  _id: string;
};

export const getApiKeys = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const org = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "organization",
      where: [{ field: "slug", value: args.slug }],
    });
    if (!org) {
      throw new ConvexError("Organization not found");
    }
    const membership = await ctx.runQuery(
      components.betterAuth.adapter.findOne,
      {
        model: "member",
        where: [
          { field: "organizationId", value: org._id },
          { field: "userId", value: user._id },
        ],
      },
    );
    if (!membership) {
      throw new ConvexError("Forbidden");
    }
    const keys: { page: ApiKey[] } = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      {
        model: "apikey",
        where: [
          { field: "referenceId", value: org._id },
          { field: "configId", value: "org" },
        ],
        paginationOpts: {
          cursor: null,
          numItems: 1000,
        },
      },
    );
    return keys.page;
  },
});

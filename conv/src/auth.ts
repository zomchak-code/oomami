import {
  createClient,
  type AuthFunctions,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { convex } from "@convex-dev/better-auth/plugins";
import { components, internal } from "./_generated/api";
import { type DataModel, type Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import type { GenericActionCtx } from "convex/server";
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
          if (!doc.isAnonymous) {
            return;
          }

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
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex({ authConfig }),
      anonymous({
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          const anonymousUserId = getBetterAuthUserId(anonymousUser.user);
          const newUserId = getBetterAuthUserId(newUser.user);

          if (!anonymousUserId || !newUserId) {
            return;
          }

          await requireRunMutationCtx(ctx).runMutation(
            components.betterAuth.adapter.updateMany,
            {
              input: {
                model: "member",
                where: [{ field: "userId", value: anonymousUserId }],
                update: { userId: newUserId },
              },
              paginationOpts: {
                cursor: null,
                numItems: 100,
              },
            },
          );
        },
      }),
      organization(),
      apiKey([
        {
          configId: "org",
          defaultPrefix: "oom_",
          references: "organization",
          rateLimit: {
            enabled: false,
          },
        },
      ]) as BetterAuthPlugin,
    ],
  }) satisfies BetterAuthOptions;

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx));
};

function getBetterAuthUserId(user: { id?: string; _id?: string }) {
  return user._id ?? user.id;
}

type SessionOrganization = {
  sessionId: Id<"sessions">;
  agentId: Id<"agents">;
  organizationId: string;
};

type AgentOrganization = {
  agentId: Id<"agents">;
  organizationId: string;
};

type VerifiedApiKey = {
  id?: string;
  _id?: string;
  referenceId: string;
};

type VerifyApiKeyResult = {
  valid: boolean;
  error: { message: string; code: string } | null;
  key: VerifiedApiKey | null;
};

type AuthWithApiKey = {
  api: {
    verifyApiKey(args: {
      body: {
        configId: "org";
        key: string;
      };
    }): Promise<VerifyApiKeyResult>;
  };
};

export type AuthPrincipal =
  | { kind: "user"; userId: string }
  | { kind: "apiKey"; apiKeyId: string; organizationId: string };

export type AuthorizedSessionAccess = SessionOrganization & {
  principal: AuthPrincipal;
};

export type AuthorizedOrganizationAccess = {
  organizationId: string;
  principal: AuthPrincipal;
};

export type AuthorizedAgentAccess = AgentOrganization & {
  principal: AuthPrincipal;
};

export class HttpAuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "HttpAuthError";
  }
}

export async function authorizeSessionAccess(
  ctx: GenericActionCtx<DataModel>,
  sessionId: Id<"sessions">,
  headers: Headers,
): Promise<AuthorizedSessionAccess> {
  const sessionOrganization = await getSessionOrganization(ctx, sessionId);
  const access = await authorizeOrganizationAccess(
    ctx,
    sessionOrganization.organizationId,
    headers,
  );

  return {
    ...sessionOrganization,
    principal: access.principal,
  };
}

export async function authorizeAgentAccess(
  ctx: GenericActionCtx<DataModel>,
  agentId: Id<"agents">,
  headers: Headers,
): Promise<AuthorizedAgentAccess> {
  const agentOrganization = await ctx.runQuery(
    internal.agents.getOrganizationIdForAgent,
    { id: agentId },
  );
  const access = await authorizeOrganizationAccess(
    ctx,
    agentOrganization.organizationId,
    headers,
  );

  return {
    ...agentOrganization,
    principal: access.principal,
  };
}

export async function authorizeOrganizationAccess(
  ctx: GenericActionCtx<DataModel>,
  organizationId: string,
  headers: Headers,
): Promise<AuthorizedOrganizationAccess> {
  const apiKeyValue = headers.get("x-api-key")?.trim();

  if (apiKeyValue) {
    const verifiedKey = await verifyOrganizationApiKey(ctx, apiKeyValue);
    if (verifiedKey.referenceId !== organizationId) {
      throw new HttpAuthError(403, "Forbidden");
    }

    return {
      organizationId,
      principal: {
        kind: "apiKey",
        apiKeyId: verifiedKey._id ?? verifiedKey.id ?? "",
        organizationId: verifiedKey.referenceId,
      },
    };
  }

  const user = await getAuthUserForHttp(ctx);
  const membership = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "member",
    where: [
      { field: "organizationId", value: organizationId },
      { field: "userId", value: user._id },
    ],
  });
  if (!membership) {
    throw new HttpAuthError(403, "Forbidden");
  }

  return {
    organizationId,
    principal: { kind: "user", userId: user._id },
  };
}

async function verifyOrganizationApiKey(
  ctx: GenericActionCtx<DataModel>,
  apiKeyValue: string,
): Promise<VerifiedApiKey> {
  const auth = createAuth(ctx) as unknown as AuthWithApiKey;
  let result: VerifyApiKeyResult;
  try {
    result = await auth.api.verifyApiKey({
      body: {
        configId: "org",
        key: apiKeyValue,
      },
    });
  } catch {
    throw new HttpAuthError(401, "Invalid API key");
  }

  if (!result.valid || !result.key) {
    throw new HttpAuthError(401, result.error?.message ?? "Invalid API key");
  }

  return result.key;
}

function getSessionOrganization(
  ctx: GenericActionCtx<DataModel>,
  sessionId: Id<"sessions">,
) {
  return ctx.runQuery(internal.sessions.getOrganizationIdForSession, {
    id: sessionId,
  });
}

async function getAuthUserForHttp(ctx: GenericActionCtx<DataModel>) {
  try {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      throw new HttpAuthError(401, "Unauthorized");
    }
    return user;
  } catch (error) {
    if (error instanceof HttpAuthError) {
      throw error;
    }
    throw new HttpAuthError(401, "Unauthorized");
  }
}

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

type ListedApiKey = Omit<ApiKey, "key">;

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
    return keys.page.map(({ key: _key, ...key }) => key satisfies ListedApiKey);
  },
});

export type Organization = Infer<
  typeof authSchema.tables.organization.validator
> & { _id: string };

async function authedOrganization(ctx: QueryCtx, organization: Organization) {
  const user = await authComponent.getAuthUser(ctx);
  const membership = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "member",
    where: [
      { field: "organizationId", value: organization._id },
      { field: "userId", value: user._id },
    ],
  });
  if (!membership) {
    throw new ConvexError("Forbidden");
  }
  return organization;
}

export async function authedOrganizationBySlug(ctx: QueryCtx, slug: string) {
  const organization: Organization = await ctx.runQuery(
    components.betterAuth.adapter.findOne,
    {
      model: "organization",
      where: [{ field: "slug", value: slug }],
    },
  );
  if (!organization) {
    throw new ConvexError("Organization not found");
  }
  return authedOrganization(ctx, organization);
}

export async function authedOrganizationById(ctx: QueryCtx, id: string) {
  const organization: Organization = await ctx.runQuery(
    components.betterAuth.adapter.findOne,
    {
      model: "organization",
      where: [{ field: "_id", value: id }],
    },
  );
  if (!organization) {
    throw new ConvexError("Organization not found");
  }
  return authedOrganization(ctx, organization);
}

export async function authedOrganizationByAgentId(
  ctx: QueryCtx,
  agentId: Id<"agents">,
) {
  const agent = await ctx.db.get(agentId);

  if (!agent) {
    throw new ConvexError("Agent not found");
  }
  return authedOrganizationById(ctx, agent.organizationId);
}

export async function authedOrganizationBySessionId(
  ctx: QueryCtx,
  sessionId: Id<"sessions">,
) {
  const session = await ctx.db.get(sessionId);
  if (!session) {
    throw new ConvexError("Session not found");
  }
  return authedOrganizationByAgentId(ctx, session.agentId);
}

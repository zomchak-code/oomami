import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import {
  authedOrganizationByAgentId,
  authedOrganizationById,
  authedOrganizationBySlug,
} from "./auth";
import type { Id } from "./_generated/dataModel";
import { fakeName } from "./faker";

function cleanName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ConvexError("Name cannot be empty");
  }
  return trimmed;
}

export const create = mutation({
  args: {
    agentId: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    await authedOrganizationById(ctx, agent.organizationId);
    if (agent.archivedAt !== undefined) {
      throw new ConvexError("Cannot create a session for an archived agent");
    }

    const session = await ctx.db.insert("sessions", {
      agentId: args.agentId,
      name: fakeName(),
    });

    return session;
  },
});

export const list = query({
  args: {
    slug: v.string(),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const organization = await authedOrganizationBySlug(ctx, args.slug);
    const wantArchived = args.archived ?? false;

    const agents = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("organizationId"), organization._id))
      .collect();

    const sessions = await Promise.all(
      agents.map(async (agent) => {
        return ctx.db
          .query("sessions")
          .filter((q) =>
            q.and(
              q.eq(q.field("agentId"), agent._id),
              wantArchived
                ? q.neq(q.field("archivedAt"), undefined)
                : q.eq(q.field("archivedAt"), undefined),
            ),
          )
          .collect()
          .then((sessions) =>
            sessions.map((session) => ({
              ...session,
              agent,
            })),
          );
      }),
    );

    return sessions.flat();
  },
});

export const get = query({
  args: {
    id: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    const agent = await ctx.db.get(session.agentId);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    await authedOrganizationById(ctx, agent.organizationId);
    return {
      ...session,
      agent,
    };
  },
});

export const getOrganizationIdForSession = internalQuery({
  args: {
    id: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    const agent = await ctx.db.get(session.agentId);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    return {
      sessionId: session._id,
      agentId: agent._id,
      organizationId: agent.organizationId,
    };
  },
});

export const archive = mutation({
  args: {
    id: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    await authedOrganizationByAgentId(ctx, session.agentId);
    await ctx.db.patch(args.id, { archivedAt: Date.now() });
  },
});

export const restore = mutation({
  args: {
    id: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    await authedOrganizationByAgentId(ctx, session.agentId);
    await ctx.db.patch(args.id, { archivedAt: undefined });
  },
});

export const updateName = mutation({
  args: {
    id: v.id("sessions"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    await authedOrganizationByAgentId(ctx, session.agentId);
    if (session.archivedAt !== undefined) {
      throw new ConvexError("Cannot edit an archived session");
    }
    await ctx.db.patch(args.id, { name: cleanName(args.name) });
  },
});

async function getSessionWithAgent(
  ctx: { db: QueryCtx["db"] },
  id: Id<"sessions">,
) {
  const session = await ctx.db.get(id);
  if (!session) {
    throw new ConvexError("Session not found");
  }
  const agent = await ctx.db.get(session.agentId);
  if (!agent) {
    throw new ConvexError("Agent not found");
  }
  return {
    ...session,
    agent,
  };
}

export const createForAuthorizedOrganization = internalMutation({
  args: {
    organizationId: v.string(),
    agentId: v.id("agents"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    if (agent.organizationId !== args.organizationId) {
      throw new ConvexError("Agent does not belong to organization");
    }
    if (agent.archivedAt !== undefined) {
      throw new ConvexError("Cannot create a session for an archived agent");
    }

    const id = await ctx.db.insert("sessions", {
      agentId: args.agentId,
      name: args.name === undefined ? fakeName() : cleanName(args.name),
    });

    return getSessionWithAgent(ctx, id);
  },
});

export const listForAuthorizedOrganization = internalQuery({
  args: {
    organizationId: v.string(),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const wantArchived = args.archived ?? false;
    const agents = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("organizationId"), args.organizationId))
      .collect();

    const sessions = await Promise.all(
      agents.map((agent) =>
        ctx.db
          .query("sessions")
          .filter((q) =>
            q.and(
              q.eq(q.field("agentId"), agent._id),
              wantArchived
                ? q.neq(q.field("archivedAt"), undefined)
                : q.eq(q.field("archivedAt"), undefined),
            ),
          )
          .collect()
          .then((sessions) =>
            sessions.map((session) => ({
              ...session,
              agent,
            })),
          ),
      ),
    );

    return sessions.flat();
  },
});

export const getForAuthorizedSession = internalQuery({
  args: {
    id: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return getSessionWithAgent(ctx, args.id);
  },
});

export const updateForAuthorizedSession = internalMutation({
  args: {
    id: v.id("sessions"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new ConvexError("Session not found");
    }
    if (session.archivedAt !== undefined) {
      throw new ConvexError("Cannot edit an archived session");
    }

    await ctx.db.patch(args.id, { name: cleanName(args.name) });
    return getSessionWithAgent(ctx, args.id);
  },
});

export const archiveForAuthorizedSession = internalMutation({
  args: {
    id: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { archivedAt: Date.now() });
    return getSessionWithAgent(ctx, args.id);
  },
});

export const restoreForAuthorizedSession = internalMutation({
  args: {
    id: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { archivedAt: undefined });
    return getSessionWithAgent(ctx, args.id);
  },
});

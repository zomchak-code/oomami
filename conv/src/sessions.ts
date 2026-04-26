import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import {
  authedOrganizationByAgentId,
  authedOrganizationById,
  authedOrganizationBySlug,
} from "./auth";
import { fakeName } from "./faker";

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

    const nonNullSessions = sessions.flat().filter((s) => s !== null);
    return nonNullSessions;
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
    const trimmed = args.name.trim();
    if (!trimmed) {
      throw new ConvexError("Name cannot be empty");
    }
    await ctx.db.patch(args.id, { name: trimmed });
  },
});

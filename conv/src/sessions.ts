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
    await authedOrganizationByAgentId(ctx, args.agentId);

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
  },
  handler: async (ctx, args) => {
    const organization = await authedOrganizationBySlug(ctx, args.slug);

    const agents = await ctx.db
      .query("agents")
      .filter((q) => q.eq(q.field("organizationId"), organization._id))
      .collect();

    const sessions = await Promise.all(
      agents.map(async (agent) => {
        return ctx.db
          .query("sessions")
          .filter((q) => q.eq(q.field("agentId"), agent._id))
          .collect();
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

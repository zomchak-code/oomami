import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authedOrganizationById, authedOrganizationBySlug } from "./auth";
import { fakeName } from "./faker";

export const create = mutation({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await authedOrganizationBySlug(ctx, args.slug);

    const agent = await ctx.db.insert("agents", {
      organizationId: organization._id,
      name: fakeName(),
    });
    return agent;
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
    return agents;
  },
});

export const get = query({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    await authedOrganizationById(ctx, agent.organizationId);
    return agent;
  },
});

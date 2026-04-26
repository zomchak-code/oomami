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
      systemPrompt: "You are a helpful assistant.",
    });
    return agent;
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
      .filter((q) =>
        q.and(
          q.eq(q.field("organizationId"), organization._id),
          wantArchived
            ? q.neq(q.field("archivedAt"), undefined)
            : q.eq(q.field("archivedAt"), undefined),
        ),
      )
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

export const archive = mutation({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    await authedOrganizationById(ctx, agent.organizationId);
    await ctx.db.patch(args.id, { archivedAt: Date.now() });
  },
});

export const restore = mutation({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    await authedOrganizationById(ctx, agent.organizationId);
    await ctx.db.patch(args.id, { archivedAt: undefined });
  },
});

export const updateName = mutation({
  args: {
    id: v.id("agents"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    await authedOrganizationById(ctx, agent.organizationId);
    if (agent.archivedAt !== undefined) {
      throw new ConvexError("Cannot edit an archived agent");
    }
    const trimmed = args.name.trim();
    if (!trimmed) {
      throw new ConvexError("Name cannot be empty");
    }
    await ctx.db.patch(args.id, { name: trimmed });
  },
});

export const updateSystemPrompt = mutation({
  args: {
    id: v.id("agents"),
    systemPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    await authedOrganizationById(ctx, agent.organizationId);
    if (agent.archivedAt !== undefined) {
      throw new ConvexError("Cannot edit an archived agent");
    }
    await ctx.db.patch(args.id, { systemPrompt: args.systemPrompt });
  },
});

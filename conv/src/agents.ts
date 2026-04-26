import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authedOrganizationById, authedOrganizationBySlug } from "./auth";
import { fakeName } from "./faker";

const defaultSystemPrompt = "You are a helpful assistant.";

function cleanName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ConvexError("Name cannot be empty");
  }
  return trimmed;
}

export const create = mutation({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await authedOrganizationBySlug(ctx, args.slug);

    const agent = await ctx.db.insert("agents", {
      organizationId: organization._id,
      name: fakeName(),
      systemPrompt: defaultSystemPrompt,
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
    await ctx.db.patch(args.id, { name: cleanName(args.name) });
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

export const getOrganizationIdForAgent = internalQuery({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    return {
      agentId: agent._id,
      organizationId: agent.organizationId,
    };
  },
});

export const createForAuthorizedOrganization = internalMutation({
  args: {
    organizationId: v.string(),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("agents", {
      organizationId: args.organizationId,
      name: args.name === undefined ? fakeName() : cleanName(args.name),
      systemPrompt: args.systemPrompt ?? defaultSystemPrompt,
    });
    const agent = await ctx.db.get(id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    return agent;
  },
});

export const listForAuthorizedOrganization = internalQuery({
  args: {
    organizationId: v.string(),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const wantArchived = args.archived ?? false;
    return ctx.db
      .query("agents")
      .filter((q) =>
        q.and(
          q.eq(q.field("organizationId"), args.organizationId),
          wantArchived
            ? q.neq(q.field("archivedAt"), undefined)
            : q.eq(q.field("archivedAt"), undefined),
        ),
      )
      .collect();
  },
});

export const getForAuthorizedAgent = internalQuery({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    return agent;
  },
});

export const updateForAuthorizedAgent = internalMutation({
  args: {
    id: v.id("agents"),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    if (agent.archivedAt !== undefined) {
      throw new ConvexError("Cannot edit an archived agent");
    }

    await ctx.db.patch(args.id, {
      ...(args.name === undefined ? {} : { name: cleanName(args.name) }),
      ...(args.systemPrompt === undefined
        ? {}
        : { systemPrompt: args.systemPrompt }),
    });

    const updated = await ctx.db.get(args.id);
    if (!updated) {
      throw new ConvexError("Agent not found");
    }
    return updated;
  },
});

export const archiveForAuthorizedAgent = internalMutation({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { archivedAt: Date.now() });
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    return agent;
  },
});

export const restoreForAuthorizedAgent = internalMutation({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { archivedAt: undefined });
    const agent = await ctx.db.get(args.id);
    if (!agent) {
      throw new ConvexError("Agent not found");
    }
    return agent;
  },
});

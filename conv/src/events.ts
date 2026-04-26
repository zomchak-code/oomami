import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { authedOrganizationBySessionId } from "./auth";
import type { DataModel, Id } from "./_generated/dataModel";
import { eventSchema, type EventType, type PersistedEvent } from "./schema";
import type { GenericActionCtx } from "convex/server";
import { api } from "../api";
import { zid } from "convex-helpers/server/zod4";
import z from "zod";

export function createEvent(
  ctx: GenericActionCtx<DataModel>,
  event: EventType,
) {
  return ctx.runMutation(api.events.create, event);
}

export function updateEvent(
  ctx: GenericActionCtx<DataModel>,
  id: Id<"events">,
  event: EventType,
) {
  return ctx.runMutation(api.events.update, { id, event });
}

async function ensureSessionWritable(ctx: MutationCtx, sessionId: Id<"sessions">) {
  const session = await ctx.db.get(sessionId);
  if (!session) {
    throw new ConvexError("Session not found");
  }
  if (session.archivedAt !== undefined) {
    throw new ConvexError("Cannot write to an archived session");
  }
}

export const create = mutation({
  handler: async (ctx, args) => {
    const event = eventSchema.parse(args);
    await authedOrganizationBySessionId(ctx, event.sessionId);
    await ensureSessionWritable(ctx, event.sessionId);
    return ctx.db.insert("events", event);
  },
});

export const update = mutation({
  handler: async (ctx, args) => {
    const input = z
      .object({
        id: zid("events"),
        event: eventSchema,
      })
      .parse(args);
    const existing = await ctx.db.get(input.id);
    if (!existing) {
      throw new ConvexError("Event not found");
    }
    await authedOrganizationBySessionId(ctx, existing.sessionId);
    if (existing.sessionId !== input.event.sessionId) {
      throw new ConvexError("Event session mismatch");
    }
    await ensureSessionWritable(ctx, existing.sessionId);
    return ctx.db.patch(existing._id, { data: input.event.data });
  },
});

function getEvents(ctx: QueryCtx, sessionId: Id<"sessions">) {
  return ctx.db
    .query("events")
    .filter((q) => q.eq(q.field("sessionId"), sessionId))
    .collect() as Promise<PersistedEvent[]>;
}

export const list = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    await authedOrganizationBySessionId(ctx, args.sessionId);
    return getEvents(ctx, args.sessionId);
  },
});

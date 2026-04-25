import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authedOrganizationBySessionId } from "./auth";
import type { DataModel, Id } from "./_generated/dataModel";
import { eventSchema, type EventType, type PersistedEvent } from "./schema";
import type { GenericActionCtx } from "convex/server";
import { api } from "../api";

export function createEvent(
  ctx: GenericActionCtx<DataModel>,
  event: EventType,
) {
  return ctx.runMutation(api.events.create, event);
}

export const create = mutation({
  handler: async (ctx, args) => {
    const event = eventSchema.parse(args);
    await authedOrganizationBySessionId(ctx, event.sessionId);
    return ctx.db.insert("events", event);
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

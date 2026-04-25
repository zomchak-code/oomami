import { mutation, query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { authedOrganizationBySessionId } from "./auth";
import type { DataModel, Id } from "./_generated/dataModel";
import { eventDataSchema, type EventType } from "./schema";
import type { GenericActionCtx } from "convex/server";
import { api } from "../api";

export function createEvent(
  ctx: GenericActionCtx<DataModel>,
  event: Omit<EventType, "_id" | "_creationTime">,
) {
  return ctx.runMutation(api.events.create, {
    sessionId: event.sessionId,
    type: event.type,
    data: event.data,
  });
}

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    type: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    await authedOrganizationBySessionId(ctx, args.sessionId);
    const eventData = eventDataSchema.parse(args.data);
    return ctx.db.insert("events", {
      sessionId: args.sessionId,
      type: args.type,
      data: eventData,
    });
  },
});

function getEvents(ctx: QueryCtx, sessionId: Id<"sessions">) {
  return ctx.db
    .query("events")
    .filter((q) => q.eq(q.field("sessionId"), sessionId))
    .collect() as Promise<EventType[]>;
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

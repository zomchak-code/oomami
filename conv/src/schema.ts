import {
  assistantModelMessageSchema,
  toolModelMessageSchema,
  userModelMessageSchema,
} from "ai";
import { zid } from "convex-helpers/server/zod4";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import z from "zod";
import type { Doc } from "./_generated/dataModel";

export const agentIdSchema = zid("agents");
export const sessionIdSchema = zid("sessions");

type ModelMessageSchema = z.core.$ZodTypeDiscriminable;

export const eventDataSchema = z.discriminatedUnion("role", [
  userModelMessageSchema as ModelMessageSchema,
  assistantModelMessageSchema as ModelMessageSchema,
  toolModelMessageSchema as ModelMessageSchema,
]);

export type EventType = Doc<"events"> & {
  data: z.infer<typeof eventDataSchema>;
};

export default defineSchema({
  agents: defineTable({
    organizationId: v.string(),
    name: v.string(),
  }),
  sessions: defineTable({
    agentId: v.id("agents"),
    name: v.string(),
  }),
  events: defineTable({
    sessionId: v.id("sessions"),
    type: v.string(),
    data: v.any(),
  }),
});

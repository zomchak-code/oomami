import {
  assistantModelMessageSchema,
  toolModelMessageSchema,
  userModelMessageSchema,
  type AssistantModelMessage,
  type ToolModelMessage,
} from "ai";
import { zid } from "convex-helpers/server/zod4";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import z from "zod";
import type { Id } from "./_generated/dataModel";

export const agentIdSchema = zid("agents");
export const sessionIdSchema = zid("sessions");

const eventBaseSchema = z.object({
  sessionId: sessionIdSchema,
});
const userMessageEventSchema = eventBaseSchema.extend({
  type: z.literal("user.message"),
  data: userModelMessageSchema,
});

type DiscriminableModelMessageSchema<T> = z.ZodType<T> &
  z.core.$ZodTypeDiscriminable;

const discriminableAssistantModelMessageSchema =
  assistantModelMessageSchema as DiscriminableModelMessageSchema<AssistantModelMessage>;
const discriminableToolModelMessageSchema =
  toolModelMessageSchema as DiscriminableModelMessageSchema<ToolModelMessage>;

const assistantMessagesEventSchema = eventBaseSchema.extend({
  type: z.literal("assistant.response"),
  data: z.array(
    z.discriminatedUnion("role", [
      discriminableAssistantModelMessageSchema,
      discriminableToolModelMessageSchema,
    ]),
  ),
});

toolModelMessageSchema;

export const eventSchema = z.discriminatedUnion("type", [
  userMessageEventSchema,
  assistantMessagesEventSchema,
]);

export type EventType = z.infer<typeof eventSchema>;
export type PersistedEvent = z.infer<typeof eventSchema> & {
  _id: Id<"events">;
  _creationTime: number;
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

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

const userMessageEventBodySchema = z.object({
  type: z.literal("user.message"),
  data: userModelMessageSchema,
});

const userMessageEventSchema = userMessageEventBodySchema.extend({
  sessionId: sessionIdSchema,
});

type DiscriminableModelMessageSchema<T> = z.ZodType<T> &
  z.core.$ZodTypeDiscriminable;

const discriminableAssistantModelMessageSchema =
  assistantModelMessageSchema as DiscriminableModelMessageSchema<AssistantModelMessage>;
const discriminableToolModelMessageSchema =
  toolModelMessageSchema as DiscriminableModelMessageSchema<ToolModelMessage>;

const assistantMessagesEventBodySchema = z.object({
  type: z.literal("assistant.response"),
  data: z.array(
    z.discriminatedUnion("role", [
      discriminableAssistantModelMessageSchema,
      discriminableToolModelMessageSchema,
    ]),
  ),
});

const assistantMessagesEventSchema = assistantMessagesEventBodySchema.extend({
  sessionId: sessionIdSchema,
});

export const eventBodySchema = z.discriminatedUnion("type", [
  userMessageEventBodySchema,
  assistantMessagesEventBodySchema,
]);

export const eventSchema = z.discriminatedUnion("type", [
  userMessageEventSchema,
  assistantMessagesEventSchema,
]);

export type EventType = z.infer<typeof eventSchema>;
export type EventBody = z.infer<typeof eventBodySchema>;
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

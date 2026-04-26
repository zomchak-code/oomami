import { userModelMessageSchema } from "ai";
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

const agentTextEventBodySchema = z.object({
  type: z.literal("agent.text"),
  data: z.object({
    text: z.string(),
  }),
});

const agentReasoningEventBodySchema = z.object({
  type: z.literal("agent.reasoning"),
  data: z.object({
    text: z.string(),
    providerMetadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

const agentToolCallEventBodySchema = z.object({
  type: z.literal("agent.tool-call"),
  data: z.object({
    toolCallId: z.string(),
    toolName: z.string(),
    input: z.unknown(),
  }),
});

const toolResultOutputSchema = z.discriminatedUnion("type", [
  // z.object({
  //   type: z.literal("text"),
  //   value: z.string(),
  // }),
  z.object({
    type: z.literal("json"),
    value: z.unknown(),
  }),
  // z.object({
  //   type: z.literal("error-text"),
  //   value: z.string(),
  // }),
  z.object({
    type: z.literal("error-json"),
    value: z.unknown(),
  }),
]);

const agentToolResultEventBodySchema = z.object({
  type: z.literal("agent.tool-result"),
  data: z.object({
    toolCallId: z.string(),
    toolName: z.string(),
    output: toolResultOutputSchema,
  }),
});

// TODO TECH DEBT: these schemas definitions have repeating structured
const agentTextEventSchema = agentTextEventBodySchema.extend({
  sessionId: sessionIdSchema,
});

const agentReasoningEventSchema = agentReasoningEventBodySchema.extend({
  sessionId: sessionIdSchema,
});

const agentToolCallEventSchema = agentToolCallEventBodySchema.extend({
  sessionId: sessionIdSchema,
});

const agentToolResultEventSchema = agentToolResultEventBodySchema.extend({
  sessionId: sessionIdSchema,
});

export const eventBodySchema = z.discriminatedUnion("type", [
  userMessageEventBodySchema,
  agentTextEventBodySchema,
  agentReasoningEventBodySchema,
  agentToolCallEventBodySchema,
  agentToolResultEventBodySchema,
]);

export const eventSchema = z.discriminatedUnion("type", [
  userMessageEventSchema,
  agentTextEventSchema,
  agentReasoningEventSchema,
  agentToolCallEventSchema,
  agentToolResultEventSchema,
]);

export const postableEventSchema = z.discriminatedUnion("type", [
  userMessageEventBodySchema,
  agentToolResultEventBodySchema,
]);

export const serverToolDefinitionSchema = z.object({
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()),
});

export const createEventsRequestSchema = z.object({
  events: z.array(postableEventSchema).min(1),
  tools: z.record(z.string(), serverToolDefinitionSchema).optional(),
});

export type EventType = z.infer<typeof eventSchema>;
export type EventBody = z.infer<typeof eventBodySchema>;
export type ServerToolDefinition = z.infer<typeof serverToolDefinitionSchema>;
export type CreateEventsRequest = z.infer<typeof createEventsRequestSchema>;
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

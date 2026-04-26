import {
  authorizeAgentAccess,
  authorizeOrganizationAccess,
  authComponent,
  authorizeSessionAccess,
  createAuth,
  HttpAuthError,
} from "./auth";
import type { ActionCtx } from "./_generated/server";
import { model } from "./agent";
import {
  type JSONSchema7,
  jsonSchema,
  streamText,
  tool,
  type ModelMessage,
  type TextPart,
  type TextStreamPart,
  type ToolCallPart,
  type ToolResultPart,
  type ToolSet,
} from "ai";
import {
  agentIdSchema,
  createEventsRequestSchema,
  eventSchema,
  sessionIdSchema,
  type EventType,
  type PersistedEvent,
  type ServerToolDefinition,
} from "./schema";
import {
  createAuthorizedEvent,
  listAuthorizedEvents,
  updateAuthorizedEvent,
} from "./events";
import {
  Hono,
  HttpRouterWithHono,
  type HonoWithConvex,
} from "convex-helpers/server/hono";
import { cors } from "hono/cors";
import type { DataModel, Id } from "./_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import { internal } from "../api";
import { ConvexError } from "convex/values";
import z from "zod";

const app: HonoWithConvex<ActionCtx> = new Hono();

app.use(
  "/api/v0/*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type", "x-api-key"],
    allowMethods: ["GET", "PATCH", "POST", "OPTIONS"],
  }),
);

app.notFound(() => {
  return jsonError("Not found", 404);
});

const createAgentRequestSchema = z.object({
  name: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const updateAgentRequestSchema = z.object({
  name: z.string().optional(),
  systemPrompt: z.string().optional(),
});

const createSessionRequestSchema = z.object({
  agentId: agentIdSchema,
  name: z.string().optional(),
});

const updateSessionRequestSchema = z.object({
  name: z.string(),
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof HttpAuthError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof z.ZodError) {
    return jsonError(z.prettifyError(error), 400);
  }

  if (error instanceof ConvexError) {
    const message = String(error.data ?? error.message);
    return jsonError(
      message,
      message.toLowerCase().includes("not found") ? 404 : 400,
    );
  }

  if (error instanceof Error) {
    return jsonError(error.message, 400);
  }

  return jsonError("Internal server error", 500);
}

async function jsonRoute(operation: () => Promise<unknown>) {
  try {
    return Response.json(await operation());
  } catch (error) {
    return errorResponse(error);
  }
}

function archivedQuery(value: string | undefined) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("archived must be true or false");
}

type ReasoningPart = {
  type: "reasoning";
  text: string;
  providerMetadata?: Record<string, unknown>;
};

function eventsToMessages(events: EventType[]) {
  const messages: ModelMessage[] = [];
  let assistantParts: Array<TextPart | ReasoningPart | ToolCallPart> = [];
  let toolParts: Array<Omit<ToolResultPart, "output"> & { output: unknown }> =
    [];

  const flushAssistant = () => {
    if (!assistantParts.length) return;
    messages.push({
      role: "assistant",
      content: assistantParts,
    } as ModelMessage);
    assistantParts = [];
  };

  const flushTool = () => {
    if (!toolParts.length) return;
    messages.push({
      role: "tool",
      content: toolParts,
    } as ModelMessage);
    toolParts = [];
  };

  for (const event of events) {
    if (event.type === "user.message") {
      flushAssistant();
      flushTool();
      messages.push(event.data);
    } else if (event.type === "agent.text") {
      flushTool();
      assistantParts.push({
        type: "text",
        text: event.data.text,
      });
    } else if (event.type === "agent.reasoning") {
      flushTool();
      assistantParts.push({
        type: "reasoning",
        text: event.data.text,
        providerMetadata: event.data.providerMetadata,
      });
    } else if (event.type === "agent.tool-call") {
      flushTool();
      assistantParts.push({
        type: "tool-call",
        toolCallId: event.data.toolCallId,
        toolName: event.data.toolName,
        input: event.data.input,
      });
    } else if (event.type === "agent.tool-result") {
      flushAssistant();
      toolParts.push({
        type: "tool-result",
        toolCallId: event.data.toolCallId,
        toolName: event.data.toolName,
        output: event.data.output,
      });
    }
  }

  flushAssistant();
  flushTool();
  return messages;
}

function toolsToToolSet(tools?: Record<string, ServerToolDefinition>) {
  if (!tools) return undefined;

  return Object.fromEntries(
    Object.entries(tools).map(([name, definition]) => [
      name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema(toolInputJsonSchema(definition.inputSchema)),
      }),
    ]),
  );
}

function toolInputJsonSchema(
  inputSchema: ServerToolDefinition["inputSchema"],
): JSONSchema7 {
  if (isRecord(inputSchema.jsonSchema)) {
    return inputSchema.jsonSchema as JSONSchema7;
  }

  return inputSchema as JSONSchema7;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReadyToStream(history: PersistedEvent[]) {
  const toolCalls = new Set<string>();
  const toolResults = new Set<string>();
  for (const event of history) {
    if (event.type === "agent.tool-call") {
      toolCalls.add(event.data.toolCallId);
    } else if (event.type === "agent.tool-result") {
      toolResults.add(event.data.toolCallId);
    }
  }
  for (const toolCallId of toolCalls) {
    if (!toolResults.has(toolCallId)) {
      return false;
    }
  }
  return true;
}

async function persistPart(
  ctx: GenericActionCtx<DataModel>,
  sessionId: Id<"sessions">,
  part: TextStreamPart<ToolSet>,
  map: Record<string, { id: Id<"events">; text: string }>,
) {
  if (part.type === "text-start") {
    const id = await createAuthorizedEvent(ctx, {
      sessionId,
      type: "agent.text",
      data: {
        text: "",
      },
    });
    map[part.id] = { id, text: "" };
  } else if (part.type === "text-delta") {
    const mapped = map[part.id];
    if (!mapped) return;
    mapped.text += part.text;
  } else if (part.type === "text-end") {
    const mapped = map[part.id];
    if (!mapped) return;
    await updateAuthorizedEvent(ctx, mapped.id, {
      sessionId,
      type: "agent.text",
      data: {
        text: mapped.text,
      },
    });
  } else if (part.type === "reasoning-start") {
    const id = await createAuthorizedEvent(ctx, {
      sessionId,
      type: "agent.reasoning",
      data: {
        text: "",
      },
    });
    map[part.id] = { id, text: "" };
  } else if (part.type === "reasoning-delta") {
    const mapped = map[part.id];
    if (!mapped) return;
    mapped.text += part.text;
  } else if (part.type === "reasoning-end") {
    const mapped = map[part.id];
    if (!mapped) return;
    await updateAuthorizedEvent(ctx, mapped.id, {
      sessionId,
      type: "agent.reasoning",
      data: {
        text: mapped.text,
      },
    });
  } else if (part.type === "tool-call") {
    // need to make sure we persist tool call before returning it to the client
    await createAuthorizedEvent(ctx, {
      sessionId,
      type: "agent.tool-call",
      data: {
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input,
      },
    });
  }
}

app.get("/api/v0/organizations/:organizationId/agents", async (c) =>
  jsonRoute(async () => {
    const organizationId = c.req.param("organizationId");
    await authorizeOrganizationAccess(c.env, organizationId, c.req.raw.headers);
    return c.env.runQuery(internal.agents.listForAuthorizedOrganization, {
      organizationId,
      archived: archivedQuery(c.req.query("archived")),
    });
  }),
);

app.post("/api/v0/organizations/:organizationId/agents", async (c) =>
  jsonRoute(async () => {
    const organizationId = c.req.param("organizationId");
    await authorizeOrganizationAccess(c.env, organizationId, c.req.raw.headers);
    const request = createAgentRequestSchema.parse(await c.req.json());
    return c.env.runMutation(internal.agents.createForAuthorizedOrganization, {
      organizationId,
      ...request,
    });
  }),
);

app.get("/api/v0/agents/:agentId", async (c) =>
  jsonRoute(async () => {
    const agentId = agentIdSchema.parse(c.req.param("agentId"));
    await authorizeAgentAccess(c.env, agentId, c.req.raw.headers);
    return c.env.runQuery(internal.agents.getForAuthorizedAgent, {
      id: agentId,
    });
  }),
);

app.patch("/api/v0/agents/:agentId", async (c) =>
  jsonRoute(async () => {
    const agentId = agentIdSchema.parse(c.req.param("agentId"));
    await authorizeAgentAccess(c.env, agentId, c.req.raw.headers);
    const request = updateAgentRequestSchema.parse(await c.req.json());
    return c.env.runMutation(internal.agents.updateForAuthorizedAgent, {
      id: agentId,
      ...request,
    });
  }),
);

app.post("/api/v0/agents/:agentId/archive", async (c) =>
  jsonRoute(async () => {
    const agentId = agentIdSchema.parse(c.req.param("agentId"));
    await authorizeAgentAccess(c.env, agentId, c.req.raw.headers);
    return c.env.runMutation(internal.agents.archiveForAuthorizedAgent, {
      id: agentId,
    });
  }),
);

app.post("/api/v0/agents/:agentId/restore", async (c) =>
  jsonRoute(async () => {
    const agentId = agentIdSchema.parse(c.req.param("agentId"));
    await authorizeAgentAccess(c.env, agentId, c.req.raw.headers);
    return c.env.runMutation(internal.agents.restoreForAuthorizedAgent, {
      id: agentId,
    });
  }),
);

app.get("/api/v0/organizations/:organizationId/sessions", async (c) =>
  jsonRoute(async () => {
    const organizationId = c.req.param("organizationId");
    await authorizeOrganizationAccess(c.env, organizationId, c.req.raw.headers);
    return c.env.runQuery(internal.sessions.listForAuthorizedOrganization, {
      organizationId,
      archived: archivedQuery(c.req.query("archived")),
    });
  }),
);

app.post("/api/v0/organizations/:organizationId/sessions", async (c) =>
  jsonRoute(async () => {
    const organizationId = c.req.param("organizationId");
    await authorizeOrganizationAccess(c.env, organizationId, c.req.raw.headers);
    const request = createSessionRequestSchema.parse(await c.req.json());
    return c.env.runMutation(
      internal.sessions.createForAuthorizedOrganization,
      {
        organizationId,
        ...request,
      },
    );
  }),
);

app.get("/api/v0/sessions/:sessionId", async (c) =>
  jsonRoute(async () => {
    const sessionId = sessionIdSchema.parse(c.req.param("sessionId"));
    await authorizeSessionAccess(c.env, sessionId, c.req.raw.headers);
    return c.env.runQuery(internal.sessions.getForAuthorizedSession, {
      id: sessionId,
    });
  }),
);

app.patch("/api/v0/sessions/:sessionId", async (c) =>
  jsonRoute(async () => {
    const sessionId = sessionIdSchema.parse(c.req.param("sessionId"));
    await authorizeSessionAccess(c.env, sessionId, c.req.raw.headers);
    const request = updateSessionRequestSchema.parse(await c.req.json());
    return c.env.runMutation(internal.sessions.updateForAuthorizedSession, {
      id: sessionId,
      ...request,
    });
  }),
);

app.post("/api/v0/sessions/:sessionId/archive", async (c) =>
  jsonRoute(async () => {
    const sessionId = sessionIdSchema.parse(c.req.param("sessionId"));
    await authorizeSessionAccess(c.env, sessionId, c.req.raw.headers);
    return c.env.runMutation(internal.sessions.archiveForAuthorizedSession, {
      id: sessionId,
    });
  }),
);

app.post("/api/v0/sessions/:sessionId/restore", async (c) =>
  jsonRoute(async () => {
    const sessionId = sessionIdSchema.parse(c.req.param("sessionId"));
    await authorizeSessionAccess(c.env, sessionId, c.req.raw.headers);
    return c.env.runMutation(internal.sessions.restoreForAuthorizedSession, {
      id: sessionId,
    });
  }),
);

app.get("/api/v0/sessions/:sessionId/events", async (c) =>
  jsonRoute(async () => {
    const sessionId = sessionIdSchema.parse(c.req.param("sessionId"));
    await authorizeSessionAccess(c.env, sessionId, c.req.raw.headers);
    return listAuthorizedEvents(c.env, sessionId);
  }),
);

app.post("/api/v0/sessions/:sessionId/events", async (c) => {
  let sessionId: Id<"sessions">;
  let request: z.infer<typeof createEventsRequestSchema>;
  try {
    sessionId = sessionIdSchema.parse(c.req.param("sessionId"));
    await authorizeSessionAccess(c.env, sessionId, c.req.raw.headers);
    request = createEventsRequestSchema.parse(await c.req.json());
  } catch (error) {
    return errorResponse(error);
  }

  let events: PersistedEvent[];
  try {
    for (const body of request.events) {
      const event = eventSchema.parse({
        sessionId,
        ...body,
      });
      await createAuthorizedEvent(c.env, event);
    }

    events = await listAuthorizedEvents(c.env, sessionId);
  } catch (error) {
    return errorResponse(error);
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        if (isReadyToStream(events)) {
          const result = streamText({
            model,
            messages: eventsToMessages(events),
            tools: toolsToToolSet(request.tools),
          });

          const map: Record<string, { id: Id<"events">; text: string }> = {};

          for await (const part of result.fullStream) {
            await persistPart(c.env, sessionId, part, map);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(part)}\n\n`),
            );
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
});

const http = new HttpRouterWithHono(app);
authComponent.registerRoutes(http, createAuth);

export default http;

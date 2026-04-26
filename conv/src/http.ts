import {
  authComponent,
  authorizeSessionAccess,
  createAuth,
  HttpAuthError,
} from "./auth";
import type { ActionCtx } from "./_generated/server";
import { model } from "./agent";
import {
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

const app: HonoWithConvex<ActionCtx> = new Hono();

app.use(
  "/api/v0/*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type", "x-api-key"],
    allowMethods: ["POST", "OPTIONS"],
  }),
);

app.notFound((c) => {
  return c.text("Not found", 404);
});

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
        inputSchema: jsonSchema(definition.inputSchema),
      }),
    ]),
  );
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
  return !toolCalls.difference(toolResults).size;
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

app.post("/api/v0/sessions/:sessionId/events", async (c) => {
  const sessionId = sessionIdSchema.parse(c.req.param("sessionId"));
  try {
    await authorizeSessionAccess(c.env, sessionId, c.req.raw.headers);
  } catch (error) {
    if (error instanceof HttpAuthError) {
      return c.text(error.message, error.status);
    }
    throw error;
  }

  const json = await c.req.json();
  const request = createEventsRequestSchema.parse(json);

  for (const body of request.events) {
    const event = eventSchema.parse({
      sessionId,
      ...body,
    });
    await createAuthorizedEvent(c.env, event);
  }

  const events = await listAuthorizedEvents(c.env, sessionId);

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

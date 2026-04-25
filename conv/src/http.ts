import { authComponent, createAuth } from "./auth";
import type { ActionCtx } from "./_generated/server";
import { model } from "./agent";
import { streamText, type ModelMessage } from "ai";
import {
  eventBodySchema,
  eventSchema,
  sessionIdSchema,
  type EventType,
} from "./schema";
import { api } from "./_generated/api";
import { createEvent } from "./events";
import {
  Hono,
  HttpRouterWithHono,
  type HonoWithConvex,
} from "convex-helpers/server/hono";
import { cors } from "hono/cors";

const app: HonoWithConvex<ActionCtx> = new Hono();

app.use(
  "/api/v0/*",
  cors({
    origin: "*",
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["POST", "OPTIONS"],
  }),
);

app.notFound((c) => {
  return c.text("Not found", 404);
});

function eventsToMessages(events: EventType[]): ModelMessage[] {
  const messages = events
    .map((event) => {
      if (event.type === "user.message") {
        return [event.data];
      } else if (event.type === "assistant.response") {
        return event.data;
      } else {
        throw new Error(`Unknown event type: ${event}`);
      }
    })
    .flat();
  console.log(messages);
  return messages;
}

app.post("/api/v0/sessions/:sessionId/events", async (c) => {
  const sessionId = sessionIdSchema.parse(c.req.param("sessionId"));
  const body = eventBodySchema.parse(await c.req.json());
  const event = eventSchema.parse({
    sessionId,
    ...body,
  });

  await createEvent(c.env, event);

  const events = await c.env.runQuery(api.events.list, {
    sessionId,
  });

  const result = streamText({
    model,
    messages: eventsToMessages(events),
    onChunk: (chunk) => {
      console.log(chunk.chunk);
    },
    onFinish: async (finish) => {
      const content = finish.steps.map((step) => step.content).flat();
      console.log(content);
      await createEvent(c.env, {
        sessionId,
        type: "assistant.response",
        data: finish.response.messages,
      });
    },
  });

  return result.toTextStreamResponse();
});

const http = new HttpRouterWithHono(app);
authComponent.registerRoutes(http, createAuth);

export default http;

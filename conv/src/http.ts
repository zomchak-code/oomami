import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { httpAction } from "./_generated/server";
import { corsRouter } from "convex-helpers/server/cors";
import { model } from "./agent";
import { streamText, type ModelMessage } from "ai";
import { z } from "zod";
import { sessionIdSchema, type EventType } from "./schema";
import { api } from "./_generated/api";
import { createEvent } from "./events";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const cors = corsRouter(http, {
  allowedHeaders: ["Authorization", "Content-Type"],
});

const eventSchema = z.object({
  sessionId: sessionIdSchema,
  type: z.string(),
  data: z.any(),
});

cors.route({
  path: "/api/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = eventSchema.parse(await request.json());
    const authorization = request.headers.get("Authorization");

    await ctx.runMutation(api.events.create, event);

    const sessionEventsUrl = new URL(
      `${sessionEventsPathPrefix}${event.sessionId}`,
      request.url,
    );
    const stream = await fetch(sessionEventsUrl, {
      method: "POST",
      headers: {
        ...(authorization ? { Authorization: authorization } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    return stream;
  }),
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
  return messages;
}

const sessionEventsPathPrefix = "/api/sessions/";
cors.route({
  pathPrefix: sessionEventsPathPrefix,
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = sessionIdSchema.parse(
      url.pathname.slice(sessionEventsPathPrefix.length),
    );
    const events = await ctx.runQuery(api.events.list, {
      sessionId,
    });

    const result = streamText({
      model,
      messages: eventsToMessages(events),
      onChunk: (chunk) => {
        console.log(chunk.chunk);
      },
      onFinish: async (finish) => {
        finish.response.messages;
        const content = finish.steps.map((step) => step.content).flat();
        console.log(content);
        await createEvent(ctx, {
          sessionId,
          type: "assistant.response",
          data: finish.response.messages,
        });
      },
    });

    return result.toTextStreamResponse();
  }),
});

export default http;

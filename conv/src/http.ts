import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { httpAction } from "./_generated/server";
import { corsRouter } from "convex-helpers/server/cors";
import { model } from "./agent";
import { streamText } from "ai";
import { z } from "zod";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const cors = corsRouter(http);

const messageSchema = z.object({
  message: z.string(),
});
cors.route({
  path: "/api/message",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = messageSchema.parse(await request.json());
    const result = streamText({
      model,
      prompt: body.message,
    });

    return result.toTextStreamResponse();
  }),
});

export default http;

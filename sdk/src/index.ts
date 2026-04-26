import type { ServerToolDefinition } from "conv/schema";
import { OomamiApiError } from "./errors";
import { serializeToolDefinitions } from "./tools";
import type {
  AuthTokenProvider,
  CreateEvent,
  CreateEventOptions,
  CreateEvents,
  OomamiFullStream,
  OomamiOptions,
  OomamiStreamPart,
  Tools,
} from "./types";

import {
  EventSourceParserStream,
  type EventSourceMessage,
} from "eventsource-parser/stream";
import type { StreamPart } from "./types";
export { OomamiApiError } from "./errors";
export type {
  AuthTokenProvider,
  CreateEvent,
  CreateEventOptions,
  CreateEvents,
  OomamiFullStream,
  OomamiOptions,
  OomamiStreamPart,
  ToolErrorPayload,
} from "./types";

export class Oomami {
  readonly sessions: {
    events: {
      create(
        sessionId: string,
        events: CreateEvents,
        options?: CreateEventOptions,
      ): Promise<OomamiFullStream>;
    };
  };

  readonly #baseUrl: string | URL;
  readonly #authToken: AuthTokenProvider;

  constructor(options: OomamiOptions) {
    this.#baseUrl = options.baseUrl;
    this.#authToken = options.authToken;
    this.sessions = {
      events: {
        create: (sessionId, events, options) =>
          this.#createSessionEvents(sessionId, events, options),
      },
    };
  }

  async #createSessionEvents(
    sessionId: string,
    events: CreateEvents,
    options: CreateEventOptions = {},
  ): Promise<OomamiFullStream> {
    const toolDefinitions = serializeToolDefinitions(options.tools);
    let stream = await this.#postSessionEvents(
      sessionId,
      normalizeEvents(events),
      toolDefinitions,
    );

    const readableStream = new ReadableStream<OomamiStreamPart>({
      start: async (controller) => {
        await this.readStream(sessionId, stream, controller, options.tools);
      },
    });
    return attachAsyncIterable(readableStream);
  }

  async readStream(
    sessionId: string,
    stream: ReadableStream<OomamiStreamPart>,
    controller: ReadableStreamDefaultController<OomamiStreamPart>,
    tools?: Tools,
  ) {
    tools = tools ?? {};
    const reader = stream.getReader();
    while (true) {
      const { done, value: part } = await reader.read();
      if (done) break;
      controller.enqueue(part);
      if (part.type === "tool-call") {
        const tool = tools[part.toolName];
        if (tool && tool.execute) {
          const value = await tool.execute(part.input, {
            toolCallId: part.toolCallId,
            messages: [],
          });
          const stream = await this.#postSessionEvents(sessionId, [
            {
              type: "agent.tool-result",
              data: {
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                output: { type: "json", value },
              },
            },
          ]);
          await this.readStream(sessionId, stream, controller);
        }
      }
    }
    reader.releaseLock();
  }

  async #postSessionEvents(
    sessionId: string,
    events: CreateEvent[],
    tools?: Record<string, ServerToolDefinition>,
  ) {
    const token = await this.#authToken();
    const response = await fetch(
      this.#url(`/api/v0/sessions/${encodeURIComponent(sessionId)}/events`),
      {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          events,
          tools,
        }),
      },
    );

    if (!response.ok) {
      throw new OomamiApiError(response, await response.text());
    }

    if (!response.body) {
      throw new Error("Oomami API response did not include a stream body.");
    }

    return createSseStream(response.body);
  }

  #url(path: string) {
    return new URL(path, this.#baseUrl);
  }
}

function attachAsyncIterable<T>(
  stream: ReadableStream<T>,
): ReadableStream<T> & AsyncIterable<T> {
  const asyncIterable: AsyncIterable<T> = {
    async *[Symbol.asyncIterator]() {
      const reader = stream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) return;
          yield value as T;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
  return Object.assign(stream, asyncIterable);
}

function createSseStream(
  stream: ReadableStream<Uint8Array>,
): ReadableStream<OomamiStreamPart> {
  return (stream as ReadableStream<BufferSource>)
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream({ onError: "terminate" }))
    .pipeThrough(
      new TransformStream<EventSourceMessage, OomamiStreamPart>({
        transform(event, controller) {
          if (!event.data || event.data === "[DONE]") return;
          controller.enqueue(JSON.parse(event.data) as StreamPart);
        },
      }),
    );
}

function normalizeEvents(events: CreateEvents): CreateEvent[] {
  return Array.isArray(events) ? events : [events];
}

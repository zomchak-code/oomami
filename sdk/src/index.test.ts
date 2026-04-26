import { afterEach, describe, expect, test } from "bun:test";
import { z } from "zod";
import { Oomami } from "./index";
import type { CreateEvent } from "./types";

const originalFetch = globalThis.fetch;

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

type EventRequest = {
  events: CreateEvent[];
  tools?: Record<string, unknown>;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Oomami", () => {
  test("sends API key authenticated JSON requests", async () => {
    const calls: FetchCall[] = [];
    mockFetch((input, init) => {
      calls.push({ url: String(input), init });
      return Response.json({
        _id: "agent_123",
        _creationTime: 1,
        organizationId: "org_123",
        name: "Support",
        systemPrompt: "Helpful",
      });
    });

    const oomami = new Oomami({
      baseUrl: "https://app.example",
      apiKey: "key_123",
    });

    const agent = await oomami.agents.create({
      organizationId: "org_123",
      name: "Support",
      systemPrompt: "Helpful",
    });

    const call = only(calls);
    expect(agent._id).toBe("agent_123");
    expect(call.url).toBe("https://app.example/api/v0/organizations/org_123/agents");
    expect(call.init?.method).toBe("POST");
    expect(headerRecord(call.init)["x-api-key"]).toBe("key_123");
    expect(headerRecord(call.init)["Content-Type"]).toBe("application/json");
    expect(jsonBody<Record<string, string>>(call.init)).toEqual({
      name: "Support",
      systemPrompt: "Helpful",
    });
  });

  test("executes streamed tool calls and posts tool results", async () => {
    const requests: EventRequest[] = [];
    mockFetch((_input, init) => {
      requests.push(jsonBody<EventRequest>(init));
      return requests.length === 1
        ? sseResponse([
            {
              type: "tool-call",
              toolCallId: "call_123",
              toolName: "getWeather",
              input: { city: "Tokyo" },
            },
          ])
        : sseResponse([{ type: "text-delta", id: "text_123", delta: "Done" }]);
    });

    const oomami = new Oomami({
      baseUrl: "https://app.example",
      apiKey: "key_123",
    });

    const stream = await oomami.sessions.events.send(
      "session_123",
      {
        type: "user.message",
        data: { role: "user", content: "Weather in Tokyo?" },
      },
      {
        tools: {
          getWeather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async (input: unknown) => {
              const { city } = input as { city: string };
              return `sunny in ${city}`;
            },
          },
        },
      },
    );

    const parts = await collectStreamParts(stream);

    expect(parts.map((part) => part.type)).toEqual([
      "tool-call",
      "tool-result",
      "text-delta",
    ]);
    expect(requests[0]?.tools?.["getWeather"]).toBeDefined();
    expect(requests[1]?.events).toEqual([
      {
        type: "agent.tool-result",
        data: {
          toolCallId: "call_123",
          toolName: "getWeather",
          output: { type: "json", value: "sunny in Tokyo" },
        },
      },
    ]);
  });

  test("sanitizes streamed tool errors before posting them", async () => {
    const requests: EventRequest[] = [];
    mockFetch((_input, init) => {
      requests.push(jsonBody<EventRequest>(init));
      return requests.length === 1
        ? sseResponse([
            {
              type: "tool-call",
              toolCallId: "call_123",
              toolName: "failTool",
              input: {},
            },
          ])
        : sseResponse([]);
    });

    const oomami = new Oomami({
      baseUrl: "https://app.example",
      apiKey: "key_123",
    });

    const stream = await oomami.sessions.events.send(
      "session_123",
      {
        type: "user.message",
        data: { role: "user", content: "Run the tool" },
      },
      {
        tools: {
          failTool: {
            inputSchema: z.object({}),
            execute: async () => {
              throw new Error("secret internal error");
            },
          },
        },
        toModelError: () => "safe error",
      },
    );

    const parts = await collectStreamParts(stream);

    expect(parts[1]).toMatchObject({
      type: "tool-result",
      isError: true,
      output: { message: "safe error" },
    });
    expect(requests[1]?.events).toEqual([
      {
        type: "agent.tool-result",
        data: {
          toolCallId: "call_123",
          toolName: "failTool",
          output: { type: "error-json", value: { message: "safe error" } },
        },
      },
    ]);
  });
});

function mockFetch(
  handler: (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
  ) => Response | Promise<Response>,
) {
  globalThis.fetch = handler as typeof fetch;
}

function only<T>(values: T[]): T {
  expect(values).toHaveLength(1);
  const value = values[0];
  if (value === undefined) {
    throw new Error("Expected exactly one value.");
  }
  return value;
}

function headerRecord(init: RequestInit | undefined) {
  return init?.headers as Record<string, string>;
}

function jsonBody<T = unknown>(init: RequestInit | undefined): T {
  return JSON.parse(String(init?.body)) as T;
}

function sseResponse(parts: unknown[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const part of parts) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(part)}\n\n`),
          );
        }
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    },
  );
}

async function collectStreamParts(stream: AsyncIterable<{ type: string }>) {
  const parts: Array<{ type: string; [key: string]: unknown }> = [];
  for await (const part of stream) {
    parts.push(part);
  }
  return parts;
}

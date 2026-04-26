import type { ServerToolDefinition } from "conv/schema";
import { OomamiApiError } from "./errors";
import { executeToolCall, serializeToolDefinitions } from "./tools";
import type {
  AuthTokenProvider,
  CreateAgentRequest,
  CreateEvent,
  CreateEventOptions,
  CreateEvents,
  CreateSessionRequest,
  ListAgentsRequest,
  ListSessionsRequest,
  OomamiAgent,
  OomamiEvent,
  OomamiFullStream,
  OomamiOptions,
  OomamiSessionWithAgent,
  OomamiStreamPart,
  ToolCallPart,
  Tools,
  UpdateAgentRequest,
  UpdateSessionRequest,
} from "./types";

import {
  EventSourceParserStream,
  type EventSourceMessage,
} from "eventsource-parser/stream";
import type { StreamPart } from "./types";
export { OomamiApiError } from "./errors";
export type {
  AuthTokenProvider,
  ArchivedFilter,
  CreateAgentRequest,
  CreateEvent,
  CreateEventOptions,
  CreateEvents,
  CreateSessionRequest,
  ListAgentsRequest,
  ListSessionsRequest,
  OomamiAgent,
  OomamiEvent,
  OomamiFullStream,
  OomamiOptions,
  OomamiSession,
  OomamiSessionWithAgent,
  OomamiStreamPart,
  ToolErrorPayload,
  Tools,
  UpdateAgentRequest,
  UpdateSessionRequest,
} from "./types";

type Credential =
  | { type: "authToken"; authToken: AuthTokenProvider }
  | { type: "apiKey"; apiKey: string };

export class Oomami {
  readonly agents: {
    create(request: CreateAgentRequest): Promise<OomamiAgent>;
    list(request: ListAgentsRequest): Promise<OomamiAgent[]>;
    get(agentId: string): Promise<OomamiAgent>;
    update(
      agentId: string,
      request: UpdateAgentRequest,
    ): Promise<OomamiAgent>;
    archive(agentId: string): Promise<OomamiAgent>;
    restore(agentId: string): Promise<OomamiAgent>;
  };

  readonly sessions: {
    create(request: CreateSessionRequest): Promise<OomamiSessionWithAgent>;
    list(request: ListSessionsRequest): Promise<OomamiSessionWithAgent[]>;
    get(sessionId: string): Promise<OomamiSessionWithAgent>;
    update(
      sessionId: string,
      request: UpdateSessionRequest,
    ): Promise<OomamiSessionWithAgent>;
    archive(sessionId: string): Promise<OomamiSessionWithAgent>;
    restore(sessionId: string): Promise<OomamiSessionWithAgent>;
    events: {
      list(sessionId: string): Promise<OomamiEvent[]>;
      send(
        sessionId: string,
        events: CreateEvents,
        options?: CreateEventOptions,
      ): Promise<OomamiFullStream>;
    };
  };

  readonly #baseUrl: string | URL;
  readonly #credential: Credential;

  constructor(options: OomamiOptions) {
    const hasAuthToken = typeof options.authToken === "function";
    const hasApiKey = typeof options.apiKey === "string";

    if (hasAuthToken && hasApiKey) {
      throw new Error("Provide either authToken or apiKey, not both.");
    }
    if (!hasAuthToken && !hasApiKey) {
      throw new Error("Provide either authToken or apiKey.");
    }

    this.#baseUrl = options.baseUrl;
    this.#credential = hasApiKey
      ? { type: "apiKey", apiKey: options.apiKey }
      : { type: "authToken", authToken: options.authToken };
    this.agents = {
      create: (request) => this.#createAgent(request),
      list: (request) => this.#listAgents(request),
      get: (agentId) => this.#getAgent(agentId),
      update: (agentId, request) => this.#updateAgent(agentId, request),
      archive: (agentId) => this.#archiveAgent(agentId),
      restore: (agentId) => this.#restoreAgent(agentId),
    };
    this.sessions = {
      create: (request) => this.#createSession(request),
      list: (request) => this.#listSessions(request),
      get: (sessionId) => this.#getSession(sessionId),
      update: (sessionId, request) => this.#updateSession(sessionId, request),
      archive: (sessionId) => this.#archiveSession(sessionId),
      restore: (sessionId) => this.#restoreSession(sessionId),
      events: {
        list: (sessionId) => this.#listSessionEvents(sessionId),
        send: (sessionId, events, options) =>
          this.#sendSessionEvents(sessionId, events, options),
      },
    };
  }

  async #createAgent(request: CreateAgentRequest) {
    const { organizationId, ...body } = request;
    return this.#json<OomamiAgent>(
      `/api/v0/organizations/${encodeURIComponent(organizationId)}/agents`,
      {
        method: "POST",
        body,
      },
    );
  }

  async #listAgents(request: ListAgentsRequest) {
    const url = this.#url(
      `/api/v0/organizations/${encodeURIComponent(request.organizationId)}/agents`,
    );
    setArchivedQuery(url, request.archived);
    return this.#json<OomamiAgent[]>(url);
  }

  async #getAgent(agentId: string) {
    return this.#json<OomamiAgent>(
      `/api/v0/agents/${encodeURIComponent(agentId)}`,
    );
  }

  async #updateAgent(agentId: string, request: UpdateAgentRequest) {
    return this.#json<OomamiAgent>(
      `/api/v0/agents/${encodeURIComponent(agentId)}`,
      {
        method: "PATCH",
        body: request,
      },
    );
  }

  async #archiveAgent(agentId: string) {
    return this.#json<OomamiAgent>(
      `/api/v0/agents/${encodeURIComponent(agentId)}/archive`,
      {
        method: "POST",
      },
    );
  }

  async #restoreAgent(agentId: string) {
    return this.#json<OomamiAgent>(
      `/api/v0/agents/${encodeURIComponent(agentId)}/restore`,
      {
        method: "POST",
      },
    );
  }

  async #createSession(request: CreateSessionRequest) {
    const { organizationId, ...body } = request;
    return this.#json<OomamiSessionWithAgent>(
      `/api/v0/organizations/${encodeURIComponent(organizationId)}/sessions`,
      {
        method: "POST",
        body,
      },
    );
  }

  async #listSessions(request: ListSessionsRequest) {
    const url = this.#url(
      `/api/v0/organizations/${encodeURIComponent(request.organizationId)}/sessions`,
    );
    setArchivedQuery(url, request.archived);
    return this.#json<OomamiSessionWithAgent[]>(url);
  }

  async #getSession(sessionId: string) {
    return this.#json<OomamiSessionWithAgent>(
      `/api/v0/sessions/${encodeURIComponent(sessionId)}`,
    );
  }

  async #updateSession(sessionId: string, request: UpdateSessionRequest) {
    return this.#json<OomamiSessionWithAgent>(
      `/api/v0/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "PATCH",
        body: request,
      },
    );
  }

  async #archiveSession(sessionId: string) {
    return this.#json<OomamiSessionWithAgent>(
      `/api/v0/sessions/${encodeURIComponent(sessionId)}/archive`,
      {
        method: "POST",
      },
    );
  }

  async #restoreSession(sessionId: string) {
    return this.#json<OomamiSessionWithAgent>(
      `/api/v0/sessions/${encodeURIComponent(sessionId)}/restore`,
      {
        method: "POST",
      },
    );
  }

  async #listSessionEvents(sessionId: string) {
    return this.#json<OomamiEvent[]>(
      `/api/v0/sessions/${encodeURIComponent(sessionId)}/events`,
    );
  }

  async #sendSessionEvents(
    sessionId: string,
    events: CreateEvents,
    options: CreateEventOptions = {},
  ): Promise<OomamiFullStream> {
    const toolDefinitions = serializeToolDefinitions(options.tools);
    const stream = await this.#postSessionEvents(
      sessionId,
      normalizeEvents(events),
      toolDefinitions,
    );

    const readableStream = new ReadableStream<OomamiStreamPart>({
      start: async (controller) => {
        try {
          await this.readStream(
            sessionId,
            stream,
            controller,
            options.tools,
            options.toModelError,
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return attachAsyncIterable(readableStream);
  }

  async readStream(
    sessionId: string,
    stream: ReadableStream<OomamiStreamPart>,
    controller: ReadableStreamDefaultController<OomamiStreamPart>,
    tools?: Tools,
    toModelError?: CreateEventOptions["toModelError"],
  ) {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value: part } = await reader.read();
        if (done) break;
        controller.enqueue(part);
        if (part.type === "tool-call") {
          const result = await executeToolCall(
            part as ToolCallPart,
            tools,
            toModelError,
          );
          controller.enqueue(result.streamPart);
          const stream = await this.#postSessionEvents(sessionId, [
            result.event,
          ]);
          await this.readStream(
            sessionId,
            stream,
            controller,
            tools,
            toModelError,
          );
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async #postSessionEvents(
    sessionId: string,
    events: CreateEvent[],
    tools?: Record<string, ServerToolDefinition>,
  ) {
    const authHeaders = await this.#authHeaders();
    const response = await fetch(
      this.#url(`/api/v0/sessions/${encodeURIComponent(sessionId)}/events`),
      {
        method: "POST",
        headers: {
          ...authHeaders,
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

  async #json<T>(
    path: string | URL,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const authHeaders = await this.#authHeaders();
    const headers: Record<string, string> = {
      ...authHeaders,
      Accept: "application/json",
    };
    const body =
      init.body === undefined ? undefined : JSON.stringify(init.body);

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
      typeof path === "string" ? this.#url(path) : path,
      {
        method: init.method ?? "GET",
        headers,
        body,
      },
    );

    if (!response.ok) {
      throw new OomamiApiError(response, await response.text());
    }

    return (await response.json()) as T;
  }

  async #authHeaders(): Promise<Record<string, string>> {
    if (this.#credential.type === "authToken") {
      const token = await this.#credential.authToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    }

    const apiKey = this.#credential.apiKey.trim();
    return apiKey ? { "x-api-key": apiKey } : {};
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

function setArchivedQuery(url: URL, archived: boolean | undefined) {
  if (archived !== undefined) {
    url.searchParams.set("archived", String(archived));
  }
}

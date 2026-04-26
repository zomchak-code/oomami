import type { TextStreamPart, Tool, ToolSet } from "ai";
import type { userModelMessageSchema } from "ai";
import type { z } from "zod";

export type JsonToolResultOutput = {
  type: "json";
  value: unknown;
};
export type ErrorJsonToolResultOutput = {
  type: "error-json";
  value: unknown;
};
export type ToolResultOutput = JsonToolResultOutput | ErrorJsonToolResultOutput;

export type UserMessageEvent = {
  type: "user.message";
  data: z.infer<typeof userModelMessageSchema>;
};
export type AgentToolResultEvent = {
  type: "agent.tool-result";
  data: {
    toolCallId: string;
    toolName: string;
    output: ToolResultOutput;
  };
};
export type CreateEvent = UserMessageEvent | AgentToolResultEvent;
export type CreateEvents = CreateEvent | CreateEvent[];
export type AuthTokenProvider = () => string | null | Promise<string | null>;
export type ToolErrorPayload = { message: string };
export type OomamiStreamPart = TextStreamPart<ToolSet>;
export type OomamiFullStream = ReadableStream<OomamiStreamPart> &
  AsyncIterable<OomamiStreamPart>;
export type ServerToolDefinition = {
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type Tools = Record<
  string,
  Omit<Tool, "inputSchema"> & { inputSchema: z.Schema }
>;

export type CreateEventOptions = {
  tools?: Tools;
  // maxSteps?: number;
  toModelError?: (error: unknown) => ToolErrorPayload | string | unknown;
};

export type ToModelError =
  | undefined
  | ((error: unknown) => ToolErrorPayload | string | unknown);

type BaseOomamiOptions = {
  baseUrl?: string | URL;
};

export type OomamiOptions = BaseOomamiOptions &
  (
    | {
        authToken: AuthTokenProvider;
        apiKey?: never;
      }
    | {
        apiKey: string;
        authToken?: never;
      }
  );

export type OomamiAgent = {
  _id: string;
  _creationTime: number;
  organizationId: string;
  name: string;
  systemPrompt: string;
  archivedAt?: number;
};

export type OomamiSession = {
  _id: string;
  _creationTime: number;
  agentId: string;
  name: string;
  archivedAt?: number;
};

export type OomamiSessionWithAgent = OomamiSession & {
  agent: OomamiAgent;
};

export type OomamiEvent = {
  _id: string;
  _creationTime: number;
  sessionId: string;
} & (
  | UserMessageEvent
  | {
      type: "agent.text";
      data: {
        text: string;
      };
    }
  | {
      type: "agent.reasoning";
      data: {
        text: string;
        providerMetadata?: Record<string, unknown>;
      };
    }
  | {
      type: "agent.tool-call";
      data: {
        toolCallId: string;
        toolName: string;
        input: unknown;
      };
    }
  | AgentToolResultEvent
);

export type ArchivedFilter = {
  archived?: boolean;
};

export type CreateAgentRequest = {
  organizationId: string;
  name?: string;
  systemPrompt?: string;
};

export type ListAgentsRequest = ArchivedFilter & {
  organizationId: string;
};

export type UpdateAgentRequest = {
  name?: string;
  systemPrompt?: string;
};

export type CreateSessionRequest = {
  organizationId: string;
  agentId: string;
  name?: string;
};

export type ListSessionsRequest = ArchivedFilter & {
  organizationId: string;
};

export type UpdateSessionRequest = {
  name: string;
};

export type StreamPart = OomamiStreamPart & {
  type: string;
  [key: string]: unknown;
};

export type ToolCallPart = StreamPart & {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
};

export type ToolResultEvent = Extract<
  CreateEvent,
  { type: "agent.tool-result" }
>;

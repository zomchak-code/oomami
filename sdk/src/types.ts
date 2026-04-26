import type { EventBody, PersistedEvent } from "conv/schema";
import type { TextStreamPart, Tool, ToolSet } from "ai";
import type { z } from "zod";

export type CreateEvent = Extract<
  EventBody,
  { type: "user.message" } | { type: "agent.tool-result" }
>;
export type CreateEvents = CreateEvent | CreateEvent[];
export type AuthTokenProvider = () => string | null | Promise<string | null>;
export type ToolErrorPayload = { message: string };
export type OomamiStreamPart = TextStreamPart<ToolSet>;
export type OomamiFullStream = ReadableStream<OomamiStreamPart> &
  AsyncIterable<OomamiStreamPart>;

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
  baseUrl: string | URL;
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

export type OomamiEvent = PersistedEvent;

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

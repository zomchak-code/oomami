import type { EventBody } from "conv/schema";
import type { TextStreamPart, Tool, ToolSet } from "ai";

export type CreateEvent = EventBody;
export type CreateEvents = CreateEvent | CreateEvent[];
export type AuthTokenProvider = () => string | null | Promise<string | null>;
export type ToolErrorPayload = { message: string };
export type OomamiStreamPart = TextStreamPart<ToolSet>;
export type OomamiFullStream = ReadableStream<OomamiStreamPart> &
  AsyncIterable<OomamiStreamPart>;
import type { z } from "zod";

export type Tools = Record<
  string,
  Omit<Tool, "inputSchema"> & { inputSchema: z.Schema }
>;

export type CreateEventOptions = {
  tools?: Tools;
  // maxSteps?: number;
  // toModelError?: (error: unknown) => ToolErrorPayload | string | unknown;
};

export type ToModelError =
  | undefined
  | ((error: unknown) => ToolErrorPayload | string | unknown);

export type OomamiOptions = {
  baseUrl: string | URL;
  authToken: AuthTokenProvider;
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

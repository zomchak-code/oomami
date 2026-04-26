import { zodSchema } from "ai";
import type {
  StreamPart,
  ToModelError,
  ToolCallPart,
  ToolErrorPayload,
  ToolResultEvent,
  Tools,
} from "./types";

export async function executeToolCall(
  toolCall: ToolCallPart,
  tools: Tools | undefined,
  toModelError: ToModelError,
): Promise<{ event: ToolResultEvent; streamPart: StreamPart }> {
  const localTool = tools?.[toolCall.toolName] as
    | { execute?: (input: unknown, options: unknown) => unknown }
    | undefined;
  const eventBase = {
    type: "agent.tool-result",
    data: {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
    },
  } as const;

  if (typeof localTool?.execute !== "function") {
    const error = { message: `Unknown tool: ${toolCall.toolName}` };
    return {
      event: {
        ...eventBase,
        data: {
          ...eventBase.data,
          output: { type: "error-json", value: error },
        },
      },
      streamPart: toolResultStreamPart(toolCall, error, true),
    };
  }

  try {
    const output = await localTool.execute(toolCall.input, {
      toolCallId: toolCall.toolCallId,
      messages: [],
    });

    return {
      event: {
        ...eventBase,
        data: {
          ...eventBase.data,
          output: { type: "json", value: output },
        },
      },
      streamPart: toolResultStreamPart(toolCall, output, false),
    };
  } catch (error) {
    const sanitizedError = sanitizeToolError(error, toModelError);
    return {
      event: {
        ...eventBase,
        data: {
          ...eventBase.data,
          output: { type: "error-json", value: sanitizedError },
        },
      },
      streamPart: toolResultStreamPart(toolCall, sanitizedError, true),
    };
  }
}

export function serializeToolDefinitions(tools: Tools | undefined) {
  if (!tools) return undefined;

  return Object.fromEntries(
    Object.entries(tools).map(([name, definition]) => {
      return [
        name,
        {
          description: definition.description,
          inputSchema: zodSchema(definition.inputSchema),
        },
      ];
    }),
  );
}

function toolResultStreamPart(
  toolCall: ToolCallPart,
  output: unknown,
  isError: boolean,
): StreamPart {
  return {
    type: "tool-result",
    toolCallId: toolCall.toolCallId,
    toolName: toolCall.toolName,
    input: toolCall.input,
    output,
    isError: isError || undefined,
  } as StreamPart;
}

function sanitizeToolError(
  error: unknown,
  toModelError: ToModelError,
): ToolErrorPayload {
  const fallback = { message: "Tool execution failed." };
  const modelError = toModelError?.(error) ?? fallback;

  if (typeof modelError === "string") {
    return { message: modelError };
  }

  if (modelError && typeof modelError === "object" && "message" in modelError) {
    return { message: String(modelError.message) };
  }

  return fallback;
}

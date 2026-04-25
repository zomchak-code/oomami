import type { EventBody } from "conv/schema";

export type CreateEvent = EventBody;
export type AuthTokenProvider = () => string | null | Promise<string | null>;

export type OomamiOptions = {
  baseUrl: string | URL;
  authToken: AuthTokenProvider;
};

export class OomamiApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;

  constructor(response: Response, body: string) {
    super(
      `Oomami API request failed: ${response.status} ${response.statusText}`,
    );
    this.name = "OomamiApiError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.body = body;
  }
}

export class Oomami {
  readonly sessions: {
    events: {
      create(sessionId: string, event: CreateEvent): Promise<Response>;
    };
  };

  readonly #baseUrl: string | URL;
  readonly #authToken: AuthTokenProvider;

  constructor(options: OomamiOptions) {
    this.#baseUrl = options.baseUrl;
    this.#authToken = options.authToken;
    this.sessions = {
      events: {
        create: (sessionId, event) =>
          this.#createSessionEvent(sessionId, event),
      },
    };
  }

  async #createSessionEvent(
    sessionId: string,
    event: CreateEvent,
  ): Promise<Response> {
    const token = await this.#authToken();
    const response = await fetch(
      this.#url(`/api/v0/sessions/${encodeURIComponent(sessionId)}/events`),
      {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      },
    );

    if (!response.ok) {
      throw new OomamiApiError(response, await response.text());
    }

    return response;
  }

  #url(path: string) {
    return new URL(path, this.#baseUrl);
  }
}

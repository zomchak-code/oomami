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

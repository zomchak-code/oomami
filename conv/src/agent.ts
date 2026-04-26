import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic/edge";

const VERTEX_PROJECT = "elephantcompany-app";

const EU_VERTEX_ANTHROPIC_BASE_URL = `https://aiplatform.eu.rep.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/eu/publishers/anthropic/models`;

const googleCredentials = {
  clientEmail: process.env["GCP_VERTEX_AI_EMAIL"] ?? "",
  privateKey: atob(process.env["GCP_VERTEX_AI_BASE64_PRIVATE_KEY"] ?? ""),
};

const createEuVertexAnthropic = createVertexAnthropic({
  project: VERTEX_PROJECT,
  location: "europe-west1",
  googleCredentials,
});

const createEuRepVertexAnthropic = createVertexAnthropic({
  project: VERTEX_PROJECT,
  baseURL: EU_VERTEX_ANTHROPIC_BASE_URL,
  googleCredentials,
});

export const EU_LARGE = createEuRepVertexAnthropic("claude-opus-4-7");

export const EU_SMALL = createEuVertexAnthropic("claude-sonnet-4-6");

export const model = EU_LARGE;

# Oomami SDK

## API Key Auth

```ts
import { Oomami } from "@oomami/sdk";

const oomami = new Oomami({
  baseUrl: "https://your-oomami-app.example",
  apiKey: process.env.OOMAMI_API_KEY!,
});
```

## Agents and sessions

```ts
const organizationId = process.env.OOMAMI_ORGANIZATION_ID!;

const agent = await oomami.agents.create({
  organizationId,
  name: "Support agent",
  systemPrompt: "You are a helpful support assistant.",
});

const session = await oomami.sessions.create({
  organizationId,
  agentId: agent._id,
  name: "Example session",
});

const stream = await oomami.sessions.events.send(session._id, {
  type: "user.message",
  data: {
    role: "user",
    content: "Hello!",
  },
});

for await (const part of stream) {
  console.log(part);
}
```

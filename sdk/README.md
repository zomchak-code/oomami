# Oomami SDK

## Install

```sh
npm install @oomami/sdk
```

## API Key Auth

Before using the SDK, sign up in the Oomami UI. From there, copy your
organization ID and API key into `OOMAMI_ORGANIZATION_ID` and
`OOMAMI_API_KEY`.

```ts
import { Oomami } from "@oomami/sdk";

const oomami = new Oomami({
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

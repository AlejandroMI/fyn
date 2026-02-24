import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

const args = process.argv.slice(2);

let endpoint = process.env.MCP_HTTP_URL || "";
const queryParts: string[] = [];

for (let i = 0; i < args.length; i += 1) {
  const token = args[i];
  if (token === "--url") {
    endpoint = args[i + 1] || endpoint;
    i += 1;
    continue;
  }

  if (token !== undefined) {
    queryParts.push(token);
  }
}

const query = queryParts.join(" ").replace(/^--\s*/, "").trim()
  || "Find me a flat in Valencia with at least three rooms. Max 350k";
const resolvedEndpoint = endpoint || "http://localhost:3000/api/mcp";

const transport = new StreamableHTTPClientTransport(new URL(resolvedEndpoint));
const client = new Client({ name: "fyn-http-smoke-client", version: "0.1.0" });

// SDK typing and exactOptionalPropertyTypes conflict on optional sessionId.
await client.connect(transport as unknown as Transport);

const tools = await client.listTools();
if (!tools.tools.some((tool) => tool.name === "search_properties")) {
  throw new Error("search_properties tool not found on HTTP MCP endpoint");
}

const result = await client.callTool({
  name: "search_properties",
  arguments: { query_text: query, locale: "en" }
});

console.log(JSON.stringify(result, null, 2));
await client.close();

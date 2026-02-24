import process from "node:process";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const queryArg = process.argv.slice(2).join(" ").replace(/^--\s*/, "").trim();
const query = queryArg || "Find me a flat in Valencia with at least three rooms. Max 350k";

const serverScriptPath = fileURLToPath(new URL("./index.ts", import.meta.url));

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", serverScriptPath],
  stderr: "inherit"
});

const client = new Client({ name: "fyn-smoke-client", version: "0.1.0" });

await client.connect(transport);

const tools = await client.listTools();
if (!tools.tools.some((tool) => tool.name === "search_properties")) {
  throw new Error("search_properties tool not found");
}

const result = await client.callTool({
  name: "search_properties",
  arguments: { query_text: query, locale: "en" }
});

console.log(JSON.stringify(result, null, 2));
await client.close();

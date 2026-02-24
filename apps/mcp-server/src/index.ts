import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createFynMcpServer } from "./server.js";

const server = createFynMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);

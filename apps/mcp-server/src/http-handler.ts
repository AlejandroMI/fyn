import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createFynMcpServer } from "./server.js";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,mcp-session-id,mcp-protocol-version,last-event-id"
} as const;

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function jsonResponse(payload: unknown, init: ResponseInit): Response {
  return withCors(
    new Response(JSON.stringify(payload, null, 2), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {})
      }
    })
  );
}

export async function handleMcpHttpRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  const server = createFynMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response);
  } catch (error) {
    return jsonResponse(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: `MCP handler error: ${String(error)}`
        },
        id: null
      },
      { status: 500 }
    );
  }
}

export function healthResponse(): Response {
  return jsonResponse(
    {
      status: "ok",
      service: "fyn-mcp-server",
      version: "0.1.0",
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}

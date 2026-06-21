import type { NextApiRequest, NextApiResponse } from "next";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createFynMcpServer } from "../apps/mcp-server/src/server";
import {
  approximateBodyBytes,
  checkRateLimit,
  clientIpFromHeaders,
  MAX_MCP_REQUEST_BYTES
} from "../apps/mcp-server/src/request-security";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,mcp-session-id,mcp-protocol-version,last-event-id",
  "access-control-expose-headers": "mcp-session-id,ratelimit-limit,ratelimit-remaining,x-ratelimit-limit,x-ratelimit-remaining,retry-after"
} as const;

function setCorsHeaders(response: NextApiResponse): void {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    response.setHeader(name, value);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const forwardedIp = clientIpFromHeaders(req.headers);
  const clientIp = forwardedIp === "unknown" ? req.socket?.remoteAddress ?? "unknown" : forwardedIp;
  const rateLimit = checkRateLimit(`mcp:${clientIp}`);
  res.setHeader("RateLimit-Limit", String(rateLimit.limit));
  res.setHeader("RateLimit-Remaining", String(rateLimit.remaining));
  res.setHeader("X-RateLimit-Limit", String(rateLimit.limit));
  res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).json({
      jsonrpc: "2.0",
      error: {
        code: -32029,
        message: "Too many requests. Retry after the number of seconds in the Retry-After header.",
        data: { retryable: true, resolution: "Wait for Retry-After, then retry with bounded exponential backoff." }
      },
      id: null
    });
    return;
  }

  const declaredLength = Number(req.headers["content-length"] ?? 0);
  if (declaredLength > MAX_MCP_REQUEST_BYTES || approximateBodyBytes(req.body) > MAX_MCP_REQUEST_BYTES) {
    res.status(413).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Request body is too large.",
        data: { retryable: false, resolution: `Reduce the serialized request body below ${MAX_MCP_REQUEST_BYTES} bytes.` }
      },
      id: null
    });
    return;
  }

  const server = createFynMcpServer();
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (_error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "The MCP request could not be completed.",
          data: { retryable: true, resolution: "Retry once with backoff; check /health if the error persists." }
        },
        id: null
      });
    }
  } finally {
    await transport.close();
    await server.close();
  }
}

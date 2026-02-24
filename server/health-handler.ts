import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.status(200).json({
    status: "ok",
    service: "fyn-mcp-server",
    version: "0.1.0",
    timestamp: new Date().toISOString()
  });
}

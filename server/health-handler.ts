import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.status(200).json({
    status: "ok",
    service: "fyn-mcp-server",
    version: "0.1.0",
    timestamp: new Date().toISOString()
  });
}

import type { NextApiRequest, NextApiResponse } from "next";

import { getSiteOrigin } from "@/lib/site-config";

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or HEAD for API discovery." } });
    return;
  }

  const origin = getSiteOrigin();
  res.setHeader("Content-Type", 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"');
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  const body = {
    linkset: [
      {
        anchor: origin,
        "service-desc": [
          { href: `${origin}/openapi.json`, type: "application/vnd.oai.openapi+json" },
          { href: `${origin}/.well-known/mcp/server-card.json`, type: "application/json" }
        ],
        "service-doc": [{ href: `${origin}/llms-full.txt`, type: "text/plain" }],
        "api-catalog": [{ href: `${origin}/.well-known/api-catalog`, type: "application/linkset+json" }]
      }
    ]
  };
  res.status(200).send(req.method === "HEAD" ? "" : JSON.stringify(body));
}

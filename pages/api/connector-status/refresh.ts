import type { NextApiRequest, NextApiResponse } from "next";

import { generateConnectorStatusSnapshot, uploadConnectorStatusSnapshot } from "@/lib/connector-status";

function isAuthorized(request: NextApiRequest): boolean {
  const bearerToken = request.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  const queryToken = typeof request.query.token === "string" ? request.query.token.trim() : "";
  const acceptedTokens = [process.env.CONNECTOR_STATUS_REFRESH_TOKEN, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value && value.trim().length > 0)
  );

  if (acceptedTokens.length === 0) {
    return false;
  }

  return acceptedTokens.some((token) => token === bearerToken || token === queryToken);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const snapshot = await generateConnectorStatusSnapshot();
    const snapshotUrl = await uploadConnectorStatusSnapshot(snapshot);

    res.status(200).json({
      ok: true,
      snapshotUrl,
      generatedAt: snapshot.generatedAt,
      itemCount: snapshot.items.length
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

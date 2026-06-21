import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "node:crypto";

import { generateConnectorStatusSnapshot, uploadConnectorStatusSnapshot } from "@/lib/connector-status";

function isAuthorized(request: NextApiRequest): boolean {
  const bearerToken = request.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  const acceptedTokens = [process.env.CONNECTOR_STATUS_REFRESH_TOKEN, process.env.CRON_SECRET].filter(
    (value): value is string => Boolean(value && value.trim().length > 0)
  );

  if (acceptedTokens.length === 0) {
    return false;
  }

  if (!bearerToken) return false;

  return acceptedTokens.some((token) => {
    const expected = Buffer.from(token);
    const received = Buffer.from(bearerToken);
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
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
  } catch (_error) {
    res.status(500).json({
      ok: false,
      error: "Connector status refresh failed."
    });
  }
}

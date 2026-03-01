import type { NextApiRequest, NextApiResponse } from "next";

import { fetchConnectorStatusSnapshot } from "@/lib/connector-status";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const snapshot = await fetchConnectorStatusSnapshot();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).json(snapshot);
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

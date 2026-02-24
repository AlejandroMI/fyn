import type { NextApiRequest, NextApiResponse } from "next";

import mcpHandler from "../../server/mcp-handler";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return (mcpHandler as unknown as (request: NextApiRequest, response: NextApiResponse) => Promise<void>)(req, res);
}

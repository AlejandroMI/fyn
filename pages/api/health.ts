import type { NextApiRequest, NextApiResponse } from "next";

import healthHandler from "../../server/health-handler";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return (healthHandler as unknown as (request: NextApiRequest, response: NextApiResponse) => void)(req, res);
}

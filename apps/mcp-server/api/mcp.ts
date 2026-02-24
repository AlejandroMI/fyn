import { handleMcpHttpRequest } from "../src/http-handler.js";

export const config = {
  runtime: "edge"
};

export default async function handler(request: Request): Promise<Response> {
  return handleMcpHttpRequest(request);
}

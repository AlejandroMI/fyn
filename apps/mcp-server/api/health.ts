import { healthResponse } from "../src/http-handler.js";

export const config = {
  runtime: "edge"
};

export default function handler(): Response {
  return healthResponse();
}

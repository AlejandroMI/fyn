import { describe, expect, it } from "vitest";

import {
  approximateBodyBytes,
  checkRateLimit,
  clientIpFromHeaders,
  MAX_MCP_REQUEST_BYTES
} from "../src/request-security";

describe("request security", () => {
  it("uses the first forwarded client address", () => {
    expect(clientIpFromHeaders({ "x-forwarded-for": "203.0.113.8, 10.0.0.2" })).toBe("203.0.113.8");
  });

  it("rejects calls after the configured fixed-window limit", () => {
    const key = `test-${Math.random()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(false);
  });

  it("measures serialized request bodies and rejects circular values", () => {
    expect(approximateBodyBytes({ query: "hello" })).toBeGreaterThan(0);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(approximateBodyBytes(circular)).toBe(MAX_MCP_REQUEST_BYTES + 1);
  });
});

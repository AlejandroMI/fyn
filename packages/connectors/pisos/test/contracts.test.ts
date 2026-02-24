import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { NormalizedFilters } from "@fyn/domain";
import { PisosConnector } from "../src/index.js";

const fixturePath = join(process.cwd(), "test/fixtures/live-schema-sample.json");
const fixturePayload = JSON.parse(readFileSync(fixturePath, "utf8"));

const criteria: NormalizedFilters = {
  locale: "es" as const,
  transaction_type: "buy" as const,
  property_types: ["flat"],
  city: "Valencia",
  nearby_towns: false,
  min_rooms: 2,
  max_price_eur: 450000,
  renovation_ok: false,
  tags: [] as string[],
  original_query: "piso en valencia"
};

describe("Pisos connector contract", () => {
  it("normalizes a representative payload shape", async () => {
    const connector = new PisosConnector({
      apiKey: "dummy",
      allowFixtureFallback: false,
      fetchImpl: async () =>
        new Response(JSON.stringify(fixturePayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    });

    const result = await connector.search(criteria);

    expect(result.listings.length).toBeGreaterThan(0);
    for (const listing of result.listings) {
      expect(listing.canonical_id).toMatch(/^pisos-/);
      expect(listing.url).toMatch(/^https?:\/\//);
      expect(typeof listing.title).toBe("string");
    }
  });
});

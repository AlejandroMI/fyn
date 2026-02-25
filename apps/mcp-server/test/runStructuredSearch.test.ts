import { describe, expect, it } from "vitest";

import { ConnectorError, type ConnectorSearchResult, type ListingCard, type NormalizedFilters } from "@fyn/domain";
import type { ConnectorAdapter } from "@fyn/connectors-core";

import { runStructuredSearch, type ConnectorRegistry, type SourceSelection, type ToolPayload } from "../src/server.js";

function makeListing(overrides: Partial<ListingCard> = {}): ListingCard {
  return {
    canonical_id: "habitaclia-1",
    portal: "habitaclia",
    portal_listing_id: "1",
    url: "https://example.com/listing/1",
    title: "Casa con vistas",
    city: "Ronda",
    price_eur: 250000,
    rooms: 4,
    property_type: "house",
    image_urls: ["https://example.com/1.jpg"],
    last_seen_at: "2026-02-25T00:00:00.000Z",
    score: 0,
    why_matched: [],
    ...overrides
  };
}

function okConnector(portal: SourceSelection, listings: ListingCard[]): ConnectorAdapter {
  return {
    portal,
    async search(_criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
      return {
        listings,
        diagnostics: {
          source: "scrape",
          connector_warnings: []
        }
      };
    }
  };
}

function errorConnector(portal: SourceSelection, error: Error): ConnectorAdapter {
  return {
    portal,
    async search(_criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
      throw error;
    }
  };
}

function makeRegistry(overrides: Partial<ConnectorRegistry>): ConnectorRegistry {
  const noData = (portal: SourceSelection) => okConnector(portal, []);

  return {
    pisos: noData("pisos"),
    fotocasa: noData("fotocasa"),
    tucasa: noData("tucasa"),
    idealista: noData("idealista"),
    habitaclia: noData("habitaclia"),
    yaencontre: noData("yaencontre"),
    milanuncios: noData("milanuncios"),
    globaliza: noData("globaliza"),
    hogaria: noData("hogaria"),
    spainhouses: noData("spainhouses"),
    pisocompartido: noData("pisocompartido"),
    enalquiler: noData("enalquiler"),
    nuroa: noData("nuroa"),
    ...overrides
  };
}

function payload(overrides: Partial<ToolPayload> = {}): ToolPayload {
  return {
    locale: "es",
    transaction_type: "buy",
    property_types: ["house"],
    city: "Ronda",
    strict_constraints: true,
    max_results_total: 10,
    ...overrides
  };
}

describe("runStructuredSearch", () => {
  it("continues when one selected connector throws generic fetch error", async () => {
    const connectors = makeRegistry({
      idealista: errorConnector("idealista", new TypeError("fetch failed")),
      habitaclia: okConnector("habitaclia", [makeListing()])
    });

    const result = await runStructuredSearch(
      payload({
        sources: ["idealista", "habitaclia"]
      }),
      connectors
    );

    expect(result.listings).toHaveLength(1);
    expect(result.diagnostics.returned_count).toBe(1);
    expect(result.diagnostics.request_warnings).toContain(
      "Explicit sources were provided (2). Coverage is restricted to selected portals; omit sources for default broad aggregation."
    );

    const idealistaCoverage = result.diagnostics.coverage.find((row) => row.portal === "idealista");
    expect(idealistaCoverage?.error_code).toBe("UPSTREAM_UNAVAILABLE");
    expect(idealistaCoverage?.error_message).toContain("Unhandled connector error on idealista: fetch failed");
  });

  it("raises stable UPSTREAM_UNAVAILABLE when all selected connectors fail generically", async () => {
    const connectors = makeRegistry({
      idealista: errorConnector("idealista", new TypeError("fetch failed")),
      fotocasa: errorConnector("fotocasa", new TypeError("network down"))
    });

    await expect(
      runStructuredSearch(
        payload({
          sources: ["idealista", "fotocasa"]
        }),
        connectors
      )
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      source_portal: "idealista"
    } satisfies Partial<ConnectorError>);
  });

  it("does not add explicit-source warning when model leaves sources unset", async () => {
    const connectors = makeRegistry({
      pisos: okConnector("pisos", [makeListing({ portal: "pisos", canonical_id: "pisos-1", portal_listing_id: "1" })])
    });

    const result = await runStructuredSearch(payload(), connectors);

    expect(result.listings.length).toBeGreaterThan(0);
    expect(result.diagnostics.request_warnings).toHaveLength(0);
  });
});

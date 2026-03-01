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
  it("runs selected sources concurrently for the same location", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const delayedConnector = (portal: SourceSelection, delayMs: number): ConnectorAdapter => ({
      portal,
      async search(_criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        inFlight -= 1;
        return {
          listings: [
            makeListing({
              portal,
              canonical_id: `${portal}-1`,
              portal_listing_id: "1",
              title: `Casa con vistas ${portal}`,
              price_eur: portal === "idealista" ? 250000 : 290000
            })
          ],
          diagnostics: {
            source: "scrape",
            connector_warnings: []
          }
        };
      }
    });

    const connectors = makeRegistry({
      idealista: delayedConnector("idealista", 80),
      habitaclia: delayedConnector("habitaclia", 80)
    });

    const result = await runStructuredSearch(
      payload({
        sources: ["idealista", "habitaclia"]
      }),
      connectors
    );

    expect(result.diagnostics.coverage).toHaveLength(2);
    expect(result.diagnostics.coverage.filter((entry) => entry.error_code === undefined)).toHaveLength(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });

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

  it("times out slow connectors and still returns fast-source results", async () => {
    const previousTimeout = process.env.CONNECTOR_SEARCH_TIMEOUT_MS;
    process.env.CONNECTOR_SEARCH_TIMEOUT_MS = "200";

    try {
      const connectors = makeRegistry({
        idealista: {
          portal: "idealista",
          async search(_criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
            await new Promise((resolve) => setTimeout(resolve, 1200));
            return {
              listings: [makeListing({ portal: "idealista", canonical_id: "idealista-1", portal_listing_id: "1" })],
              diagnostics: {
                source: "scrape",
                connector_warnings: []
              }
            };
          }
        },
        habitaclia: okConnector("habitaclia", [makeListing()])
      });

      const result = await runStructuredSearch(
        payload({
          sources: ["idealista", "habitaclia"]
        }),
        connectors
      );

      expect(result.listings).toHaveLength(1);
      const idealistaCoverage = result.diagnostics.coverage.find((row) => row.portal === "idealista");
      expect(idealistaCoverage?.error_code).toBe("UPSTREAM_UNAVAILABLE");
      expect(idealistaCoverage?.error_message).toContain("exceeded 1000ms timeout");
    } finally {
      if (previousTimeout === undefined) {
        delete process.env.CONNECTOR_SEARCH_TIMEOUT_MS;
      } else {
        process.env.CONNECTOR_SEARCH_TIMEOUT_MS = previousTimeout;
      }
    }
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

  it("auto-relaxes floor filters when candidates exist but no listing exposes floor metadata", async () => {
    const connectors = makeRegistry({
      pisos: okConnector("pisos", [makeListing({ portal: "pisos", canonical_id: "pisos-1", portal_listing_id: "1" })])
    });

    const result = await runStructuredSearch(
      payload({
        min_floor: 1,
        exclude_ground_floor: true,
        sources: ["pisos"]
      }),
      connectors
    );

    expect(result.listings).toHaveLength(1);
    expect(result.criteria.min_floor).toBeUndefined();
    expect(result.criteria.exclude_ground_floor).toBeUndefined();
    expect(
      result.diagnostics.connector_warnings.some((warning) =>
        warning.includes("Auto-relaxed floor filters for pisos in Ronda")
      )
    ).toBe(true);
  });

  it("keeps floor filters when listings do expose floor metadata", async () => {
    const connectors = makeRegistry({
      pisos: okConnector("pisos", [
        makeListing({
          portal: "pisos",
          canonical_id: "pisos-ground-floor",
          portal_listing_id: "gf1",
          raw: {
            chars: ["Bajo"]
          }
        })
      ])
    });

    const result = await runStructuredSearch(
      payload({
        min_floor: 1,
        exclude_ground_floor: true,
        sources: ["pisos"]
      }),
      connectors
    );

    expect(result.listings).toHaveLength(0);
    expect(result.criteria.min_floor).toBe(1);
    expect(result.criteria.exclude_ground_floor).toBe(true);
    expect(
      result.diagnostics.connector_warnings.some((warning) => warning.includes("Auto-relaxed floor filters"))
    ).toBe(false);
  });

  it("does not throw when one connector is blocked but another succeeds with zero candidates", async () => {
    const connectors = makeRegistry({
      idealista: errorConnector(
        "idealista",
        new ConnectorError("UPSTREAM_BLOCKED", "idealista blocked automated access", true, "idealista")
      ),
      pisos: okConnector("pisos", [])
    });

    const result = await runStructuredSearch(
      payload({
        sources: ["idealista", "pisos"]
      }),
      connectors
    );

    expect(result.listings).toHaveLength(0);
    expect(result.diagnostics.coverage).toHaveLength(2);
    expect(result.diagnostics.coverage.find((row) => row.portal === "idealista")?.error_code).toBe(
      "UPSTREAM_BLOCKED"
    );
  });

  it("normalizes neighborhood-formatted locations to city for connector calls", async () => {
    let seenCity = "";
    let callCount = 0;
    const connectors = makeRegistry({
      pisos: {
        portal: "pisos",
        async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
          callCount += 1;
          seenCity = criteria.city || "";
          return {
            listings: [],
            diagnostics: {
              source: "scrape",
              connector_warnings: []
            }
          };
        }
      }
    });

    const result = await runStructuredSearch(
      payload({
        city: "València",
        locations: ["València - Malilla"],
        sources: ["pisos"]
      }),
      connectors
    );

    expect(seenCity).toBe("València");
    expect(callCount).toBe(1);
    expect(result.diagnostics.request_warnings.some((warning) => warning.includes("Normalized location"))).toBe(
      true
    );
  });

  it("merges neighborhood variants that map to the same city into one connector search", async () => {
    let callCount = 0;
    const connectors = makeRegistry({
      pisos: {
        portal: "pisos",
        async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
          callCount += 1;
          return {
            listings: [
              makeListing({
                portal: "pisos",
                canonical_id: "pisos-neighborhood",
                portal_listing_id: "n1",
                city: "Malilla (Distrito Quatre Carreres. València Capital)",
                description: "Piso en Malilla con buena luz."
              })
            ],
            diagnostics: {
              source: "scrape",
              connector_warnings: []
            }
          };
        }
      }
    });

    const result = await runStructuredSearch(
      payload({
        city: "València",
        locations: ["València - Malilla", "València - Quatre Carreres", "València - Benimaclet"],
        sources: ["pisos"]
      }),
      connectors
    );

    expect(callCount).toBe(1);
    expect(result.listings.length).toBeGreaterThan(0);
  });

  it("uses explicit location_hints to prioritize neighborhood matches", async () => {
    const connectors = makeRegistry({
      pisos: okConnector("pisos", [
        makeListing({
          portal: "pisos",
          canonical_id: "pisos-malilla",
          portal_listing_id: "m1",
          city: "Malilla (Distrito Quatre Carreres. València Capital)",
          description: "Vivienda en Malilla con buena luz."
        }),
        makeListing({
          portal: "pisos",
          canonical_id: "pisos-other",
          portal_listing_id: "o1",
          city: "La Roqueta (Distrito Extramurs. València Capital)",
          description: "Vivienda en otro barrio."
        })
      ])
    });

    const result = await runStructuredSearch(
      payload({
        city: "València",
        locations: undefined,
        location_hints: ["Malilla", "Quatre Carreres", "Benimaclet"],
        query_text: "Pisos en València para comprar, mínimo 3 habitaciones."
      }),
      connectors
    );

    expect(result.criteria.location_hints).toEqual(["Malilla", "Quatre Carreres", "Benimaclet"]);
    expect(result.listings[0]?.canonical_id).toBe("pisos-malilla");
    expect(result.diagnostics.request_warnings.some((warning) => warning.includes("Inferred location hints"))).toBe(
      false
    );
  });

  it("caps implicit source fanout for wide multi-location searches", async () => {
    const previousMaxTasks = process.env.MCP_MAX_SEARCH_TASKS;
    process.env.MCP_MAX_SEARCH_TASKS = "4";

    try {
      const connectors = makeRegistry({
        pisos: okConnector("pisos", [makeListing({ portal: "pisos", canonical_id: "pisos-1", portal_listing_id: "1" })]),
        habitaclia: okConnector("habitaclia", [makeListing({ canonical_id: "habitaclia-2", portal_listing_id: "2" })])
      });

      const result = await runStructuredSearch(
        payload({
          locations: ["Ronda", "Cangas de Onís"],
          city: undefined
        }),
        connectors
      );

      expect(result.diagnostics.execution.sources.length).toBe(2);
      expect(result.diagnostics.request_warnings).toContain(
        "High fanout detected (2 search locations x 10 sources). Auto-capped to 2 sources to meet runtime budget."
      );
    } finally {
      if (previousMaxTasks === undefined) {
        delete process.env.MCP_MAX_SEARCH_TASKS;
      } else {
        process.env.MCP_MAX_SEARCH_TASKS = previousMaxTasks;
      }
    }
  });
});

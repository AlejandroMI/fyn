import { describe, expect, it } from "vitest";

import type { ListingCard, NormalizedFilters } from "@fyn/domain";
import { rankListings } from "../src/index.js";

const baseCriteria: NormalizedFilters = {
  locale: "en",
  transaction_type: "buy",
  property_types: ["flat"],
  city: "Valencia",
  nearby_towns: false,
  min_rooms: 3,
  max_price_eur: 350_000,
  strict_constraints: true,
  renovation_ok: false,
  tags: [],
  original_query: "flat in Valencia"
};

function listing(partial: Partial<ListingCard>): ListingCard {
  return {
    canonical_id: "id",
    portal: "pisos",
    portal_listing_id: "id",
    url: "https://www.pisos.com/example",
    title: "Example",
    city: "Valencia",
    price_eur: 300_000,
    rooms: 3,
    property_type: "flat",
    image_urls: [],
    last_seen_at: new Date().toISOString(),
    score: 0,
    why_matched: [],
    raw: {
      source_path: "/venta/pisos-valencia_capital_zona_urbana/"
    },
    ...partial
  };
}

describe("rankListings", () => {
  it("enforces hard constraints", () => {
    const ranked = rankListings(
      [
        listing({ canonical_id: "good" }),
        listing({ canonical_id: "bad-budget", price_eur: 500_000 }),
        listing({ canonical_id: "bad-city", city: "Madrid" })
      ],
      baseCriteria
    );

    expect(ranked.map((item) => item.canonical_id)).toEqual(["good"]);
  });

  it("ranks by relevance score", () => {
    const ranked = rankListings(
      [
        listing({ canonical_id: "near-limit", price_eur: 349_000 }),
        listing({ canonical_id: "better", price_eur: 280_000, rooms: 4 })
      ],
      baseCriteria
    );

    expect(ranked[0]?.canonical_id).toBe("better");
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it("does not treat province-level path hints as city exact matches", () => {
    const ranked = rankListings(
      [
        listing({ canonical_id: "in-city", city: "Ciutat Vella (València Capital)" }),
        listing({
          canonical_id: "out-city",
          city: "Massamagrell",
          raw: { source_path: "/venta/pisos-valencia_capital_zona_urbana/" }
        })
      ],
      baseCriteria
    );

    expect(ranked.map((item) => item.canonical_id)).toEqual(["in-city"]);
  });

  it("boosts natural-light candidates when that intent is present", () => {
    const lightCriteria: NormalizedFilters = {
      ...baseCriteria,
      tags: ["natural_light", "exterior", "good_orientation"]
    };

    const ranked = rankListings(
      [
        listing({
          canonical_id: "bright",
          description: "Piso muy luminoso, todo exterior con grandes ventanales y orientación sur.",
          raw: {
            source_path: "/venta/pisos-valencia_capital_zona_urbana/",
            chars: ["3 habs.", "7ª planta"]
          }
        }),
        listing({
          canonical_id: "darker",
          description: "Piso interior",
          raw: {
            source_path: "/venta/pisos-valencia_capital_zona_urbana/",
            chars: ["3 habs.", "1ª planta"]
          }
        })
      ],
      lightCriteria
    );

    expect(ranked[0]?.canonical_id).toBe("bright");
    expect(ranked[0]?.why_matched.some((reason) => reason.toLowerCase().includes("natural light"))).toBe(true);
  });

  it("enforces floor constraints when requested", () => {
    const floorCriteria: NormalizedFilters = {
      ...baseCriteria,
      min_floor: 3,
      exclude_ground_floor: true
    };

    const ranked = rankListings(
      [
        listing({
          canonical_id: "ground",
          raw: { source_path: "/venta/pisos-valencia_capital_zona_urbana/", chars: ["Bajo"] }
        }),
        listing({
          canonical_id: "first",
          raw: { source_path: "/venta/pisos-valencia_capital_zona_urbana/", chars: ["1ª planta"] }
        }),
        listing({
          canonical_id: "fourth",
          raw: { source_path: "/venta/pisos-valencia_capital_zona_urbana/", chars: ["4ª planta"] }
        })
      ],
      floorCriteria
    );

    expect(ranked.map((item) => item.canonical_id)).toEqual(["fourth"]);
  });
});

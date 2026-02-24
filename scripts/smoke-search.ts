import { PisosConnector } from "@fyn/connectors-pisos";
import type { SearchInput } from "@fyn/domain";
import { rankListings } from "@fyn/scoring";

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function readNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

async function main() {
  const rawArg = process.argv.slice(2).join(" ").replace(/^--\s*/, "").trim();
  let input: SearchInput;
  if (rawArg.startsWith("{")) {
    input = JSON.parse(rawArg) as SearchInput;
  } else {
    const query = rawArg || "Find me a flat in Valencia with three rooms max 350k";
    input = {
      locale: "en",
      transaction_type: "buy",
      property_types: ["flat"],
      city: "Valencia",
      min_rooms: 3,
      max_price_eur: 350000,
      strict_constraints: true,
      query_text: query
    };
  }

  const criteria = {
    locale: input.locale ?? "en",
    property_types: input.property_types ?? [],
    nearby_towns: input.nearby_towns ?? false,
    strict_constraints: input.strict_constraints ?? true,
    renovation_ok: input.renovation_ok ?? false,
    tags: input.tags ?? [],
    ...(input.transaction_type ? { transaction_type: input.transaction_type } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.min_rooms !== undefined ? { min_rooms: input.min_rooms } : {}),
    ...(input.min_capacity_people !== undefined ? { min_capacity_people: input.min_capacity_people } : {}),
    ...(input.max_price_eur !== undefined ? { max_price_eur: input.max_price_eur } : {}),
    ...(input.min_floor !== undefined ? { min_floor: input.min_floor } : {}),
    ...(input.exclude_ground_floor !== undefined
      ? { exclude_ground_floor: input.exclude_ground_floor }
      : {}),
    ...(input.prefer_exterior !== undefined ? { prefer_exterior: input.prefer_exterior } : {}),
    ...(input.query_text ? { original_query: input.query_text } : {})
  };

  const connector = new PisosConnector({
    apiKey: process.env.PISOS_API_KEY,
    allowFixtureFallback: true,
    serializedSearchOverride: process.env.PISOS_SERIALIZED_SEARCH,
    enableScrapeFallback: readBooleanEnv("PISOS_ENABLE_SCRAPE_FALLBACK", true),
    scrapeRequestDelayMs: readNumberEnv("PISOS_SCRAPE_REQUEST_DELAY_MS", 500),
    maxScrapeRequests: readNumberEnv("PISOS_MAX_SCRAPE_REQUESTS", 6)
  });

  const connectorResult = await connector.search(criteria);
  const ranked = rankListings(connectorResult.listings, criteria);

  console.log(
    JSON.stringify(
      {
        criteria,
        diagnostics: {
          source: connectorResult.diagnostics.source,
          request_warnings: [],
          connector_warnings: connectorResult.diagnostics.connector_warnings,
          total_candidates: connectorResult.listings.length,
          returned_count: ranked.length
        },
        listings: ranked
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

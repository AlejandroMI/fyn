import { normalizeSearchInput } from "@fyn/parser";
import { PisosConnector } from "@fyn/connectors-pisos";
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
  const queryArg = process.argv.slice(2).join(" ").replace(/^--\s*/, "").trim();
  const query = queryArg || "Find me a flat in Valencia with three rooms max 350k";
  const parsed = normalizeSearchInput({ query_text: query });

  const connector = new PisosConnector({
    apiKey: process.env.PISOS_API_KEY,
    allowFixtureFallback: true,
    serializedSearchOverride: process.env.PISOS_SERIALIZED_SEARCH,
    enableScrapeFallback: readBooleanEnv("PISOS_ENABLE_SCRAPE_FALLBACK", true),
    scrapeRequestDelayMs: readNumberEnv("PISOS_SCRAPE_REQUEST_DELAY_MS", 500),
    maxScrapeRequests: readNumberEnv("PISOS_MAX_SCRAPE_REQUESTS", 6)
  });

  const connectorResult = await connector.search(parsed.criteria);
  const ranked = rankListings(connectorResult.listings, parsed.criteria);

  console.log(
    JSON.stringify(
      {
        criteria: parsed.criteria,
        diagnostics: {
          source: connectorResult.diagnostics.source,
          parser_warnings: parsed.warnings,
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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  ConnectorError,
  type ConnectorErrorCode,
  type ConnectorSearchResult,
  type ListingCard,
  type Locale,
  type NormalizedFilters
} from "@fyn/domain";
import { PisosConnector } from "@fyn/connectors-pisos";
import { rankListings } from "@fyn/scoring";

const propertyTypeSchema = z.enum(["flat", "house", "office", "land"]);
const localeSchema = z.enum(["es", "en"]);
const transactionSchema = z.enum(["buy", "rent"]);
const sourceSchema = z.enum(["pisos"]);
const SEARCH_TOOL_DESCRIPTION =
  "Search Spanish properties via MCP. The model must plan explicit constraints and location strategy, then call this tool deterministically. `query_text` is context-only and never a substitute for `city`/`locations`. For broad intents, send 3-10 locations in `locations[]`, then iterate using `diagnostics.coverage`.";
const MISSING_LOCATION_WARNING =
  "No `city` or `locations[]` provided. Discovery search is disabled when `strict_constraints=true`.";
const MISSING_LOCATION_ACTION =
  "Model action required: choose candidate cities/towns and retry with `locations[]` (recommended 3-10).";

const toolSchema = {
  query_text: z
    .string()
    .optional()
    .describe("Optional context only. Do not use as the only input; always send structured constraints."),
  locale: localeSchema.optional().describe("Response locale for cards and formatting (`es` or `en`)."),
  transaction_type: transactionSchema
    .optional()
    .describe("Transaction mode (`buy` or `rent`)."),
  property_types: z
    .array(propertyTypeSchema)
    .optional()
    .describe("Property types (`flat`, `house`, `office`, `land`)."),
  city: z
    .string()
    .optional()
    .describe("Single location search target. Prefer `locations[]` for broad or exploratory intent."),
  locations: z
    .array(z.string().min(1))
    .optional()
    .describe("Primary geography control. Provide 3-10 cities/towns for broad searches."),
  nearby_towns: z.boolean().optional().describe("Allow nearby towns around each requested location."),
  min_rooms: z.number().int().nonnegative().optional().describe("Minimum bedrooms."),
  min_capacity_people: z.number().int().nonnegative().optional().describe("Minimum people capacity."),
  max_price_eur: z.number().int().nonnegative().optional().describe("Maximum budget in EUR."),
  min_floor: z.number().int().nonnegative().optional().describe("Minimum floor index (0 = ground)."),
  exclude_ground_floor: z.boolean().optional().describe("Exclude ground-floor properties."),
  prefer_exterior: z.boolean().optional().describe("Boost exterior properties when true."),
  strict_constraints: z
    .boolean()
    .optional()
    .describe("Default true. When true and no location is provided, the tool returns guidance instead of discovery fallback."),
  renovation_ok: z.boolean().optional().describe("Allow renovation-needed listings."),
  tags: z.array(z.string()).optional().describe("Preference tags (e.g. `nature`, `views`, `natural_light`)."),
  sources: z.array(sourceSchema).optional().describe("Source portals. Current deployment supports only `pisos`."),
  per_location_limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe("Max candidates kept per requested location before global rerank."),
  max_results_total: z
    .number()
    .int()
    .positive()
    .max(200)
    .optional()
    .describe("Max returned listings after global rerank.")
};

type ToolPayload = z.infer<z.ZodObject<typeof toolSchema>>;

type ConnectorSource = ConnectorSearchResult["diagnostics"]["source"];

interface CoverageEntry {
  location: string;
  source?: ConnectorSource;
  candidates: number;
  returned: number;
  warnings: string[];
  error_code?: ConnectorErrorCode;
  error_message?: string;
}

interface ExecutionDiagnostics {
  mode: "structured";
  locations_requested: string[];
  locations_searched: string[];
  sources: Array<z.infer<typeof sourceSchema>>;
  per_location_limit?: number;
  max_results_total: number;
  strict_constraints: boolean;
}

interface SearchExecutionResult {
  criteria: NormalizedFilters;
  listings: ListingCard[];
  diagnostics: {
    source: ConnectorSource;
    connector_warnings: string[];
    request_warnings: string[];
    total_candidates: number;
    returned_count: number;
    coverage: CoverageEntry[];
    execution: ExecutionDiagnostics;
    action_required?: {
      code: "MISSING_LOCATIONS";
      message: string;
      retry_hint: string;
    };
  };
}

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

function connectorFromEnv(): PisosConnector {
  return new PisosConnector({
    allowFixtureFallback: readBooleanEnv("PISOS_ALLOW_FIXTURE_FALLBACK", true),
    enableScrapeFallback: readBooleanEnv("PISOS_ENABLE_SCRAPE_FALLBACK", true),
    scrapeRequestDelayMs: readNumberEnv("PISOS_SCRAPE_REQUEST_DELAY_MS", 500),
    maxScrapeRequests: readNumberEnv("PISOS_MAX_SCRAPE_REQUESTS", 6),
    ...(process.env.PISOS_API_KEY ? { apiKey: process.env.PISOS_API_KEY } : {}),
    ...(process.env.PISOS_BASE_URL ? { baseUrl: process.env.PISOS_BASE_URL } : {}),
    ...(process.env.PISOS_SERIALIZED_SEARCH
      ? { serializedSearchOverride: process.env.PISOS_SERIALIZED_SEARCH }
      : {})
  });
}

function textContent(text: string) {
  return [{ type: "text" as const, text }];
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function uniqueStrings(values: string[]): string[] {
  return uniqueBy(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    (value) => value.toLowerCase()
  );
}

function readRawChars(listing: ListingCard): string[] {
  const chars = listing.raw?.chars;
  if (!Array.isArray(chars)) {
    return [];
  }

  return chars.filter((value): value is string => typeof value === "string");
}

function extractFloorLabel(listing: ListingCard): string | undefined {
  for (const item of readRawChars(listing)) {
    if (/planta/i.test(item)) {
      return item;
    }
  }

  return undefined;
}

function formatPrice(price: number | null, locale: Locale): string {
  if (price === null) {
    return locale === "es" ? "Precio no disponible" : "Price unavailable";
  }

  const formatter = new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });

  return formatter.format(price);
}

interface PresentationCard {
  canonical_id: string;
  title: string;
  city: string;
  url: string;
  image_url: string | null;
  price: string;
  facts: string[];
  score: number;
  why_matched: string[];
}

function toPresentationCard(listing: ListingCard, locale: Locale): PresentationCard {
  const floorLabel = extractFloorLabel(listing);
  const facts: string[] = [];

  if (listing.rooms !== null) {
    facts.push(locale === "es" ? `${listing.rooms} hab.` : `${listing.rooms} rooms`);
  }

  if (floorLabel) {
    facts.push(floorLabel);
  }

  if (listing.property_type) {
    facts.push(listing.property_type);
  }

  return {
    canonical_id: listing.canonical_id,
    title: listing.title,
    city: listing.city,
    url: listing.url,
    image_url: listing.image_urls[0] ?? null,
    price: formatPrice(listing.price_eur, locale),
    facts,
    score: listing.score,
    why_matched: listing.why_matched.slice(0, 3)
  };
}

function buildCardsMarkdown(cards: PresentationCard[], locale: Locale): string {
  if (cards.length === 0) {
    return locale === "es"
      ? "No se encontraron propiedades para generar tarjetas."
      : "No properties found to build cards.";
  }

  const header = locale === "es" ? "Vista rápida (tarjetas)" : "Quick property cards";
  const whyLabel = locale === "es" ? "Por qué encaja" : "Why matched";
  const lines: string[] = [`### ${header}`];

  for (const [index, card] of cards.entries()) {
    lines.push(`${index + 1}. **[${card.title}](${card.url})**`);
    lines.push(`${card.price} · ${card.city}${card.facts.length > 0 ? ` · ${card.facts.join(" · ")}` : ""} · score ${card.score}/100`);
    if (card.image_url) {
      lines.push(`![${card.title}](${card.image_url})`);
    }

    if (card.why_matched.length > 0) {
      lines.push(`${whyLabel}: ${card.why_matched.join("; ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

function asErrorResult(code: ConnectorErrorCode, message: string) {
  return {
    isError: true,
    content: textContent(JSON.stringify({ code, message }, null, 2))
  };
}

function resolveLocations(payload: ToolPayload): string[] {
  if (payload.locations && payload.locations.length > 0) {
    return uniqueStrings(payload.locations);
  }

  if (payload.city) {
    return uniqueStrings([payload.city]);
  }

  return [];
}

function baseCriteriaFromPayload(payload: ToolPayload): NormalizedFilters {
  return {
    locale: payload.locale ?? "en",
    property_types: payload.property_types ? [...payload.property_types] : [],
    nearby_towns: payload.nearby_towns ?? false,
    strict_constraints: payload.strict_constraints ?? true,
    renovation_ok: payload.renovation_ok ?? false,
    tags: payload.tags ? uniqueStrings(payload.tags) : [],
    ...(payload.transaction_type ? { transaction_type: payload.transaction_type } : {}),
    ...(payload.min_rooms !== undefined ? { min_rooms: payload.min_rooms } : {}),
    ...(payload.min_capacity_people !== undefined
      ? { min_capacity_people: payload.min_capacity_people }
      : {}),
    ...(payload.max_price_eur !== undefined ? { max_price_eur: payload.max_price_eur } : {}),
    ...(payload.min_floor !== undefined ? { min_floor: payload.min_floor } : {}),
    ...(payload.exclude_ground_floor !== undefined
      ? { exclude_ground_floor: payload.exclude_ground_floor }
      : {}),
    ...(payload.prefer_exterior !== undefined ? { prefer_exterior: payload.prefer_exterior } : {}),
    ...(payload.query_text ? { original_query: payload.query_text } : {})
  };
}

function criteriaForLocation(base: NormalizedFilters, city?: string): NormalizedFilters {
  return {
    ...base,
    ...(city ? { city } : {})
  };
}

function selectSource(sources: Set<ConnectorSource>): ConnectorSource {
  if (sources.has("scrape")) {
    return "scrape";
  }

  if (sources.has("live")) {
    return "live";
  }

  return "fixture";
}

async function runStructuredSearch(payload: ToolPayload, connector: PisosConnector): Promise<SearchExecutionResult> {
  const allowedSources = payload.sources ?? ["pisos"];
  const requestedLocations = resolveLocations(payload);
  const perLocationLimit = payload.per_location_limit ?? 20;
  const maxResultsTotal = payload.max_results_total ?? 40;
  const baseCriteria = baseCriteriaFromPayload(payload);
  const strictConstraints = baseCriteria.strict_constraints ?? true;

  if (!allowedSources.includes("pisos")) {
    return {
      criteria: criteriaForLocation(baseCriteria),
      listings: [],
      diagnostics: {
        source: "fixture",
        connector_warnings: ["No supported source selected. Current deployment supports only `pisos`."],
        request_warnings: [],
        total_candidates: 0,
        returned_count: 0,
        coverage: [],
        execution: {
          mode: "structured",
          locations_requested: requestedLocations,
          locations_searched: [],
          sources: allowedSources,
          ...(requestedLocations.length > 0 ? { per_location_limit: perLocationLimit } : {}),
          max_results_total: maxResultsTotal,
          strict_constraints: strictConstraints
        }
      }
    };
  }

  if (requestedLocations.length === 0 && strictConstraints) {
    return {
      criteria: criteriaForLocation(baseCriteria),
      listings: [],
      diagnostics: {
        source: "fixture",
        connector_warnings: [MISSING_LOCATION_WARNING, MISSING_LOCATION_ACTION],
        request_warnings: [
          "`query_text` is contextual only. In strict structured mode, geography must be explicit."
        ],
        total_candidates: 0,
        returned_count: 0,
        coverage: [],
        execution: {
          mode: "structured",
          locations_requested: [],
          locations_searched: [],
          sources: allowedSources,
          max_results_total: maxResultsTotal,
          strict_constraints: strictConstraints
        },
        action_required: {
          code: "MISSING_LOCATIONS",
          message: MISSING_LOCATION_WARNING,
          retry_hint: "Send `locations[]` (recommended 3-10) or a single `city` and call the tool again."
        }
      }
    };
  }

  const sourceKinds = new Set<ConnectorSource>();
  const connectorWarnings: string[] = [];
  const coverage: CoverageEntry[] = [];
  const collected: ListingCard[] = [];
  let firstConnectorError: ConnectorError | null = null;

  if (requestedLocations.length === 0) {
    const criteria = criteriaForLocation(baseCriteria);
    try {
      const result = await connector.search(criteria);
      sourceKinds.add(result.diagnostics.source);
      const discoveryWarnings = uniqueStrings([
        "No city/locations provided; running discovery search because `strict_constraints=false`.",
        ...result.diagnostics.connector_warnings
      ]);
      connectorWarnings.push(...discoveryWarnings);
      const ranked = rankListings(result.listings, criteria).slice(0, maxResultsTotal);
      collected.push(...ranked);
      coverage.push({
        location: "__discovery__",
        source: result.diagnostics.source,
        candidates: result.listings.length,
        returned: ranked.length,
        warnings: discoveryWarnings
      });
    } catch (error) {
      if (error instanceof ConnectorError) {
        firstConnectorError = error;
        coverage.push({
          location: "__discovery__",
          candidates: 0,
          returned: 0,
          warnings: [],
          error_code: error.code,
          error_message: error.message
        });
      } else {
        throw error;
      }
    }
  } else {
    for (const location of requestedLocations) {
      const criteria = criteriaForLocation(baseCriteria, location);
      try {
        const result = await connector.search(criteria);
        sourceKinds.add(result.diagnostics.source);
        connectorWarnings.push(...result.diagnostics.connector_warnings);
        const ranked = rankListings(result.listings, criteria).slice(0, perLocationLimit);
        collected.push(...ranked);
        coverage.push({
          location,
          source: result.diagnostics.source,
          candidates: result.listings.length,
          returned: ranked.length,
          warnings: result.diagnostics.connector_warnings
        });
      } catch (error) {
        if (error instanceof ConnectorError) {
          if (!firstConnectorError) {
            firstConnectorError = error;
          }
          coverage.push({
            location,
            candidates: 0,
            returned: 0,
            warnings: [],
            error_code: error.code,
            error_message: error.message
          });
          continue;
        }

        throw error;
      }
    }
  }

  if (collected.length === 0 && firstConnectorError) {
    throw firstConnectorError;
  }

  const uniqueCandidates = uniqueBy(
    collected,
    (listing) => `${listing.portal}:${listing.portal_listing_id}`
  );
  const rankingCriteria = requestedLocations.length === 1
    ? criteriaForLocation(baseCriteria, requestedLocations[0])
    : criteriaForLocation(baseCriteria);
  const ranked = rankListings(uniqueCandidates, rankingCriteria).slice(0, maxResultsTotal);
  const uniqueWarnings = uniqueStrings(connectorWarnings);

  if (requestedLocations.length > 1) {
    uniqueWarnings.unshift(`Executed multi-location search across ${requestedLocations.length} locations.`);
  }

  return {
    criteria: rankingCriteria,
    listings: ranked,
    diagnostics: {
      source: selectSource(sourceKinds),
      connector_warnings: uniqueWarnings,
      request_warnings: [],
      total_candidates: uniqueCandidates.length,
      returned_count: ranked.length,
      coverage,
      execution: {
        mode: "structured",
        locations_requested: requestedLocations,
        locations_searched: coverage
          .filter((entry) => entry.error_code === undefined)
          .map((entry) => entry.location),
        sources: allowedSources,
        ...(requestedLocations.length > 0 ? { per_location_limit: perLocationLimit } : {}),
        max_results_total: maxResultsTotal,
        strict_constraints: strictConstraints
      }
    }
  };
}

export function createFynMcpServer(connector = connectorFromEnv()): McpServer {
  const server = new McpServer({
    name: "fyn-mcp-server",
    version: "0.1.0"
  });

  server.registerTool(
    "search_properties",
    {
      title: "Search Properties (Model-Driven)",
      description: SEARCH_TOOL_DESCRIPTION,
      inputSchema: toolSchema
    },
    async (payload) => {
      try {
        const execution = await runStructuredSearch(payload, connector);
        const cards = execution.listings
          .slice(0, 8)
          .map((listing) => toPresentationCard(listing, execution.criteria.locale));
        const response = {
          criteria: execution.criteria,
          listings: execution.listings,
          presentation_cards: cards,
          diagnostics: execution.diagnostics
        };

        return {
          content: [
            { type: "text", text: buildCardsMarkdown(cards, execution.criteria.locale) },
            { type: "text", text: JSON.stringify(response, null, 2) }
          ],
          structuredContent: {
            criteria: response.criteria,
            diagnostics: response.diagnostics,
            presentation_cards: response.presentation_cards
          }
        };
      } catch (error) {
        if (error instanceof ConnectorError) {
          return asErrorResult(error.code, error.message);
        }

        return asErrorResult("UPSTREAM_SCHEMA_CHANGED", `Unhandled search error: ${String(error)}`);
      }
    }
  );

  return server;
}

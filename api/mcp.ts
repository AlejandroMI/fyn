import type { VercelRequest, VercelResponse } from "@vercel/node";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,mcp-session-id,mcp-protocol-version,last-event-id"
} as const;

const STRUCTURED_FIELDS = [
  "transaction_type",
  "property_types",
  "city",
  "locations",
  "nearby_towns",
  "min_rooms",
  "min_capacity_people",
  "max_price_eur",
  "min_floor",
  "exclude_ground_floor",
  "prefer_exterior",
  "strict_constraints",
  "renovation_ok",
  "tags",
  "sources",
  "per_location_limit",
  "max_results_total"
] as const;

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

function readRawChars(listing: Record<string, unknown>): string[] {
  const raw = listing.raw;
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const chars = (raw as Record<string, unknown>).chars;
  if (!Array.isArray(chars)) {
    return [];
  }

  return chars.filter((value): value is string => typeof value === "string");
}

function extractFloorLabel(listing: Record<string, unknown>): string | undefined {
  for (const item of readRawChars(listing)) {
    if (/planta/i.test(item)) {
      return item;
    }
  }

  return undefined;
}

function formatPrice(price: unknown, locale: "es" | "en"): string {
  if (typeof price !== "number" || !Number.isFinite(price)) {
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

function toPresentationCard(listing: Record<string, unknown>, locale: "es" | "en"): PresentationCard {
  const floorLabel = extractFloorLabel(listing);
  const facts: string[] = [];

  if (typeof listing.rooms === "number") {
    facts.push(locale === "es" ? `${listing.rooms} hab.` : `${listing.rooms} rooms`);
  }

  if (floorLabel) {
    facts.push(floorLabel);
  }

  if (typeof listing.property_type === "string" && listing.property_type.length > 0) {
    facts.push(listing.property_type);
  }

  const images = Array.isArray(listing.image_urls)
    ? listing.image_urls.filter((value): value is string => typeof value === "string")
    : [];
  const whyMatched = Array.isArray(listing.why_matched)
    ? listing.why_matched.filter((value): value is string => typeof value === "string")
    : [];

  return {
    canonical_id: typeof listing.canonical_id === "string" ? listing.canonical_id : "",
    title: typeof listing.title === "string" ? listing.title : "Listing",
    city: typeof listing.city === "string" ? listing.city : "Unknown",
    url: typeof listing.url === "string" ? listing.url : "",
    image_url: images[0] ?? null,
    price: formatPrice(listing.price_eur, locale),
    facts,
    score: typeof listing.score === "number" ? listing.score : 0,
    why_matched: whyMatched.slice(0, 3)
  };
}

function buildCardsMarkdown(cards: PresentationCard[], locale: "es" | "en"): string {
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

function hasStructuredInput(payload: Record<string, unknown>): boolean {
  return STRUCTURED_FIELDS.some((field) => payload[field] !== undefined);
}

function resolveLocations(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.locations) && payload.locations.length > 0) {
    return uniqueStrings(payload.locations.filter((value): value is string => typeof value === "string"));
  }

  if (typeof payload.city === "string" && payload.city.trim().length > 0) {
    return [payload.city.trim()];
  }

  return [];
}

function toBaseCriteria(payload: Record<string, unknown>) {
  return {
    locale: payload.locale === "es" ? "es" : "en",
    property_types: Array.isArray(payload.property_types)
      ? payload.property_types.filter((value): value is string => typeof value === "string")
      : [],
    nearby_towns: typeof payload.nearby_towns === "boolean" ? payload.nearby_towns : false,
    strict_constraints:
      typeof payload.strict_constraints === "boolean" ? payload.strict_constraints : true,
    renovation_ok: typeof payload.renovation_ok === "boolean" ? payload.renovation_ok : false,
    tags: Array.isArray(payload.tags)
      ? uniqueStrings(payload.tags.filter((value): value is string => typeof value === "string"))
      : [],
    ...(typeof payload.transaction_type === "string"
      ? { transaction_type: payload.transaction_type }
      : {}),
    ...(typeof payload.min_rooms === "number" ? { min_rooms: payload.min_rooms } : {}),
    ...(typeof payload.min_capacity_people === "number"
      ? { min_capacity_people: payload.min_capacity_people }
      : {}),
    ...(typeof payload.max_price_eur === "number" ? { max_price_eur: payload.max_price_eur } : {}),
    ...(typeof payload.min_floor === "number" ? { min_floor: payload.min_floor } : {}),
    ...(typeof payload.exclude_ground_floor === "boolean"
      ? { exclude_ground_floor: payload.exclude_ground_floor }
      : {}),
    ...(typeof payload.prefer_exterior === "boolean"
      ? { prefer_exterior: payload.prefer_exterior }
      : {}),
    ...(typeof payload.query_text === "string" ? { original_query: payload.query_text } : {})
  };
}

function selectSource(sources: Set<string>): "live" | "scrape" | "fixture" {
  if (sources.has("scrape")) {
    return "scrape";
  }

  if (sources.has("live")) {
    return "live";
  }

  return "fixture";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(name, value);
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const [
    { McpServer },
    { StreamableHTTPServerTransport },
    { z },
    domainModule,
    connectorModule,
    parserModule,
    scoringModule
  ] = await Promise.all([
    import("@modelcontextprotocol/sdk/server/mcp.js"),
    import("@modelcontextprotocol/sdk/server/streamableHttp.js"),
    import("zod"),
    import("../packages/domain/src/index.js"),
    import("../packages/connectors/pisos/src/index.js"),
    import("../packages/parser/src/index.js"),
    import("../packages/scoring/src/index.js")
  ]);

  const { ConnectorError } = domainModule;
  const { PisosConnector } = connectorModule;
  const { normalizeSearchInput } = parserModule;
  const { rankListings } = scoringModule;

  const propertyTypeSchema = z.enum(["flat", "house", "office", "land"]);
  const localeSchema = z.enum(["es", "en"]);
  const transactionSchema = z.enum(["buy", "rent"]);
  const sourceSchema = z.enum(["pisos"]);

  const toolSchema = {
    query_text: z.string().optional(),
    locale: localeSchema.optional(),
    transaction_type: transactionSchema.optional(),
    property_types: z.array(propertyTypeSchema).optional(),
    city: z.string().optional(),
    locations: z.array(z.string().min(1)).optional(),
    nearby_towns: z.boolean().optional(),
    min_rooms: z.number().int().nonnegative().optional(),
    min_capacity_people: z.number().int().nonnegative().optional(),
    max_price_eur: z.number().int().nonnegative().optional(),
    min_floor: z.number().int().nonnegative().optional(),
    exclude_ground_floor: z.boolean().optional(),
    prefer_exterior: z.boolean().optional(),
    strict_constraints: z.boolean().optional(),
    renovation_ok: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    sources: z.array(sourceSchema).optional(),
    per_location_limit: z.number().int().positive().max(50).optional(),
    max_results_total: z.number().int().positive().max(200).optional()
  };

  const connector = new PisosConnector({
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

  const server = new McpServer({
    name: "fyn-mcp-server",
    version: "0.1.0"
  });

  server.registerTool(
    "search_properties",
    {
      title: "Search Properties (Model-Driven)",
      description:
        "MCP aggregator search for Spanish properties. In structured mode, backend executes explicit constraints and does not infer subjective intent from `query_text`. Use `locations` for multi-city/town search and iterate from diagnostics coverage.",
      inputSchema: toolSchema
    },
    async (payload: Record<string, unknown>) => {
      const structuredMode = hasStructuredInput(payload);

      try {
        const maxResultsTotal =
          typeof payload.max_results_total === "number" ? payload.max_results_total : 40;
        const requestedLocations = resolveLocations(payload);
        const allowedSources = Array.isArray(payload.sources)
          ? payload.sources.filter((value): value is "pisos" => value === "pisos")
          : ["pisos"];

        let criteria: any;
        let listings: any[] = [];
        let diagnostics: Record<string, unknown>;

        if (structuredMode) {
          const perLocationLimit =
            typeof payload.per_location_limit === "number" ? payload.per_location_limit : 20;
          const baseCriteria = toBaseCriteria(payload);
          const sourceKinds = new Set<string>();
          const connectorWarnings: string[] = [];
          const coverage: Array<Record<string, unknown>> = [];
          const collected: any[] = [];
          let firstConnectorError: InstanceType<typeof ConnectorError> | null = null;

          if (!allowedSources.includes("pisos")) {
            criteria = baseCriteria;
            diagnostics = {
              source: "fixture",
              connector_warnings: ["No supported source selected. Current deployment supports only `pisos`."],
              parser_warnings: [],
              total_candidates: 0,
              returned_count: 0,
              coverage: [],
              execution: {
                mode: "structured",
                locations_requested: requestedLocations,
                locations_searched: [],
                sources: allowedSources,
                per_location_limit: requestedLocations.length > 0 ? perLocationLimit : undefined,
                max_results_total: maxResultsTotal,
                strict_constraints: baseCriteria.strict_constraints
              }
            };
            listings = [];
          } else if (requestedLocations.length === 0) {
            criteria = { ...baseCriteria };
            try {
              const result = await connector.search(criteria as any);
              sourceKinds.add(result.diagnostics.source);
              connectorWarnings.push(...result.diagnostics.connector_warnings);
              const ranked = rankListings(result.listings, criteria as any).slice(0, maxResultsTotal);
              collected.push(...ranked);
              coverage.push({
                location: "__discovery__",
                source: result.diagnostics.source,
                candidates: result.listings.length,
                returned: ranked.length,
                warnings: result.diagnostics.connector_warnings
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

            if (collected.length === 0 && firstConnectorError) {
              throw firstConnectorError;
            }

            const uniqueCandidates = uniqueBy(
              collected,
              (listing) => `${String(listing.portal)}:${String(listing.portal_listing_id)}`
            );
            listings = rankListings(uniqueCandidates as any, criteria as any).slice(0, maxResultsTotal) as any[];
            diagnostics = {
              source: selectSource(sourceKinds),
              connector_warnings: uniqueStrings(connectorWarnings),
              parser_warnings: [],
              total_candidates: uniqueCandidates.length,
              returned_count: listings.length,
              coverage,
              execution: {
                mode: "structured",
                locations_requested: requestedLocations,
                locations_searched: coverage
                  .filter((entry) => entry.error_code === undefined)
                  .map((entry) => entry.location),
                sources: allowedSources,
                max_results_total: maxResultsTotal,
                strict_constraints: baseCriteria.strict_constraints
              }
            };
          } else {
            for (const location of requestedLocations) {
              const localCriteria = { ...baseCriteria, city: location };
              try {
                const result = await connector.search(localCriteria as any);
                sourceKinds.add(result.diagnostics.source);
                connectorWarnings.push(...result.diagnostics.connector_warnings);
                const ranked = rankListings(result.listings, localCriteria as any).slice(0, perLocationLimit);
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

            if (collected.length === 0 && firstConnectorError) {
              throw firstConnectorError;
            }

            const uniqueCandidates = uniqueBy(
              collected,
              (listing) => `${String(listing.portal)}:${String(listing.portal_listing_id)}`
            );
            criteria = requestedLocations.length === 1
              ? { ...baseCriteria, city: requestedLocations[0] }
              : { ...baseCriteria };
            listings = rankListings(uniqueCandidates as any, criteria as any).slice(0, maxResultsTotal) as any[];
            const uniqueWarnings = uniqueStrings(connectorWarnings);
            uniqueWarnings.unshift(`Executed multi-location search across ${requestedLocations.length} locations.`);
            diagnostics = {
              source: selectSource(sourceKinds),
              connector_warnings: uniqueWarnings,
              parser_warnings: [],
              total_candidates: uniqueCandidates.length,
              returned_count: listings.length,
              coverage,
              execution: {
                mode: "structured",
                locations_requested: requestedLocations,
                locations_searched: coverage
                  .filter((entry) => entry.error_code === undefined)
                  .map((entry) => entry.location),
                sources: allowedSources,
                per_location_limit: perLocationLimit,
                max_results_total: maxResultsTotal,
                strict_constraints: baseCriteria.strict_constraints
              }
            };
          }
        } else {
          const input = {
            ...(typeof payload.query_text === "string" ? { query_text: payload.query_text } : {}),
            ...(payload.locale ? { locale: payload.locale } : {}),
            ...(payload.transaction_type ? { transaction_type: payload.transaction_type } : {}),
            ...(Array.isArray(payload.property_types) ? { property_types: payload.property_types } : {}),
            ...(typeof payload.city === "string" ? { city: payload.city } : {}),
            ...(Array.isArray(payload.locations) ? { locations: payload.locations } : {}),
            ...(typeof payload.nearby_towns === "boolean" ? { nearby_towns: payload.nearby_towns } : {}),
            ...(typeof payload.min_rooms === "number" ? { min_rooms: payload.min_rooms } : {}),
            ...(typeof payload.min_capacity_people === "number"
              ? { min_capacity_people: payload.min_capacity_people }
              : {}),
            ...(typeof payload.max_price_eur === "number" ? { max_price_eur: payload.max_price_eur } : {}),
            ...(typeof payload.min_floor === "number" ? { min_floor: payload.min_floor } : {}),
            ...(typeof payload.exclude_ground_floor === "boolean"
              ? { exclude_ground_floor: payload.exclude_ground_floor }
              : {}),
            ...(typeof payload.prefer_exterior === "boolean"
              ? { prefer_exterior: payload.prefer_exterior }
              : {}),
            ...(typeof payload.strict_constraints === "boolean"
              ? { strict_constraints: payload.strict_constraints }
              : {}),
            ...(typeof payload.renovation_ok === "boolean" ? { renovation_ok: payload.renovation_ok } : {}),
            ...(Array.isArray(payload.tags) ? { tags: payload.tags } : {})
          };

          const parsed = normalizeSearchInput(input as any);
          const connectorResult = await connector.search(parsed.criteria);
          criteria = parsed.criteria as any;
          listings = rankListings(connectorResult.listings, parsed.criteria).slice(0, maxResultsTotal) as any[];
          diagnostics = {
            source: connectorResult.diagnostics.source,
            connector_warnings: connectorResult.diagnostics.connector_warnings,
            parser_warnings: [
              ...parsed.warnings,
              "Legacy parser mode: provide structured constraints for agent-grade control."
            ],
            total_candidates: connectorResult.listings.length,
            returned_count: listings.length,
            coverage: [],
            execution: {
              mode: "legacy_parser",
              locations_requested: parsed.criteria.city ? [parsed.criteria.city] : [],
              locations_searched: parsed.criteria.city ? [parsed.criteria.city] : [],
              sources: allowedSources,
              max_results_total: maxResultsTotal,
              strict_constraints:
                typeof parsed.criteria.strict_constraints === "boolean"
                  ? parsed.criteria.strict_constraints
                  : true
            }
          };
        }

        const locale = criteria.locale === "es" ? "es" : "en";
        const cards = listings
          .slice(0, 8)
          .map((listing) => toPresentationCard(listing, locale));
        const response = {
          criteria,
          listings,
          presentation_cards: cards,
          diagnostics
        };

        return {
          content: [
            { type: "text", text: buildCardsMarkdown(cards, locale) },
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
          return {
            isError: true,
            content: textContent(JSON.stringify({ code: error.code, message: error.message }, null, 2))
          };
        }

        return {
          isError: true,
          content: textContent(
            JSON.stringify(
              { code: "UPSTREAM_SCHEMA_CHANGED", message: `Unhandled search error: ${String(error)}` },
              null,
              2
            )
          )
        };
      }
    }
  );

  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: `MCP handler error: ${String(error)}`
        },
        id: null
      });
    }
  } finally {
    await transport.close();
    await server.close();
  }
}

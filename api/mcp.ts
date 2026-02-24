import type { VercelRequest, VercelResponse } from "@vercel/node";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,mcp-session-id,mcp-protocol-version,last-event-id"
} as const;

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

  const toolSchema = {
    query_text: z.string().optional(),
    locale: localeSchema.optional(),
    transaction_type: transactionSchema.optional(),
    property_types: z.array(propertyTypeSchema).optional(),
    city: z.string().optional(),
    nearby_towns: z.boolean().optional(),
    min_rooms: z.number().int().nonnegative().optional(),
    min_capacity_people: z.number().int().nonnegative().optional(),
    max_price_eur: z.number().int().nonnegative().optional(),
    renovation_ok: z.boolean().optional(),
    tags: z.array(z.string()).optional()
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
      title: "Search Properties",
      description: "Search Spanish properties from natural language and structured constraints.",
      inputSchema: toolSchema
    },
    async (payload: Record<string, unknown>) => {
      const input = {
        ...(payload.query_text ? { query_text: payload.query_text } : {}),
        ...(payload.locale ? { locale: payload.locale } : {}),
        ...(payload.transaction_type ? { transaction_type: payload.transaction_type } : {}),
        ...(payload.property_types ? { property_types: payload.property_types } : {}),
        ...(payload.city ? { city: payload.city } : {}),
        ...(payload.nearby_towns !== undefined ? { nearby_towns: payload.nearby_towns } : {}),
        ...(payload.min_rooms !== undefined ? { min_rooms: payload.min_rooms } : {}),
        ...(payload.min_capacity_people !== undefined
          ? { min_capacity_people: payload.min_capacity_people }
          : {}),
        ...(payload.max_price_eur !== undefined ? { max_price_eur: payload.max_price_eur } : {}),
        ...(payload.renovation_ok !== undefined ? { renovation_ok: payload.renovation_ok } : {}),
        ...(payload.tags ? { tags: payload.tags } : {})
      };

      const parsed = normalizeSearchInput(input as any);

      try {
        const connectorResult = await connector.search(parsed.criteria);
        const ranked = rankListings(connectorResult.listings, parsed.criteria);
        const response = {
          criteria: parsed.criteria,
          listings: ranked,
          diagnostics: {
            ...connectorResult.diagnostics,
            parser_warnings: parsed.warnings,
            total_candidates: connectorResult.listings.length,
            returned_count: ranked.length
          }
        };

        return {
          content: textContent(JSON.stringify(response, null, 2))
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

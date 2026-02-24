import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  ConnectorError,
  type ConnectorErrorCode,
  type ListingCard,
  type Locale,
  type SearchInput
} from "@fyn/domain";
import { PisosConnector } from "@fyn/connectors-pisos";
import { normalizeSearchInput } from "@fyn/parser";
import { rankListings } from "@fyn/scoring";

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

type ToolPayload = z.infer<z.ZodObject<typeof toolSchema>>;

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

function toSearchInput(payload: ToolPayload): SearchInput {
  return {
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
}

function textContent(text: string) {
  return [{ type: "text" as const, text }];
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

export function createFynMcpServer(connector = connectorFromEnv()): McpServer {
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
    async (payload) => {
      const input = toSearchInput(payload);
      const parsed = normalizeSearchInput(input);

      try {
        const connectorResult = await connector.search(parsed.criteria);
        const ranked = rankListings(connectorResult.listings, parsed.criteria);
        const cards = ranked.slice(0, 8).map((listing) => toPresentationCard(listing, parsed.criteria.locale));
        const response = {
          criteria: parsed.criteria,
          listings: ranked,
          presentation_cards: cards,
          diagnostics: {
            ...connectorResult.diagnostics,
            parser_warnings: parsed.warnings,
            total_candidates: connectorResult.listings.length,
            returned_count: ranked.length
          }
        };

        return {
          content: [
            { type: "text", text: buildCardsMarkdown(cards, parsed.criteria.locale) },
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

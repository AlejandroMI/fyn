import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  buildSearchPropertiesToolMeta,
  buildSearchPropertiesWidgetResourceMeta,
  ConnectorError,
  SEARCH_PROPERTIES_CONTEXT_ONLY_WARNING,
  SEARCH_PROPERTIES_FIELD_DESCRIPTIONS,
  SEARCH_PROPERTIES_MISSING_LOCATION_ACTION,
  SEARCH_PROPERTIES_MISSING_LOCATION_RETRY_HINT,
  SEARCH_PROPERTIES_MISSING_LOCATION_WARNING,
  SEARCH_PROPERTIES_TOOL_DESCRIPTION,
  SEARCH_PROPERTIES_TOOL_TITLE,
  SEARCH_PROPERTIES_WIDGET_HTML,
  SEARCH_PROPERTIES_WIDGET_RESOURCE_MIME_TYPE,
  SEARCH_PROPERTIES_WIDGET_RESOURCE_URI,
  type ConnectorErrorCode,
  type ConnectorSearchResult,
  type ListingCard,
  type Locale,
  type NormalizedFilters
} from "@fyn/domain";
import { type ConnectorAdapter } from "@fyn/connectors-core";
import { EnalquilerConnector } from "@fyn/connectors-enalquiler";
import { FotocasaConnector } from "@fyn/connectors-fotocasa";
import { GlobalizaConnector } from "@fyn/connectors-globaliza";
import { HabitacliaConnector } from "@fyn/connectors-habitaclia";
import { HogariaConnector } from "@fyn/connectors-hogaria";
import { IdealistaConnector } from "@fyn/connectors-idealista";
import { MilanunciosConnector } from "@fyn/connectors-milanuncios";
import { PisoCompartidoConnector } from "@fyn/connectors-pisocompartido";
import { PisosConnector } from "@fyn/connectors-pisos";
import { TucasaConnector } from "@fyn/connectors-tucasa";
import { YaencontreConnector } from "@fyn/connectors-yaencontre";
import { rankListings } from "@fyn/scoring";

const propertyTypeSchema = z.enum(["flat", "house", "office", "land"]);
const localeSchema = z.enum(["es", "en"]);
const transactionSchema = z.enum(["buy", "rent"]);
const sourceSchema = z.enum([
  "pisos",
  "fotocasa",
  "tucasa",
  "idealista",
  "habitaclia",
  "yaencontre",
  "milanuncios",
  "globaliza",
  "hogaria",
  "pisocompartido",
  "enalquiler"
]);

const toolSchema = {
  query_text: z
    .string()
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.query_text),
  locale: localeSchema.optional().describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.locale),
  transaction_type: transactionSchema
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.transaction_type),
  property_types: z
    .array(propertyTypeSchema)
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.property_types),
  city: z
    .string()
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.city),
  locations: z
    .array(z.string().min(1))
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.locations),
  nearby_towns: z.boolean().optional().describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.nearby_towns),
  min_rooms: z.number().int().nonnegative().optional().describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.min_rooms),
  min_capacity_people: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.min_capacity_people),
  max_price_eur: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.max_price_eur),
  min_floor: z.number().int().nonnegative().optional().describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.min_floor),
  exclude_ground_floor: z
    .boolean()
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.exclude_ground_floor),
  prefer_exterior: z.boolean().optional().describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.prefer_exterior),
  strict_constraints: z
    .boolean()
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.strict_constraints),
  renovation_ok: z.boolean().optional().describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.renovation_ok),
  tags: z.array(z.string()).optional().describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.tags),
  sources: z.array(sourceSchema).optional().describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.sources),
  per_location_limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.per_location_limit),
  max_results_total: z
    .number()
    .int()
    .positive()
    .max(200)
    .optional()
    .describe(SEARCH_PROPERTIES_FIELD_DESCRIPTIONS.max_results_total)
};

type ToolPayload = z.infer<z.ZodObject<typeof toolSchema>>;

type ConnectorSource = ConnectorSearchResult["diagnostics"]["source"];

interface CoverageEntry {
  location: string;
  portal?: SourceSelection;
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

interface CollectedCandidate {
  listing: ListingCard;
  search_location: string;
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

type SourceSelection = z.infer<typeof sourceSchema>;
type ConnectorRegistry = Record<SourceSelection, ConnectorAdapter>;

function connectorsFromEnv(): ConnectorRegistry {
  const pisos = new PisosConnector({
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

  const tucasa = new TucasaConnector({
    requestDelayMs: readNumberEnv("TUCASA_SCRAPE_REQUEST_DELAY_MS", 250),
    maxRequests: readNumberEnv("TUCASA_MAX_SCRAPE_REQUESTS", 6),
    ...(process.env.TUCASA_BASE_URL ? { baseUrl: process.env.TUCASA_BASE_URL } : {})
  });

  const fotocasa = new FotocasaConnector({
    requestDelayMs: readNumberEnv("FOTOCASA_SCRAPE_REQUEST_DELAY_MS", 300),
    maxDetailRequests: readNumberEnv("FOTOCASA_MAX_DETAIL_REQUESTS", 8),
    ...(process.env.FOTOCASA_BASE_URL ? { baseUrl: process.env.FOTOCASA_BASE_URL } : {})
  });

  const habitaclia = new HabitacliaConnector({
    requestDelayMs: readNumberEnv("HABITACLIA_SCRAPE_REQUEST_DELAY_MS", 250),
    maxListings: readNumberEnv("HABITACLIA_MAX_LISTINGS", 20),
    maxRequests: readNumberEnv("HABITACLIA_MAX_SCRAPE_REQUESTS", 6),
    ...(process.env.HABITACLIA_BASE_URL ? { baseUrl: process.env.HABITACLIA_BASE_URL } : {})
  });

  const yaencontre = new YaencontreConnector({
    requestDelayMs: readNumberEnv("YAENCONTRE_SCRAPE_REQUEST_DELAY_MS", 350),
    maxListings: readNumberEnv("YAENCONTRE_MAX_LISTINGS", 20),
    maxRequests: readNumberEnv("YAENCONTRE_MAX_SCRAPE_REQUESTS", 4),
    ...(process.env.YAENCONTRE_BASE_URL ? { baseUrl: process.env.YAENCONTRE_BASE_URL } : {})
  });

  const milanuncios = new MilanunciosConnector({
    requestDelayMs: readNumberEnv("MILANUNCIOS_SCRAPE_REQUEST_DELAY_MS", 300),
    maxListings: readNumberEnv("MILANUNCIOS_MAX_LISTINGS", 20),
    maxRequests: readNumberEnv("MILANUNCIOS_MAX_SCRAPE_REQUESTS", 6),
    ...(process.env.MILANUNCIOS_BASE_URL ? { baseUrl: process.env.MILANUNCIOS_BASE_URL } : {})
  });

  const idealista = new IdealistaConnector({
    requestDelayMs: readNumberEnv("IDEALISTA_SCRAPE_REQUEST_DELAY_MS", 350),
    maxListings: readNumberEnv("IDEALISTA_MAX_LISTINGS", 20),
    maxRequests: readNumberEnv("IDEALISTA_MAX_SCRAPE_REQUESTS", 4),
    ...(process.env.IDEALISTA_BASE_URL ? { baseUrl: process.env.IDEALISTA_BASE_URL } : {})
  });

  const globaliza = new GlobalizaConnector({
    requestDelayMs: readNumberEnv("GLOBALIZA_SCRAPE_REQUEST_DELAY_MS", 300),
    maxListings: readNumberEnv("GLOBALIZA_MAX_LISTINGS", 20),
    maxRequests: readNumberEnv("GLOBALIZA_MAX_SCRAPE_REQUESTS", 6),
    ...(process.env.GLOBALIZA_BASE_URL ? { baseUrl: process.env.GLOBALIZA_BASE_URL } : {})
  });

  const hogaria = new HogariaConnector({
    requestDelayMs: readNumberEnv("HOGARIA_SCRAPE_REQUEST_DELAY_MS", 300),
    maxListings: readNumberEnv("HOGARIA_MAX_LISTINGS", 20),
    maxRequests: readNumberEnv("HOGARIA_MAX_SCRAPE_REQUESTS", 8),
    ...(process.env.HOGARIA_BASE_URL ? { baseUrl: process.env.HOGARIA_BASE_URL } : {})
  });

  const pisocompartido = new PisoCompartidoConnector({
    requestDelayMs: readNumberEnv("PISOCOMPARTIDO_SCRAPE_REQUEST_DELAY_MS", 300),
    maxListings: readNumberEnv("PISOCOMPARTIDO_MAX_LISTINGS", 20),
    maxRequests: readNumberEnv("PISOCOMPARTIDO_MAX_SCRAPE_REQUESTS", 6),
    ...(process.env.PISOCOMPARTIDO_BASE_URL ? { baseUrl: process.env.PISOCOMPARTIDO_BASE_URL } : {})
  });

  const enalquiler = new EnalquilerConnector({
    requestDelayMs: readNumberEnv("ENALQUILER_SCRAPE_REQUEST_DELAY_MS", 300),
    maxListings: readNumberEnv("ENALQUILER_MAX_LISTINGS", 20),
    maxRequests: readNumberEnv("ENALQUILER_MAX_SCRAPE_REQUESTS", 8),
    ...(process.env.ENALQUILER_BASE_URL ? { baseUrl: process.env.ENALQUILER_BASE_URL } : {})
  });

  return {
    pisos,
    tucasa,
    fotocasa,
    habitaclia,
    yaencontre,
    milanuncios,
    idealista,
    globaliza,
    hogaria,
    pisocompartido,
    enalquiler
  };
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

function listingKey(listing: ListingCard): string {
  return `${listing.portal}:${listing.portal_listing_id}`;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeLocation(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

const TITLE_STOPWORDS = new Set([
  "venta",
  "alquiler",
  "piso",
  "pisos",
  "casa",
  "casas",
  "chalet",
  "apartamento",
  "apartamentos",
  "en",
  "de",
  "del",
  "la",
  "el",
  "con"
]);

function titleTokenSet(title: string): Set<string> {
  const tokens = normalizeText(title)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !TITLE_STOPWORDS.has(token));
  return new Set(tokens);
}

function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.min(a.size, b.size);
}

function pricesAreCompatible(a: ListingCard, b: ListingCard): boolean {
  if (a.price_eur === null || b.price_eur === null) {
    return true;
  }

  const delta = Math.abs(a.price_eur - b.price_eur);
  const tolerance = Math.max(5000, Math.round(Math.min(a.price_eur, b.price_eur) * 0.05));
  return delta <= tolerance;
}

function roomsAreCompatible(a: ListingCard, b: ListingCard): boolean {
  if (a.rooms === null || b.rooms === null) {
    return true;
  }

  return Math.abs(a.rooms - b.rooms) <= 1;
}

function citiesAreCompatible(a: ListingCard, b: ListingCard): boolean {
  const cityA = normalizeLocation(a.city);
  const cityB = normalizeLocation(b.city);
  if (!cityA || !cityB) {
    return true;
  }

  return cityA.includes(cityB) || cityB.includes(cityA);
}

function normalizeListingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function areNearDuplicateListings(a: ListingCard, b: ListingCard): boolean {
  if (!citiesAreCompatible(a, b)) {
    return false;
  }

  if (!pricesAreCompatible(a, b) || !roomsAreCompatible(a, b)) {
    return false;
  }

  const titleA = normalizeText(a.title);
  const titleB = normalizeText(b.title);
  if (titleA.length === 0 || titleB.length === 0) {
    return false;
  }

  if (titleA === titleB) {
    return true;
  }

  const tokenOverlap = overlapCoefficient(titleTokenSet(a.title), titleTokenSet(b.title));
  return tokenOverlap >= 0.9;
}

function dedupeNearDuplicateCandidates(candidates: CollectedCandidate[]): {
  candidates: CollectedCandidate[];
  removed: number;
} {
  const sorted = [...candidates].sort((a, b) => compareRankedListings(a.listing, b.listing));
  const kept: CollectedCandidate[] = [];
  const seenUrls = new Set<string>();

  let removed = 0;
  for (const candidate of sorted) {
    const urlKey = normalizeListingUrl(candidate.listing.url);
    if (seenUrls.has(urlKey)) {
      removed += 1;
      continue;
    }

    const isNearDuplicate = kept.some((existing) =>
      areNearDuplicateListings(candidate.listing, existing.listing)
    );
    if (isNearDuplicate) {
      removed += 1;
      continue;
    }

    kept.push(candidate);
    seenUrls.add(urlKey);
  }

  return { candidates: kept, removed };
}

function compareRankedListings(a: ListingCard, b: ListingCard): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  const aPrice = a.price_eur ?? Number.MAX_SAFE_INTEGER;
  const bPrice = b.price_eur ?? Number.MAX_SAFE_INTEGER;
  if (aPrice !== bPrice) {
    return aPrice - bPrice;
  }

  const aRooms = a.rooms ?? -1;
  const bRooms = b.rooms ?? -1;
  if (bRooms !== aRooms) {
    return bRooms - aRooms;
  }

  const aSeen = Date.parse(a.last_seen_at);
  const bSeen = Date.parse(b.last_seen_at);
  if (Number.isFinite(aSeen) && Number.isFinite(bSeen) && bSeen !== aSeen) {
    return bSeen - aSeen;
  }

  return a.canonical_id.localeCompare(b.canonical_id);
}

function selectDiversifiedListings(
  candidates: CollectedCandidate[],
  requestedLocations: string[],
  maxResultsTotal: number
): ListingCard[] {
  if (requestedLocations.length <= 1) {
    return candidates
      .map((candidate) => candidate.listing)
      .sort(compareRankedListings)
      .slice(0, maxResultsTotal);
  }

  const byLocation = new Map<string, CollectedCandidate[]>();
  for (const candidate of candidates) {
    const existing = byLocation.get(candidate.search_location) ?? [];
    existing.push(candidate);
    byLocation.set(candidate.search_location, existing);
  }

  for (const group of byLocation.values()) {
    group.sort((a, b) => compareRankedListings(a.listing, b.listing));
  }

  const selected: ListingCard[] = [];
  const used = new Set<string>();

  for (const location of requestedLocations) {
    if (selected.length >= maxResultsTotal) {
      break;
    }

    const group = byLocation.get(location);
    if (!group || group.length === 0) {
      continue;
    }

    const candidate = group.shift();
    if (!candidate) {
      continue;
    }

    const key = listingKey(candidate.listing);
    if (used.has(key)) {
      continue;
    }

    used.add(key);
    selected.push(candidate.listing);
  }

  if (selected.length >= maxResultsTotal) {
    return selected.slice(0, maxResultsTotal);
  }

  const leftovers = candidates
    .filter((candidate) => !used.has(listingKey(candidate.listing)))
    .sort((a, b) => compareRankedListings(a.listing, b.listing));

  for (const candidate of leftovers) {
    if (selected.length >= maxResultsTotal) {
      break;
    }
    selected.push(candidate.listing);
  }

  return selected.slice(0, maxResultsTotal);
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
  latitude?: number;
  longitude?: number;
}

function readCoordinatesFromRaw(
  raw: ListingCard["raw"] | undefined
): [number, number] | null {
  if (!raw) {
    return null;
  }

  const candidates = raw as Record<string, unknown>;
  const latValue =
    candidates.lat ?? candidates.latitude ?? candidates.geo_lat ?? candidates.location_lat;
  const lonValue =
    candidates.lng ??
    candidates.lon ??
    candidates.longitude ??
    candidates.geo_lng ??
    candidates.location_lng;

  const lat =
    typeof latValue === "number" ? latValue : typeof latValue === "string" ? Number(latValue) : NaN;
  const lon =
    typeof lonValue === "number" ? lonValue : typeof lonValue === "string" ? Number(lonValue) : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }

  return [lat, lon];
}

function toPresentationCard(listing: ListingCard, locale: Locale): PresentationCard {
  const floorLabel = extractFloorLabel(listing);
  const facts: string[] = [];
  const coordinates = readCoordinatesFromRaw(listing.raw);

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
    why_matched: listing.why_matched.slice(0, 3),
    ...(coordinates ? { latitude: coordinates[0], longitude: coordinates[1] } : {})
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

function defaultSourcesForCriteria(criteria: NormalizedFilters): SourceSelection[] {
  const defaults: SourceSelection[] = [
    "pisos",
    "habitaclia",
    "tucasa",
    "fotocasa",
    "yaencontre",
    "milanuncios",
    "globaliza",
    "hogaria"
  ];

  const transaction = criteria.transaction_type;
  const supportsPropertyType =
    criteria.property_types.length === 0 ||
    criteria.property_types.some((propertyType) => propertyType === "flat" || propertyType === "house");
  if ((transaction === undefined || transaction === "rent") && supportsPropertyType) {
    defaults.push("pisocompartido");
    defaults.push("enalquiler");
  }

  return defaults;
}

async function runStructuredSearch(
  payload: ToolPayload,
  connectors: ConnectorRegistry
): Promise<SearchExecutionResult> {
  const baseCriteria = baseCriteriaFromPayload(payload);
  const allowedSources = uniqueStrings(
    (
      payload.sources ?? defaultSourcesForCriteria(baseCriteria)
    ).map((source) => source)
  ) as SourceSelection[];
  const requestedLocations = resolveLocations(payload);
  const perLocationLimit = payload.per_location_limit ?? 20;
  const maxResultsTotal = payload.max_results_total ?? 40;
  const strictConstraints = baseCriteria.strict_constraints ?? true;

  if (allowedSources.length === 0) {
    return {
      criteria: criteriaForLocation(baseCriteria),
      listings: [],
      diagnostics: {
        source: "fixture",
        connector_warnings: ["No source portals selected."],
        request_warnings: [],
        total_candidates: 0,
        returned_count: 0,
        coverage: [],
        execution: {
          mode: "structured",
          locations_requested: requestedLocations,
          locations_searched: [],
          sources: [],
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
        connector_warnings: [SEARCH_PROPERTIES_MISSING_LOCATION_WARNING, SEARCH_PROPERTIES_MISSING_LOCATION_ACTION],
        request_warnings: [SEARCH_PROPERTIES_CONTEXT_ONLY_WARNING],
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
          message: SEARCH_PROPERTIES_MISSING_LOCATION_WARNING,
          retry_hint: SEARCH_PROPERTIES_MISSING_LOCATION_RETRY_HINT
        }
      }
    };
  }

  const sourceKinds = new Set<ConnectorSource>();
  const connectorWarnings: string[] = [];
  const coverage: CoverageEntry[] = [];
  const collected: CollectedCandidate[] = [];
  let firstConnectorError: ConnectorError | null = null;

  const plannedLocations = requestedLocations.length === 0 ? ["__discovery__"] : requestedLocations;

  for (const location of plannedLocations) {
    const criteria =
      location === "__discovery__"
        ? criteriaForLocation(baseCriteria)
        : criteriaForLocation(baseCriteria, location);
    const perSourceCap = location === "__discovery__" ? maxResultsTotal : perLocationLimit;

    for (const source of allowedSources) {
      const connector = connectors[source];

      try {
        const result = await connector.search(criteria);
        sourceKinds.add(result.diagnostics.source);
        connectorWarnings.push(...result.diagnostics.connector_warnings);
        const ranked = rankListings(result.listings, criteria).slice(0, perSourceCap);
        collected.push(
          ...ranked.map((listing) => ({
            listing,
            search_location: location
          }))
        );
        coverage.push({
          location,
          portal: source,
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
            portal: source,
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

  const uniqueCandidates = uniqueBy(collected, (candidate) => listingKey(candidate.listing));
  const deduped = dedupeNearDuplicateCandidates(uniqueCandidates);
  const dedupedCandidates = deduped.candidates;
  const rankingCriteria =
    requestedLocations.length === 1
      ? criteriaForLocation(baseCriteria, requestedLocations[0])
      : criteriaForLocation(baseCriteria);

  const ranked =
    requestedLocations.length > 1
      ? selectDiversifiedListings(dedupedCandidates, requestedLocations, maxResultsTotal)
      : rankListings(
        dedupedCandidates.map((candidate) => candidate.listing),
        rankingCriteria
      ).slice(0, maxResultsTotal);

  if (deduped.removed > 0) {
    connectorWarnings.push(
      `Deduplicated ${deduped.removed} near-identical listings before ranking.`
    );
  }

  const uniqueWarnings = uniqueStrings(connectorWarnings);
  if (requestedLocations.length > 1) {
    uniqueWarnings.unshift(
      `Executed multi-location search across ${requestedLocations.length} locations and ${allowedSources.length} sources.`
    );
  }
  if (requestedLocations.length === 0) {
    uniqueWarnings.unshift(
      `No city/locations provided; running discovery search across ${allowedSources.length} sources because strict_constraints=false.`
    );
  }

  return {
    criteria: rankingCriteria,
    listings: ranked,
    diagnostics: {
      source: selectSource(sourceKinds),
      connector_warnings: uniqueWarnings,
      request_warnings: [],
      total_candidates: dedupedCandidates.length,
      returned_count: ranked.length,
      coverage,
      execution: {
        mode: "structured",
        locations_requested: requestedLocations,
        locations_searched: uniqueStrings(
          coverage
            .filter((entry) => entry.error_code === undefined)
            .map((entry) => entry.location)
        ),
        sources: allowedSources,
        ...(requestedLocations.length > 0 ? { per_location_limit: perLocationLimit } : {}),
        max_results_total: maxResultsTotal,
        strict_constraints: strictConstraints
      }
    }
  };
}

export function createFynMcpServer(connectors = connectorsFromEnv()): McpServer {
  const server = new McpServer({
    name: "fyn-mcp-server",
    version: "0.1.0"
  });

  server.registerResource(
    "fyn-search-results-widget",
    SEARCH_PROPERTIES_WIDGET_RESOURCE_URI,
    {
      title: "Fyn Search Results Widget",
      description: "Interactive map + cards for property search results.",
      mimeType: SEARCH_PROPERTIES_WIDGET_RESOURCE_MIME_TYPE
    },
    async () => ({
      contents: [
        {
          uri: SEARCH_PROPERTIES_WIDGET_RESOURCE_URI,
          mimeType: SEARCH_PROPERTIES_WIDGET_RESOURCE_MIME_TYPE,
          text: SEARCH_PROPERTIES_WIDGET_HTML,
          _meta: buildSearchPropertiesWidgetResourceMeta()
        }
      ]
    })
  );

  server.registerTool(
    "search_properties",
    {
      title: SEARCH_PROPERTIES_TOOL_TITLE,
      description: SEARCH_PROPERTIES_TOOL_DESCRIPTION,
      inputSchema: toolSchema,
      _meta: buildSearchPropertiesToolMeta(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async (payload) => {
      try {
        const execution = await runStructuredSearch(payload, connectors);
        const cards = execution.listings
          .slice(0, 20)
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

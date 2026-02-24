import {
  ConnectorError,
  type ConnectorSearchResult,
  type ListingCard,
  type NormalizedFilters,
  type PropertyType,
  type TransactionType
} from "../../../domain/src/index.js";

import { FIXTURE_LISTINGS } from "./fixture.js";

const SCRAPE_BASE_URL = "https://www.pisos.com";
const DEFAULT_BROAD_TYPES: PropertyType[] = ["flat", "house", "office", "land"];
const SCRAPE_TYPE_SEGMENT: Record<PropertyType, string> = {
  flat: "pisos",
  house: "casas",
  office: "oficinas",
  land: "terrenos"
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  euro: "EUR"
};

const DISALLOWED_PATH_SEGMENTS = ["/WS/", "/mapa/", "/Grid/GetAdsense", "/JSLogger/TraceError"];

export interface PisosConnectorOptions {
  apiKey?: string;
  baseUrl?: string;
  allowFixtureFallback?: boolean;
  pageSize?: number;
  serializedSearchOverride?: string;
  fetchImpl?: typeof fetch;
  enableScrapeFallback?: boolean;
  scrapeRequestDelayMs?: number;
  maxScrapeRequests?: number;
}

interface UnknownRecord {
  [key: string]: unknown;
}

interface ScrapeTarget {
  operation: TransactionType;
  propertyType: PropertyType;
  path: string;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as UnknownRecord;
  }

  return null;
}

function firstString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function firstNumber(record: UnknownRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/[,.](?=\d{3}\b)/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function extractImages(record: UnknownRecord): string[] {
  const imageKeys = ["images", "fotos", "multimedia", "media", "gallery"];

  for (const key of imageKeys) {
    const candidate = record[key];
    if (!Array.isArray(candidate)) {
      continue;
    }

    const urls = candidate
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        const node = asRecord(item);
        if (!node) {
          return null;
        }

        return firstString(node, ["url", "link", "src", "href", "contentUrl"]);
      })
      .filter((item): item is string => Boolean(item));

    if (urls.length > 0) {
      return urls;
    }
  }

  return [];
}

function inferPropertyType(rawType: string | null): ListingCard["property_type"] {
  if (!rawType) {
    return null;
  }

  const value = rawType.toLowerCase();
  if (/(piso|flat|apart|atico)/.test(value)) return "flat";
  if (/(casa|house|chalet|villa|adosada|pareada)/.test(value)) return "house";
  if (/(oficina|office)/.test(value)) return "office";
  if (/(suelo|land|solar|terreno|plot)/.test(value)) return "land";
  return null;
}

function inferTags(description: string): string[] {
  const tags: string[] = [];

  if (/(luz natural|natural light|luminos[oa]s?|bright|well[- ]lit|solead[oa])/i.test(description)) {
    tags.push("natural_light");
  }

  if (/\b(exterior|outside[- ]facing|toda exterior|todo exterior)\b/i.test(description)) {
    tags.push("exterior");
  }

  if (/(ventanales?|large windows|big windows)/i.test(description)) {
    tags.push("large_windows");
  }

  if (/(orientaci[oó]n|south[- ]facing|east[- ]facing|west[- ]facing)/i.test(description)) {
    tags.push("good_orientation");
  }

  if (/(naturaleza|nature|entorno natural|rural|monta(?:n|ñ)a|bosque|countryside|beachfront)/i.test(description)) {
    tags.push("nature");
  }

  if (/(vistas|views?|panor[aá]m)/i.test(description)) tags.push("views");
  if (/(retiro|retreat)/i.test(description)) tags.push("retreat");
  if (/(reforma|renov)/i.test(description)) tags.push("renovation");

  return Array.from(new Set(tags));
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      const code = Number.parseInt(decimal, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&([a-z]+);/gi, (match, entity: string) => NAMED_ENTITIES[entity.toLowerCase()] ?? match);
}

function stripTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function parsePrice(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function parseRooms(chars: string[]): number | null {
  for (const item of chars) {
    const match = item.match(/(\d+)\s*habs?/i);
    if (!match || !match[1]) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseCapacity(description: string, chars: string[]): number | null {
  const joined = `${description} ${chars.join(" ")}`;
  const match = joined.match(/(\d+)\s*(?:personas|people|puestos?)/i);
  if (!match || !match[1]) {
    const areaMatch = joined.match(/(\d+)\s*m²/i);
    if (!areaMatch || !areaMatch[1]) {
      return null;
    }

    const squareMeters = Number(areaMatch[1]);
    if (!Number.isFinite(squareMeters)) {
      return null;
    }

    // Approximate open-plan office occupancy using a conservative density.
    return Math.floor(squareMeters / 2.5);
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugifyCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function citySlugCandidates(city: string): string[] {
  const base = slugifyCity(city);
  if (!base) {
    return [];
  }

  return uniqueBy(
    [`${base}_capital_zona_urbana`, `${base}_capital`, base],
    (value) => value
  );
}

function isAllowedPath(path: string): boolean {
  if (/\.aspx(?:$|[/?#])/i.test(path)) {
    return false;
  }

  return !DISALLOWED_PATH_SEGMENTS.some((segment) => path.includes(segment));
}

function buildScrapePath(citySlug: string, propertyType: PropertyType, operation: TransactionType): string {
  const opSegment = operation === "rent" ? "alquiler" : "venta";
  const typeSegment = SCRAPE_TYPE_SEGMENT[propertyType];
  return `/${opSegment}/${typeSegment}-${citySlug}/`;
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

function normalizeRawListing(raw: unknown, idx: number): ListingCard {
  const record = asRecord(raw) ?? {};
  const idRaw = firstString(record, ["id", "idInmueble", "IdInmueble", "propertyId", "codigo"]) ?? String(idx + 1);
  const title = firstString(record, ["title", "titulo", "name", "headline", "descripcionCorta"]) ?? `Listing ${idRaw}`;
  const city = firstString(record, ["city", "ciudad", "municipio", "location", "poblacion"]) ?? "Unknown";
  const price = firstNumber(record, ["price", "precio", "importe", "priceEur"]);
  const rooms = firstNumber(record, ["rooms", "habitaciones", "dormitorios"]);
  const url = firstString(record, ["url", "link", "urlDetalle", "href"]) ?? `https://www.pisos.com/inmueble/${idRaw}/`;
  const typeLabel = firstString(record, ["propertyType", "tipoInmueble", "type"]);
  const description = firstString(record, ["description", "descripcion", "texto", "detalle"]) ?? "";
  const capacity = firstNumber(record, ["capacityPeople", "capacity", "aforo"]);

  return {
    canonical_id: `pisos-${idRaw.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    portal: "pisos",
    portal_listing_id: idRaw,
    url,
    title,
    city,
    price_eur: price,
    rooms,
    property_type: inferPropertyType(typeLabel),
    image_urls: extractImages(record),
    last_seen_at: new Date().toISOString(),
    score: 0,
    why_matched: [],
    description,
    tags: inferTags(description),
    capacity_people: capacity,
    raw: record
  };
}

function parseCardChunks(html: string): string[] {
  return html.match(/<div id="[^"]+" class="ad-preview[\s\S]*?<\/script>\s*<\/div>/g) ?? [];
}

function parseListingFromCardChunk(chunk: string, requestedType: PropertyType | null, sourcePath: string): ListingCard | null {
  const idMatch = chunk.match(/<div id="([^"]+)" class="ad-preview/);
  const linkMatch = chunk.match(/<a href="([^"]+)" class="ad-preview__title">([\s\S]*?)<\/a>/);
  if (!idMatch || !idMatch[1] || !linkMatch || !linkMatch[1] || !linkMatch[2]) {
    return null;
  }

  const portalListingId = idMatch[1];
  const relativeUrl = linkMatch[1];
  const title = stripTags(linkMatch[2]);
  const city = stripTags((chunk.match(/<p class="p-sm ad-preview__subtitle">([\s\S]*?)<\/p>/)?.[1] ?? "Unknown"));

  const priceRaw = stripTags(chunk.match(/<span class="ad-preview__price">([\s\S]*?)<\/span>/)?.[1] ?? "");
  const price = parsePrice(priceRaw);

  const chars = Array.from(chunk.matchAll(/<p class="ad-preview__char p-sm">([\s\S]*?)<\/p>/g)).map((match) =>
    stripTags(match[1] ?? "")
  );

  const description = stripTags(chunk.match(/<p class="ad-preview__description">([\s\S]*?)<\/p>/)?.[1] ?? "");

  const imageUrls = Array.from(chunk.matchAll(/(?:src|data-src)="(https:\/\/fotos\.imghs\.net\/[^\"]+)"/g))
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));

  const fullUrl = new URL(relativeUrl, SCRAPE_BASE_URL).toString();
  const inferredType = inferPropertyType(`${title} ${relativeUrl} ${description}`);

  return {
    canonical_id: `pisos-${portalListingId.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    portal: "pisos",
    portal_listing_id: portalListingId,
    url: fullUrl,
    title,
    city,
    price_eur: price,
    rooms: parseRooms(chars),
    property_type: requestedType ?? inferredType,
    image_urls: uniqueBy(imageUrls, (value) => value),
    last_seen_at: new Date().toISOString(),
    score: 0,
    why_matched: [],
    description,
    tags: inferTags(description),
    capacity_people: parseCapacity(description, chars),
    raw: {
      source_path: sourcePath,
      price_raw: priceRaw,
      chars
    }
  };
}

function parseJsonLdListings(html: string, requestedType: PropertyType | null, sourcePath: string): ListingCard[] {
  const listings: ListingCard[] = [];
  const scriptBlocks = Array.from(
    html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    (match) => match[1]
  );

  for (const block of scriptBlocks) {
    if (!block) {
      continue;
    }

    const decoded = decodeHtmlEntities(block).trim();
    if (!decoded.startsWith("{") || !decoded.includes('"url"')) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      continue;
    }

    const record = asRecord(parsed);
    if (!record) {
      continue;
    }

    const relativeUrl = firstString(record, ["url"]);
    if (!relativeUrl || (!relativeUrl.includes("/comprar/") && !relativeUrl.includes("/alquiler/"))) {
      continue;
    }

    const portalListingId = firstString(record, ["@id"]) ?? relativeUrl;
    const title = firstString(record, ["name", "description"]) ?? "Listing";

    const address = asRecord(record.address);
    const city = (address ? firstString(address, ["addressLocality", "addressRegion"]) : null) ?? "Unknown";

    const image = firstString(record, ["image"])
      ?? (asRecord(record.photo) ? firstString(asRecord(record.photo) ?? {}, ["contentUrl", "url"]) : null);

    const description = firstString(record, ["description", "name"]) ?? "";
    const rooms = firstNumber(record, ["numberOfRooms"]);

    listings.push({
      canonical_id: `pisos-${portalListingId.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
      portal: "pisos",
      portal_listing_id: portalListingId,
      url: new URL(relativeUrl, SCRAPE_BASE_URL).toString(),
      title: stripTags(title),
      city: stripTags(city),
      price_eur: null,
      rooms,
      property_type: requestedType ?? inferPropertyType(title),
      image_urls: image ? [image] : [],
      last_seen_at: new Date().toISOString(),
      score: 0,
      why_matched: [],
      description: stripTags(description),
      tags: inferTags(description),
      capacity_people: parseCapacity(description, []),
      raw: { source_path: sourcePath, source: "jsonld" }
    });
  }

  return listings;
}

function parseListingsFromSearchHtml(html: string, requestedType: PropertyType | null, sourcePath: string): ListingCard[] {
  const cardChunks = parseCardChunks(html);
  const fromCards = cardChunks
    .map((chunk) => parseListingFromCardChunk(chunk, requestedType, sourcePath))
    .filter((listing): listing is ListingCard => Boolean(listing));

  if (fromCards.length > 0) {
    return uniqueBy(fromCards, (listing) => listing.portal_listing_id);
  }

  const fromJsonLd = parseJsonLdListings(html, requestedType, sourcePath);
  return uniqueBy(fromJsonLd, (listing) => listing.portal_listing_id);
}

function buildSerializedSearch(criteria: NormalizedFilters, override?: string): string {
  if (override) {
    return encodeURIComponent(override);
  }

  const payload = {
    city: criteria.city,
    operation: criteria.transaction_type ?? "buy",
    propertyTypes: criteria.property_types,
    maxPrice: criteria.max_price_eur,
    minRooms: criteria.min_rooms,
    nearbyTowns: criteria.nearby_towns,
    tags: criteria.tags
  };

  // The exact upstream serialization contract is currently undocumented in public docs.
  // This conservative JSON payload keeps connector plumbing live until real format is provided.
  return encodeURIComponent(JSON.stringify(payload));
}

function toFixtureResult(warning: string): ConnectorSearchResult {
  return {
    listings: FIXTURE_LISTINGS,
    diagnostics: {
      source: "fixture",
      connector_warnings: [warning]
    }
  };
}

function parseApiMessage(payload: unknown): string {
  const record = asRecord(payload);
  const message = record ? firstString(record, ["message", "Message", "error", "detail"]) : null;
  return message ?? "Unknown API error";
}

function extractListings(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const candidates = ["inmuebles", "items", "results", "listings", "data", "properties"];
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }

    const nested = asRecord(value);
    if (!nested) {
      continue;
    }

    for (const nestedKey of candidates) {
      const nestedValue = nested[nestedKey];
      if (Array.isArray(nestedValue)) {
        return nestedValue;
      }
    }
  }

  return [];
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class PisosConnector {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly allowFixtureFallback: boolean;
  private readonly pageSize: number;
  private readonly serializedSearchOverride: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly enableScrapeFallback: boolean;
  private readonly scrapeRequestDelayMs: number;
  private readonly maxScrapeRequests: number;

  constructor(options: PisosConnectorOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.pisos.com/v5";
    this.allowFixtureFallback = options.allowFixtureFallback ?? true;
    this.pageSize = options.pageSize ?? 25;
    this.serializedSearchOverride = options.serializedSearchOverride;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.enableScrapeFallback = options.enableScrapeFallback ?? true;
    this.scrapeRequestDelayMs = options.scrapeRequestDelayMs ?? 500;
    this.maxScrapeRequests = options.maxScrapeRequests ?? 6;
  }

  private async tryScrapeFallback(criteria: NormalizedFilters, warning: string): Promise<ConnectorSearchResult | null> {
    if (!this.enableScrapeFallback) {
      return null;
    }

    try {
      const scraped = await this.searchByScrape(criteria);
      return {
        ...scraped,
        diagnostics: {
          ...scraped.diagnostics,
          connector_warnings: [warning, ...scraped.diagnostics.connector_warnings]
        }
      };
    } catch {
      return null;
    }
  }

  private buildScrapeTargets(criteria: NormalizedFilters): ScrapeTarget[] {
    if (!criteria.city) {
      return [];
    }

    const operations: TransactionType[] = criteria.transaction_type ? [criteria.transaction_type] : ["buy"];
    const propertyTypes = criteria.property_types.length > 0 ? criteria.property_types : DEFAULT_BROAD_TYPES;
    const citySlugs = citySlugCandidates(criteria.city);

    const targets: ScrapeTarget[] = [];
    for (const citySlug of citySlugs) {
      for (const operation of operations) {
        for (const propertyType of propertyTypes) {
          const path = buildScrapePath(citySlug, propertyType, operation);
          if (!isAllowedPath(path)) {
            continue;
          }

          targets.push({ operation, propertyType, path });
        }
      }
    }

    return uniqueBy(targets, (target) => target.path).slice(0, this.maxScrapeRequests);
  }

  private async searchByScrape(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    if (!criteria.city) {
      throw new ConnectorError("UPSTREAM_SCHEMA_CHANGED", "Scraper mode requires city-level criteria.");
    }

    const targets = this.buildScrapeTargets(criteria);
    if (targets.length === 0) {
      throw new ConnectorError("UPSTREAM_SCHEMA_CHANGED", "No valid scraper targets generated for current criteria.");
    }

    const warnings: string[] = [];
    const scrapedListings: ListingCard[] = [];

    for (const [index, target] of targets.entries()) {
      if (index > 0) {
        await sleep(this.scrapeRequestDelayMs);
      }

      const url = new URL(target.path, SCRAPE_BASE_URL).toString();

      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.7"
          }
        });
      } catch (error) {
        warnings.push(`Scrape request failed for ${target.path}: ${String(error)}`);
        continue;
      }

      if (response.status === 429) {
        throw new ConnectorError("UPSTREAM_RATE_LIMIT", "Pisos web scraping hit rate limits.", true);
      }

      if (!response.ok) {
        warnings.push(`Scrape request ${target.path} returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const listings = parseListingsFromSearchHtml(html, target.propertyType, target.path);
      if (listings.length === 0) {
        warnings.push(`No listings parsed from ${target.path}`);
        continue;
      }

      scrapedListings.push(...listings);
    }

    const uniqueListings = uniqueBy(scrapedListings, (listing) => listing.portal_listing_id);
    if (uniqueListings.length === 0) {
      throw new ConnectorError("UPSTREAM_SCHEMA_CHANGED", "Scraper extracted no listings from selected pages.");
    }

    return {
      listings: uniqueListings,
      diagnostics: {
        source: "scrape",
        connector_warnings:
          warnings.length > 0
            ? warnings
            : ["Using HTML scraping fallback on pisos.com listing pages."]
      }
    };
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    if (!this.apiKey) {
      const scraped = await this.tryScrapeFallback(criteria, "Missing PISOS_API_KEY; using scraper fallback.");
      if (scraped) {
        return scraped;
      }

      if (this.allowFixtureFallback) {
        return toFixtureResult("Missing PISOS_API_KEY; returning fixture listings.");
      }

      throw new ConnectorError("MISSING_API_KEY", "PISOS_API_KEY is required for live connector mode.");
    }

    const serialized = buildSerializedSearch(criteria, this.serializedSearchOverride);
    const url = `${this.baseUrl}/inmuebles/${this.pageSize}/1/${serialized}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          ApiKey: this.apiKey,
          Accept: "application/json"
        }
      });
    } catch (error) {
      const scraped = await this.tryScrapeFallback(
        criteria,
        `Live API network error (${String(error)}); using scraper fallback.`
      );
      if (scraped) {
        return scraped;
      }

      if (this.allowFixtureFallback) {
        return toFixtureResult(`Network error on live connector, fallback enabled: ${String(error)}`);
      }

      throw new ConnectorError("UPSTREAM_SCHEMA_CHANGED", `Network error while calling Pisos API: ${String(error)}`);
    }

    if (response.status === 401) {
      let message = "Authorization rejected by Pisos API.";
      try {
        message = parseApiMessage(await response.json());
      } catch {
        // ignore JSON parse failure
      }

      const scraped = await this.tryScrapeFallback(
        criteria,
        `Live API authorization failed (${message}); using scraper fallback.`
      );
      if (scraped) {
        return scraped;
      }

      if (/mandatory/i.test(message)) {
        throw new ConnectorError("MISSING_API_KEY", message);
      }

      throw new ConnectorError("AUTH_REJECTED", message);
    }

    if (response.status === 429) {
      const scraped = await this.tryScrapeFallback(
        criteria,
        "Live API rate-limited; using scraper fallback with conservative pacing."
      );
      if (scraped) {
        return scraped;
      }

      throw new ConnectorError("UPSTREAM_RATE_LIMIT", "Pisos API rate limited the request.", true);
    }

    if (!response.ok) {
      const scraped = await this.tryScrapeFallback(
        criteria,
        `Live connector returned HTTP ${response.status}; using scraper fallback.`
      );
      if (scraped) {
        return scraped;
      }

      if (this.allowFixtureFallback) {
        return toFixtureResult(`Live connector returned HTTP ${response.status}; using fixtures.`);
      }

      throw new ConnectorError(
        "UPSTREAM_SCHEMA_CHANGED",
        `Unexpected Pisos API response status: ${response.status}`,
        response.status >= 500
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      const scraped = await this.tryScrapeFallback(
        criteria,
        "Live connector returned non-JSON response; using scraper fallback."
      );
      if (scraped) {
        return scraped;
      }

      if (this.allowFixtureFallback) {
        return toFixtureResult("Live connector returned non-JSON response; using fixtures.");
      }

      throw new ConnectorError("UPSTREAM_SCHEMA_CHANGED", "Pisos API response was not valid JSON.");
    }

    const rawListings = extractListings(payload);

    if (rawListings.length === 0) {
      const scraped = await this.tryScrapeFallback(
        criteria,
        "Live connector returned no listings; using scraper fallback."
      );
      if (scraped) {
        return scraped;
      }

      if (this.allowFixtureFallback) {
        return toFixtureResult("Live connector returned no listings; using fixtures.");
      }

      throw new ConnectorError("UPSTREAM_SCHEMA_CHANGED", "Could not extract listing array from Pisos API payload.");
    }

    return {
      listings: rawListings.map((raw, idx) => normalizeRawListing(raw, idx)),
      diagnostics: {
        source: "live",
        connector_warnings: this.serializedSearchOverride
          ? ["Using PISOS_SERIALIZED_SEARCH override for live calls."]
          : ["Using provisional serialized search payload until official format is provided."]
      }
    };
  }
}

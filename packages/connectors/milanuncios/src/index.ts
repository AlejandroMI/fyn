import {
  ConnectorError,
  type ConnectorSearchResult,
  type ListingCard,
  type NormalizedFilters
} from "@fyn/domain";
import {
  assertNotBotBlocked,
  browserHeaders,
  inferPropertyTypeFromText,
  inferTagsFromDescription,
  listingNowIso,
  parseFiniteNumber,
  parsePriceNumber,
  parseRoomsFromText,
  slugify,
  sleep,
  stripTags,
  toAbsoluteUrl,
  type ConnectorAdapter,
  type ScraperOptions,
  uniqueBy,
  uniqueStrings
} from "@fyn/connectors-core";

const MILANUNCIOS_BASE_URL = "https://www.milanuncios.com";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 6;

type Resource = "pisos" | "casas" | "locales" | "solares";

export interface MilanunciosConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
  maxRequests?: number;
}

function modePrefix(criteria: NormalizedFilters): "venta-de" | "alquiler-de" {
  return criteria.transaction_type === "rent" ? "alquiler-de" : "venta-de";
}

function inferResourceFromPropertyType(propertyType: ListingCard["property_type"]): Resource | null {
  if (propertyType === "flat") return "pisos";
  if (propertyType === "house") return "casas";
  if (propertyType === "office") return "locales";
  if (propertyType === "land") return "solares";
  return null;
}

function requestedResources(criteria: NormalizedFilters): Resource[] {
  if (criteria.property_types.length === 0) {
    return ["pisos", "casas"];
  }

  const resources = criteria.property_types
    .map((propertyType) => inferResourceFromPropertyType(propertyType))
    .filter((resource): resource is Resource => resource !== null);

  if (resources.length === 0) {
    return ["pisos", "casas"];
  }

  return uniqueStrings(resources) as Resource[];
}

function buildCandidatePaths(criteria: NormalizedFilters): string[] {
  const mode = modePrefix(criteria);
  const resources = requestedResources(criteria);
  const paths: string[] = [];

  for (const resource of resources) {
    const base = `/${mode}-${resource}`;
    paths.push(`${base}/`);
  }

  if (!criteria.city) {
    return uniqueStrings(paths);
  }

  const citySlug = slugify(criteria.city);
  for (const resource of resources) {
    const base = `/${mode}-${resource}`;
    paths.push(`${base}-en-${citySlug}/`);
    paths.push(`${base}-en-${citySlug}-capital/`);
    paths.push(`${base}-en-${citySlug}-${citySlug}/`);
  }

  return uniqueStrings(paths);
}

function inferPropertyTypeFromPath(pathname: string): ListingCard["property_type"] {
  const lower = pathname.toLowerCase();
  if (lower.includes("de-pisos")) return "flat";
  if (lower.includes("de-casas")) return "house";
  if (lower.includes("de-locales") || lower.includes("de-oficinas")) return "office";
  if (lower.includes("de-solares") || lower.includes("de-terrenos")) return "land";
  return null;
}

function extractListingId(pathname: string): string {
  const byPath = pathname.match(/-(\d+)\.htm/i)?.[1];
  if (byPath) {
    return byPath;
  }

  return slugify(pathname).replace(/-/g, "_") || `anon_${Date.now()}`;
}

function firstText(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  return stripTags(match[1]);
}

function extractListingPath(block: string): string | null {
  const byTitleLink = block.match(
    /<a[^>]*class=["'][^"']*ma-AdCardListingV2-TitleLink[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i
  )?.[1];
  if (byTitleLink) {
    return byTitleLink;
  }

  return block.match(/<a[^>]*href=["'](\/(?:venta|alquiler)-de-[^"']+?\.htm)["'][^>]*>/i)?.[1] ?? null;
}

function extractTagChars(block: string): string[] {
  const values: string[] = [];
  const pattern = /<span[^>]*class=["'][^"']*ma-AdTag-label[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
  for (const match of block.matchAll(pattern)) {
    if (!match[1]) {
      continue;
    }

    const value = stripTags(match[1]);
    if (value.length === 0) {
      continue;
    }
    values.push(value);
  }

  return uniqueStrings(values);
}

function roomsFromChars(chars: string[]): number | null {
  for (const value of chars) {
    const parsed = parseRoomsFromText(value);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function surfaceFromChars(chars: string[]): number | null {
  for (const value of chars) {
    const match = value.match(/(\d+)\s*m²/i);
    if (!match?.[1]) {
      continue;
    }

    const parsed = parseFiniteNumber(match[1]);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function toCityNormalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cityMatches(listingCity: string, requestedCity: string): boolean {
  const target = toCityNormalized(requestedCity);
  if (!target) {
    return true;
  }

  const city = toCityNormalized(listingCity);
  return city.includes(target);
}

function toListingCard(
  block: string,
  baseUrl: string,
  criteria: NormalizedFilters,
  seenAt: string
): ListingCard | null {
  const path = extractListingPath(block);
  if (!path) {
    return null;
  }

  const url = new URL(toAbsoluteUrl(path, baseUrl));
  const listingId = extractListingId(url.pathname);
  const title = firstText(
    block,
    /<h2[^>]*class=["'][^"']*ma-AdCardV2-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i
  ) ?? `Inmueble ${listingId}`;
  const city = firstText(
    block,
    /<span[^>]*class=["'][^"']*ma-AdLocation-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
  ) ?? criteria.city ?? "Unknown";

  const priceRaw = firstText(
    block,
    /<span[^>]*class=["'][^"']*ma-AdPrice-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
  );
  const description =
    firstText(
      block,
      /<p[^>]*class=["'][^"']*ma-AdCardV2-description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i
    ) ?? "";
  const imageUrlRaw = block.match(
    /<img[^>]*class=["'][^"']*ma-AdCardV2-photo[^"']*["'][^>]*src=["']([^"']+)["'][^>]*>/i
  )?.[1];
  const imageUrl = imageUrlRaw ? toAbsoluteUrl(imageUrlRaw, baseUrl) : null;
  const chars = extractTagChars(block);

  const rooms = roomsFromChars(chars) ?? parseRoomsFromText(`${title} ${description}`);
  const surface = surfaceFromChars(chars);
  const typeFromPath = inferPropertyTypeFromPath(url.pathname);
  const propertyType = typeFromPath ?? inferPropertyTypeFromText(`${title} ${description}`);

  return {
    canonical_id: `milanuncios-${listingId}`,
    portal: "milanuncios",
    portal_listing_id: listingId,
    url: url.toString(),
    title,
    city,
    price_eur: parsePriceNumber(priceRaw),
    rooms,
    property_type: propertyType,
    image_urls: imageUrl ? [imageUrl] : [],
    last_seen_at: seenAt,
    score: 0,
    why_matched: [],
    description,
    tags: inferTagsFromDescription(`${title} ${description}`),
    capacity_people:
      propertyType === "office" && surface !== null ? Math.max(1, Math.floor(surface / 2.5)) : null,
    raw: {
      source_path: url.pathname,
      ...(priceRaw ? { price_raw: priceRaw } : {}),
      chars
    }
  };
}

function parseListings(html: string, baseUrl: string, criteria: NormalizedFilters, seenAt: string): ListingCard[] {
  const listings: ListingCard[] = [];
  const articlePattern =
    /<article[^>]*class=["'][^"']*ma-AdCardV2[^"']*["'][^>]*>[\s\S]*?<\/article>/gi;
  for (const match of html.matchAll(articlePattern)) {
    const block = match[0];
    if (!block) {
      continue;
    }

    const listing = toListingCard(block, baseUrl, criteria, seenAt);
    if (!listing) {
      continue;
    }
    listings.push(listing);
  }

  return uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);
}

export class MilanunciosConnector implements ConnectorAdapter {
  readonly portal = "milanuncios" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: MilanunciosConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? MILANUNCIOS_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 300;
    this.maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const candidatePaths = buildCandidatePaths(criteria).slice(0, this.maxRequests);
    if (candidatePaths.length === 0) {
      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "milanuncios has no candidate paths for the provided criteria.",
        true,
        "milanuncios"
      );
    }

    const warnings: string[] = [];
    const listings: ListingCard[] = [];
    const seenAt = listingNowIso();
    let blockedCount = 0;
    let rateLimitedCount = 0;

    for (const [index, path] of candidatePaths.entries()) {
      if (index > 0) {
        await sleep(this.requestDelayMs);
      }

      const url = new URL(path, this.baseUrl);
      const response = await this.fetchImpl(url, {
        headers: {
          ...browserHeaders({
            requestDelayMs: this.requestDelayMs,
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
          }),
          Referer: `${this.baseUrl}/`
        }
      });

      if (response.status === 403) {
        blockedCount += 1;
        warnings.push(`milanuncios path blocked: ${path}`);
        continue;
      }

      if (response.status === 429) {
        rateLimitedCount += 1;
        warnings.push(`milanuncios rate-limited: ${path}`);
        continue;
      }

      if (response.status === 404) {
        warnings.push(`milanuncios path not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        warnings.push(`milanuncios request ${path} returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      try {
        assertNotBotBlocked(html, "milanuncios");
      } catch {
        blockedCount += 1;
        warnings.push(`milanuncios anti-bot challenge on path: ${path}`);
        continue;
      }

      const parsed = parseListings(html, this.baseUrl, criteria, seenAt);
      if (parsed.length === 0) {
        warnings.push(`milanuncios returned no listing cards on path: ${path}`);
        continue;
      }

      listings.push(...parsed);
      if (listings.length >= this.maxListings) {
        break;
      }
    }

    const uniqueListings = uniqueBy(
      listings,
      (listing) => `${listing.portal}:${listing.portal_listing_id}`
    );

    const cappedListings = uniqueListings.slice(0, this.maxListings);
    if (criteria.city) {
      const cityFiltered = cappedListings.filter((listing) => cityMatches(listing.city, criteria.city ?? ""));
      if (cityFiltered.length > 0) {
        return {
          listings: cityFiltered,
          diagnostics: {
            source: "scrape",
            connector_warnings: uniqueStrings(warnings)
          }
        };
      }

      warnings.push(
        `No strict city matches for "${criteria.city}" on milanuncios; returning broader listing set.`
      );
    }

    const finalListings = cappedListings.slice(0, this.maxListings);
    if (finalListings.length === 0) {
      if (rateLimitedCount === candidatePaths.length) {
        throw new ConnectorError(
          "UPSTREAM_RATE_LIMIT",
          "milanuncios rate-limited all candidate requests.",
          true,
          "milanuncios"
        );
      }

      if (blockedCount === candidatePaths.length) {
        throw new ConnectorError(
          "UPSTREAM_BLOCKED",
          "milanuncios blocked automated access for all candidate paths.",
          true,
          "milanuncios"
        );
      }

      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "milanuncios returned no usable listings for the provided criteria.",
        true,
        "milanuncios"
      );
    }

    return {
      listings: finalListings,
      diagnostics: {
        source: "scrape",
        connector_warnings: uniqueStrings(warnings)
      }
    };
  }
}

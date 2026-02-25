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

const GLOBALIZA_BASE_URL = "https://www.globaliza.com";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 6;

type Resource = "viviendas" | "pisos" | "casas" | "chalets" | "oficinas" | "terrenos";

export interface GlobalizaConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
  maxRequests?: number;
}

function modeSegment(criteria: NormalizedFilters): "venta" | "alquiler" {
  return criteria.transaction_type === "rent" ? "alquiler" : "venta";
}

function resourcesForPropertyType(propertyType: ListingCard["property_type"]): Resource[] {
  if (propertyType === "flat") return ["pisos"];
  if (propertyType === "house") return ["casas", "chalets"];
  if (propertyType === "office") return ["oficinas"];
  if (propertyType === "land") return ["terrenos"];
  return ["viviendas"];
}

function requestedResources(criteria: NormalizedFilters): Resource[] {
  if (criteria.property_types.length === 0) {
    return ["viviendas"];
  }

  const resources = criteria.property_types.flatMap((propertyType) => resourcesForPropertyType(propertyType));
  return uniqueStrings(resources) as Resource[];
}

function buildCandidatePaths(criteria: NormalizedFilters): string[] {
  const mode = modeSegment(criteria);
  const resources = requestedResources(criteria);
  const paths: string[] = [];

  if (!criteria.city) {
    for (const resource of resources) {
      paths.push(`/${mode}/${resource}`);
    }
    return uniqueStrings(paths);
  }

  const citySlug = slugify(criteria.city);
  for (const resource of resources) {
    paths.push(`/${mode}/${resource}/${citySlug}`);
  }

  return uniqueStrings(paths);
}

function normalizedCity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cityMatches(listingCity: string, requestedCity: string): boolean {
  const city = normalizedCity(listingCity);
  const target = normalizedCity(requestedCity);
  if (!target) {
    return true;
  }

  return city.includes(target);
}

function extractListingId(url: URL): string {
  const byPath = url.pathname.match(/\/inmueble\/([^/?#]+)/i)?.[1];
  if (byPath) {
    return slugify(byPath).replace(/-/g, "_");
  }

  return slugify(url.pathname).replace(/-/g, "_") || `anon_${Date.now()}`;
}

function inferPropertyTypeFromPath(pathname: string): ListingCard["property_type"] {
  const lower = pathname.toLowerCase();
  if (lower.includes("/venta/pisos") || lower.includes("/alquiler/pisos")) return "flat";
  if (
    lower.includes("/venta/casas") ||
    lower.includes("/alquiler/casas") ||
    lower.includes("/venta/chalets") ||
    lower.includes("/alquiler/chalets")
  ) {
    return "house";
  }
  if (lower.includes("/venta/oficinas") || lower.includes("/alquiler/oficinas")) return "office";
  if (lower.includes("/venta/terrenos") || lower.includes("/alquiler/terrenos")) return "land";
  return null;
}

function parseImageUrl(block: string, baseUrl: string): string | null {
  const imageMatches = Array.from(block.matchAll(/(?:src|data-lazy)=["']([^"']+)["']/gi));
  const candidates = imageMatches
    .map((match) => match[1])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .filter((value) => !/loading-image|logo\.jpeg|logo\.png/i.test(value));

  if (candidates.length === 0) {
    return null;
  }

  const preferred =
    candidates.find((value) => /img\.resemmedia\.com/i.test(value)) ?? candidates[0] ?? null;

  if (!preferred) {
    return null;
  }

  if (preferred.startsWith("//")) {
    return `https:${preferred}`;
  }

  return toAbsoluteUrl(preferred, baseUrl);
}

function toCityFromBlock(block: string, criteria: NormalizedFilters): string {
  const addressMeta = block.match(/<meta[^>]*itemprop=["']addressLocality["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (addressMeta) {
    return stripTags(addressMeta);
  }

  const title = stripTags(
    block.match(/<h2[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? ""
  );
  const cityFromTitle = title.match(/,\s*([^,]+),\s*[^,]+$/)?.[1];
  if (cityFromTitle) {
    return cityFromTitle.trim();
  }

  return criteria.city ?? "Unknown";
}

function toListingCard(
  block: string,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string
): ListingCard | null {
  const href = block.match(/<a[^>]*class=["'][^"']*detail-redirection[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
  if (!href) {
    return null;
  }

  const url = new URL(toAbsoluteUrl(href, baseUrl));
  const listingId = extractListingId(url);

  const title = stripTags(
    block.match(/<h2[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? `Inmueble ${listingId}`
  );
  const priceRaw = stripTags(
    block.match(/<div[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""
  );
  const description = stripTags(
    block.match(/<p[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ""
  );

  const roomsRaw = block.match(/<span[^>]*class=["'][^"']*rooms[^"']*["'][^>]*>(\d+)/i)?.[1];
  const bathroomsRaw = block.match(/<span[^>]*class=["'][^"']*bathrooms[^"']*["'][^>]*>(\d+)/i)?.[1];
  const areaRaw = block.match(/<span[^>]*class=["'][^"']*areaBuilt[^"']*["'][^>]*>(\d+)\s*m2/i)?.[1];

  const rooms = roomsRaw ? parseFiniteNumber(roomsRaw) : parseRoomsFromText(`${title} ${description}`);
  const bathrooms = bathroomsRaw ? parseFiniteNumber(bathroomsRaw) : null;
  const area = areaRaw ? parseFiniteNumber(areaRaw) : null;

  const chars: string[] = [];
  if (rooms !== null) {
    chars.push(`${rooms} habs.`);
  }
  if (bathrooms !== null) {
    chars.push(`${bathrooms} baños`);
  }
  if (area !== null) {
    chars.push(`${Math.round(area)} m²`);
  }

  const propertyType = inferPropertyTypeFromPath(url.pathname) ?? inferPropertyTypeFromText(`${title} ${description}`);
  const imageUrl = parseImageUrl(block, baseUrl);

  return {
    canonical_id: `globaliza-${listingId}`,
    portal: "globaliza",
    portal_listing_id: listingId,
    url: url.toString(),
    title,
    city: toCityFromBlock(block, criteria),
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
      propertyType === "office" && area !== null ? Math.max(1, Math.floor(area / 2.5)) : null,
    raw: {
      source_path: url.pathname,
      ...(priceRaw ? { price_raw: priceRaw } : {}),
      chars
    }
  };
}

function parseListings(
  html: string,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string
): ListingCard[] {
  const listings: ListingCard[] = [];
  const blocks = html.match(/<li[^>]*class=["'][^"']*serp-snippet[^"']* ad[^"']*["'][\s\S]*?<\/li>/gi) ?? [];

  for (const block of blocks) {
    const listing = toListingCard(block, criteria, baseUrl, seenAt);
    if (!listing) {
      continue;
    }

    listings.push(listing);
  }

  return uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);
}

export class GlobalizaConnector implements ConnectorAdapter {
  readonly portal = "globaliza" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: GlobalizaConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? GLOBALIZA_BASE_URL;
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
        "globaliza has no candidate paths for the provided criteria.",
        true,
        "globaliza"
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
          ...browserHeaders({ requestDelayMs: this.requestDelayMs }),
          Referer: `${this.baseUrl}/`
        }
      });

      if (response.status === 403) {
        blockedCount += 1;
        warnings.push(`globaliza blocked path: ${path}`);
        continue;
      }

      if (response.status === 429) {
        rateLimitedCount += 1;
        warnings.push(`globaliza rate-limited path: ${path}`);
        continue;
      }

      if (response.status === 404) {
        warnings.push(`globaliza path not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        warnings.push(`globaliza request ${path} returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      try {
        assertNotBotBlocked(html, "globaliza");
      } catch {
        blockedCount += 1;
        warnings.push(`globaliza anti-bot challenge on path: ${path}`);
        continue;
      }

      const parsed = parseListings(html, criteria, this.baseUrl, seenAt);
      if (parsed.length === 0) {
        warnings.push(`globaliza returned no listing cards on path: ${path}`);
        continue;
      }

      listings.push(...parsed);
      if (listings.length >= this.maxListings) {
        break;
      }
    }

    const uniqueListings = uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);
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

      if (cappedListings.length > 0) {
        warnings.push(
          `No strict city matches for "${criteria.city}" on globaliza; returning broader listing set.`
        );
      }
    }

    const finalListings = cappedListings.slice(0, this.maxListings);
    if (finalListings.length === 0) {
      if (rateLimitedCount === candidatePaths.length) {
        throw new ConnectorError(
          "UPSTREAM_RATE_LIMIT",
          "globaliza rate-limited all candidate requests.",
          true,
          "globaliza"
        );
      }

      if (blockedCount === candidatePaths.length) {
        throw new ConnectorError(
          "UPSTREAM_BLOCKED",
          "globaliza blocked automated access for all candidate paths.",
          true,
          "globaliza"
        );
      }

      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "globaliza returned no usable listings for the provided criteria.",
        true,
        "globaliza"
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

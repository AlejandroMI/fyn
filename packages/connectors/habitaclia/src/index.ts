import {
  ConnectorError,
  type ConnectorSearchResult,
  type ListingCard,
  type NormalizedFilters
} from "@fyn/domain";
import {
  assertNotBotBlocked,
  browserHeaders,
  decodeHtmlEntities,
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
  uniqueBy,
  uniqueStrings,
  type ConnectorAdapter,
  type ScraperOptions
} from "@fyn/connectors-core";

const HABITACLIA_BASE_URL = "https://www.habitaclia.com";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 6;

export interface HabitacliaConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
  maxRequests?: number;
}

interface ListingSlice {
  openingTag: string;
  html: string;
}

function toHabitacliaCitySlug(city: string): string {
  return slugify(city).replace(/-/g, "_");
}

function resourceFromPropertyType(propertyType: ListingCard["property_type"]): string | null {
  if (propertyType === "flat") return "pisos";
  if (propertyType === "house") return "casas";
  if (propertyType === "office") return "oficinas";
  if (propertyType === "land") return "terrenos";
  return null;
}

function requestedResources(criteria: NormalizedFilters): string[] {
  if (criteria.property_types.length === 0) {
    return ["pisos", "casas"];
  }

  const resources = criteria.property_types
    .map((propertyType) => resourceFromPropertyType(propertyType))
    .filter((value): value is string => value !== null);

  if (resources.length === 0) {
    return ["pisos", "casas"];
  }

  return uniqueStrings(resources);
}

function buildCandidatePaths(criteria: NormalizedFilters): string[] {
  if (!criteria.city) {
    return [];
  }

  const operationPrefix = criteria.transaction_type === "rent" ? "alquiler-" : "";
  const resources = requestedResources(criteria);
  const slugUnderscore = toHabitacliaCitySlug(criteria.city);
  const slugHyphen = slugify(criteria.city);
  const paths: string[] = [];

  for (const resource of resources) {
    paths.push(`/${operationPrefix}${resource}-${slugUnderscore}.htm`);
    if (slugHyphen !== slugUnderscore) {
      paths.push(`/${operationPrefix}${resource}-${slugHyphen}.htm`);
    }
  }

  return uniqueStrings(paths);
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const regex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(["'])([\s\S]*?)\2/g;

  for (const match of tag.matchAll(regex)) {
    const key = match[1]?.toLowerCase();
    const value = match[3];
    if (!key || value === undefined) {
      continue;
    }

    attributes[key] = decodeHtmlEntities(value);
  }

  return attributes;
}

function listItemSlices(html: string): ListingSlice[] {
  const starts = Array.from(
    html.matchAll(/<article[^>]*class=["'][^"']*js-list-item[^"']*["'][^>]*>/gi)
  );
  const slices: ListingSlice[] = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    if (!start) {
      continue;
    }
    const openingTag = start[0];
    const startIndex = start.index;
    if (!openingTag || startIndex === undefined) {
      continue;
    }

    const next = starts[index + 1];
    const nextIndex = next?.index ?? html.length;
    if (nextIndex === undefined || nextIndex <= startIndex) {
      continue;
    }

    slices.push({
      openingTag,
      html: html.slice(startIndex, nextIndex)
    });
  }

  return slices;
}

function readFirstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  return stripTags(decodeHtmlEntities(match[1]));
}

function extractListingId(url: URL, slice: ListingSlice): string {
  const tagAttrs = parseAttributes(slice.openingTag);
  const fromTag = tagAttrs["data-id"];
  if (fromTag && /^\d+$/.test(fromTag)) {
    return fromTag;
  }

  const fromSnippet = readFirstMatch(slice.html, /data-codanuncio=["'](\d+)["']/i);
  if (fromSnippet && /^\d+$/.test(fromSnippet)) {
    return fromSnippet;
  }

  const fromUrl = url.pathname.match(/-i(\d+)\.htm/i)?.[1];
  if (fromUrl) {
    return fromUrl;
  }

  return slugify(url.pathname).replace(/-/g, "_") || `anon_${Date.now()}`;
}

function normalizeCityToken(token: string): string {
  return token
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cityFromUrl(url: URL, fallbackCity: string): string {
  const match = url.pathname.toLowerCase().match(/-([a-z0-9_]+)-i\d+\.htm/i);
  if (!match?.[1]) {
    return fallbackCity;
  }

  const parsed = normalizeCityToken(match[1]);
  return parsed.length > 0 ? parsed : fallbackCity;
}

function propertyTypeFromSubtype(
  listingSubtype: string | undefined,
  listingType: string | undefined,
  title: string
): ListingCard["property_type"] {
  const normalized = `${listingSubtype ?? ""} ${listingType ?? ""}`.toUpperCase();
  if (normalized.includes("OFFICE")) return "office";
  if (/(LAND|PLOT|RUSTIC|SOIL|SOLAR|TERRENO)/.test(normalized)) return "land";
  if (/(FLAT|APARTMENT|PENTHOUSE|STUDIO|LOFT|DUPLEX)/.test(normalized)) return "flat";
  if (/(HOUSE|CHALET|VILLA|SINGLE_FAMILY|PAIRED|SEMI|RURAL|TOWNHOUSE)/.test(normalized)) {
    return "house";
  }

  return inferPropertyTypeFromText(title);
}

function extractImageUrl(sliceHtml: string, baseUrl: string): string | null {
  const imageTag = sliceHtml.match(/<img[^>]*itemprop=["']image["'][^>]*>/i)?.[0];
  if (!imageTag) {
    return null;
  }

  const raw = parseAttributes(imageTag).src;
  if (!raw) {
    return null;
  }

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  return toAbsoluteUrl(raw, baseUrl);
}

function toListingCard(
  slice: ListingSlice,
  criteria: NormalizedFilters,
  baseUrl: string,
  lastSeenAt: string
): ListingCard | null {
  const attrs = parseAttributes(slice.openingTag);
  const hrefRaw =
    attrs["data-href"] ||
    readFirstMatch(slice.html, /<a[^>]*itemprop=["']name["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  if (!hrefRaw) {
    return null;
  }

  const detailUrl = new URL(toAbsoluteUrl(hrefRaw, baseUrl));
  const listingId = extractListingId(detailUrl, slice);
  const title =
    readFirstMatch(slice.html, /<a[^>]*itemprop=["']name["'][^>]*>([\s\S]*?)<\/a>/i) ??
    `Inmueble ${listingId}`;
  const imageUrl = extractImageUrl(slice.html, baseUrl);

  const priceFromAttr = readFirstMatch(slice.html, /data-pvp=["'](\d+)["']/i);
  const priceFromText = readFirstMatch(
    slice.html,
    /<span[^>]*class=["'][^"']*font-2[^"']*["'][^>]*>([^<]+)<\/span>/i
  );
  const price =
    (priceFromAttr ? parsePriceNumber(priceFromAttr) : null) ??
    parsePriceNumber(priceFromText);

  const roomsFromAttr = readFirstMatch(slice.html, /data-hab=["'](\d+)["']/i);
  const rooms =
    (roomsFromAttr ? parseFiniteNumber(roomsFromAttr) : null) ??
    parseRoomsFromText(title);
  const surfaceFromAttr = readFirstMatch(slice.html, /data-sup=["'](\d+)["']/i);
  const surface = surfaceFromAttr ? parseFiniteNumber(surfaceFromAttr) : null;
  const bedroomsLabel = rooms !== null ? `${rooms} habs.` : null;
  const surfaceLabel = surface !== null ? `${Math.round(surface)} m²` : null;

  const snippetText = stripTags(slice.html).replace(/\s+/g, " ").trim();
  const bathroomsMatch = snippetText.match(/(\d+)\s*ba(?:ñ|n)os?/i);
  const bathroomsLabel = bathroomsMatch?.[1] ? `${bathroomsMatch[1]} baños` : null;

  const propertyType = propertyTypeFromSubtype(attrs["data-propertysubtype"], attrs["data-propertytype"], title);
  const city = cityFromUrl(detailUrl, criteria.city ?? "Unknown");

  const description = [title, bathroomsLabel, surfaceLabel].filter(Boolean).join(" · ");
  const chars = [bedroomsLabel, bathroomsLabel, surfaceLabel].filter(
    (value): value is string => Boolean(value)
  );

  return {
    canonical_id: `habitaclia-${listingId}`,
    portal: "habitaclia",
    portal_listing_id: listingId,
    url: detailUrl.toString(),
    title,
    city,
    price_eur: price,
    rooms,
    property_type: propertyType,
    image_urls: imageUrl ? [imageUrl] : [],
    last_seen_at: lastSeenAt,
    score: 0,
    why_matched: [],
    description,
    tags: inferTagsFromDescription(`${title} ${description}`),
    capacity_people:
      propertyType === "office" && surface !== null ? Math.max(1, Math.floor(surface / 2.5)) : null,
    raw: {
      source_path: detailUrl.pathname,
      ...(priceFromText ? { price_raw: priceFromText } : {}),
      chars
    }
  };
}

export class HabitacliaConnector implements ConnectorAdapter {
  readonly portal = "habitaclia" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: HabitacliaConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? HABITACLIA_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 250;
    this.maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const warnings: string[] = [];
    const listingSeenAt = listingNowIso();
    const listings: ListingCard[] = [];

    const candidatePaths = buildCandidatePaths(criteria).slice(0, this.maxRequests);
    if (candidatePaths.length === 0) {
      warnings.push("No city provided; habitaclia requires city-specific paths and was skipped.");
      return {
        listings: [],
        diagnostics: {
          source: "scrape",
          connector_warnings: warnings
        }
      };
    }

    for (let index = 0; index < candidatePaths.length; index += 1) {
      const path = candidatePaths[index];
      if (!path) {
        continue;
      }

      if (index > 0) {
        await sleep(this.requestDelayMs);
      }

      const pageUrl = toAbsoluteUrl(path, this.baseUrl);
      const response = await this.fetchImpl(pageUrl, {
        headers: browserHeaders({
          requestDelayMs: this.requestDelayMs
        })
      });
      const html = await response.text();

      if (response.status === 429) {
        throw new ConnectorError("UPSTREAM_RATE_LIMIT", "habitaclia rate limited request.", true, "habitaclia");
      }

      if (response.status === 401 || response.status === 403) {
        throw new ConnectorError("UPSTREAM_BLOCKED", "habitaclia blocked automated access.", true, "habitaclia");
      }

      if (response.status >= 500) {
        throw new ConnectorError(
          "UPSTREAM_UNAVAILABLE",
          `habitaclia upstream unavailable (HTTP ${response.status}).`,
          true,
          "habitaclia"
        );
      }

      assertNotBotBlocked(html, "habitaclia");

      if (response.status >= 400) {
        warnings.push(`habitaclia request ${path} returned HTTP ${response.status}.`);
        continue;
      }

      const slices = listItemSlices(html);
      if (slices.length === 0) {
        warnings.push(`habitaclia returned no list items for ${path}.`);
        continue;
      }

      for (const slice of slices) {
        const listing = toListingCard(slice, criteria, this.baseUrl, listingSeenAt);
        if (!listing) {
          continue;
        }

        listings.push(listing);
        if (listings.length >= this.maxListings) {
          break;
        }
      }

      if (listings.length >= this.maxListings) {
        break;
      }
    }

    return {
      listings: uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`).slice(
        0,
        this.maxListings
      ),
      diagnostics: {
        source: "scrape",
        connector_warnings: uniqueStrings(warnings)
      }
    };
  }
}

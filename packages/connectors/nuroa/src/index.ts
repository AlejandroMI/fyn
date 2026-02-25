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
  type ConnectorAdapter,
  type ScraperOptions,
  uniqueBy,
  uniqueStrings
} from "@fyn/connectors-core";

const NUROA_BASE_URL = "https://www.nuroa.es";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 6;

const DISCOVERY_CITY_SLUGS = [
  "valencia",
  "madrid",
  "barcelona",
  "sevilla",
  "malaga",
  "bilbao",
  "zaragoza",
  "alicante"
] as const;

type Resource = "piso" | "casa" | "oficina" | "terreno";

export interface NuroaConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
  maxRequests?: number;
}

function modeSegment(criteria: NormalizedFilters): "venta" | "alquiler" {
  return criteria.transaction_type === "rent" ? "alquiler" : "venta";
}

function resourcesForPropertyType(propertyType: ListingCard["property_type"]): Resource[] {
  if (propertyType === "flat") return ["piso"];
  if (propertyType === "house") return ["casa"];
  if (propertyType === "office") return ["oficina"];
  if (propertyType === "land") return ["terreno"];
  return ["piso", "casa"];
}

function requestedResources(criteria: NormalizedFilters): Resource[] {
  if (criteria.property_types.length === 0) {
    return ["piso", "casa"];
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
      for (const citySlug of DISCOVERY_CITY_SLUGS) {
        paths.push(`/${mode}/${resource}-${citySlug}`);
      }
    }
    return uniqueStrings(paths);
  }

  const citySlug = slugify(criteria.city);
  if (!citySlug) {
    return [];
  }

  for (const resource of resources) {
    paths.push(`/${mode}/${resource}-${citySlug}`);
  }

  return uniqueStrings(paths);
}

function pathWithPage(path: string, page: number): string {
  if (page <= 1) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}page=${page}`;
}

function buildRequestPaths(basePaths: string[], maxRequests: number, maxPagesPerPath: number): string[] {
  const paths: string[] = [];
  for (const basePath of basePaths) {
    for (let page = 1; page <= maxPagesPerPath; page += 1) {
      paths.push(pathWithPage(basePath, page));
      if (paths.length >= maxRequests) {
        return paths;
      }
    }
  }

  return paths;
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

function deepDecodeURIComponent(value: string): string {
  let current = value;
  for (let iteration = 0; iteration < 5; iteration += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return current;
    }

    if (decoded === current) {
      return current;
    }

    current = decoded;
  }

  return current;
}

function extractListingUrl(rawHref: string, baseUrl: string): string {
  const decodedHref = decodeHtmlEntities(rawHref);
  const absoluteHref = toAbsoluteUrl(decodedHref, baseUrl);

  let parsedHref: URL;
  try {
    parsedHref = new URL(absoluteHref);
  } catch {
    return absoluteHref;
  }

  const directUrlParam = parsedHref.searchParams.get("url");
  if (directUrlParam) {
    const candidate = deepDecodeURIComponent(directUrlParam);
    if (/^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }

  const redirectUrlParam = parsedHref.searchParams.get("redirectUrl");
  if (!redirectUrlParam) {
    return parsedHref.toString();
  }

  const decodedRedirect = deepDecodeURIComponent(redirectUrlParam);

  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(decodedRedirect);
  } catch {
    return parsedHref.toString();
  }

  const nestedUrlParam = parsedRedirect.searchParams.get("url");
  if (nestedUrlParam) {
    const nested = deepDecodeURIComponent(nestedUrlParam);
    if (/^https?:\/\//i.test(nested)) {
      return nested;
    }
  }

  return parsedRedirect.toString();
}

function extractListingBlocks(html: string): string[] {
  const starts = Array.from(
    html.matchAll(/<div[^>]*class=["'][^"']*group\s+nu_row[^"']*["'][^>]*id=["']nu_flat_[^"']+["'][^>]*>/gi)
  )
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0);

  if (starts.length === 0) {
    return [];
  }

  const blocks: string[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index] as number;
    const end = index + 1 < starts.length ? (starts[index + 1] as number) : html.length;
    blocks.push(html.slice(start, end));
  }

  return blocks;
}

function inferPropertyType(
  url: URL,
  title: string,
  description: string
): ListingCard["property_type"] {
  const lowerPath = url.pathname.toLowerCase();

  if (/(?:\/|\b)(piso|apartamento|atico|d[úu]plex|loft)(?:\b|_)/i.test(lowerPath)) return "flat";
  if (/(?:\/|\b)(casa|chalet|adosad[ao]|paread[ao]|villa)(?:\b|_)/i.test(lowerPath)) return "house";
  if (/(?:\/|\b)(oficina|despacho|local)(?:\b|_)/i.test(lowerPath)) return "office";
  if (/(?:\/|\b)(terreno|solar|parcela|suelo)(?:\b|_)/i.test(lowerPath)) return "land";

  return inferPropertyTypeFromText(`${title} ${description}`);
}

function parseImageUrl(block: string, baseUrl: string): string | null {
  const src =
    block.match(/<img[^>]*class=["'][^"']*nu_list_image[^"']*["'][^>]*data-original=["']([^"']+)["']/i)?.[1] ??
    block.match(/<img[^>]*class=["'][^"']*nu_list_image[^"']*["'][^>]*src=["']([^"']+)["']/i)?.[1] ??
    block.match(/<img[^>]*class=["'][^"']*nu_list_image[^"']*["'][^>]*data-src=["']([^"']+)["']/i)?.[1] ??
    null;

  if (!src || /no_image/i.test(src)) {
    return null;
  }

  return toAbsoluteUrl(decodeHtmlEntities(src), baseUrl);
}

function buildImageIndex(html: string, baseUrl: string): Map<string, string> {
  const index = new Map<string, string>();
  const matches = Array.from(html.matchAll(/<img[^>]*id=["']ad-img-([^"']+)["'][^>]*>/gi));

  for (const match of matches) {
    const listingId = match[1];
    const tag = match[0] ?? "";
    const src =
      tag.match(/data-original=["']([^"']+)["']/i)?.[1] ??
      tag.match(/src=["']([^"']+)["']/i)?.[1] ??
      null;

    if (!listingId || !src || /no_image/i.test(src)) {
      continue;
    }

    index.set(listingId, toAbsoluteUrl(decodeHtmlEntities(src), baseUrl));
  }

  return index;
}

function parsePriceFromBlock(block: string): number | null {
  const contentPrice = block.match(/itemprop=["']price["'][^>]*content=["']([\d.]+)["']/i)?.[1];
  if (contentPrice) {
    const value = parseFiniteNumber(contentPrice.replace(/\./g, ""));
    if (value !== null) {
      return value;
    }
  }

  const priceRaw = stripTags(block.match(/<span[^>]*class=["'][^"']*nu_price[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  return parsePriceNumber(priceRaw);
}

function parseBathrooms(text: string): number | null {
  const match = text.match(/(\d+)\s*bañ(?:o|os)\b/i);
  if (!match?.[1]) {
    return null;
  }

  return parseFiniteNumber(match[1]);
}

function parseAreaM2(text: string): number | null {
  const match = text.match(/(\d+(?:[\.,]\d+)?)\s*m(?:2|²)\b/i);
  if (!match?.[1]) {
    return null;
  }

  return parseFiniteNumber(match[1].replace(/\./g, ""));
}

function toListingCard(
  block: string,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string,
  imageIndex: Map<string, string>
): ListingCard | null {
  const listingId = block.match(/id=["']nu_flat_([^"']+)["']/i)?.[1] ?? null;
  if (!listingId) {
    return null;
  }

  const href = block.match(/<a[^>]*class=["'][^"']*nu_adlink[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
  if (!href) {
    return null;
  }

  const resolvedUrl = extractListingUrl(href, baseUrl);
  const url = new URL(toAbsoluteUrl(resolvedUrl, baseUrl));

  const title = stripTags(
    block.match(/<h3[^>]*class=["'][^"']*nu_list_title[^"']*["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
      `Inmueble ${listingId}`
  );

  const city = stripTags(
    block.match(/<div[^>]*class=["'][^"']*nu_address_text[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
      criteria.city ??
      "Unknown"
  );

  const description = stripTags(
    block.match(/<div[^>]*itemprop=["']description["'][^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1] ?? ""
  );

  const rooms = parseRoomsFromText(`${title} ${description}`);
  const bathrooms = parseBathrooms(description);
  const areaM2 = parseAreaM2(description);
  const propertyType = inferPropertyType(url, title, description);
  const imageUrl = parseImageUrl(block, baseUrl) ?? imageIndex.get(listingId) ?? null;
  const priceEur = parsePriceFromBlock(block);

  const chars: string[] = [];
  if (rooms !== null) {
    chars.push(`${rooms} habs.`);
  }
  if (bathrooms !== null) {
    chars.push(`${bathrooms} baños`);
  }
  if (areaM2 !== null) {
    chars.push(`${Math.round(areaM2)} m²`);
  }

  return {
    canonical_id: `nuroa-${listingId}`,
    portal: "nuroa",
    portal_listing_id: listingId,
    url: url.toString(),
    title,
    city,
    price_eur: priceEur,
    rooms,
    property_type: propertyType,
    image_urls: imageUrl ? [imageUrl] : [],
    last_seen_at: seenAt,
    score: 0,
    why_matched: [],
    description,
    tags: inferTagsFromDescription(`${title} ${description}`),
    capacity_people:
      propertyType === "office" && areaM2 !== null ? Math.max(1, Math.floor(areaM2 / 2.5)) : null,
    raw: {
      source_path: url.pathname,
      chars,
      ...(bathrooms !== null ? { bathrooms } : {}),
      ...(areaM2 !== null ? { area_m2: areaM2 } : {})
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
  const blocks = extractListingBlocks(html);
  const imageIndex = buildImageIndex(html, baseUrl);

  for (const block of blocks) {
    const listing = toListingCard(block, criteria, baseUrl, seenAt, imageIndex);
    if (!listing) {
      continue;
    }

    listings.push(listing);
  }

  return uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);
}

function isErrorTemplate(html: string): boolean {
  return /<title>\s*Error\s*(?:404|500)\b/i.test(html);
}

export class NuroaConnector implements ConnectorAdapter {
  readonly portal = "nuroa" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: NuroaConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? NUROA_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 300;
    this.maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const basePaths = buildCandidatePaths(criteria);
    const requestPaths = buildRequestPaths(basePaths, this.maxRequests, criteria.city ? 2 : 1);

    if (requestPaths.length === 0) {
      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "nuroa has no candidate paths for the provided criteria.",
        true,
        "nuroa"
      );
    }

    const warnings: string[] = [];
    if (!criteria.city) {
      warnings.push("No city provided; using discovery scrape across nuroa major locations.");
    }

    const listings: ListingCard[] = [];
    const seenAt = listingNowIso();

    let blockedCount = 0;
    let rateLimitedCount = 0;

    for (const [index, path] of requestPaths.entries()) {
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
        warnings.push(`nuroa blocked path: ${path}`);
        continue;
      }

      if (response.status === 429) {
        rateLimitedCount += 1;
        warnings.push(`nuroa rate-limited path: ${path}`);
        continue;
      }

      if (response.status === 404) {
        warnings.push(`nuroa path not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        warnings.push(`nuroa request ${path} returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      if (isErrorTemplate(html)) {
        warnings.push(`nuroa error template on path: ${path}`);
        continue;
      }

      try {
        assertNotBotBlocked(html, "nuroa");
      } catch {
        blockedCount += 1;
        warnings.push(`nuroa anti-bot challenge on path: ${path}`);
        continue;
      }

      const parsed = parseListings(html, criteria, this.baseUrl, seenAt);
      if (parsed.length === 0) {
        warnings.push(`nuroa returned no listing cards on path: ${path}`);
        continue;
      }

      listings.push(...parsed);
      if (listings.length >= this.maxListings) {
        break;
      }
    }

    const uniqueListings = uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);

    if (uniqueListings.length === 0) {
      if (rateLimitedCount === requestPaths.length) {
        throw new ConnectorError("UPSTREAM_RATE_LIMIT", "nuroa rate-limited all candidate requests.", true, "nuroa");
      }

      if (blockedCount === requestPaths.length) {
        throw new ConnectorError(
          "UPSTREAM_BLOCKED",
          "nuroa blocked automated access for all candidate paths.",
          true,
          "nuroa"
        );
      }

      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "nuroa returned no usable listings for the provided criteria.",
        true,
        "nuroa"
      );
    }

    let selected = uniqueListings;
    if (criteria.city) {
      const strictMatches = uniqueListings.filter((listing) => cityMatches(listing.city, criteria.city as string));
      if (strictMatches.length > 0) {
        selected = strictMatches;
      } else {
        warnings.push(`No strict city matches for "${criteria.city}" on nuroa; returning broader listing set.`);
      }
    }

    return {
      listings: selected.slice(0, this.maxListings),
      diagnostics: {
        source: "scrape",
        connector_warnings: uniqueStrings(warnings)
      }
    };
  }
}

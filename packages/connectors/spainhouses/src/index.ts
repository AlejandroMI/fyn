import {
  ConnectorError,
  type ConnectorSearchResult,
  type ListingCard,
  type NormalizedFilters
} from "@fyn/domain";
import {
  assertNotBotBlocked,
  browserHeaders,
  browserUserAgents,
  decodeHtmlEntities,
  inferPropertyTypeFromText,
  inferTagsFromDescription,
  listingNowIso,
  looksLikeBotBlockPage,
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

const SPAINHOUSES_BASE_URL = "https://www.spainhouses.net";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 8;
const MAX_FETCH_ATTEMPTS_PER_PATH = 2;
const RETRY_BACKOFF_MS = 600;

const DISCOVERY_CITY_SLUGS = ["valencia", "madrid", "barcelona", "malaga", "alicante", "sevilla"] as const;

const CITY_PROVINCE_OVERRIDES: Record<string, string> = {
  valencia: "valencia",
  madrid: "madrid",
  barcelona: "barcelona",
  malaga: "malaga",
  sevilla: "sevilla",
  bilbao: "vizcaya",
  ronda: "malaga",
  "cangas-de-onis": "asturias",
  albarracin: "teruel",
  cudillero: "asturias",
  grazalema: "cadiz",
  ainsa: "huesca",
  "ainsa-sobrarbe": "huesca",
  naquera: "valencia",
  requena: "valencia",
  bunol: "valencia",
  potes: "cantabria",
  riano: "leon"
};

type Resource = "viviendas" | "pisos" | "casas" | "oficinas" | "terrenos";

export interface SpainhousesConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
  maxRequests?: number;
}

function modeSegment(criteria: NormalizedFilters): "venta" | "alquiler" {
  return criteria.transaction_type === "rent" ? "alquiler" : "venta";
}

function resourceForPropertyType(propertyType: ListingCard["property_type"]): Resource[] {
  if (propertyType === "flat") return ["pisos"];
  if (propertyType === "house") return ["casas"];
  if (propertyType === "office") return ["oficinas"];
  if (propertyType === "land") return ["terrenos"];
  return ["viviendas"];
}

function requestedResources(criteria: NormalizedFilters): Resource[] {
  if (criteria.property_types.length === 0) {
    return ["viviendas"];
  }

  const resources = criteria.property_types.flatMap((propertyType) => resourceForPropertyType(propertyType));
  return uniqueStrings(resources) as Resource[];
}

function buildCandidatePaths(criteria: NormalizedFilters): string[] {
  const mode = modeSegment(criteria);
  const resources = requestedResources(criteria);
  const localeSegment = criteria.locale === "en" ? "en" : "es";
  const paths: string[] = [];

  if (!criteria.city) {
    for (const resource of resources) {
      for (const citySlug of DISCOVERY_CITY_SLUGS) {
        paths.push(`/${localeSegment}/${mode}-${resource}-${citySlug}.html`);
      }
    }

    return uniqueStrings(paths);
  }

  const citySlug = slugify(criteria.city);
  if (!citySlug) {
    return [];
  }

  const provinceSlug = CITY_PROVINCE_OVERRIDES[citySlug];

  for (const resource of resources) {
    paths.push(`/${localeSegment}/${mode}-${resource}-${citySlug}.html`);

    if (provinceSlug) {
      paths.push(`/${localeSegment}/${mode}-${resource}-${citySlug}-${provinceSlug}.html`);
      if (criteria.nearby_towns) {
        paths.push(`/${localeSegment}/${mode}-${resource}-${provinceSlug}.html`);
      }
    }
  }

  return uniqueStrings(paths);
}

function pathWithPage(path: string, page: number): string {
  if (page <= 1) {
    return path;
  }

  if (path.endsWith(".html")) {
    const root = path.slice(0, -5);
    return `${root}/pagina-${page}.html`;
  }

  return `${path}/pagina-${page}.html`;
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

function extractListingBlocks(html: string): string[] {
  const starts = Array.from(
    html.matchAll(/<article[^>]*class=["'][^"']*property_block[^"']*["'][^>]*>/gi)
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

function parseImageUrl(block: string, baseUrl: string): string | null {
  const candidate =
    block.match(/<img[^>]*data-src=["']([^"']+)["'][^>]*class=["'][^"']*slide-content[^"']*["']/i)?.[1] ??
    block.match(/<img[^>]*class=["'][^"']*slide-content[^"']*["'][^>]*data-src=["']([^"']+)["']/i)?.[1] ??
    null;

  if (!candidate || /pix\.gif/i.test(candidate)) {
    return null;
  }

  return toAbsoluteUrl(decodeHtmlEntities(candidate), baseUrl);
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

function inferPropertyTypeFromPath(pathname: string, fallbackText: string): ListingCard["property_type"] {
  const lower = pathname.toLowerCase();

  if (/(?:venta|alquiler)-pisos/.test(lower) || /apartamento|piso|atico|duplex|loft/.test(lower)) return "flat";
  if (/(?:venta|alquiler)-casas/.test(lower) || /casa|chalet|villa|adosad/.test(lower)) return "house";
  if (/(?:venta|alquiler)-oficinas/.test(lower) || /oficina|local/.test(lower)) return "office";
  if (/(?:venta|alquiler)-terrenos/.test(lower) || /terreno|solar|parcela|suelo/.test(lower)) return "land";

  return inferPropertyTypeFromText(fallbackText);
}

function toListingCard(
  block: string,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string
): ListingCard | null {
  const listingId =
    block.match(/data-position=["']([^"']+)["']/i)?.[1] ??
    block.match(/data-id=["']([^"']+)["']/i)?.[1] ??
    null;

  if (!listingId) {
    return null;
  }

  const href =
    block.match(/data-href=["']([^"']+)["']/i)?.[1] ??
    block.match(/<a[^>]*href=["']([^"']+)["'][^>]*data-position=["'][^"']+["']/i)?.[1] ??
    null;

  if (!href) {
    return null;
  }

  const url = new URL(toAbsoluteUrl(decodeHtmlEntities(href), baseUrl));

  const titleMain = stripTags(block.match(/<div[^>]*class=["'][^"']*title_1[^"']*["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
  const titleTail = stripTags(block.match(/<span[^>]*class=["'][^"']*titleTail[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const title = `${titleMain}${titleTail}`.trim() || `Inmueble ${listingId}`;

  const city = stripTags(
    block.match(/<div[^>]*class=["'][^"']*title_2[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
      criteria.city ??
      "Unknown"
  );

  const features = stripTags(block.match(/<div[^>]*class=["'][^"']*features[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const description = stripTags(block.match(/<div[^>]*class=["'][^"']*descTxt[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const priceRaw = stripTags(block.match(/<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");

  const rooms = parseRoomsFromText(`${features} ${title} ${description}`);
  const bathrooms = parseBathrooms(`${features} ${description}`);
  const areaM2 = parseAreaM2(`${features} ${description}`);
  const imageUrl = parseImageUrl(block, baseUrl);

  const propertyType = inferPropertyTypeFromPath(url.pathname, `${title} ${features} ${description}`);

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
    canonical_id: `spainhouses-${listingId}`,
    portal: "spainhouses",
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
    capacity_people: propertyType === "office" && areaM2 !== null ? Math.max(1, Math.floor(areaM2 / 2.5)) : null,
    raw: {
      source_path: url.pathname,
      ...(priceRaw ? { price_raw: `${priceRaw} €` } : {}),
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

  for (const block of blocks) {
    const listing = toListingCard(block, criteria, baseUrl, seenAt);
    if (!listing) {
      continue;
    }

    listings.push(listing);
  }

  return uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);
}

function isErrorTemplate(html: string): boolean {
  return /<title>\s*(?:Error|Not Found)\b/i.test(html);
}

function isRetriableStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && /fetch timeout/i.test(error.message);
}

async function fetchPathWithRetries(
  fetchImpl: typeof fetch,
  url: URL,
  baseUrl: string,
  requestDelayMs: number
): Promise<{ response: Response; html: string }> {
  const userAgents = browserUserAgents();
  const maxAttempts = Math.max(1, Math.min(MAX_FETCH_ATTEMPTS_PER_PATH, userAgents.length));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const userAgent = userAgents[attempt % userAgents.length] ?? userAgents[0] ?? "";
    try {
      const response = await fetchImpl(url, {
        headers: {
          ...browserHeaders({
            requestDelayMs,
            userAgent
          }),
          Referer: `${baseUrl}/`
        }
      });
      const html = await response.text();
      const retriable = isRetriableStatus(response.status) || looksLikeBotBlockPage(html);
      if (!retriable || attempt >= maxAttempts - 1) {
        return { response, html };
      }
    } catch (error) {
      if (isTimeoutError(error) || attempt >= maxAttempts - 1) {
        throw error;
      }
    }

    await sleep(Math.max(requestDelayMs, RETRY_BACKOFF_MS) * (attempt + 1));
  }

  throw new Error(`spainhouses exhausted retry attempts for ${url.toString()}`);
}

export class SpainhousesConnector implements ConnectorAdapter {
  readonly portal = "spainhouses" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: SpainhousesConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? SPAINHOUSES_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 300;
    this.maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const basePaths = buildCandidatePaths(criteria);
    const maxPagesPerPath = criteria.city ? 2 : 1;
    const requestPaths = buildRequestPaths(basePaths, this.maxRequests, maxPagesPerPath);

    if (requestPaths.length === 0) {
      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "spainhouses has no candidate paths for the provided criteria.",
        true,
        "spainhouses"
      );
    }

    const warnings: string[] = [];
    if (!criteria.city) {
      warnings.push("No city provided; using discovery scrape across spainhouses major locations.");
    }

    const listings: ListingCard[] = [];
    const seenAt = listingNowIso();

    let blockedCount = 0;
    let rateLimitedCount = 0;
    let unavailableCount = 0;

    for (const [index, path] of requestPaths.entries()) {
      if (index > 0) {
        await sleep(this.requestDelayMs);
      }

      let response: Response;
      let html = "";
      try {
        const fetched = await fetchPathWithRetries(
          this.fetchImpl,
          new URL(path, this.baseUrl),
          this.baseUrl,
          this.requestDelayMs
        );
        response = fetched.response;
        html = fetched.html;
      } catch (error) {
        unavailableCount += 1;
        warnings.push(
          `spainhouses request failed on ${path}: ${
            isTimeoutError(error) ? "timeout" : error instanceof Error ? error.message : String(error)
          }`
        );
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        blockedCount += 1;
        warnings.push(`spainhouses blocked path: ${path}`);
        continue;
      }

      if (response.status === 429) {
        rateLimitedCount += 1;
        warnings.push(`spainhouses rate-limited path: ${path}`);
        continue;
      }

      if (response.status === 404) {
        warnings.push(`spainhouses path not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        warnings.push(`spainhouses request ${path} returned HTTP ${response.status}`);
        continue;
      }

      if (isErrorTemplate(html)) {
        warnings.push(`spainhouses error template on path: ${path}`);
        continue;
      }

      try {
        assertNotBotBlocked(html, "spainhouses");
      } catch {
        blockedCount += 1;
        warnings.push(`spainhouses anti-bot challenge on path: ${path}`);
        continue;
      }

      const parsed = parseListings(html, criteria, this.baseUrl, seenAt);
      if (parsed.length === 0) {
        warnings.push(`spainhouses returned no listing cards on path: ${path}`);
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
        throw new ConnectorError(
          "UPSTREAM_RATE_LIMIT",
          "spainhouses rate-limited all candidate requests.",
          true,
          "spainhouses"
        );
      }

      if (blockedCount === requestPaths.length) {
        throw new ConnectorError(
          "UPSTREAM_BLOCKED",
          "spainhouses blocked automated access for all candidate paths.",
          true,
          "spainhouses"
        );
      }

      if (unavailableCount === requestPaths.length) {
        throw new ConnectorError(
          "UPSTREAM_UNAVAILABLE",
          "spainhouses unavailable for all candidate requests.",
          true,
          "spainhouses"
        );
      }

      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "spainhouses returned no usable listings for the provided criteria.",
        true,
        "spainhouses"
      );
    }

    let selected = uniqueListings;
    if (criteria.city) {
      const strictMatches = uniqueListings.filter((listing) => cityMatches(listing.city, criteria.city as string));
      if (strictMatches.length > 0) {
        selected = strictMatches;
      } else {
        warnings.push(`No strict city matches for "${criteria.city}" on spainhouses; returning broader listing set.`);
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

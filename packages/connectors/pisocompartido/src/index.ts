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

const PISOCOMPARTIDO_BASE_URL = "https://www.pisocompartido.com";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 6;

const DISCOVERY_ROUTES = [
  "valencia_capital_zona_urbana",
  "madrid_capital_zona_urbana",
  "barcelona_capital",
  "malaga_capital_zona_urbana",
  "sevilla_capital",
  "bilbao"
];

const CITY_ROUTE_OVERRIDES: Record<string, string> = {
  valencia: "valencia_capital_zona_urbana",
  madrid: "madrid_capital_zona_urbana",
  barcelona: "barcelona_capital",
  malaga: "malaga_capital_zona_urbana",
  sevilla: "sevilla_capital",
  zaragoza: "zaragoza_capital",
  bilbao: "bilbao"
};

export interface PisoCompartidoConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
  maxRequests?: number;
}

interface ParsedLdData {
  description?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  imageUrls: string[];
}

function normalizeCity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cityMatches(listingCity: string, requestedCity: string): boolean {
  const city = normalizeCity(listingCity);
  const target = normalizeCity(requestedCity);
  if (!target) {
    return true;
  }

  return city.includes(target);
}

function routeSlugForCity(city: string): string {
  const slug = slugify(city).replace(/-/g, "_");
  return CITY_ROUTE_OVERRIDES[slug] ?? slug;
}

function buildBasePaths(criteria: NormalizedFilters): string[] {
  if (!criteria.city) {
    return DISCOVERY_ROUTES.map((route) => `/alquiler-habitaciones-${route}/`);
  }

  const route = routeSlugForCity(criteria.city);
  const candidates = [
    route,
    `${route}_capital_zona_urbana`,
    `${route}_capital`,
    `${route}_zona_urbana`
  ];

  return uniqueStrings(candidates.map((candidate) => `/alquiler-habitaciones-${candidate}/`));
}

function buildRequestPaths(basePaths: string[], maxRequests: number, hasCity: boolean): string[] {
  const paths: string[] = [];
  const maxPagesPerPath = hasCity ? 2 : 1;

  for (const basePath of basePaths) {
    for (let page = 1; page <= maxPagesPerPath; page += 1) {
      const path = page === 1 ? basePath : `${basePath}?page=${page}`;
      paths.push(path);
      if (paths.length >= maxRequests) {
        return paths;
      }
    }
  }

  return paths;
}

function extractListingBlocks(html: string): string[] {
  return (
    html.match(
      /<div id="h\d+" class="\s*card">[\s\S]*?(?=<div id="h\d+" class="\s*card">|<div class="cCardsFooter"|<script id="subscribedataLayer"|<\/body>)/gi
    ) ?? []
  );
}

function extractListingId(block: string): string | null {
  return block.match(/<div id="h(\d+)" class="\s*card">/i)?.[1] ?? null;
}

function parseImageUrls(block: string, baseUrl: string): string[] {
  const urls = Array.from(block.matchAll(/data-lazybg=["']([^"']+)["']/gi))
    .map((match) => match[1])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .filter((value) => !/\/css\/img\/1x1\.png/i.test(value))
    .map((value) => toAbsoluteUrl(value, baseUrl));

  return uniqueStrings(urls);
}

function parseLdData(block: string, baseUrl: string): ParsedLdData {
  const scripts = Array.from(block.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi));
  const imageUrls: string[] = [];

  let description: string | undefined;
  let city: string | undefined;
  let latitude: number | undefined;
  let longitude: number | undefined;

  for (const script of scripts) {
    const raw = script[1]?.trim();
    if (!raw) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    if (typeof parsed !== "object" || parsed === null) {
      continue;
    }

    const root = parsed as Record<string, unknown>;
    const graph = Array.isArray(root["@graph"])
      ? (root["@graph"] as Array<Record<string, unknown>>)
      : [root];

    const product = graph.find((item) => item?.["@type"] === "Product") ?? null;
    const residence = graph.find((item) => item?.["@type"] === "Residence") ?? null;

    const productDescription =
      product && typeof product.description === "string" ? stripTags(product.description) : undefined;
    const residenceDescription =
      residence && typeof residence.description === "string" ? stripTags(residence.description) : undefined;

    if (!description) {
      description = productDescription ?? residenceDescription;
    }

    if (!city && residence && typeof residence.address === "object" && residence.address !== null) {
      const address = residence.address as Record<string, unknown>;
      if (typeof address.addressLocality === "string") {
        city = stripTags(address.addressLocality);
      }
    }

    if (
      (latitude === undefined || longitude === undefined) &&
      residence &&
      typeof residence.geo === "object" &&
      residence.geo !== null
    ) {
      const geo = residence.geo as Record<string, unknown>;
      if (latitude === undefined) {
        latitude = parseFiniteNumber(geo.latitude) ?? undefined;
      }
      if (longitude === undefined) {
        longitude = parseFiniteNumber(geo.longitude) ?? undefined;
      }
    }

    if (product && typeof product.image === "string") {
      imageUrls.push(toAbsoluteUrl(product.image, baseUrl));
    }

    if (residence && Array.isArray(residence.photo)) {
      for (const photo of residence.photo) {
        if (typeof photo !== "object" || photo === null) {
          continue;
        }

        const imageObject = photo as Record<string, unknown>;
        if (typeof imageObject.contentUrl === "string") {
          imageUrls.push(toAbsoluteUrl(imageObject.contentUrl, baseUrl));
        }
      }
    }
  }

  return {
    ...(description ? { description } : {}),
    ...(city ? { city } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    imageUrls: uniqueStrings(imageUrls)
  };
}

function inferPropertyType(title: string, description: string): ListingCard["property_type"] {
  const inferred = inferPropertyTypeFromText(`${title} ${description}`);
  if (inferred) {
    return inferred;
  }

  if (/habitaci[oó]n/i.test(title)) {
    return "flat";
  }

  return null;
}

function toListingCard(
  block: string,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string
): ListingCard | null {
  const listingId = extractListingId(block);
  if (!listingId) {
    return null;
  }

  const href =
    block.match(/<a[^>]*class=["'][^"']*linkCard[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? null;
  if (!href) {
    return null;
  }

  const url = new URL(toAbsoluteUrl(href, baseUrl));

  const titleRaw = block.match(/<h6 class="textoTipo">([\s\S]*?)<\/h6>/i)?.[1] ?? "Habitación";
  const title = stripTags(titleRaw);

  const priceRaw = block.match(/<span class="contPrecio">([\s\S]*?)<\/span>/i)?.[1] ?? "";
  const locationRaw = block.match(/<div class="contLocalizacion">\s*<h5>([\s\S]*?)<\/h5>/i)?.[1] ?? "";

  const ldData = parseLdData(block, baseUrl);
  const description = ldData.description ?? "";

  const imageUrls = uniqueStrings([...parseImageUrls(block, baseUrl), ...ldData.imageUrls]);
  const location = stripTags(locationRaw);
  const city = location.length > 0 ? location : ldData.city ?? criteria.city ?? "Unknown";

  const propertyType = inferPropertyType(title, description);
  const rooms = /habitaci[oó]n/i.test(title)
    ? 1
    : parseRoomsFromText(`${title} ${description} ${location}`);

  const tags = inferTagsFromDescription(`${title} ${description} ${location}`);

  const chars: string[] = [];
  if (rooms !== null) {
    chars.push(`${rooms} hab.`);
  }
  if (/habitaci[oó]n\s+doble/i.test(title)) {
    chars.push("Habitación doble");
  }

  return {
    canonical_id: `pisocompartido-${listingId}`,
    portal: "pisocompartido",
    portal_listing_id: listingId,
    url: url.toString(),
    title,
    city,
    price_eur: parsePriceNumber(priceRaw),
    rooms,
    property_type: propertyType,
    image_urls: imageUrls,
    last_seen_at: seenAt,
    score: 0,
    why_matched: [],
    description,
    tags,
    capacity_people: null,
    raw: {
      source_path: url.pathname,
      ...(priceRaw ? { price_raw: stripTags(priceRaw) } : {}),
      chars,
      ...(ldData.latitude !== undefined ? { latitude: ldData.latitude } : {}),
      ...(ldData.longitude !== undefined ? { longitude: ldData.longitude } : {})
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

function isNotFoundPage(html: string): boolean {
  return /error\s*404|\/no_encontrado\/|virtualPageName':\s*'\/error404/i.test(html);
}

function isSupportedCriteria(criteria: NormalizedFilters): { supported: boolean; reason?: string } {
  if (criteria.transaction_type && criteria.transaction_type !== "rent") {
    return {
      supported: false,
      reason: "pisocompartido only supports rent workflows (room/shared-flat inventory)."
    };
  }

  if (criteria.property_types.length === 0) {
    return { supported: true };
  }

  const allowed = criteria.property_types.some((propertyType) => propertyType === "flat" || propertyType === "house");
  if (!allowed) {
    return {
      supported: false,
      reason: "pisocompartido only supports flat/house rental contexts."
    };
  }

  return { supported: true };
}

export class PisoCompartidoConnector implements ConnectorAdapter {
  readonly portal = "pisocompartido" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: PisoCompartidoConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? PISOCOMPARTIDO_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 300;
    this.maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const supportCheck = isSupportedCriteria(criteria);
    if (!supportCheck.supported) {
      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        supportCheck.reason ?? "pisocompartido cannot satisfy these constraints.",
        false,
        "pisocompartido"
      );
    }

    const basePaths = buildBasePaths(criteria);
    const requestPaths = buildRequestPaths(basePaths, this.maxRequests, Boolean(criteria.city));

    if (requestPaths.length === 0) {
      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "pisocompartido has no candidate paths for the provided criteria.",
        true,
        "pisocompartido"
      );
    }

    const warnings: string[] = [];
    const listings: ListingCard[] = [];
    const seenAt = listingNowIso();

    let blockedCount = 0;
    let rateLimitedCount = 0;

    if (!criteria.city) {
      warnings.push("No city provided; using discovery scrape across pisocompartido major routes.");
    }

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
        warnings.push(`pisocompartido blocked path: ${path}`);
        continue;
      }

      if (response.status === 429) {
        rateLimitedCount += 1;
        warnings.push(`pisocompartido rate-limited path: ${path}`);
        continue;
      }

      if (response.status === 404) {
        warnings.push(`pisocompartido path not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        warnings.push(`pisocompartido request ${path} returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();

      if (isNotFoundPage(html)) {
        warnings.push(`pisocompartido path not found: ${path}`);
        continue;
      }

      try {
        assertNotBotBlocked(html, "pisocompartido");
      } catch {
        blockedCount += 1;
        warnings.push(`pisocompartido anti-bot challenge on path: ${path}`);
        continue;
      }

      const parsed = parseListings(html, criteria, this.baseUrl, seenAt);
      if (parsed.length === 0) {
        warnings.push(`pisocompartido returned no listing cards on path: ${path}`);
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
          "pisocompartido rate-limited all candidate requests.",
          true,
          "pisocompartido"
        );
      }

      if (blockedCount === requestPaths.length) {
        throw new ConnectorError(
          "UPSTREAM_BLOCKED",
          "pisocompartido blocked automated access for all candidate paths.",
          true,
          "pisocompartido"
        );
      }

      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "pisocompartido returned no usable listings for the provided criteria.",
        true,
        "pisocompartido"
      );
    }

    let selected = uniqueListings;
    if (criteria.city) {
      const strictMatches = uniqueListings.filter((listing) => cityMatches(listing.city, criteria.city as string));
      if (strictMatches.length > 0) {
        selected = strictMatches;
      } else {
        warnings.push(
          `No strict city matches for "${criteria.city}" on pisocompartido; returning broader listing set.`
        );
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

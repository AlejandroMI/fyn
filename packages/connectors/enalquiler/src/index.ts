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

const ENALQUILER_BASE_URL = "https://www.enalquiler.com";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 8;

type CategoryCode = 2 | 7;
type CategorySegment = "pisos" | "casas";

interface Category {
  code: CategoryCode;
  segment: CategorySegment;
}

interface DiscoverySeed {
  slug: string;
  province: number;
  location: number;
}

interface LocationSuggestion {
  type?: string;
  name?: string;
  province?: number;
  location?: number;
  quantity?: number;
}

interface ResolveLocationResult {
  slug: string;
  province: number;
  location?: number;
}

const DISCOVERY_SEEDS: DiscoverySeed[] = [
  { slug: "valencia", province: 48, location: 50692 },
  { slug: "madrid", province: 30, location: 27745 },
  { slug: "barcelona", province: 9, location: 4596 },
  { slug: "sevilla", province: 43, location: 46424 },
  { slug: "malaga", province: 31, location: 27903 },
  { slug: "bilbao", province: 50, location: 6419 }
];

const CITY_ROUTE_OVERRIDES: Record<string, ResolveLocationResult> = {
  valencia: { slug: "valencia", province: 48, location: 50692 },
  madrid: { slug: "madrid", province: 30, location: 27745 },
  barcelona: { slug: "barcelona", province: 9, location: 4596 },
  sevilla: { slug: "sevilla", province: 43, location: 46424 },
  malaga: { slug: "malaga", province: 31, location: 27903 },
  bilbao: { slug: "bilbao", province: 50, location: 6419 },
  zaragoza: { slug: "zaragoza", province: 52, location: 55267 },
  ronda: { slug: "ronda", province: 31, location: 41961 },
  cudillero: { slug: "cudillero", province: 5, location: 16916 },
  ainsa: { slug: "ainsa", province: 25, location: 805 },
  "ainsa-sobrarbe": { slug: "ainsa", province: 25, location: 805 },
  albarracin: { slug: "albarracin", province: 46 },
  grazalema: { slug: "grazalema", province: 13 },
  "cangas-de-onis": { slug: "cangas-de-onis", province: 7 }
};

const CATEGORY_DEFINITIONS: Record<CategoryCode, Category> = {
  2: { code: 2, segment: "pisos" },
  7: { code: 7, segment: "casas" }
};

export interface EnalquilerConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
  maxRequests?: number;
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

function categoriesForCriteria(criteria: NormalizedFilters): {
  supported: boolean;
  categories: Category[];
  reason?: string;
} {
  if (criteria.transaction_type && criteria.transaction_type !== "rent") {
    return {
      supported: false,
      categories: [],
      reason: "enalquiler only supports rent workflows."
    };
  }

  if (criteria.property_types.length === 0) {
    return { supported: true, categories: [CATEGORY_DEFINITIONS[2], CATEGORY_DEFINITIONS[7]] };
  }

  const requested = new Set(criteria.property_types);
  const categories: Category[] = [];

  if (requested.has("flat")) {
    categories.push(CATEGORY_DEFINITIONS[2]);
  }
  if (requested.has("house")) {
    categories.push(CATEGORY_DEFINITIONS[7]);
  }

  if (categories.length === 0) {
    return {
      supported: false,
      categories: [],
      reason: "enalquiler supports flat/house rental contexts only."
    };
  }

  return {
    supported: true,
    categories: uniqueBy(categories, (category) => String(category.code))
  };
}

function routeForCategory(
  category: Category,
  location: ResolveLocationResult,
  includeLocation: boolean
): string {
  const base = `/alquiler-${category.segment}-${location.slug}-${location.province}-${category.code}-0`;
  return includeLocation && location.location ? `${base}-${location.location}.html` : `${base}.html`;
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

function decodeLegacyJsonText(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function parseSuggestResponse(raw: string): LocationSuggestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeLegacyJsonText(raw));
  } catch {
    return [];
  }

  if (typeof parsed !== "object" || parsed === null) {
    return [];
  }

  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.suggestions)) {
    return [];
  }

  return root.suggestions
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const province = parseFiniteNumber(item.province);
      const location = parseFiniteNumber(item.location);
      const quantity = parseFiniteNumber(item.quantity);

      return {
        ...(typeof item.type === "string" ? { type: item.type } : {}),
        ...(typeof item.name === "string" ? { name: item.name } : {}),
        ...(province !== null ? { province } : {}),
        ...(location !== null ? { location } : {}),
        ...(quantity !== null ? { quantity } : {})
      };
    });
}

function scoreSuggestion(
  suggestion: LocationSuggestion,
  citySlug: string,
  cityNormalized: string
): number {
  const type = suggestion.type?.toLowerCase() ?? "";
  const normalizedName = normalizeCity(suggestion.name ?? "");
  const slugName = slugify(suggestion.name ?? "");
  let score = 0;

  if (type === "city") {
    score += 200;
  } else if (type === "province") {
    score += 120;
  } else if (type === "district") {
    score += 40;
  }

  if (cityNormalized.length > 0 && normalizedName === cityNormalized) {
    score += 100;
  } else if (cityNormalized.length > 0 && normalizedName.startsWith(cityNormalized)) {
    score += 70;
  } else if (cityNormalized.length > 0 && normalizedName.includes(cityNormalized)) {
    score += 40;
  }

  if (citySlug.length > 0 && slugName === citySlug) {
    score += 60;
  }

  if (suggestion.quantity && Number.isFinite(suggestion.quantity)) {
    score += Math.min(40, Math.floor(suggestion.quantity / 20));
  }

  return score;
}

function bestSuggestion(
  suggestions: LocationSuggestion[],
  city: string
): LocationSuggestion | null {
  if (suggestions.length === 0) {
    return null;
  }

  const citySlug = slugify(city);
  const cityNormalized = normalizeCity(city);

  const sorted = [...suggestions].sort((a, b) => {
    const scoreA = scoreSuggestion(a, citySlug, cityNormalized);
    const scoreB = scoreSuggestion(b, citySlug, cityNormalized);
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    const quantityA = a.quantity ?? 0;
    const quantityB = b.quantity ?? 0;
    return quantityB - quantityA;
  });

  return sorted[0] ?? null;
}

function buildLocationFromSuggestion(city: string, suggestion: LocationSuggestion): ResolveLocationResult | null {
  if (suggestion.province === undefined || suggestion.province === null) {
    return null;
  }

  const citySlug = slugify(city);
  if (!citySlug) {
    return null;
  }

  const location = suggestion.location !== undefined && suggestion.location !== null ? suggestion.location : undefined;

  return {
    slug: citySlug,
    province: suggestion.province,
    ...(location ? { location } : {})
  };
}

function listingPropertyTypeFromUrl(url: URL, title: string, description: string): ListingCard["property_type"] {
  const lowerPath = url.pathname.toLowerCase();
  if (lowerPath.includes("/alquiler_casa_")) return "house";
  if (
    lowerPath.includes("/alquiler_piso_") ||
    lowerPath.includes("/alquiler_atico_") ||
    lowerPath.includes("/alquiler_duplex_") ||
    lowerPath.includes("/alquiler_estudio_") ||
    lowerPath.includes("/alquiler_loft_")
  ) {
    return "flat";
  }

  return inferPropertyTypeFromText(`${title} ${description}`);
}

function parseAreaM2(detailsText: string): number | null {
  const match = detailsText.match(/(\d+(?:[\.,]\d+)?)\s*m(?:2|²)/i);
  if (!match?.[1]) {
    return null;
  }

  return parseFiniteNumber(match[1].replace(/\./g, ""));
}

function parseBathrooms(detailsText: string): number | null {
  const match = detailsText.match(/(\d+)\s*bañ(?:o|os)/i);
  if (!match?.[1]) {
    return null;
  }

  return parseFiniteNumber(match[1]);
}

function parseImageUrl(block: string, baseUrl: string): string | null {
  const srcsetValue =
    block.match(/<img[^>]*itemprop=["']image["'][^>]*srcset=["']([^"']+)["']/i)?.[1] ??
    block.match(/<source[^>]*srcset=["']([^"']+)["']/i)?.[1] ??
    null;

  if (!srcsetValue) {
    return null;
  }

  return toAbsoluteUrl(srcsetValue, baseUrl);
}

function extractListingBlocks(html: string): string[] {
  const starts = Array.from(
    html.matchAll(/<li[^>]*id=["']property-\d+["'][^>]*class=["'][^"']*propertyCard[^"']*["'][^>]*>/gi)
  ).map((match) => match.index ?? -1).filter((index) => index >= 0);

  if (starts.length === 0) {
    return [];
  }

  const blocks: string[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index] as number;
    const end = index + 1 < starts.length ? (starts[index + 1] as number) : html.length;
    const block = html.slice(start, end);
    blocks.push(block);
  }

  return blocks;
}

function toListingCard(
  block: string,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string
): ListingCard | null {
  const listingId = block.match(/id=["']property-(\d+)["']/i)?.[1] ?? null;
  if (!listingId) {
    return null;
  }

  const href =
    block.match(/<a[^>]*class=["'][^"']*propertyCard__description--title[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    null;
  if (!href) {
    return null;
  }

  const url = new URL(toAbsoluteUrl(href, baseUrl));
  const title = stripTags(
    block.match(/<a[^>]*class=["'][^"']*propertyCard__description--title[^"']*["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
    `Inmueble ${listingId}`
  );

  const priceRaw = stripTags(
    block.match(/<span[^>]*class=["'][^"']*propertyCard__price--value[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ""
  );

  const detailsText = stripTags(
    block.match(/<ul[^>]*class=["'][^"']*propertyCard__details[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? ""
  );
  const description = stripTags(
    block.match(/<p[^>]*class=["'][^"']*propertyCard__description--txt[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ""
  );
  const city = stripTags(
    block.match(/<div[^>]*class=["'][^"']*propertyCard__location[^"']*["'][\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1] ??
    criteria.city ??
      "Unknown"
  );

  const rooms = parseRoomsFromText(`${detailsText} ${title} ${description}`);
  const bathrooms = parseBathrooms(detailsText);
  const areaM2 = parseAreaM2(detailsText);
  const imageUrl = parseImageUrl(block, baseUrl);
  const propertyType = listingPropertyTypeFromUrl(url, title, description);

  const chars: string[] = [];
  if (rooms !== null) chars.push(`${rooms} habs.`);
  if (bathrooms !== null) chars.push(`${bathrooms} baños`);
  if (areaM2 !== null) chars.push(`${Math.round(areaM2)} m²`);

  return {
    canonical_id: `enalquiler-${listingId}`,
    portal: "enalquiler",
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
    capacity_people: null,
    raw: {
      source_path: url.pathname,
      ...(priceRaw ? { price_raw: priceRaw } : {}),
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
  return /<title>\s*Error\s*(?:404|500)\b/i.test(html);
}

export class EnalquilerConnector implements ConnectorAdapter {
  readonly portal = "enalquiler" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: EnalquilerConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? ENALQUILER_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 300;
    this.maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  private async resolveLocation(city: string): Promise<ResolveLocationResult | null> {
    const endpoint = new URL(`/ajax_suggest/${encodeURIComponent(city)}/1/es`, this.baseUrl);
    const response = await this.fetchImpl(endpoint, {
      headers: {
        ...browserHeaders({ requestDelayMs: this.requestDelayMs }),
        Accept: "application/json,text/plain,*/*",
        Referer: `${this.baseUrl}/`
      }
    });

    if (!response.ok) {
      return null;
    }

    const raw = await response.text();
    const suggestions = parseSuggestResponse(raw);
    const selected = bestSuggestion(suggestions, city);
    if (!selected) {
      return null;
    }

    return buildLocationFromSuggestion(city, selected);
  }

  private async buildBasePaths(criteria: NormalizedFilters, categories: Category[]): Promise<{
    paths: string[];
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const paths: string[] = [];

    if (!criteria.city) {
      for (const seed of DISCOVERY_SEEDS) {
        for (const category of categories) {
          paths.push(routeForCategory(category, seed, true));
        }
      }

      return {
        paths: uniqueStrings(paths),
        warnings: ["No city provided; using discovery scrape across enalquiler major locations."]
      };
    }

    const city = criteria.city;
    const citySlug = slugify(city);

    let resolved = await this.resolveLocation(city);
    if (!resolved && citySlug in CITY_ROUTE_OVERRIDES) {
      resolved = CITY_ROUTE_OVERRIDES[citySlug] ?? null;
      warnings.push(`No ajax_suggest match for "${city}"; using route override fallback.`);
    }

    if (!resolved) {
      warnings.push(`No location resolution for "${city}" on enalquiler; falling back to discovery routes.`);
      for (const seed of DISCOVERY_SEEDS) {
        for (const category of categories) {
          paths.push(routeForCategory(category, seed, true));
        }
      }

      return {
        paths: uniqueStrings(paths),
        warnings
      };
    }

    for (const category of categories) {
      paths.push(routeForCategory(category, resolved, true));
      if (criteria.nearby_towns || !resolved.location) {
        paths.push(routeForCategory(category, resolved, false));
      }
    }

    return {
      paths: uniqueStrings(paths),
      warnings
    };
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const categoryCheck = categoriesForCriteria(criteria);
    if (!categoryCheck.supported) {
      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        categoryCheck.reason ?? "enalquiler cannot satisfy these constraints.",
        false,
        "enalquiler"
      );
    }

    const { paths: basePaths, warnings: baseWarnings } = await this.buildBasePaths(
      criteria,
      categoryCheck.categories
    );
    const requestPaths = buildRequestPaths(basePaths, this.maxRequests, criteria.city ? 2 : 1);

    if (requestPaths.length === 0) {
      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "enalquiler has no candidate paths for the provided criteria.",
        true,
        "enalquiler"
      );
    }

    const warnings: string[] = [...baseWarnings];
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
        warnings.push(`enalquiler blocked path: ${path}`);
        continue;
      }

      if (response.status === 429) {
        rateLimitedCount += 1;
        warnings.push(`enalquiler rate-limited path: ${path}`);
        continue;
      }

      if (response.status === 404) {
        warnings.push(`enalquiler path not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        warnings.push(`enalquiler request ${path} returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      if (isErrorTemplate(html)) {
        warnings.push(`enalquiler error template on path: ${path}`);
        continue;
      }

      try {
        assertNotBotBlocked(html, "enalquiler");
      } catch {
        blockedCount += 1;
        warnings.push(`enalquiler anti-bot challenge on path: ${path}`);
        continue;
      }

      const parsed = parseListings(html, criteria, this.baseUrl, seenAt);
      if (parsed.length === 0) {
        warnings.push(`enalquiler returned no listing cards on path: ${path}`);
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
          "enalquiler rate-limited all candidate requests.",
          true,
          "enalquiler"
        );
      }

      if (blockedCount === requestPaths.length) {
        throw new ConnectorError(
          "UPSTREAM_BLOCKED",
          "enalquiler blocked automated access for all candidate paths.",
          true,
          "enalquiler"
        );
      }

      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "enalquiler returned no usable listings for the provided criteria.",
        true,
        "enalquiler"
      );
    }

    let selected = uniqueListings;
    if (criteria.city) {
      const strictMatches = uniqueListings.filter((listing) => cityMatches(listing.city, criteria.city as string));
      if (strictMatches.length > 0) {
        selected = strictMatches;
      } else {
        warnings.push(`No strict city matches for "${criteria.city}" on enalquiler; returning broader listing set.`);
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

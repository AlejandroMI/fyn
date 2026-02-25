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

const HOGARIA_BASE_URL = "https://www.hogaria.net";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 8;

type Operation = "venta" | "alquiler";
type Resource = "piso" | "casa" | "oficina" | "terrenos_solares";
type ProvinceSlug =
  | "madrid"
  | "barcelona"
  | "alicante"
  | "malaga"
  | "asturias"
  | "cadiz"
  | "huesca"
  | "leon"
  | "sevilla"
  | "teruel"
  | "valencia"
  | "cantabria";

const PROVINCE_CODE_BY_SLUG: Record<ProvinceSlug, number> = {
  madrid: 1,
  barcelona: 2,
  alicante: 5,
  asturias: 7,
  cadiz: 13,
  cantabria: 14,
  huesca: 25,
  leon: 30,
  malaga: 33,
  sevilla: 42,
  teruel: 46,
  valencia: 48
};

const DISCOVERY_PROVINCES: ProvinceSlug[] = [
  "valencia",
  "madrid",
  "barcelona",
  "malaga",
  "alicante",
  "asturias",
  "cadiz",
  "huesca"
];

const CITY_TO_PROVINCE: Record<string, ProvinceSlug> = {
  valencia: "valencia",
  madrid: "madrid",
  barcelona: "barcelona",
  malaga: "malaga",
  sevilla: "sevilla",
  alicante: "alicante",
  ronda: "malaga",
  "cangas-de-onis": "asturias",
  albarracin: "teruel",
  cudillero: "asturias",
  grazalema: "cadiz",
  ainsa: "huesca",
  "ainsa-sobrarbe": "huesca",
  boltana: "huesca",
  benasque: "huesca",
  naquera: "valencia",
  bunol: "valencia",
  requena: "valencia",
  potes: "cantabria",
  riano: "leon"
};

export interface HogariaConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
  maxRequests?: number;
}

function operationForCriteria(criteria: NormalizedFilters): Operation {
  return criteria.transaction_type === "rent" ? "alquiler" : "venta";
}

function resourceForPropertyType(propertyType: ListingCard["property_type"]): Resource | null {
  if (propertyType === "flat") return "piso";
  if (propertyType === "house") return "casa";
  if (propertyType === "office") return "oficina";
  if (propertyType === "land") return "terrenos_solares";
  return null;
}

function requestedResources(criteria: NormalizedFilters): Resource[] {
  if (criteria.property_types.length === 0) {
    return ["piso", "casa"];
  }

  const resources = criteria.property_types
    .map((propertyType) => resourceForPropertyType(propertyType))
    .filter((resource): resource is Resource => resource !== null);

  if (resources.length === 0) {
    return ["piso", "casa"];
  }

  return uniqueStrings(resources) as Resource[];
}

function provincePath(operation: Operation, resource: Resource, province: ProvinceSlug): string {
  const code = PROVINCE_CODE_BY_SLUG[province];
  return `/${operation}-${resource}/${province}-${code}-1.aspx`;
}

function asProvinceSlug(value: string): ProvinceSlug | null {
  const slug = slugify(value);
  if (slug in PROVINCE_CODE_BY_SLUG) {
    return slug as ProvinceSlug;
  }

  return null;
}

function provinceCandidates(citySlug: string): ProvinceSlug[] {
  const mapped = CITY_TO_PROVINCE[citySlug];
  const fromSelf = asProvinceSlug(citySlug);

  return uniqueStrings([mapped ?? "", fromSelf ?? ""]).filter(
    (value): value is ProvinceSlug => value in PROVINCE_CODE_BY_SLUG
  );
}

function buildCandidatePaths(criteria: NormalizedFilters): string[] {
  const operation = operationForCriteria(criteria);
  const resources = requestedResources(criteria);

  if (!criteria.city) {
    const discoveryPaths: string[] = [];
    for (const resource of resources) {
      for (const province of DISCOVERY_PROVINCES) {
        discoveryPaths.push(provincePath(operation, resource, province));
      }
    }

    return uniqueStrings(discoveryPaths);
  }

  const citySlug = slugify(criteria.city);
  const provinces = provinceCandidates(citySlug);
  const paths: string[] = [];

  for (const resource of resources) {
    for (const province of provinces) {
      paths.push(`/${operation}-${resource}/${province}/${citySlug}.aspx`);
      paths.push(provincePath(operation, resource, province));
    }

    if (provinces.length === 0) {
      // Keep a no-map fallback for unknown cities.
      paths.push(`/${operation}-${resource}/${citySlug}/${citySlug}.aspx`);
    }
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

function extractListingId(url: URL, block: string): string {
  const pathMatch = url.pathname.match(/_(\d+)\.aspx$/i)?.[1];
  if (pathMatch) {
    return pathMatch;
  }

  const linkIdMatch = block.match(/<a[^>]*id=['"]lnk(\d+)['"]/i)?.[1];
  if (linkIdMatch) {
    return linkIdMatch;
  }

  return slugify(url.pathname).replace(/-/g, "_") || `anon_${Date.now()}`;
}

function inferPropertyTypeFromPath(pathname: string): ListingCard["property_type"] {
  const lower = pathname.toLowerCase();

  if (/\/(?:venta|alquiler)-piso\b/.test(lower)) return "flat";
  if (/\/(?:venta|alquiler)-casa\b/.test(lower)) return "house";
  if (/\/(?:venta|alquiler)-oficina\b/.test(lower)) return "office";
  if (/\/(?:venta|alquiler)-terrenos_solares\b/.test(lower)) return "land";
  if (lower.includes("/locales-oficinas-naves/")) return "office";
  if (lower.includes("/terrenos-solares/")) return "land";

  return null;
}

function parseImageUrl(block: string, baseUrl: string): string | null {
  const dataSrc = block.match(/<img[^>]*class=["'][^"']*ltimagen[^"']*["'][^>]*data-src=["']([^"']+)["']/i)?.[1];
  const src = block.match(/<img[^>]*class=["'][^"']*ltimagen[^"']*["'][^>]*src=["']([^"']+)["']/i)?.[1];

  const candidate = dataSrc ?? src;
  if (!candidate || /no_image/i.test(candidate)) {
    return null;
  }

  if (candidate.startsWith("//")) {
    return `https:${candidate}`;
  }

  return toAbsoluteUrl(candidate, baseUrl);
}

function parseMetrics(block: string): {
  rooms: number | null;
  bathrooms: number | null;
  areaM2: number | null;
  chars: string[];
} {
  const areaRaw = block.match(/(\d+(?:[\.,]\d+)?)\s*m²/i)?.[1] ?? null;
  const roomsRaw = block.match(/(\d+)\s*dorm\./i)?.[1] ?? null;
  const bathroomsRaw = block.match(/(\d+)\s*bañ(?:o|os)\b/i)?.[1] ?? null;

  const areaM2 = areaRaw ? parseFiniteNumber(areaRaw.replace(/\./g, "")) : null;
  const rooms = roomsRaw ? parseFiniteNumber(roomsRaw) : null;
  const bathrooms = bathroomsRaw ? parseFiniteNumber(bathroomsRaw) : null;

  const chars: string[] = [];
  if (rooms !== null) chars.push(`${rooms} habs.`);
  if (bathrooms !== null) chars.push(`${bathrooms} baños`);
  if (areaM2 !== null) chars.push(`${Math.round(areaM2)} m²`);

  return { rooms, bathrooms, areaM2, chars };
}

function extractLocation(block: string): string | null {
  const raw = block.match(/<h3[^>]*class=["'][^"']*h2ubicacion[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1];
  if (!raw) {
    return null;
  }

  const cleaned = stripTags(raw).replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function toListingCard(
  block: string,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string
): ListingCard | null {
  const href = block.match(/<a[^>]*itemprop=['"]url['"][^>]*href=['"]([^"']+)['"][^>]*>/i)?.[1];
  if (!href) {
    return null;
  }

  const url = new URL(toAbsoluteUrl(href, baseUrl));
  const listingId = extractListingId(url, block);

  const title = stripTags(
    block.match(/<a[^>]*itemprop=['"]url['"][^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? `Inmueble ${listingId}`
  );

  const priceContent = block.match(/<p[^>]*itemprop=['"]price['"][^>]*content=['"]([^"']+)['"]/i)?.[1] ?? null;
  const priceRaw = stripTags(block.match(/<p[^>]*itemprop=['"]price['"][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");

  const description = stripTags(
    block.match(/<div[^>]*itemprop=['"]description['"][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""
  );

  const imageUrl = parseImageUrl(block, baseUrl);
  const location = extractLocation(block) ?? criteria.city ?? "Unknown";
  const { rooms, bathrooms, areaM2, chars } = parseMetrics(block);

  const inferredType = inferPropertyTypeFromPath(url.pathname);
  const inferredFromText = inferPropertyTypeFromText(`${title} ${description} ${url.pathname}`);
  const fallbackType =
    criteria.property_types.length === 1 ? (criteria.property_types[0] ?? null) : null;
  const propertyType = inferredType ?? inferredFromText ?? fallbackType;

  return {
    canonical_id: `hogaria-${listingId}`,
    portal: "hogaria",
    portal_listing_id: listingId,
    url: url.toString(),
    title,
    city: location,
    price_eur: parseFiniteNumber(priceContent) ?? parsePriceNumber(priceRaw),
    rooms: rooms ?? parseRoomsFromText(`${title} ${description}`),
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
      ...(priceRaw ? { price_raw: priceRaw } : {}),
      chars,
      ...(bathrooms !== null ? { bathrooms } : {}),
      ...(areaM2 !== null ? { area_m2: areaM2 } : {})
    }
  };
}

function extractListingBlocks(html: string): string[] {
  const matches = html.match(
    /<div class="item col-xs-4 col-lg-4 grid-group-item"[^>]*itemprop="offers"[\s\S]*?(?=<input type="hidden" name="listado\$ctl\d+\$codigo")/gi
  );

  if (matches && matches.length > 0) {
    return matches;
  }

  return html.match(
    /<div class="item col-xs-4 col-lg-4 grid-group-item"[^>]*itemprop="offers"[\s\S]*?<a[^>]*itemprop=['"]url['"][\s\S]*?<\/div>\s*<\/div>/gi
  ) ?? [];
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
  return /error\s*-\s*p[aá]gina no encontrada|p[aá]gina no encontrada/i.test(html);
}

export class HogariaConnector implements ConnectorAdapter {
  readonly portal = "hogaria" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: HogariaConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? HOGARIA_BASE_URL;
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
        "hogaria has no candidate paths for the provided criteria.",
        true,
        "hogaria"
      );
    }

    const warnings: string[] = [];
    const listings: ListingCard[] = [];
    const seenAt = listingNowIso();

    let blockedCount = 0;
    let rateLimitedCount = 0;

    if (!criteria.city) {
      warnings.push("No city provided; using discovery scrape across Hogaria province routes.");
    }

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
        warnings.push(`hogaria blocked path: ${path}`);
        continue;
      }

      if (response.status === 429) {
        rateLimitedCount += 1;
        warnings.push(`hogaria rate-limited path: ${path}`);
        continue;
      }

      if (response.status === 404) {
        warnings.push(`hogaria path not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        warnings.push(`hogaria request ${path} returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();

      if (isNotFoundPage(html)) {
        warnings.push(`hogaria path not found: ${path}`);
        continue;
      }

      try {
        assertNotBotBlocked(html, "hogaria");
      } catch {
        blockedCount += 1;
        warnings.push(`hogaria anti-bot challenge on path: ${path}`);
        continue;
      }

      const parsed = parseListings(html, criteria, this.baseUrl, seenAt);
      if (parsed.length === 0) {
        warnings.push(`hogaria returned no listing cards on path: ${path}`);
        continue;
      }

      listings.push(...parsed);

      if (listings.length >= this.maxListings) {
        break;
      }
    }

    const uniqueListings = uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);

    if (uniqueListings.length === 0) {
      if (rateLimitedCount === candidatePaths.length) {
        throw new ConnectorError(
          "UPSTREAM_RATE_LIMIT",
          "hogaria rate-limited all candidate requests.",
          true,
          "hogaria"
        );
      }

      if (blockedCount === candidatePaths.length) {
        throw new ConnectorError(
          "UPSTREAM_BLOCKED",
          "hogaria blocked automated access for all candidate paths.",
          true,
          "hogaria"
        );
      }

      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "hogaria returned no usable listings for the provided criteria.",
        true,
        "hogaria"
      );
    }

    let selected = uniqueListings;
    if (criteria.city) {
      const strictMatches = uniqueListings.filter((listing) => cityMatches(listing.city, criteria.city as string));
      if (strictMatches.length > 0) {
        selected = strictMatches;
      } else {
        warnings.push(`No strict city matches for "${criteria.city}" on hogaria; returning broader listing set.`);
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

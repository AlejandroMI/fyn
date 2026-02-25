import {
  ConnectorError,
  type ConnectorSearchResult,
  type ListingCard,
  type NormalizedFilters,
  type PropertyType
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

const TUCASA_BASE_URL = "https://www.tucasa.com";
const DEFAULT_MAX_REQUESTS = 6;
const INDEX_CACHE_TTL_MS = 5 * 60 * 1000;

interface UnknownRecord {
  [key: string]: unknown;
}

interface IndexCacheEntry {
  fetchedAt: number;
  html: string;
}

const indexCache = new Map<string, IndexCacheEntry>();

export interface TucasaConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxRequests?: number;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as UnknownRecord;
  }

  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  return parseFiniteNumber(value);
}

function readNestedRecord(record: UnknownRecord, path: string[]): UnknownRecord | null {
  let current: unknown = record;
  for (const key of path) {
    const node = asRecord(current);
    if (!node) {
      return null;
    }

    current = node[key];
  }

  return asRecord(current);
}

function readNestedString(record: UnknownRecord, path: string[]): string | null {
  let current: unknown = record;
  for (const key of path) {
    const node = asRecord(current);
    if (!node) {
      return null;
    }

    current = node[key];
  }

  return asString(current);
}

function firstString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function collectJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(regex)) {
    const payload = match[1];
    if (!payload) {
      continue;
    }

    try {
      blocks.push(JSON.parse(payload));
    } catch {
      continue;
    }
  }

  return blocks;
}

function collectItemLists(node: unknown, sink: UnknownRecord[]): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectItemLists(child, sink);
    }
    return;
  }

  const record = asRecord(node);
  if (!record) {
    return;
  }

  if (record["@type"] === "ItemList" && Array.isArray(record.itemListElement)) {
    sink.push(record);
  }

  for (const value of Object.values(record)) {
    collectItemLists(value, sink);
  }
}

function inferPropertyTypeFromUrl(url: string): ListingCard["property_type"] {
  const lower = url.toLowerCase();
  if (lower.includes("/pisos-y-apartamentos/")) return "flat";
  if (lower.includes("/casas-y-chalets/")) return "house";
  if (lower.includes("/oficinas/")) return "office";
  if (lower.includes("/terrenos/") || lower.includes("/solares/")) return "land";
  return null;
}

function extractListingId(url: URL): string {
  const searchId = url.searchParams.get("id");
  if (searchId && /^\d+$/.test(searchId)) {
    return searchId;
  }

  const pathMatch = url.pathname.match(/\/(?:id_a)?(\d{6,})\b/i);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  return slugify(url.pathname).replace(/-/g, "_") || `anon_${Date.now()}`;
}

function normalizeCity(value: string): string {
  return value
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cityFromListing(listing: UnknownRecord): string {
  const mainEntity = asRecord(listing.mainEntity);
  const address = mainEntity ? readNestedRecord(mainEntity, ["address"]) : null;

  const locality = address ? asString(address.addressLocality) : null;
  if (locality) {
    return normalizeCity(locality);
  }

  const name = firstString(listing, ["name", "title"]);
  if (name) {
    return normalizeCity(name);
  }

  return "Unknown";
}

function listingFromItem(
  rawItem: UnknownRecord,
  baseUrl: string,
  lastSeenAt: string
): ListingCard | null {
  const listItem = asRecord(rawItem.item) ?? rawItem;
  const urlRaw = firstString(listItem, ["url"]) ?? firstString(rawItem, ["url"]);
  if (!urlRaw) {
    return null;
  }

  const absolute = toAbsoluteUrl(urlRaw, baseUrl);
  const listingUrl = new URL(absolute);
  const portalListingId = extractListingId(listingUrl);

  const title = firstString(listItem, ["name", "title"]) ?? `Inmueble ${portalListingId}`;
  const description = stripTags(firstString(listItem, ["description"]) ?? "");
  const imageRaw = listItem.image;
  const imageUrls = Array.isArray(imageRaw)
    ? imageRaw.map((value) => asString(value)).filter((value): value is string => Boolean(value))
    : asString(imageRaw)
      ? [asString(imageRaw) as string]
      : [];

  const offers = asRecord(listItem.offers);
  const priceRaw = offers ? firstString(offers, ["price"]) : null;
  const price = offers ? asNumber(offers.price) : null;

  const mainEntity = asRecord(listItem.mainEntity);
  const roomsRaw = mainEntity ? firstString(mainEntity, ["numberOfRooms", "numBedrooms"]) : null;
  const roomsFromSchema = roomsRaw ? parseFiniteNumber(roomsRaw) : null;
  const rooms = roomsFromSchema ?? parseRoomsFromText(`${title} ${description}`);

  const floorSizeRaw = mainEntity ? readNestedString(mainEntity, ["floorSize", "value"]) : null;
  const floorSize = floorSizeRaw ? parseFiniteNumber(floorSizeRaw) : null;

  const inferredType = inferPropertyTypeFromUrl(listingUrl.pathname);
  const propertyType = inferredType ?? inferPropertyTypeFromText(`${title} ${description}`);
  const city = cityFromListing(listItem);

  const rawChars: string[] = [];
  if (rooms !== null) {
    rawChars.push(`${rooms} habs.`);
  }
  if (floorSize !== null) {
    rawChars.push(`${Math.round(floorSize)} m²`);
  }

  const capacityPeople =
    propertyType === "office" && floorSize !== null ? Math.max(1, Math.floor(floorSize / 2.5)) : null;

  return {
    canonical_id: `tucasa-${portalListingId}`,
    portal: "tucasa",
    portal_listing_id: portalListingId,
    url: listingUrl.toString(),
    title,
    city,
    price_eur: price ?? parsePriceNumber(priceRaw),
    rooms,
    property_type: propertyType,
    image_urls: imageUrls,
    last_seen_at: lastSeenAt,
    score: 0,
    why_matched: [],
    description,
    tags: inferTagsFromDescription(description),
    capacity_people: capacityPeople,
    raw: {
      source_path: listingUrl.pathname,
      price_raw: priceRaw,
      chars: rawChars
    }
  };
}

function operationPath(filters: NormalizedFilters): string {
  if (filters.transaction_type === "rent") {
    return "alquiler/viviendas";
  }

  return "compra-venta/viviendas";
}

function locationMatchesPath(pathname: string, requestedCitySlug: string): boolean {
  const segments = pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => slugify(segment));

  return segments.some((segment) => segment === requestedCitySlug || segment.startsWith(`${requestedCitySlug}-`));
}

function extractCandidatePathsFromIndex(
  html: string,
  requestedCitySlug: string,
  opPath: string,
  baseUrl: string
): string[] {
  const candidates: string[] = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const opSegment = `/${opPath}/`;

  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    if (!href) {
      continue;
    }

    const absolute = toAbsoluteUrl(href, baseUrl);
    const url = new URL(absolute);
    if (!url.pathname.includes(opSegment)) {
      continue;
    }

    if (locationMatchesPath(url.pathname, requestedCitySlug)) {
      candidates.push(url.toString());
    }
  }

  return uniqueStrings(candidates);
}

async function fetchHtml(
  fetchImpl: typeof fetch,
  url: string,
  options: ScraperOptions
): Promise<{ status: number; html: string }> {
  const response = await fetchImpl(url, {
    headers: browserHeaders(options)
  });

  const html = await response.text();

  if (response.status === 429) {
    throw new ConnectorError("UPSTREAM_RATE_LIMIT", `tucasa rate limited request: ${url}`, true, "tucasa");
  }

  if (response.status === 401 || response.status === 403) {
    throw new ConnectorError("UPSTREAM_BLOCKED", `tucasa blocked request: ${url}`, true, "tucasa");
  }

  if (response.status >= 500) {
    throw new ConnectorError(
      "UPSTREAM_UNAVAILABLE",
      `tucasa server error ${response.status} for ${url}`,
      true,
      "tucasa"
    );
  }

  return {
    status: response.status,
    html
  };
}

function parseListingsFromPage(html: string, baseUrl: string, seenAt: string): ListingCard[] {
  const scripts = collectJsonLdBlocks(html);
  const itemLists: UnknownRecord[] = [];

  for (const script of scripts) {
    collectItemLists(script, itemLists);
  }

  const listings: ListingCard[] = [];
  for (const itemList of itemLists) {
    const listElements = Array.isArray(itemList.itemListElement) ? itemList.itemListElement : [];
    for (const element of listElements) {
      const node = asRecord(element);
      if (!node) {
        continue;
      }

      const listing = listingFromItem(node, baseUrl, seenAt);
      if (listing) {
        listings.push(listing);
      }
    }
  }

  return uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);
}

export class TucasaConnector implements ConnectorAdapter {
  readonly portal = "tucasa" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxRequests: number;

  constructor(options: TucasaConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? TUCASA_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 250;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const warnings: string[] = [];
    const opPath = operationPath(criteria);
    const seenAt = listingNowIso();
    const targets: string[] = [];

    if (criteria.city) {
      const citySlug = slugify(criteria.city);
      if (!citySlug) {
        throw new ConnectorError("UPSTREAM_SCHEMA_CHANGED", "Invalid city slug for tucasa search.", false, "tucasa");
      }

      const indexKey = `${this.baseUrl}|${opPath}`;
      let indexHtml: string | null = null;
      const cached = indexCache.get(indexKey);
      if (cached && Date.now() - cached.fetchedAt < INDEX_CACHE_TTL_MS) {
        indexHtml = cached.html;
      } else {
        const indexUrl = `${this.baseUrl}/${opPath}/`;
        const indexResponse = await fetchHtml(this.fetchImpl, indexUrl, {
          requestDelayMs: this.requestDelayMs
        });

        if (indexResponse.status === 200) {
          assertNotBotBlocked(indexResponse.html, "tucasa");
          indexHtml = indexResponse.html;
          indexCache.set(indexKey, {
            fetchedAt: Date.now(),
            html: indexResponse.html
          });
        }
      }

      if (indexHtml) {
        targets.push(...extractCandidatePathsFromIndex(indexHtml, citySlug, opPath, this.baseUrl));
      }

      if (targets.length === 0) {
        warnings.push(
          `No direct tucasa index path found for city '${criteria.city}'. Falling back to heuristic URL candidates.`
        );
      }

      targets.push(`${this.baseUrl}/${opPath}/${citySlug}/`);
      targets.push(`${this.baseUrl}/${opPath}/${citySlug}/${citySlug}-capital/`);
    } else {
      targets.push(`${this.baseUrl}/${opPath}/`);
    }

    const dedupedTargets = uniqueStrings(targets).slice(0, this.maxRequests);
    const allListings: ListingCard[] = [];

    for (const [index, target] of dedupedTargets.entries()) {
      if (index > 0) {
        await sleep(this.requestDelayMs);
      }

      const { status, html } = await fetchHtml(this.fetchImpl, target, {
        requestDelayMs: this.requestDelayMs
      });

      if (status === 404) {
        warnings.push(`tucasa route returned 404: ${new URL(target).pathname}`);
        continue;
      }

      if (status >= 400) {
        warnings.push(`tucasa route returned HTTP ${status}: ${new URL(target).pathname}`);
        continue;
      }

      assertNotBotBlocked(html, "tucasa");

      const parsed = parseListingsFromPage(html, this.baseUrl, seenAt);
      if (parsed.length === 0) {
        warnings.push(`No structured listings parsed from ${new URL(target).pathname}`);
      }
      allListings.push(...parsed);
    }

    const uniqueListings = uniqueBy(allListings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);

    return {
      listings: uniqueListings,
      diagnostics: {
        source: "scrape",
        connector_warnings: uniqueStrings(warnings)
      }
    };
  }
}

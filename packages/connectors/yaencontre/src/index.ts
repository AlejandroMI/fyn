import {
  ConnectorError,
  type ConnectorSearchResult,
  type ListingCard,
  type NormalizedFilters
} from "@fyn/domain";
import {
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

const YAENCONTRE_BASE_URL = "https://www.yaencontre.com";
const YAENCONTRE_MEDIA_BASE_URL = "https://media.yaencontre.com/";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 4;

interface UnknownRecord {
  [key: string]: unknown;
}

export interface YaencontreConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxListings?: number;
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

function firstString(record: UnknownRecord, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = asString(record[key]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
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

function decodeWindowJsonPayload(html: string, variableName: string): unknown | null {
  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `window\\.${escapedName}\\s*=\\s*JSON\\.parse\\(atob\\((["'])([\\s\\S]*?)\\1\\)\\)`,
    "i"
  );
  const match = html.match(regex);
  const payload = match?.[2];
  if (!payload) {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
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

function modeSegment(criteria: NormalizedFilters): "venta" | "alquiler" {
  return criteria.transaction_type === "rent" ? "alquiler" : "venta";
}

function resourcesForCriteria(criteria: NormalizedFilters): string[] {
  if (criteria.property_types.length === 0) {
    return ["viviendas"];
  }

  const resources = criteria.property_types.map((propertyType) => {
    if (propertyType === "flat") return "pisos";
    if (propertyType === "house") return "casas";
    if (propertyType === "office") return "oficinas";
    if (propertyType === "land") return "terrenos";
    return "viviendas";
  });

  return uniqueStrings(resources);
}

function buildCandidatePaths(criteria: NormalizedFilters): string[] {
  const mode = modeSegment(criteria);
  const resources = resourcesForCriteria(criteria);
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
    paths.push(`/${mode}/${resource}/${citySlug}-capital`);
  }

  return uniqueStrings(paths);
}

function extractListingId(url: URL): string {
  const queryId = url.searchParams.get("id");
  if (queryId && /^\d+$/.test(queryId)) {
    return queryId;
  }

  const pathId = url.pathname.match(/(\d{6,})/);
  if (pathId?.[1]) {
    return pathId[1];
  }

  return slugify(url.pathname).replace(/-/g, "_") || `anon_${Date.now()}`;
}

function propertyTypeFromFamily(value: unknown): ListingCard["property_type"] {
  const family = asString(value)?.toUpperCase();
  if (!family) {
    return null;
  }

  if (/(FLAT|APARTMENT|PENTHOUSE|DUPLEX|LOFT|STUDIO)/.test(family)) return "flat";
  if (/(HOUSE|CHALET|VILLA|RURAL|TOWNHOUSE)/.test(family)) return "house";
  if (/(OFFICE|LOCAL|COMMERCIAL)/.test(family)) return "office";
  if (/(LAND|PLOT|SOIL|SOLAR|RUSTIC)/.test(family)) return "land";
  return null;
}

function pickAddressLocality(item: UnknownRecord): string | null {
  const directAddress = asRecord(item.address);
  const directLocality = directAddress ? firstString(directAddress, ["addressLocality"]) : null;
  if (directLocality) {
    return directLocality;
  }

  const mainEntity = asRecord(item.mainEntity);
  const nestedAddress = mainEntity ? asRecord(mainEntity.address) : null;
  return nestedAddress ? firstString(nestedAddress, ["addressLocality"]) : null;
}

function imageUrlsFromValue(value: unknown, baseUrl: string): string[] {
  if (Array.isArray(value)) {
    const urls: string[] = [];
    for (const entry of value) {
      urls.push(...imageUrlsFromValue(entry, baseUrl));
    }
    return uniqueStrings(urls);
  }

  const asImageString = asString(value);
  if (asImageString) {
    if (asImageString.startsWith("//")) {
      return [`https:${asImageString}`];
    }
    return [toAbsoluteUrl(asImageString, baseUrl)];
  }

  const asImageRecord = asRecord(value);
  if (!asImageRecord) {
    return [];
  }

  const nested = firstString(asImageRecord, ["url", "contentUrl", "thumbnailUrl"]);
  if (!nested) {
    return [];
  }

  return imageUrlsFromValue(nested, baseUrl);
}

function cityFromQualifiedAddress(address: UnknownRecord | null, fallbackCity: string | undefined): string {
  const qualifiedName = address ? firstString(address, ["qualifiedName"]) : null;
  if (qualifiedName) {
    const firstSegment = qualifiedName.split(",")[0]?.trim();
    if (firstSegment && firstSegment.length > 0) {
      return firstSegment;
    }
  }

  return fallbackCity ?? "Unknown";
}

function imageUrlsFromStateItem(item: UnknownRecord, mediaBaseUrl: string): string[] {
  const images = item.images;
  if (!Array.isArray(images)) {
    return [];
  }

  const urls: string[] = [];
  for (const raw of images) {
    const image = asRecord(raw);
    const slug = image ? firstString(image, ["slug", "url"]) : asString(raw);
    if (!slug) {
      continue;
    }

    if (/^https?:\/\//i.test(slug)) {
      urls.push(slug);
      continue;
    }

    urls.push(toAbsoluteUrl(slug, mediaBaseUrl));
  }

  return uniqueStrings(urls);
}

function listingsFromInitialState(
  html: string,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string
): ListingCard[] {
  const initialState = asRecord(decodeWindowJsonPayload(html, "__INITIAL_STATE__"));
  if (!initialState) {
    return [];
  }

  const jht = asRecord(decodeWindowJsonPayload(html, "JHT"));
  const mediaBaseUrl = (jht ? firstString(jht, ["MEDIA_URL"]) : null) ?? YAENCONTRE_MEDIA_BASE_URL;
  const byId = readNestedRecord(initialState, ["results", "currentPageItems", "byId"]);
  if (!byId) {
    return [];
  }

  const listings: ListingCard[] = [];
  for (const value of Object.values(byId)) {
    const wrapper = asRecord(value);
    if (!wrapper) {
      continue;
    }

    const item = asRecord(wrapper.item) ?? wrapper;
    const urlRaw = firstString(item, ["url"]);
    if (!urlRaw) {
      continue;
    }

    const listingUrl = new URL(toAbsoluteUrl(urlRaw, baseUrl));
    const reference = firstString(item, ["reference", "id"]);
    const portalListingId = reference ? slugify(reference).replace(/-/g, "_") : extractListingId(listingUrl);
    const title = firstString(item, ["title", "name"]) ?? `Inmueble ${portalListingId}`;
    const description = stripTags(firstString(item, ["description"]) ?? "");
    const price = parseFiniteNumber(item.price) ?? parsePriceNumber(firstString(item, ["price"]));
    const rooms = parseFiniteNumber(item.rooms) ?? parseRoomsFromText(`${title} ${description}`);
    const bathrooms = parseFiniteNumber(item.bathrooms);
    const area = parseFiniteNumber(item.area);
    const address = asRecord(item.address);
    const geo = address ? asRecord(address.geoLocation) : null;
    const lat = geo ? parseFiniteNumber(geo.lat) : null;
    const lon = geo ? parseFiniteNumber(geo.lon) : null;

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

    const propertyType = propertyTypeFromFamily(item.family) ?? inferPropertyTypeFromText(`${title} ${description}`);

    listings.push({
      canonical_id: `yaencontre-${portalListingId}`,
      portal: "yaencontre",
      portal_listing_id: portalListingId,
      url: listingUrl.toString(),
      title,
      city: cityFromQualifiedAddress(address, criteria.city),
      price_eur: price,
      rooms,
      property_type: propertyType,
      image_urls: imageUrlsFromStateItem(item, mediaBaseUrl),
      last_seen_at: seenAt,
      score: 0,
      why_matched: [],
      description,
      tags: inferTagsFromDescription(`${title} ${description}`),
      capacity_people: propertyType === "office" && area !== null ? Math.max(1, Math.floor(area / 2.5)) : null,
      raw: {
        source_path: listingUrl.pathname,
        chars,
        ...(lat !== null && lon !== null ? { lat, lon } : {})
      }
    });
  }

  return listings;
}

function listingFromItem(
  rawItem: unknown,
  criteria: NormalizedFilters,
  baseUrl: string,
  seenAt: string
): ListingCard | null {
  const rawRecord = asRecord(rawItem);
  if (!rawRecord) {
    return null;
  }

  const listItem = asRecord(rawRecord.item) ?? rawRecord;
  const urlRaw = firstString(listItem, ["url"]) ?? firstString(rawRecord, ["url"]);
  if (!urlRaw) {
    return null;
  }

  const listingUrl = new URL(toAbsoluteUrl(urlRaw, baseUrl));
  const portalListingId = extractListingId(listingUrl);
  const title = firstString(listItem, ["name", "title"]) ?? `Inmueble ${portalListingId}`;
  const description = stripTags(firstString(listItem, ["description"]) ?? "");
  const imageUrls = imageUrlsFromValue(listItem.image, baseUrl);

  const offers = asRecord(listItem.offers);
  const priceFromOffers =
    offers && offers.price !== undefined ? parseFiniteNumber(offers.price) : null;
  const priceRaw = offers ? firstString(offers, ["price"]) : null;
  const price = priceFromOffers ?? parsePriceNumber(priceRaw);

  const roomsFromSchema =
    parseFiniteNumber(listItem.numberOfRooms) ??
    parseFiniteNumber(listItem.numBedrooms) ??
    parseFiniteNumber(asRecord(listItem.mainEntity)?.numberOfRooms);
  const rooms = roomsFromSchema ?? parseRoomsFromText(`${title} ${description}`);
  const propertyType = inferPropertyTypeFromText(`${title} ${description}`);
  const city = pickAddressLocality(listItem) ?? criteria.city ?? "Unknown";

  const chars = rooms !== null ? [`${rooms} habs.`] : [];

  return {
    canonical_id: `yaencontre-${portalListingId}`,
    portal: "yaencontre",
    portal_listing_id: portalListingId,
    url: listingUrl.toString(),
    title,
    city,
    price_eur: price,
    rooms,
    property_type: propertyType,
    image_urls: imageUrls,
    last_seen_at: seenAt,
    score: 0,
    why_matched: [],
    description,
    tags: inferTagsFromDescription(`${title} ${description}`),
    capacity_people: null,
    raw: {
      source_path: listingUrl.pathname,
      ...(priceRaw ? { price_raw: priceRaw } : {}),
      chars
    }
  };
}

function fallbackListingUrlsFromAnchors(html: string, baseUrl: string): string[] {
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const urls: string[] = [];

  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    if (!href) {
      continue;
    }

    if (
      !/^\/(?:venta|alquiler)\//.test(href) &&
      !/^https?:\/\/www\.yaencontre\.com\/(?:venta|alquiler)\//i.test(href)
    ) {
      continue;
    }

    if (!/inmueble-\d{5,}/i.test(href)) {
      continue;
    }

    const absolute = toAbsoluteUrl(href, baseUrl);
    urls.push(absolute);
  }

  return uniqueStrings(urls);
}

function blockedMessage(response: Response, html: string): string {
  const cid = response.headers.get("x-datadome-cid");
  const hasDataDomeHeader = response.headers.get("x-dd-b") !== null;
  const hasChallengeBody = /captcha-delivery\.com|please enable js and disable any ad blocker|datadome/i.test(html);

  if (hasDataDomeHeader || hasChallengeBody) {
    return cid
      ? `yaencontre blocked automated access (DataDome challenge; cid=${cid}).`
      : "yaencontre blocked automated access (DataDome challenge).";
  }

  return `yaencontre blocked automated access (HTTP ${response.status}).`;
}

function looksLikeChallengeBody(html: string): boolean {
  return /captcha-delivery\.com|please enable js and disable any ad blocker|datadome|access denied/i.test(html);
}

export class YaencontreConnector implements ConnectorAdapter {
  readonly portal = "yaencontre" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: YaencontreConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? YAENCONTRE_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 350;
    this.maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const warnings: string[] = [];
    const seenAt = listingNowIso();
    const listings: ListingCard[] = [];
    const paths = buildCandidatePaths(criteria).slice(0, this.maxRequests);

    for (const [index, path] of paths.entries()) {
      if (index > 0) {
        await sleep(this.requestDelayMs);
      }

      const url = toAbsoluteUrl(path, this.baseUrl);
      const response = await this.fetchImpl(url, {
        headers: browserHeaders({
          requestDelayMs: this.requestDelayMs
        })
      });
      const html = await response.text();

      if (response.status === 429) {
        throw new ConnectorError("UPSTREAM_RATE_LIMIT", "yaencontre rate limited request.", true, "yaencontre");
      }

      if (response.status === 401 || response.status === 403) {
        throw new ConnectorError("UPSTREAM_BLOCKED", blockedMessage(response, html), true, "yaencontre");
      }

      if (response.status >= 500) {
        throw new ConnectorError(
          "UPSTREAM_UNAVAILABLE",
          `yaencontre upstream unavailable (HTTP ${response.status}).`,
          true,
          "yaencontre"
        );
      }

      if (looksLikeChallengeBody(html)) {
        throw new ConnectorError("UPSTREAM_BLOCKED", blockedMessage(response, html), true, "yaencontre");
      }

      if (response.status >= 400) {
        warnings.push(`yaencontre request ${path} returned HTTP ${response.status}.`);
        continue;
      }

      const jsonLdBlocks = collectJsonLdBlocks(html);
      const itemLists: UnknownRecord[] = [];
      for (const block of jsonLdBlocks) {
        collectItemLists(block, itemLists);
      }

      const parsedFromState = listingsFromInitialState(html, criteria, this.baseUrl, seenAt);
      const parsedFromStructured: ListingCard[] = [];
      for (const itemList of itemLists) {
        const entries = Array.isArray(itemList.itemListElement) ? itemList.itemListElement : [];
        for (const entry of entries) {
          const listing = listingFromItem(entry, criteria, this.baseUrl, seenAt);
          if (listing) {
            parsedFromStructured.push(listing);
          }
        }
      }

      if (parsedFromState.length > 0) {
        listings.push(...parsedFromState);
      } else if (parsedFromStructured.length > 0) {
        listings.push(...parsedFromStructured);
      } else {
        const fallbackUrls = fallbackListingUrlsFromAnchors(html, this.baseUrl);
        for (const fallbackUrl of fallbackUrls) {
          const parsed = new URL(fallbackUrl);
          const listingId = extractListingId(parsed);
          listings.push({
            canonical_id: `yaencontre-${listingId}`,
            portal: "yaencontre",
            portal_listing_id: listingId,
            url: parsed.toString(),
            title: `Inmueble ${listingId}`,
            city: criteria.city ?? "Unknown",
            price_eur: null,
            rooms: null,
            property_type: null,
            image_urls: [],
            last_seen_at: seenAt,
            score: 0,
            why_matched: [],
            description: "",
            tags: [],
            capacity_people: null,
            raw: {
              source_path: parsed.pathname,
              chars: []
            }
          });
        }
      }

      if (listings.length >= this.maxListings) {
        break;
      }
    }

    const uniqueListings = uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`).slice(
      0,
      this.maxListings
    );
    if (uniqueListings.length === 0) {
      warnings.push("yaencontre returned no parseable listings.");
    }

    return {
      listings: uniqueListings,
      diagnostics: {
        source: "scrape",
        connector_warnings: uniqueStrings(warnings)
      }
    };
  }
}

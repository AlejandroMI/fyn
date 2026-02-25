import {
  ConnectorError,
  type ConnectorSearchResult,
  type ListingCard,
  type NormalizedFilters
} from "@fyn/domain";
import {
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

const IDEALISTA_BASE_URL = "https://www.idealista.com";
const DEFAULT_MAX_LISTINGS = 20;
const DEFAULT_MAX_REQUESTS = 4;

type Resource = "viviendas" | "pisos" | "casas-chalets" | "oficinas" | "terrenos";

interface UnknownRecord {
  [key: string]: unknown;
}

export interface IdealistaConnectorOptions extends ScraperOptions {
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

function modePrefix(criteria: NormalizedFilters): "venta" | "alquiler" {
  return criteria.transaction_type === "rent" ? "alquiler" : "venta";
}

function inferResourceFromPropertyType(propertyType: ListingCard["property_type"]): Resource | null {
  if (propertyType === "flat") return "pisos";
  if (propertyType === "house") return "casas-chalets";
  if (propertyType === "office") return "oficinas";
  if (propertyType === "land") return "terrenos";
  return null;
}

function requestedResources(criteria: NormalizedFilters): Resource[] {
  if (criteria.property_types.length === 0) {
    return ["viviendas"];
  }

  const resources = criteria.property_types
    .map((propertyType) => inferResourceFromPropertyType(propertyType))
    .filter((value): value is Resource => value !== null);

  if (resources.length === 0) {
    return ["viviendas"];
  }

  return uniqueStrings(resources) as Resource[];
}

function buildCandidatePaths(criteria: NormalizedFilters): string[] {
  const mode = modePrefix(criteria);
  const resources = requestedResources(criteria);

  if (!criteria.city) {
    return uniqueStrings(resources.map((resource) => `/${mode}-${resource}/`));
  }

  const citySlug = slugify(criteria.city);
  const paths: string[] = [];
  for (const resource of resources) {
    paths.push(`/${mode}-${resource}/${citySlug}-${citySlug}/`);
    paths.push(`/${mode}-${resource}/${citySlug}/`);
  }

  return uniqueStrings(paths);
}

function extractListingId(url: URL): string {
  const fromPath = url.pathname.match(/\/inmueble\/(\d+)/i)?.[1];
  if (fromPath) {
    return fromPath;
  }

  return slugify(url.pathname).replace(/-/g, "_") || `anon_${Date.now()}`;
}

function inferPropertyTypeFromPath(pathname: string): ListingCard["property_type"] {
  const lower = pathname.toLowerCase();
  if (lower.includes("/pisos/")) return "flat";
  if (lower.includes("/casas-chalets/") || lower.includes("/casas/")) return "house";
  if (lower.includes("/oficinas/")) return "office";
  if (lower.includes("/terrenos/")) return "land";
  return null;
}

function normalizedCity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cityMatches(candidateCity: string, requestedCity: string): boolean {
  const listingCity = normalizedCity(candidateCity);
  const requested = normalizedCity(requestedCity);

  if (!requested) {
    return true;
  }

  return listingCity.includes(requested);
}

function looksLikeIdealistaChallenge(html: string): boolean {
  return /captcha-delivery\.com|please enable js and disable any ad blocker|sentimos la interrupci[oó]n|pardon our interruption|var\s+dd\s*=\s*\{/i.test(
    html
  );
}

function extractDatadomeCid(html: string, response: Response): string | null {
  const headerCid =
    response.headers.get("x-datadome-cid") ??
    response.headers.get("x-dd-cid");
  if (headerCid && headerCid.trim().length > 0) {
    return headerCid.trim();
  }

  const htmlCid =
    html.match(/["']cid["']\s*[:=]\s*["']([^"']+)["']/i)?.[1] ??
    html.match(/\bcid\s*[:=]\s*["']([^"']+)["']/i)?.[1] ??
    null;

  return htmlCid?.trim() ?? null;
}

function roomAndSurfaceChars(text: string): string[] {
  const chars: string[] = [];
  const rooms = parseRoomsFromText(text);
  if (rooms !== null) {
    chars.push(`${rooms} habs.`);
  }

  const surface = text.match(/(\d{1,4})\s*m²/i)?.[1];
  if (surface) {
    chars.push(`${surface} m²`);
  }

  return chars;
}

function listingFromJsonLd(
  rawItem: unknown,
  baseUrl: string,
  criteria: NormalizedFilters,
  seenAt: string
): ListingCard | null {
  const record = asRecord(rawItem);
  if (!record) {
    return null;
  }

  const item = asRecord(record.item) ?? record;
  const rawUrl = firstString(item, ["url"]);
  if (!rawUrl) {
    return null;
  }

  const url = new URL(toAbsoluteUrl(rawUrl, baseUrl));
  const listingId = extractListingId(url);
  const title = firstString(item, ["name", "title"]) ?? `Inmueble ${listingId}`;
  const description = stripTags(firstString(item, ["description"]) ?? "");
  const image = firstString(item, ["image"]);

  const offers = asRecord(item.offers);
  const price = parseFiniteNumber(offers?.price) ?? parsePriceNumber(firstString(offers ?? {}, ["price"]));
  const rooms =
    parseFiniteNumber(item.numberOfRooms) ??
    parseFiniteNumber(item.numBedrooms) ??
    parseRoomsFromText(`${title} ${description}`);

  const address = asRecord(item.address);
  const city = firstString(address ?? {}, ["addressLocality"]) ?? criteria.city ?? "Unknown";
  const propertyType = inferPropertyTypeFromPath(url.pathname) ?? inferPropertyTypeFromText(`${title} ${description}`);

  return {
    canonical_id: `idealista-${listingId}`,
    portal: "idealista",
    portal_listing_id: listingId,
    url: url.toString(),
    title,
    city,
    price_eur: price,
    rooms,
    property_type: propertyType,
    image_urls: image ? [toAbsoluteUrl(image, baseUrl)] : [],
    last_seen_at: seenAt,
    score: 0,
    why_matched: [],
    description,
    tags: inferTagsFromDescription(`${title} ${description}`),
    raw: {
      source_path: url.pathname,
      chars: roomAndSurfaceChars(`${title} ${description}`)
    }
  };
}

function listingFromCardHtml(
  block: string,
  baseUrl: string,
  criteria: NormalizedFilters,
  seenAt: string
): ListingCard | null {
  const path = block.match(/href=["'](\/inmueble\/\d+\/?)["']/i)?.[1];
  if (!path) {
    return null;
  }

  const url = new URL(toAbsoluteUrl(path, baseUrl));
  const listingId = extractListingId(url);

  const title =
    stripTags(
      block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ??
        block.match(/<a[^>]*href=["']\/inmueble\/\d+\/?["'][^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
        `Inmueble ${listingId}`
    ) || `Inmueble ${listingId}`;
  const description = stripTags(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const city =
    stripTags(block.match(/<address[^>]*>([\s\S]*?)<\/address>/i)?.[1] ?? "") ||
    criteria.city ||
    "Unknown";
  const priceRaw = stripTags(
    block.match(/(\d[\d\.\s]*\s*€)/i)?.[1] ?? block.match(/<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ""
  );

  const image =
    block.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i)?.[1] ??
    block.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    null;

  const combinedText = `${title} ${description} ${block}`;
  const rooms = parseRoomsFromText(combinedText);
  const propertyType = inferPropertyTypeFromPath(url.pathname) ?? inferPropertyTypeFromText(`${title} ${description}`);
  const surface = combinedText.match(/(\d{1,4})\s*m²/i)?.[1] ?? null;

  const rawChars = roomAndSurfaceChars(combinedText);

  return {
    canonical_id: `idealista-${listingId}`,
    portal: "idealista",
    portal_listing_id: listingId,
    url: url.toString(),
    title,
    city,
    price_eur: parsePriceNumber(priceRaw),
    rooms,
    property_type: propertyType,
    image_urls: image ? [toAbsoluteUrl(image, baseUrl)] : [],
    last_seen_at: seenAt,
    score: 0,
    why_matched: [],
    description,
    tags: inferTagsFromDescription(`${title} ${description}`),
    capacity_people:
      propertyType === "office" && surface ? Math.max(1, Math.floor(Number(surface) / 2.5)) : null,
    raw: {
      source_path: url.pathname,
      ...(priceRaw ? { price_raw: priceRaw } : {}),
      chars: rawChars
    }
  };
}

function parseListings(html: string, baseUrl: string, criteria: NormalizedFilters, seenAt: string): ListingCard[] {
  const listings: ListingCard[] = [];

  const jsonLdBlocks = collectJsonLdBlocks(html);
  const itemLists: UnknownRecord[] = [];
  for (const block of jsonLdBlocks) {
    collectItemLists(block, itemLists);
  }

  for (const itemList of itemLists) {
    const elements = Array.isArray(itemList.itemListElement) ? itemList.itemListElement : [];
    for (const item of elements) {
      const listing = listingFromJsonLd(item, baseUrl, criteria, seenAt);
      if (listing) {
        listings.push(listing);
      }
    }
  }

  const articleBlocks = html.match(/<article[\s\S]*?<\/article>/gi) ?? [];
  for (const block of articleBlocks) {
    const listing = listingFromCardHtml(block, baseUrl, criteria, seenAt);
    if (listing) {
      listings.push(listing);
    }
  }

  const listItemBlocks = html.match(/<li[^>]*class=["'][^"']*item[^"']*["'][\s\S]*?<\/li>/gi) ?? [];
  for (const block of listItemBlocks) {
    const listing = listingFromCardHtml(block, baseUrl, criteria, seenAt);
    if (listing) {
      listings.push(listing);
    }
  }

  return uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);
}

export class IdealistaConnector implements ConnectorAdapter {
  readonly portal = "idealista" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxListings: number;
  private readonly maxRequests: number;

  constructor(options: IdealistaConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? IDEALISTA_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 350;
    this.maxListings = options.maxListings ?? DEFAULT_MAX_LISTINGS;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const candidatePaths = buildCandidatePaths(criteria).slice(0, this.maxRequests);
    if (candidatePaths.length === 0) {
      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "idealista has no candidate paths for the provided criteria.",
        true,
        "idealista"
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

      if (response.status === 429) {
        rateLimitedCount += 1;
        warnings.push(`idealista rate-limited path: ${path}`);
        continue;
      }

      const body = await response.text();

      if (response.status === 403) {
        blockedCount += 1;
        const cid = extractDatadomeCid(body, response);
        warnings.push(
          cid
            ? `idealista blocked path: ${path} (cid=${cid})`
            : `idealista blocked path: ${path}`
        );
        continue;
      }

      if (response.status === 404) {
        warnings.push(`idealista path not found: ${path}`);
        continue;
      }

      if (!response.ok) {
        warnings.push(`idealista request ${path} returned HTTP ${response.status}`);
        continue;
      }

      if (looksLikeIdealistaChallenge(body)) {
        blockedCount += 1;
        const cid = extractDatadomeCid(body, response);
        warnings.push(
          cid
            ? `idealista anti-bot challenge on path: ${path} (cid=${cid})`
            : `idealista anti-bot challenge on path: ${path}`
        );
        continue;
      }

      const parsed = parseListings(body, this.baseUrl, criteria, seenAt);
      if (parsed.length === 0) {
        warnings.push(`idealista returned no listing cards on path: ${path}`);
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
          `No strict city matches for "${criteria.city}" on idealista; returning broader listing set.`
        );
      }
    }

    const finalListings = cappedListings.slice(0, this.maxListings);
    if (finalListings.length === 0) {
      if (rateLimitedCount === candidatePaths.length) {
        throw new ConnectorError(
          "UPSTREAM_RATE_LIMIT",
          "idealista rate-limited all candidate requests.",
          true,
          "idealista"
        );
      }

      if (blockedCount === candidatePaths.length) {
        const cidWarning = warnings.find((warning) => warning.includes("cid="));
        throw new ConnectorError(
          "UPSTREAM_BLOCKED",
          cidWarning
            ? `idealista blocked automated access for all candidate paths (${cidWarning.match(/cid=([^\)\s]+)/)?.[1]}).`
            : "idealista blocked automated access for all candidate paths.",
          true,
          "idealista"
        );
      }

      throw new ConnectorError(
        "UPSTREAM_UNAVAILABLE",
        "idealista returned no usable listings for the provided criteria.",
        true,
        "idealista"
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

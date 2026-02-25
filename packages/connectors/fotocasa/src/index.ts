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

const FOTOCASA_BASE_URL = "https://www.fotocasa.es";
const DEFAULT_MAX_DETAIL_REQUESTS = 8;

export interface FotocasaConnectorOptions extends ScraperOptions {
  baseUrl?: string;
  maxDetailRequests?: number;
}

function pickMeta(html: string, key: string): string | null {
  const metaRegex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const match = html.match(metaRegex);
  if (!match?.[1]) {
    return null;
  }

  return stripTags(match[1]);
}

function pickCanonical(html: string): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1];
}

function pickPrice(html: string): number | null {
  const elementMatch = html.match(/class=["'][^"']*re-DetailHeader-price[^"']*["'][^>]*>([^<]+)</i);
  if (elementMatch?.[1]) {
    const parsed = parsePriceNumber(elementMatch[1]);
    if (parsed !== null) {
      return parsed;
    }
  }

  const jsonMatch = html.match(/"price"\s*:\s*"?(\d[\d.,]*)"?/i);
  if (jsonMatch?.[1]) {
    return parsePriceNumber(jsonMatch[1]);
  }

  return null;
}

function extractListingPaths(html: string): string[] {
  const pattern = /\/es\/(?:comprar|alquilar)\/vivienda\/[^"'\s]+?\/\d+\/d/gi;
  const matches = html.match(pattern) ?? [];
  return uniqueStrings(matches);
}

function extractListingId(pathOrUrl: string): string {
  const match = pathOrUrl.match(/\/(\d+)\/d(?:$|[/?#])/);
  if (match?.[1]) {
    return match[1];
  }

  return slugify(pathOrUrl).replace(/-/g, "_") || `anon_${Date.now()}`;
}

function cityFromPath(pathname: string): string {
  const match = pathname.match(/\/vivienda\/([^/]+)\//i);
  if (!match?.[1]) {
    return "Unknown";
  }

  return match[1]
    .split("-")
    .filter((token) => token.length > 0)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildSearchUrl(baseUrl: string, criteria: NormalizedFilters): string {
  const mode = criteria.transaction_type === "rent" ? "alquilar" : "comprar";
  const locationSlug = criteria.city ? slugify(criteria.city) : "espana";
  return `${baseUrl}/es/${mode}/viviendas/${locationSlug}/todas-las-zonas/l`;
}

export class FotocasaConnector implements ConnectorAdapter {
  readonly portal = "fotocasa" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestDelayMs: number;
  private readonly maxDetailRequests: number;

  constructor(options: FotocasaConnectorOptions = {}) {
    this.baseUrl = options.baseUrl ?? FOTOCASA_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestDelayMs = options.requestDelayMs ?? 300;
    this.maxDetailRequests = options.maxDetailRequests ?? DEFAULT_MAX_DETAIL_REQUESTS;
  }

  async search(criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    const warnings: string[] = [];
    const listingSeenAt = listingNowIso();
    const searchUrl = buildSearchUrl(this.baseUrl, criteria);

    const searchResponse = await this.fetchImpl(searchUrl, {
      headers: browserHeaders({ requestDelayMs: this.requestDelayMs })
    });
    const searchHtml = await searchResponse.text();

    if (searchResponse.status === 429) {
      throw new ConnectorError("UPSTREAM_RATE_LIMIT", "fotocasa rate limited search request.", true, "fotocasa");
    }

    if (searchResponse.status === 401 || searchResponse.status === 403) {
      throw new ConnectorError("UPSTREAM_BLOCKED", "fotocasa blocked search request.", true, "fotocasa");
    }

    assertNotBotBlocked(searchHtml, "fotocasa");

    const listingPaths = extractListingPaths(searchHtml).slice(0, this.maxDetailRequests);
    if (listingPaths.length === 0) {
      warnings.push("fotocasa search page returned no listing links (possible anti-bot or markup change).");
    }

    const listings: ListingCard[] = [];

    for (const [index, listingPath] of listingPaths.entries()) {
      if (index > 0) {
        await sleep(this.requestDelayMs);
      }

      const detailUrl = toAbsoluteUrl(listingPath, this.baseUrl);
      const response = await this.fetchImpl(detailUrl, {
        headers: browserHeaders({ requestDelayMs: this.requestDelayMs })
      });
      const html = await response.text();

      if (response.status === 429) {
        warnings.push(`fotocasa detail rate-limited: ${listingPath}`);
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        warnings.push(`fotocasa detail blocked: ${listingPath}`);
        continue;
      }

      try {
        assertNotBotBlocked(html, "fotocasa");
      } catch {
        warnings.push(`fotocasa anti-bot page detected in detail: ${listingPath}`);
        continue;
      }

      const canonical = pickCanonical(html) ?? detailUrl;
      const parsedUrl = new URL(canonical);
      const portalListingId = extractListingId(parsedUrl.pathname);

      const title = pickMeta(html, "og:title") ?? `Vivienda ${portalListingId}`;
      const description = pickMeta(html, "og:description") ?? "";
      const image = pickMeta(html, "og:image");
      const price = pickPrice(html);
      const rooms = parseRoomsFromText(`${title} ${description}`);
      const propertyType = inferPropertyTypeFromText(`${title} ${description}`);

      listings.push({
        canonical_id: `fotocasa-${portalListingId}`,
        portal: "fotocasa",
        portal_listing_id: portalListingId,
        url: parsedUrl.toString(),
        title,
        city: cityFromPath(parsedUrl.pathname),
        price_eur: price,
        rooms,
        property_type: propertyType,
        image_urls: image ? [image] : [],
        last_seen_at: listingSeenAt,
        score: 0,
        why_matched: [],
        description,
        tags: inferTagsFromDescription(description),
        capacity_people: null,
        raw: {
          source_path: parsedUrl.pathname,
          chars: rooms !== null ? [`${rooms} habs.`] : []
        }
      });
    }

    const uniqueListings = uniqueBy(listings, (listing) => `${listing.portal}:${listing.portal_listing_id}`);

    return {
      listings: uniqueListings,
      diagnostics: {
        source: "scrape",
        connector_warnings: uniqueStrings(warnings)
      }
    };
  }
}

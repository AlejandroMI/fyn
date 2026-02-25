import {
  ConnectorError,
  type ConnectorSearchResult,
  type NormalizedFilters,
  type PortalSource
} from "@fyn/domain";

export interface ConnectorAdapter {
  readonly portal: PortalSource;
  search(criteria: NormalizedFilters): Promise<ConnectorSearchResult>;
}

export interface ScraperOptions {
  fetchImpl?: typeof fetch;
  requestDelayMs?: number;
  maxRequests?: number;
  userAgent?: string;
  acceptLanguage?: string;
}

export const DEFAULT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

export function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

export function uniqueStrings(values: string[]): string[] {
  return uniqueBy(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    (value) => value.toLowerCase()
  );
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      const code = Number.parseInt(decimal, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&([a-z]+);/gi, (match, entity: string) => NAMED_ENTITIES[entity.toLowerCase()] ?? match);
}

export function stripTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parsePriceNumber(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

export function parseFiniteNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === "string" && raw.trim().length > 0) {
    const normalized = raw.replace(/[,.](?=\d{3}\b)/g, "");
    const value = Number(normalized);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function parseRoomsFromText(input: string): number | null {
  const match = input.match(/(\d+)\s*(?:habs?\.?|habitaciones?|dorm(?:itorios?)?|rooms?)/i);
  if (!match?.[1]) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function inferPropertyTypeFromText(input: string): "flat" | "house" | "office" | "land" | null {
  const value = input.toLowerCase();
  if (/(piso|flat|apart|atico|duplex|loft)/.test(value)) return "flat";
  if (/(casa|house|chalet|villa|adosad|paread|rural)/.test(value)) return "house";
  if (/(oficina|office|despacho)/.test(value)) return "office";
  if (/(suelo|land|solar|terreno|plot|finca rustica|finca rústica)/.test(value)) return "land";
  return null;
}

export function inferTagsFromDescription(description: string): string[] {
  const tags: string[] = [];

  if (/(luz natural|natural light|luminos[oa]s?|bright|well[- ]lit|solead[oa])/i.test(description)) {
    tags.push("natural_light");
  }

  if (/\b(exterior|outside[- ]facing|toda exterior|todo exterior)\b/i.test(description)) {
    tags.push("exterior");
  }

  if (/(ventanales?|large windows|big windows)/i.test(description)) {
    tags.push("large_windows");
  }

  if (/(orientaci[oó]n|south[- ]facing|east[- ]facing|west[- ]facing)/i.test(description)) {
    tags.push("good_orientation");
  }

  if (/(naturaleza|nature|entorno natural|rural|monta(?:n|ñ)a|bosque|countryside)/i.test(description)) {
    tags.push("nature");
  }

  if (/(vistas|views?|panor[aá]m)/i.test(description)) tags.push("views");
  if (/(retiro|retreat)/i.test(description)) tags.push("retreat");
  if (/(reforma|renov)/i.test(description)) tags.push("renovation");

  return Array.from(new Set(tags));
}

export function looksLikeBotBlockPage(html: string): boolean {
  return /(pardon our interruption|enable javascript|captcha|access denied|forbidden|datadome|sentimos la interrupci[oó]n)/i.test(
    html
  );
}

export function assertNotBotBlocked(html: string, portal: PortalSource): void {
  if (looksLikeBotBlockPage(html)) {
    throw new ConnectorError(
      "UPSTREAM_BLOCKED",
      `${portal} blocked automated access (anti-bot/captcha).`,
      true,
      portal
    );
  }
}

export function toAbsoluteUrl(pathOrUrl: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return new URL(pathOrUrl, baseUrl).toString();
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function listingNowIso(): string {
  return new Date().toISOString();
}

export function browserHeaders(options: ScraperOptions): Record<string, string> {
  return {
    "User-Agent": options.userAgent ?? DEFAULT_BROWSER_USER_AGENT,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": options.acceptLanguage ?? "es-ES,es;q=0.9,en;q=0.7"
  };
}

export class BlockedPortalConnector implements ConnectorAdapter {
  readonly portal: PortalSource;
  private readonly reason: string;

  constructor(portal: PortalSource, reason: string) {
    this.portal = portal;
    this.reason = reason;
  }

  async search(_criteria: NormalizedFilters): Promise<ConnectorSearchResult> {
    throw new ConnectorError("UPSTREAM_BLOCKED", this.reason, true, this.portal);
  }
}

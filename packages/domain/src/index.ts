export type PropertyType = "flat" | "house" | "office" | "land";
export type Locale = "es" | "en";
export type TransactionType = "buy" | "rent";

export interface SearchInput {
  query_text?: string;
  locale?: Locale;
  transaction_type?: TransactionType;
  property_types?: PropertyType[];
  city?: string;
  locations?: string[];
  nearby_towns?: boolean;
  min_rooms?: number;
  min_capacity_people?: number;
  max_price_eur?: number;
  min_floor?: number;
  exclude_ground_floor?: boolean;
  prefer_exterior?: boolean;
  strict_constraints?: boolean;
  renovation_ok?: boolean;
  tags?: string[];
}

export interface NormalizedFilters {
  locale: Locale;
  transaction_type?: TransactionType;
  property_types: PropertyType[];
  city?: string;
  nearby_towns: boolean;
  min_rooms?: number;
  min_capacity_people?: number;
  max_price_eur?: number;
  min_floor?: number;
  exclude_ground_floor?: boolean;
  prefer_exterior?: boolean;
  strict_constraints?: boolean;
  renovation_ok: boolean;
  tags: string[];
  original_query?: string;
}

export interface ListingCard {
  canonical_id: string;
  portal: "pisos";
  portal_listing_id: string;
  url: string;
  title: string;
  city: string;
  price_eur: number | null;
  rooms: number | null;
  property_type: PropertyType | null;
  image_urls: string[];
  last_seen_at: string;
  score: number;
  why_matched: string[];
  description?: string;
  tags?: string[];
  capacity_people?: number | null;
  raw?: Record<string, unknown>;
}

export type ConnectorErrorCode =
  | "MISSING_API_KEY"
  | "AUTH_REJECTED"
  | "UPSTREAM_RATE_LIMIT"
  | "UPSTREAM_SCHEMA_CHANGED";

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly retryable: boolean;
  readonly source_portal = "pisos" as const;

  constructor(code: ConnectorErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "ConnectorError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface SearchDiagnostics {
  source: "live" | "scrape" | "fixture";
  request_warnings: string[];
  connector_warnings: string[];
  total_candidates: number;
  returned_count: number;
}

export interface SearchResult {
  criteria: NormalizedFilters;
  listings: ListingCard[];
  diagnostics: SearchDiagnostics;
}

export interface ConnectorSearchResult {
  listings: ListingCard[];
  diagnostics: Omit<SearchDiagnostics, "request_warnings" | "total_candidates" | "returned_count">;
}

export const SEARCH_PROPERTIES_TOOL_TITLE = "Search Properties (Model-Driven)";
export const SEARCH_PROPERTIES_TOOL_DESCRIPTION =
  "Use this when the user wants to find, compare, or shortlist Spanish properties (flat, house, office, land) for buy/rent using location, budget, rooms, floor, and lifestyle preferences (e.g. nature, views, natural light). LLM must provide `city` or, for broad requests, plan and send `locations[]` (recommended 3-10); `query_text` is contextual only and is never a substitute for location constraints. Returns normalized listings with portal links, prices, photos, explainability (`why_matched`), presentation cards, and execution diagnostics including per-location coverage.";

export const SEARCH_PROPERTIES_FIELD_DESCRIPTIONS = {
  query_text:
    "Optional context only. Do not use as the only input; always send structured constraints.",
  locale: "Response locale for cards and formatting (`es` or `en`).",
  transaction_type: "Transaction mode (`buy` or `rent`).",
  property_types: "Property types (`flat`, `house`, `office`, `land`).",
  city: "Single location search target. Prefer `locations[]` for broad or exploratory intent.",
  locations: "Primary geography control. Provide 3-10 cities/towns for broad searches.",
  nearby_towns: "Allow nearby towns around each requested location.",
  min_rooms: "Minimum bedrooms.",
  min_capacity_people: "Minimum people capacity.",
  max_price_eur: "Maximum budget in EUR.",
  min_floor: "Minimum floor index (0 = ground).",
  exclude_ground_floor: "Exclude ground-floor properties.",
  prefer_exterior: "Boost exterior properties when true.",
  strict_constraints:
    "Default true. When true and no location is provided, the tool returns guidance instead of discovery fallback.",
  renovation_ok: "Allow renovation-needed listings.",
  tags: "Preference tags (e.g. `nature`, `views`, `natural_light`).",
  sources: "Source portals. Current deployment supports only `pisos`.",
  per_location_limit: "Max candidates kept per requested location before global rerank.",
  max_results_total: "Max returned listings after global rerank."
} as const;

export const SEARCH_PROPERTIES_MISSING_LOCATION_WARNING =
  "No `city` or `locations[]` provided. Discovery search is disabled when `strict_constraints=true`.";
export const SEARCH_PROPERTIES_MISSING_LOCATION_ACTION =
  "Model action required: choose candidate cities/towns and retry with `locations[]` (recommended 3-10).";
export const SEARCH_PROPERTIES_MISSING_LOCATION_RETRY_HINT =
  "Send `locations[]` (recommended 3-10) or a single `city` and call the tool again.";
export const SEARCH_PROPERTIES_CONTEXT_ONLY_WARNING =
  "`query_text` is contextual only. In strict structured mode, geography must be explicit.";

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

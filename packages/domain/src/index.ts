export type PropertyType = "flat" | "house" | "office" | "land";
export type Locale = "es" | "en";
export type TransactionType = "buy" | "rent";
export type PortalSource =
  | "pisos"
  | "fotocasa"
  | "tucasa"
  | "idealista"
  | "habitaclia"
  | "yaencontre"
  | "milanuncios"
  | "globaliza"
  | "hogaria"
  | "pisocompartido"
  | "enalquiler";

export const SUPPORTED_PORTAL_SOURCES: PortalSource[] = [
  "pisos",
  "fotocasa",
  "tucasa",
  "idealista",
  "habitaclia",
  "yaencontre",
  "milanuncios",
  "globaliza",
  "hogaria",
  "pisocompartido",
  "enalquiler"
];

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
  sources?: PortalSource[];
  per_location_limit?: number;
  max_results_total?: number;
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
  portal: PortalSource;
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
  | "UPSTREAM_SCHEMA_CHANGED"
  | "UPSTREAM_BLOCKED"
  | "UPSTREAM_UNAVAILABLE";

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly retryable: boolean;
  readonly source_portal: PortalSource;

  constructor(code: ConnectorErrorCode, message: string, retryable = false, sourcePortal: PortalSource = "pisos") {
    super(message);
    this.name = "ConnectorError";
    this.code = code;
    this.retryable = retryable;
    this.source_portal = sourcePortal;
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
  "Use this when the user wants to find, compare, or shortlist Spanish properties (flat, house, office, land) for buy/rent using location, budget, rooms, floor, and lifestyle preferences (e.g. nature, views, natural light). LLM must provide `city` or, for broad requests, plan and send `locations[]` (recommended 3-10); `query_text` is contextual only and is never a substitute for location constraints. Returns normalized listings with portal links, prices, photos, explainability (`why_matched`), presentation cards, and execution diagnostics including per-location and per-source coverage.";

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
  sources:
    "Source portals to query (e.g. `pisos`, `idealista`, `habitaclia`, `fotocasa`, `tucasa`, `yaencontre`, `milanuncios`, `globaliza`, `hogaria`, `pisocompartido`, `enalquiler`). Include multiple for aggregator behavior.",
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

export const SEARCH_PROPERTIES_WIDGET_RESOURCE_URI =
  "ui://widget/fyn-search-results-v1.html";
export const SEARCH_PROPERTIES_WIDGET_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
export const SEARCH_PROPERTIES_TOOL_INVOKING_LABEL = "Searching Fyn listings...";
export const SEARCH_PROPERTIES_TOOL_INVOKED_LABEL = "Listings ready.";
export const SEARCH_PROPERTIES_WIDGET_MODEL_DESCRIPTION =
  "Interactive Fyn shortlist with map + cards, prices, and source links.";

export function buildSearchPropertiesToolMeta(): Record<string, unknown> {
  return {
    ui: {
      resourceUri: SEARCH_PROPERTIES_WIDGET_RESOURCE_URI,
      visibility: ["model", "app"]
    },
    "openai/outputTemplate": SEARCH_PROPERTIES_WIDGET_RESOURCE_URI,
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": SEARCH_PROPERTIES_TOOL_INVOKING_LABEL,
    "openai/toolInvocation/invoked": SEARCH_PROPERTIES_TOOL_INVOKED_LABEL
  };
}

export function buildSearchPropertiesWidgetResourceMeta(): Record<string, unknown> {
  const csp = {
    connectDomains: [
      "https://tile.openstreetmap.org",
      "https://a.tile.openstreetmap.org",
      "https://b.tile.openstreetmap.org",
      "https://c.tile.openstreetmap.org"
    ],
    resourceDomains: [
      "https://unpkg.com",
      "https://tile.openstreetmap.org",
      "https://a.tile.openstreetmap.org",
      "https://b.tile.openstreetmap.org",
      "https://c.tile.openstreetmap.org",
      "https://fotos.imghs.net",
      "https://st3.idealista.com",
      "https://www.pisos.com",
      "https://www.fotocasa.es",
      "https://img4.idealista.com",
      "https://www.tucasa.com",
      "https://www.habitaclia.com",
      "https://images.habimg.com",
      "https://static.habimg.com",
      "https://www.yaencontre.com",
      "https://cdn1-static2.yaencontre.com",
      "https://www.milanuncios.com",
      "https://images-re.milanuncios.com",
      "https://www.globaliza.com",
      "https://img.resemmedia.com",
      "https://script.resemmedia.com",
      "https://images.proppit.com",
      "https://www.hogaria.net",
      "https://www.pisocompartido.com",
      "https://www.enalquiler.com",
      "https://images.enalquiler.com"
    ]
  };

  return {
    ui: {
      prefersBorder: false,
      csp
    },
    "openai/widgetDescription": SEARCH_PROPERTIES_WIDGET_MODEL_DESCRIPTION,
    "openai/widgetPrefersBorder": false,
    "openai/widgetCSP": {
      connect_domains: csp.connectDomains,
      resource_domains: csp.resourceDomains
    }
  };
}

export const SEARCH_PROPERTIES_WIDGET_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fyn results</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #ffffff;
        --text: #111827;
        --muted: #6b7280;
        --line: #eceff3;
        --surface: #f9fafb;
        --accent: #111111;
        --accent-ink: #ffffff;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #101214;
          --text: #f3f4f6;
          --muted: #9ca3af;
          --line: #2b3038;
          --surface: #161a20;
          --accent: #f3f4f6;
          --accent-ink: #111111;
        }
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
      }

      body {
        background: transparent;
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .app {
        max-width: 920px;
        margin: 0 auto;
        padding: 12px;
        display: grid;
        gap: 12px;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .brand-mark {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #9ca3af;
      }

      .brand-copy {
        min-width: 0;
      }

      .brand-title {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.25;
        font-weight: 600;
      }

      .brand-subtitle {
        margin: 2px 0 0;
        color: var(--muted);
        font-size: 0.78rem;
      }

      .top-action {
        border: 0;
        background: var(--surface);
        color: var(--text);
        border-radius: 10px;
        font-size: 0.78rem;
        padding: 0.45rem 0.7rem;
        cursor: pointer;
      }

      .top-action:disabled {
        cursor: default;
        opacity: 0.5;
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .segmented {
        display: inline-flex;
        background: var(--surface);
        border-radius: 10px;
        padding: 2px;
      }

      .segmented button {
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: var(--muted);
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0.35rem 0.6rem;
        cursor: pointer;
      }

      .segmented button[aria-selected="true"] {
        background: var(--bg);
        color: var(--text);
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
      }

      .meta {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .meta-pill {
        border: 0;
        border-radius: 999px;
        padding: 0.24rem 0.5rem;
        font-size: 0.73rem;
        color: var(--muted);
        background: var(--surface);
      }

      .panel {
        border: 0;
        border-radius: 12px;
        background: var(--surface);
        overflow: hidden;
      }

      .panel[hidden] {
        display: none !important;
      }

      .compact {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(280px, 320px);
        gap: 12px;
        overflow-x: auto;
        padding: 12px;
        scroll-snap-type: x mandatory;
      }

      .compact-card {
        background: var(--bg);
        border-radius: 10px;
        overflow: hidden;
        display: grid;
        scroll-snap-align: start;
      }

      .compact-media {
        border: 0;
        padding: 0;
        margin: 0;
        background: transparent;
        cursor: pointer;
        text-align: left;
      }

      .compact-image {
        width: 100%;
        height: 220px;
        object-fit: cover;
        display: block;
      }

      .compact-empty {
        width: 100%;
        height: 220px;
        background: var(--surface);
      }

      .compact-body {
        padding: 10px;
        display: grid;
        gap: 5px;
      }

      .compact-title {
        margin: 0;
        font-size: 0.86rem;
        line-height: 1.3;
      }

      .compact-meta {
        margin: 0;
        font-size: 0.75rem;
        color: var(--muted);
      }

      .map-root {
        height: 320px;
        width: 100%;
        overflow: hidden;
        background: var(--surface);
        pointer-events: auto;
      }

      .map-root,
      .map-root .leaflet-container {
        touch-action: pan-x pan-y;
      }

      .map-note {
        margin: 0;
        padding: 8px 10px;
        color: var(--muted);
        font-size: 0.74rem;
      }

      .list {
        display: grid;
      }

      .card {
        display: grid;
        grid-template-columns: 116px 1fr auto;
        gap: 10px;
        padding: 10px;
        align-items: start;
        border-bottom: 1px solid var(--line);
      }

      .card:last-child {
        border-bottom: 0;
      }

      .card-media {
        border: 0;
        padding: 0;
        margin: 0;
        background: transparent;
        cursor: pointer;
        text-align: left;
      }

      .card-image {
        width: 100%;
        height: 88px;
        border-radius: 8px;
        object-fit: cover;
        background: var(--surface);
        display: block;
      }

      .card-main {
        min-width: 0;
      }

      .card-title {
        margin: 0;
        font-size: 0.91rem;
        line-height: 1.3;
      }

      .card-title-button {
        border: 0;
        background: transparent;
        padding: 0;
        margin: 0;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .card-title-button:hover {
        text-decoration: underline;
      }

      .card-title a {
        color: inherit;
        text-decoration: none;
      }

      .card-title a:hover {
        text-decoration: underline;
      }

      .card-meta {
        margin-top: 4px;
        font-size: 0.8rem;
        color: var(--muted);
      }

      .facts {
        margin-top: 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      .fact {
        border-radius: 999px;
        border: 0;
        padding: 0.15rem 0.45rem;
        font-size: 0.7rem;
        color: var(--muted);
        background: var(--surface);
      }

      .why {
        margin-top: 6px;
        font-size: 0.72rem;
        color: var(--muted);
      }

      .score {
        border: 0;
        border-radius: 999px;
        padding: 0.2rem 0.45rem;
        font-size: 0.72rem;
        color: var(--text);
        white-space: nowrap;
        background: var(--surface);
      }

      .card-actions {
        display: grid;
        justify-items: end;
        align-content: start;
        gap: 8px;
      }

      .card-cta {
        border: 0;
        background: var(--accent);
        color: var(--accent-ink);
        border-radius: 999px;
        padding: 0.36rem 0.68rem;
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }

      .card-cta:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }

      .empty {
        margin: 10px;
        padding: 12px;
        border-radius: 10px;
        color: var(--muted);
        font-size: 0.8rem;
        background: var(--surface);
      }

      .popup-title {
        margin: 0 0 3px;
        font-size: 0.82rem;
      }

      .popup-meta {
        margin: 0 0 7px;
        color: #4b5563;
        font-size: 0.73rem;
      }

      .popup-link {
        color: var(--accent);
        font-size: 0.73rem;
        text-decoration: underline;
        cursor: pointer;
      }

      @media (max-width: 760px) {
        .compact {
          grid-auto-columns: minmax(78vw, 88vw);
        }

        .compact-image,
        .compact-empty {
          height: 210px;
        }

        .header {
          flex-direction: column;
          align-items: flex-start;
        }

        .top-action {
          width: 100%;
        }

        .toolbar {
          flex-direction: column;
          align-items: flex-start;
        }

        .meta {
          justify-content: flex-start;
        }

        .card {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .card-image {
          height: 150px;
        }

        .card-actions {
          grid-auto-flow: column;
          justify-content: space-between;
          justify-items: start;
          align-items: center;
        }
      }
    </style>
  </head>
  <body>
    <main class="app">
      <section class="header">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          <div class="brand-copy">
            <h1 class="brand-title">Fyn shortlist</h1>
            <p id="headerSubtitle" class="brand-subtitle">No listings yet.</p>
          </div>
        </div>
        <button id="openTopBtn" class="top-action" type="button" disabled>Open top match</button>
      </section>

      <section class="toolbar">
        <div class="segmented" role="tablist" aria-label="View mode">
          <button id="listTab" role="tab" type="button" aria-selected="false">List</button>
          <button id="compactTab" role="tab" type="button" aria-selected="true">Compact</button>
          <button id="mapTab" role="tab" type="button" aria-selected="false">Map</button>
        </div>
        <div class="meta">
          <span id="countPill" class="meta-pill">0 results</span>
          <span id="locationPill" class="meta-pill">locations: 0</span>
          <span id="sourcePill" class="meta-pill">source: --</span>
        </div>
      </section>

      <section id="compactPanel" class="panel">
        <div id="compactRoot" class="compact"></div>
      </section>

      <section id="mapPanel" class="panel" hidden>
        <div id="mapRoot" class="map-root"></div>
        <p class="map-note">Map uses city-level placement unless exact portal coordinates are available in result metadata.</p>
      </section>

      <section id="listPanel" class="panel" hidden>
        <div id="listRoot" class="list"></div>
      </section>
    </main>

    <script>
      (function () {
        var CITY_COORDS = {
          valencia: [39.4699, -0.3763],
          madrid: [40.4168, -3.7038],
          barcelona: [41.3874, 2.1686],
          sevilla: [37.3891, -5.9845],
          malaga: [36.7213, -4.4214],
          bilbao: [43.263, -2.935],
          alicante: [38.3452, -0.481],
          granada: [37.1773, -3.5986],
          ronda: [36.7423, -5.1671],
          "cangas de onis": [43.3506, -5.1266],
          albarracin: [40.4077, -1.4447],
          cudillero: [43.5637, -6.1451],
          grazalema: [36.7582, -5.3661]
        };

        var state = {
          cards: [],
          criteria: null,
          diagnostics: null,
          view: "compact"
        };

        var leafletPromise = null;
        var map = null;
        var markerLayer = null;

        var listTab = document.getElementById("listTab");
        var compactTab = document.getElementById("compactTab");
        var mapTab = document.getElementById("mapTab");
        var listPanel = document.getElementById("listPanel");
        var compactPanel = document.getElementById("compactPanel");
        var mapPanel = document.getElementById("mapPanel");
        var listRoot = document.getElementById("listRoot");
        var compactRoot = document.getElementById("compactRoot");
        var mapRoot = document.getElementById("mapRoot");
        var headerSubtitle = document.getElementById("headerSubtitle");
        var countPill = document.getElementById("countPill");
        var locationPill = document.getElementById("locationPill");
        var sourcePill = document.getElementById("sourcePill");
        var openTopBtn = document.getElementById("openTopBtn");

        function notifyHeight() {
          if (window.openai && typeof window.openai.notifyIntrinsicHeight === "function") {
            window.openai.notifyIntrinsicHeight(document.body.scrollHeight);
          }
        }

        function escapeHtml(value) {
          return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        }

        function normalize(value) {
          return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\\u0300-\\u036f]/g, "")
            .replace(/[^a-z0-9\\s-]/g, " ")
            .replace(/\\s+/g, " ")
            .trim();
        }

        function hash(value) {
          var input = String(value || "");
          var h = 0;
          for (var i = 0; i < input.length; i += 1) {
            h = (h * 31 + input.charCodeAt(i)) >>> 0;
          }
          return h;
        }

        function openExternal(url) {
          if (!url) {
            return;
          }
          if (window.openai && typeof window.openai.openExternal === "function") {
            window.openai.openExternal({ href: url, redirectUrl: false });
            return;
          }
          window.open(url, "_blank", "noopener,noreferrer");
        }

        function isSpanish() {
          return !!(state.criteria && state.criteria.locale === "es");
        }

        function ctaLabel() {
          return isSpanish() ? "Abrir" : "Open";
        }

        function locationLabelFromCard(card) {
          var city = card && typeof card.city === "string" ? card.city : "";
          if (!city) {
            return "Unknown";
          }
          return city.split("(")[0].split(",")[0].trim() || city.trim();
        }

        function maybeRawCoordinate(card) {
          if (
            card &&
            typeof card.latitude === "number" &&
            typeof card.longitude === "number" &&
            Number.isFinite(card.latitude) &&
            Number.isFinite(card.longitude) &&
            Math.abs(card.latitude) <= 90 &&
            Math.abs(card.longitude) <= 180
          ) {
            return [card.latitude, card.longitude];
          }

          var raw = card && card.raw && typeof card.raw === "object" ? card.raw : null;
          if (!raw) {
            return null;
          }

          var latCandidates = ["lat", "latitude", "geo_lat", "location_lat"];
          var lonCandidates = ["lng", "lon", "longitude", "geo_lng", "location_lng"];
          var lat = null;
          var lon = null;

          for (var i = 0; i < latCandidates.length; i += 1) {
            var latValue = raw[latCandidates[i]];
            if (typeof latValue === "number") {
              lat = latValue;
              break;
            }
            if (typeof latValue === "string" && latValue.trim()) {
              lat = Number(latValue);
              break;
            }
          }

          for (var j = 0; j < lonCandidates.length; j += 1) {
            var lonValue = raw[lonCandidates[j]];
            if (typeof lonValue === "number") {
              lon = lonValue;
              break;
            }
            if (typeof lonValue === "string" && lonValue.trim()) {
              lon = Number(lonValue);
              break;
            }
          }

          if (
            typeof lat === "number" &&
            typeof lon === "number" &&
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            Math.abs(lat) <= 90 &&
            Math.abs(lon) <= 180
          ) {
            return [lat, lon];
          }

          return null;
        }

        function centerForCity(cityLabel) {
          var key = normalize(cityLabel);
          if (CITY_COORDS[key]) {
            return CITY_COORDS[key];
          }
          var h = hash(key || "spain");
          var lat = 36.0 + ((h % 7000) / 7000) * 7.7;
          var lon = -9.2 + (((Math.floor(h / 7000) % 11000) / 11000) * 12.0);
          return [lat, lon];
        }

        function coordinateForCard(card, index) {
          var exact = maybeRawCoordinate(card);
          if (exact) {
            return exact;
          }

          var center = centerForCity(locationLabelFromCard(card));
          var h = hash((card && card.canonical_id) || String(index));
          var jitterLat = (((h % 200) - 100) / 100) * 0.012;
          var jitterLon = ((((Math.floor(h / 200) % 200) - 100) / 100) * 0.014);
          return [center[0] + jitterLat, center[1] + jitterLon];
        }

        function ensureLeaflet() {
          if (window.L) {
            return Promise.resolve(window.L);
          }
          if (leafletPromise) {
            return leafletPromise;
          }

          leafletPromise = new Promise(function (resolve, reject) {
            if (!document.querySelector('link[data-fyn-leaflet="css"]')) {
              var link = document.createElement("link");
              link.rel = "stylesheet";
              link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
              link.setAttribute("data-fyn-leaflet", "css");
              document.head.appendChild(link);
            }

            var script = document.createElement("script");
            script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
            script.async = true;
            script.onload = function () {
              if (window.L) {
                resolve(window.L);
              } else {
                reject(new Error("Leaflet unavailable"));
              }
            };
            script.onerror = function () {
              reject(new Error("Leaflet failed to load"));
            };
            document.head.appendChild(script);
          });

          return leafletPromise;
        }

        function markerPopup(card) {
          return (
            '<div>' +
            '<p class="popup-title">' + escapeHtml(card.title || "Listing") + "</p>" +
            '<p class="popup-meta">' + escapeHtml((card.price || "") + " - " + (card.city || "")) + "</p>" +
            '<a class="popup-link" href="' + escapeHtml(card.url || "#") + '" data-url="' + escapeHtml(card.url || "") + '">Open listing</a>' +
            "</div>"
          );
        }

        async function renderMap() {
          if (!state.cards.length) {
            mapRoot.innerHTML = '<div class="empty">No map points available.</div>';
            return;
          }

          try {
            var L = await ensureLeaflet();
            if (!map) {
              mapRoot.innerHTML = "";
              map = L.map(mapRoot, { scrollWheelZoom: true, zoomControl: true });
              L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap contributors"
              }).addTo(map);
              markerLayer = L.layerGroup().addTo(map);
            }

            markerLayer.clearLayers();
            var bounds = [];

            state.cards.forEach(function (card, index) {
              var point = coordinateForCard(card, index);
              var marker = L.marker([point[0], point[1]], {
                title: card.title || "Listing"
              });
              marker.bindPopup(markerPopup(card));
              marker.on("popupopen", function (event) {
                var popupEl = event.popup && event.popup.getElement ? event.popup.getElement() : null;
                if (!popupEl) {
                  return;
                }
                var links = popupEl.querySelectorAll("a[data-url]");
                for (var i = 0; i < links.length; i += 1) {
                  links[i].addEventListener("click", function (clickEvent) {
                    clickEvent.preventDefault();
                    openExternal(this.getAttribute("data-url") || "");
                  });
                }
              });
              marker.addTo(markerLayer);
              bounds.push([point[0], point[1]]);
            });

            if (bounds.length === 1) {
              map.setView(bounds[0], 10);
            } else {
              map.fitBounds(bounds, { padding: [24, 24] });
            }

            setTimeout(function () {
              if (map) {
                map.invalidateSize();
              }
            }, 0);
          } catch (_error) {
            mapRoot.innerHTML = '<div class="empty">Map failed to load in this environment.</div>';
          }
        }

        function cardHtml(card) {
          var facts = Array.isArray(card.facts) ? card.facts : [];
          var why = Array.isArray(card.why_matched) ? card.why_matched : [];
          var image = card.image_url
            ? '<button class="card-media" type="button" data-open-url="' + escapeHtml(card.url || "") + '" aria-label="' + escapeHtml(card.title || "Open listing") + '"><img class="card-image" src="' + escapeHtml(card.image_url) + '" alt="' + escapeHtml(card.title || "Property image") + '" loading="lazy" referrerpolicy="no-referrer" /></button>'
            : '<button class="card-media" type="button" data-open-url="' + escapeHtml(card.url || "") + '" aria-label="' + escapeHtml(card.title || "Open listing") + '"><div class="card-image" aria-hidden="true"></div></button>';

          var factsHtml = facts
            .slice(0, 5)
            .map(function (fact) {
              return '<span class="fact">' + escapeHtml(fact) + "</span>";
            })
            .join("");

          var whyHtml = why.length > 0 ? '<p class="why">' + escapeHtml(why.join(" | ")) + "</p>" : "";

          return (
            '<article class="card">' +
            image +
            '<div class="card-main">' +
            '<h2 class="card-title"><button class="card-title-button" type="button" data-open-url="' + escapeHtml(card.url || "") + '">' + escapeHtml(card.title || "Listing") + "</button></h2>" +
            '<p class="card-meta">' + escapeHtml((card.price || "Price unavailable") + " - " + (card.city || "Unknown")) + "</p>" +
            '<div class="facts">' + factsHtml + "</div>" +
            whyHtml +
            "</div>" +
            '<div class="card-actions">' +
            '<span class="score">' + escapeHtml(String(card.score || 0)) + "/100</span>" +
            '<button class="card-cta" type="button" data-open-url="' + escapeHtml(card.url || "") + '">' + escapeHtml(ctaLabel()) + "</button>" +
            "</div>" +
            "</article>"
          );
        }

        function compactCardHtml(card) {
          var image = card.image_url
            ? '<button class="compact-media" type="button" data-open-url="' + escapeHtml(card.url || "") + '" aria-label="' + escapeHtml(card.title || "Open listing") + '"><img class="compact-image" src="' + escapeHtml(card.image_url) + '" alt="' + escapeHtml(card.title || "Property image") + '" loading="lazy" referrerpolicy="no-referrer" /></button>'
            : '<button class="compact-media" type="button" data-open-url="' + escapeHtml(card.url || "") + '" aria-label="' + escapeHtml(card.title || "Open listing") + '"><div class="compact-empty" aria-hidden="true"></div></button>';

          return (
            '<article class="compact-card">' +
            image +
            '<div class="compact-body">' +
            '<h3 class="compact-title">' + escapeHtml(card.title || "Listing") + "</h3>" +
            '<p class="compact-meta">' + escapeHtml((card.price || "Price unavailable") + " - " + (card.city || "Unknown")) + "</p>" +
            '<button class="card-cta" type="button" data-open-url="' + escapeHtml(card.url || "") + '">' + escapeHtml(ctaLabel()) + "</button>" +
            "</div>" +
            "</article>"
          );
        }

        function renderList() {
          if (!state.cards.length) {
            listRoot.innerHTML = '<div class="empty">No listings to display. Try broader locations or loosen constraints.</div>';
            return;
          }
          listRoot.innerHTML = state.cards.map(cardHtml).join("");
        }

        function renderCompact() {
          if (!state.cards.length) {
            compactRoot.innerHTML = '<div class="empty">No listings to display. Try broader locations or loosen constraints.</div>';
            return;
          }
          compactRoot.innerHTML = state.cards.slice(0, 12).map(compactCardHtml).join("");
        }

        function renderMeta() {
          var count = state.cards.length;
          countPill.textContent = count + (count === 1 ? " result" : " results");

          var requestedLocations = [];
          if (state.diagnostics && state.diagnostics.execution && Array.isArray(state.diagnostics.execution.locations_requested)) {
            requestedLocations = state.diagnostics.execution.locations_requested;
          }
          locationPill.textContent = "locations: " + String(requestedLocations.length);

          var source = state.diagnostics && typeof state.diagnostics.source === "string"
            ? state.diagnostics.source
            : "--";
          sourcePill.textContent = "source: " + source;
        }

        function renderHeader() {
          var requestedLocations = [];
          if (state.diagnostics && state.diagnostics.execution && Array.isArray(state.diagnostics.execution.locations_requested)) {
            requestedLocations = state.diagnostics.execution.locations_requested;
          }
          if (!state.cards.length) {
            headerSubtitle.textContent = "No listings yet.";
            openTopBtn.disabled = true;
            return;
          }
          headerSubtitle.textContent =
            state.cards.length + " listings across " + requestedLocations.length + " requested locations.";
          openTopBtn.disabled = false;
        }

        function setView(view) {
          state.view = view === "map" || view === "compact" ? view : "list";
          var listActive = state.view === "list";
          var compactActive = state.view === "compact";
          var mapActive = state.view === "map";
          listTab.setAttribute("aria-selected", listActive ? "true" : "false");
          compactTab.setAttribute("aria-selected", compactActive ? "true" : "false");
          mapTab.setAttribute("aria-selected", mapActive ? "true" : "false");
          listPanel.hidden = !listActive;
          compactPanel.hidden = !compactActive;
          mapPanel.hidden = !mapActive;
          if (compactActive) {
            renderCompact();
          }
          if (mapActive) {
            renderMap();
          }
          notifyHeight();
        }

        function renderAll() {
          renderHeader();
          renderMeta();
          renderList();
          renderCompact();
          if (state.view === "map") {
            renderMap();
          }
          notifyHeight();
        }

        function applyToolOutput(output) {
          var safe = output && typeof output === "object" ? output : {};
          var cards = Array.isArray(safe.presentation_cards) ? safe.presentation_cards : [];
          state.cards = cards;
          state.criteria = safe.criteria && typeof safe.criteria === "object" ? safe.criteria : null;
          state.diagnostics = safe.diagnostics && typeof safe.diagnostics === "object" ? safe.diagnostics : null;
          renderAll();
        }

        function readInitialOutput() {
          if (window.openai && window.openai.toolOutput) {
            return window.openai.toolOutput;
          }
          return null;
        }

        listTab.addEventListener("click", function () {
          setView("list");
        });

        compactTab.addEventListener("click", function () {
          setView("compact");
        });

        mapTab.addEventListener("click", function () {
          setView("map");
        });

        document.body.addEventListener("click", function (event) {
          var target = event.target;
          if (!target || typeof target.closest !== "function") {
            return;
          }

          var clickable = target.closest("[data-open-url]");
          if (!clickable) {
            return;
          }

          var url = clickable.getAttribute("data-open-url") || "";
          if (!url) {
            return;
          }

          event.preventDefault();
          openExternal(url);
        });

        document.body.addEventListener("keydown", function (event) {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          var target = event.target;
          if (!target || typeof target.closest !== "function") {
            return;
          }

          var clickable = target.closest("[data-open-url]");
          if (!clickable) {
            return;
          }

          var url = clickable.getAttribute("data-open-url") || "";
          if (!url) {
            return;
          }

          event.preventDefault();
          openExternal(url);
        });

        openTopBtn.addEventListener("click", function () {
          if (!state.cards.length) {
            return;
          }
          openExternal(state.cards[0].url);
        });

        window.addEventListener(
          "openai:set_globals",
          function (event) {
            var detail = event && event.detail ? event.detail : {};
            var globals = detail.globals || {};
            if (globals.toolOutput) {
              applyToolOutput(globals.toolOutput);
            }
          },
          { passive: true }
        );

        window.addEventListener(
          "message",
          function (event) {
            if (event.source !== window.parent) {
              return;
            }
            var message = event.data;
            if (!message || message.jsonrpc !== "2.0") {
              return;
            }
            if (message.method === "ui/notifications/tool-result") {
              var params = message.params || {};
              if (params.structuredContent) {
                applyToolOutput(params.structuredContent);
              }
            }
            if (message.method === "ui/initialize") {
              var initParams = message.params || {};
              if (initParams.toolOutput) {
                applyToolOutput(initParams.toolOutput);
              }
            }
          },
          { passive: true }
        );

        window.addEventListener(
          "resize",
          function () {
            if (map) {
              map.invalidateSize();
            }
            notifyHeight();
          },
          { passive: true }
        );

        var initialOutput = readInitialOutput();
        if (initialOutput) {
          applyToolOutput(initialOutput);
        } else {
          renderAll();
        }
      })();
    </script>
  </body>
</html>
`;

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
  return {
    ui: {
      prefersBorder: true
    },
    "openai/widgetDescription": SEARCH_PROPERTIES_WIDGET_MODEL_DESCRIPTION,
    "openai/widgetPrefersBorder": true
  };
}

export const SEARCH_PROPERTIES_WIDGET_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fyn Results</title>
    <style>
      :root {
        --ink: #0f2f31;
        --muted: #42606b;
        --surface: #f6f8f3;
        --card: rgba(255, 255, 255, 0.88);
        --stroke: rgba(19, 51, 58, 0.14);
        --lime: #b8d97c;
        --sky: #6eaac8;
        --peach: #e8bf8f;
        --teal: #2f6d74;
        --shadow: 0 16px 36px rgba(22, 48, 56, 0.12);
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
        min-height: 100vh;
        font-family: "Avenir Next", "Manrope", "Segoe UI", "Helvetica Neue", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(110% 80% at 8% 6%, rgba(184, 217, 124, 0.26) 0%, rgba(184, 217, 124, 0) 58%),
          radial-gradient(100% 70% at 92% 96%, rgba(110, 170, 200, 0.22) 0%, rgba(110, 170, 200, 0) 56%),
          radial-gradient(90% 62% at 66% 18%, rgba(232, 191, 143, 0.18) 0%, rgba(232, 191, 143, 0) 54%),
          var(--surface);
      }

      .app-shell {
        max-width: 920px;
        margin: 0 auto;
        padding: 14px;
        display: grid;
        gap: 12px;
      }

      .hero {
        position: relative;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 14px;
        border: 1px solid var(--stroke);
        border-radius: 18px;
        background: var(--card);
        box-shadow: var(--shadow);
      }

      .hero-info {
        display: flex;
        gap: 12px;
        min-width: 0;
      }

      .fyn-mark {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        flex: 0 0 auto;
        background:
          radial-gradient(85% 85% at 26% 20%, rgba(184, 217, 124, 0.92) 0%, rgba(184, 217, 124, 0.58) 46%, rgba(184, 217, 124, 0) 80%),
          radial-gradient(100% 90% at 76% 82%, rgba(110, 170, 200, 0.95) 0%, rgba(110, 170, 200, 0.58) 56%, rgba(110, 170, 200, 0) 82%),
          radial-gradient(90% 72% at 58% 40%, rgba(232, 191, 143, 0.82) 0%, rgba(232, 191, 143, 0.4) 55%, rgba(232, 191, 143, 0) 86%);
        border: 1px solid rgba(37, 83, 95, 0.2);
      }

      .hero h1 {
        margin: 0;
        font-size: 1.1rem;
        line-height: 1.2;
      }

      .hero p {
        margin: 4px 0 0;
        color: var(--muted);
        font-size: 0.87rem;
      }

      .open-first {
        border: 1px solid rgba(30, 99, 109, 0.24);
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(184, 217, 124, 0.78), rgba(110, 170, 200, 0.74));
        color: #11353c;
        font-weight: 650;
        padding: 0.58rem 0.8rem;
        font-size: 0.82rem;
        cursor: pointer;
        white-space: nowrap;
      }

      .open-first:disabled {
        cursor: default;
        opacity: 0.42;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--stroke);
        border-radius: 14px;
        background: var(--card);
      }

      .tabset {
        display: inline-flex;
        border: 1px solid rgba(23, 61, 69, 0.16);
        border-radius: 999px;
        padding: 2px;
        background: rgba(255, 255, 255, 0.86);
      }

      .tabset button {
        border: 0;
        background: transparent;
        border-radius: 999px;
        padding: 0.35rem 0.72rem;
        font-size: 0.78rem;
        font-weight: 630;
        color: var(--muted);
        cursor: pointer;
      }

      .tabset button[aria-selected="true"] {
        background: linear-gradient(135deg, rgba(184, 217, 124, 0.42), rgba(110, 170, 200, 0.36));
        color: #16373d;
      }

      .pills {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 0.28rem 0.62rem;
        font-size: 0.73rem;
        border: 1px solid rgba(24, 58, 66, 0.17);
        background: rgba(255, 255, 255, 0.76);
        color: #24444c;
        line-height: 1;
      }

      .panel {
        border: 1px solid var(--stroke);
        border-radius: 16px;
        background: var(--card);
        overflow: hidden;
        box-shadow: var(--shadow);
      }

      .panel[hidden] {
        display: none !important;
      }

      .map-wrap {
        position: relative;
        height: 286px;
        background:
          radial-gradient(130% 98% at 16% 4%, rgba(184, 217, 124, 0.22) 0%, rgba(184, 217, 124, 0) 64%),
          radial-gradient(120% 90% at 90% 95%, rgba(110, 170, 200, 0.22) 0%, rgba(110, 170, 200, 0) 60%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(236, 245, 246, 0.84));
      }

      .map-wrap::before {
        content: "";
        position: absolute;
        inset: 12% 10%;
        border-radius: 22px;
        background:
          radial-gradient(50% 40% at 42% 50%, rgba(24, 84, 90, 0.11) 0%, rgba(24, 84, 90, 0) 76%),
          linear-gradient(160deg, rgba(172, 204, 213, 0.26), rgba(223, 234, 237, 0.1));
        border: 1px dashed rgba(23, 63, 71, 0.18);
        pointer-events: none;
      }

      .map-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(to right, rgba(20, 56, 64, 0.06) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(20, 56, 64, 0.06) 1px, transparent 1px);
        background-size: 54px 54px;
        pointer-events: none;
      }

      .map-pin {
        position: absolute;
        transform: translate(-50%, -100%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 26px;
        min-height: 26px;
        padding: 0 6px;
        border-radius: 999px;
        border: 1px solid rgba(17, 53, 60, 0.2);
        background: linear-gradient(135deg, rgba(184, 217, 124, 0.96), rgba(110, 170, 200, 0.93));
        color: #14323a;
        font-weight: 700;
        font-size: 0.66rem;
        box-shadow: 0 8px 22px rgba(20, 55, 63, 0.22);
      }

      .map-pin-label {
        position: absolute;
        left: 50%;
        top: calc(100% + 4px);
        transform: translateX(-50%);
        white-space: nowrap;
        font-size: 0.64rem;
        color: #1b4b52;
        padding: 0.13rem 0.38rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(24, 65, 73, 0.14);
      }

      .map-legend {
        position: absolute;
        left: 10px;
        bottom: 10px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid rgba(24, 65, 73, 0.16);
        background: rgba(255, 255, 255, 0.8);
        color: #24464e;
        font-size: 0.7rem;
        padding: 0.22rem 0.5rem;
      }

      .cards {
        display: grid;
        gap: 10px;
        padding: 10px;
      }

      .card {
        display: grid;
        grid-template-columns: 118px 1fr;
        gap: 10px;
        border: 1px solid rgba(21, 53, 61, 0.16);
        border-radius: 14px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.92);
      }

      .card-media {
        width: 100%;
        height: 100%;
        min-height: 104px;
        object-fit: cover;
        background:
          radial-gradient(100% 80% at 22% 18%, rgba(184, 217, 124, 0.65) 0%, rgba(184, 217, 124, 0) 65%),
          radial-gradient(100% 82% at 78% 82%, rgba(110, 170, 200, 0.62) 0%, rgba(110, 170, 200, 0) 65%),
          #e9f1ef;
      }

      .card-body {
        padding: 10px 10px 10px 0;
        min-width: 0;
      }

      .card-top {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: flex-start;
      }

      .card-title {
        margin: 0;
        font-size: 0.92rem;
        line-height: 1.28;
      }

      .card-title a {
        color: #173e45;
        text-decoration: none;
      }

      .card-title a:hover {
        text-decoration: underline;
      }

      .score {
        flex: 0 0 auto;
        border-radius: 999px;
        font-size: 0.65rem;
        line-height: 1;
        padding: 0.3rem 0.48rem;
        border: 1px solid rgba(22, 66, 74, 0.2);
        background: rgba(255, 255, 255, 0.84);
        color: #194049;
        font-weight: 700;
      }

      .card-meta {
        margin-top: 4px;
        font-size: 0.76rem;
        color: var(--muted);
      }

      .facts {
        margin-top: 7px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .fact {
        border: 1px solid rgba(25, 67, 76, 0.16);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.86);
        font-size: 0.66rem;
        padding: 0.2rem 0.44rem;
        color: #1f4a52;
      }

      .why {
        margin-top: 7px;
        font-size: 0.7rem;
        color: #2f555f;
      }

      .empty {
        padding: 16px;
        border: 1px dashed rgba(30, 79, 88, 0.2);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.76);
      }

      .empty h2 {
        margin: 0 0 4px;
        font-size: 0.95rem;
      }

      .empty p {
        margin: 0;
        color: var(--muted);
        font-size: 0.79rem;
      }

      @media (max-width: 740px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .open-first {
          width: 100%;
        }

        .toolbar {
          flex-direction: column;
          align-items: flex-start;
        }

        .card {
          grid-template-columns: 1fr;
        }

        .card-body {
          padding: 10px;
        }

        .card-media {
          min-height: 150px;
        }
      }
    </style>
  </head>
  <body>
    <main class="app-shell">
      <section class="hero">
        <div class="hero-info">
          <div class="fyn-mark" aria-hidden="true"></div>
          <div>
            <h1>Fyn shortlist</h1>
            <p id="subheading">Ready to explore properties.</p>
          </div>
        </div>
        <button id="openTopBtn" class="open-first" type="button" disabled>Open top match</button>
      </section>

      <section class="toolbar">
        <div class="tabset" role="tablist" aria-label="Result view">
          <button id="listTab" type="button" role="tab" aria-selected="true">List</button>
          <button id="mapTab" type="button" role="tab" aria-selected="false">Map</button>
        </div>
        <div class="pills">
          <span id="countPill" class="pill">0 results</span>
          <span id="cityPill" class="pill">No city</span>
          <span id="sourcePill" class="pill">source: --</span>
        </div>
      </section>

      <section id="mapPanel" class="panel" hidden>
        <div class="map-wrap">
          <div class="map-grid" aria-hidden="true"></div>
          <div id="mapPins"></div>
          <div class="map-legend">Pins = listing count per city</div>
        </div>
      </section>

      <section id="listPanel" class="panel">
        <div id="cards" class="cards"></div>
      </section>
    </main>

    <script>
      (function () {
        var cityCoords = {
          valencia: [39.4699, -0.3763],
          madrid: [40.4168, -3.7038],
          barcelona: [41.3874, 2.1686],
          sevilla: [37.3891, -5.9845],
          malaga: [36.7213, -4.4214],
          alicante: [38.3452, -0.481],
          zaragoza: [41.6488, -0.8891],
          bilbao: [43.263, -2.935],
          granada: [37.1773, -3.5986],
          cadiz: [36.5271, -6.2886],
          murcia: [37.9922, -1.1307],
          vigo: [42.2406, -8.7207],
          oviedo: [43.3619, -5.8494],
          gijon: [43.5453, -5.6615],
          santander: [43.4623, -3.8099],
          salamanca: [40.9701, -5.6635],
          burgos: [42.3439, -3.6969],
          leon: [42.5987, -5.5671],
          valladolid: [41.6523, -4.7245],
          palma: [39.5696, 2.6502],
          mallorca: [39.6953, 3.0176],
          tarragona: [41.1189, 1.2445],
          almeria: [36.834, -2.4637],
          cordoba: [37.8882, -4.7794],
          toledo: [39.8628, -4.0273],
          teruel: [40.3456, -1.1065],
          soria: [41.7636, -2.4668],
          cuenca: [40.0704, -2.1374],
          "la coruna": [43.3623, -8.4115],
          coruna: [43.3623, -8.4115],
          pamplona: [42.8125, -1.6458],
          naquera: [39.6562, -0.4256]
        };

        var state = {
          cards: [],
          criteria: null,
          diagnostics: null,
          view: "list"
        };

        var mapPanel = document.getElementById("mapPanel");
        var listPanel = document.getElementById("listPanel");
        var cardsEl = document.getElementById("cards");
        var mapPinsEl = document.getElementById("mapPins");
        var listTab = document.getElementById("listTab");
        var mapTab = document.getElementById("mapTab");
        var subheadingEl = document.getElementById("subheading");
        var countPillEl = document.getElementById("countPill");
        var cityPillEl = document.getElementById("cityPill");
        var sourcePillEl = document.getElementById("sourcePill");
        var openTopBtn = document.getElementById("openTopBtn");

        function escapeHtml(value) {
          return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        }

        function clamp(value, min, max) {
          return Math.min(max, Math.max(min, value));
        }

        function normalizeCity(value) {
          return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\\u0300-\\u036f]/g, "")
            .replace(/[^a-z0-9\\s-]/g, " ")
            .replace(/\\s+/g, " ")
            .trim();
        }

        function hashNumber(value, salt) {
          var hash = salt || 0;
          var input = String(value || "");
          for (var i = 0; i < input.length; i += 1) {
            hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
          }
          return hash;
        }

        function guessCityName(cityLabel) {
          var raw = String(cityLabel || "").trim();
          if (!raw) {
            return "Unknown";
          }
          var noDistrict = raw.split("(")[0].trim();
          var firstComma = noDistrict.split(",")[0].trim();
          if (!firstComma) {
            return noDistrict || raw;
          }
          return firstComma;
        }

        function coordinatesForCity(cityName) {
          var normalized = normalizeCity(cityName);
          var known = cityCoords[normalized];
          if (known) {
            return known;
          }

          var latHash = hashNumber(normalized, 17) % 10000;
          var lonHash = hashNumber(normalized, 43) % 10000;
          var lat = 36.2 + (latHash / 10000) * 7.8;
          var lon = -9.4 + (lonHash / 10000) * 12.2;
          return [lat, lon];
        }

        function toPoint(lat, lon) {
          var minLon = -9.8;
          var maxLon = 3.5;
          var minLat = 35.8;
          var maxLat = 44.5;
          var x = ((lon - minLon) / (maxLon - minLon)) * 100;
          var y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
          return {
            x: clamp(x, 4, 96),
            y: clamp(y, 7, 94)
          };
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

        function notifyHeight() {
          if (window.openai && typeof window.openai.notifyIntrinsicHeight === "function") {
            window.openai.notifyIntrinsicHeight(document.body.scrollHeight);
          }
        }

        function setView(nextView) {
          state.view = nextView === "map" ? "map" : "list";
          var mapActive = state.view === "map";
          listTab.setAttribute("aria-selected", mapActive ? "false" : "true");
          mapTab.setAttribute("aria-selected", mapActive ? "true" : "false");
          listPanel.hidden = mapActive;
          mapPanel.hidden = !mapActive;
          notifyHeight();
        }

        function cardHtml(card) {
          var facts = Array.isArray(card.facts) ? card.facts : [];
          var why = Array.isArray(card.why_matched) ? card.why_matched : [];
          var imageTag = card.image_url
            ? '<img class="card-media" src="' +
              escapeHtml(card.image_url) +
              '" alt="' +
              escapeHtml(card.title || "Property image") +
              '" loading="lazy" referrerpolicy="no-referrer" />'
            : '<div class="card-media" aria-hidden="true"></div>';

          var factsHtml = facts
            .slice(0, 4)
            .map(function (fact) {
              return '<span class="fact">' + escapeHtml(fact) + "</span>";
            })
            .join("");

          var whyHtml = why.length > 0
            ? '<div class="why">' + escapeHtml(why.join(" | ")) + "</div>"
            : "";

          return (
            '<article class="card">' +
            imageTag +
            '<div class="card-body">' +
            '<div class="card-top">' +
            '<h2 class="card-title"><a href="' +
            escapeHtml(card.url || "#") +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(card.title || "Listing") +
            "</a></h2>" +
            '<span class="score">' +
            escapeHtml(String(card.score || 0)) +
            "/100</span>" +
            "</div>" +
            '<div class="card-meta">' +
            escapeHtml(card.price || "Price unavailable") +
            " · " +
            escapeHtml(card.city || "Unknown city") +
            "</div>" +
            '<div class="facts">' +
            factsHtml +
            "</div>" +
            whyHtml +
            "</div>" +
            "</article>"
          );
        }

        function renderCards() {
          if (!state.cards.length) {
            cardsEl.innerHTML =
              '<div class="empty"><h2>No listings yet</h2><p>Run <code>search_properties</code> with explicit city or locations to render cards and map pins.</p></div>';
            return;
          }

          cardsEl.innerHTML = state.cards.map(cardHtml).join("");
        }

        function renderMap() {
          if (!state.cards.length) {
            mapPinsEl.innerHTML = "";
            return;
          }

          var cityMap = new Map();
          state.cards.forEach(function (card) {
            var cityName = guessCityName(card.city);
            var cityKey = normalizeCity(cityName);
            var previous = cityMap.get(cityKey);
            if (!previous) {
              cityMap.set(cityKey, { cityName: cityName, count: 1 });
            } else {
              previous.count += 1;
            }
          });

          var html = "";
          cityMap.forEach(function (entry) {
            var coords = coordinatesForCity(entry.cityName);
            var point = toPoint(coords[0], coords[1]);
            html +=
              '<div class="map-pin" style="left:' +
              point.x +
              "%;top:" +
              point.y +
              '%;">' +
              escapeHtml(String(entry.count)) +
              '<span class="map-pin-label">' +
              escapeHtml(entry.cityName) +
              "</span></div>";
          });

          mapPinsEl.innerHTML = html;
        }

        function renderPills() {
          var cardCount = state.cards.length;
          countPillEl.textContent = cardCount + (cardCount === 1 ? " result" : " results");

          var criteriaCity =
            state.criteria && typeof state.criteria.city === "string" ? state.criteria.city : "";
          if (criteriaCity) {
            cityPillEl.textContent = "city: " + criteriaCity;
          } else if (state.diagnostics && state.diagnostics.execution) {
            var execution = state.diagnostics.execution;
            var locations = Array.isArray(execution.locations_requested)
              ? execution.locations_requested
              : [];
            if (locations.length > 0) {
              cityPillEl.textContent = "locations: " + locations.length;
            } else {
              cityPillEl.textContent = "locations pending";
            }
          } else {
            cityPillEl.textContent = "No city";
          }

          var source =
            state.diagnostics && typeof state.diagnostics.source === "string"
              ? state.diagnostics.source
              : "--";
          sourcePillEl.textContent = "source: " + source;
        }

        function renderHero() {
          var count = state.cards.length;
          if (count > 0) {
            subheadingEl.textContent = "Top " + count + " listings ranked by constraints.";
            openTopBtn.disabled = false;
          } else {
            subheadingEl.textContent = "Ready to explore properties.";
            openTopBtn.disabled = true;
          }
        }

        function renderAll() {
          renderHero();
          renderPills();
          renderCards();
          renderMap();
          notifyHeight();
        }

        function applyToolOutput(output) {
          var safe = output && typeof output === "object" ? output : {};
          var cards = Array.isArray(safe.presentation_cards) ? safe.presentation_cards : [];
          state.cards = cards;
          state.criteria =
            safe.criteria && typeof safe.criteria === "object" ? safe.criteria : null;
          state.diagnostics =
            safe.diagnostics && typeof safe.diagnostics === "object"
              ? safe.diagnostics
              : null;
          renderAll();
        }

        function readOpenAiToolOutput() {
          if (window.openai && window.openai.toolOutput) {
            return window.openai.toolOutput;
          }
          return null;
        }

        listTab.addEventListener("click", function () {
          setView("list");
        });

        mapTab.addEventListener("click", function () {
          setView("map");
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

        window.addEventListener("resize", notifyHeight, { passive: true });

        var initialOutput = readOpenAiToolOutput();
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

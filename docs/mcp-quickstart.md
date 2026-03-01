# MCP Quickstart

## 1. Install dependencies

```bash
pnpm install
```

## 2. Configure environment (optional live mode)

```bash
cp .env.example .env
```

Set `PISOS_API_KEY` when available. Other connectors run in scraper mode.

## 3. Run the MCP server (stdio)

```bash
pnpm --filter @fyn/mcp-server dev
```

This starts a stdio MCP server that exposes:
- `search_properties`

`search_properties` now also links an MCP Apps component resource (`ui://widget/fyn-search-results-v1.html`) so compatible hosts (like ChatGPT apps) can render map + cards from the same tool result.

## Tool contract (recommended)

Use structured constraints so the model can act as an agent and Fyn stays deterministic:

- `locations[]` for multi-city/town coverage
- `property_types[]`, `transaction_type`, `max_price_eur`, `min_rooms`
- `min_floor`, `exclude_ground_floor`, `prefer_exterior`
- `strict_constraints`
- `sources[]` (for explicit portal selection)
- `per_location_limit`, `max_results_total`

`query_text` is contextual and optional in this mode.
With `strict_constraints=true` (default), you must provide `city` or `locations[]`; otherwise the tool returns `action_required.code = "MISSING_LOCATIONS"` instead of running discovery fallback.

## 4. Run smoke test via MCP client

```bash
pnpm smoke:mcp -- "Find me a flat in Valencia with at least three rooms, max 350k"
```

The smoke client sends a structured request (city + constraints) and keeps your text as `query_text` context.
You can also pass full JSON arguments:

```bash
pnpm smoke:mcp -- '{"locale":"es","transaction_type":"buy","property_types":["house"],"locations":["Náquera","Buñol","Requena"],"tags":["nature","views"],"strict_constraints":true}'
```

Default execution queries multiple sources (`pisos`, `habitaclia`, `tucasa`, `fotocasa`, `yaencontre`, `milanuncios`, `globaliza`, `hogaria`, `spainhouses`, `nuroa`) and conditionally includes `pisocompartido` + `enalquiler` for rent + flat/house intents. Coverage diagnostics are returned per portal.
Availability for `yaencontre` and `idealista` may vary by anti-bot response.
With no Pisos API key, `pisos` first uses HTML scraping fallback, then fixtures if scraping fails.

Per-source smoke harness (checks each source independently, classifies upstream blocks/rate limits separately from contract failures):

```bash
pnpm smoke:sources
```

Diagnostics expose:
- `request_warnings` (request-shape guidance)
- `connector_warnings` (upstream/source warnings)
- `coverage[]` with `location`, `portal`, and optional `error_code` / `error_message`

## 5. Live connector mode

When you have keys and upstream query serialization details:

- Set `PISOS_API_KEY`
- Optionally set `PISOS_SERIALIZED_SEARCH` while formal serializer mapping is being finalized

Then run the same smoke command again and check diagnostics:

- `"source": "live"` means API-backed data
- `"source": "scrape"` means HTML scraping fallback
- `"source": "fixture"` means fixture fallback mode
- `coverage[].portal` shows which source succeeded/failed per location.

## 6. Vercel HTTP deployment (for ChatGPT app connection)

From `apps/mcp-server`:

```bash
npx vercel login
npx vercel --prod
```

Then set environment variables in Vercel project settings:

- `NEXT_PUBLIC_SITE_URL` (recommended for canonical URLs, sitemap, robots, and legal pages; for your domain use `https://fynfyn.top`)
- `OPENAI_WIDGET_DOMAIN` (required for public app submission; use a dedicated origin such as `https://chatgpt.fynfyn.top`)
- `PISOS_API_KEY` (optional for API mode)
- `PISOS_ALLOW_FIXTURE_FALLBACK`
- `PISOS_ENABLE_SCRAPE_FALLBACK`
- `PISOS_SCRAPE_REQUEST_DELAY_MS`
- `PISOS_MAX_SCRAPE_REQUESTS`
- `PISOS_BASE_URL` (optional)
- `PISOS_SERIALIZED_SEARCH` (optional)
- `CONNECTOR_FETCH_TIMEOUT_MS` (optional, default `10000`)
- `CONNECTOR_SEARCH_TIMEOUT_MS` (optional, default `15000`)
- `MCP_LOCATION_CONCURRENCY` (optional, default `3`)
- `MCP_MAX_SEARCH_TASKS` (optional, default `28`)
- `TUCASA_BASE_URL` (optional)
- `TUCASA_SCRAPE_REQUEST_DELAY_MS`
- `TUCASA_MAX_SCRAPE_REQUESTS`
- `FOTOCASA_BASE_URL` (optional)
- `FOTOCASA_SCRAPE_REQUEST_DELAY_MS`
- `FOTOCASA_MAX_DETAIL_REQUESTS`
- `HABITACLIA_BASE_URL` (optional)
- `HABITACLIA_SCRAPE_REQUEST_DELAY_MS`
- `HABITACLIA_MAX_LISTINGS`
- `HABITACLIA_MAX_SCRAPE_REQUESTS`
- `YAENCONTRE_BASE_URL` (optional)
- `YAENCONTRE_SCRAPE_REQUEST_DELAY_MS`
- `YAENCONTRE_MAX_LISTINGS`
- `YAENCONTRE_MAX_SCRAPE_REQUESTS`
- `MILANUNCIOS_BASE_URL` (optional)
- `MILANUNCIOS_SCRAPE_REQUEST_DELAY_MS`
- `MILANUNCIOS_MAX_LISTINGS`
- `MILANUNCIOS_MAX_SCRAPE_REQUESTS`
- `IDEALISTA_BASE_URL` (optional)
- `IDEALISTA_SCRAPE_REQUEST_DELAY_MS`
- `IDEALISTA_MAX_LISTINGS`
- `IDEALISTA_MAX_SCRAPE_REQUESTS`
- `GLOBALIZA_BASE_URL` (optional)
- `GLOBALIZA_SCRAPE_REQUEST_DELAY_MS`
- `GLOBALIZA_MAX_LISTINGS`
- `GLOBALIZA_MAX_SCRAPE_REQUESTS`
- `HOGARIA_BASE_URL` (optional)
- `HOGARIA_SCRAPE_REQUEST_DELAY_MS`
- `HOGARIA_MAX_LISTINGS`
- `HOGARIA_MAX_SCRAPE_REQUESTS`
- `SPAINHOUSES_BASE_URL` (optional)
- `SPAINHOUSES_SCRAPE_REQUEST_DELAY_MS`
- `SPAINHOUSES_MAX_LISTINGS`
- `SPAINHOUSES_MAX_SCRAPE_REQUESTS`
- `PISOCOMPARTIDO_BASE_URL` (optional)
- `PISOCOMPARTIDO_SCRAPE_REQUEST_DELAY_MS`
- `PISOCOMPARTIDO_MAX_LISTINGS`
- `PISOCOMPARTIDO_MAX_SCRAPE_REQUESTS`
- `ENALQUILER_BASE_URL` (optional)
- `ENALQUILER_SCRAPE_REQUEST_DELAY_MS`
- `ENALQUILER_MAX_LISTINGS`
- `ENALQUILER_MAX_SCRAPE_REQUESTS`
- `NUROA_BASE_URL` (optional)
- `NUROA_SCRAPE_REQUEST_DELAY_MS`
- `NUROA_MAX_LISTINGS`
- `NUROA_MAX_SCRAPE_REQUESTS`

Expected endpoints:

- `https://<your-project>.vercel.app/api/health`
- `https://<your-project>.vercel.app/api/mcp`

Remote smoke test:

```bash
pnpm smoke:mcp:http -- --url https://<your-project>.vercel.app/api/mcp "Find me an office for +50 people in Valencia"
```

# MCP Quickstart

## 1. Install dependencies

```bash
pnpm install
```

## 2. Configure environment (optional live mode)

```bash
cp .env.example .env
```

Set `PISOS_API_KEY` when available.

## 3. Run the MCP server (stdio)

```bash
pnpm --filter @fyn/mcp-server dev
```

This starts a stdio MCP server that exposes:
- `search_properties`

## Tool contract (recommended)

Use structured constraints so the model can act as an agent and Fyn stays deterministic:

- `locations[]` for multi-city/town coverage
- `property_types[]`, `transaction_type`, `max_price_eur`, `min_rooms`
- `min_floor`, `exclude_ground_floor`, `prefer_exterior`
- `strict_constraints`
- `per_location_limit`, `max_results_total`

`query_text` is contextual and optional in this mode.
With `strict_constraints=true` (default), you must provide `city` or `locations[]`; otherwise the tool returns `action_required.code = "MISSING_LOCATIONS"` instead of running discovery fallback.

## 4. Run smoke test via MCP client

```bash
pnpm smoke:mcp -- "Find me a flat in Valencia with at least three rooms, max 350k"
```

With no API key, the connector first uses HTML scraping fallback, then fixtures if scraping fails.

Legacy note: if only `query_text` is provided, the parser fallback path is used. In diagnostics this appears as `execution.mode = "legacy_parser"`.

## 5. Live connector mode

When you have keys and upstream query serialization details:

- Set `PISOS_API_KEY`
- Optionally set `PISOS_SERIALIZED_SEARCH` while formal serializer mapping is being finalized

Then run the same smoke command again and check diagnostics:

- `"source": "live"` means API-backed data
- `"source": "scrape"` means HTML scraping fallback
- `"source": "fixture"` means fixture fallback mode

## 6. Vercel HTTP deployment (for ChatGPT app connection)

From `apps/mcp-server`:

```bash
npx vercel login
npx vercel --prod
```

Then set environment variables in Vercel project settings:

- `PISOS_API_KEY` (optional for API mode)
- `PISOS_ALLOW_FIXTURE_FALLBACK`
- `PISOS_ENABLE_SCRAPE_FALLBACK`
- `PISOS_SCRAPE_REQUEST_DELAY_MS`
- `PISOS_MAX_SCRAPE_REQUESTS`
- `PISOS_BASE_URL` (optional)
- `PISOS_SERIALIZED_SEARCH` (optional)

Expected endpoints:

- `https://<your-project>.vercel.app/api/health`
- `https://<your-project>.vercel.app/api/mcp`

Remote smoke test:

```bash
pnpm smoke:mcp:http -- --url https://<your-project>.vercel.app/api/mcp "Find me an office for +50 people in Valencia"
```

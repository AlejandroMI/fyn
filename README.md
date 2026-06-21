# Fyn

Fyn (Find Your Nest) is an MCP-first property search aggregator for Spain.

## Stack

- Next.js + React + TypeScript (web)
- Tailwind CSS + custom design system styles
- Turborepo monorepo for MCP server + shared packages
- MCP endpoint and health routes exposed from the same deployment

## Architecture

- `pages/`: website routes (`/`, `/developers`) + API routes (`/api/mcp`, `/api/health`)
- `src/components/`: reusable UI components (shared nav, pages)
- `src/content/site-content.ts`: single source of truth for ES/EN copy
- `src/styles/globals.css`: design tokens and shared styles
- `apps/mcp-server/`: MCP server app used by the connector runtime
- `packages/*`: shared domain, scoring, and connector logic

Current connector sources:
- `pisos` (API + scrape fallback)
- `habitaclia` (scrape)
- `tucasa` (scrape)
- `fotocasa` (scrape with list-card fallback, anti-bot sensitive)
- `yaencontre` (scrape probe + state parser, DataDome-sensitive)
- `milanuncios` (scrape listing-card extraction, city-filter fallback)
- `idealista` (scrape probe with cid-aware blocked diagnostics)
- `globaliza` (scrape list-card extraction, city-filter fallback)
- `hogaria` (scrape listing-card extraction, province-route discovery fallback)
- `spainhouses` (scrape property-block extraction, city/province route fallback)
- `pisocompartido` (scrape room-rental cards, rent-focused)
- `enalquiler` (scrape rental listings, city/province route resolution + fallback)
- `nuroa` (scrape aggregator cards with nested outbound listing URL extraction)

## Localization

- Default locale: Spanish (`es`)
- Secondary locale: English (`en`)
- Locale switcher is available on product and developer pages

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Run local web on `http://localhost:3008`:

```bash
pnpm dev:web
```

3. Build production web:

```bash
pnpm build
```

4. Start production build locally:

```bash
pnpm start
```

5. Run MCP server (stdio):

```bash
pnpm --filter @fyn/mcp-server dev
```

## Connect from Claude

The production remote MCP endpoint is:

```text
https://fynfyn.top/mcp
```

On Claude Pro or Max, open **Customize → Connectors → Add custom connector**, paste the endpoint, and enable Fyn from the **+ → Connectors** menu in a conversation. On Team or Enterprise, an organization owner must add the connector first. See Anthropic's [remote MCP connector guide](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp).

Fyn uses Streamable HTTP and is not tied to Claude; any compatible MCP client can consume the same endpoint.

## Agent discovery

Production publishes machine-readable discovery resources at predictable URLs:

- `/llms.txt` and `/llms-full.txt`
- `/index.md`, `/auth.md`, and Markdown twins for key content pages
- `/openapi.json`
- `/.well-known/agent.json` and `/.well-known/agent-card.json`
- `/.well-known/mcp` and `/.well-known/mcp/server-card.json`
- `/.well-known/api-catalog`

The root repository includes `AGENTS.md`. The publishable agent skill is in `skills/search-fyn-properties/`.

## Environment variables

You do not need every supported env var to run Fyn.

Required for connector status snapshot refresh + private Backblaze storage:

- `B2_BUCKET_ID`
- `B2_BUCKET_NAME`
- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `CONNECTOR_STATUS_REFRESH_TOKEN`
- `CRON_SECRET`

## Validation

```bash
pnpm typecheck
pnpm test
```

## Deployment workflow

- Production deploys are handled by Vercel's GitHub integration.
- Branch rule: every push to `main` triggers a production deployment.
- No GitHub Actions deploy workflow is required for production deploys.
- Vercel cron triggers `/api/connector-status/refresh` daily at `09:00 UTC`.
- After the first deploy, seed the first snapshot with `POST /api/connector-status/refresh` and an `Authorization: Bearer <CONNECTOR_STATUS_REFRESH_TOKEN>` header. Never put refresh secrets in URLs.
- If deployment behavior changes, update this section and `docs/website-architecture.md` in the same PR.

## MCP smoke checks

```bash
pnpm smoke:mcp -- "Find me a flat in Valencia with 3 rooms max 350k"
pnpm smoke:sources
pnpm smoke:mcp:http -- --url https://<your-project>.vercel.app/api/mcp "Find me an office for +50 people in Valencia"
```

## Connector status snapshot

The landing page connector cards use a daily snapshot, not live per-request checks.

- Refresh route: `/api/connector-status/refresh`
- Read route: `/api/connector-status/latest`
- Storage: `connector-status/latest.json` in Backblaze B2
- Browser clients do not read B2 directly. The app reads the private snapshot server-side and returns it through `/api/connector-status/latest`.

This keeps the bucket private, avoids browser CORS issues, and reduces the chance of over-probing source portals.

## Docs

- `docs/website-architecture.md`
- `docs/fyn-foundation.md`
- `docs/backlog.md`
- `docs/mcp-quickstart.md`
- `docs/learning-log.md`
- `docs/connector-context-continuity.md`
- `docs/connector-expansion-overnight-runbook-2026-02-25.md`
- `docs/autonomous-continuation-playbook.md`

## License

Fyn is licensed under the [Apache License 2.0](LICENSE).

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

## Validation

```bash
pnpm typecheck
pnpm test
```

## Deployment workflow

- Production deploys are handled by Vercel's GitHub integration.
- Branch rule: every push to `main` triggers a production deployment.
- No GitHub Actions deploy workflow is required for production deploys.
- If deployment behavior changes, update this section and `docs/website-architecture.md` in the same PR.

## MCP smoke checks

```bash
pnpm smoke:mcp -- "Find me a flat in Valencia with 3 rooms max 350k"
pnpm smoke:sources
pnpm smoke:mcp:http -- --url https://<your-project>.vercel.app/api/mcp "Find me an office for +50 people in Valencia"
```

## Docs

- `docs/website-architecture.md`
- `docs/fyn-foundation.md`
- `docs/backlog.md`
- `docs/mcp-quickstart.md`
- `docs/chatgpt-connector-research-2026-02-24.md`
- `docs/chatgpt-developer-mode-runbook.md`
- `docs/learning-log.md`
- `docs/connector-context-continuity.md`
- `docs/connector-expansion-overnight-runbook-2026-02-25.md`
- `docs/autonomous-continuation-playbook.md`

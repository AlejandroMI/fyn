# Fyn

Fyn (Find Your Nest) is a natural-language property search connector. It translates user intent into property filters, queries source portals, ranks results, and returns explainable matches with deep links.

## Current scope

- First connector: `pisos.com`
- Primary interface: MCP tool `search_properties`
- Parser: deterministic ES/EN extraction for core housing constraints
- Fallback mode: compliant HTML scraping (then fixtures) when API key is not available

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Run checks:

```bash
pnpm typecheck
pnpm test
```

3. Run MCP server (stdio):

```bash
pnpm --filter @fyn/mcp-server dev
```

4. Run MCP smoke test:

```bash
pnpm smoke:mcp -- "Find me a flat in Valencia with 3 rooms max 350k"
```

5. HTTP MCP smoke test (for deployed/remote endpoint):

```bash
pnpm smoke:mcp:http -- --url https://<your-project>.vercel.app/api/mcp "Find me an office for +50 people in Valencia"
```

Detailed MCP setup: `docs/mcp-quickstart.md`.

Execution backlog: `docs/backlog.md`.
Learning log: `docs/learning-log.md`.
ChatGPT connector research: `docs/chatgpt-connector-research-2026-02-24.md`.
ChatGPT Developer Mode runbook: `docs/chatgpt-developer-mode-runbook.md`.

## Environment

Copy `.env.example` to `.env` and set your key when available.

## Skills installed for this workspace

- `frontend-design`
- `mcp-integration`
- `playwright`
- `security-best-practices`
- `vercel-deploy`

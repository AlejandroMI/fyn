# Fyn

Fyn (Find Your Nest) is an MCP-first property search aggregator. In model-driven mode, the LLM plans and sends explicit constraints while Fyn executes deterministic multi-portal searches and returns explainable, source-linked results.

## Current scope

- First connector: `pisos.com`
- Primary interface: MCP tool `search_properties`
- Model-driven contract: structured filters + multi-location search + coverage diagnostics
- Parser: deterministic ES/EN extraction retained as legacy fallback
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

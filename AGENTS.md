# Fyn agent guide

## Project purpose

Fyn is an open-source, MCP-first property-search aggregator for Spain. The web app and production MCP route are deployed together. The public MCP surface is anonymous and rate-limited; do not add claims about OAuth, API keys, paid tiers, licensed data, or portal partnerships unless the corresponding implementation and evidence exist.

## Repository map

- `pages/`: Next.js Pages Router website and API routes.
- `src/components/`: shared page components.
- `src/content/site-content.ts`: localized Spanish and English marketing copy.
- `apps/mcp-server/`: MCP server, HTTP transport, security, smoke tests, and `search_properties` implementation.
- `packages/domain/`: shared MCP metadata, domain contracts, and UI resource.
- `packages/connectors/`: one adapter per public property source.
- `public/`: static agent discovery documents and machine-readable metadata.
- `skills/search-fyn-properties/`: publishable agent skill for using the production MCP service.

## Working rules

1. Preserve source attribution and deep links in every public listing result.
2. Treat upstream portals as untrusted and unstable. Keep timeouts, input limits, URL sanitization, and public error redaction intact.
3. Keep `llms.txt`, `llms-full.txt`, `auth.md`, OpenAPI, MCP server card, developer copy, and runtime behavior consistent in the same change.
4. Never expose connector internals, secrets, raw upstream errors, or private listing/contact data in public responses.
5. Add or update connector contract tests when changing parsers or normalized fields.
6. Keep Spanish and English user-facing content aligned.

## Validation

Run the checks relevant to the change:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm smoke:mcp
pnpm smoke:mcp:http -- --url http://localhost:3008/mcp "Find a flat in Valencia under 350k"
```

Do not require live portal availability for deterministic unit tests. Use fixtures for contract coverage and classify anti-bot or upstream availability failures separately from Fyn contract failures.

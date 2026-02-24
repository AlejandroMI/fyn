# ChatGPT Developer Mode Runbook (Fyn)

Last updated: 2026-02-24

## Goal

Connect Fyn's remote MCP endpoint to ChatGPT in Developer Mode and validate live search.

## Fyn Endpoint

- MCP URL: `https://fyn-mcp-server.vercel.app/mcp`
- Health URL: `https://fyn-mcp-server.vercel.app/health`

## Prerequisites

- ChatGPT account with Developer Mode enabled.
- Fyn endpoint reachable (health check returns `status: ok`).

## Step-by-Step

1. Open ChatGPT settings and turn on **Developer Mode**.
2. Start a new chat in ChatGPT.
3. Open the connectors/apps panel and select **Connectors > Developer mode**.
4. Add a custom connector and provide:
   - Name: `Fyn`
   - URL: `https://fyn-mcp-server.vercel.app/mcp`
5. Confirm connection and ensure the tool is visible.
6. Run validation prompts:
   - `Find me an office for +50 people in Valencia`
   - `Find me a flat in Valencia with at least three rooms, max 350k`
7. Verify responses include:
   - explainable matches (`why_matched`)
   - source portal URLs (`pisos.com`)
   - diagnostics (`source`, warnings, counts)

## What To Capture

- If success:
  - The final ChatGPT app/connector URL (for landing CTA handoff).
- If failure:
  - Exact ChatGPT error text.
  - Approximate timestamp.
  - The prompt used when it failed.

## Quick Debug Commands

```bash
curl -sS https://fyn-mcp-server.vercel.app/health
pnpm smoke:mcp:http -- --url https://fyn-mcp-server.vercel.app/mcp "Find me a flat in Valencia with at least three rooms, max 350k"
```

## Notes

- Custom connectors/apps can be tested from ChatGPT Developer Mode before publishing.
- Custom connectors cannot use `localhost`; a remote URL is required.

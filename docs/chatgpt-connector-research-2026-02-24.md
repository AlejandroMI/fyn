# ChatGPT Connector Research (2026-02-24)

## Goal

Ship Fyn to users fast through a ChatGPT connector path with minimal infrastructure drag.

## Evidence Summary

### 1) Terminology and product surface changed

- OpenAI states that "connectors" are now called **apps** (change dated December 17, 2025).
- Outcome for us: use current "apps/custom MCP" flow instead of older connector wording in product docs/UI.

### 2) Custom MCP in ChatGPT is viable now

- OpenAI help docs show that users can add custom MCP servers through ChatGPT developer mode.
- The same docs note practical constraints:
  - server must be **remote** (localhost is not supported),
  - `search` and `fetch` tools are no longer mandatory,
  - custom MCP apps are not used by ChatGPT **agent mode** (chat/deep research remain the primary surfaces).

### 3) Plan/admin constraints exist

- OpenAI docs indicate capability differences by plan and admin controls.
- Inference: for fast alpha, we should validate with an account that already has the required app/developer-mode controls enabled, then broaden access.

### 4) Vercel has a first-class MCP deployment path

- Vercel docs include explicit guidance to deploy MCP servers with Vercel Functions and expose a remote endpoint for MCP clients.
- Their examples use `@vercel/mcp-adapter` and a conventional `/mcp` endpoint path.
- Outcome for us: Vercel remains the fastest route for Fyn's first remote MCP endpoint.

### 5) Cloudflare Code Mode is directionally aligned, not a blocker

- Cloudflare's post describes a coding agent using remote MCP servers, policy controls, and managed remote execution.
- Outcome for us: good northbound architecture pattern for later, but not required to ship Fyn's first ChatGPT path.

## Recommended Build Order

1. Expose Fyn MCP over HTTP on Vercel (`/mcp`) with current `search_properties`.
2. Run remote smoke test (no ChatGPT yet): client -> Vercel MCP -> Pisos connector.
3. Add Fyn as custom app in ChatGPT developer mode and test the three sample prompts.
4. Wire landing primary CTA to that ChatGPT app URL.
5. Expand adapters portal-by-portal behind feature flags.

## What This Means For Current Scope

- Keep building the connector path first.
- Treat compliance hardening as immediate follow-up after first live path works.
- Keep parser/ranker deterministic and explainable so ChatGPT output quality stays stable.

## Sources

- OpenAI Help: [About connectors and apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt)
- OpenAI Help: [Connectors and MCP in ChatGPT (Developer Mode)](https://help.openai.com/en/articles/6825453-chatgpt-browser)
- OpenAI Help: [Admin controls, connectors and MCP](https://help.openai.com/en/articles/10948259-admin-controls-connectors-and-shared-links-in-chatgpt-team-version)
- Vercel Docs: [How can I deploy and configure an MCP server on Vercel?](https://vercel.com/docs/agents/mcp-servers)
- Vercel Example (template): [mcp-on-vercel](https://vercel.com/new/vercel-labs/templates/ai/model-context-protocol-mcp-with-vercel-functions)
- Cloudflare Blog: [Introducing Claude code mode with remote MCP servers](https://blog.cloudflare.com/code-mode/)

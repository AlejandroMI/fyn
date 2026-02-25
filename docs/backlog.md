# Fyn Backlog

Last updated: 2026-02-25

## Working Rules

- Keep focus: max 3 tasks `In Progress` at once.
- Ship vertical slices: each task must end in something demoable.
- Every completed task adds at least one learning entry to `docs/learning-log.md`.
- Anything blocked for more than 24h gets moved to `Blocked / Needs`.
- Vercel is the default deployment target.
- Demo path: landing sends users directly to the ChatGPT app/connector URL.

## In Progress (Now)

- [ ] `P0` ChatGPT app connector alpha
  - Owner: Codex
  - Goal: run Fyn from ChatGPT app connection using real listings.
  - Definition of done: one successful end-to-end run in ChatGPT with sample prompt.
- [ ] `P0` Multi-source connector hardening
  - Owner: Codex
  - Goal: keep `pisos + habitaclia + tucasa + fotocasa` orchestration stable with clear per-portal diagnostics.
  - Definition of done: at least one passing smoke path with multi-source coverage output and no contract regressions.
- [ ] `P1` Prompt parity smoke snapshots (ES/EN)
  - Owner: Codex
  - Goal: equivalent intent gives equivalent normalized filters.
  - Definition of done: snapshots for all three sample prompts in both languages.

## Next Up

- [ ] `P0` Landing -> connector handoff
  - Owner: Codex
  - Goal: one click from landing to the ChatGPT connector URL.
  - Definition of done: primary CTA opens connector and fallback copy exists when URL is not configured.
- [ ] `P1` Adapter framework for multi-portal expansion
  - Owner: Codex
  - Goal: add new portals with minimal code duplication.
  - Definition of done: shared connector interface + scraper helper package + contract template.
- [ ] `P1` Portal 2 connector spike
  - Owner: Codex
  - Goal: add one additional portal behind feature flag.
  - Definition of done: at least one working search path and snapshot tests.
- [ ] `P1` Save search + daily alerts (Supabase)
  - Owner: Codex
  - Goal: retain users with daily discoveries.
  - Definition of done: create/save search, daily digest email, unsubscribe link.

## Portal Expansion Queue

- [ ] `P1` Idealista adapter discovery spike
  - Hypothesis: anti-bot behavior is high; keep blocked adapter + stable diagnostics until reliable extraction path exists.
- [x] `P1` Fotocasa adapter discovery spike
  - Outcome: detail parsing kept, plus search-card fallback so blocked detail pages still produce usable cards when list pages are reachable.
- [x] `P1` Habitaclia adapter implementation spike
  - Outcome: city-scoped list pages are scrapeable; connector integrated with parser tests and MCP coverage diagnostics.
- [x] `P2` Yaencontre adapter discovery spike
  - Outcome: connector integrated with DataDome-aware diagnostics and `__INITIAL_STATE__` parser path when access is granted.
- [ ] `P2` Secondary long-tail sources
  - Candidates: smaller regional portals and agency networks with easier integration surfaces.

## Blocked / Needs From Founder

- [ ] Final connector launch URL once we publish the first ChatGPT app entry.
- [ ] If connection fails in ChatGPT, provide exact error text + timestamp so server logs can be mapped quickly.

## Done

- [x] Monorepo scaffold with MCP server, scoring, first connector.
- [x] Pisos connector in dual mode: API when key exists, scraping fallback when key is missing.
- [x] Smoke-tested sample prompts through MCP pipeline.
- [x] Feedback loop ownership moved to founder operations so engineering stays build-focused.
- [x] Vercel HTTP MCP scaffold added (`/api/mcp`, `/api/health`, remote smoke client script).
- [x] Vercel production MCP endpoint live and reachable (`https://fyn-mcp-server.vercel.app/mcp`) with successful remote smoke.
- [x] Natural-light intent parsing and ranking upgrade (`natural_light`/`exterior`/`orientation` signals).
- [x] `search_properties` now returns `presentation_cards` + markdown card preview with image URLs for richer ChatGPT output.
- [x] No-city nature queries now use discovery scrape mode (instead of fixture fallback) and avoid fake city extraction.
- [x] `search_properties` upgraded to model-driven MCP contract (structured constraints, multi-location execution, coverage diagnostics).
- [x] Strict structured mode now blocks no-location execution and returns `action_required` guidance (`MISSING_LOCATIONS`) so models must provide `city`/`locations[]`.
- [x] Legacy parser execution path removed; MCP backend now runs a single structured deterministic flow.
- [x] MCP tool metadata centralized in shared domain constants and rewritten in Booking-style action language.
- [x] `search_properties` now exposes an MCP Apps widget (`ui://widget/fyn-search-results-v1.html`) for map + card rendering in ChatGPT.
- [x] Added connector adapter framework package (`@fyn/connectors-core`) with shared scraper helpers and stable blocked-portal behavior.
- [x] Added `@fyn/connectors-tucasa` and `@fyn/connectors-fotocasa` adapters with parser tests and MCP integration.
- [x] Added Fotocasa search-card fallback parser so detail-blocked flows can still return normalized listings.
- [x] Added `@fyn/connectors-habitaclia` adapter with city-scoped scraping, parser tests, and MCP integration.
- [x] Added `@fyn/connectors-yaencontre` adapter with DataDome-aware blocking diagnostics and encoded state parser.
- [x] Upgraded MCP to multi-source execution (`sources[]`) with per-location and per-portal coverage diagnostics.
- [x] Replaced duplicate root MCP handler logic with shared server implementation to prevent metadata/contract drift.

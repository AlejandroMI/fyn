# Fyn Backlog

Last updated: 2026-02-25

## Working Rules

- First recovery docs: `docs/autonomous-continuation-playbook.md` and `docs/connector-context-continuity.md`.
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
- [x] `P0` Multi-source connector hardening
  - Owner: Codex
  - Goal: keep `pisos + habitaclia + tucasa + fotocasa + yaencontre + milanuncios + globaliza + hogaria + spainhouses + nuroa` orchestration stable, while preserving best-effort `idealista` diagnostics and rent-focused `pisocompartido + enalquiler` coverage.
  - Definition of done: at least one passing smoke path with multi-source coverage output, near-duplicate collapse enabled, and no contract regressions.
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

- [x] `P1` Idealista adapter diagnostics hardening
  - Outcome: probe connector shipped with DataDome cid-aware blocked errors and fallback parse paths for reachable windows.
- [x] `P1` Fotocasa adapter discovery spike
  - Outcome: detail parsing kept, plus search-card fallback so blocked detail pages still produce usable cards when list pages are reachable.
- [x] `P1` Habitaclia adapter implementation spike
  - Outcome: city-scoped list pages are scrapeable; connector integrated with parser tests and MCP coverage diagnostics.
- [x] `P2` Yaencontre adapter discovery spike
  - Outcome: connector integrated with DataDome-aware diagnostics, `__INITIAL_STATE__` parser path, and mixed block/unblock retry behavior across candidate paths.
- [x] `P2` Milanuncios adapter implementation spike
  - Outcome: connector integrated with listing-card parser, city matching, and stable blocked/rate-limit diagnostics.
- [x] `P2` Globaliza adapter implementation spike
  - Outcome: connector integrated with list-card parser, city filtering, and live smoke validation on Valencia.
- [x] `P2` Hogaria adapter implementation spike
  - Outcome: connector integrated with listing-card parser, mapped city->province route support, and live smoke validation on Ronda.
- [x] `P2` Pisocompartido adapter implementation spike
  - Outcome: connector integrated with rent-focused room-card parser, city-route fallbacks, and live smoke validation on Valencia.
- [x] `P2` Enalquiler adapter implementation spike
  - Outcome: connector integrated with rent-focused city/province route resolution, listing-card parser, and live smoke validation on Valencia.
- [x] `P2` Nuroa adapter implementation spike
  - Outcome: connector integrated with conversion-link target extraction, city-filtered list parsing, and live smoke validation on Valencia.
- [x] `P2` Spainhouses adapter implementation spike
  - Outcome: connector integrated with property-block parser, city/province route strategy, parser tests, and MCP smoke/source harness wiring.
- [ ] `P2` Secondary long-tail sources
  - Candidates: smaller regional portals and agency networks with easier integration surfaces (regional MLS-style networks beyond `pisocompartido`, `enalquiler`, `nuroa`, and `spainhouses`).

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
- [x] Hardened `@fyn/connectors-yaencontre` mixed path behavior so blocked routes do not abort later reachable routes.
- [x] Added `@fyn/connectors-milanuncios` adapter with listing-card extraction and city-filter fallback.
- [x] Added `@fyn/connectors-idealista` probe adapter with DataDome cid diagnostics and reachable-window parser paths.
- [x] Added `@fyn/connectors-globaliza` adapter with list-card parsing and city-filter fallback.
- [x] Added `@fyn/connectors-hogaria` adapter with listing-card extraction and mapped city/province path strategy.
- [x] Added `@fyn/connectors-pisocompartido` adapter with city-route fallback and room-rental listing extraction.
- [x] Added `@fyn/connectors-enalquiler` adapter with ajax location resolution, city/province route fallback, and rental-listing extraction.
- [x] Added `@fyn/connectors-nuroa` adapter with conversion-link target extraction, list-card parsing, and city-filter fallback behavior.
- [x] Added `@fyn/connectors-spainhouses` adapter with property-card parsing, city/province routing, and blocked-portal diagnostics.
- [x] Upgraded MCP to multi-source execution (`sources[]`) with per-location and per-portal coverage diagnostics.
- [x] Added near-duplicate cross-source deduplication before ranking in MCP output.
- [x] Added `smoke:sources` harness to verify connector contract behavior per source in one run.
- [x] Replaced duplicate root MCP handler logic with shared server implementation to prevent metadata/contract drift.

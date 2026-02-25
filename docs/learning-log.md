# Fyn Learning Log

Purpose: capture compact, reusable lessons from each shipping cycle.

## Entry Template

- Date:
- Context:
- Signal:
- Decision:
- Action:
- Expected impact:

## 2026-02-24

- Date: 2026-02-24
- Context: First connector integration.
- Signal: Pisos API key access was not immediately available.
- Decision: run connector in dual mode (official API first, compliant scraping fallback).
- Action: implemented fallback chain with diagnostics and fixture mode.
- Expected impact: avoid delivery stalls while keeping migration path to official API.

- Date: 2026-02-24
- Context: Valencia strict city queries.
- Signal: some nearby-town listings were incorrectly marked as exact city matches.
- Decision: trust structured `listing.city` before URL/path hints.
- Action: tightened matching logic and added regression tests.
- Expected impact: cleaner strict-mode relevance and less ranking noise.

- Date: 2026-02-24
- Context: Office capacity query parsing.
- Signal: `+50 people` was not extracted due to regex escaping bug.
- Decision: support multiple capacity patterns (`+50`, `50+`, ES/EN phrases).
- Action: parser fix + test coverage.
- Expected impact: reliable hard constraints for office search.

- Date: 2026-02-24
- Context: ChatGPT distribution path research.
- Signal: OpenAI product surface moved from "connectors" naming to "apps", and custom MCP usage requires remote endpoints.
- Decision: prioritize Vercel-hosted remote MCP as the first go-to-market channel.
- Action: updated backlog, foundation decisions, and connector research brief.
- Expected impact: faster path from prototype to a real user-facing ChatGPT entry point.

- Date: 2026-02-24
- Context: First deployment-path implementation sprint.
- Signal: stdio MCP server worked, but ChatGPT app integration requires a remote HTTP MCP endpoint.
- Decision: add a stateless HTTP MCP surface (`/api/mcp`) and lightweight health endpoint (`/api/health`) before deployment.
- Action: implemented Vercel-ready API handlers and an HTTP smoke client.
- Expected impact: immediate readiness for publish/test once Vercel credentials are provided.

- Date: 2026-02-24
- Context: Vercel production rollout for MCP endpoint.
- Signal: workspace package ESM resolution caused runtime failures in serverless execution.
- Decision: use root API handlers plus dynamic imports and direct source-path loading where required for serverless compatibility.
- Action: iterated deployment fixes until `/mcp` and `/health` passed remotely.
- Expected impact: stable baseline for ChatGPT app connection with zero local tunnel dependencies.

- Date: 2026-02-24
- Context: Live ChatGPT run showed weak matching for "good natural light" and no richer listing presentation.
- Signal: parser mapped `natural` to `nature`; ranking ignored floor/exterior/light signals.
- Decision: split "natural light" semantics from "nature" and add presentation-friendly cards in MCP output.
- Action: parser/tag fixes, connector tag inference upgrades, scoring boosts for light-related evidence, and `presentation_cards` + markdown card preview in `search_properties`.
- Expected impact: materially better relevance for bright homes and more visual, link-rich responses in ChatGPT.

- Date: 2026-02-24
- Context: Nature-focused broad queries ("pueblo bonito de España") produced fake city extraction and fixture-biased output.
- Signal: parser inferred `city = "Mitad de"` and no-city searches collapsed to fixtures.
- Decision: harden city extraction and enable scrape discovery mode when city is missing.
- Action: parser stopword guard for non-city phrases, rural-intent heuristics (`house`, `nearby_towns`), and connector discovery scrape seeds across major Spanish cities.
- Expected impact: broader, real scraped coverage for exploratory queries without forcing an exact city upfront.

- Date: 2026-02-24
- Context: Aggregator MCP strategy requires model agency without backend AI orchestration.
- Signal: single-city parser-driven calls constrained search breadth and made behavior opaque for future multi-portal growth.
- Decision: move to model-driven contract where backend executes explicit structured constraints and reports coverage.
- Action: upgraded `search_properties` schema for multi-location and execution controls, added deterministic floor/exterior constraints, and embedded execution/coverage diagnostics.
- Expected impact: better alignment with MCP connector semantics, stronger model control, and cleaner scaling path to multiple portals.

- Date: 2026-02-24
- Context: In ChatGPT, model still sent `query_text` without explicit geography for broad nature queries.
- Signal: structured mode fell back to discovery scraping and returned low-signal city-heavy results.
- Decision: enforce geography requirement in strict structured mode and sharpen tool schema/description instructions.
- Action: added `MISSING_LOCATIONS` action-required response when `city`/`locations[]` is missing, plus stronger field descriptions emphasizing location planning and `query_text` as context-only.
- Expected impact: model behavior shifts from passive query forwarding to explicit multi-location search planning, improving relevance and controllability.

- Date: 2026-02-24
- Context: Product is pre-launch and we control all clients.
- Signal: maintaining parser fallback created two backend execution systems and diluted MCP contract clarity.
- Decision: remove legacy parser execution path and keep only one structured deterministic backend flow.
- Action: deleted parser package usage from MCP runtime, removed parser workspace package, updated smoke tools/docs to structured-first behavior, and renamed diagnostics `parser_warnings` to `request_warnings`.
- Expected impact: simpler architecture, fewer hidden behaviors, and stronger model/tool contract alignment.

- Date: 2026-02-24
- Context: Tool metadata drift risk between local stdio MCP and deployed Vercel MCP handlers.
- Signal: duplicated tool descriptions/field docs can diverge and cause inconsistent model behavior.
- Decision: centralize search tool metadata as shared domain constants and adopt Booking-style action description.
- Action: moved tool title/description/field descriptions and missing-location guidance strings to `@fyn/domain` and wired both MCP runtimes to those shared exports.
- Expected impact: one canonical prompt contract for model tool-selection and more stable behavior across environments.

- Date: 2026-02-24
- Context: Text-only MCP output in ChatGPT limited user trust and discovery speed for property browsing.
- Signal: users needed richer visual scanning (images/cards/map) directly in the connector flow.
- Decision: attach an MCP Apps UI component to `search_properties` using shared resource/template metadata.
- Action: registered `ui://widget/fyn-search-results-v1.html`, added `_meta.ui.resourceUri` + `openai/outputTemplate`, and shipped a logo-inspired map + list widget that renders from `presentation_cards`.
- Expected impact: immediate visual UX lift in ChatGPT while keeping backend deterministic and model-driven.

## 2026-02-25

- Date: 2026-02-25
- Context: Connector expansion required multi-portal support without backend AI orchestration.
- Signal: domain contracts still encoded `pisos` as the only source and could not represent blocked portals cleanly.
- Decision: generalize contracts to `PortalSource` and extend error taxonomy with `UPSTREAM_BLOCKED` + `UPSTREAM_UNAVAILABLE`.
- Action: updated shared domain types, tool metadata descriptions, and connector error envelope handling.
- Expected impact: stable, scalable MCP contract as new portals are added.

- Date: 2026-02-25
- Context: Expansion work needed practical progress despite anti-bot behavior across major portals.
- Signal: `fotocasa` and `tucasa` behavior varied by route and anti-bot checks.
- Decision: ship real connectors where parsing is possible, and expose explicit portal-level failures via coverage diagnostics.
- Action: implemented `@fyn/connectors-tucasa` and `@fyn/connectors-fotocasa`, integrated both in MCP source orchestration, and added parser unit tests.
- Expected impact: aggregator behavior improves immediately while failures remain transparent and non-silent.

- Date: 2026-02-25
- Context: Root deployed MCP handler duplicated server logic and risked divergence.
- Signal: metadata, schema, and orchestration changes had to be updated in two places.
- Decision: make root handler a thin transport wrapper over the shared MCP server factory.
- Action: replaced `server/mcp-handler.ts` with shared `createFynMcpServer()` wiring.
- Expected impact: lower maintenance overhead and fewer production/local behavior mismatches.

- Date: 2026-02-25
- Context: Major-portal expansion without API keys required another reliable scraper source.
- Signal: `habitaclia` city-scoped list pages exposed structured listing metadata (`data-href`, `data-pvp`, `data-hab`, subtype) and stable image URLs.
- Decision: implement `habitaclia` as a first-class connector and include it in default multi-source execution.
- Action: shipped `@fyn/connectors-habitaclia`, added parser tests, wired MCP defaults/env vars/docs, and validated with Ronda smoke runs.
- Expected impact: broader inventory coverage and stronger nature/town searches without extra API credentials.

- Date: 2026-02-25
- Context: Connector anti-bot detection falsely flagged valid pages.
- Signal: normal `habitaclia` pages include `urlCaptcha` strings, triggering the generic `captcha` heuristic.
- Decision: tighten bot-block detection to explicit interruption/access-denied signatures instead of raw `captcha` substring.
- Action: updated shared `looksLikeBotBlockPage` matcher in `@fyn/connectors-core` and revalidated smoke output.
- Expected impact: fewer false-positive block errors and more stable multi-source execution.

- Date: 2026-02-25
- Context: `yaencontre` needed major-portal coverage without API keys.
- Signal: responses alternate between real HTML and DataDome challenge pages; static blocked placeholders wasted reachable windows.
- Decision: replace placeholder with a probe-first connector that parses encoded app state when reachable and emits stable blocked diagnostics when challenged.
- Action: implemented `@fyn/connectors-yaencontre`, added DataDome-aware error mapping (including challenge cid), and parsed `window.__INITIAL_STATE__` listing payload for title/price/rooms/images/geo.
- Expected impact: incremental inventory gains when access is open, with deterministic fallback behavior when anti-bot is triggered.

- Date: 2026-02-25
- Context: `fotocasa` detail pages are often blocked even when search pages remain reachable.
- Signal: connector lost all results when detail enrichment failed, despite valid list-page cards.
- Decision: parse and keep list-level cards as first-class fallback, then enrich with details opportunistically.
- Action: added search-card parser in `@fyn/connectors-fotocasa` and merged detail data over fallback cards when available; added regression test for blocked-detail fallback.
- Expected impact: fewer empty responses and better resilience under partial anti-bot pressure.

- Date: 2026-02-25
- Context: adding another high-volume source without API keys while keeping deterministic connector behavior.
- Signal: `milanuncios` list pages expose rich card HTML (title, URL, location, price, tags, images) and are reachable with browser-like headers.
- Decision: implement `milanuncios` as first-class scraper source with strict city filtering plus broad fallback if no exact city matches appear.
- Action: shipped `@fyn/connectors-milanuncios`, integrated it into MCP defaults and source schema, added blocked/rate-limit error mapping, and smoke-tested with live Valencia queries.
- Expected impact: larger inventory coverage in key searches and better multi-source ranking diversity when other portals are partially blocked.

- Date: 2026-02-25
- Context: `yaencontre` frequently blocks one candidate route while another route can still be reachable in the same execution.
- Signal: previous behavior threw on first blocked path, aborting potentially successful fallback paths.
- Decision: treat per-path blocked/rate-limit/unavailable responses as recoverable until all candidates fail.
- Action: updated `@fyn/connectors-yaencontre` to continue across candidate paths, added city-match post-filtering, and added a regression test for mixed blocked+reachable path sequences.
- Expected impact: fewer false-negative failures and more consistent contribution from `yaencontre` in multi-source aggregation.

- Date: 2026-02-25
- Context: `idealista` is a must-have source but strongly anti-bot in this environment.
- Signal: requests consistently returned DataDome challenge pages with 403 and embedded challenge ids.
- Decision: replace static blocked placeholder with a probe connector that captures cid-aware blocked diagnostics and parses listings opportunistically when pages are reachable.
- Action: shipped `@fyn/connectors-idealista`, mapped blocked/rate-limit/unavailable outcomes, and added parser tests for JSON-LD/card paths.
- Expected impact: better observability and optional inventory gains without breaking aggregator stability.

- Date: 2026-02-25
- Context: expansion needed one more live scraper source that actually returns cards now.
- Signal: `globaliza` city listing pages are reachable and expose stable list-card metadata (title, URL, price, rooms, area, image, city).
- Decision: integrate `globaliza` into MCP defaults as a live source.
- Action: shipped `@fyn/connectors-globaliza`, wired domain/MCP/env/docs, and validated live smoke (`globaliza` only and `idealista + globaliza` mixed).
- Expected impact: higher hit-rate and stronger multi-source diversity in Spain searches while major anti-bot portals are partially blocked.

- Date: 2026-02-25
- Context: long-tail town searches needed another source with stable HTML and no API key requirements.
- Signal: `hogaria.net` city and province routes are reachable and listing cards expose URL, price, rooms, area, city, image, and description directly in list HTML.
- Decision: integrate `hogaria` as a first-class source with mapped city->province routing plus province-route fallback for discovery.
- Action: shipped `@fyn/connectors-hogaria`, wired MCP/domain/env/docs, added parser tests, and validated live smoke (`sources:[\"hogaria\"]`, city=`Ronda`).
- Expected impact: better coverage for rural/small-town intent while keeping deterministic connector behavior and explainable diagnostics.

- Date: 2026-02-25
- Context: multi-source aggregation started surfacing near-identical listings from different portals.
- Signal: top results could repeat the same property with only source variation, reducing recommendation diversity.
- Decision: add conservative near-duplicate collapse before final ranking.
- Action: implemented cross-source dedupe in MCP (`title/city/price/rooms` compatibility + URL normalization), exposed dedupe count in diagnostics warnings, and validated with live Valencia smoke.
- Expected impact: cleaner top cards, better diversity, and fewer repetitive recommendations.

- Date: 2026-02-25
- Context: connector expansion needed a repeatable quality gate while founder is offline.
- Signal: checking each source manually is slow and easy to miss regressions.
- Decision: add one-command source smoke harness with contract-aware result classification.
- Action: shipped `smoke:sources` (`apps/mcp-server/src/smoke-sources.ts`) to run per-source MCP calls and classify `ok`, `upstream_error`, or `failed`.
- Expected impact: faster regression detection for connector changes and safer overnight autonomous iteration.

- Date: 2026-02-25
- Context: long-tail expansion queue needed a source that is stable without API keys.
- Signal: `pisocompartido` list pages are reachable, include parseable card HTML, and expose `application/ld+json` blocks with geo and media data.
- Decision: integrate `pisocompartido` as a rent-focused connector and include it conditionally in default source selection.
- Action: shipped `@fyn/connectors-pisocompartido`, wired MCP/domain/env/docs, and validated with live smoke on Valencia rental inventory.
- Expected impact: stronger rental coverage and better city-level map/card quality for room and shared-flat intents.

- Date: 2026-02-25
- Context: dedupe diagnostics wording caused confusion when a single source had repeated cards.
- Signal: warning text said “across sources” even when duplicates came from pagination within one source.
- Decision: keep dedupe behavior but generalize warning wording.
- Action: changed MCP warning text to “Deduplicated N near-identical listings before ranking.”
- Expected impact: diagnostics remain accurate and trustworthy in both single-source and multi-source runs.

- Date: 2026-02-25
- Context: rental coverage needed another high-signal source without API keys.
- Signal: `enalquiler.com` exposes stable city/province listing routes and parseable `propertyCard` HTML with image, price, room, description, and deep-link fields.
- Decision: integrate `enalquiler` as a rent-focused connector and include it conditionally in default source selection for rent + flat/house intents.
- Action: shipped `@fyn/connectors-enalquiler`, added ajax location resolution + route fallback logic, wired MCP/domain/env/docs/smoke harness, and validated live smoke on Valencia.
- Expected impact: improved rental inventory breadth and more visual card quality while keeping deterministic connector contracts.

- Date: 2026-02-25
- Context: long-tail expansion continued after `enalquiler` with no API-key dependency.
- Signal: `nuroa.es` search pages remained reachable and exposed stable listing cards, but deep links were wrapped in nested conversion URLs.
- Decision: integrate `nuroa` as a first-class source and decode nested outbound `url` targets to preserve direct source listing links.
- Action: shipped `@fyn/connectors-nuroa`, wired MCP/domain/env/docs/smoke harness, and validated live Valencia buy-path smoke.
- Expected impact: broader coverage from a resilient aggregator surface while retaining transparent deep links and deterministic diagnostics.

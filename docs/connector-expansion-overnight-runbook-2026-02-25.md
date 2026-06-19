# Fyn Overnight Connector Expansion Runbook

Last updated: 2026-02-25
Owner: Codex
Status: Active execution plan for autonomous work while founder is offline.

## Purpose

This document is the persistence layer for connector expansion work. If context is lost, resume from this file and continue shipping without waiting for human input.
Primary cold-start references: `docs/autonomous-continuation-playbook.md` and `docs/connector-context-continuity.md`.

## Non-Stop Execution Contract

- Treat this runbook + `docs/backlog.md` as source of truth while founder is offline.
- Never block waiting for new prompts unless there is a true external dependency (credentials, account access, legal hold).
- If a task is blocked, document the blocker in backlog + learning log and immediately pull the next highest-priority task.
- Always leave repo state recoverable:
  - one focused commit per vertical slice,
  - tests green before moving on,
  - docs updated before switching tasks.
- Founder-offline rule: do not wait for approval between backlog tasks; finish one slice and pull the next immediately.

## Context-Loss Recovery (Cold Start)

If a new session starts with little/no prior context, do not stop and ask for direction. Execute this sequence immediately:

1. Open this file, `docs/connector-context-continuity.md`, and `docs/backlog.md`.
2. Run `git status --short` to identify local working state.
3. Run quality sanity checks (`pnpm typecheck`, `pnpm test`) if code changed since last known green run.
4. Pick the first unchecked connector task in backlog priority order.
5. Implement, validate, document, commit, and continue to the next task.

No discussion step is required while founder is offline unless a real external dependency is hit.

## Autonomous Continuation Instructions

If context is lost or the thread is interrupted, continue with this exact loop:

1. Open `docs/backlog.md` and this runbook.
2. Resume from the first unchecked connector item in priority order.
3. Implement + validate (`pnpm typecheck`, `pnpm test`, smoke when MCP changes).
4. Write learnings to `docs/learning-log.md`.
5. Commit.
6. Repeat until no connector task remains or a true external blocker exists.

## Snapshot (Current Reality)

- Remote MCP connector path is working with a compatible client.
- MCP tool `search_properties` is operational with `pisos + habitaclia + tucasa + fotocasa + yaencontre + milanuncios + globaliza + hogaria + spainhouses + nuroa` default scraping sources, plus conditional `pisocompartido + enalquiler` (rent + flat/house intents).
- `idealista` is now a probe connector with cid-aware blocked diagnostics and best-effort parsing for reachable windows.
- `globaliza` is wired as a live scraping source and validated in smoke runs.
- `hogaria` is wired as a live scraping source and validated in smoke runs (`Ronda` city path).
- `spainhouses` is wired as a live scraping source with parser tests and stable blocked diagnostics in smoke runs.
- `pisocompartido` is wired as a live scraping source and validated in smoke runs (`Valencia` rent path).
- `enalquiler` is wired as a live scraping source and validated in smoke runs (`Valencia` rent path).
- `nuroa` is wired as a live scraping source and validated in smoke runs (`Valencia` buy path).
- MCP now deduplicates near-identical cross-source listings before final ranking.
- A per-source smoke harness is available via `pnpm smoke:sources`.
- Website phase is closed for now; current priority is connector expansion and search quality.
- We currently do not rely on portal API keys for expansion tasks.

## Research Summary Matrix

| Portal | Reachability | Integration state | Notes |
| --- | --- | --- | --- |
| `pisos.com` | Stable | Implemented | API path exists but keyless mode relies on scraper fallback. |
| `tucasa.com` | Stable | Implemented | JSON-LD surface is parse-friendly. |
| `fotocasa.es` | Partially stable | Implemented | Detail parser + list-card fallback; anti-bot variability remains. |
| `habitaclia.com` | Stable city routes | Implemented | Structured list attributes and good image coverage. |
| `idealista.com` | Frequently blocked | Implemented (probe) | DataDome challenge mapped with cid-aware error message; parsed when reachable. |
| `yaencontre.com` | Variable, often DataDome-blocked | Implemented | Uses probe + encoded `__INITIAL_STATE__` parser, plus mixed path retry so one blocked path does not abort other paths. |
| `milanuncios.com` | Stable with browser-like headers | Implemented | Listing-card parser with city filtering and resilient fallback behavior. |
| `globaliza.com` | Stable | Implemented | Large list-card HTML pages with structured price/rooms/surface metadata and image coverage. |
| `hogaria.net` | Stable | Implemented | Listing-card HTML is parseable; city routes plus province-route fallback support long-tail towns. |
| `spainhouses.net` | Partially stable | Implemented | Property-block HTML is parseable with city/province routes; often blocked in automation context but diagnostics are stable. |
| `pisocompartido.com` | Stable | Implemented | Rent-focused room inventory with parseable list cards and `application/ld+json` geo metadata. |
| `enalquiler.com` | Stable | Implemented | Rent-focused city/province routes with parseable property cards and strong image coverage. |
| `nuroa.es` | Stable | Implemented | Aggregator list pages are parseable; connector extracts nested outbound listing URLs from conversion links. |

## Research Ledger (Connector Expansion Focus)

This is the minimum evidence snapshot needed to continue without searching conversation history:

- `pisos`: live source, dual mode (API key when available + scrape fallback).
- `tucasa`: live source, parse-friendly metadata surfaces.
- `fotocasa`: live source, list parsing + detail enrichment fallback when blocked.
- `habitaclia`: live source, stable city routes with structured fields.
- `yaencontre`: live but volatile (DataDome); probe/retry behavior implemented.
- `milanuncios`: live source, resilient list-card extraction.
- `globaliza`: live source, stable list-card extraction.
- `hogaria`: live source, province fallback strategy for long-tail towns.
- `spainhouses`: live source with stable parser/tests; currently high anti-bot friction in smoke environments.
- `pisocompartido`: live source, rent-focused room listings with city-route fallbacks.
- `enalquiler`: live source, rent-focused city/province route resolution with stable card extraction.
- `nuroa`: live source, parseable aggregator cards with outbound URL extraction and city-filter fallback.
- `idealista`: best-effort probe; often blocked, diagnostics still useful.

Current expansion target order from backlog:

1. regional/long-tail portals with parseable list pages beyond current set
2. city->province routing coverage expansion for small-town queries
3. connector-level quality hardening for anti-bot variability

## Portal Research Results (Evidence-Based)

Research date: 2026-02-25

### Tier A: Implemented baseline connectors

1. `pisos.com` (already integrated)
- Reachability: stable.
- Data quality: good listing URL/title/price/rooms/images.
- Current state: integrated as first connector.

2. `tucasa.com`
- Reachability: stable.
- Parsing surface: list pages expose rich JSON-LD (`ItemList`) with listing metadata.
- Integration complexity: low-medium.
- Expected value: fast second source with robust structured extraction.

3. `fotocasa.es`
- Reachability: accessible with browser-like headers.
- Parsing surface: search pages expose listing links; detail pages expose title/price/description/image/canonical metadata.
- Integration complexity: medium.
- Expected value: high inventory coverage as a major portal.

4. `habitaclia.com`
- Reachability: city-scoped listing pages are reachable with browser-like headers.
- Parsing surface: list pages expose rich `data-*` attributes (URL, price, rooms, subtype) and listing images.
- Integration complexity: medium.
- Expected value: strong geographic coverage and good structured extraction quality.

5. `milanuncios.com`
- Reachability: stable with browser-like headers.
- Parsing surface: list-card HTML exposes title, URL, location, price, room tags, image and full snippet.
- Integration complexity: medium.
- Expected value: broad long-tail supply with good media coverage.

6. `pisocompartido.com`
- Reachability: stable with browser-like headers.
- Parsing surface: list cards include listing URL, price, location, image gallery fields, plus per-card `application/ld+json` geo data.
- Integration complexity: medium.
- Expected value: dedicated rental room/shared-flat coverage where other portals under-index.

7. `enalquiler.com`
- Reachability: stable with browser-like headers.
- Parsing surface: route-based list pages expose rich `propertyCard` HTML (URL, title, price, rooms, description, image).
- Integration complexity: medium.
- Expected value: high-quality rental inventory and strong media coverage for chat cards.

8. `nuroa.es`
- Reachability: stable with browser-like headers.
- Parsing surface: list pages expose `group nu_row` cards with title, city, price, images, and conversion links with nested outbound listing URLs.
- Integration complexity: medium.
- Expected value: broad long-tail coverage through aggregator inventory with direct-source deep-link extraction.

9. `spainhouses.net`
- Reachability: route-dependent; frequent automation blocks but non-blocked windows return rich listing HTML.
- Parsing surface: `article.property_block` cards expose stable `data-href`, `data-position`, title, city, features, price and lazy-loaded images.
- Integration complexity: medium.
- Expected value: additional long-tail housing inventory and rural coverage when anti-bot pressure is low.

### Tier B: High-friction / anti-bot

1. `idealista.com`
- Frequent anti-bot/captcha/403 behavior.
- Strategy: keep probe connector active, preserve cid-aware blocked diagnostics, and use parse paths opportunistically.

2. `yaencontre.com`
- Reachability alternates between accessible and DataDome challenge responses.
- Strategy: keep live probe adapter with stable blocked diagnostics and continue parser hardening.

## Operating Principle For This Phase

- Prefer shipping working connectors over perfect connectors.
- Keep adapter contracts stable and deterministic for the model.
- If a portal blocks automation, return stable internal errors and continue with other sources.
- No waiting for human unblockers unless credentials or legal/compliance policy is explicitly required for a gate.

## Autonomous Backlog Selection Rules

When multiple tasks are open, pick the next one with this order:

1. Any unchecked `P0` in `In Progress`.
2. Connector reliability tasks affecting current default sources (`pisos`, `habitaclia`, `tucasa`, `fotocasa`, `yaencontre`, `milanuncios`, `globaliza`, `hogaria`, `spainhouses`, `nuroa`) and conditional sources (`pisocompartido`, `enalquiler`).
3. Connector reliability tasks for best-effort source `idealista`.
4. Contract and tooling improvements that reduce integration cost for future portals.

If two tasks have the same priority, choose the one that:
- improves production behavior immediately, or
- unblocks later adapters via shared utilities/tests.

## Backlog Pull Loop (Do Not Stop)

Run this cycle continuously:

1. Read `docs/backlog.md`.
2. Pick top unfinished `P0/P1` connector task.
3. Implement one demoable vertical slice.
4. Run quality gates (`typecheck`, `test`, smoke where possible).
5. Update docs:
   - `docs/backlog.md` (status + next task),
   - `docs/learning-log.md` (one concrete learning),
   - this runbook if strategy changed.
6. Commit with focused message.
7. Immediately pull next highest-priority unfinished task.
8. Repeat until all connector expansion tasks in `In Progress` + `Next Up` are complete or genuinely blocked.

Never idle after a task closes; always move to next backlog item.

### Mandatory loop guardrails

- If one portal blocks requests, do not pause the run. Log it and continue with the next portal task.
- If one connector regresses, fix or isolate it, then continue with queued work in the same session.
- Every completed slice must leave a breadcrumb in `docs/learning-log.md` and update backlog state.

## Immediate Execution Queue (Current)

- [x] Align domain for multi-portal support (`PortalSource`, error codes, contracts).
- [x] Implement `@fyn/connectors-tucasa`.
- [x] Implement `@fyn/connectors-fotocasa`.
- [x] Implement `@fyn/connectors-habitaclia`.
- [x] Implement `@fyn/connectors-yaencontre` probe adapter.
- [x] Implement `@fyn/connectors-milanuncios`.
- [x] Implement `@fyn/connectors-idealista` probe adapter with cid-aware diagnostics.
- [x] Implement `@fyn/connectors-globaliza`.
- [x] Implement `@fyn/connectors-hogaria`.
- [x] Implement `@fyn/connectors-spainhouses`.
- [x] Implement `@fyn/connectors-pisocompartido`.
- [x] Implement `@fyn/connectors-enalquiler`.
- [x] Implement `@fyn/connectors-nuroa`.
- [x] Wire `apps/mcp-server` to execute multi-source requests and aggregate coverage.
- [x] Wire root deployed MCP handler to same multi-source behavior.
- [x] Add tests for new connectors and source selection behavior.
- [x] Update docs.
- [x] Improve `yaencontre` consistency under mixed block/unblock responses.
- [x] Improve cross-source deduplication of near-identical listings.
- [x] Add minimal connector-level contract smoke set for every default source.
- [x] Commit.
- [ ] Continue with next backlog connector tasks:
  - extend regional long-tail sources (next: regional agency/MLS-style portals after `spainhouses`),
  - expand city->province routing coverage for long-tail location intent.

## Task Completion Checklist (Per Slice)

- [ ] Code implemented.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] Relevant smoke path executed (local or remote).
- [ ] `docs/backlog.md` updated.
- [ ] `docs/learning-log.md` updated.
- [ ] This runbook updated if strategy or status changed.
- [ ] Focused commit created.

## Stable Error Taxonomy (Target)

- `MISSING_API_KEY`
- `AUTH_REJECTED`
- `UPSTREAM_RATE_LIMIT`
- `UPSTREAM_SCHEMA_CHANGED`
- `UPSTREAM_BLOCKED`
- `UPSTREAM_UNAVAILABLE`

Error envelope:

```json
{ "code": "...", "message": "...", "retryable": true, "source_portal": "..." }
```

## Quality Gates Per Iteration

Required before moving to next task:

```bash
pnpm typecheck
pnpm test
```

When MCP behavior changes, also run:

```bash
pnpm smoke:mcp -- "Find me a flat in Valencia with at least three rooms, max 350k"
```

If one gate fails, fix or isolate to keep trunk usable; do not ignore.

## Resume Protocol (If Context Is Lost)

1. Open this file first.
2. Open `docs/backlog.md`.
3. Run `git status --short`.
4. Continue from first unchecked item in **Immediate Execution Queue**.
5. Do not pause for confirmation unless a true external blocker exists.

## Continue-Until-Blocked Rule

While founder is offline, execution should only stop when:

- credentials/account access are required and unavailable,
- infrastructure outage prevents local/test execution,
- or a legal/compliance hold is explicitly added to backlog.

Otherwise, continue pulling connector tasks from backlog without waiting.

## Quick Resume Commands

```bash
git status --short
pnpm install
pnpm typecheck
pnpm test
pnpm smoke:sources
pnpm smoke:mcp -- '{"locale":"es","transaction_type":"buy","property_types":["flat"],"city":"Valencia","min_rooms":3,"max_price_eur":350000,"sources":["pisos","habitaclia","tucasa","fotocasa","yaencontre","milanuncios","globaliza","hogaria","spainhouses","nuroa"],"strict_constraints":true,"max_results_total":10}'
pnpm smoke:mcp -- '{"locale":"es","transaction_type":"rent","property_types":["flat"],"city":"Valencia","sources":["pisocompartido","enalquiler"],"strict_constraints":true,"max_results_total":10}'
```

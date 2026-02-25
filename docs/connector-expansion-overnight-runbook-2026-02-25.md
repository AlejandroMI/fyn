# Fyn Overnight Connector Expansion Runbook

Last updated: 2026-02-25
Owner: Codex
Status: Active execution plan for autonomous work while founder is offline.

## Purpose

This document is the persistence layer for connector expansion work. If context is lost, resume from this file and continue shipping without waiting for human input.

## Non-Stop Execution Contract

- Treat this runbook + `docs/backlog.md` as source of truth while founder is offline.
- Never block waiting for new prompts unless there is a true external dependency (credentials, account access, legal hold).
- If a task is blocked, document the blocker in backlog + learning log and immediately pull the next highest-priority task.
- Always leave repo state recoverable:
  - one focused commit per vertical slice,
  - tests green before moving on,
  - docs updated before switching tasks.

## Snapshot (Current Reality)

- ChatGPT connector path is working in developer mode.
- MCP tool `search_properties` is operational with `pisos + habitaclia + tucasa + fotocasa` default scraping sources.
- `yaencontre` is now wired as an optional source with live probe behavior and stable DataDome diagnostics.
- Website phase is closed for now; current priority is connector expansion and search quality.
- We currently do not rely on portal API keys for expansion tasks.

## Research Summary Matrix

| Portal | Reachability | Integration state | Notes |
| --- | --- | --- | --- |
| `pisos.com` | Stable | Implemented | API path exists but keyless mode relies on scraper fallback. |
| `tucasa.com` | Stable | Implemented | JSON-LD surface is parse-friendly. |
| `fotocasa.es` | Partially stable | Implemented | Works with browser-like headers; anti-bot variability remains. |
| `habitaclia.com` | Stable city routes | Implemented | Structured list attributes and good image coverage. |
| `idealista.com` | Frequently blocked | Blocked adapter | Keep stable diagnostics; revisit with stronger extraction strategy. |
| `yaencontre.com` | Variable, often DataDome-blocked | Implemented (optional source) | Uses probe + encoded `__INITIAL_STATE__` parser when reachable; emits stable blocked diagnostics otherwise. |

## Portal Research Results (Evidence-Based)

Research date: 2026-02-25

### Tier A: Ready to implement now

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

### Tier B: High-friction / anti-bot

1. `idealista.com`
- Frequent anti-bot/captcha/403 behavior.
- Strategy: treat as blocked connector with stable diagnostics until reliable extraction path exists.

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
2. Connector reliability tasks affecting current default sources (`pisos`, `habitaclia`, `tucasa`, `fotocasa`).
3. New major-portal adapter spike (`idealista`, `yaencontre`) with stable error reporting.
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

## Immediate Execution Queue (Current)

- [x] Align domain for multi-portal support (`PortalSource`, error codes, contracts).
- [x] Implement `@fyn/connectors-tucasa`.
- [x] Implement `@fyn/connectors-fotocasa`.
- [x] Implement `@fyn/connectors-habitaclia`.
- [x] Implement `@fyn/connectors-yaencontre` probe adapter.
- [x] Wire `apps/mcp-server` to execute multi-source requests and aggregate coverage.
- [x] Wire root deployed MCP handler to same multi-source behavior.
- [x] Add tests for new connectors and source selection behavior.
- [x] Update docs.
- [ ] Commit.
- [ ] Continue with next backlog connector tasks:
  - improve `fotocasa` coverage resilience,
  - improve `yaencontre` consistency under mixed block/unblock responses,
  - add another reachable portal.

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

## Quick Resume Commands

```bash
git status --short
pnpm install
pnpm typecheck
pnpm test
pnpm smoke:mcp -- '{"locale":"es","transaction_type":"buy","property_types":["flat"],"city":"Valencia","min_rooms":3,"max_price_eur":350000,"sources":["pisos","habitaclia","tucasa","fotocasa"],"strict_constraints":true,"max_results_total":10}'
```

# Fyn Autonomous Continuation Playbook

Last updated: 2026-02-25  
Owner: Codex  
Scope: Connector expansion and backlog execution while founder is offline

## Why this exists

This is the single recovery document for context loss. If a session resets, open this file first and continue without waiting for new prompts.

## Current Research Snapshot (Evidence)

### Live integrated sources

- `pisos` (buy/rent): stable scrape fallback, first baseline source.
- `habitaclia` (buy/rent): stable city routes, parseable list metadata.
- `tucasa` (buy/rent): parse-friendly list data.
- `fotocasa` (buy/rent): list parser with detail fallback under blocking.
- `yaencontre` (buy/rent): variable; probe + blocked diagnostics + mixed-path retry.
- `milanuncios` (buy/rent): stable list-card extraction with city filtering.
- `globaliza` (buy/rent): stable list-card extraction.
- `hogaria` (buy/rent): city and province fallback support for long-tail towns.
- `pisocompartido` (rent-focused): stable room/shared-flat source with JSON-LD geo/media.
- `enalquiler` (rent-focused): stable city/province route resolution with strong image-rich cards.
- `idealista` (probe): frequent DataDome blocks; diagnostics source, opportunistic parsing.

### Next connector candidates researched

- `nuroa.es`: reachable but largely re-aggregated outbound inventory.
- `indomio.es`: blocked in current automation context.
- regional agency networks/MLS-style long-tail portals: still open queue after `enalquiler`.

## Cold-Start Recovery Steps (Do Immediately)

1. Open this file, `docs/backlog.md`, and `docs/connector-expansion-overnight-runbook-2026-02-25.md`.
2. Check working tree:

```bash
git status --short
```

3. If code changed since last green run, validate baseline:

```bash
pnpm typecheck
pnpm test
```

4. Pick the first unchecked top-priority connector task from backlog.
5. Execute one full vertical slice:
   - implement connector or hardening task,
   - add/adjust tests,
   - run smoke,
   - update docs,
   - commit.
6. Immediately pull the next unfinished task. Do not wait for human confirmation.

## No-Stop Backlog Loop

Repeat until queue is exhausted or a real external blocker exists:

1. Select highest-priority unchecked task (`P0` then `P1`, top-to-bottom).
2. Implement smallest demoable slice.
3. Validate:

```bash
pnpm typecheck
pnpm test
pnpm smoke:sources
```

If MCP behavior changed, also run:

```bash
pnpm smoke:mcp -- '{"locale":"es","transaction_type":"buy","property_types":["flat"],"city":"Valencia","strict_constraints":true,"max_results_total":8}'
```

4. Update:
   - `docs/backlog.md` (status/outcome),
   - `docs/learning-log.md` (one concrete learning),
   - this playbook only if priorities/research changed.
5. Commit focused change.
6. Continue with next task immediately.

## Blocker Protocol

Only stop if blocked by one of these:

- credentials/account access truly required,
- infrastructure outage prevents all progress,
- explicit legal/compliance stop.

If blocked:

1. Log blocker in backlog and learning log.
2. Move to next highest-priority unblocked task in same session.
3. Never idle.

## Commit Discipline

- One focused commit per completed slice.
- Avoid mixing unrelated work.
- Keep user-changed files untouched unless task requires them.

## Next Execution Target

- `P2 Secondary long-tail sources` from backlog.
- First implementation target: next long-tail source after `enalquiler` (candidate: `nuroa` spike), then reassess connector quality vs. inventory uniqueness.

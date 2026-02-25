# Fyn Connector Context Continuity

Last updated: 2026-02-25  
Owner: Codex  
Purpose: single context-recovery document with current research evidence, validated status, and no-stop execution steps.

## Current Connector State (Research + Implementation)

### Stable integrated sources (working in smoke)

- `pisos` (API with key, scrape fallback without key)
- `habitaclia`
- `tucasa`
- `globaliza`
- `hogaria`
- `nuroa`
- `enalquiler` (rent-focused)
- `pisocompartido` (rent-focused; can legitimately return 0 depending on constraints)

### Integrated but anti-bot sensitive (diagnostics-first)

- `fotocasa` (frequent `UPSTREAM_BLOCKED`)
- `yaencontre` (frequent DataDome `UPSTREAM_BLOCKED`, cid-aware message)
- `milanuncios` (frequent `UPSTREAM_BLOCKED`)
- `idealista` (probe source, often blocked)
- `spainhouses` (new; parser implemented and tested, often blocked in automation context)

## Latest Validation Snapshot

Executed in this cycle:

```bash
pnpm typecheck
pnpm test
pnpm smoke:sources
pnpm smoke:mcp -- '{"locale":"en","transaction_type":"buy","property_types":["flat"],"city":"Valencia","min_rooms":3,"strict_constraints":true,"max_results_total":10}'
pnpm smoke:mcp -- '{"locale":"es","transaction_type":"buy","property_types":["house"],"locations":["Ronda","Cangas de Onís","Albarracín","Cudillero","Grazalema"],"nearby_towns":true,"tags":["nature","views"],"strict_constraints":false,"max_results_total":10}'
pnpm smoke:mcp -- '{"locale":"es","transaction_type":"buy","property_types":["house"],"query_text":"vivienda en naturaleza","strict_constraints":true,"max_results_total":10}'
```

Key outcomes:

- Test/typecheck gates pass.
- `smoke:sources` has `failed_count: 0` (all failures are classified upstream blocks/unavailability, not contract regressions).
- Structured strict-mode behavior is correct: no location -> `action_required.code = "MISSING_LOCATIONS"`.
- Multi-location orchestration returns ranked cards + per-location, per-portal coverage diagnostics.

## Cold-Start Recovery Steps (If Context Is Lost)

1. Open this file, then `docs/backlog.md`, `docs/autonomous-continuation-playbook.md`, and `docs/connector-expansion-overnight-runbook-2026-02-25.md`.
2. Check repository state:

```bash
git status --short
```

3. Run baseline quality:

```bash
pnpm typecheck
pnpm test
pnpm smoke:sources
```

4. Continue from the first unchecked connector item in `docs/backlog.md`.
5. Ship one vertical slice: implement -> test -> smoke -> docs update -> commit.
6. Immediately pull the next unchecked backlog item. Do not wait for new prompts unless truly blocked by external dependency.

## No-Stop Backlog Loop

Repeat until connector queue is exhausted:

1. Pick highest-priority unchecked task.
2. Implement smallest demoable increment.
3. Validate with quality gates and at least one relevant smoke.
4. Update:
   - `docs/backlog.md`
   - `docs/learning-log.md`
   - this file if research/status changed
5. Commit focused change.
6. Continue with next task.

Block only on real external dependencies (credentials/account/legal hold). Otherwise keep moving.

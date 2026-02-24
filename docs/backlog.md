# Fyn Backlog

Last updated: 2026-02-24

## Working Rules

- Keep focus: max 3 tasks `In Progress` at once.
- Ship vertical slices: each task must end in something demoable.
- Every completed task adds at least one learning entry to `docs/learning-log.md`.
- Anything blocked for more than 24h gets moved to `Blocked / Needs`.
- Vercel is the default deployment target.
- Demo path: landing sends users directly to the ChatGPT app/connector URL.

## In Progress (Now)

- [ ] `P0` Vercel MCP endpoint (ChatGPT-ready)
  - Owner: Codex
  - Goal: expose `search_properties` via remote MCP transport on Vercel.
  - Definition of done: `/mcp` reachable, healthcheck endpoint, smoke call works remotely.
- [ ] `P0` ChatGPT app connector alpha
  - Owner: Codex
  - Goal: run Fyn from ChatGPT app connection using real listings.
  - Definition of done: one successful end-to-end run in ChatGPT with sample prompt.
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
  - Hypothesis: official access may require onboarding; if blocked, evaluate compliant scrape feasibility.
- [ ] `P1` Fotocasa adapter discovery spike
  - Hypothesis: strong anti-bot controls; likely slower path and higher risk.
- [ ] `P2` Habitaclia adapter discovery spike
  - Hypothesis: anti-bot friction similar to Fotocasa.
- [ ] `P2` Secondary long-tail sources
  - Candidates: smaller regional portals and agency networks with easier integration surfaces.

## Blocked / Needs From Founder

- [ ] ChatGPT app connection access confirmed in your account (Developer Mode enabled).
- [ ] Final connector launch URL once we publish the first ChatGPT app entry.

## Done

- [x] Monorepo scaffold with MCP server, parser, scoring, first connector.
- [x] Pisos connector in dual mode: API when key exists, scraping fallback when key is missing.
- [x] Smoke-tested sample prompts through MCP pipeline.
- [x] Feedback loop ownership moved to founder operations so engineering stays build-focused.
- [x] Vercel HTTP MCP scaffold added (`/api/mcp`, `/api/health`, remote smoke client script).

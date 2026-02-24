# Fyn Foundation

## Brand Core

- Name: **Fyn** (Find Your Nest)
- Promise: natural-language property discovery that feels like working with a focused assistant, not a filter maze.
- Voice: precise, transparent, practical.
- Trust posture: always show source portal links and explain why each result matched.

## Problem

Housing search is fragmented across many portals. Users repeatedly rebuild filters, monitor updates manually, and lose context across tools.

## North Star

Build the best home-search copilot in Spain.

Primary KPI:
- Useful matches per session

Supporting KPIs:
- Saved-search retention (week-over-week)
- Alert open-to-click rate
- Query-to-first-good-result latency

## Product Principles

- Natural language first, structured filters second.
- Hard constraints are respected before ranking.
- Results are explainable (`why_matched`) and source-linked.
- Users can go deeper in the original portal at any time.
- Guest mode is frictionless; accounts unlock durable value.

## Business Principles

- Free beta first, validate utility and retention before pricing.
- Keep infra lean while proving demand.
- Build connector leverage: one search intent, many inventories.

## Engineering Mindset

- Ship vertical slices early and instrument them.
- Prefer reversible architecture choices.
- Keep contracts explicit across parser, connector, ranking, and MCP layers.
- Fail loudly on upstream schema drift.
- Build for observability from day one.
- Constraint-to-capability mindset: when APIs are closed, build compliant scraping systems that are rate-limited, monitorable, and replaceable.
- "What stands in the way becomes the way": blockers are signals to evolve architecture, not reasons to stall.

## Operating Model

- AI pair-programming is the default implementation engine.
- Founder provides unblockers: API keys, legal/docs context, branding and positioning feedback.
- Founder owns feedback-loop operations (user interviews, synthesis, and prioritization input).
- Weekly delivery rhythm:
  - Monday: scope lock
  - Mid-week: integration checkpoints
  - Friday: demo + quality gate

## Decision Log

- 2026-02-24: Product brand set to **Fyn**.
- 2026-02-24: Connector-first strategy selected; MCP as primary integration interface.
- 2026-02-24: First connector set to `pisos.com` based on live docs/access signal and anti-bot friction in alternatives.
- 2026-02-24: MVP language support starts with Spanish + English.
- 2026-02-24: Alerts set to daily-only in MVP.
- 2026-02-24: `pisos.com` connector runs in dual mode (official API when key exists, compliant scraping fallback when key is unavailable) so integration work is never blocked by credential availability.
- 2026-02-24: Vercel selected as default deployment platform for MCP and demo surfaces.
- 2026-02-24: Delivery order clarified: connector functionality first, compliance hardening immediately after first live user path.

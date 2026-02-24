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

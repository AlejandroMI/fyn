---
name: search-fyn-properties
description: Search public property listings in Spain through Fyn's normalized multi-portal MCP server. Use when a user asks an agent to find, compare, buy, or rent a flat, house, office, land, or room in Spain; wants lifestyle-based property discovery; or needs source-attributed Spanish real-estate results across multiple portals.
---

# Search Fyn properties

Connect to the public Streamable HTTP MCP server at `https://fynfyn.top/mcp`. No authentication or API key is required. Respect rate-limit and retry headers.

## Search workflow

1. Extract structured constraints from the request. Ask for a Spanish city, municipality, or area if none is available.
2. Call `search_properties` with `city` or `locations`, plus explicit `transaction_type`, `property_types`, budget, room, floor, and lifestyle constraints when known.
3. Keep `strict_constraints: true` unless the user explicitly asks for broad discovery.
4. Use `query_text` only for context that is not captured by structured fields.
5. Review `diagnostics.coverage`, `request_warnings`, and `connector_warnings` before summarizing results.
6. Present a short ranked set with price, location, match reason, and the original source link.

Example arguments:

```json
{
  "locale": "en",
  "transaction_type": "buy",
  "property_types": ["house"],
  "locations": ["Náquera", "Buñol", "Requena"],
  "max_price_eur": 350000,
  "tags": ["nature", "views"],
  "strict_constraints": true,
  "max_results_total": 20
}
```

## Recovery rules

- If `action_required.code` is `MISSING_LOCATIONS`, ask the user for a location and retry.
- If a source is blocked or rate-limited, disclose reduced coverage; do not describe the results as exhaustive.
- On HTTP `429`, wait for `Retry-After` and use bounded exponential backoff with jitter.
- Do not retry invalid arguments without correcting them.

## Safety and accuracy

Preserve the original listing URL and source attribution. State that price, availability, condition, and terms must be verified with the source portal or advertiser. Do not claim that Fyn reserves, purchases, values, or legally verifies property. Do not put personal or sensitive information into search criteria.

For the complete contract and limitations, read `https://fynfyn.top/llms-full.txt`.

# Fyn authentication for agents

## agent_auth

Fyn's public MCP search service currently uses anonymous access. No account, API key, OAuth flow, bearer token, identity assertion, `id-jag`, or payment is required. Do not send an `Authorization` header to `https://fynfyn.top/mcp`.

## Discover

Read this document, [llms.txt](https://fynfyn.top/llms.txt), and the [MCP server card](https://fynfyn.top/.well-known/mcp/server-card.json). The canonical Streamable HTTP endpoint is `https://fynfyn.top/mcp`.

## Pick a method

Use anonymous access. Fyn does not currently advertise `register_uri`, `claim_uri`, `revocation_uri`, an OAuth authorization server, or `identity_assertion` because those flows do not exist.

## Register

Registration is not required or supported. Start an MCP connection directly.

## Claim

Credential claiming is not required or supported.

## Use the credential

There is no credential. Send normal MCP JSON-RPC requests with `Content-Type: application/json` and the MCP protocol headers required by your client. Respect `RateLimit-Limit`, `RateLimit-Remaining`, and `Retry-After` response headers.

## Errors

An invalid MCP request returns a JSON-RPC error. HTTP `429` means the anonymous rate limit was reached; wait for `Retry-After` before retrying. Fyn does not issue a `WWW-Authenticate` challenge because the public MCP resource is not bearer-token protected.

## Revocation

There is nothing to revoke. If authenticated access is introduced later, this document and machine-readable discovery metadata will be updated together.

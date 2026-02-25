import process from "node:process";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const sourceSet = [
  "pisos",
  "habitaclia",
  "tucasa",
  "fotocasa",
  "yaencontre",
  "milanuncios",
  "globaliza",
  "hogaria",
  "pisocompartido",
  "idealista"
] as const;

type Source = (typeof sourceSet)[number];

const acceptableUpstreamErrors = new Set([
  "UPSTREAM_BLOCKED",
  "UPSTREAM_RATE_LIMIT",
  "UPSTREAM_UNAVAILABLE"
]);

interface SourceSmokeSummary {
  source: Source;
  status: "ok" | "upstream_error" | "failed";
  returned_count?: number;
  total_candidates?: number;
  error_code?: string;
  error_message?: string;
  coverage_candidates?: number;
  warnings?: string[];
}

function parseJsonArg(raw: string | undefined): Record<string, unknown> {
  if (!raw || raw.trim().length === 0) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

function basePayload(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    locale: "es",
    transaction_type: "buy",
    property_types: ["flat"],
    city: "Valencia",
    min_rooms: 3,
    strict_constraints: true,
    max_results_total: 10,
    ...overrides
  };
}

const sourcePayloadOverrides: Partial<Record<Source, Record<string, unknown>>> = {
  pisocompartido: {
    transaction_type: "rent",
    property_types: ["flat"],
    city: "Valencia"
  }
};

function parseErrorEnvelope(result: unknown): { code?: string; message?: string } {
  if (typeof result !== "object" || result === null) {
    return {};
  }

  const asRecord = result as Record<string, unknown>;
  const content = Array.isArray(asRecord.content) ? asRecord.content : [];
  const textParts = content
    .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>).text : null))
    .filter((value): value is string => typeof value === "string");

  for (const text of textParts) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const code = typeof parsed.code === "string" ? parsed.code : undefined;
      const message = typeof parsed.message === "string" ? parsed.message : undefined;
      if (code || message) {
        return {
          ...(code ? { code } : {}),
          ...(message ? { message } : {})
        };
      }
    } catch {
      continue;
    }
  }

  return {};
}

function summarizeSuccessfulResult(source: Source, result: unknown): SourceSmokeSummary {
  const fallbackFailed: SourceSmokeSummary = {
    source,
    status: "failed",
    error_code: "INVALID_RESULT",
    error_message: "Missing structuredContent in successful tool response."
  };

  if (typeof result !== "object" || result === null) {
    return fallbackFailed;
  }

  const asRecord = result as Record<string, unknown>;
  const structured = asRecord.structuredContent;
  if (typeof structured !== "object" || structured === null) {
    return fallbackFailed;
  }

  const structuredRecord = structured as Record<string, unknown>;
  const diagnostics =
    typeof structuredRecord.diagnostics === "object" && structuredRecord.diagnostics !== null
      ? (structuredRecord.diagnostics as Record<string, unknown>)
      : null;

  if (!diagnostics) {
    return {
      source,
      status: "failed",
      error_code: "INVALID_DIAGNOSTICS",
      error_message: "Missing diagnostics block in structuredContent."
    };
  }

  const returnedCount = typeof diagnostics.returned_count === "number" ? diagnostics.returned_count : undefined;
  const totalCandidates =
    typeof diagnostics.total_candidates === "number" ? diagnostics.total_candidates : undefined;

  let coverageCandidates: number | undefined;
  const coverage = Array.isArray(diagnostics.coverage) ? diagnostics.coverage : [];
  for (const item of coverage) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const row = item as Record<string, unknown>;
    if (row.portal === source) {
      const value = row.candidates;
      if (typeof value === "number") {
        coverageCandidates = value;
      }
      break;
    }
  }

  const warnings = Array.isArray(diagnostics.connector_warnings)
    ? diagnostics.connector_warnings.filter((value): value is string => typeof value === "string")
    : [];

  return {
    source,
    status: "ok",
    ...(returnedCount !== undefined ? { returned_count: returnedCount } : {}),
    ...(totalCandidates !== undefined ? { total_candidates: totalCandidates } : {}),
    ...(coverageCandidates !== undefined ? { coverage_candidates: coverageCandidates } : {}),
    ...(warnings.length > 0 ? { warnings } : {})
  };
}

async function main() {
  const overrides = parseJsonArg(process.argv.slice(2).join(" ").replace(/^--\s*/, ""));

  const serverScriptPath = fileURLToPath(new URL("./index.ts", import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", serverScriptPath],
    stderr: "inherit"
  });

  const client = new Client({ name: "fyn-source-smoke-client", version: "0.1.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  if (!tools.tools.some((tool) => tool.name === "search_properties")) {
    throw new Error("search_properties tool not found");
  }

  const summary: SourceSmokeSummary[] = [];

  for (const source of sourceSet) {
    const payload = {
      ...basePayload(overrides),
      ...(sourcePayloadOverrides[source] ?? {}),
      sources: [source]
    };

    const result = await client.callTool({
      name: "search_properties",
      arguments: payload
    });

    if (result.isError) {
      const envelope = parseErrorEnvelope(result);
      const code = envelope.code;
      const message = envelope.message;

      if (code && acceptableUpstreamErrors.has(code)) {
        summary.push({
          source,
          status: "upstream_error",
          error_code: code,
          ...(message ? { error_message: message } : {})
        });
        continue;
      }

      summary.push({
        source,
        status: "failed",
        error_code: code ?? "UNKNOWN_ERROR",
        error_message: message ?? "Tool returned an unexpected error envelope."
      });
      continue;
    }

    summary.push(summarizeSuccessfulResult(source, result));
  }

  await client.close();

  const failed = summary.filter((entry) => entry.status === "failed");

  console.log(
    JSON.stringify(
      {
        checked_sources: sourceSet,
        ok_count: summary.filter((entry) => entry.status === "ok").length,
        upstream_error_count: summary.filter((entry) => entry.status === "upstream_error").length,
        failed_count: failed.length,
        summary
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

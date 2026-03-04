import { createHash } from "node:crypto";

import { ConnectorError } from "@fyn/domain";

import { connectorsFromEnv, runStructuredSearch, type SourceSelection } from "../../apps/mcp-server/src/server";

export interface ConnectorStatusSnapshotItem {
  portalUrl: string;
  state: "available" | "blocked" | "no_results";
  returnedCount: number;
}

export interface ConnectorStatusSnapshot {
  generatedAt: string;
  items: ConnectorStatusSnapshotItem[];
}

interface B2AuthorizeResponse {
  apiUrl: string;
  authorizationToken: string;
  downloadUrl: string;
}

interface B2UploadUrlResponse {
  uploadUrl: string;
  authorizationToken: string;
}

const snapshotFileName = "connector-status/latest.json";

const sourceOrder: SourceSelection[] = [
  "pisos",
  "habitaclia",
  "tucasa",
  "fotocasa",
  "yaencontre",
  "milanuncios",
  "globaliza",
  "hogaria",
  "spainhouses",
  "nuroa",
  "pisocompartido",
  "enalquiler",
  "idealista"
];

const sourcePortalUrls: Record<SourceSelection, string> = {
  pisos: "https://www.pisos.com",
  habitaclia: "https://www.habitaclia.com",
  tucasa: "https://www.tucasa.com",
  fotocasa: "https://www.fotocasa.es",
  yaencontre: "https://www.yaencontre.com",
  milanuncios: "https://www.milanuncios.com",
  globaliza: "https://www.globaliza.com",
  hogaria: "https://www.hogaria.net",
  spainhouses: "https://www.spainhouses.net",
  nuroa: "https://www.nuroa.es",
  pisocompartido: "https://www.pisocompartido.com",
  enalquiler: "https://www.enalquiler.com",
  idealista: "https://www.idealista.com"
};

const sourcePayloadOverrides: Partial<Record<SourceSelection, Record<string, unknown>>> = {
  pisocompartido: {
    transaction_type: "rent",
    property_types: ["flat"],
    city: "Valencia"
  },
  enalquiler: {
    transaction_type: "rent",
    property_types: ["flat"],
    city: "Valencia"
  }
};

const acceptableUpstreamErrors = new Set(["UPSTREAM_BLOCKED", "UPSTREAM_RATE_LIMIT", "UPSTREAM_UNAVAILABLE"]);
const STATUS_PROBE_MAX_ATTEMPTS = 2;
const STATUS_PROBE_RETRY_DELAY_MS = 1200;

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

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function authorizeB2Account(): Promise<B2AuthorizeResponse> {
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;

  if (!keyId || !applicationKey) {
    throw new Error("Missing B2_KEY_ID or B2_APPLICATION_KEY.");
  }

  const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");
  const response = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: {
      Authorization: `Basic ${credentials}`
    }
  });

  if (!response.ok) {
    throw new Error(`B2 authorize failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as B2AuthorizeResponse;
  return payload;
}

async function getB2UploadUrl(apiUrl: string, authorizationToken: string): Promise<B2UploadUrlResponse> {
  const bucketId = process.env.B2_BUCKET_ID;

  if (!bucketId) {
    throw new Error("Missing B2_BUCKET_ID.");
  }

  const response = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bucketId
    })
  });

  if (!response.ok) {
    throw new Error(`B2 get upload URL failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as B2UploadUrlResponse;
}

function fileSha1(body: string): string {
  return createHash("sha1").update(body).digest("hex");
}

export async function generateConnectorStatusSnapshot(): Promise<ConnectorStatusSnapshot> {
  const connectors = connectorsFromEnv();
  const items: ConnectorStatusSnapshotItem[] = [];

  for (const source of sourceOrder) {
    let finalItem: ConnectorStatusSnapshotItem | null = null;
    let upstreamError: ConnectorError | null = null;

    for (let attempt = 0; attempt < STATUS_PROBE_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await runStructuredSearch(
          {
            ...basePayload(sourcePayloadOverrides[source] ?? {}),
            sources: [source]
          },
          connectors
        );

        finalItem = {
          portalUrl: sourcePortalUrls[source],
          state: result.diagnostics.returned_count > 0 ? "available" : "no_results",
          returnedCount: result.diagnostics.returned_count
        };
        break;
      } catch (error) {
        if (error instanceof ConnectorError && acceptableUpstreamErrors.has(error.code)) {
          upstreamError = error;
          if (attempt < STATUS_PROBE_MAX_ATTEMPTS - 1) {
            await sleep(STATUS_PROBE_RETRY_DELAY_MS);
            continue;
          }
          break;
        }

        throw error;
      }
    }

    if (!finalItem) {
      if (!upstreamError) {
        throw new Error(`Connector status probe failed for ${source}.`);
      }

      finalItem = {
        portalUrl: sourcePortalUrls[source],
        state: "blocked",
        returnedCount: 0
      };
    }

    items.push(finalItem);
  }

  return {
    generatedAt: new Date().toISOString(),
    items
  };
}

export async function uploadConnectorStatusSnapshot(snapshot: ConnectorStatusSnapshot): Promise<string> {
  const bucketName = process.env.B2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Missing B2_BUCKET_NAME.");
  }

  const body = JSON.stringify(snapshot, null, 2);
  const { apiUrl, authorizationToken, downloadUrl } = await authorizeB2Account();
  const uploadTarget = await getB2UploadUrl(apiUrl, authorizationToken);

  const response = await fetch(uploadTarget.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: uploadTarget.authorizationToken,
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body)),
      "X-Bz-File-Name": encodeURIComponent(snapshotFileName),
      "X-Bz-Content-Sha1": fileSha1(body)
    },
    body
  });

  if (!response.ok) {
    throw new Error(`B2 upload failed with HTTP ${response.status}.`);
  }

  return `${downloadUrl}/file/${bucketName}/${snapshotFileName}`;
}

export async function fetchConnectorStatusSnapshot(): Promise<ConnectorStatusSnapshot> {
  const bucketName = process.env.B2_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("Missing B2_BUCKET_NAME.");
  }

  const { authorizationToken, downloadUrl } = await authorizeB2Account();
  const response = await fetch(`${downloadUrl}/file/${bucketName}/${snapshotFileName}`, {
    headers: {
      Authorization: authorizationToken
    }
  });

  if (!response.ok) {
    throw new Error(`B2 download failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as ConnectorStatusSnapshot;
}

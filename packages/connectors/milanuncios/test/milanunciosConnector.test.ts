import { describe, expect, it } from "vitest";

import { ConnectorError, type NormalizedFilters } from "@fyn/domain";

import { MilanunciosConnector } from "../src/index.js";

function makeResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

function criteria(city?: string): NormalizedFilters {
  return {
    locale: "es",
    transaction_type: "buy",
    property_types: ["house"],
    nearby_towns: false,
    strict_constraints: true,
    renovation_ok: false,
    tags: [],
    ...(city ? { city } : {})
  };
}

describe("MilanunciosConnector", () => {
  it("parses listing cards and applies strict city filtering", async () => {
    const html = `
      <html>
        <body>
          <article class="ma-AdCardV2">
            <div class="ma-AdCardV2-photoContainer">
              <img class="ma-AdCardV2-photo" src="https://images-re.milanuncios.com/images/ads/home1.jpg" />
            </div>
            <a class="ma-AdCardListingV2-TitleLink" href="/venta-de-casas-en-valencia-valencia/casa-luminosa-123456789.htm">
              <h2 class="ma-AdCardV2-title">Casa luminosa con terraza</h2>
            </a>
            <span class="ma-AdPrice-value">390.000 €</span>
            <span class="ma-AdLocation-text">Valencia (Valencia)</span>
            <span class="ma-AdTag-label">4 dorm.</span>
            <span class="ma-AdTag-label">2 baños</span>
            <span class="ma-AdTag-label">180 m²</span>
            <p class="ma-AdCardV2-description">Exterior con buena luz y vistas.</p>
          </article>
          <article class="ma-AdCardV2">
            <a class="ma-AdCardListingV2-TitleLink" href="/venta-de-casas-en-madrid-madrid/casa-centro-999111222.htm">
              <h2 class="ma-AdCardV2-title">Casa en el centro</h2>
            </a>
            <span class="ma-AdPrice-value">420.000 €</span>
            <span class="ma-AdLocation-text">Madrid (Madrid)</span>
          </article>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new MilanunciosConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 2
    });

    const result = await connector.search(criteria("Valencia"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("milanuncios");
    expect(result.listings[0]?.title).toContain("luminosa");
    expect(result.listings[0]?.city).toContain("Valencia");
    expect(result.listings[0]?.price_eur).toBe(390000);
    expect(result.listings[0]?.rooms).toBe(4);
    expect(result.listings[0]?.property_type).toBe("house");
    expect(result.listings[0]?.image_urls[0]).toContain("home1.jpg");
    expect(result.diagnostics.source).toBe("scrape");
  });

  it("falls back to broader results if strict city matches are unavailable", async () => {
    const html = `
      <html>
        <body>
          <article class="ma-AdCardV2">
            <a class="ma-AdCardListingV2-TitleLink" href="/venta-de-casas-en-granada-granada/casa-rural-111222333.htm">
              <h2 class="ma-AdCardV2-title">Casa rural con vistas</h2>
            </a>
            <span class="ma-AdPrice-value">210.000 €</span>
            <span class="ma-AdLocation-text">Granada (Granada)</span>
            <span class="ma-AdTag-label">3 dorm.</span>
          </article>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new MilanunciosConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    const result = await connector.search(criteria("Bilbao"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.city).toContain("Granada");
    expect(result.diagnostics.connector_warnings).toContain(
      'No strict city matches for "Bilbao" on milanuncios; returning broader listing set.'
    );
  });

  it("maps full blocked responses to UPSTREAM_BLOCKED", async () => {
    const fetchMock: typeof fetch = async () => makeResponse("<html>Forbidden</html>", 403);
    const connector = new MilanunciosConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia"))).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "milanuncios"
    } satisfies Partial<ConnectorError>);
  });
});

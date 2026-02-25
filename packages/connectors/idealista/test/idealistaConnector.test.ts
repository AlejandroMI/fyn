import { describe, expect, it } from "vitest";

import { ConnectorError, type NormalizedFilters } from "@fyn/domain";

import { IdealistaConnector } from "../src/index.js";

function makeResponse(body: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers
    }
  });
}

function criteria(city?: string): NormalizedFilters {
  return {
    locale: "es",
    transaction_type: "buy",
    property_types: ["flat"],
    nearby_towns: false,
    strict_constraints: true,
    renovation_ok: false,
    tags: [],
    ...(city ? { city } : {})
  };
}

describe("IdealistaConnector", () => {
  it("maps DataDome challenge pages to UPSTREAM_BLOCKED with cid context", async () => {
    const challengeHtml = `<html><body><script>var dd={'cid':'cid_test_idealista_123'}</script><script src="https://ct.captcha-delivery.com/c.js"></script></body></html>`;
    const fetchMock: typeof fetch = async () => makeResponse(challengeHtml, 403);

    const connector = new IdealistaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia"))).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "idealista"
    } satisfies Partial<ConnectorError>);

    await expect(connector.search(criteria("Valencia"))).rejects.toThrow(/cid_test_idealista_123/i);
  });

  it("parses ItemList JSON-LD cards when page content is reachable", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "ItemList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "item": {
                    "@type": "Residence",
                    "url": "https://www.idealista.com/inmueble/123456789/",
                    "name": "Piso luminoso en Valencia",
                    "description": "Piso exterior de 3 habitaciones con grandes ventanales",
                    "image": "https://img4.idealista.com/blur/WEB_LISTING-M/sample.jpg",
                    "offers": {
                      "@type": "Offer",
                      "price": "349000"
                    },
                    "numberOfRooms": "3",
                    "address": {
                      "addressLocality": "Valencia"
                    }
                  }
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new IdealistaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    const result = await connector.search(criteria("Valencia"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("idealista");
    expect(result.listings[0]?.price_eur).toBe(349000);
    expect(result.listings[0]?.rooms).toBe(3);
    expect(result.listings[0]?.city).toBe("Valencia");
    expect(result.listings[0]?.image_urls[0]).toContain("idealista.com");
    expect(result.diagnostics.source).toBe("scrape");
  });

  it("falls back to broader results when strict city matches are unavailable", async () => {
    const html = `
      <html>
        <body>
          <article>
            <a href="/inmueble/987654321/">Piso céntrico</a>
            <span class="price">280.000 €</span>
            <address>Madrid</address>
            <p>3 hab. y exterior</p>
          </article>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new IdealistaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    const result = await connector.search(criteria("Bilbao"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.city).toContain("Madrid");
    expect(result.diagnostics.connector_warnings).toContain(
      'No strict city matches for "Bilbao" on idealista; returning broader listing set.'
    );
  });
});

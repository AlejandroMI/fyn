import { describe, expect, it } from "vitest";

import { TucasaConnector } from "../src/index.js";

function makeResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

describe("TucasaConnector", () => {
  it("parses listings from JSON-LD ItemList pages", async () => {
    const indexHtml = `
      <html><body>
        <a href="https://www.tucasa.com/compra-venta/viviendas/valencia/valencia-capital?idz=0046.0053">Valencia</a>
      </body></html>
    `;

    const listingsHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "mainEntity": {
                "@type": "ItemList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "url": "https://www.tucasa.com/compra-venta/casas-y-chalets/valencia/valencia-capital/id_a77777777",
                    "item": {
                      "@type": "RealEstateListing",
                      "name": "Casa luminosa en Valencia",
                      "url": "https://www.tucasa.com/compra-venta/casas-y-chalets/valencia/valencia-capital/id_a77777777",
                      "description": "Vivienda exterior con vistas y mucha luz natural. 4 dorm.",
                      "image": "https://cdn.tucasa.test/img1.jpg",
                      "offers": { "@type": "Offer", "price": "420000.0000", "priceCurrency": "EUR" },
                      "mainEntity": {
                        "@type": "Residence",
                        "numberOfRooms": "4",
                        "address": { "@type": "PostalAddress", "addressLocality": "Valencia" },
                        "floorSize": { "@type": "QuantitativeValue", "value": 140 }
                      }
                    }
                  }
                ]
              }
            }
          </script>
        </head>
      </html>
    `;

    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/compra-venta/viviendas/")) {
        if (url.includes("valencia-capital")) {
          return makeResponse(listingsHtml);
        }

        return makeResponse(indexHtml);
      }

      return makeResponse("<html></html>", 404);
    };

    const connector = new TucasaConnector({
      fetchImpl: fetchMock,
      maxRequests: 1,
      requestDelayMs: 0
    });

    const result = await connector.search({
      locale: "es",
      property_types: ["house"],
      nearby_towns: false,
      strict_constraints: true,
      renovation_ok: false,
      tags: [],
      transaction_type: "buy",
      city: "Valencia"
    });

    expect(result.diagnostics.source).toBe("scrape");
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("tucasa");
    expect(result.listings[0]?.price_eur).toBe(420000);
    expect(result.listings[0]?.rooms).toBe(4);
    expect(result.listings[0]?.property_type).toBe("house");
    expect(result.listings[0]?.tags).toContain("natural_light");
  });

  it("falls back to heuristic city paths when the index request times out", async () => {
    const listingsHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "ItemList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "url": "https://fallback.tucasa.test/compra-venta/casas-y-chalets/valencia/valencia-capital/id_a99999999",
                  "item": {
                    "@type": "RealEstateListing",
                    "name": "Casa fallback en Valencia",
                    "url": "https://fallback.tucasa.test/compra-venta/casas-y-chalets/valencia/valencia-capital/id_a99999999",
                    "description": "Casa con 3 habitaciones.",
                    "offers": { "@type": "Offer", "price": "310000" },
                    "mainEntity": {
                      "@type": "Residence",
                      "numberOfRooms": "3",
                      "address": { "@type": "PostalAddress", "addressLocality": "Valencia" }
                    }
                  }
                }
              ]
            }
          </script>
        </head>
      </html>
    `;

    let listingRequests = 0;
    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/compra-venta/viviendas/")) {
        throw new Error("fetch timeout after 10000ms");
      }

      if (url.includes("/compra-venta/viviendas/valencia/")) {
        listingRequests += 1;
        return makeResponse(listingsHtml, 200);
      }

      return makeResponse("<html></html>", 404);
    };

    const connector = new TucasaConnector({
      baseUrl: "https://fallback.tucasa.test",
      fetchImpl: fetchMock,
      maxRequests: 1,
      requestDelayMs: 0
    });

    const result = await connector.search({
      locale: "es",
      property_types: ["house"],
      nearby_towns: false,
      strict_constraints: true,
      renovation_ok: false,
      tags: [],
      transaction_type: "buy",
      city: "Valencia"
    });

    expect(listingRequests).toBe(1);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.price_eur).toBe(310000);
    expect(result.diagnostics.connector_warnings).toContain(
      "tucasa index request timed out; falling back to heuristic routes."
    );
  });
});

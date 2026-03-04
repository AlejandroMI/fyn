import { describe, expect, it } from "vitest";

import { ConnectorError } from "@fyn/domain";

import { YaencontreConnector } from "../src/index.js";

function makeResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers
    }
  });
}

describe("YaencontreConnector", () => {
  it("maps DataDome challenge to UPSTREAM_BLOCKED with cid context", async () => {
    const fetchMock: typeof fetch = async () =>
      makeResponse(
        `<html><body><script src="https://ct.captcha-delivery.com/c.js"></script></body></html>`,
        403,
        {
          "x-dd-b": "2",
          "x-datadome-cid": "cid_test_123"
        }
      );

    const connector = new YaencontreConnector({
      fetchImpl: fetchMock,
      maxRequests: 1,
      requestDelayMs: 0
    });

    await expect(
      connector.search({
        locale: "es",
        property_types: ["flat"],
        nearby_towns: false,
        strict_constraints: true,
        renovation_ok: false,
        tags: [],
        transaction_type: "buy",
        city: "Valencia"
      })
    ).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "yaencontre"
    } satisfies Partial<ConnectorError>);

    await expect(
      connector.search({
        locale: "es",
        property_types: ["flat"],
        nearby_towns: false,
        strict_constraints: true,
        renovation_ok: false,
        tags: [],
        transaction_type: "buy",
        city: "Valencia"
      })
    ).rejects.toThrow(/DataDome challenge; cid=cid_test_123/i);
  });

  it("parses ItemList JSON-LD listing cards when page is reachable", async () => {
    const searchHtml = `
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
                    "url": "https://www.yaencontre.com/venta/piso/valencia/1234567",
                    "name": "Piso luminoso en Valencia",
                    "description": "Vivienda exterior con 3 habitaciones y luz natural.",
                    "image": "https://img.yaencontre.test/photo.jpg",
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

    const fetchMock: typeof fetch = async () => makeResponse(searchHtml, 200);

    const connector = new YaencontreConnector({
      fetchImpl: fetchMock,
      maxRequests: 1,
      requestDelayMs: 0
    });

    const result = await connector.search({
      locale: "es",
      property_types: ["flat"],
      nearby_towns: false,
      strict_constraints: true,
      renovation_ok: false,
      tags: [],
      transaction_type: "buy",
      city: "Valencia"
    });

    expect(result.diagnostics.source).toBe("scrape");
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("yaencontre");
    expect(result.listings[0]?.price_eur).toBe(349000);
    expect(result.listings[0]?.rooms).toBe(3);
    expect(result.listings[0]?.title).toContain("Piso luminoso");
    expect(result.listings[0]?.image_urls[0]).toContain("photo.jpg");
  });

  it("parses listings from encoded __INITIAL_STATE__ payload when available", async () => {
    const statePayload = {
      results: {
        currentPageItems: {
          byId: {
            "jht::real-estate::42835-110725621": {
              item: {
                id: "jht::real-estate::42835-110725621",
                reference: "42835-110725621",
                title: "Piso en Ciutat Fallera, Valencia",
                description: "Piso exterior con 3 habitaciones y luz natural.",
                operation: "BUY",
                family: "FLAT",
                price: 245000,
                area: 105,
                rooms: 3,
                bathrooms: 2,
                address: {
                  qualifiedName: "Ciutat Fallera, Benicalap, Valencia, Valencia/València (provincia)",
                  geoLocation: {
                    lat: 39.5009523,
                    lon: -0.3958136
                  }
                },
                images: [{ slug: "42835/42835-56345480-1473364517.jpg" }],
                url: "/venta/piso/inmueble-42835-110725621"
              }
            }
          },
          sortedItems: ["jht::real-estate::42835-110725621"]
        }
      }
    };

    const jhtPayload = {
      MEDIA_URL: "https://media.yaencontre.com/"
    };

    const searchHtml = `
      <html>
        <head></head>
        <body>
          <script>
            window.__INITIAL_STATE__ = JSON.parse(atob("${Buffer.from(
              JSON.stringify(statePayload),
              "utf8"
            ).toString("base64")}"));
            window.JHT = JSON.parse(atob("${Buffer.from(JSON.stringify(jhtPayload), "utf8").toString(
              "base64"
            )}"));
          </script>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(searchHtml, 200);

    const connector = new YaencontreConnector({
      fetchImpl: fetchMock,
      maxRequests: 1,
      maxListings: 5,
      requestDelayMs: 0
    });

    const result = await connector.search({
      locale: "es",
      property_types: ["flat"],
      nearby_towns: false,
      strict_constraints: true,
      renovation_ok: false,
      tags: [],
      transaction_type: "buy",
      city: "Valencia"
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.title).toContain("Ciutat Fallera");
    expect(result.listings[0]?.price_eur).toBe(245000);
    expect(result.listings[0]?.rooms).toBe(3);
    expect(result.listings[0]?.image_urls[0]).toContain("media.yaencontre.com");
    expect((result.listings[0]?.raw as { lat?: number })?.lat).toBeCloseTo(39.50095, 4);
    expect((result.listings[0]?.raw as { lon?: number })?.lon).toBeCloseTo(-0.39581, 4);
  });

  it("continues after blocked path when a later path is reachable", async () => {
    const reachableHtml = `
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
                    "url": "https://www.yaencontre.com/venta/piso/valencia/7654321",
                    "name": "Piso reformado en Valencia",
                    "description": "Con 3 habitaciones y mucha luz.",
                    "image": "https://img.yaencontre.test/reachable.jpg",
                    "offers": {
                      "@type": "Offer",
                      "price": "280000"
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

    let call = 0;
    const fetchMock: typeof fetch = async () => {
      call += 1;
      if (call <= 2) {
        return makeResponse(
          `<html><body><script src="https://ct.captcha-delivery.com/c.js"></script></body></html>`,
          403,
          { "x-dd-b": "2" }
        );
      }

      return makeResponse(reachableHtml, 200);
    };

    const connector = new YaencontreConnector({
      fetchImpl: fetchMock,
      maxRequests: 2,
      requestDelayMs: 0
    });

    const result = await connector.search({
      locale: "es",
      property_types: ["flat"],
      nearby_towns: false,
      strict_constraints: true,
      renovation_ok: false,
      tags: [],
      transaction_type: "buy",
      city: "Valencia"
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.title).toContain("reformado");
    expect(result.diagnostics.connector_warnings).toContain(
      "yaencontre blocked request: /venta/pisos/valencia"
    );
  });

  it("retries the same path when the first request is blocked", async () => {
    const reachableHtml = `
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
                    "url": "https://www.yaencontre.com/venta/piso/valencia/88997766",
                    "name": "Piso con terraza en Valencia",
                    "offers": { "@type": "Offer", "price": "295000" },
                    "numberOfRooms": "3",
                    "address": { "addressLocality": "Valencia" }
                  }
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    let callCount = 0;
    const fetchMock: typeof fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return makeResponse(
          `<html><body><script src="https://ct.captcha-delivery.com/c.js"></script></body></html>`,
          403,
          { "x-dd-b": "2" }
        );
      }

      return makeResponse(reachableHtml, 200);
    };

    const connector = new YaencontreConnector({
      fetchImpl: fetchMock,
      maxRequests: 1,
      requestDelayMs: 0
    });

    const result = await connector.search({
      locale: "es",
      property_types: ["flat"],
      nearby_towns: false,
      strict_constraints: true,
      renovation_ok: false,
      tags: [],
      transaction_type: "buy",
      city: "Valencia"
    });

    expect(callCount).toBe(2);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.title).toContain("terraza");
  });
});

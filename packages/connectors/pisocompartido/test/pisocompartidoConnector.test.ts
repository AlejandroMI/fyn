import { describe, expect, it } from "vitest";

import { ConnectorError, type NormalizedFilters } from "@fyn/domain";

import { PisoCompartidoConnector } from "../src/index.js";

function makeResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

function criteria(city?: string, transactionType: "buy" | "rent" = "rent"): NormalizedFilters {
  return {
    locale: "es",
    transaction_type: transactionType,
    property_types: ["flat"],
    nearby_towns: false,
    strict_constraints: true,
    renovation_ok: false,
    tags: [],
    ...(city ? { city } : {})
  };
}

describe("PisoCompartidoConnector", () => {
  it("parses listing cards and applies strict city filtering", async () => {
    const html = `
      <html>
        <body>
          <div class="cCards" id="parrilla">
            <div id="h1002240" class=" card">
              <a class="linkCard" href="https://www.pisocompartido.com/habitacion/1002240/">
                <div data-lazybg="https://fotos.imghs.net/nrd/1005/450/a.jpg" class="backImg swiper-lazy lazybg"></div>
              </a>
              <div class="contInfo">
                <h6 class="textoTipo">Habitación <span>Doble</span></h6>
                <span class="contPrecio">510 €<sub>/mes</sub></span>
                <div class="contLocalizacion"><h5>Ciutat Jardí, Algirós, València Capital, València</h5></div>
              </div>
              <script type="application/ld+json">
                {
                  "@context": "http://schema.org/",
                  "@graph": [
                    {
                      "@type": "Product",
                      "description": "Habitación luminosa con ventana grande",
                      "image": "https://fotos.imghs.net/nrd/1005/450/a.jpg",
                      "offers": { "price": 510, "priceCurrency": "EUR", "url": "https://www.pisocompartido.com/habitacion/1002240/" }
                    },
                    {
                      "@type": "Residence",
                      "address": { "@type": "PostalAddress", "addressLocality": "València Capital", "addressRegion": "València" },
                      "geo": { "@type": "GeoCoordinates", "latitude": "39.4733", "longitude": "-0.3439" }
                    }
                  ]
                }
              </script>
            </div>
            <div id="h1008888" class=" card">
              <a class="linkCard" href="https://www.pisocompartido.com/habitacion/1008888/">
                <div data-lazybg="https://fotos.imghs.net/nrd/1005/450/b.jpg" class="backImg swiper-lazy lazybg"></div>
              </a>
              <div class="contInfo">
                <h6 class="textoTipo">Habitación individual</h6>
                <span class="contPrecio">450 €<sub>/mes</sub></span>
                <div class="contLocalizacion"><h5>Centro, Madrid Capital, Madrid</h5></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new PisoCompartidoConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    const result = await connector.search(criteria("Valencia"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("pisocompartido");
    expect(result.listings[0]?.title).toContain("Habitación");
    expect(result.listings[0]?.price_eur).toBe(510);
    expect(result.listings[0]?.rooms).toBe(1);
    expect(result.listings[0]?.property_type).toBe("flat");
    expect(result.listings[0]?.image_urls[0]).toContain("fotos.imghs.net");
    expect(result.listings[0]?.raw).toMatchObject({
      latitude: 39.4733,
      longitude: -0.3439
    });
    expect(result.diagnostics.source).toBe("scrape");
  });

  it("returns UPSTREAM_UNAVAILABLE when used for buy workflows", async () => {
    const connector = new PisoCompartidoConnector({
      fetchImpl: async () => makeResponse("<html></html>", 200),
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia", "buy"))).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      source_portal: "pisocompartido"
    } satisfies Partial<ConnectorError>);
  });

  it("maps blocked responses to UPSTREAM_BLOCKED", async () => {
    const connector = new PisoCompartidoConnector({
      fetchImpl: async () => makeResponse("<html>Forbidden</html>", 403),
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia"))).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "pisocompartido"
    } satisfies Partial<ConnectorError>);
  });
});

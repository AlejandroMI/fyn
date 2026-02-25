import { describe, expect, it } from "vitest";

import { FotocasaConnector } from "../src/index.js";

function makeResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

describe("FotocasaConnector", () => {
  it("parses listing links from search and enriches detail metadata", async () => {
    const searchHtml = `
      <html>
        <body>
          <a href="/es/comprar/vivienda/valencia-capital/piso/123456789/d">Listing</a>
        </body>
      </html>
    `;

    const detailHtml = `
      <html>
        <head>
          <link rel="canonical" href="https://www.fotocasa.es/es/comprar/vivienda/valencia-capital/piso/123456789/d" />
          <meta property="og:title" content="Piso con grandes ventanales" />
          <meta property="og:description" content="Piso exterior, muy luminoso y con 3 habitaciones." />
          <meta property="og:image" content="https://img.fotocasa.test/photo.jpg" />
        </head>
        <body>
          <span class="re-DetailHeader-price">349.000 €</span>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/todas-las-zonas/l")) {
        return makeResponse(searchHtml);
      }

      if (url.includes("/123456789/d")) {
        return makeResponse(detailHtml);
      }

      return makeResponse("<html></html>", 404);
    };

    const connector = new FotocasaConnector({
      fetchImpl: fetchMock,
      maxDetailRequests: 5,
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
    expect(result.listings[0]?.portal).toBe("fotocasa");
    expect(result.listings[0]?.price_eur).toBe(349000);
    expect(result.listings[0]?.rooms).toBe(3);
    expect(result.listings[0]?.property_type).toBe("flat");
    expect(result.listings[0]?.image_urls[0]).toContain("photo.jpg");
  });

  it("keeps search-card fallback listings when detail pages are blocked", async () => {
    const searchHtml = `
      <html>
        <body>
          <article>
            <img src="https://img.fotocasa.test/card.jpg" />
            <h3>
              <a href="/es/comprar/vivienda/valencia-capital/piso/223344556/d">
                <span>Piso con terraza en Valencia</span>
              </a>
            </h3>
            <p>289.000 € · 3 habitaciones</p>
          </article>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/todas-las-zonas/l")) {
        return makeResponse(searchHtml, 200);
      }

      if (url.includes("/223344556/d")) {
        return makeResponse("<html><body>blocked</body></html>", 403);
      }

      return makeResponse("<html></html>", 404);
    };

    const connector = new FotocasaConnector({
      fetchImpl: fetchMock,
      maxDetailRequests: 5,
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
    expect(result.listings[0]?.title).toContain("terraza");
    expect(result.listings[0]?.price_eur).toBe(289000);
    expect(result.listings[0]?.rooms).toBe(3);
    expect(result.listings[0]?.image_urls[0]).toContain("card.jpg");
    expect(result.diagnostics.connector_warnings).toContain("fotocasa detail blocked: /es/comprar/vivienda/valencia-capital/piso/223344556/d");
  });
});

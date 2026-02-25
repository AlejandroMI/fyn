import { describe, expect, it } from "vitest";

import { ConnectorError, type NormalizedFilters } from "@fyn/domain";

import { SpainhousesConnector } from "../src/index.js";

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

describe("SpainhousesConnector", () => {
  it("parses property blocks and keeps strict city matches", async () => {
    const html = `
      <html>
        <body>
          <article data-href="https://www.spainhouses.net/es/casa-venta-ronda-malaga-1001.html" data-position="1001" class="property_block clearfix">
            <div class="details">
              <div class="title_1"><a href="https://www.spainhouses.net/es/casa-venta-ronda-malaga-1001.html" data-position="1001">Casa en Ronda</a><span class="titleTail"></span></div>
              <div class="title_2">Ronda</div>
              <div class="features">145 m², 4 dormitorios, 2 baños</div>
              <div class="descTxt">Casa en entorno natural con vistas despejadas.</div>
              <span class="price">390.000</span>
            </div>
            <img class="slide-content" data-src="https://static.spainhouses.net/qfotos/1001.jpg" src="//cdn.spainhouses.net/imas/pix.gif" />
          </article>
          <article data-href="https://www.spainhouses.net/es/casa-venta-madrid-madrid-1002.html" data-position="1002" class="property_block clearfix">
            <div class="details">
              <div class="title_1"><a href="https://www.spainhouses.net/es/casa-venta-madrid-madrid-1002.html" data-position="1002">Casa en Madrid</a><span class="titleTail"></span></div>
              <div class="title_2">Madrid</div>
              <div class="features">120 m², 3 dormitorios, 2 baños</div>
              <div class="descTxt">Casa urbana.</div>
              <span class="price">420.000</span>
            </div>
            <img class="slide-content" data-src="https://static.spainhouses.net/qfotos/1002.jpg" src="//cdn.spainhouses.net/imas/pix.gif" />
          </article>
        </body>
      </html>
    `;

    const connector = new SpainhousesConnector({
      fetchImpl: async () => makeResponse(html, 200),
      requestDelayMs: 0,
      maxRequests: 1,
      maxListings: 10
    });

    const result = await connector.search(criteria("Ronda"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("spainhouses");
    expect(result.listings[0]?.city).toBe("Ronda");
    expect(result.listings[0]?.rooms).toBe(4);
    expect(result.listings[0]?.price_eur).toBe(390000);
    expect(result.listings[0]?.property_type).toBe("house");
    expect(result.listings[0]?.image_urls[0]).toContain("static.spainhouses.net");
    expect(result.diagnostics.source).toBe("scrape");
  });

  it("returns broader set with warning when strict city has no match", async () => {
    const html = `
      <html>
        <body>
          <article data-href="https://www.spainhouses.net/es/casa-venta-granada-2001.html" data-position="2001" class="property_block clearfix">
            <div class="details">
              <div class="title_1"><a href="https://www.spainhouses.net/es/casa-venta-granada-2001.html" data-position="2001">Casa rural</a><span class="titleTail"></span></div>
              <div class="title_2">Granada</div>
              <div class="features">3 dormitorios, 1 baño</div>
              <div class="descTxt">Casa con vistas.</div>
              <span class="price">210.000</span>
            </div>
          </article>
        </body>
      </html>
    `;

    const connector = new SpainhousesConnector({
      fetchImpl: async () => makeResponse(html, 200),
      requestDelayMs: 0,
      maxRequests: 1,
      maxListings: 10
    });

    const result = await connector.search(criteria("Bilbao"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.city).toBe("Granada");
    expect(result.diagnostics.connector_warnings).toContain(
      'No strict city matches for "Bilbao" on spainhouses; returning broader listing set.'
    );
  });

  it("maps fully blocked responses to UPSTREAM_BLOCKED", async () => {
    const connector = new SpainhousesConnector({
      fetchImpl: async () => makeResponse("<html>Forbidden</html>", 403),
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia"))).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "spainhouses"
    } satisfies Partial<ConnectorError>);
  });
});

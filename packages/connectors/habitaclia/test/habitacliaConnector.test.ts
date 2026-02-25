import { describe, expect, it } from "vitest";

import { HabitacliaConnector } from "../src/index.js";

function makeResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

describe("HabitacliaConnector", () => {
  it("parses listing cards from list pages", async () => {
    const html = `
      <html>
        <body>
          <article
            class="js-list-item list-item-container"
            data-id="29903000001995"
            data-href="https://www.habitaclia.com/comprar-casa-gran_con_cochera-ronda-i29903000001995.htm"
            data-propertytype="HOME"
            data-propertysubtype="HOUSE"
          >
            <img itemprop="image" src="//images.habimg.com/imgh/29903-1995/sample.jpg" />
            <a itemprop="name" href="https://www.habitaclia.com/comprar-casa-gran_con_cochera-ronda-i29903000001995.htm">
              Casa en Ronda. Gran casa con cochera
            </a>
            <button
              data-codanuncio="29903000001995"
              data-pvp="245000"
              data-hab="3"
              data-sup="159"
            ></button>
          </article>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html);

    const connector = new HabitacliaConnector({
      fetchImpl: fetchMock,
      maxListings: 5,
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
      city: "Ronda"
    });

    expect(result.diagnostics.source).toBe("scrape");
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("habitaclia");
    expect(result.listings[0]?.price_eur).toBe(245000);
    expect(result.listings[0]?.rooms).toBe(3);
    expect(result.listings[0]?.property_type).toBe("house");
    expect(result.listings[0]?.city).toContain("Ronda");
    expect(result.listings[0]?.image_urls[0]).toContain("images.habimg.com");
  });

  it("returns empty with warning when city is missing", async () => {
    const connector = new HabitacliaConnector({
      fetchImpl: async () => makeResponse("<html></html>"),
      requestDelayMs: 0
    });

    const result = await connector.search({
      locale: "es",
      property_types: ["flat"],
      nearby_towns: false,
      strict_constraints: false,
      renovation_ok: false,
      tags: []
    });

    expect(result.listings).toHaveLength(0);
    expect(result.diagnostics.connector_warnings.join(" ")).toContain("No city provided");
  });
});

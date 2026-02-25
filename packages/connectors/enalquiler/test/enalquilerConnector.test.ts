import { describe, expect, it } from "vitest";

import { ConnectorError, type NormalizedFilters } from "@fyn/domain";

import { EnalquilerConnector } from "../src/index.js";

function makeResponse(body: string, status: number, contentType = "text/html; charset=utf-8"): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType
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

describe("EnalquilerConnector", () => {
  it("parses listing cards and applies strict city filtering", async () => {
    const suggestPayload = JSON.stringify({
      s: 1,
      suggestions: [
        { type: "city", name: "Valencia", province: 48, location: 50692, quantity: 1229 }
      ]
    });

    const listingHtml = `
      <html>
        <body>
          <ul class="property-list list-unstyled">
            <li id="property-7001769" class="propertyCard property-pago" itemscope itemtype="http://schema.org/Product">
              <div class="propertyCard__carousel">
                <img itemprop="image" srcset="https://images.enalquiler.com/viviendas/213/497/7001769-213497042_no.jpg" />
              </div>
              <div class="propertyCard__infoWrapper">
                <div class="propertyCard__price">
                  <span class="propertyCard__price--value">1.300€</span>
                </div>
                <ul class="propertyCard__details">
                  <li>68m<sup>2</sup></li>
                  <li>1 Hab</li>
                  <li>1 Baño</li>
                </ul>
                <div class="propertyCard__description hidden-xs">
                  <a class="propertyCard__description--title" itemprop="url" href="https://www.enalquiler.com/alquiler_piso_valencia/alquiler-piso-terraza-leixample_7001769.html">
                    <p itemprop="name">Alquiler piso terraza L'Eixample</p>
                  </a>
                  <p class="propertyCard__description--txt" itemprop="description">Piso exterior muy luminoso.</p>
                </div>
                <div class="propertyCard__location">
                  <p>L'Eixample, Russafa, Valencia</p>
                </div>
              </div>
            </li>
            <li id="property-7009999" class="propertyCard property-pago" itemscope itemtype="http://schema.org/Product">
              <div class="propertyCard__infoWrapper">
                <div class="propertyCard__price">
                  <span class="propertyCard__price--value">900€</span>
                </div>
                <ul class="propertyCard__details">
                  <li>2 Hab</li>
                </ul>
                <div class="propertyCard__description hidden-xs">
                  <a class="propertyCard__description--title" itemprop="url" href="https://www.enalquiler.com/alquiler_piso_madrid/alquiler-piso-centro_7009999.html">
                    <p itemprop="name">Alquiler piso en Madrid</p>
                  </a>
                  <p class="propertyCard__description--txt" itemprop="description">Piso céntrico.</p>
                </div>
                <div class="propertyCard__location">
                  <p>Centro, Madrid</p>
                </div>
              </div>
            </li>
          </ul>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async (input) => {
      const asUrl = typeof input === "string" ? input : input.toString();
      if (asUrl.includes("/ajax_suggest/")) {
        return makeResponse(suggestPayload, 200, "application/json; charset=utf-8");
      }
      return makeResponse(listingHtml, 200);
    };

    const connector = new EnalquilerConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 2
    });

    const result = await connector.search(criteria("Valencia"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("enalquiler");
    expect(result.listings[0]?.title).toContain("L'Eixample");
    expect(result.listings[0]?.city).toContain("Valencia");
    expect(result.listings[0]?.price_eur).toBe(1300);
    expect(result.listings[0]?.rooms).toBe(1);
    expect(result.listings[0]?.property_type).toBe("flat");
    expect(result.listings[0]?.image_urls[0]).toContain("images.enalquiler.com");
    expect(result.diagnostics.source).toBe("scrape");
  });

  it("returns UPSTREAM_UNAVAILABLE when used for buy workflows", async () => {
    const connector = new EnalquilerConnector({
      fetchImpl: async () => makeResponse("<html></html>", 200),
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia", "buy"))).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      source_portal: "enalquiler"
    } satisfies Partial<ConnectorError>);
  });

  it("maps blocked responses to UPSTREAM_BLOCKED", async () => {
    const suggestPayload = JSON.stringify({
      s: 1,
      suggestions: [
        { type: "city", name: "Valencia", province: 48, location: 50692, quantity: 1229 }
      ]
    });

    const fetchMock: typeof fetch = async (input) => {
      const asUrl = typeof input === "string" ? input : input.toString();
      if (asUrl.includes("/ajax_suggest/")) {
        return makeResponse(suggestPayload, 200, "application/json; charset=utf-8");
      }
      return makeResponse("<html>Forbidden</html>", 403);
    };

    const connector = new EnalquilerConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia"))).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "enalquiler"
    } satisfies Partial<ConnectorError>);
  });
});

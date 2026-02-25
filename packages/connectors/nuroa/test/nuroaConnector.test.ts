import { describe, expect, it } from "vitest";

import { ConnectorError, type NormalizedFilters } from "@fyn/domain";

import { NuroaConnector } from "../src/index.js";

function makeResponse(body: string, status: number, contentType = "text/html; charset=utf-8"): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType
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

describe("NuroaConnector", () => {
  it("parses listing blocks and resolves nested conversion URL", async () => {
    const html = `
      <html>
        <body>
          <section id="serp_main">
            <div class="group nu_row nu_cf nu_with_map" id="nu_flat_1234567890" itemscope itemtype="http://schema.org/Product">
              <h3 class="nu_list_title nu_mobile nu_list_title--new ">
                <a class="nu_blue_links nu_adlink nu_adlink_1234567890" rel="nofollow" href="https://www.nuroa.es/conversion/organic/piso-valencia/1/1/pisos-com-venta?siteId=1&amp;clickType=organic&amp;redirectUrl=https%3A%2F%2Fwww.nuroa.es%2Fproperty%2F1234567890%3Furl%3Dhttps%25253A%25252F%25252Fwww.pisos.com%25252Fcomprar%25252Fpiso-valencia-123%25252F">
                  <strong>Piso</strong> luminoso en <strong>València</strong>
                </a>
              </h3>
              <div class="nu_desc_container nu_desc_mobile">
                <div class="nu_sub">
                  <div class="nu_address_text">Ciutat Vella, València Capital</div>
                </div>
              </div>
              <div class="nu_desc_container nu_desc_desktop nu_desc_desktop--new">
                <div class="nu_image_container nu_image_container--new fl">
                  <img class="nu_map_overlay_image_data lazy nu_list_image" src="https://pics.nuroa.com/web/piso_venta_valencia_1234567890.jpg" />
                </div>
                <div class="nu_description">
                  <div class="nu_description__wrapper">
                    <div itemprop="description" class="description">
                      <p>Piso exterior con 3 habitaciones, 2 baños y 112 m² construidos.</p>
                    </div>
                  </div>
                </div>
                <div class="nu_listing_details">
                  <span class="nu_price" itemprop="offers" itemscope itemtype="http://schema.org/Offer">
                    <span itemprop="price" content="349000">349.000</span>
                    <span class="nu_currency" itemprop="priceCurrency" content="EUR">€</span>
                  </span>
                </div>
              </div>
            </div>
          </section>
        </body>
      </html>
    `;

    const connector = new NuroaConnector({
      fetchImpl: async () => makeResponse(html, 200),
      requestDelayMs: 0,
      maxRequests: 1,
      maxListings: 5
    });

    const result = await connector.search(criteria("Valencia"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("nuroa");
    expect(result.listings[0]?.url).toBe("https://www.pisos.com/comprar/piso-valencia-123/");
    expect(result.listings[0]?.city).toContain("València");
    expect(result.listings[0]?.price_eur).toBe(349000);
    expect(result.listings[0]?.rooms).toBe(3);
    expect(result.listings[0]?.property_type).toBe("flat");
    expect(result.listings[0]?.image_urls[0]).toContain("pics.nuroa.com");
    expect(result.diagnostics.source).toBe("scrape");
  });

  it("keeps strict city matches when broader rows are present", async () => {
    const html = `
      <html>
        <body>
          <section id="serp_main">
            <div class="group nu_row nu_cf nu_with_map" id="nu_flat_1000">
              <h3 class="nu_list_title"><a class="nu_adlink" href="https://www.nuroa.es/property/1000">Piso en Madrid</a></h3>
              <div class="nu_address_text">Centro, Madrid</div>
              <div itemprop="description" class="description"><p>2 habitaciones.</p></div>
              <span itemprop="price" content="250000">250000</span>
            </div>
            <div class="group nu_row nu_cf nu_with_map" id="nu_flat_2000">
              <h3 class="nu_list_title"><a class="nu_adlink" href="https://www.nuroa.es/property/2000">Piso en Valencia</a></h3>
              <div class="nu_address_text">Ruzafa, Valencia</div>
              <div itemprop="description" class="description"><p>3 habitaciones.</p></div>
              <span itemprop="price" content="350000">350000</span>
            </div>
          </section>
        </body>
      </html>
    `;

    const connector = new NuroaConnector({
      fetchImpl: async () => makeResponse(html, 200),
      requestDelayMs: 0,
      maxRequests: 1,
      maxListings: 5
    });

    const result = await connector.search(criteria("Valencia"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal_listing_id).toBe("2000");
    expect(result.listings[0]?.city).toContain("Valencia");
  });

  it("maps blocked responses to UPSTREAM_BLOCKED", async () => {
    const connector = new NuroaConnector({
      fetchImpl: async () => makeResponse("<html>Forbidden</html>", 403),
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia"))).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "nuroa"
    } satisfies Partial<ConnectorError>);
  });
});

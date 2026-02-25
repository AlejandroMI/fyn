import { describe, expect, it } from "vitest";

import { ConnectorError, type NormalizedFilters } from "@fyn/domain";

import { HogariaConnector } from "../src/index.js";

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

describe("HogariaConnector", () => {
  it("parses listing cards and applies strict city filtering", async () => {
    const html = `
      <html>
        <body>
          <div id="listado" class="row list-group">
            <div class="item col-xs-4 col-lg-4 grid-group-item" itemprop="offers" itemscope itemtype="http://schema.org/offer">
              <div class="thumbnail gvthumbnail">
                <div class="col-xs-3">
                  <img class="ltimagen ltimagenresp expand3922907" itemprop="image" data-src="/imagenes/3922907/casa-ronda.jpg" src="https://www.hogaria.net/img/no_image1.jpg" />
                </div>
                <div class="precio absprec">
                  <p itemprop='price' content='390000' class='lead nomargin precmob'>390.000€</p>
                </div>
                <div class="caption captionwborder">
                  <h2 itemprop="name" class="h2headinglist"><a id='lnk3922907' itemprop='url' href='/pisos-casas/venta-casa-unifamiliar-ronda-centro-140m2-4-habitaciones-2-banos-390000-euros_3922907.aspx'>Casa con jardín en entorno rural</a></h2>
                  <div class="row">
                    <div class="col-xs-12 col-md-6 gvcol12w320">140 m² <span>4 dorm.</span><span>2 baños</span>
                      <div itemprop="description" class="desclistado">Casa luminosa con vistas y jardín.</div>
                      <h3 class="h2ubicacion"><span class="glyphicon glyphicon-map-marker"></span>Ronda - Centro</h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <input type="hidden" name="listado$ctl00$codigo" id="listado_ctl00_codigo" value="3922907" />
            <div class="item col-xs-4 col-lg-4 grid-group-item" itemprop="offers" itemscope itemtype="http://schema.org/offer">
              <div class="thumbnail gvthumbnail">
                <div class="precio absprec">
                  <p itemprop='price' content='520000' class='lead nomargin precmob'>520.000€</p>
                </div>
                <div class="caption captionwborder">
                  <h2 itemprop="name" class="h2headinglist"><a id='lnk3922910' itemprop='url' href='/pisos-casas/venta-casa-unifamiliar-madrid-centro-160m2-5-habitaciones-3-banos-520000-euros_3922910.aspx'>Casa en Madrid centro</a></h2>
                  <h3 class="h2ubicacion"><span class="glyphicon glyphicon-map-marker"></span>Madrid - Centro</h3>
                </div>
              </div>
            </div>
            <input type="hidden" name="listado$ctl01$codigo" id="listado_ctl01_codigo" value="3922910" />
          </div>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new HogariaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 2
    });

    const result = await connector.search(criteria("Ronda"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("hogaria");
    expect(result.listings[0]?.title).toContain("jardín");
    expect(result.listings[0]?.city).toContain("Ronda");
    expect(result.listings[0]?.price_eur).toBe(390000);
    expect(result.listings[0]?.rooms).toBe(4);
    expect(result.listings[0]?.property_type).toBe("house");
    expect(result.listings[0]?.image_urls[0]).toContain("/imagenes/3922907");
    expect(result.diagnostics.source).toBe("scrape");
  });

  it("falls back to broader listings when strict city matches are unavailable", async () => {
    const html = `
      <html>
        <body>
          <div id="listado" class="row list-group">
            <div class="item col-xs-4 col-lg-4 grid-group-item" itemprop="offers" itemscope itemtype="http://schema.org/offer">
              <div class="thumbnail gvthumbnail">
                <div class="precio absprec"><p itemprop='price' content='210000'>210.000€</p></div>
                <div class="caption captionwborder">
                  <h2 itemprop="name"><a id='lnk3900001' itemprop='url' href='/pisos-casas/venta-casa-unifamiliar-granada-centro-90m2-3-habitaciones-1-banos-210000-euros_3900001.aspx'>Casa rural con vistas</a></h2>
                  <div class="row"><div class="col-xs-12 col-md-6 gvcol12w320">90 m² 3 dorm.</div></div>
                  <h3 class="h2ubicacion"><span class="glyphicon glyphicon-map-marker"></span>Granada - Centro</h3>
                </div>
              </div>
            </div>
            <input type="hidden" name="listado$ctl00$codigo" id="listado_ctl00_codigo" value="3900001" />
          </div>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new HogariaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    const result = await connector.search(criteria("Bilbao"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.city).toContain("Granada");
    expect(result.diagnostics.connector_warnings).toContain(
      'No strict city matches for "Bilbao" on hogaria; returning broader listing set.'
    );
  });

  it("maps full blocked responses to UPSTREAM_BLOCKED", async () => {
    const fetchMock: typeof fetch = async () => makeResponse("<html>Forbidden</html>", 403);
    const connector = new HogariaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia"))).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "hogaria"
    } satisfies Partial<ConnectorError>);
  });
});

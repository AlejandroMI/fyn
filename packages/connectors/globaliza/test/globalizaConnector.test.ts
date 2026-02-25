import { describe, expect, it } from "vitest";

import { ConnectorError, type NormalizedFilters } from "@fyn/domain";

import { GlobalizaConnector } from "../src/index.js";

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
    property_types: ["flat"],
    nearby_towns: false,
    strict_constraints: true,
    renovation_ok: false,
    tags: [],
    ...(city ? { city } : {})
  };
}

describe("GlobalizaConnector", () => {
  it("parses listing cards and applies strict city filtering", async () => {
    const html = `
      <html>
        <body>
          <ul class="listAds">
            <li class="serp-snippet ad featured" itemscope itemtype="https://schema.org/Residence">
              <div class="ad-ph">
                <div class="slider-ad">
                  <img src="https://img.resemmedia.com/photo-valencia.jpg" alt="Piso" />
                </div>
              </div>
              <div class="ad-data">
                <div class="data">
                  <div class="price">349.000 €</div>
                  <h2 itemprop="name" class="title">
                    <a itemprop="url" class="detail-redirection" href="/inmueble/cc3b-95ca-19bed98-15c9b4b07397-7ae3">Piso en Algirós, Valencia, Valencia/València</a>
                  </h2>
                  <p itemprop="description" class="description">Exterior muy luminoso.</p>
                  <div class="adCharacteristics">
                    <span class="numbers">
                      <span class="areaBuilt">96m2</span>
                      <span class="rooms">4<i class="icon-r-bed"></i></span>
                      <span class="bathrooms">1<i class="icon-r-bathroom"></i></span>
                    </span>
                  </div>
                </div>
              </div>
              <span itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
                <meta itemprop="addressLocality" content="Algirós, Valencia/València" />
              </span>
            </li>
            <li class="serp-snippet ad featured" itemscope itemtype="https://schema.org/Residence">
              <div class="ad-data">
                <div class="data">
                  <div class="price">420.000 €</div>
                  <h2 itemprop="name" class="title">
                    <a itemprop="url" class="detail-redirection" href="/inmueble/other-123">Piso en Chamberí, Madrid, Madrid</a>
                  </h2>
                </div>
              </div>
              <span itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
                <meta itemprop="addressLocality" content="Chamberí, Madrid" />
              </span>
            </li>
          </ul>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new GlobalizaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    const result = await connector.search(criteria("Valencia"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.portal).toBe("globaliza");
    expect(result.listings[0]?.title).toContain("Algirós");
    expect(result.listings[0]?.city).toContain("Valencia");
    expect(result.listings[0]?.price_eur).toBe(349000);
    expect(result.listings[0]?.rooms).toBe(4);
    expect(result.listings[0]?.image_urls[0]).toContain("img.resemmedia.com");
    expect(result.diagnostics.source).toBe("scrape");
  });

  it("falls back to broader listings if strict city matches are unavailable", async () => {
    const html = `
      <html>
        <body>
          <ul class="listAds">
            <li class="serp-snippet ad featured" itemscope itemtype="https://schema.org/Residence">
              <div class="ad-data">
                <div class="data">
                  <div class="price">210.000 €</div>
                  <h2 itemprop="name" class="title">
                    <a itemprop="url" class="detail-redirection" href="/inmueble/sample-321">Piso en Centro, Granada, Granada</a>
                  </h2>
                  <p itemprop="description" class="description">3 hab. y exterior</p>
                </div>
              </div>
              <span itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">
                <meta itemprop="addressLocality" content="Centro, Granada" />
              </span>
            </li>
          </ul>
        </body>
      </html>
    `;

    const fetchMock: typeof fetch = async () => makeResponse(html, 200);
    const connector = new GlobalizaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    const result = await connector.search(criteria("Bilbao"));

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.city).toContain("Granada");
    expect(result.diagnostics.connector_warnings).toContain(
      'No strict city matches for "Bilbao" on globaliza; returning broader listing set.'
    );
  });

  it("maps full blocked responses to UPSTREAM_BLOCKED", async () => {
    const fetchMock: typeof fetch = async () => makeResponse("<html>Forbidden</html>", 403);
    const connector = new GlobalizaConnector({
      fetchImpl: fetchMock,
      requestDelayMs: 0,
      maxRequests: 1
    });

    await expect(connector.search(criteria("Valencia"))).rejects.toMatchObject({
      code: "UPSTREAM_BLOCKED",
      source_portal: "globaliza"
    } satisfies Partial<ConnectorError>);
  });
});

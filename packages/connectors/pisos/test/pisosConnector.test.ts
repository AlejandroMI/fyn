import { describe, expect, it, vi } from "vitest";

import type { NormalizedFilters } from "@fyn/domain";
import { PisosConnector } from "../src/index.js";

const criteria: NormalizedFilters = {
  locale: "en",
  transaction_type: "buy",
  property_types: ["flat"],
  city: "Valencia",
  nearby_towns: false,
  min_rooms: 3,
  max_price_eur: 350000,
  renovation_ok: false,
  tags: [],
  original_query: "flat valencia"
};

describe("PisosConnector", () => {
  it("throws missing key when fallback is disabled", async () => {
    const connector = new PisosConnector({
      allowFixtureFallback: false,
      enableScrapeFallback: false
    });
    await expect(connector.search(criteria)).rejects.toMatchObject({
      code: "MISSING_API_KEY"
    });
  });

  it("uses fixtures when key is missing and fallback is enabled", async () => {
    const connector = new PisosConnector({
      allowFixtureFallback: true,
      enableScrapeFallback: false
    });
    const result = await connector.search(criteria);

    expect(result.diagnostics.source).toBe("fixture");
    expect(result.listings.length).toBeGreaterThan(0);
  });

  it("uses scraper fallback when key is missing", async () => {
    const html = `
      <div id="60932948350.991284" class="ad-preview" data-lnk-href="/comprar/piso-sueca_centro_urbano-60932948350_991284/">
        <span class="ad-preview__price">133.000 €</span>
        <a href="/comprar/piso-sueca_centro_urbano-60932948350_991284/" class="ad-preview__title">Piso en Carrer de l&#x27;Esculptor Beltr&#xE1;n, 58</a>
        <p class="p-sm ad-preview__subtitle">Sueca</p>
        <p class="ad-preview__char p-sm">4 habs.</p>
        <p class="ad-preview__description">Vivienda muy luminosa, toda exterior, con grandes ventanales y orientación sur.</p>
        <img src="https://fotos.imghs.net/mm-wp/991284/60932948350.991284/sample.jpg" />
        <script type="application/ld+json">{ "@context":"https://schema.org/" }</script>
      </div>
    `;

    const fetchImpl = vi.fn(async () => new Response(html, { status: 200 }));
    const connector = new PisosConnector({
      allowFixtureFallback: false,
      enableScrapeFallback: true,
      fetchImpl
    });

    const result = await connector.search(criteria);
    expect(result.diagnostics.source).toBe("scrape");
    expect(result.listings[0]?.portal_listing_id).toBe("60932948350.991284");
    expect(result.listings[0]?.price_eur).toBe(133000);
    expect(result.listings[0]?.rooms).toBe(4);
    expect(result.listings[0]?.tags).toContain("natural_light");
    expect(result.listings[0]?.tags).toContain("exterior");
    expect(result.listings[0]?.tags).toContain("good_orientation");
  });

  it("maps auth rejection from upstream", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: "Invalid apikey. Authorization failed." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    const connector = new PisosConnector({
      apiKey: "bad-key",
      allowFixtureFallback: false,
      enableScrapeFallback: false,
      fetchImpl
    });

    await expect(connector.search(criteria)).rejects.toMatchObject({
      code: "AUTH_REJECTED"
    });
  });

  it("maps upstream rate limiting", async () => {
    const fetchImpl = vi.fn(async () => new Response("Too many requests", { status: 429 }));

    const connector = new PisosConnector({
      apiKey: "test-key",
      allowFixtureFallback: false,
      enableScrapeFallback: false,
      fetchImpl
    });

    await expect(connector.search(criteria)).rejects.toMatchObject({
      code: "UPSTREAM_RATE_LIMIT"
    });
  });

  it("normalizes live listing payload", async () => {
    const payload = {
      listings: [
        {
          idInmueble: "123",
          titulo: "Piso céntrico",
          ciudad: "Valencia",
          precio: 300000,
          habitaciones: 3,
          tipoInmueble: "piso",
          urlDetalle: "https://www.pisos.com/inmueble/123/",
          descripcion: "Con vistas y opción de reforma",
          fotos: [{ url: "https://img/pisos-123.jpg" }]
        }
      ]
    };

    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const connector = new PisosConnector({
      apiKey: "test-key",
      allowFixtureFallback: false,
      enableScrapeFallback: false,
      fetchImpl
    });

    const result = await connector.search(criteria);
    expect(result.diagnostics.source).toBe("live");
    expect(result.listings[0]?.portal_listing_id).toBe("123");
    expect(result.listings[0]?.property_type).toBe("flat");
  });
});

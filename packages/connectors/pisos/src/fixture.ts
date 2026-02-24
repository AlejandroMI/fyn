import type { ListingCard } from "@fyn/domain";

export const FIXTURE_LISTINGS: ListingCard[] = [
  {
    canonical_id: "pisos-fixture-1",
    portal: "pisos",
    portal_listing_id: "fixture-1",
    url: "https://www.pisos.com/comprar/piso-valencia_capital_centre-4580701234_100500/",
    title: "Luminoso piso en Valencia centro",
    city: "Valencia",
    price_eur: 320000,
    rooms: 3,
    property_type: "flat",
    image_urls: [
      "https://st3.idealista.com/blur/WEB_LISTING-M/0/id.pro.es.image.master/sample1.jpg"
    ],
    last_seen_at: new Date().toISOString(),
    score: 0,
    why_matched: [],
    description: "Piso con potencial de reforma parcial y excelente ubicación.",
    tags: ["renovation"],
    capacity_people: null
  },
  {
    canonical_id: "pisos-fixture-2",
    portal: "pisos",
    portal_listing_id: "fixture-2",
    url: "https://www.pisos.com/comprar/chalet-naquera-4580709999_100500/",
    title: "Casa en entorno natural con vistas",
    city: "Náquera",
    price_eur: 285000,
    rooms: 4,
    property_type: "house",
    image_urls: [
      "https://st3.idealista.com/blur/WEB_LISTING-M/0/id.pro.es.image.master/sample2.jpg"
    ],
    last_seen_at: new Date().toISOString(),
    score: 0,
    why_matched: [],
    description: "Casa con vistas panorámicas en zona natural.",
    tags: ["nature", "views", "retreat"],
    capacity_people: null
  },
  {
    canonical_id: "pisos-fixture-3",
    portal: "pisos",
    portal_listing_id: "fixture-3",
    url: "https://www.pisos.com/comprar/oficina-valencia_capital-4580717777_100500/",
    title: "Oficina diáfana para equipos grandes",
    city: "Valencia",
    price_eur: 410000,
    rooms: 1,
    property_type: "office",
    image_urls: [],
    last_seen_at: new Date().toISOString(),
    score: 0,
    why_matched: [],
    description: "Espacio apto para más de 50 puestos de trabajo.",
    tags: ["office"],
    capacity_people: 60
  }
];

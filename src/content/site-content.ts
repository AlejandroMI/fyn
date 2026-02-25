export type Locale = "es" | "en";

export interface UseCaseContent {
  tag: string;
  title: string;
  summary: string;
  bullets: string[];
  image: string;
  alt: string;
}

export interface PreviewCardContent {
  title: string;
  meta: string;
  price: string;
  image: string;
  alt: string;
}

export interface SiteContent {
  localeLabel: string;
  nav: {
    problem: string;
    useCases: string;
    how: string;
    preview: string;
    developers: string;
    product: string;
    backToProduct: string;
    mcpLive: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    checks: string[];
    promptLabel: string;
    promptText: string;
    imageAlt: string;
    promptOptions: Array<{
      image: string;
      imageAlt: string;
      promptText: string;
    }>;
  };
  problem: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    paragraphs: string[];
  };
  useCases: {
    eyebrow: string;
    title: string;
    intro: string;
    items: UseCaseContent[];
  };
  how: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    intro: string;
    steps: Array<{ title: string; body: string }>;
  };
  preview: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    intro: string;
    metaLeft: string;
    metaRight: string;
    sourceTag: string;
    cards: PreviewCardContent[];
  };
  trust: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    body: string;
  };
  finalCta: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    body: string;
    primary: string;
    secondary: string;
  };
  footer: {
    description: string;
    productTitle: string;
    developersTitle: string;
    runbook: string;
    docs: string;
    tryChatgpt: string;
    copyright: string;
    creditsLabel: string;
    creditLinks: Array<{ label: string; href: string }>;
  };
  developers: {
    title: string;
    titleAccent: string;
    intro: string;
    endpointTitle: string;
    endpointBody: string;
    copyUrl: string;
    copied: string;
    runbookTitle: string;
    runbookBody: string;
    healthTitle: string;
    healthBody: string;
    schemaTitle: string;
    schemaBody: string;
    footer: string;
  };
}

export const problemCarouselImages = [
  "/web/apartment-facades-golden-hour.jpg",
  "/web/historic-narrow-street-homes.jpg",
  "/web/colorful-townhouses-street.jpg",
  "/web/city-residential-facade.jpg",
  "/web/spanish-apartment-block.jpg",
  "/web/highrise-sunset-windows.jpg",
  "/web/tall-residential-building-evening.jpg",
  "/web/mountain-house-landscape.jpg",
  "/web/nature-home-mountain-view.jpg",
  "/web/leafy-house-quiet-street.jpg"
] as const;

const creditLinks = [
  { label: "patio", href: "https://unsplash.com/photos/-JXMvTTmdmY" },
  { label: "street", href: "https://unsplash.com/photos/BjerBstbKHE" },
  { label: "apartment", href: "https://unsplash.com/photos/8OLlVy24DVU" },
  { label: "house", href: "https://unsplash.com/photos/oRdQBo3Tews" }
];

export const siteContent: Record<Locale, SiteContent> = {
  es: {
    localeLabel: "Español",
    nav: {
      problem: "Problema",
      useCases: "Para quién",
      how: "Cómo funciona",
      preview: "Vista previa",
      developers: "Desarrolladores",
      product: "Producto",
      backToProduct: "Volver a producto",
      mcpLive: "MCP activo"
    },
    hero: {
      eyebrow: "Fyn — Find Your Nest",
      title: "Describe tu próxima casa",
       titleAccent: "en palabras sencillas.",
      body: "Buscar vivienda en España no debería ser un segundo trabajo. Fyn es una capa de búsqueda inmobiliaria que se conecta directamente con tu IA favorita. Tú describes lo que te importa y Fyn devuelve coincidencias explicables del mercado con enlaces directos y fotos reales, en minutos.",
      primaryCta: "Abrir en ChatGPT",
       secondaryCta: "Documentación MCP",
      checks: [
        "Sin laberintos de filtros antes de empezar.",
        "Cada resultado mantiene transparencia de fuente y enlace profundo.",
        "Busca al instante entre los principales portales inmobiliarios de España."
      ],
      promptLabel: "Ejemplo de prompt",
      promptText:
        "“Busco casa en un pueblo bonito con vistas, cerca de naturaleza, para comprar. Máx 350k.”",
      imageAlt: "Patio luminoso para representar búsqueda por estilo de vida",
      promptOptions: [
        {
          image: "/web/patio-table-and-chairs.jpg",
          imageAlt: "Patio luminoso para representar búsqueda por estilo de vida",
          promptText:
            "“Busco casa en un pueblo bonito con vistas, cerca de naturaleza, para comprar. Máx 350k.”"
        },
        {
          image: "/web/mountain-house-landscape.jpg",
          imageAlt: "Casa junto a montañas para búsqueda de entorno natural",
          promptText:
            "“Quiero una segunda vivienda en montaña, con jardín y silencio, a menos de 90 minutos de una ciudad.”"
        },
        {
          image: "/web/colorful-townhouses-street.jpg",
          imageAlt: "Calle con fachadas coloridas en zona urbana",
          promptText:
            "“Enséñame pisos en barrios con vida de barrio, calles bonitas y buenas conexiones para teletrabajo.”"
        },
        {
          image: "/web/highrise-sunset-windows.jpg",
          imageAlt: "Edificio urbano al atardecer para estilo de vida de ciudad",
          promptText:
            "“Busco piso moderno con mucha luz, terraza y vistas abiertas dentro de presupuesto de 400k.”"
        }
      ]
    },
    problem: {
      eyebrow: "El problema",
      title: "Buscar vivienda hoy es un caos.",
      titleAccent: "No tiene por qué serlo.",
      paragraphs: [
        "Te suena: instalas cinco apps, repites los mismos filtros en todas, refrescas sin parar y acabas cediendo. Los desplegables no capturan matices como \"acepto reforma\" o \"quiero buenas vistas\".",
        "Fyn lo resuelve unificando el mercado en una sola capa de búsqueda y permitiéndote buscar como realmente piensas."
      ]
    },
    useCases: {
      eyebrow: "Para quién",
      title: "Diseñado para decisiones reales de vivienda.",
      intro:
        "Tanto si te mudas rápido en ciudad, como si buscas un cambio de estilo de vida o construyes un asistente, Fyn te deja buscar de forma natural.",
      items: [
        {
          tag: "Cambios de ciudad",
          title: "Compra o alquiler comparando barrios en minutos.",
          summary:
            "Necesitan claridad rápida, no decenas de pestañas y lógicas de filtro distintas por portal.",
          bullets: [
            "Búsqueda natural en español o inglés.",
            "Presupuesto y habitaciones como límites reales.",
            "Salto directo al anuncio original."
          ],
          image: "/web/person-city-portrait.jpg",
          alt: "Persona en casa evaluando opciones de vivienda"
        },
        {
          tag: "Búsqueda de estilo de vida",
          title: "Segunda vivienda en pueblos y zonas naturales.",
          summary:
            "Primero importa la atmósfera. Luego se afina ubicación según oferta real.",
          bullets: [
            "Explora varias regiones en una sola petición.",
            "Pide luz, vistas o tranquilidad en lenguaje natural.",
            "Entiende por qué encaja cada propiedad."
          ],
          image: "/web/person-working-from-home.jpg",
          alt: "Persona planificando mudanza desde casa"
        },
        {
          tag: "Equipos y agentes",
          title: "Apps y copilotos que necesitan búsqueda inmobiliaria.",
          summary:
            "Necesitan interfaces estables, no parseo manual distinto para cada portal.",
          bullets: [
            "Contrato MCP preparado para planificación LLM.",
            "Tarjetas normalizadas entre portales.",
            "Diagnósticos claros de cobertura y fallback."
          ],
          image: "/web/tall-residential-building-evening.jpg",
          alt: "Edificio urbano representando integración de asistentes"
        }
      ]
    },
    how: {
      eyebrow: "Cómo funciona",
      title: "Flujo simple.",
      titleAccent: "Hablas con tu IA y Fyn ejecuta.",
      intro:
        "No necesitas aprender otra interfaz. Conecta Fyn a tu IA y empieza a conversar.",
      steps: [
        {
          title: "El modelo planifica la búsqueda",
          body: "Escribes lo que quieres y la IA elige ubicaciones, nivel de restricción y amplitud de búsqueda según tu intención."
        },
        {
          title: "Fyn ejecuta los conectores",
          body: "Fyn consulta portales, normaliza datos inmobiliarios y adjunta diagnósticos para mantener transparencia."
        },
        {
          title: "Decides más rápido",
          body: "Comparas tarjetas limpias en el chat, ves por qué aparece cada resultado y abres el anuncio fuente al instante."
        }
      ]
    },
    preview: {
      eyebrow: "Resultados visuales",
      title: "Fotos reales,",
      titleAccent: "tarjetas claras, decisiones rápidas.",
      intro:
        "Ve propiedades auténticas, compara fácilmente y entiende por qué cada resultado aparece. Cada tarjeta incluye enlace directo y explicación de coincidencia.",
      metaLeft: "Demo · 4 viviendas",
       metaRight: "Coincidencias explicadas · Enlaces directos",
      sourceTag: "Enlace disponible en búsqueda real",
      cards: [
        {
          title: "Finca clásica en barrio céntrico",
          meta: "Barcelona · 3 hab. · Match: carácter urbano",
          price: "390.000 €",
          image: "/web/city-residential-facade.jpg",
          alt: "Finca urbana"
        },
        {
          title: "Piso exterior en zona urbana",
          meta: "Valencia · 3 hab. · Match: exterior + luz",
          price: "349.000 €",
          image: "/web/spanish-apartment-block.jpg",
          alt: "Bloque de pisos en ciudad"
        },
        {
          title: "Apartamento en calle histórica",
          meta: "Palma · 2 hab. · Match: centro histórico",
          price: "210.000 €",
          image: "/web/historic-alley-apartment.jpg",
          alt: "Calle histórica con vivienda"
        },
        {
          title: "Piso en torre con vistas abiertas",
          meta: "Madrid · 2 hab. · Match: vistas skyline",
          price: "320.000 €",
          image: "/web/highrise-sunset-windows.jpg",
          alt: "Torre residencial con vistas"
        }
      ]
    },
    trust: {
      eyebrow: "Confianza y transparencia",
      title: "Práctico, transparente",
      titleAccent: "y honesto.",
      body: "Fyn no oculta información para encerrarte en su producto. Muestra siempre la fuente original, explica cada coincidencia y respeta tus límites exactos."
    },
    finalCta: {
      eyebrow: "Cierre",
      title: "Fyn ya está en marcha.",
      titleAccent: "¿Listo para encontrar tu nido?",
      body: "Ya tenemos conector funcional en ChatGPT. Deja atrás filtros infinitos y empieza a encontrar exactamente lo que buscas.",
      primary: "Probar conector en ChatGPT",
      secondary: "Quickstart para desarrolladores"
    },
    footer: {
      description: "Encuentra tu nido ideal con conversación natural y búsqueda autónoma.",
      productTitle: "Producto",
      developersTitle: "Desarrolladores",
      runbook: "Runbook",
      docs: "Documentación MCP",
      tryChatgpt: "Probar en ChatGPT",
      copyright: "Fyn · Find Your Nest",
      creditsLabel: "Fotos de Unsplash:",
      creditLinks
    },
    developers: {
      title: "Para desarrolladores",
      titleAccent: "y agentes autónomos",
      intro:
        "Conecta tus LLMs y apps de chat a búsqueda inmobiliaria en España mediante el servidor MCP unificado de Fyn.",
      endpointTitle: "Configuración del endpoint MCP",
      endpointBody:
        "Configura Claude Desktop, ChatGPT en developer mode o tu agente personalizado para consumir herramientas de Fyn.",
      copyUrl: "Copiar URL",
      copied: "Copiado",
      runbookTitle: "Runbook para desarrolladores",
      runbookBody: "Cómo ejecutar en local, validar calidad de herramientas y desplegar a producción.",
      healthTitle: "Comprobador de estado",
      healthBody: "Verifica salud del endpoint y estado de ejecución del conector.",
      schemaTitle: "Endpoint del schema",
      schemaBody: "Abre el endpoint MCP usado por developer mode y clientes compatibles.",
      footer: "Fyn Developers"
    }
  },
  en: {
    localeLabel: "English",
    nav: {
      problem: "Problem",
      useCases: "Who it's for",
      how: "How it works",
      preview: "Preview",
      developers: "Developers",
      product: "Product",
      backToProduct: "Back to product",
      mcpLive: "MCP Live"
    },
    hero: {
      eyebrow: "Fyn — Find Your Nest",
      title: "Describe your next home",
      titleAccent: "in plain language.",
      body: "Finding a property in Spain should not be a second job. Fyn is a property-search layer that connects directly to your favorite AI. You describe what matters and Fyn returns explainable matches across the market with direct links and real photos in minutes.",
      primaryCta: "Open in ChatGPT",
       secondaryCta: "MCP Docs",
      checks: [
        "No giant filter maze before you can start.",
        "Every result keeps source transparency and deep links.",
        "Search across Spain's top real estate portals instantly."
      ],
      promptLabel: "Example prompt",
      promptText:
        "“I want a home in a beautiful town with views, close to nature, to buy. Max 350k.”",
      imageAlt: "Sunlit patio representing lifestyle-led property search",
      promptOptions: [
        {
          image: "/web/patio-table-and-chairs.jpg",
          imageAlt: "Sunlit patio representing lifestyle-led property search",
          promptText:
            "“I want a home in a beautiful town with views, close to nature, to buy. Max 350k.”"
        },
        {
          image: "/web/mountain-house-landscape.jpg",
          imageAlt: "Mountain home for nature-focused property searches",
          promptText:
            "“Find me a second home in the mountains with a garden and quiet surroundings, under 90 minutes from a city.”"
        },
        {
          image: "/web/colorful-townhouses-street.jpg",
          imageAlt: "Colorful townhouses in a lively neighborhood",
          promptText:
            "“Show me homes in walkable neighborhoods with local character and easy day-to-day amenities.”"
        },
        {
          image: "/web/highrise-sunset-windows.jpg",
          imageAlt: "Modern residential tower at sunset",
          promptText:
            "“I need a bright apartment with open views and a terrace, with a realistic budget around 400k.”"
        }
      ]
    },
    problem: {
      eyebrow: "The problem",
      title: "Finding a place is a nightmare.",
      titleAccent: "It doesn't have to be.",
      paragraphs: [
        "You know the routine: install five apps, repeat filters, refresh constantly, compromise. Dropdowns cannot capture nuances like \"renovation is okay\" or \"great views matter\".",
        "Fyn fixes this by unifying the market into one searchable layer and letting you search the way you actually think."
      ]
    },
    useCases: {
      eyebrow: "Who this is for",
      title: "Built for real-life home decisions.",
      intro:
        "Whether you are moving quickly in a city, looking for a lifestyle change, or building an assistant, Fyn helps you search naturally.",
      items: [
        {
          tag: "City movers",
          title: "Buyers and renters comparing neighborhoods fast.",
          summary:
            "They need clarity in minutes, not dozens of tabs and portal-specific filter logic.",
          bullets: [
            "Search naturally in Spanish or English.",
            "Budget and room limits are respected.",
            "Jump directly to the original listing."
          ],
          image: "/web/person-city-portrait.jpg",
          alt: "Person at home comparing housing options"
        },
        {
          tag: "Lifestyle seekers",
          title: "Second-home buyers exploring towns and natural areas.",
          summary:
            "Atmosphere comes first. Location is refined after seeing real supply.",
          bullets: [
            "Scan multiple regions in one request.",
            "Ask for light, views, or quiet in plain words.",
            "See exactly why each property matched."
          ],
          image: "/web/person-working-from-home.jpg",
          alt: "Person planning a move from home"
        },
        {
          tag: "Teams & assistants",
          title: "Apps and copilots that need property search capability.",
          summary: "They need stable interfaces, not custom parsing per portal.",
          bullets: [
            "MCP shape optimized for LLM planning.",
            "Normalized cards across portal sources.",
            "Clear diagnostics for fallback and coverage."
          ],
          image: "/web/tall-residential-building-evening.jpg",
          alt: "Urban building representing assistant integration"
        }
      ]
    },
    how: {
      eyebrow: "How it works",
      title: "Simple flow.",
      titleAccent: "Talk to your AI, Fyn executes.",
      intro: "You do not need a new interface. Plug Fyn into your AI and start chatting.",
      steps: [
        {
          title: "The model plans the search",
          body: "You describe your intent. Your AI chooses locations, strictness, and search breadth."
        },
        {
          title: "Fyn runs the connectors",
          body: "Fyn queries portals, normalizes listing data, and returns diagnostics for transparency."
        },
        {
          title: "You decide faster",
          body: "Compare clean cards in chat, understand why each result appeared, and open the source listing."
        }
      ]
    },
    preview: {
      eyebrow: "Visual results",
      title: "Real photos,",
      titleAccent: "clear cards, fast decisions.",
      intro:
        "See authentic properties, compare easily, and understand why each result appears. Every card includes a direct link and match explanation."
      metaLeft: "Demo · 4 homes",
      metaRight: "Explainable matches · Direct links",
      sourceTag: "Source link available in live search",
      cards: [
        {
          title: "Classic building in central district",
          meta: "Barcelona · 3 beds · Matched for: city character",
          price: "390.000 €",
          image: "/web/city-residential-facade.jpg",
          alt: "Urban building"
        },
        {
          title: "Exterior flat in urban area",
          meta: "Valencia · 3 beds · Matched for: exterior + light",
          price: "349.000 €",
          image: "/web/spanish-apartment-block.jpg",
          alt: "Apartment block in city"
        },
        {
          title: "Apartment on historic street",
          meta: "Palma · 2 beds · Matched for: historic center",
          price: "210.000 €",
          image: "/web/historic-alley-apartment.jpg",
          alt: "Historic alley with homes"
        },
        {
          title: "Tower flat with open views",
          meta: "Madrid · 2 beds · Matched for: skyline views",
          price: "320.000 €",
          image: "/web/highrise-sunset-windows.jpg",
          alt: "Residential tower with views"
        }
      ]
    },
    trust: {
      eyebrow: "Trust & transparency",
      title: "Practical, transparent",
      titleAccent: "and honest.",
      body: "Fyn does not hide details to lock you in. We always show the original source link, explain each match, and respect your exact constraints."
    },
    finalCta: {
      eyebrow: "Final call",
      title: "Fyn is live.",
      titleAccent: "Ready to find your nest?",
      body: "We already have a working ChatGPT connector flow. Leave endless filters behind and start finding exactly what you want.",
      primary: "Try connector in ChatGPT",
      secondary: "Developer quickstart"
    },
    footer: {
      description: "Find your perfect nest through natural conversation and autonomous search.",
      productTitle: "Product",
      developersTitle: "Developers",
      runbook: "Runbook",
      docs: "MCP documentation",
      tryChatgpt: "Try in ChatGPT",
      copyright: "Fyn · Find Your Nest",
      creditsLabel: "Photos from Unsplash:",
      creditLinks
    },
    developers: {
      title: "For developers",
      titleAccent: "and autonomous agents",
      intro:
        "Connect your LLMs and chat apps to Spanish property search through the unified Fyn MCP server.",
      endpointTitle: "MCP endpoint configuration",
      endpointBody:
        "Configure Claude Desktop, ChatGPT developer mode, or your custom agent to consume Fyn tools.",
      copyUrl: "Copy URL",
      copied: "Copied",
      runbookTitle: "Developer runbook",
      runbookBody: "How to run locally, validate tool quality, and deploy safely.",
      healthTitle: "System health checker",
      healthBody: "Verify endpoint health and runtime status for connector calls.",
      schemaTitle: "Schema endpoint",
      schemaBody: "Open the MCP endpoint used by developer mode and compatible clients.",
      footer: "Fyn Developers"
    }
  }
};

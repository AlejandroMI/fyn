import Link from "next/link";

import type { Locale, SiteContent } from "@/content/site-content";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

interface HowItWorksPageProps {
  locale: Locale;
  content: SiteContent;
}

const pageCopy = {
  es: {
    eyebrow: "Dentro del experimento",
    title: "Qué ocurre entre el prompt y los resultados.",
    intro:
      "Fyn es un mini proyecto experimental: una demostración de cómo los portales inmobiliarios podrían exponer su inventario a agentes de IA mediante herramientas estructuradas, sin obligar al modelo a navegar una interfaz pensada para humanos.",
    thesisLabel: "La hipótesis",
    thesis:
      "Si el inventario inmobiliario se ofreciera como una herramienta fiable, tipada y trazable, una IA podría encargarse de planificar la búsqueda mientras el portal conserva el control de sus datos, reglas y experiencia final.",
    stages: [
      {
        label: "01 · Contrato MCP",
        title: "Una herramienta describe qué puede pedir el modelo",
        body:
          "Fyn publica search_properties mediante Model Context Protocol. Su esquema define campos como municipios, operación, presupuesto, habitaciones, tipos de inmueble y preferencias. El texto libre aporta contexto, pero la ejecución depende de restricciones estructuradas y validadas.",
        detail: "En el prototipo: MCP SDK + Zod, con transporte Streamable HTTP."
      },
      {
        label: "02 · Planificación",
        title: "La IA decide cómo convertir la intención en una búsqueda",
        body:
          "El modelo interpreta expresiones ambiguas —«cerca de naturaleza», «con vida de barrio» o «acepto reforma»— y elige ubicaciones, filtros duros y preferencias blandas. Fyn no usa otro LLM en el backend: recibe ese plan y lo ejecuta de forma determinista.",
        detail: "La separación importa: el modelo razona; la herramienta valida y ejecuta."
      },
      {
        label: "03 · Adaptadores",
        title: "Cada portal necesita una traducción distinta",
        body:
          "Un registro de conectores convierte el contrato común a las capacidades reales de cada fuente. Hoy el experimento trabaja con páginas públicas y comportamientos específicos por portal; en un escenario ideal, estos adaptadores consumirían APIs oficiales diseñadas para agentes.",
        detail: "Los conectores son reemplazables: la interfaz común no depende del origen."
      },
      {
        label: "04 · Normalización",
        title: "Datos heterogéneos entran en un mismo modelo",
        body:
          "Los campos disponibles se transforman en ListingCard: identificador, portal, URL, precio, habitaciones, tipo, imágenes y fecha de observación. Los filtros duros se aplican antes del ranking para evitar que una buena puntuación esconda un incumplimiento básico.",
        detail: "El contrato normalizado permite combinar fuentes sin borrar su procedencia."
      },
      {
        label: "05 · Ranking y diagnóstico",
        title: "El resultado incluye razones y también fallos",
        body:
          "Un scoring explícito pondera presupuesto, habitaciones, ubicación y señales textuales como luz, vistas o exterior. La respuesta añade why_matched y cobertura por ubicación y fuente, incluyendo bloqueos, cambios de esquema, ausencia de resultados o indisponibilidad.",
        detail: "La transparencia del fallo es parte del resultado, no un detalle interno."
      }
    ],
    outputEyebrow: "Qué intenta demostrar",
    outputTitle: "Una posible capa de interacción para portales en la era de los agentes.",
    outputs: [
      ["Herramientas, no scraping", "El destino deseable son APIs oficiales para agentes, con permisos, límites y contratos estables."],
      ["Planificación fuera del portal", "El usuario conserva su conversación y la IA compone búsquedas sobre inventario autorizado."],
      ["Control para la fuente", "El portal puede decidir campos, cuotas, atribución, enlaces, acceso y reglas comerciales."],
      ["Resultados verificables", "Cada propiedad mantiene su fuente y el usuario termina el proceso en el anuncio original."]
    ],
    noteTitle: "Un experimento con límites reales",
    noteBody:
      "Fyn no tiene acuerdos comerciales con los portales ni pretende sustituir sus productos. Las condiciones de uso, las restricciones de acceso y las medidas anti-bot limitan qué fuentes pueden consultarse y con qué fiabilidad; una fuente puede dejar de funcionar en cualquier momento. El proyecto usa esta fricción para mostrar por qué hacen falta interfaces oficiales, consentidas y preparadas para IA. No es una base de datos completa ni un servicio apto para decisiones sin verificar el anuncio original.",
    ctaTitle: "El prototipo está abierto a inspección.",
    ctaBody:
      "Consulta el contrato MCP y prueba el endpoint para entender qué funciona hoy y dónde están los límites.",
    primary: "Ver implementación MCP",
    secondary: "Probar el endpoint"
  },
  en: {
    eyebrow: "Inside the experiment",
    title: "What happens between the prompt and the results.",
    intro:
      "Fyn is a small experimental project: a demonstration of how property portals could expose inventory to AI agents through structured tools, without forcing a model to navigate an interface designed for humans.",
    thesisLabel: "The hypothesis",
    thesis:
      "If property inventory were available as a reliable, typed, and traceable tool, an AI could plan the search while the portal retained control over its data, rules, and final experience.",
    stages: [
      {
        label: "01 · MCP contract",
        title: "A tool describes what the model is allowed to request",
        body:
          "Fyn publishes search_properties through Model Context Protocol. Its schema defines municipalities, transaction type, budget, bedrooms, property types, and preferences. Free text adds context, but execution relies on validated, structured constraints.",
        detail: "In the prototype: MCP SDK + Zod over Streamable HTTP."
      },
      {
        label: "02 · Planning",
        title: "The AI turns intent into a search plan",
        body:
          "The model interprets ambiguous phrases—‘near nature’, ‘neighborhood character’, or ‘renovation is fine’—and chooses locations, hard filters, and soft preferences. Fyn does not run another LLM in the backend: it receives that plan and executes it deterministically.",
        detail: "The separation matters: the model reasons; the tool validates and executes."
      },
      {
        label: "03 · Adapters",
        title: "Each portal requires a different translation",
        body:
          "A connector registry maps the common contract to each source’s actual capabilities. Today the experiment works with public pages and portal-specific behavior; ideally, these adapters would consume official APIs designed for agents.",
        detail: "Connectors are replaceable: the shared interface does not depend on the source."
      },
      {
        label: "04 · Normalization",
        title: "Heterogeneous data enters one shared model",
        body:
          "Available fields become a ListingCard: identifier, portal, URL, price, bedrooms, type, images, and observation time. Hard filters run before ranking so a high score cannot hide a basic constraint violation.",
        detail: "The normalized contract combines sources without erasing provenance."
      },
      {
        label: "05 · Ranking and diagnostics",
        title: "The response includes reasons—and failures",
        body:
          "Explicit scoring weighs budget, bedrooms, location, and text signals such as light, views, or exterior aspect. The response adds why_matched and coverage per location and source, including blocks, schema changes, empty results, or outages.",
        detail: "Failure transparency is part of the result, not an internal detail."
      }
    ],
    outputEyebrow: "What it tries to demonstrate",
    outputTitle: "A possible interaction layer for property portals in the agent era.",
    outputs: [
      ["Tools, not scraping", "The desirable end state is official agent APIs with permissions, limits, and stable contracts."],
      ["Planning outside the portal", "Users keep their conversation while AI composes searches over authorized inventory."],
      ["Control for the source", "A portal can define fields, quotas, attribution, links, access, and commercial rules."],
      ["Verifiable results", "Every property retains its source and the user completes the journey on the original listing."]
    ],
    noteTitle: "An experiment with real limits",
    noteBody:
      "Fyn has no commercial agreements with the portals and is not intended to replace their products. Terms of use, access restrictions, and anti-bot measures limit which sources can be queried and how reliably; a source may stop working at any time. The project uses that friction to show why official, consent-based, AI-ready interfaces are needed. It is not a complete database or a service suitable for decisions without checking the original listing.",
    ctaTitle: "The prototype is open to inspection.",
    ctaBody: "Review the MCP contract and test the endpoint to see what works today and where the boundaries are.",
    primary: "View MCP implementation",
    secondary: "Test the endpoint"
  }
} as const;

export function HowItWorksPage({ locale, content }: HowItWorksPageProps) {
  const copy = pageCopy[locale];

  return (
    <div className="theme-light">
      <div className="container page-shell">
        <SiteHeader
          locale={locale}
          content={content}
          activeHref="/how-it-works"
          links={[
            { href: "/", label: content.nav.product },
            { href: "/how-it-works", label: content.nav.how },
            { href: "/developers", label: content.nav.developers }
          ]}
        />

        <main className="how-page">
          <header className="how-page-hero">
            <span className="eyebrow">{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </header>

          <section className="how-query-card" aria-label={copy.thesisLabel}>
            <span>{copy.thesisLabel}</span>
            <blockquote>{copy.thesis}</blockquote>
          </section>

          <section className="how-stage-list">
            {copy.stages.map((stage) => (
              <article className="how-stage" key={stage.label}>
                <div className="how-stage-label">{stage.label}</div>
                <div>
                  <h2>{stage.title}</h2>
                  <p>{stage.body}</p>
                  <strong>{stage.detail}</strong>
                </div>
              </article>
            ))}
          </section>

          <section className="how-output-section">
            <div className="section-head">
              <span className="eyebrow">{copy.outputEyebrow}</span>
              <h2>{copy.outputTitle}</h2>
            </div>
            <div className="how-output-grid">
              {copy.outputs.map(([title, body], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </section>

          <aside className="how-note">
            <h2>{copy.noteTitle}</h2>
            <p>{copy.noteBody}</p>
          </aside>

          <section className="how-page-cta">
            <h2>{copy.ctaTitle}</h2>
            <p>{copy.ctaBody}</p>
            <div className="final-actions">
              <Link href="/developers" locale={locale} className="btn btn-primary">
                {copy.primary}
              </Link>
              <a href="/mcp" className="btn btn-outline">
                {copy.secondary}
              </a>
            </div>
          </section>
        </main>

        <SiteFooter locale={locale} content={content} anchorPrefix="/" />
      </div>
    </div>
  );
}

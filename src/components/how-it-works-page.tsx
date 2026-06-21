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
    eyebrow: "Cómo funciona",
    title: "De una conversación a una lista de viviendas útil.",
    intro:
      "Fyn traduce lo que buscas a una consulta inmobiliaria, revisa varias fuentes y devuelve resultados comparables sin ocultar de dónde viene cada anuncio.",
    exampleLabel: "Tú describes el objetivo",
    example:
      "Busco un piso luminoso en Valencia, mínimo 2 habitaciones, con terraza y por debajo de 350.000 €. Prefiero un barrio tranquilo y bien conectado.",
    stages: [
      {
        label: "01 · Entender",
        title: "La IA convierte tu descripción en criterios claros",
        body:
          "Separa los límites imprescindibles —ubicación, precio, operación y habitaciones— de preferencias más flexibles como luz, vistas, ambiente o necesidad de reforma.",
        detail: "Resultado: una búsqueda estructurada que conserva los matices de tu petición."
      },
      {
        label: "02 · Buscar",
        title: "Fyn consulta varias fuentes en paralelo",
        body:
          "Los conectores adaptan la consulta a cada portal. Fyn recoge los anuncios disponibles y registra si una fuente responde, no tiene resultados o bloquea el acceso.",
        detail: "Resultado: más cobertura con un estado visible para cada fuente."
      },
      {
        label: "03 · Normalizar",
        title: "Los anuncios se convierten a un formato común",
        body:
          "Precio, ubicación, habitaciones, fotos y URL de origen se presentan con la misma estructura, aunque cada portal publique sus datos de manera distinta.",
        detail: "Resultado: propiedades que puedes comparar sin saltar entre interfaces."
      },
      {
        label: "04 · Explicar",
        title: "Recibes coincidencias con contexto, no una lista opaca",
        body:
          "La IA resume por qué encaja cada propiedad, señala posibles compromisos y mantiene el enlace directo al anuncio para que verifiques los detalles en la fuente.",
        detail: "Resultado: una lista corta, explicable y preparada para decidir."
      }
    ],
    outputEyebrow: "Qué recibes",
    outputTitle: "Una respuesta pensada para comparar y continuar.",
    outputs: [
      ["Coincidencias ordenadas", "Primero aparecen las opciones que mejor respetan tus criterios."],
      ["Razones visibles", "Cada resultado explica qué requisitos cumple y dónde puede ceder."],
      ["Datos trazables", "Fotos, precio y enlace conservan la referencia al anuncio original."],
      ["Conversación iterativa", "Puedes afinar presupuesto, zona o preferencias sin empezar de cero."]
    ],
    noteTitle: "Fyn no sustituye la verificación final",
    noteBody:
      "Los anuncios cambian y las fuentes pueden quedar temporalmente inaccesibles. Confirma siempre disponibilidad, precio y condiciones en el portal original antes de tomar una decisión.",
    ctaTitle: "¿Quieres probarlo en tu IA?",
    ctaBody: "Conecta el endpoint MCP de Fyn y empieza con una descripción de la vivienda que buscas.",
    primary: "Configurar Fyn",
    secondary: "Ver documentación"
  },
  en: {
    eyebrow: "How it works",
    title: "From a conversation to a useful property shortlist.",
    intro:
      "Fyn translates what you want into a property search, checks multiple sources, and returns comparable results without hiding where each listing came from.",
    exampleLabel: "You describe the goal",
    example:
      "I want a bright apartment in Valencia with at least 2 bedrooms, a terrace, and a price below €350,000. I prefer a quiet, well-connected neighborhood.",
    stages: [
      {
        label: "01 · Understand",
        title: "Your AI turns the description into clear criteria",
        body:
          "It separates hard limits—location, price, transaction type, and bedrooms—from flexible preferences such as light, views, atmosphere, or renovation tolerance.",
        detail: "Outcome: a structured search that preserves the nuance of your request."
      },
      {
        label: "02 · Search",
        title: "Fyn checks multiple sources in parallel",
        body:
          "Connectors adapt the query to each portal. Fyn collects available listings and records whether a source responds, has no results, or blocks access.",
        detail: "Outcome: broader coverage with visible source status."
      },
      {
        label: "03 · Normalize",
        title: "Listings are converted into one common format",
        body:
          "Price, location, bedrooms, photos, and source URLs use the same structure even when each portal publishes its data differently.",
        detail: "Outcome: properties you can compare without switching interfaces."
      },
      {
        label: "04 · Explain",
        title: "You get matches with context, not an opaque list",
        body:
          "Your AI summarizes why each property fits, flags likely tradeoffs, and preserves the direct listing link so you can verify details at the source.",
        detail: "Outcome: a short, explainable list ready for a decision."
      }
    ],
    outputEyebrow: "What you get",
    outputTitle: "A response designed for comparison and follow-up.",
    outputs: [
      ["Ranked matches", "The options that best respect your criteria appear first."],
      ["Visible reasoning", "Each result explains what it satisfies and where it may compromise."],
      ["Traceable data", "Photos, price, and links retain the original listing reference."],
      ["Iterative conversation", "Refine budget, area, or preferences without starting over."]
    ],
    noteTitle: "Fyn does not replace final verification",
    noteBody:
      "Listings change and sources can become temporarily unavailable. Always confirm availability, price, and terms on the original portal before making a decision.",
    ctaTitle: "Want to try it in your AI?",
    ctaBody: "Connect the Fyn MCP endpoint and start with a description of the property you want.",
    primary: "Set up Fyn",
    secondary: "Read the docs"
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

          <section className="how-query-card" aria-label={copy.exampleLabel}>
            <span>{copy.exampleLabel}</span>
            <blockquote>“{copy.example}”</blockquote>
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
              <Link href="/developers#connect" locale={locale} className="btn btn-primary">
                {copy.primary}
              </Link>
              <Link href="/developers" locale={locale} className="btn btn-outline">
                {copy.secondary}
              </Link>
            </div>
          </section>
        </main>

        <SiteFooter locale={locale} content={content} anchorPrefix="/" />
      </div>
    </div>
  );
}

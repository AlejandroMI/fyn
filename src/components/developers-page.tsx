import Link from "next/link";
import { useState } from "react";

import type { Locale, SiteContent } from "@/content/site-content";
import { GITHUB_REPOSITORY_URL } from "@/lib/site-config";

import { SiteHeader } from "./site-header";

interface DevelopersPageProps {
  locale: Locale;
  content: SiteContent;
}

const MCP_ENDPOINT = "https://fynfyn.top/mcp";

export function DevelopersPage({ locale, content }: DevelopersPageProps) {
  const [copied, setCopied] = useState(false);
  const year = new Date().getFullYear();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(MCP_ENDPOINT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_error) {
      setCopied(false);
    }
  }

  return (
    <div className="theme-dark">
      <div className="container page-shell">
        <SiteHeader
          locale={locale}
          content={content}
          variant="dark"
          activeHref="/developers"
          links={[
            { href: "/", label: content.nav.product },
            { href: "/how-it-works", label: content.nav.how },
            { href: "/developers", label: content.nav.developers }
          ]}
        />

        <main>
          <header className="dev-hero">
            <h1>
              {content.developers.title}
              <br />
              <i>{content.developers.titleAccent}</i>
            </h1>
            <p>{content.developers.intro}</p>
          </header>

          <section className="card" id="connect">
            <h2>{content.developers.endpointTitle}</h2>
            <p>{content.developers.endpointBody}</p>

            <div className="code-window">
              <div className="code-header">
                <div className="code-dots" aria-hidden="true">
                  <div className="code-dot" />
                  <div className="code-dot" />
                  <div className="code-dot" />
                </div>
                <button className="copy-btn" type="button" onClick={handleCopy}>
                  {copied ? content.developers.copied : content.developers.copyUrl}
                </button>
              </div>
              <div className="code-body">
                <span className="token-string">{MCP_ENDPOINT}</span>
                <br />
                <span className="token-keyword">transport:</span>{" "}
                <span className="token-function">Streamable HTTP</span>
              </div>
            </div>
          </section>

          <section className="card connector-setup">
            <h2>{content.developers.setupTitle}</h2>
            <ol className="setup-list">
              {content.developers.setupSteps.map((step, index) => (
                <li key={step.title}>
                  <span className="setup-number">{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="setup-actions">
              <a href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer" className="btn btn-primary">
                {content.developers.claudeCta}
              </a>
              <a
                href="https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp"
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
              >
                {locale === "es" ? "Guía oficial de Claude" : "Official Claude guide"}
              </a>
            </div>
            <p className="compatibility-note">{content.developers.compatibilityNote}</p>
          </section>

          <section className="card" id="quickstart">
            <h2>{locale === "es" ? "Quickstart para agentes" : "Agent quickstart"}</h2>
            <p>
              {locale === "es"
                ? "El endpoint público es gratuito durante esta fase experimental y no requiere cuenta, clave API ni OAuth. Está sujeto a límites de uso y puede cambiar; no existe un plan de pago ni SLA actualmente."
                : "The public endpoint is free during this experimental phase and requires no account, API key, or OAuth. It is rate-limited and may change; there is currently no paid plan or SLA."}
            </p>
            <ol className="setup-list">
              <li>
                <span className="setup-number">1</span>
                <div>
                  <h3>{locale === "es" ? "Conecta el transporte" : "Connect the transport"}</h3>
                  <p>{locale === "es" ? "Configura un cliente MCP Streamable HTTP con https://fynfyn.top/mcp. No envíes cabecera Authorization." : "Configure a Streamable HTTP MCP client with https://fynfyn.top/mcp. Do not send an Authorization header."}</p>
                </div>
              </li>
              <li>
                <span className="setup-number">2</span>
                <div>
                  <h3>{locale === "es" ? "Descubre y llama la herramienta" : "Discover and call the tool"}</h3>
                  <p>{locale === "es" ? "Ejecuta tools/list y llama search_properties con city o locations y restricciones estructuradas." : "Run tools/list, then call search_properties with city or locations and structured constraints."}</p>
                </div>
              </li>
              <li>
                <span className="setup-number">3</span>
                <div>
                  <h3>{locale === "es" ? "Comprueba cobertura" : "Check coverage"}</h3>
                  <p>{locale === "es" ? "Lee diagnostics antes de responder. Conserva los enlaces de origen y avisa de fuentes bloqueadas o no disponibles." : "Read diagnostics before answering. Preserve source links and disclose blocked or unavailable sources."}</p>
                </div>
              </li>
            </ol>
            <div className="code-window">
              <div className="code-header"><span>search_properties</span></div>
              <pre className="code-body"><code>{`{
  "locale": "en",
  "transaction_type": "buy",
  "property_types": ["house"],
  "locations": ["Valencia"],
  "max_price_eur": 350000,
  "strict_constraints": true
}`}</code></pre>
            </div>
          </section>

          <section className="card" id="reliability">
            <h2>{locale === "es" ? "Límites, errores y reintentos" : "Limits, errors, and retries"}</h2>
            <p>{locale === "es" ? "Las respuestas MCP usan errores JSON-RPC estructurados. Un 429 incluye Retry-After; respétalo y aplica backoff exponencial acotado con jitter. Las respuestas también anuncian RateLimit-Limit y RateLimit-Remaining. Un 413 indica que el cuerpo supera el límite y un 500 representa un fallo transitorio del servicio." : "MCP responses use structured JSON-RPC errors. A 429 includes Retry-After; respect it and use bounded exponential backoff with jitter. Responses also advertise RateLimit-Limit and RateLimit-Remaining. A 413 means the body is oversized, and a 500 represents a transient service failure."}</p>
            <p>{locale === "es" ? "Fyn solo descubre anuncios. No reserva, compra, valora ni verifica legalmente inmuebles. La disponibilidad de portales cambia y un resultado debe confirmarse siempre en su enlace original." : "Fyn only discovers listings. It does not reserve, buy, value, or legally verify property. Portal availability changes, and every result must be verified at its original link."}</p>
          </section>

          <div className="resource-grid">
            <a href="/llms-full.txt" className="resource-card">
              <h3>{locale === "es" ? "Documentación para agentes" : "Agent documentation"}</h3>
              <p>{locale === "es" ? "Contrato, ejemplos, límites y recuperación en un único archivo." : "Contract, examples, limitations, and recovery in one file."}</p>
            </a>

            <a href="/openapi.json" className="resource-card">
              <h3>OpenAPI 3.1</h3>
              <p>{locale === "es" ? "Descripción legible por máquina del transporte MCP y health." : "Machine-readable description of the MCP transport and health route."}</p>
            </a>

            <a href="/.well-known/mcp/server-card.json" className="resource-card">
              <h3>MCP server card</h3>
              <p>{locale === "es" ? "Descubrimiento de servidor, herramienta y recurso MCP Apps." : "Server, tool, and MCP Apps resource discovery."}</p>
            </a>

            <a href="/health" className="resource-card">
              <h3>{content.developers.healthTitle}</h3>
              <p>{content.developers.healthBody}</p>
            </a>

            <a href="/mcp" className="resource-card">
              <h3>{content.developers.schemaTitle}</h3>
              <p>{content.developers.schemaBody}</p>
            </a>

            <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer" className="resource-card">
              <h3>{content.developers.sourceTitle}</h3>
              <p>{content.developers.sourceBody}</p>
            </a>
          </div>
        </main>

        <footer className="developers-footer">
          <div className="copyright">
            © {year} {content.developers.footer}
          </div>
          <div className="nav-links">
            <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <Link href="/" locale={locale}>
              {content.nav.backToProduct}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

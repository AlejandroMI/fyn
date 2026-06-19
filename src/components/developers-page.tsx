import Link from "next/link";
import { useState } from "react";

import type { Locale, SiteContent } from "@/content/site-content";

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

          <div className="resource-grid">
            <a href="/health" className="resource-card">
              <h3>{content.developers.healthTitle}</h3>
              <p>{content.developers.healthBody}</p>
            </a>

            <a href="/mcp" className="resource-card">
              <h3>{content.developers.schemaTitle}</h3>
              <p>{content.developers.schemaBody}</p>
            </a>
          </div>
        </main>

        <footer className="developers-footer">
          <div className="copyright">
            © {year} {content.developers.footer}
          </div>
          <div className="nav-links">
            <Link href="/" locale={locale}>
              {content.nav.backToProduct}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

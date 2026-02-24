import Link from "next/link";
import { useState } from "react";

import type { Locale, SiteContent } from "@/content/site-content";

import { SiteHeader } from "./site-header";

interface DevelopersPageProps {
  locale: Locale;
  content: SiteContent;
}

const MCP_ENDPOINT = "https://fyn-mcp-server.vercel.app/mcp";

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

          <section className="card">
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
                <span className="token-keyword">const</span> endpoint <span className="token-keyword">=</span>{" "}
                <span className="token-string">"{MCP_ENDPOINT}"</span>;<br />
                <br />
                <span className="token-function">connectMCP</span>({"{"}
                <br />
                &nbsp;&nbsp;serverUrl: endpoint,
                <br />
                &nbsp;&nbsp;transport: <span className="token-string">"sse"</span>
                <br />
                {"}"});
              </div>
            </div>
          </section>

          <div className="resource-grid">
            <a href="/docs/chatgpt-developer-mode-runbook.md" className="resource-card">
              <h3>{content.developers.runbookTitle}</h3>
              <p>{content.developers.runbookBody}</p>
            </a>

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

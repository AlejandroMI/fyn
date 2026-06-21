import Head from "next/head";
import Link from "next/link";
import type { PropsWithChildren, ReactNode } from "react";

import { siteContent, type Locale } from "@/content/site-content";
import { absoluteOriginPath, absoluteSiteUrl, SUPPORT_EMAIL } from "@/lib/site-config";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

interface InfoPageLayoutProps extends PropsWithChildren {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  updatedAt: string;
  activeHref: string;
  asideTitle: string;
  asideBody: string;
  asideCtaLabel: string;
  asideCtaHref: string;
  asideExtra?: ReactNode;
}

function infoNav(locale: Locale) {
  const content = siteContent[locale];

  return [
    { href: "/#problem", label: content.nav.problem },
    { href: "/#use-cases", label: content.nav.useCases },
    { href: "/how-it-works", label: content.nav.how },
    { href: "/#preview", label: content.nav.preview },
    { href: "/developers", label: content.nav.developers }
  ];
}

export function InfoPageLayout({
  locale,
  path,
  title,
  description,
  eyebrow,
  intro,
  updatedAt,
  activeHref,
  asideTitle,
  asideBody,
  asideCtaLabel,
  asideCtaHref,
  asideExtra,
  children
}: InfoPageLayoutProps) {
  const content = siteContent[locale];
  const canonicalUrl = absoluteSiteUrl(path, locale);
  const isInternalAsideCta =
    asideCtaHref.startsWith("/") && !asideCtaHref.startsWith("//") && !asideCtaHref.startsWith("/docs/");

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={absoluteOriginPath("/web/fynlogo.png")} />
        <meta name="twitter:card" content="summary" />
      </Head>

      <div className="theme-light">
        <div className="page-shell">
          <div className="container">
            <SiteHeader locale={locale} content={content} links={infoNav(locale)} activeHref={activeHref} />

            <main className="info-shell">
              <section className="info-main">
                <span className="eyebrow">{eyebrow}</span>
                <h1>{title}</h1>
                <p className="info-intro">{intro}</p>
                <p className="info-updated">
                  {locale === "es" ? "Última actualización" : "Last updated"}: {updatedAt}
                </p>

                <div className="info-card">{children}</div>
              </section>

              <aside className="info-aside">
                <div className="info-aside-card">
                  <p className="info-aside-kicker">{locale === "es" ? "Operación" : "Operations"}</p>
                  <h2>{asideTitle}</h2>
                  <p>{asideBody}</p>
                  {isInternalAsideCta ? (
                    <Link className="btn btn-primary" href={asideCtaHref} locale={locale}>
                      {asideCtaLabel}
                    </Link>
                  ) : (
                    <a className="btn btn-primary" href={asideCtaHref}>
                      {asideCtaLabel}
                    </a>
                  )}

                  {asideExtra ?? null}

                  <div className="info-aside-meta">
                    <span>{locale === "es" ? "Correo de soporte" : "Support email"}</span>
                    <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                  </div>
                </div>
              </aside>
            </main>
            <SiteFooter locale={locale} content={content} anchorPrefix="/" />
          </div>
        </div>
      </div>

      <style jsx>{`
        .info-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(260px, 0.8fr);
          gap: 2rem;
          padding: 2.5rem 0 4.5rem;
          align-items: start;
        }

        .info-main h1 {
          font-family: var(--font-serif);
          font-size: clamp(2.4rem, 5vw, 4.4rem);
          line-height: 0.95;
          font-weight: 400;
          max-width: 12ch;
        }

        .info-intro {
          margin-top: 1.25rem;
          max-width: 58ch;
          color: var(--ink-light);
          font-size: 1.05rem;
          line-height: 1.72;
        }

        .info-updated {
          margin-top: 0.9rem;
          color: var(--ink-light);
          font-size: 0.88rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .info-card {
          margin-top: 1.75rem;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 2rem;
          box-shadow: var(--shadow-soft);
        }

        .info-card :global(h2) {
          font-family: var(--font-serif);
          font-size: 1.7rem;
          line-height: 1.1;
          font-weight: 400;
          margin-top: 2rem;
        }

        .info-card :global(h2:first-child) {
          margin-top: 0;
        }

        .info-card :global(p) {
          margin-top: 0.9rem;
          color: var(--ink-light);
          line-height: 1.75;
        }

        .info-card :global(ul) {
          margin-top: 0.9rem;
          padding-left: 1.25rem;
          display: grid;
          gap: 0.7rem;
          color: var(--ink-light);
        }

        .info-card :global(li) {
          line-height: 1.65;
        }

        .info-card :global(a) {
          color: var(--ink);
          text-decoration: underline;
          text-underline-offset: 0.18em;
        }

        .info-aside {
          position: sticky;
          top: 1.25rem;
        }

        .info-aside-card {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(235, 234, 228, 0.88));
          border: 1px solid rgba(17, 17, 16, 0.08);
          border-radius: var(--radius-xl);
          padding: 1.6rem;
          display: grid;
          gap: 1rem;
          box-shadow: var(--shadow-soft);
        }

        .info-aside-kicker {
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-light);
        }

        .info-aside-card h2 {
          font-family: var(--font-serif);
          font-size: 2rem;
          line-height: 0.98;
          font-weight: 400;
        }

        .info-aside-card p {
          color: var(--ink-light);
          line-height: 1.68;
        }

        .info-aside-meta {
          border-top: 1px solid rgba(17, 17, 16, 0.08);
          padding-top: 1rem;
          display: grid;
          gap: 0.35rem;
          font-size: 0.92rem;
        }

        .info-aside-meta span {
          color: var(--ink-light);
        }

        .info-aside-meta a {
          font-weight: 600;
        }
        @media (max-width: 900px) {
          .info-shell {
            grid-template-columns: 1fr;
          }

          .info-main h1 {
            max-width: none;
          }

          .info-aside {
            position: static;
          }
        }

        @media (max-width: 640px) {
          .info-card,
          .info-aside-card {
            padding: 1.25rem;
            border-radius: var(--radius-lg);
          }
        }
      `}</style>
    </>
  );
}

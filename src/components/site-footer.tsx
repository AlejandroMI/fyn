import Link from "next/link";

import type { Locale, SiteContent } from "@/content/site-content";

interface SiteFooterProps {
  locale: Locale;
  content: SiteContent;
  anchorPrefix?: "" | "/";
}

export function SiteFooter({ locale, content, anchorPrefix = "" }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const legalTitle = locale === "es" ? "Legal" : "Legal";
  const privacyLabel = locale === "es" ? "Privacidad" : "Privacy";
  const termsLabel = locale === "es" ? "Términos" : "Terms";
  const supportLabel = locale === "es" ? "Soporte" : "Support";

  return (
    <footer>
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="footer-logo-wrap">
            <img src="/web/fynlogo.png" alt="Fyn logo" className="logo-img" />
            <div className="footer-logo-text">Fyn.</div>
          </div>
          <p>{content.footer.description}</p>
        </div>

        <div>
          <h4 className="footer-heading">{content.footer.productTitle}</h4>
          <ul className="footer-list">
            <li>
              <a href={`${anchorPrefix}#problem`}>{content.nav.problem}</a>
            </li>
            <li>
              <a href={`${anchorPrefix}#use-cases`}>{content.nav.useCases}</a>
            </li>
            <li>
              <Link href="/developers#connect" locale={locale}>
                {content.footer.connectFyn}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="footer-heading">{content.footer.developersTitle}</h4>
          <ul className="footer-list">
            <li>
              <Link href="/developers" locale={locale}>
                {content.footer.docs}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="footer-heading">{legalTitle}</h4>
          <ul className="footer-list">
            <li>
              <Link href="/privacy" locale={locale}>
                {privacyLabel}
              </Link>
            </li>
            <li>
              <Link href="/terms" locale={locale}>
                {termsLabel}
              </Link>
            </li>
            <li>
              <Link href="/support" locale={locale}>
                {supportLabel}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="foot-bottom">
        <p>
          © {year} {content.footer.copyright}
        </p>
        <div className="credits">
          {content.footer.creditsLabel}
          {content.footer.creditLinks.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

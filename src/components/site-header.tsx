import Link from "next/link";

import type { Locale, SiteContent } from "@/content/site-content";

import { LanguageSwitcher } from "./language-switcher";

interface HeaderLink {
  href: string;
  label: string;
  external?: boolean;
}

interface SiteHeaderProps {
  locale: Locale;
  content: SiteContent;
  links: HeaderLink[];
  variant?: "light" | "dark";
  activeHref?: string;
}

export function SiteHeader({
  locale,
  content,
  links,
  variant = "light",
  activeHref
}: SiteHeaderProps) {
  return (
    <header className="site-shell">
      <nav className={`site-nav ${variant === "dark" ? "site-nav-dark" : ""}`}>
        <Link href="/" locale={locale} className="brand" aria-label="Fyn">
          <img src="/web/fynlogo.png" alt="Fyn logo" className="logo-img" />
          <span className="brand-text">Fyn.</span>
        </Link>

        <div className="nav-links">
          {links.map((link) =>
            link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ) : link.href.startsWith("#") ? (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                locale={locale}
                className={activeHref === link.href ? "active" : ""}
              >
                {link.label}
              </Link>
            )
          )}
          <LanguageSwitcher locale={locale} variant={variant} />
          {variant === "dark" ? (
            <span className="status-pill">
              <span className="status-dot" />
              {content.nav.mcpLive}
            </span>
          ) : null}
        </div>
      </nav>
    </header>
  );
}

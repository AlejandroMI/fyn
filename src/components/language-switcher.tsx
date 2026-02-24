import Link from "next/link";
import { useRouter } from "next/router";

import type { Locale } from "@/content/site-content";

interface LanguageSwitcherProps {
  variant?: "light" | "dark";
  locale: Locale;
}

export function LanguageSwitcher({ variant = "light", locale }: LanguageSwitcherProps) {
  const router = useRouter();
  const nextLocale: Locale = locale === "es" ? "en" : "es";

  return (
    <Link
      href={{ pathname: router.pathname, query: router.query }}
      as={router.asPath}
      locale={nextLocale}
      className={`lang-switch ${variant === "dark" ? "lang-switch-dark" : ""}`}
      aria-label={nextLocale === "es" ? "Cambiar a español" : "Switch to English"}
    >
      {nextLocale.toUpperCase()}
    </Link>
  );
}

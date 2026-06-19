export type AppLocale = "es" | "en";

export const DEFAULT_SITE_URL = "https://fynfyn.top";
export const SUPPORT_EMAIL = "support@fynfyn.top";

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function getSiteOrigin(): string {
  return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_SITE_URL;
}

export function localizePath(path: string, locale: AppLocale): string {
  const normalizedPath = path === "" ? "/" : path;

  if (locale !== "en") {
    return normalizedPath;
  }

  return normalizedPath === "/" ? "/en" : `/en${normalizedPath}`;
}

export function absoluteSiteUrl(path: string, locale: AppLocale): string {
  return new URL(localizePath(path, locale), getSiteOrigin()).toString();
}

export function absoluteOriginPath(path: string): string {
  return new URL(path, getSiteOrigin()).toString();
}

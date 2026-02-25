# Website Architecture (Fyn Web)

This document describes the website layer only (not MCP internals).

## Scope

- Product landing page (`/`)
- Developers page (`/developers`, legacy alias `/developers.html`)
- Shared navigation/layout
- ES/EN localization for web copy
- Visual system and asset structure

## Stack

- Next.js (Pages Router)
- React + TypeScript
- Tailwind installed, with custom global CSS design system in use
- Deployed on Vercel in the same project as MCP routes

## Directory map

- `pages/index.tsx`: landing route
- `pages/developers.tsx`: developers route
- `pages/developers.html.tsx`: legacy route alias
- `pages/api/mcp.ts`: MCP HTTP endpoint adapter
- `pages/api/health.ts`: health endpoint adapter
- `src/components/home-page.tsx`: landing UI composition
- `src/components/developers-page.tsx`: developers UI composition
- `src/components/site-header.tsx`: shared navbar/header
- `src/components/language-switcher.tsx`: locale switch control
- `src/content/site-content.ts`: ES/EN copy dictionaries
- `src/styles/globals.css`: design tokens + full component styling
- `server/mcp-handler.ts`: MCP handler implementation
- `server/health-handler.ts`: health handler implementation
- `public/web/*`: website assets (logo + images)

## Routing

- `/` -> localized landing
- `/developers` -> localized developers page
- `/developers.html` -> same developers content (compat route)
- `/api/mcp` -> MCP endpoint
- `/api/health` -> health JSON
- `vercel.json` rewrites:
  - `/mcp` -> `/api/mcp`
  - `/health` -> `/api/health`

## Localization

- Configured in `next.config.mjs`:
  - locales: `es`, `en`
  - default locale: `es`
- Content source of truth: `src/content/site-content.ts`
- Language switcher is shared via `SiteHeader`.
- Rule: all user-facing copy for web pages should come from the content dictionary, not inline strings.

## Visual system

- Core tokens defined in CSS variables in `src/styles/globals.css`:
  - colors, radii, typography, shadows
- Typography:
  - Serif display: `Instrument Serif`
  - Sans body: `Inter`
- Landing sections maintain curated visual behavior:
  - tall hero media
  - auto-scrolling property carousel
  - black preview block with horizontal listing rail

## Local development

- Run website dev server:
  - `pnpm dev:web`
  - serves on `http://localhost:3008`
- Build production web:
  - `pnpm build`
- Start production build locally:
  - `pnpm start`

## Deployment notes

- Vercel config is pinned to Next builder through `vercel.json` `builds` entry.
- Keep this file intact unless deployment strategy changes.
- Production deploy source of truth is Vercel GitHub integration for repo `AlejandroMI/fyn`.
- Branch rule: pushes to `main` auto-deploy to production.
- Do not add a parallel GitHub Actions deploy pipeline unless intentionally replacing this workflow (avoid duplicate deploy triggers).

## Guardrails for future edits

- Reuse `SiteHeader` for cross-page consistency.
- Add new sections as components under `src/components` when they grow.
- Keep image filenames descriptive under `public/web`.
- Preserve Spanish-first behavior unless product decision changes.
- Any copy change in one locale should be mirrored in the other.

#!/usr/bin/env bash
set -euo pipefail

# Keep apps/web as source-of-truth for marketing pages while Vercel serves root.
cp apps/web/index.html index.html
cp apps/web/developers.html developers.html

echo "Synced apps/web pages to project root."

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ROOT}/safari/Grokipedia Redirect/Grokipedia Redirect Extension/Resources"

mkdir -p "${DEST}/icons"

FILES=(
  manifest.json
  background.js
  browser-compat.js
  url-utils.js
  content.js
  grokipedia-fallback.js
  popup.html
  popup.css
  popup.js
)

for file in "${FILES[@]}"; do
  cp "${ROOT}/${file}" "${DEST}/${file}"
done

# Copy toolbar icons only (skip hidden source backups).
find "${ROOT}/icons" -maxdepth 1 -type f -name '*.png' ! -name '.*' -exec cp {} "${DEST}/icons/" \;

echo "Synced extension files to ${DEST}"

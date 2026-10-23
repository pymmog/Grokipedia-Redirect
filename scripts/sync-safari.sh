#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ROOT}/safari/Grokipedia Redirect/Grokipedia Redirect Extension/Resources"

mkdir -p "${DEST}/icons"

FILES=(
  manifest.json
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

cp -R "${ROOT}/icons/." "${DEST}/icons/"

echo "Synced extension files to ${DEST}"

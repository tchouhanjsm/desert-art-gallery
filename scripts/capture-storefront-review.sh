#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_DIR=".local-data/visual-review/$STAMP"
mkdir -p "$OUTPUT_DIR"

if ! curl --fail --silent --show-error "$BASE_URL/api/health" >/dev/null; then
  echo "The local app is not responding at $BASE_URL. Start it with npm run dev first." >&2
  exit 1
fi

# Product preview routes are available in development mode; published data is not fabricated.
npx --yes playwright@1.56.1 install chromium

routes=(
  "/"
  "/shop"
  "/products/banjara-vintage-embroidered-jacket"
  "/cart"
)

viewports=(
  "390,844"
  "768,1024"
  "1440,1000"
)

for viewport in "${viewports[@]}"; do
  width="${viewport%%,*}"
  for route in "${routes[@]}"; do
    slug="$(printf '%s' "$route" | sed 's#^/##; s#/#-#g; s#[^a-zA-Z0-9-]#-#g')"
    slug="${slug:-home}"
    destination="$OUTPUT_DIR/${slug}-${width}px.png"
    echo "Capturing $route at $viewport -> $destination"
    npx --yes playwright@1.56.1 screenshot \
      --browser chromium \
      --viewport-size "$viewport" \
      --full-page \
      --wait-for-timeout 700 \
      "$BASE_URL$route" "$destination"
  done
done

echo "Visual review screenshots saved under $OUTPUT_DIR"

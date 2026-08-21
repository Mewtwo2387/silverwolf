#!/bin/bash
# Fetch a free (CC0) Quaternius pack from itch.io.
#
# itch's free-download flow is three steps and needs a session cookie carried
# across all of them:
#   1. GET the game page            -> csrf token + session cookie
#   2. POST /download_url           -> a signed download-page URL
#   3. GET that page, POST /file/ID -> the actual CDN file URL
# Nothing here logs in or pays; it is the same path the "Download Now" button
# takes for a $0 "name your own price" asset.
set -euo pipefail
SLUG="$1"
OUT="$2"
JAR="cookies-$SLUG.txt"
BASE="https://quaternius.itch.io/$SLUG"

csrf_of() { grep -oE 'csrf_token" value="[^"]*"' "$1" | head -1 | sed 's/.*value="//;s/"//'; }

curl -sL -c "$JAR" -b "$JAR" --max-time 60 "$BASE" -o "page-$SLUG.html"
CSRF=$(csrf_of "page-$SLUG.html")

DLPAGE=$(curl -s -c "$JAR" -b "$JAR" --max-time 60 -X POST "$BASE/download_url" \
  -H 'Content-Type: application/json' -H "Referer: $BASE" \
  -d "{\"csrf_token\":\"$CSRF\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["url"])')

curl -sL -c "$JAR" -b "$JAR" --max-time 60 "$DLPAGE" -o "dlpage-$SLUG.html"
CSRF2=$(csrf_of "dlpage-$SLUG.html")

# The free tier is always the first upload; paid "[Source]" tiers list a price.
UPLOAD=$(grep -oE 'data-upload_id="[0-9]+"' "dlpage-$SLUG.html" | head -1 | grep -oE '[0-9]+')
echo "upload id: $UPLOAD"

FILEURL=$(curl -s -c "$JAR" -b "$JAR" --max-time 60 -X POST "$BASE/file/$UPLOAD?source=game_download" \
  -H "Referer: $DLPAGE" --data-urlencode "csrf_token=$CSRF2" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("url") or d)')

echo "file url: ${FILEURL:0:90}..."
curl -sL --max-time 600 "$FILEURL" -o "$OUT"
python3 -c "import os;print('$OUT', os.path.getsize('$OUT'), 'bytes')"

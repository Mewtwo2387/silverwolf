---
paths:
  - "site_src/**"
---

# Website architecture (`site_src/`)

The website is **public**. Re-read the security guardrails in `AGENTS.md` before changing anything
here.

**Server** (`server.ts`): a Hono app served by `Bun.serve` on **`PORT 6769` / host `0.0.0.0`** (prod
publishes it to `127.0.0.1:8080` behind a reverse proxy — see `docker-compose.yaml`). Runs in the
**same process** as the bot and receives the `Silverwolf` instance, so it can use the Discord client
and the shared DB. Uses `createBunWebSocket()` — **the returned `websocket` handler must be passed
to `Bun.serve` or WS upgrades hang.** Cache pre-warm (`startWebsiteCachePrewarm`) runs on the bot's
`clientReady` so the first `/leaderboards` / `/birthdays` hit a populated cache.

**Middleware order matters** (registered in `server.ts`, applied outermost-first):
`embedMetaMiddleware` (rewrites HTML to add social-embed meta) → `rateLimiter(120, 60_000)` (120
req/min per IP, IPv6 bucketed to /64) → `securityHeadersMiddleware` (CSP + **per-request nonce**,
HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy) →
`sessionMiddleware`.

**Routes** (registered in `server.ts`): `routes/static.ts`, `routes/auth.ts` (Discord OAuth),
`routes/pages.ts` (HTML), `routes/games-api.ts` (JSON POST game actions), `routes/ai-slop-api.ts`,
`routes/cyclic-tictactoe-mp.ts` (multiplayer WebSocket; game logic in `multiplayer/`).

## Rendering & assets

Pages are composed with `Layout()` (`components/layout.ts`) using Hono's `html` tag, which
**auto-escapes interpolated values**. Inline `<script>` needs the request nonce via `c.get('nonce')`.

CSS: edit `Assets/input.css`, run `build:css` → minified `styles.css`. Client JS: edit
`Assets/app.src.js`, run `build:js` → bundled `app.js`. Both are served `immutable,
max-age=31536000` and cache-busted by content hash (`asset-version.ts`, `?v=<hash>`).

> `Assets/*.js` build **outputs** are lint-ignored and generated — edit the `.src.js` source, not
> the bundle. A green build does not prove the bundle works; check for undefined globals.

Fonts are self-hosted woff2 (`font-src 'self'`, `font-display: swap`). Search index ships as a JSON
`<script>` data-island; renders coalesce per animation frame; below-fold images lazy-load.

HTML responses are `Cache-Control: private, no-store` (prevents the per-request nonce leaking
through a CDN). `PUBLIC_ORIGIN` pins absolute embed URLs so untrusted `x-forwarded-*` headers can't
redirect link previews.

## Auth — Discord OAuth *user* login (no admin UI)

Sessions in `database/models/WebSessionModel.ts`; cookie `sw_session` (`__Host-`-prefixed when
secure — see `auth/session.ts`); token is HMAC-SHA256 verified with `timingSafeEqual`; TTL 30-day
sliding / 90-day absolute; OAuth `state` has a 5-min CSRF TTL; return-URLs are
same-origin-whitelisted.

A per-session **CSRF token is required on every game POST and as the first WebSocket message**
(`authedGameRequest` validates session + CSRF).

Login only lets a user see their own dashboard/stats and play account-tied games — there is **no**
admin/management surface on the web.

## Perf

Prefer the cached `app.js` over new inline scripts; put styles in `input.css` (not inline
`<style>`); lazy-load below-fold images; parallelize DB reads (`Promise.all`); extend the cache
pre-warm (`bot-bridge.ts`) for new heavy queries.

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

> `Assets/app.js` and `Assets/styles.css` are generated — edit `app.src.js` / `input.css`, never
> the bundle. Note that **all** of `site_src/Assets/` is lint-ignored (`.eslintrc.json`
> `ignorePatterns`), so `app.src.js` is unlinted source too: nothing catches a typo there. A green
> build does not prove the bundle works; check for undefined globals.

Fonts are self-hosted woff2 (`font-src 'self'`, `font-display: swap`). Search index ships as a JSON
`<script>` data-island; renders coalesce per animation frame; below-fold images lazy-load.

## Client-bundled games (`three`)

A client-only game needing a JS library (Plane Sim / its model inspector / Wave Sim / Backrooms and
its entity viewer use `three`) is **self-hosted and bundled — never a CDN** (CSP is
`script-src 'self'`). Each is a `*.src.js` in `Assets/` wired into `build:js`
(`plane-sim.src.js`→`plane-sim.js`, `plane-viewer.src.js`→`plane-viewer.js`,
`wave-sim.src.js`→`wave-sim.js`, `backrooms.src.js`→`backrooms.js`,
`backrooms-viewer.src.js`→`backrooms-viewer.js`), the `Dockerfile` build+overlay steps and
`routes/static.ts`, then loaded as a hash-busted `<script type=module>`. Bundle outputs are
gitignored. **Only the entry points are wired anywhere** — a new `backrooms-*.js` module is picked
up automatically as an import of `backrooms.src.js`, and needs no build, Dockerfile or route
change. Put shared geometry/logic in a plain module imported by both the game and any tooling
(`plane-sim-models.js` for the aircraft; `backrooms-entities.js` / `backrooms-pool-entities.js`,
whose exported tuning blocks and `ENTITY_INFO` / `POOL_ENTITY_INFO` are read by both the game and
the entity viewer, so a stat card cannot quote a number the game does not use; `wave-field.js`,
whose Gerstner sum drives both the Wave Sim and the Poolrooms' water). Immersive pages pass
`Layout({ fullscreen: true })`, which drops the navbar/footer/centred `<main>`.

**Backrooms binary assets.** Backrooms is no longer purely procedural: it loads photoscanned PBR
surface maps and a rigged player model from `site_src/Assets/backrooms/` (served as
`/static/backrooms/*`, listed explicitly in `routes/static.ts`, versioned through the
`#br-asset-ver` island — the same `assetVersionMap` scheme `/static/planes/` uses). The
procedural canvas textures remain the fallback and the `low`-quality path, so the scanned set is
strictly an upgrade: `upgradeSurfaces()` / `upgradePoolSurfaces()` mutate the already-built
materials in place and resolve `false` on any failure. `COPY . .` in the Dockerfile already picks
the directory up — **no Dockerfile change is needed for new assets there**, only for new bundle
entry points. How the assets were produced (and how to regenerate or re-source them) is
`scripts/backrooms-assets/README.md`. **Every third-party asset must be listed in the `REFERENCES`
`Art assets` group in `pages/games/backrooms.ts`,** including CC0 ones that do not require it.

**Verify in a browser — a green `build:js` is not enough.** The bundler does not catch undefined
identifiers: a forgotten import bundles fine and only throws `ReferenceError` at runtime. Run
`bun run test:harness` (standalone dev server, port 7788, `HARNESS_PORT` to override) — it renders
the Three.js game pages plus `/games` logged-out and serves `Assets/` as `/static/`, no bot, DB or
OAuth needed — and load the page after touching any of these modules. It serves Backrooms with its
in-game test harness armed (top-down map, teleports, noclip, and a `window.__backrooms` scripting
API), which the real app also exposes at `/games/backrooms?debug=1`. After touching any geometry
builder, run `__backrooms.auditGeometry()` on both levels — it walks every triangle in the scene
and reports any whose vertex winding disagrees with its own normal, which is a surface that is
invisible from the side you are meant to see it from and which nothing else catches. `tests/` is `.dockerignore`d
and never reaches the image.

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

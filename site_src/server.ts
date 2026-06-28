import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { log } from '../utils/log';
import type { Silverwolf } from '../classes/silverwolf';
import { startWebsiteCachePrewarm } from './bot-bridge';
import { rateLimiter } from './middleware/rate-limit';
import { securityHeadersMiddleware } from './middleware/security';
import { sessionMiddleware } from './middleware/session';
import { embedMetaMiddleware } from './middleware/embed';
import { compressMiddleware } from './middleware/compress';
import { registerStaticRoutes } from './routes/static';
import { registerAuthRoutes } from './routes/auth';
import { registerPageRoutes } from './routes/pages';
import { registerGameApiRoutes } from './routes/games-api';
import { registerAiSlopApiRoutes } from './routes/ai-slop-api';
import { registerCyclicTttMpRoutes } from './routes/cyclic-tictactoe-mp';
import { registerBattleshipsMpRoutes } from './routes/battleships-mp';
import type { AppEnv } from './shared';

const PORT = 6769;
// Bind to 0.0.0.0 so the site is reachable when the bot runs inside a container.
const HOSTNAME = '0.0.0.0';

export function startWebsite(silverwolf: Silverwolf) {
  const app = new Hono<AppEnv>();

  // hono/bun bridges Hono routes into Bun's native WebSocket upgrade — the
  // `websocket` object below MUST be passed to Bun.serve, otherwise upgrade
  // attempts fall through and clients see a hung request.
  const { upgradeWebSocket, websocket } = createBunWebSocket();

  // Outermost: runs last on the way out, so it compresses the final body after
  // embed has injected its <meta> tags. ~70% fewer bytes over the CF tunnel.
  app.use('*', compressMiddleware);
  // Rewrites the fully-headered HTML body to add social-embed <meta> tags
  // (no-op for non-HTML responses).
  app.use('*', embedMetaMiddleware);
  app.use('*', rateLimiter(120, 60_000)); // 120 reqs per minute per IP
  app.use('*', securityHeadersMiddleware);
  app.use('*', sessionMiddleware(silverwolf));

  registerStaticRoutes(app);
  registerAuthRoutes(app, silverwolf);
  registerPageRoutes(app, silverwolf);
  registerGameApiRoutes(app, silverwolf);
  registerAiSlopApiRoutes(app, silverwolf);
  registerCyclicTttMpRoutes(app, silverwolf, upgradeWebSocket);
  registerBattleshipsMpRoutes(app, silverwolf, upgradeWebSocket);

  app.notFound((c) => c.text('not found', 404));

  const server = Bun.serve({
    port: PORT,
    hostname: HOSTNAME,
    // Bun's default is 128 MiB. The largest legitimate request body is an
    // ai-slop message (~8 KB), so cap hard — unauthenticated POSTs (e.g.
    // /games/love/calculate) are otherwise fully buffered and JSON.parsed
    // before any validation runs.
    maxRequestBodySize: 256 * 1024,
    fetch: app.fetch,
    websocket,
  });

  log(`site_src listening on http://${server.hostname}:${server.port}`);

  // Kick off cache pre-warm once the Discord client is ready so the first
  // /leaderboards or /birthdays request hits a populated cache instead of
  // paying for ~10–50 serialized users.fetch() round-trips.
  if (silverwolf.isReady()) {
    startWebsiteCachePrewarm(silverwolf);
  } else {
    silverwolf.once('clientReady', () => startWebsiteCachePrewarm(silverwolf));
  }

  return server;
}

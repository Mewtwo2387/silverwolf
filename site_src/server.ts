import { Hono } from 'hono';
import { log } from '../utils/log';
import type { Silverwolf } from '../classes/silverwolf';
import { startWebsiteCachePrewarm } from './bot-bridge';
import { rateLimiter } from './middleware/rate-limit';
import { securityHeadersMiddleware } from './middleware/security';
import { sessionMiddleware } from './middleware/session';
import { registerStaticRoutes } from './routes/static';
import { registerAuthRoutes } from './routes/auth';
import { registerPageRoutes } from './routes/pages';
import { registerGameApiRoutes } from './routes/games-api';
import { registerAiSlopApiRoutes } from './routes/ai-slop-api';
import type { AppEnv } from './shared';

const PORT = 6769;
// Bind to 0.0.0.0 so the site is reachable when the bot runs inside a container.
const HOSTNAME = '0.0.0.0';

export function startWebsite(silverwolf: Silverwolf) {
  const app = new Hono<AppEnv>();

  app.use('*', rateLimiter(120, 60_000)); // 120 reqs per minute per IP
  app.use('*', securityHeadersMiddleware);
  app.use('*', sessionMiddleware(silverwolf));

  registerStaticRoutes(app);
  registerAuthRoutes(app, silverwolf);
  registerPageRoutes(app, silverwolf);
  registerGameApiRoutes(app, silverwolf);
  registerAiSlopApiRoutes(app, silverwolf);

  app.notFound((c) => c.text('not found', 404));

  const server = Bun.serve({
    port: PORT,
    hostname: HOSTNAME,
    fetch: app.fetch,
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

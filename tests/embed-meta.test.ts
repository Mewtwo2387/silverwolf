import { Hono } from 'hono';
import { embedDescriptionForPath, embedMetaTags } from '../site_src/embed-meta';
import { embedMetaMiddleware } from '../site_src/middleware/embed';

const PAGE = '<!doctype html><html><head><title>Silverwolf — Games</title></head><body>hi</body></html>';

function makeApp() {
  const app = new Hono();
  app.use('*', embedMetaMiddleware);
  app.get('/about', (c) => c.html(PAGE));
  app.get('/games', (c) => c.html(PAGE));
  app.get('/games/flip', (c) => c.html(PAGE));
  app.get('/api/thing', (c) => c.json({ ok: true }));
  app.notFound((c) => c.text('not found', 404));
  return app;
}

async function fetchHtml(path: string, headers: Record<string, string> = {}) {
  const res = await makeApp().request(`http://site.test${path}`, { headers });
  return { res, body: await res.text() };
}

describe('embedDescriptionForPath', () => {
  test('maps the static pages', () => {
    expect(embedDescriptionForPath('/about')).toMatch(/multipurpose bot/);
    expect(embedDescriptionForPath('/leaderboards')).toMatch(/leaderboard/i);
    expect(embedDescriptionForPath('/birthdays')).toMatch(/birthday/i);
    expect(embedDescriptionForPath('/games')).toMatch(/Play games/i);
  });

  test('reuses the per-game card blurb for /games/{game}', () => {
    expect(embedDescriptionForPath('/games/flip')).toBe('Flip a virtual coin. Will it be heads, tails, or... side?');
  });

  test('ignores a trailing slash', () => {
    expect(embedDescriptionForPath('/games/')).toBe(embedDescriptionForPath('/games'));
  });

  test('falls back to the about intro for unknown pages', () => {
    expect(embedDescriptionForPath('/me')).toBe(embedDescriptionForPath('/about'));
  });
});

describe('embedMetaMiddleware', () => {
  test('injects embed tags into rendered HTML', async () => {
    const { body } = await fetchHtml('/games');
    expect(body).toContain('<meta property="og:title" content="Silverwolf — Games" />');
    expect(body).toContain('<meta property="og:type" content="website" />');
    expect(body).toContain('<meta name="twitter:card" content="summary" />');
    // tags land inside <head>, before the closing tag
    expect(body.indexOf('og:title')).toBeLessThan(body.indexOf('</head>'));
  });

  test('uses an absolute PNG og:image and og:url from the request origin', async () => {
    const { body } = await fetchHtml('/about');
    expect(body).toMatch(/<meta property="og:image" content="http:\/\/site\.test\/static\/stickers\/[^"]+\.png" \/>/);
    expect(body).toContain('<meta property="og:image:type" content="image/png" />');
    expect(body).toMatch(/<meta property="og:image:width" content="(256|340)" \/>/);
    expect(body).toMatch(/<meta property="og:image:height" content="(256|340)" \/>/);
    expect(body).toContain('<meta property="og:url" content="http://site.test/about" />');
  });

  test('honours x-forwarded-proto/-host (Cloudflare)', async () => {
    const { body } = await fetchHtml('/about', {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'silverwolf.example',
    });
    expect(body).toContain('<meta property="og:url" content="https://silverwolf.example/about" />');
  });

  test('uses the lv999 sticker pool when ?lv=999', async () => {
    const { body } = await fetchHtml('/about?lv=999');
    expect(body).toMatch(/og:image" content="http:\/\/site\.test\/static\/stickers\/Sticker_PPG_27[^"]+\.png"/);
  });

  test('reports the correct square dimensions for the 340px sticker', () => {
    // Sticker_PPG_02 is the only 340px sticker; the rest are 256px.
    let saw340 = false;
    for (let i = 0; i < 200 && !saw340; i += 1) {
      const out = embedMetaTags({ origin: 'http://x', path: '/about', title: 'T' });
      if (out.includes('Sticker_PPG_02_Silver_Wolf_01.png')) {
        saw340 = true;
        expect(out).toContain('<meta property="og:image:width" content="340" />');
      }
    }
    expect(saw340).toBe(true);
  });

  test('does not embed invalid links (404 text)', async () => {
    const { res, body } = await fetchHtml('/nope');
    expect(res.status).toBe(404);
    expect(body).toBe('not found');
    expect(body).not.toContain('og:title');
  });

  test('leaves JSON API responses untouched', async () => {
    const { body } = await fetchHtml('/api/thing');
    expect(body).toBe('{"ok":true}');
  });
});

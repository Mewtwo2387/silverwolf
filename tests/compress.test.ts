import { Hono } from 'hono';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { compressMiddleware } from '../site_src/middleware/compress';
import { embedMetaMiddleware } from '../site_src/middleware/embed';

// Body must exceed the middleware's MIN_BYTES (1 KB) threshold to be compressed.
const BIG = 'x'.repeat(4000);
const PAGE = `<!doctype html><html><head><title>Silverwolf</title></head><body>${BIG}</body></html>`;

function makeApp() {
  const app = new Hono();
  app.use('*', compressMiddleware);
  app.get('/page', (c) => c.html(PAGE));
  app.get('/tiny', (c) => c.html('<!doctype html><html><head><title>t</title></head><body>hi</body></html>'));
  app.get('/api', (c) => c.json({ blob: BIG }));
  app.get('/img', () => new Response(Buffer.alloc(4000), { headers: { 'content-type': 'image/webp' } }));
  app.get('/static/styles.css', (c) => c.body(BIG, 200, { 'content-type': 'text/css' }));
  return app;
}

function req(path: string, accept?: string) {
  const headers: Record<string, string> = {};
  if (accept) headers['accept-encoding'] = accept;
  return makeApp().request(`http://site.test${path}`, { headers });
}

describe('compressMiddleware', () => {
  test('brotli-encodes HTML when the client accepts br', async () => {
    const res = await req('/page', 'br, gzip');
    expect(res.headers.get('content-encoding')).toBe('br');
    expect(res.headers.get('vary')).toBe('Accept-Encoding');
    const decoded = brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString();
    expect(decoded).toBe(PAGE);
  });

  test('falls back to gzip when br is not offered', async () => {
    const res = await req('/page', 'gzip');
    expect(res.headers.get('content-encoding')).toBe('gzip');
    const decoded = gunzipSync(Buffer.from(await res.arrayBuffer())).toString();
    expect(decoded).toBe(PAGE);
  });

  test('serves raw when no accept-encoding is sent', async () => {
    const res = await req('/page');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(PAGE);
  });

  test('leaves small bodies uncompressed', async () => {
    const res = await req('/tiny', 'br');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toContain('hi');
  });

  test('compresses JSON but never binary image types', async () => {
    const json = await req('/api', 'br');
    expect(json.headers.get('content-encoding')).toBe('br');
    const img = await req('/img', 'br');
    expect(img.headers.get('content-encoding')).toBeNull();
  });

  test('skips /static/ (handled with cached buffers in routes/static.ts)', async () => {
    const res = await req('/static/styles.css', 'br');
    expect(res.headers.get('content-encoding')).toBeNull();
  });

  test('composes with embedMetaMiddleware: compresses the meta-injected body', async () => {
    const app = new Hono();
    app.use('*', compressMiddleware);
    app.use('*', embedMetaMiddleware);
    app.get('/about', (c) => c.html(PAGE));
    const res = await app.request('http://site.test/about', { headers: { 'accept-encoding': 'br' } });
    expect(res.headers.get('content-encoding')).toBe('br');
    const decoded = brotliDecompressSync(Buffer.from(await res.arrayBuffer())).toString();
    expect(decoded).toContain('og:title');
    expect(decoded).toContain(BIG);
  });
});

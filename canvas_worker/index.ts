import { Hono } from 'hono';
import { generateQuote, applyEffect, applyBorder, convertImage } from './canvas';

const app = new Hono();

app.post('/quote', async (c) => {
  try {
    const data = await c.req.json();
    const buffer = await generateQuote(data);
    return c.body(buffer, 200, { 'Content-Type': 'image/png' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/effect', async (c) => {
  try {
    const { type, pfpUrl } = await c.req.json();
    const buffer = await applyEffect(type, pfpUrl);
    return c.body(buffer, 200, { 'Content-Type': 'image/png' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/border', async (c) => {
  try {
    const { pfpUrl, borderType } = await c.req.json();
    const buffer = await applyBorder(pfpUrl, borderType);
    return c.body(buffer, 200, { 'Content-Type': 'image/png' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/convert', async (c) => {
  try {
    const { format } = c.req.query();
    const arrayBuffer = await c.req.arrayBuffer();
    const buffer = await convertImage(Buffer.from(arrayBuffer), format);
    return c.body(buffer, 200, { 'Content-Type': `image/${format}` });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};

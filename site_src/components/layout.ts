import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Navbar } from './navbar';
import { Footer } from './footer';

const baseStyles = html`
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      background: #0f1014;
      color: #e6e6e9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    main { flex: 1; padding: 2rem clamp(1rem, 4vw, 3rem); max-width: 1100px; width: 100%; margin: 0 auto; }
    .navbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.9rem clamp(1rem, 4vw, 3rem);
      border-bottom: 1px solid #22232b;
      background: #14151b;
    }
    .nav-brand { font-weight: 700; letter-spacing: 0.02em; }
    .nav-links { display: flex; gap: 1.25rem; position: relative; }
    .nav-link {
      color: #b8b9c2; text-decoration: none; font-size: 0.95rem;
      padding: 0.25rem 0.1rem; border-bottom: 2px solid transparent;
      transition: color 0.2s ease;
    }
    .nav-link:hover { color: #fff; }
    .nav-link.active { color: #fff; border-bottom-color: #6d7cff; }
    .nav-underline {
      position: absolute;
      bottom: -2px;
      left: 0;
      height: 2px;
      width: 0;
      background: #6d7cff;
      border-radius: 2px;
      opacity: 0;
      pointer-events: none;
      transform: translateX(0);
    }
    .nav-links.js-ready .nav-link.active { border-bottom-color: transparent; }
    .footer {
      border-top: 1px solid #22232b;
      background: #14151b;
      padding: 1rem clamp(1rem, 4vw, 3rem);
      font-size: 0.8rem; color: #8b8c95;
      display: flex; flex-direction: column; gap: 0.3rem;
    }
    .footer-placeholders { display: flex; gap: 1rem; flex-wrap: wrap; color: #6a6b74; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .footer-copy { color: #5a5b63; }
    h1, h2, h3 { margin: 0 0 0.5em; }
    a { color: #8fa1ff; }
    table { border-collapse: collapse; margin: 0 auto; }
    th, td { padding: 0.4rem 0.9rem; border-bottom: 1px solid #22232b; text-align: left; }
    th { color: #b8b9c2; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #1a1b23; padding: 0.1em 0.35em; border-radius: 3px; }
  </style>
`;

export function Layout(opts: {
  title: string;
  active?: 'about' | 'leaderboards' | 'birthdays';
  extraStyles?: HtmlEscapedString;
  body: HtmlEscapedString;
}) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${opts.title}</title>
        ${baseStyles}
        ${opts.extraStyles ?? ''}
      </head>
      <body>
        ${Navbar(opts.active)}
        <main>${opts.body}</main>
        ${Footer()}
      </body>
    </html>`;
}

import { html } from 'hono/html';

export function Footer() {
  return html`
    <footer class="footer">
      <div>Built with Bun, Hono, and questionable decisions.</div>
      <div class="footer-placeholders">
        <span>[status: ok]</span>
        <span>[uptime: yes]</span>
        <span>[vibes: immaculate]</span>
      </div>
      <div class="footer-copy">© Silverwolf — prototype build</div>
    </footer>
  `;
}

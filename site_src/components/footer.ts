import { html } from 'hono/html';

export function Footer() {
  return html`
    <footer class="border-t border-ink-600 bg-ink-800 py-4 px-[clamp(1rem,4vw,3rem)] text-[0.8rem] text-fog-300 flex flex-col gap-[0.3rem]">
      <div>Built with Bun, Hono, and questionable decisions.</div>
      <div class="flex gap-4 flex-wrap text-fog-400 font-mono">
        <span>[status: ok]</span>
        <span>[uptime: yes]</span>
        <span>[vibes: immaculate]</span>
      </div>
      <div class="text-fog-500">© Silverwolf — prototype build</div>
    </footer>
  `;
}

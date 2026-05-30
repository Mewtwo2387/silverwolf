import { html, raw } from 'hono/html';

// Footer styled to match the navbar's "window" aesthetic: a glass surface
// with a SYS.*.EXE title bar (traffic-light dots + [ONLINE] status) and
// theme-aware accent gradients via CSS vars.
const footerStyles = raw(`
<style>
  .footer-surface {
    background: color-mix(in oklab, var(--ink-800) 75%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid transparent;
    border-image: linear-gradient(90deg, transparent 0%, var(--accent) 30%, var(--accent-pale) 70%, transparent 100%) 1;
    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    position: relative;
    overflow: hidden;
  }

  /* Window title bar is hidden on narrow viewports, shown on desktop —
     mirrors the navbar's .nav-window-header behaviour. */
  .footer-window-header { display: none; }

  @media (min-width: 1025px) {
    .footer-window-header { display: flex; }

    .footer-surface {
      max-width: 1100px;
      width: calc(100% - 2rem);
      margin: 2rem auto 1.5rem auto;
      border-radius: 0.75rem;
      border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
      border-image: none;
      background: color-mix(in oklab, var(--ink-800) 65%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow:
        0 10px 30px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 0 15px rgba(34, 211, 255, 0.05);
    }
  }

  /* Theme picker chips + status badges share a pill look that echoes the
     navbar's surfaces. */
  .footer-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0.55rem;
    border-radius: 0.4rem;
    border: 1px solid var(--ink-600);
    background: color-mix(in oklab, var(--ink-900) 40%, transparent);
    color: var(--fog-200);
    text-decoration: none;
    transition: color 0.2s, border-color 0.2s, background-color 0.2s, text-shadow 0.2s;
  }
  a.footer-chip:hover {
    color: var(--fog-100);
    border-color: color-mix(in oklab, var(--accent) 40%, transparent);
    text-shadow: 0 0 8px var(--glow-bright);
  }
  .footer-chip.is-active {
    color: var(--accent-light);
    font-weight: 600;
    border-color: color-mix(in oklab, var(--accent) 60%, transparent);
    background: color-mix(in oklab, var(--accent) 10%, transparent);
  }
</style>
`);

export function Footer(nonce: string) {
  return html`
    ${footerStyles}
    <footer class="footer-surface font-mono">
      <!-- Window title bar: only visible on desktop -->
      <div class="footer-window-header items-center justify-between px-[1.5rem] py-2 border-b border-[rgba(34,211,255,0.12)] select-none">
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#ff6b8a] opacity-60"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-[#f59e0b] opacity-60"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-[#10b981] opacity-60"></span>
          <span class="ml-2 text-[0.7rem] font-semibold text-accent opacity-75 tracking-widest font-mono">SYS.FOOTER.EXE</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="status-led status-led-green w-1.5 h-1.5"></span>
          <span class="text-[#10b981] text-[0.7rem] font-bold tracking-widest font-mono">[ONLINE]</span>
        </div>
      </div>

      <!-- Window content -->
      <div class="flex flex-col gap-3 py-5 px-[1.5rem] text-[0.8rem] text-fog-300">
        <div class="font-semibold text-fog-200">Built with Bun, Hono, and questionable decisions.</div>

        <div class="flex gap-2.5 flex-wrap items-center">
          <span class="footer-chip"><span class="status-led status-led-green" style="width:6px;height:6px;"></span>[status: ok]</span>
          <span class="footer-chip"><span class="status-led status-led-green" style="width:6px;height:6px;"></span>[uptime: yes]</span>
          <span class="footer-chip"><span class="status-led status-led-cyan" style="width:6px;height:6px;"></span>[vibes: immaculate]</span>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-fog-300">
          <span>[theme:</span>
          <a href="?theme=default" data-theme="default" class="theme-pick footer-chip">default</a>
          <a href="?theme=flashbang" data-theme="flashbang" class="theme-pick footer-chip">flashbang</a>
          <a href="?theme=blackout" data-theme="blackout" class="theme-pick footer-chip">blackout</a>
          <span>]</span>
        </div>

        <div class="text-fog-500 text-[0.72rem] tracking-wider uppercase">[ Silverwolf — prototype build v1.2 ]</div>
      </div>
      ${raw(`<script nonce="${nonce}">
(function(){
  var t = new URLSearchParams(location.search).get('theme');
  if (t !== 'flashbang' && t !== 'blackout') t = 'default';
  document.querySelectorAll('.theme-pick').forEach(function(a){
    if (a.getAttribute('data-theme') === t) {
      a.classList.add('is-active');
    }
    a.addEventListener('click', function(e){
      e.preventDefault();
      var name = a.getAttribute('data-theme');
      var u = new URL(location.href);
      if (name === 'default') u.searchParams.delete('theme');
      else u.searchParams.set('theme', name);
      location.href = u.toString();
    });
  });
})();
</script>`)}
    </footer>
  `;
}

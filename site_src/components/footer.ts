import { html, raw } from 'hono/html';

export function Footer(nonce: string) {
  return html`
    <footer class="border-t border-ink-600/60 bg-ink-800/80 backdrop-blur-md py-6 px-[clamp(1rem,4vw,3rem)] text-[0.8rem] text-fog-300 flex flex-col gap-3 relative overflow-hidden">
      <!-- Decorative Neon Bar -->
      <div class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent"></div>
      
      <div class="flex items-center gap-2">
        <span class="status-led status-led-cyan"></span>
        <div class="font-semibold text-fog-200">Built with Bun, Hono, and questionable decisions.</div>
      </div>
      
      <div class="flex gap-4 flex-wrap text-fog-400 font-mono items-center">
        <span class="flex items-center gap-1.5 px-2 py-0.5 rounded border border-ink-600 bg-ink-900/40"><span class="status-led status-led-green" style="width:6px;height:6px;"></span>[status: ok]</span>
        <span class="flex items-center gap-1.5 px-2 py-0.5 rounded border border-ink-600 bg-ink-900/40"><span class="status-led status-led-green" style="width:6px;height:6px;"></span>[uptime: yes]</span>
        <span class="flex items-center gap-1.5 px-2 py-0.5 rounded border border-ink-600 bg-ink-900/40"><span class="status-led status-led-cyan" style="width:6px;height:6px;"></span>[vibes: immaculate]</span>
      </div>
      
      <div class="text-fog-400 font-mono flex flex-wrap items-center gap-2">
        <span>[theme:</span>
        <a href="?theme=default" data-theme="default" class="theme-pick px-2 py-0.5 rounded border border-ink-600 bg-ink-900/40 hover:border-accent/40 text-fog-400 no-underline hover:text-fog-200 transition-all">default</a>
        <a href="?theme=flashbang" data-theme="flashbang" class="theme-pick px-2 py-0.5 rounded border border-ink-600 bg-ink-900/40 hover:border-accent/40 text-fog-400 no-underline hover:text-fog-200 transition-all">flashbang</a>
        <a href="?theme=blackout" data-theme="blackout" class="theme-pick px-2 py-0.5 rounded border border-ink-600 bg-ink-900/40 hover:border-accent/40 text-fog-400 no-underline hover:text-fog-200 transition-all">blackout</a>
        <span>]</span>
      </div>
      <div class="text-fog-500 font-mono text-[0.72rem] tracking-wider uppercase">[ Silverwolf — prototype build v1.2 ]</div>
      ${raw(`<script nonce="${nonce}">
(function(){
  var t = new URLSearchParams(location.search).get('theme');
  if (t !== 'flashbang' && t !== 'blackout') t = 'default';
  document.querySelectorAll('.theme-pick').forEach(function(a){
    if (a.getAttribute('data-theme') === t) {
      a.classList.remove('text-fog-400', 'hover:text-fog-200', 'border-ink-600');
      a.classList.add('text-accent-light', 'font-semibold', 'border-accent/60', 'bg-accent/10');
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

import { html, raw } from 'hono/html';

export function Footer(nonce: string) {
  return html`
    <footer class="border-t border-ink-600 bg-ink-800 py-4 px-[clamp(1rem,4vw,3rem)] text-[0.8rem] text-fog-300 flex flex-col gap-[0.3rem]">
      <div>Built with Bun, Hono, and questionable decisions.</div>
      <div class="flex gap-4 flex-wrap text-fog-400 font-mono">
        <span>[status: ok]</span>
        <span>[uptime: yes]</span>
        <span>[vibes: immaculate]</span>
      </div>
      <div class="text-fog-400 font-mono">
        [current theme:
        <a href="?theme=default" data-theme="default" class="theme-pick text-fog-400 no-underline hover:text-fog-200">default</a>,
        <a href="?theme=flashbang" data-theme="flashbang" class="theme-pick text-fog-400 no-underline hover:text-fog-200">flashbang</a>,
        <a href="?theme=blackout" data-theme="blackout" class="theme-pick text-fog-400 no-underline hover:text-fog-200">blackout</a>]
      </div>
      <div class="text-fog-500">Silverwolf — prototype build</div>
      ${raw(`<script nonce="${nonce}">
(function(){
  var t = new URLSearchParams(location.search).get('theme');
  if (t !== 'flashbang' && t !== 'blackout') t = 'default';
  document.querySelectorAll('.theme-pick').forEach(function(a){
    if (a.getAttribute('data-theme') === t) {
      a.classList.remove('text-fog-400', 'hover:text-fog-200');
      a.classList.add('text-accent-light', 'font-semibold');
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

// Content-hash cache-busting for the /static/planes/ textures. The server
// renders a { basename: hash } manifest into a JSON island (#ps-asset-ver) on
// the plane pages; planeUrl() appends ?v=<hash> so an edited texture busts the
// immutable cache automatically — the same scheme styles.css / app.js use, with
// no manual ?v bump. Shared by the game (plane-sim) and the model inspector
// (plane-viewer), both of which import the model builders.
//
// Falls back to ?v=dev when a file isn't in the manifest (e.g. a standalone
// test harness that doesn't inject the island) — the texture still loads.
let _ver = null;

function manifest() {
  if (_ver) return _ver;
  _ver = {};
  try {
    const el = typeof document !== 'undefined' && document.getElementById('ps-asset-ver');
    if (el) _ver = JSON.parse(el.textContent || '{}') || {};
  } catch (_) { _ver = {}; }
  return _ver;
}

// planeUrl('spit-skin-special') -> '/static/planes/spit-skin-special.jpg?v=ab12cd34'
export function planeUrl(name, ext = 'jpg') {
  const v = manifest()[name];
  return `/static/planes/${name}.${ext}?v=${v || 'dev'}`;
}

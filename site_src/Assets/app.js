// Site-wide client behaviour, served as a static, 1-year-immutable, hash-busted
// asset (see routes/static.ts + components/layout.ts assetVersion) so the browser
// downloads it once and reuses it across full-page navigations — instead of
// re-parsing ~25KB of inline <script> on every page view (HTML is `no-store`).
//
// Authored as plain ES (no bundler/transpile). Loaded with `defer`, so every
// IIFE runs after the DOM is parsed; getElementById lookups below are safe.
//
// NOTE: the pre-paint theme snippet (sets <html data-theme>) stays inline in
// components/layout.ts to avoid a flash of the wrong theme before this loads.

// ── Theme query-param propagation ───────────────────────────────────────────
// Keep ?theme= on internal links so a non-default theme survives navigation.
(function () {
  var t = new URLSearchParams(location.search).get('theme');
  if (t !== 'flashbang' && t !== 'blackout') return;

  function patch(a) {
    try {
      var u = new URL(a.href, location.origin);
      if (u.origin !== location.origin) return;
      if (u.searchParams.has('theme')) return;
      u.searchParams.set('theme', t);
      a.href = u.toString();
    } catch (e) {}
  }

  // Patch all internal anchors now (defer → DOM is ready) and keep them accurate.
  document.querySelectorAll('a[href]').forEach(patch);

  // Capture-phase click delegation: bulletproof fallback for any anchor
  // (mobile drawer links, dynamically inserted links, etc.) — runs before
  // any other click handler so href is patched by the time navigation happens.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a) patch(a);
  }, true);
})();

// ── Navbar: desktop sliding underline + mobile dock pill ────────────────────
(() => {
  // ── Desktop sliding underline ──────────────────────────────────────────────
  const container = document.getElementById('nav-links');
  if (container) {
    const underline = container.querySelector('.nav-underline');
    const links = Array.from(container.querySelectorAll('.nav-link'));
    if (underline && links.length) {
      container.classList.add('js-ready');

      const place = (el, animate) => {
        const cRect = container.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        underline.style.transition = animate
          ? 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1), width 0.28s cubic-bezier(0.4, 0, 0.2, 1)'
          : 'none';
        underline.style.width = r.width + 'px';
        underline.style.transform = 'translateX(' + (r.left - cRect.left) + 'px)';
        underline.style.opacity = '1';
      };

      const activeLink = links.find((l) => l.classList.contains('active'));
      if (activeLink) requestAnimationFrame(() => place(activeLink, false));

      links.forEach((l) => {
        l.addEventListener('click', (e) => {
          if (l.classList.contains('active')) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
          e.preventDefault();
          place(l, true);
          setTimeout(() => { window.location.href = l.href; }, 240);
        });
      });

      window.addEventListener('resize', () => {
        const current = links.find((x) => x.classList.contains('active'));
        if (current) place(current, false);
      });

      const theme = new URLSearchParams(location.search).get('theme');
      if (theme) {
        links.forEach((l) => {
          const u = new URL(l.href);
          u.searchParams.set('theme', theme);
          l.href = u.toString();
        });
      }
    }
  }

  // ── Mobile dock: sliding pill + drag-to-focus ─────────────────────────────
  const dock = document.getElementById('nav-mobile');
  const pill = dock && dock.querySelector('.dock-pill');
  // Mirror the CSS that decides when the dock is visible. Evaluate the two
  // queries separately — older WebKit rejects comma-joined media-query lists
  // passed to matchMedia.
  const dockVisible = !!window.matchMedia && (
    window.matchMedia('(max-width: 1024px)').matches
    || window.matchMedia('(hover: none) and (pointer: coarse)').matches
  );
  if (dock && pill && dockVisible) {
    const tiles = Array.from(dock.querySelectorAll('.nav-link'));
    const NAV_DELAY = 320;
    const SPRING = '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

    let activeIdx = tiles.findIndex((t) => t.classList.contains('active'));
    if (activeIdx < 0) activeIdx = 0;
    let pillX = 0;
    let pillW = 0;
    let pendingNav = null;

    const tileGeom = (tile) => {
      const dr = dock.getBoundingClientRect();
      const tr = tile.getBoundingClientRect();
      return { x: tr.left - dr.left, w: tr.width };
    };

    const placePill = (idx, animate) => {
      const g = tileGeom(tiles[idx]);
      pillX = g.x; pillW = g.w;
      pill.style.transition = animate ? 'transform ' + SPRING + ', width ' + SPRING : 'none';
      pill.style.width = g.w + 'px';
      pill.style.transform = 'translateX(' + g.x + 'px)';
    };

    const setActive = (idx) => {
      if (idx === activeIdx) return;
      tiles[activeIdx].classList.remove('active');
      tiles[activeIdx].removeAttribute('aria-current');
      tiles[idx].classList.add('active');
      tiles[idx].setAttribute('aria-current', 'page');
      activeIdx = idx;
    };

    const navigate = (idx) => {
      if (pendingNav) clearTimeout(pendingNav);
      pendingNav = setTimeout(() => { window.location.href = tiles[idx].href; }, NAV_DELAY);
    };

    requestAnimationFrame(() => placePill(activeIdx, false));

    // Tap a tile → slide pill + navigate (skip if it was a drag-induced click)
    tiles.forEach((tile, i) => {
      tile.addEventListener('click', (e) => {
        if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
        if (i === activeIdx) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
        e.preventDefault();
        setActive(i);
        placePill(i, true);
        navigate(i);
      });
    });

    // ── Drag the pill to slide focus ─────────────────────────────
    let dragging = false;
    let dragStartX = 0;
    let dragOriginX = 0;
    let dragMoved = false;
    let suppressClick = false;
    // Geometry snapshot taken once on pointerdown so the move loop never calls
    // getBoundingClientRect (each call forces a synchronous reflow; doing it per
    // tile, per pointermove at 60–120Hz is the classic layout-thrash jank).
    // centers[i] = tile i's center X relative to the dock; dockWidth bounds travel.
    let dragGeom = { centers: [], dockWidth: 0 };

    const nearestTo = (center) => {
      let nearest = 0;
      let minDist = Infinity;
      for (let i = 0; i < dragGeom.centers.length; i++) {
        const d = Math.abs(dragGeom.centers[i] - center);
        if (d < minDist) { minDist = d; nearest = i; }
      }
      return nearest;
    };

    dock.addEventListener('pointerdown', (e) => {
      // Only initiate drag when the pointer lands on the pill itself.
      const dr = dock.getBoundingClientRect();
      const localX = e.clientX - dr.left;
      if (localX < pillX || localX > pillX + pillW) return;
      dragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragOriginX = pillX;
      // Snapshot geometry up front; reused for the whole drag (see dragGeom note).
      dragGeom = {
        centers: tiles.map((t) => { const g = tileGeom(t); return g.x + g.w / 2; }),
        dockWidth: dr.width,
      };
      pill.classList.add('dragging');
      pill.style.transition = 'none';
      try { dock.setPointerCapture(e.pointerId); } catch (_) {}
    });

    dock.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 4) dragMoved = true;
      // Pad inside the dock so the pill never overlaps the curved edge
      const pad = 4;
      const minX = pad;
      const maxX = dragGeom.dockWidth - pillW - pad;
      let nx = dragOriginX + dx;
      if (nx < minX) nx = minX;
      if (nx > maxX) nx = maxX;
      pillX = nx;
      pill.style.transform = 'translateX(' + nx + 'px)';

      // Live preview: brighten whichever tile the pill center is closest to
      const nearest = nearestTo(nx + pillW / 2);
      tiles.forEach((t, i) => t.classList.toggle('active', i === nearest));
    });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      pill.classList.remove('dragging');
      try { dock.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!dragMoved) {
        // No real drag — restore pill under the previously-active tile.
        tiles.forEach((t, i) => t.classList.toggle('active', i === activeIdx));
        if (activeIdx >= 0) tiles[activeIdx].setAttribute('aria-current', 'page');
        placePill(activeIdx, true);
        return;
      }
      // Snap to nearest tile, navigate if changed. Reuse the drag snapshot.
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 400);
      const nearest = nearestTo(pillX + pillW / 2);
      const changed = nearest !== activeIdx;
      // Update aria-current on the new active tile
      tiles.forEach((t, i) => {
        t.classList.toggle('active', i === nearest);
        if (i === nearest) t.setAttribute('aria-current', 'page');
        else t.removeAttribute('aria-current');
      });
      activeIdx = nearest;
      placePill(nearest, true);
      if (changed) navigate(nearest);
    };

    dock.addEventListener('pointerup', endDrag);
    dock.addEventListener('pointercancel', endDrag);

    window.addEventListener('resize', () => placePill(activeIdx, false));
  }
})();

// ── Command palette / site search (⌘/ctrl+K) ────────────────────────────────
(function () {
  // INDEX is emitted by components/search.ts as a non-executed JSON data island
  // (<script type="application/json" id="search-index">). Reading it here keeps
  // this file fully static & cacheable while the per-build index stays in HTML.
  var INDEX = (function () {
    var el = document.getElementById('search-index');
    try { return el ? JSON.parse(el.textContent) : []; } catch (e) { return []; }
  })();
  var overlay = document.getElementById('search-overlay');
  if (!overlay) return;
  var input = overlay.querySelector('.search-input');
  var resultsEl = overlay.querySelector('.search-results');
  var emptyEl = overlay.querySelector('.search-empty');
  var box = overlay.querySelector('.search-box');

  var open = false;
  var selectedIdx = 0;
  var currentResults = [];
  // Coalesce keystroke-driven re-renders to one per frame, and skip the full
  // innerHTML rebuild entirely when the query hasn't changed.
  var renderRaf = 0;
  var lastRenderedQuery = null;

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    var lower = text.toLowerCase();
    var q = query.toLowerCase();
    var i = lower.indexOf(q);
    if (i < 0) return escapeHtml(text);
    return escapeHtml(text.slice(0, i))
      + '<mark>' + escapeHtml(text.slice(i, i + q.length)) + '</mark>'
      + escapeHtml(text.slice(i + q.length));
  }

  // Scoring: title prefix > title substring > desc/keyword substring > nothing.
  // Lower numbers rank higher.
  function score(item, q) {
    var t = item.title.toLowerCase();
    var d = (item.desc || '').toLowerCase();
    var k = (item.keywords || '').toLowerCase();
    if (t === q) return 0;
    var ti = t.indexOf(q);
    if (ti === 0) return 1;
    if (ti > 0) return 10 + ti;
    if (d.indexOf(q) >= 0) return 100 + d.indexOf(q);
    if (k.indexOf(q) >= 0) return 200 + k.indexOf(q);
    return -1;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) {
      // Empty query → show first 10 as a quick-nav menu.
      return INDEX.slice(0, 10).map(function (item) { return { item: item, s: 0 }; });
    }
    var out = [];
    for (var i = 0; i < INDEX.length; i++) {
      var s = score(INDEX[i], q);
      if (s >= 0) out.push({ item: INDEX[i], s: s });
    }
    out.sort(function (a, b) { return a.s - b.s; });
    return out.slice(0, 10);
  }

  // rAF-coalesced render: many input events within one frame collapse to a
  // single render(); identical queries are dropped without touching the DOM.
  function scheduleRender() {
    if (renderRaf) return;
    renderRaf = requestAnimationFrame(function () {
      renderRaf = 0;
      if (input.value.trim() === lastRenderedQuery) return;
      render();
    });
  }

  function render() {
    var q = input.value.trim();
    lastRenderedQuery = q;
    currentResults = search(q);
    if (currentResults.length === 0) {
      resultsEl.innerHTML = '';
      overlay.setAttribute('data-state', 'empty');
      emptyEl.textContent = 'No results for "' + q + '"';
      return;
    }
    overlay.setAttribute('data-state', 'results');
    var html = '';
    for (var i = 0; i < currentResults.length; i++) {
      var item = currentResults[i].item;
      html += '<a class="search-result' + (i === selectedIdx ? ' selected' : '') + '" '
        + 'href="' + item.href + '" data-idx="' + i + '">'
        + '<div class="titles">'
        + '<span class="title">' + highlight(item.title, q) + '</span>'
        + (item.desc ? '<span class="desc">' + highlight(item.desc, q) + '</span>' : '')
        + '</div>'
        + '<span class="group-tag">' + escapeHtml(item.group) + '</span>'
        + '</a>';
    }
    resultsEl.innerHTML = html;
    // Wire click — let normal anchor navigation handle the rest, but close
    // the overlay first so it isn't visible during the page-load flash.
    resultsEl.querySelectorAll('.search-result').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        selectedIdx = parseInt(el.dataset.idx, 10);
        updateSelection();
      });
    });
  }

  function updateSelection() {
    var items = resultsEl.querySelectorAll('.search-result');
    items.forEach(function (el, i) {
      el.classList.toggle('selected', i === selectedIdx);
    });
    // Keep the selected item in view when navigating with arrows.
    var active = items[selectedIdx];
    if (active) {
      var r = active.getBoundingClientRect();
      var pr = resultsEl.getBoundingClientRect();
      if (r.bottom > pr.bottom) resultsEl.scrollTop += r.bottom - pr.bottom;
      else if (r.top < pr.top) resultsEl.scrollTop -= pr.top - r.top;
    }
  }

  function openPalette() {
    if (open) return;
    open = true;
    overlay.hidden = false;
    selectedIdx = 0;
    input.value = '';
    render();
    // Let the browser commit the [hidden] removal before transitioning opacity.
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
      input.focus();
    });
  }

  function closePalette() {
    if (!open) return;
    open = false;
    overlay.classList.remove('visible');
    setTimeout(function () {
      if (!open) overlay.hidden = true;
    }, 160);
  }

  function activate(idx) {
    var hit = currentResults[idx];
    if (!hit) return;
    var href = hit.item.href;
    // Preserve ?theme= if the user is on a non-default theme.
    try {
      var current = new URL(window.location.href);
      var t = current.searchParams.get('theme');
      if (t) {
        var u = new URL(href, window.location.origin);
        if (!u.searchParams.has('theme')) u.searchParams.set('theme', t);
        href = u.pathname + (u.search || '') + (u.hash || '');
      }
    } catch (e) {}
    closePalette();
    window.location.href = href;
  }

  // Global hotkey: cmd/ctrl + K. Also Esc to close.
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      open ? closePalette() : openPalette();
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentResults.length) {
        selectedIdx = (selectedIdx + 1) % currentResults.length;
        updateSelection();
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentResults.length) {
        selectedIdx = (selectedIdx - 1 + currentResults.length) % currentResults.length;
        updateSelection();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      activate(selectedIdx);
    }
  });

  input.addEventListener('input', function () {
    selectedIdx = 0;
    scheduleRender();
  });

  // Click outside the box closes; clicks on .search-result navigate via href
  // but we intercept to keep theme + close behavior consistent.
  overlay.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('.search-result');
    if (card) {
      e.preventDefault();
      activate(parseInt(card.dataset.idx, 10));
      return;
    }
    if (!box.contains(e.target)) closePalette();
  });
})();

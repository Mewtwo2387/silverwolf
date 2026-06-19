/**
 * TCG card/item detail modal — clones <template> nodes from tcg-detail-modal.html.
 * Loaded on TCG pages that include tcgDetailModalShell() + tcgDetailAssets().
 */
import { formatBattleSide, formatItemKind, formatSkillCategory } from './tcg-labels.lib.js';

(() => {
  let catalogByValue = null;

  function $(id) {
    return document.getElementById(id);
  }

  function cloneTpl(id) {
    const t = $(id);
    return t ? t.content.cloneNode(true) : document.createDocumentFragment();
  }

  function setText(el, text) {
    if (el) el.textContent = text == null ? '' : String(text);
  }

  function setTextOrHide(el, text) {
    if (!el) return;
    if (text == null || text === '') {
      el.hidden = true;
      el.textContent = '';
    } else {
      el.hidden = false;
      el.textContent = String(text);
    }
  }

  // Per-element accent hue (deg) used to tint the modal chrome for characters.
  const ELEMENT_HUES = {
    Fairy: 320,
    Quantum: 265,
    Imaginary: 45,
    Physical: 215,
    Anemo: 160,
    Electro: 285,
    Cryo: 190,
    Pyro: 10,
    Geo: 40,
    Dendro: 120,
    Hydro: 205,
  };

  function backdrop() { return $('tcg-detail-backdrop'); }
  function bodyEl() { return $('tcg-detail-body'); }
  function titleEl() { return $('tcg-detail-title'); }
  function detailCard() { const bd = backdrop(); return bd ? bd.querySelector('.tcg-detail') : null; }

  function setHue(hue) {
    const card = detailCard();
    if (!card) return;
    if (hue == null) {
      card.classList.remove('has-el');
      card.style.removeProperty('--el');
    } else {
      card.style.setProperty('--el', String(hue));
      card.classList.add('has-el');
    }
  }

  function initDetailModal() {
    const bd = backdrop();
    const closeBtn = $('tcg-detail-close');
    if (!bd || bd.dataset.init) return;
    bd.dataset.init = '1';
    bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
    if (closeBtn) closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bd.classList.contains('open')) {
        e.stopImmediatePropagation();
        close();
      }
    }, true);
  }

  function close() {
    const bd = backdrop();
    if (!bd || !bd.classList.contains('open')) return false;
    bd.classList.remove('open');
    bd.setAttribute('aria-hidden', 'true');
    const body = bodyEl();
    if (body) body.replaceChildren();
    return true;
  }

  function open(title, contentRoot, hue) {
    initDetailModal();
    const bd = backdrop();
    const body = bodyEl();
    const h = titleEl();
    if (!bd || !body || !h) return;
    setHue(hue == null ? null : hue);
    setText(h, title);
    body.replaceChildren();
    body.appendChild(contentRoot);
    bd.classList.add('open');
    bd.setAttribute('aria-hidden', 'false');
  }

  function charArtUrl(slug) {
    return '/static/tcg/char/' + encodeURIComponent(slug) + '.png';
  }

  function itemArtUrl(id) {
    return '/static/tcg/item/' + encodeURIComponent(id) + '.png';
  }

  function buildLayout(artSrc, artAlt, fillMeta) {
    const frag = cloneTpl('tcg-tpl-detail-layout');
    const img = frag.querySelector('img');
    if (img) {
      img.src = artSrc;
      img.alt = artAlt;
    }
    const meta = frag.querySelector('.tcg-detail-meta');
    if (meta && fillMeta) fillMeta(meta);
    const wrap = document.createDocumentFragment();
    wrap.appendChild(frag);
    return wrap;
  }

  function buildListItem(name, meta, desc, reason, extraClass) {
    const frag = cloneTpl('tcg-tpl-list-item');
    const li = frag.querySelector('li');
    if (!li) return frag;
    if (extraClass) li.classList.add(...extraClass.trim().split(/\s+/));
    setText(li.querySelector('.li-name'), name);
    setTextOrHide(li.querySelector('.li-meta'), meta);
    setText(li.querySelector('.li-desc'), desc);
    const reasonEl = li.querySelector('.li-reason');
    if (reason) setText(reasonEl, reason);
    else if (reasonEl) reasonEl.remove();
    return li;
  }

  function buildEmptyMsg(text) {
    const frag = cloneTpl('tcg-tpl-empty-msg');
    setText(frag.querySelector('p'), text);
    return frag;
  }

  function buildSection(title, child) {
    const frag = cloneTpl('tcg-tpl-section');
    const sec = frag.querySelector('.tcg-detail-section');
    if (!sec) return frag;
    setText(sec.querySelector('h3'), title);
    if (child) sec.appendChild(child);
    return sec;
  }

  function buildSkillList(skills, live) {
    if (!skills || !skills.length) return buildEmptyMsg('No skills.').firstElementChild;
    const ul = document.createElement('ul');
    ul.className = 'tcg-detail-list';
    for (const sk of skills) {
      const meta = [formatSkillCategory(sk.category), sk.damageText && sk.damageText !== '--' ? sk.damageText : '']
        .filter(Boolean).join(' · ');
      const reason = (live && sk.reason && !sk.available) ? sk.reason : null;
      ul.appendChild(buildListItem(sk.name, meta, sk.description, reason));
    }
    return ul;
  }

  function buildEffectList(effects) {
    if (!effects || !effects.length) return buildEmptyMsg('No active effects.').firstElementChild;
    const ul = document.createElement('ul');
    ul.className = 'tcg-detail-list';
    for (const e of effects) {
      const dur = e.duration >= 999 ? 'permanent' : (e.duration + ' turn(s)');
      const cls = e.positive ? 'buff' : 'debuff';
      ul.appendChild(buildListItem(e.name, dur, e.description, null, 'tcg-detail-eff ' + cls));
    }
    return ul;
  }

  function appendStatRow(meta, pairs) {
    const row = document.createElement('div');
    row.className = 'tcg-detail-stats';
    for (const [label, value, danger] of pairs) {
      const span = document.createElement('span');
      if (danger) span.style.color = 'var(--danger)';
      span.appendChild(document.createTextNode(label + ' '));
      const b = document.createElement('b');
      b.textContent = String(value);
      span.appendChild(b);
      row.appendChild(span);
    }
    meta.appendChild(row);
  }

  function appendSubtitle(meta, text) {
    if (!text) return;
    const p = document.createElement('p');
    p.className = 'tcg-detail-subtitle';
    p.textContent = text;
    meta.appendChild(p);
  }

  function appendDesc(meta, text) {
    const p = document.createElement('p');
    p.className = 'tcg-detail-desc';
    p.textContent = text;
    meta.appendChild(p);
  }

  function appendAction(meta, label, onClick, id) {
    const frag = cloneTpl('tcg-tpl-action-btn');
    const btn = frag.querySelector('button');
    if (!btn) return;
    btn.textContent = label;
    if (id) btn.id = id;
    btn.addEventListener('click', onClick);
    meta.appendChild(frag);
  }

  function showCatalogCharacter(value) {
    const ch = catalogByValue && catalogByValue[value];
    if (!ch) return;
    const content = buildLayout(charArtUrl(ch.slug), ch.name, (meta) => {
      appendSubtitle(meta, ch.title);
      appendDesc(meta, ch.description);
      appendStatRow(meta, [['HP', ch.hp], ['Element', ch.element]]);
      meta.appendChild(buildSection('Skills', buildSkillList(ch.skills, false)));
      if (ch.abilities && ch.abilities.length) {
        const ul = document.createElement('ul');
        ul.className = 'tcg-detail-list';
        for (const a of ch.abilities) {
          ul.appendChild(buildListItem(a.name, null, a.description));
        }
        meta.appendChild(buildSection('Abilities', ul));
      }
    });
    const hue = ELEMENT_HUES[ch.element];
    open(ch.name, content, typeof hue === 'number' ? hue : null);
  }

  function showCatalogItem(item) {
    const kind = formatItemKind(item.kind);
    const stars = '★'.repeat(item.rarity || 0);
    const content = buildLayout(itemArtUrl(item.id), item.name, (meta) => {
      appendSubtitle(meta, kind + ' · ' + stars);
      appendDesc(meta, item.description);
    });
    open(item.name, content);
  }

  function showBattleCharacter(ch, side, opts) {
    opts = opts || {};
    const content = buildLayout(charArtUrl(ch.slug), ch.name, (meta) => {
      const pairs = [
        ['Side', formatBattleSide(side)],
        ['Slot', ch.slot],
        ['HP', ch.currentHp + '/' + ch.maxHp],
        ['Energy', ch.energy],
      ];
      if (ch.isKnockedOut) pairs.push(['', 'KO', true]);
      appendStatRow(meta, pairs);
      const equips = ch.equipments || [];
      if (equips.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'tcg-detail-list';
        for (const eq of equips) {
          const li = buildListItem(eq.name, formatItemKind(eq.kind), eq.description);
          li.classList.add('tcg-detail-clickable');
          li.setAttribute('role', 'button');
          li.tabIndex = 0;
          li.title = 'View ' + eq.name;
          const openIt = () => showBattleItem(eq, {});
          li.addEventListener('click', openIt);
          li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openIt(); }
          });
          ul.appendChild(li);
        }
        meta.appendChild(buildSection('Equipment (' + equips.length + ')', ul));
      }
      meta.appendChild(buildSection('Status Effects', buildEffectList(ch.effects)));
      meta.appendChild(buildSection('Skills', buildSkillList(ch.skills, true)));
      if (opts.onFocus) {
        appendAction(meta, '[ focus skills ]', () => {
          close();
          opts.onFocus(ch.slot);
        });
      }
    });
    open(ch.name, content);
  }

  function showBattleItem(card, opts) {
    opts = opts || {};
    const kind = formatItemKind(card.kind);
    const content = buildLayout(itemArtUrl(card.id), card.name, (meta) => {
      appendSubtitle(meta, kind);
      appendDesc(meta, card.description);
      if (opts.onPlay) {
        appendAction(meta, '[ play item ]', () => {
          close();
          opts.onPlay(card.slotId);
        }, 'tcg-detail-play-item');
      }
    });
    open(card.name, content);
  }

  function init(catalog) {
    catalogByValue = catalog ? Object.fromEntries(catalog.map((c) => [c.value, c])) : null;
    initDetailModal();
  }

  const api = {
    init,
    close,
    showCatalogCharacter,
    showCatalogItem,
    showBattleCharacter,
    showBattleItem,
  };

  globalThis.TcgDetail = api;

  document.addEventListener('DOMContentLoaded', () => {
    if (!backdrop()) return;
    let catalog = null;
    const dataEl = $('tcg-detail-data');
    if (dataEl) {
      try {
        const parsed = JSON.parse(dataEl.textContent);
        catalog = parsed && parsed.catalog ? parsed.catalog : null;
      } catch (e) { /* ignore */ }
    }
    init(catalog);
  });
})();

import { html, raw } from 'hono/html';
import { Layout } from '../../components/layout';
import type { NavUser } from '../../components/navbar';
import { inlineJSON } from '../../inline';

export function DinonuggieUpgradesPage(opts: { nonce: string; lv999?: boolean; user?: NavUser | null }) {
  const { nonce, lv999, user } = opts;
  const csrfJSON = inlineJSON(user?.csrf ?? '');
  const loggedOut = !user;

  const extras = raw(`
<style>
  .dnu-wrap { display: flex; flex-direction: column; gap: 2rem; margin-top: 1rem; }
  .dnu-section {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    padding: 1.25rem 1.5rem;
  }
  .dnu-section h2 {
    margin: 0 0 1rem 0;
    color: var(--accent-light);
    font-size: 1.2rem;
    font-weight: bold;
    border-bottom: 1px solid var(--ink-600);
    padding-bottom: 0.5rem;
  }
  .dnu-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 2rem;
    font-size: 0.9rem;
    color: var(--fog-200);
    margin-bottom: 1rem;
  }
  .dnu-stats .stat-label { color: var(--fog-300); margin-right: 0.4rem; }
  .dnu-stats .stat-val { color: var(--accent-light); font-weight: bold; }

  /* Eat */
  .eat-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .eat-row img.dino {
    width: 96px;
    height: 96px;
    object-fit: contain;
  }
  .eat-row input[type=number] {
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    color: var(--fog-100);
    padding: 0.45rem 0.6rem;
    border-radius: 4px;
    width: 8rem;
    font-family: inherit;
  }
  .eat-status {
    margin-top: 1rem;
    padding: 0.8rem 1rem;
    border-radius: 0.5rem;
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    color: var(--fog-200);
    min-height: 2.5rem;
    font-size: 0.9rem;
    white-space: pre-wrap;
  }

  /* Upgrades */
  .upgrade-card {
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 0.9rem;
  }
  .upgrade-card.locked { opacity: 0.55; }
  .upgrade-card h3 {
    margin: 0 0 0.5rem 0;
    color: var(--accent-light);
    font-size: 1rem;
    font-weight: bold;
  }
  .upgrade-card .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.4rem 1rem;
    font-size: 0.85rem;
    color: var(--fog-200);
    margin-bottom: 0.7rem;
  }
  .upgrade-card .stats-grid .k { color: var(--fog-300); }
  .upgrade-card .stats-grid .v { color: var(--fog-100); font-weight: 600; }
  .checkout-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .qty {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--ink-600);
    border-radius: 4px;
    overflow: hidden;
  }
  .qty button {
    background: var(--ink-700, #1e2030);
    color: var(--fog-100);
    border: none;
    width: 2rem;
    cursor: pointer;
    font-weight: bold;
  }
  .qty button:hover { background: var(--ink-600); }
  .qty input {
    background: var(--ink-900);
    border: none;
    color: var(--fog-100);
    width: 4rem;
    text-align: center;
    font-family: inherit;
  }
  .qty input::-webkit-outer-spin-button,
  .qty input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .total-line {
    margin-left: auto;
    color: var(--fog-200);
    font-size: 0.9rem;
  }
  .total-line .amt { color: var(--accent-light); font-weight: bold; }

  .ascend-box {
    background: var(--ink-900);
    border: 1px dashed var(--accent);
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1rem;
  }
  .ascend-box h3 {
    margin: 0 0 0.6rem 0;
    color: var(--accent-light);
    font-size: 1rem;
  }
  .ascend-box ul {
    margin: 0 0 0.7rem 1.2rem;
    padding: 0;
    color: var(--fog-200);
    font-size: 0.85rem;
  }
  .ascend-box .status {
    margin: 0.5rem 0;
    color: var(--fog-200);
    font-size: 0.9rem;
  }
  .ascend-box .status.ok { color: #83F28F; }
  .ascend-box .status.warn { color: #FFA500; }

  .toast {
    margin-top: 0.8rem;
    padding: 0.6rem 0.9rem;
    border-radius: 0.4rem;
    font-size: 0.85rem;
    background: var(--ink-900);
    border: 1px solid var(--ink-600);
    color: var(--fog-200);
    min-height: 1.2rem;
  }
  .toast.error { color: #FF6666; border-color: #803030; }
  .toast.ok { color: #83F28F; border-color: #2c6c3a; }
  .toast.warn { color: #FFA500; border-color: #8a5a1c; }

  .login-cta {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    padding: 1.5rem 2rem;
    text-align: center;
    color: var(--fog-200);
  }
  .login-cta a { color: var(--accent-light); font-weight: bold; text-decoration: none; }
  .login-cta a:hover { color: var(--accent); }
</style>
`);

  const script = loggedOut ? '' : raw(`
<script nonce="${nonce}">
(() => {
  const csrf = ${csrfJSON};

  function format(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return String(n);
    if (Math.abs(n) >= 1e6) {
      const units = ['K','M','B','T','Qa','Qi','Sx','Sp','Oc','No'];
      const mag = Math.floor(Math.log10(Math.abs(n)));
      const idx = Math.floor(mag / 3) - 1;
      const u = units[idx] || 'e' + (idx*3+3);
      return (n / Math.pow(10, (idx+1)*3)).toFixed(3) + u;
    }
    return Math.round(n * 100) / 100 === Math.round(n)
      ? Math.round(n).toLocaleString()
      : Number(n.toFixed(2)).toLocaleString();
  }
  function pct(n) { return format(n * 100) + '%'; }

  function getMultiplierAmount(level) {
    return {
      bronze: 1.4 + 0.1 * level,
      silver: 1.8 + 0.2 * level,
      gold:   2.6 + 0.4 * level,
    };
  }
  function getMultiplierChance(level) {
    let gold = 0.025 + 0.005 * level;
    let silver = 0.05 + 0.01 * level;
    let bronze = 0.1 + 0.02 * level;
    if (gold > 1) { gold = 1; silver = 0; bronze = 0; }
    else if (gold + silver > 1) { silver = 1 - gold; bronze = 0; }
    else if (gold + silver + bronze > 1) { bronze = 1 - gold - silver; }
    return { gold, silver, bronze };
  }
  function getBekiCooldown(level) {
    if (level <= 30) return 24 * Math.pow(0.25, (level - 1) / 29);
    if (level <= 40) return 6 * Math.pow(4/6, (level - 30) / 10);
    if (level <= 50) return 4 * Math.pow(3/4, (level - 40) / 10);
    return 3 * Math.pow(2/3, (level - 50) / 50);
  }
  function getNextUpgradeCost(level) {
    if (level < 10) return 5000 * level;
    if (level < 20) return 500 * level * level;
    if (level < 30) return 25 * level * level * level;
    return Math.floor(1000000 * Math.pow(10, (level - 30) / 10));
  }
  function getNextAscensionUpgradeCost(level, amplifier) {
    return amplifier * 500 * level * level;
  }
  function totalUpgradeCost(level, amount) {
    let c = 0;
    for (let i = 0; i < amount; i++) c += getNextUpgradeCost(level + i);
    return c;
  }
  function totalAscensionCost(level, amount, amplifier) {
    let c = 0;
    for (let i = 0; i < amount; i++) c += getNextAscensionUpgradeCost(level + i, amplifier);
    return c;
  }
  function ascensionMultiplierLabel(key, level) {
    switch (key) {
      case 'nuggieFlatMultiplier':
        return format(level) + 'x flat';
      case 'nuggieStreakMultiplier':
        return pct(0.01 * (level - 1)) + '/day';
      case 'nuggieCreditsMultiplier':
        return '+' + pct(0.01 * (level - 1)) + ' * log2(credits)';
      case 'nuggiePokeMultiplier':
        return '+' + pct(0.01 * (level - 1)) + '/pokemon';
      case 'nuggieNuggieMultiplier':
        return '+' + pct(0.01 * (level - 1)) + ' * log2(nuggies)';
      default: return '';
    }
  }
  const ASC_TITLES = {
    nuggieFlatMultiplier: 'Nuggie Flat Multiplier',
    nuggieStreakMultiplier: 'Nuggie Streak Multiplier',
    nuggieCreditsMultiplier: 'Nuggie Credits Multiplier',
    nuggiePokeMultiplier: 'Nuggie Poke Multiplier',
    nuggieNuggieMultiplier: 'Nuggie Nuggie Multiplier',
  };
  const ASC_DESCS = {
    nuggieFlatMultiplier: 'Applies a flat multiplier to all claims.',
    nuggieStreakMultiplier: 'Multiplier per day of your streak.',
    nuggieCreditsMultiplier: 'Multiplier scaling with log2(credits).',
    nuggiePokeMultiplier: 'Multiplier per unique pokemon you own.',
    nuggieNuggieMultiplier: 'Multiplier scaling with log2(dinonuggies).',
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  async function api(path, body) {
    let r;
    try {
      r = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ csrf }, body || {})),
      });
    } catch (_e) {
      return { error: 'network' };
    }
    let parsed = null;
    try {
      parsed = await r.json();
    } catch (_e) {
      if (!r.ok) return { error: r.statusText || 'Request failed' };
      return { error: 'invalid_response' };
    }
    if (!r.ok) {
      return { error: (parsed && parsed.error) || r.statusText || 'Request failed' };
    }
    return parsed;
  }
  function errMsg(code) {
    const map = {
      unauthenticated: 'You must log in.',
      csrf: 'Session expired, refresh the page.',
      invalid: 'Invalid request.',
      invalid_body: 'Invalid request body.',
      server: 'Server error, try again.',
    };
    return map[code] || ('Error: ' + code);
  }

  let STATE = null;

  function renderEatStats() {
    const el = document.getElementById('eat-stats');
    if (!el || !STATE) return;
    el.innerHTML =
      '<div><span class="stat-label">Dinonuggies:</span><span class="stat-val">' + format(STATE.dinonuggies) + '</span></div>' +
      '<div><span class="stat-label">Mystic Credits:</span><span class="stat-val">' + format(STATE.credits) + '</span></div>';
  }

  function renderUpgrades() {
    if (!STATE) return;
    document.getElementById('upgrade-credits').textContent = format(STATE.credits);
    const container = document.getElementById('upgrades-list');
    container.innerHTML = '';
    for (const u of STATE.upgrades) {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      const maxed = u.level >= u.maxLevel;
      const initialAmt = maxed ? 0 : 1;
      let statsHTML = '';
      const next = Math.min(u.level + 1, u.maxLevel);
      if (u.key === 'multiplierAmount') {
        const cur = getMultiplierAmount(u.level);
        const nxt = getMultiplierAmount(next);
        statsHTML =
          '<div><span class="k">Gold:</span> <span class="v">' + format(cur.gold) + 'x → ' + format(nxt.gold) + 'x</span></div>' +
          '<div><span class="k">Silver:</span> <span class="v">' + format(cur.silver) + 'x → ' + format(nxt.silver) + 'x</span></div>' +
          '<div><span class="k">Bronze:</span> <span class="v">' + format(cur.bronze) + 'x → ' + format(nxt.bronze) + 'x</span></div>';
      } else if (u.key === 'multiplierRarity') {
        const cur = getMultiplierChance(u.level);
        const nxt = getMultiplierChance(next);
        statsHTML =
          '<div><span class="k">Gold:</span> <span class="v">' + pct(cur.gold) + ' → ' + pct(nxt.gold) + '</span></div>' +
          '<div><span class="k">Silver:</span> <span class="v">' + pct(cur.silver) + ' → ' + pct(nxt.silver) + '</span></div>' +
          '<div><span class="k">Bronze:</span> <span class="v">' + pct(cur.bronze) + ' → ' + pct(nxt.bronze) + '</span></div>';
      } else if (u.key === 'beki') {
        statsHTML = '<div><span class="k">Cooldown:</span> <span class="v">' + format(getBekiCooldown(u.level)) + 'h → ' + format(getBekiCooldown(next)) + 'h</span></div>';
      }
      const titleMap = {
        multiplierAmount: 'Multiplier Amount Upgrade',
        multiplierRarity: 'Multiplier Rarity Upgrade',
        beki: 'Beki Cooldown Upgrade',
      };
      card.innerHTML =
        '<h3>' + titleMap[u.key] + ' (Lv ' + u.level + '/' + u.maxLevel + ')</h3>' +
        '<div class="stats-grid">' + statsHTML + '</div>' +
        (maxed
          ? '<div class="status warn">Maxed at this ascension level.</div>'
          : ('<div class="checkout-row">' +
              '<span class="qty">' +
                '<button type="button" data-qstep="-1">−</button>' +
                '<input type="number" min="1" value="1" data-qty />' +
                '<button type="button" data-qstep="1">+</button>' +
              '</span>' +
              '<span class="total-line">Total: <span class="amt" data-total>' + format(getNextUpgradeCost(u.level)) + '</span> credits</span>' +
              '<button class="btn-accent btn-sm" data-buy="' + u.upgradeId + '">Buy</button>' +
            '</div>')) +
        '<div class="toast" data-toast></div>';
      container.appendChild(card);

      if (!maxed) {
        const qtyInput = card.querySelector('[data-qty]');
        const totalEl = card.querySelector('[data-total]');
        function refresh() {
          let v = parseInt(qtyInput.value, 10);
          if (!Number.isFinite(v) || v < 1) v = 1;
          const cap = u.maxLevel - u.level;
          if (v > cap) v = cap;
          qtyInput.value = String(v);
          totalEl.textContent = format(totalUpgradeCost(u.level, v));
        }
        card.querySelectorAll('[data-qstep]').forEach(b => {
          b.addEventListener('click', () => {
            qtyInput.value = String((parseInt(qtyInput.value, 10) || 1) + parseInt(b.dataset.qstep, 10));
            refresh();
          });
        });
        qtyInput.addEventListener('input', refresh);
        const buyBtn = card.querySelector('[data-buy]');
        const toast = card.querySelector('[data-toast]');
        buyBtn.addEventListener('click', async () => {
          buyBtn.disabled = true;
          toast.className = 'toast';
          toast.textContent = 'Buying...';
          const amt = parseInt(qtyInput.value, 10) || 1;
          const res = await api('/games/dinonuggie-upgrades/buy-upgrade', { upgradeId: u.upgradeId, amount: amt });
          if (res.error) {
            toast.className = 'toast error';
            toast.textContent = errMsg(res.error);
            buyBtn.disabled = false;
            return;
          }
          const d = res.data;
          if (d.status === 'success') {
            toast.className = 'toast ok';
            toast.textContent = 'Bought ' + d.amount + ' level(s) for ' + format(d.cost) + ' credits.';
            await refreshState();
          } else if (d.status === 'maxed') {
            toast.className = 'toast warn';
            toast.textContent = 'Already maxed.';
          } else if (d.status === 'too_many') {
            toast.className = 'toast error';
            toast.textContent = 'Cap is ' + d.maxLevel + ', you are at ' + d.level + '. Reduce amount.';
          } else if (d.status === 'poor') {
            toast.className = 'toast error';
            toast.textContent = 'Not enough credits. Need ' + format(d.cost) + ', have ' + format(d.credits) + '.';
          } else {
            toast.className = 'toast error';
            toast.textContent = 'Unable to buy: ' + d.status;
          }
          buyBtn.disabled = false;
        });
      }
    }
  }

  function renderAscension() {
    if (!STATE) return;
    const a = STATE.ascension;
    document.getElementById('asc-heavenly').textContent = format(STATE.heavenlyNuggies);
    document.getElementById('asc-level').textContent = STATE.ascensionLevel;
    const list = document.getElementById('ascension-list');
    list.innerHTML = '';
    for (const row of a.rows) {
      const card = document.createElement('div');
      card.className = 'upgrade-card' + (row.unlocked ? '' : ' locked');
      const desc = ASC_DESCS[row.key];
      const cur = ascensionMultiplierLabel(row.key, row.level);
      const nxt = ascensionMultiplierLabel(row.key, row.level + 1);
      const lockedNote = row.unlocked ? '' : '<div class="status warn">Unlocks at ascension ' + row.required + '.</div>';
      card.innerHTML =
        '<h3>' + ASC_TITLES[row.key] + ' (Lv ' + row.level + ')</h3>' +
        '<div class="stats-grid">' +
          '<div><span class="k">Effect:</span> <span class="v">' + escapeHtml(cur) + ' → ' + escapeHtml(nxt) + '</span></div>' +
          '<div><span class="k">' + escapeHtml(desc) + '</span></div>' +
        '</div>' +
        lockedNote +
        (row.unlocked
          ? ('<div class="checkout-row">' +
              '<span class="qty">' +
                '<button type="button" data-qstep="-1">−</button>' +
                '<input type="number" min="1" value="1" data-qty />' +
                '<button type="button" data-qstep="1">+</button>' +
              '</span>' +
              '<span class="total-line">Total: <span class="amt" data-total>' + format(row.nextCost) + '</span> heavenly nuggies</span>' +
              '<button class="btn-accent btn-sm" data-buy="' + row.upgradeId + '">Buy</button>' +
            '</div>')
          : '') +
        '<div class="toast" data-toast></div>';
      list.appendChild(card);

      if (row.unlocked) {
        const qtyInput = card.querySelector('[data-qty]');
        const totalEl = card.querySelector('[data-total]');
        function refresh() {
          let v = parseInt(qtyInput.value, 10);
          if (!Number.isFinite(v) || v < 1) v = 1;
          qtyInput.value = String(v);
          totalEl.textContent = format(totalAscensionCost(row.level, v, row.amplifier));
        }
        card.querySelectorAll('[data-qstep]').forEach(b => {
          b.addEventListener('click', () => {
            qtyInput.value = String((parseInt(qtyInput.value, 10) || 1) + parseInt(b.dataset.qstep, 10));
            refresh();
          });
        });
        qtyInput.addEventListener('input', refresh);
        const buyBtn = card.querySelector('[data-buy]');
        const toast = card.querySelector('[data-toast]');
        buyBtn.addEventListener('click', async () => {
          buyBtn.disabled = true;
          toast.className = 'toast';
          toast.textContent = 'Buying...';
          const amt = parseInt(qtyInput.value, 10) || 1;
          const res = await api('/games/dinonuggie-upgrades/buy-ascension', { upgradeId: row.upgradeId, amount: amt });
          if (res.error) {
            toast.className = 'toast error';
            toast.textContent = errMsg(res.error);
            buyBtn.disabled = false;
            return;
          }
          const d = res.data;
          if (d.status === 'success') {
            toast.className = 'toast ok';
            toast.textContent = 'Bought ' + d.amount + ' level(s) for ' + format(d.cost) + ' heavenly nuggies.';
            await refreshState();
          } else if (d.status === 'locked') {
            toast.className = 'toast warn';
            toast.textContent = 'Need ascension ' + d.required + ' to buy.';
          } else if (d.status === 'poor') {
            toast.className = 'toast error';
            toast.textContent = 'Not enough heavenly nuggies. Need ' + format(d.cost) + ', have ' + format(d.heavenlyNuggies) + '.';
          } else {
            toast.className = 'toast error';
            toast.textContent = 'Unable to buy: ' + d.status;
          }
          buyBtn.disabled = false;
        });
      }
    }

    const ascState = a.state;
    const ascendBox = document.getElementById('ascend-box');
    const ascendBtn = document.getElementById('ascend-btn');
    const ascendStatus = document.getElementById('ascend-status');
    document.getElementById('ascend-current-nuggies').textContent = format(ascState.dinonuggies);
    document.getElementById('ascend-mam').textContent = ascState.multiplierAmountLevel + '/' + ascState.currentMaxLevel;
    document.getElementById('ascend-mrm').textContent = ascState.multiplierRarityLevel + '/' + ascState.currentMaxLevel;
    document.getElementById('ascend-bk').textContent = ascState.bekiLevel + '/' + ascState.currentMaxLevel;
    if (!ascState.canAscend) {
      ascendStatus.className = 'status warn';
      ascendStatus.textContent = 'You need at least 500 dinonuggies to ascend (you have ' + format(ascState.dinonuggies) + ').';
      ascendBtn.disabled = true;
    } else if (ascState.allMaxed) {
      ascendStatus.className = 'status ok';
      ascendStatus.textContent = 'All upgrades maxed — ascension level will increase from ' + ascState.ascensionLevel + ' to ' + (ascState.ascensionLevel + 1) + ' (new max level: ' + ascState.nextMaxLevel + ').';
      ascendBtn.disabled = false;
    } else {
      ascendStatus.className = 'status';
      ascendStatus.textContent = 'You can ascend, but ascension level will stay at ' + ascState.ascensionLevel + ' (not all upgrades maxed).';
      ascendBtn.disabled = false;
    }
  }

  async function refreshState() {
    const res = await api('/games/dinonuggie-upgrades/state', {});
    if (res.error) return;
    STATE = res.data;
    renderEatStats();
    renderUpgrades();
    renderAscension();
  }

  function renderEatItem(item) {
    switch (item.type) {
      case 'mystic_small': return 'You found a hidden mystichunterzium nugget! +' + format(item.earned) + ' mystic credits.';
      case 'mystic_huge':  return 'You found a HUGE mystichunterzium nugget! +' + format(item.earned) + ' mystic credits.';
      case 'choke':        return 'You choked on the dinonuggie and died.';
      case 'extra2':       return "You found 2 extra dinonuggies inside!";
      case 'extra5':       return 'You found 5 extra dinonuggies inside! Uhmmm what?';
      case 'nom':
      default:             return 'nom nom nom';
    }
  }

  function bindEat() {
    const btn = document.getElementById('eat-btn');
    const input = document.getElementById('eat-amount');
    const out = document.getElementById('eat-status');
    btn.addEventListener('click', async () => {
      const amt = parseInt(input.value, 10) || 1;
      btn.disabled = true;
      out.textContent = 'Eating...';
      out.className = 'eat-status';
      const res = await api('/games/dinonuggie-upgrades/eat', { amount: amt });
      if (res.error) {
        out.textContent = errMsg(res.error);
        btn.disabled = false;
        return;
      }
      const d = res.data;
      if (d.status === 'not_enough') {
        out.textContent = "smh you don't have enough dinonuggies to eat. (have " + format(d.dinonuggies) + ", need " + format(d.amount) + ")";
      } else if (d.status === 'cheat') {
        out.textContent = "Nice try, cheater. Negative amounts are not allowed.";
      } else if (d.status === 'single') {
        out.textContent = renderEatItem(d.item);
      } else if (d.status === 'batch') {
        let lines = d.items.map(it => '• ' + renderEatItem(it)).join('\\n');
        if (d.remainingLost > 0) lines += '\\n\\nYou lost the remaining ' + d.remainingLost + ' dinonuggies.';
        if (d.totalEarned > 0) lines += '\\nTotal mystic credits earned: ' + format(d.totalEarned) + '.';
        if (d.totalNuggiesEarned > 0) lines += '\\nTotal extra dinonuggies: ' + d.totalNuggiesEarned + '.';
        out.textContent = lines;
      }
      await refreshState();
      btn.disabled = false;
    });
  }

  function bindAscend() {
    const btn = document.getElementById('ascend-btn');
    const out = document.getElementById('ascend-toast');
    btn.addEventListener('click', async () => {
      if (!confirm('Ascend now? This resets all upgrades, credits, bitcoins, dinonuggies, and streak in exchange for heavenly nuggies.')) return;
      btn.disabled = true;
      out.className = 'toast';
      out.textContent = 'Ascending...';
      const res = await api('/games/dinonuggie-upgrades/ascend', {});
      if (res.error) {
        out.className = 'toast error';
        out.textContent = errMsg(res.error);
        btn.disabled = false;
        return;
      }
      const d = res.data;
      if (d.status === 'too_few') {
        out.className = 'toast warn';
        out.textContent = 'You need at least 500 dinonuggies. You have ' + format(d.dinonuggies) + '.';
      } else if (d.status === 'success') {
        out.className = 'toast ok';
        out.textContent = 'Ascended! Gained ' + format(d.gained) + ' heavenly nuggies. Ascension level: ' + d.ascensionLevel + '. New max upgrade level: ' + d.newMaxLevel + '.';
        await refreshState();
      }
      btn.disabled = false;
    });
  }

  bindEat();
  bindAscend();
  refreshState();
})();
</script>
`);

  const body = html`
    <h1 class="text-center">Dinonuggie Upgrades</h1>
    <p class="text-center text-fog-300 mb-4">a hub for eating and upgrading</p>

    ${loggedOut
    ? html`<div class="login-cta">Log in with <a href="/auth/discord/login">Discord</a> to eat and upgrade.</div>`
    : html`
      <div class="dnu-wrap">
        <div class="dnu-section">
          <h2>Eat</h2>
          <div class="dnu-stats" id="eat-stats"></div>
          <div class="eat-row">
            <img class="dino" src="/static/game-dinonuggie.webp" alt="dinonuggie" />
            <input id="eat-amount" type="number" min="1" value="1" />
            <button id="eat-btn" class="btn-accent btn-sm" type="button">Eat</button>
          </div>
          <div id="eat-status" class="eat-status">Press eat to munch on a dinonuggie.</div>
        </div>

        <div class="dnu-section">
          <h2>Upgrades</h2>
          <div class="dnu-stats">
            <div><span class="stat-label">Mystic Credits:</span><span class="stat-val" id="upgrade-credits">…</span></div>
          </div>
          <div id="upgrades-list"></div>
        </div>

        <div class="dnu-section">
          <h2>Ascension</h2>
          <div class="dnu-stats">
            <div><span class="stat-label">Heavenly Nuggies:</span><span class="stat-val" id="asc-heavenly">…</span></div>
            <div><span class="stat-label">Ascension Level:</span><span class="stat-val" id="asc-level">…</span></div>
          </div>
          <div id="ascension-list"></div>
          <div class="ascend-box" id="ascend-box">
            <h3>Ascend</h3>
            <ul>
              <li>Convert all your dinonuggies into the same number of heavenly nuggies.</li>
              <li>Resets upgrades, credits, bitcoins, dinonuggies, and streak.</li>
              <li>If all 3 upgrades are maxed, your ascension level increases by 1 (raising the upgrade cap by 10).</li>
            </ul>
            <div>Current dinonuggies: <span id="ascend-current-nuggies">…</span></div>
            <div>Multiplier amount: <span id="ascend-mam">…</span></div>
            <div>Multiplier rarity: <span id="ascend-mrm">…</span></div>
            <div>Beki cooldown: <span id="ascend-bk">…</span></div>
            <div id="ascend-status" class="status"></div>
            <button id="ascend-btn" class="btn-accent btn-sm" type="button" disabled>Ascend</button>
            <div id="ascend-toast" class="toast"></div>
          </div>
        </div>
      </div>
    `}

    ${extras}
    ${loggedOut ? '' : script}
  `;

  return Layout({
    title: 'Silverwolf — Dinonuggie Upgrades',
    active: 'games',
    body: body as any,
    nonce,
    lv999,
    user,
  });
}

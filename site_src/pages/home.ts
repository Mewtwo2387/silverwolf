import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';
import type { NavUser } from '../components/navbar';

export interface DashboardProfile {
  discordId: string;
  username: string;
  avatarURL: string | null;
  credits: number;
  dinonuggies: number;
  bitcoin: number;
  murderSuccess: number;
  murderFail: number;
  blackjackNetWinnings: number;
  rouletteNetWinnings: number;
  slotsNetWinnings: number;
  birthday: string | null;
}

const styles = raw(`
<style>
  .me-header {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem 1.5rem;
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .me-header img {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 2px solid var(--accent);
  }
  .me-header h1 {
    font-size: 1.4rem;
    margin: 0;
    color: var(--fog-100);
  }
  .me-header .me-id {
    font-size: 0.8rem;
    color: var(--fog-300);
    font-family: monospace;
  }
  .me-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }
  .me-card {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    padding: 1rem 1.1rem;
  }
  .me-card .label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fog-300);
    margin-bottom: 0.35rem;
  }
  .me-card .value {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--accent-light);
  }
  .me-card .value.neg { color: #f87171; }
  .me-card .value.pos { color: #4ade80; }
  .me-section-label {
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fog-200);
    margin: 2rem 0 0.75rem;
  }
  .me-section-label:first-of-type { margin-top: 0; }
</style>
`);

function fmt(n: number): string { return n.toLocaleString('en-US'); }

function signed(n: number): { value: string; cls: string } {
  if (n > 0) return { value: `+${fmt(n)}`, cls: 'pos' };
  if (n < 0) return { value: fmt(n), cls: 'neg' };
  return { value: '0', cls: '' };
}

export function HomePage(opts: {
  profile: DashboardProfile;
  user: NavUser;
  nonce: string;
  lv999?: boolean;
}) {
  const { profile } = opts;
  const bj = signed(profile.blackjackNetWinnings);
  const rl = signed(profile.rouletteNetWinnings);
  const sl = signed(profile.slotsNetWinnings);

  const body = html`
    ${styles}
    <div class="me-header">
      ${profile.avatarURL ? html`<img src="${profile.avatarURL}" alt="${profile.username}" />` : ''}
      <div>
        <h1>@${profile.username}</h1>
        <div class="me-id">${profile.discordId}</div>
      </div>
    </div>

    <h2 class="me-section-label">Wallet</h2>
    <div class="me-grid">
      <div class="me-card"><div class="label">Credits</div><div class="value">${fmt(profile.credits)}</div></div>
      <div class="me-card"><div class="label">Dinonuggies</div><div class="value">${fmt(profile.dinonuggies)}</div></div>
      <div class="me-card"><div class="label">Bitcoin</div><div class="value">${profile.bitcoin.toFixed(4)}</div></div>
    </div>

    <h2 class="me-section-label">Gambling P/L</h2>
    <div class="me-grid">
      <div class="me-card"><div class="label">Blackjack</div><div class="value ${bj.cls}">${bj.value}</div></div>
      <div class="me-card"><div class="label">Roulette</div><div class="value ${rl.cls}">${rl.value}</div></div>
      <div class="me-card"><div class="label">Slots</div><div class="value ${sl.cls}">${sl.value}</div></div>
    </div>

    <h2 class="me-section-label">Other</h2>
    <div class="me-grid">
      <div class="me-card"><div class="label">Murders</div><div class="value">${fmt(profile.murderSuccess)} / ${fmt(profile.murderSuccess + profile.murderFail)}</div></div>
      <div class="me-card"><div class="label">Birthday</div><div class="value" style="font-size:1rem;">${profile.birthday ?? '—'}</div></div>
    </div>
  `;

  return Layout({
    title: `Silverwolf — @${profile.username}`,
    active: 'home',
    body: body as unknown as HtmlEscapedString,
    nonce: opts.nonce,
    lv999: opts.lv999,
    user: opts.user,
  });
}

import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';
import type { NavUser } from '../components/navbar';
import { format } from '../../utils/math';
import { getMaxLevel, getBekiCooldown } from '../../utils/upgrades';
import {
  getNuggieFlatMultiplier, getNuggieStreakMultiplier, getNuggieCreditsMultiplier,
  getNuggiePokeMultiplier, getNuggieNuggieMultiplier,
} from '../../utils/ascensionupgrades';
import {
  getMultiplierAmountInfo,
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  INFO_LEVEL,
} from '../../utils/upgradesInfo';
import {
  getNuggieFlatMultiplierInfo,
  getNuggieStreakMultiplierInfo,
  getNuggieCreditsMultiplierInfo,
  getNuggiePokeMultiplierInfo,
  getNuggieNuggieMultiplierInfo,
} from '../../utils/ascensionupgradesInfo';

export interface DashboardProfile {
  discordId: string;
  username: string;
  avatarURL: string | null;
  stats: Record<string, any>;
  pokemonCount: number;
  marriageBenefits: number;
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
    margin-top: 1rem;
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
  .me-card .upgrade-info {
    margin-top: 0.5rem;
    color: var(--accent-light);
    font-size: 0.9rem;
    line-height: 1.7;
    font-weight: 600;
  }
  .me-card .upgrade-info strong {
    color: var(--fog-100);
    font-weight: 600;
  }
  
  details {
    background: var(--ink-800);
    border: 1px solid var(--ink-600);
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    padding: 1rem;
  }
  summary {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fog-100);
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::after {
    content: '+';
    font-size: 1.5rem;
    line-height: 1;
    color: var(--fog-300);
  }
  details[open] summary::after {
    content: '-';
  }
  .details-content {
    margin-top: 1rem;
    border-top: 1px solid var(--ink-600);
    padding-top: 1rem;
    color: var(--fog-200);
    line-height: 1.5;
  }
  .details-content p {
    margin: 0.5rem 0;
  }
  .details-content strong {
    color: var(--fog-100);
  }
</style>
`);

function pct(num: number, den: number): string {
  if (den <= 0) return '0%';
  return `${format((num / den) * 100, true)}%`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderUpgradeInfo(str: string): any {
  const lines = str.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const withoutHeading = lines.filter((l) => !l.startsWith('### '));
  const rendered = withoutHeading
    .map((l) => escapeHtml(l).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'))
    .join('<br/>');
  return raw(rendered);
}

export function HomePage(opts: {
  profile: DashboardProfile;
  user: NavUser;
  nonce: string;
  lv999?: boolean;
}) {
  const { profile } = opts;
  const { stats, pokemonCount, marriageBenefits } = profile;

  const credits = stats.credits ?? 0;
  const log2Credits = credits > 1 ? Math.log2(credits) : 0;
  const dinonuggies = stats.dinonuggies ?? 0;
  const log2Nuggies = dinonuggies > 1 ? Math.log2(dinonuggies) : 0;

  const bekiCooldown = getBekiCooldown(stats.bekiLevel ?? 0) * 60 * 60;
  const nextClaimSec = bekiCooldown - (Date.now() - (stats.dinonuggiesLastClaimed ?? 0)) / 1000;
  const nextClaim = nextClaimSec > 0
    ? `${Math.floor(nextClaimSec / 3600)}h ${Math.floor((nextClaimSec / 60) % 60)}m ${Math.floor(nextClaimSec % 60)}s`
    : 'Ready';

  const nuggieFlatMultiplier = getNuggieFlatMultiplier(stats.nuggieFlatMultiplierLevel ?? 0);
  const nuggieStreakMultiplier = getNuggieStreakMultiplier(stats.nuggieStreakMultiplierLevel ?? 0);
  const nuggieCreditsMultiplier = getNuggieCreditsMultiplier(stats.nuggieCreditsMultiplierLevel ?? 0);
  const nuggiePokemonMultiplier = getNuggiePokeMultiplier(stats.nuggiePokemonMultiplierLevel ?? 0);
  const nuggieNuggieMultiplier = getNuggieNuggieMultiplier(stats.nuggieNuggieMultiplierLevel ?? 0);

  const claimStreak = stats.dinonuggiesClaimStreak ?? 0;
  const maxLevel = getMaxLevel(stats.ascensionLevel ?? 0);

  // Gambling
  const sGambled = stats.slotsAmountGambled ?? 0;
  const sWon = stats.slotsAmountWon ?? 0;
  const bjGambled = stats.blackjackAmountGambled ?? 0;
  const bjWon = stats.blackjackAmountWon ?? 0;
  const rGambled = stats.rouletteAmountGambled ?? 0;
  const rWon = stats.rouletteAmountWon ?? 0;

  const bjTimesPlayed = stats.blackjackTimesPlayed ?? 0;
  const bjTimesWon = stats.blackjackTimesWon ?? 0;
  const bjTimesLost = stats.blackjackTimesLost ?? 0;

  const body = html`
    ${styles}
    <div class="me-header">
      ${profile.avatarURL ? html`<img src="${profile.avatarURL}" alt="${profile.username}" />` : ''}
      <div>
        <h1>@${profile.username}</h1>
        <div class="me-id">${profile.discordId}</div>
      </div>
    </div>

    <details open>
      <summary>Currency</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card"><div class="label">Mystic Credits</div><div class="value">${format(credits, true)}</div></div>
          <div class="me-card"><div class="label">Dinonuggies</div><div class="value">${format(dinonuggies)}</div></div>
          <div class="me-card"><div class="label">Heavenly Nuggies</div><div class="value">${format(stats.heavenlyNuggies ?? 0)}</div></div>
        </div>
      </div>
    </details>

    <details>
      <summary>Levels</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card"><div class="label">Ascension Level</div><div class="value">Level ${stats.ascensionLevel ?? 0}</div></div>
          <div class="me-card"><div class="label">Max Upgrade Level</div><div class="value">${maxLevel}</div></div>
        </div>
        <div class="me-grid">
          <div class="me-card"><div class="label">Multiplier Amount</div><div class="upgrade-info">${renderUpgradeInfo(getMultiplierAmountInfo(stats.multiplierAmountLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div></div>
          <div class="me-card"><div class="label">Multiplier Rarity</div><div class="upgrade-info">${renderUpgradeInfo(getMultiplierChanceInfo(stats.multiplierRarityLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div></div>
          <div class="me-card"><div class="label">Beki Cooldown</div><div class="upgrade-info">${renderUpgradeInfo(getBekiCooldownInfo(stats.bekiLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div></div>
          <div class="me-card"><div class="label">Nuggie Flat Multiplier</div><div class="upgrade-info">${renderUpgradeInfo(getNuggieFlatMultiplierInfo(stats.nuggieFlatMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div></div>
          <div class="me-card"><div class="label">Nuggie Streak Multiplier</div><div class="upgrade-info">${renderUpgradeInfo(getNuggieStreakMultiplierInfo(stats.nuggieStreakMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div></div>
          <div class="me-card"><div class="label">Nuggie Credits Multiplier</div><div class="upgrade-info">${renderUpgradeInfo(getNuggieCreditsMultiplierInfo(stats.nuggieCreditsMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div></div>
          <div class="me-card"><div class="label">Nuggie Pokemon Multiplier</div><div class="upgrade-info">${renderUpgradeInfo(getNuggiePokeMultiplierInfo(stats.nuggiePokemonMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div></div>
          <div class="me-card"><div class="label">Nuggie Nuggie Multiplier</div><div class="upgrade-info">${renderUpgradeInfo(getNuggieNuggieMultiplierInfo(stats.nuggieNuggieMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div></div>
        </div>
      </div>
    </details>

    <details>
      <summary>Claims</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card"><div class="label">Current Streak</div><div class="value">${claimStreak}</div><div class="label" style="margin-top:0.25rem">days</div></div>
          <div class="me-card"><div class="label">Base Claim Amount</div><div class="value">${format(5 + claimStreak)}</div><div class="label" style="margin-top:0.25rem">5 + ${format(claimStreak)}</div></div>
          <div class="me-card"><div class="label">Streak Multiplier</div><div class="value">${format(1 + nuggieStreakMultiplier * claimStreak, true)}x</div><div class="label" style="margin-top:0.25rem">1 + ${format(nuggieStreakMultiplier, true)} * ${format(claimStreak)}</div></div>
          <div class="me-card"><div class="label">Flat Multiplier</div><div class="value">${format(nuggieFlatMultiplier, true)}x</div></div>
          <div class="me-card"><div class="label">Marriage Multiplier</div><div class="value">${format(marriageBenefits, true)}x</div></div>
          <div class="me-card"><div class="label">Credits Multiplier</div><div class="value">${format(1 + nuggieCreditsMultiplier * log2Credits, true)}x</div><div class="label" style="margin-top:0.25rem">1 + ${format(nuggieCreditsMultiplier, true)} * ${format(log2Credits, true)}</div></div>
          <div class="me-card"><div class="label">Pokemon Multiplier</div><div class="value">${format(1 + nuggiePokemonMultiplier * pokemonCount, true)}x</div><div class="label" style="margin-top:0.25rem">1 + ${format(nuggiePokemonMultiplier, true)} * ${format(pokemonCount, true)}</div></div>
          <div class="me-card"><div class="label">Nuggie Multiplier</div><div class="value">${format(1 + nuggieNuggieMultiplier * log2Nuggies, true)}x</div><div class="label" style="margin-top:0.25rem">1 + ${format(nuggieNuggieMultiplier, true)} * ${format(log2Nuggies, true)}</div></div>
          <div class="me-card"><div class="label">Next Claim</div><div class="value" style="font-size: 1.1rem">${nextClaim}</div></div>
        </div>
      </div>
    </details>

    <details>
      <summary>Gambling</summary>
      <div class="details-content">
        <h3 style="color:var(--accent-light); margin-bottom: 0.5rem;">Slots</h3>
        <div class="me-grid">
          <div class="me-card"><div class="label">Times Played</div><div class="value">${stats.slotsTimesPlayed ?? 0}</div></div>
          <div class="me-card"><div class="label">Times Won</div><div class="value">${stats.slotsTimesWon ?? 0}</div></div>
          <div class="me-card"><div class="label">Percentage Won</div><div class="value">${pct(stats.slotsTimesWon ?? 0, stats.slotsTimesPlayed ?? 0)}</div></div>
          <div class="me-card"><div class="label">Amount Gambled</div><div class="value">${format(sGambled)}</div></div>
          <div class="me-card"><div class="label">Amount Won</div><div class="value">${format(sWon)}</div></div>
          <div class="me-card"><div class="label">Net Winnings</div><div class="value">${format(sWon - sGambled)}</div></div>
          <div class="me-card"><div class="label">Relative Amount Won</div><div class="value">${format(stats.slotsRelativeWon ?? 0, true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Relative Net Winnings</div><div class="value">${format((stats.slotsRelativeWon ?? 0) - (stats.slotsTimesPlayed ?? 0), true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
        </div>
        
        <h3 style="color:var(--accent-light); margin-top: 1.5rem; margin-bottom: 0.5rem;">Blackjack</h3>
        <div class="me-grid">
          <div class="me-card"><div class="label">Times Played</div><div class="value">${bjTimesPlayed}</div></div>
          <div class="me-card"><div class="label">Times Won</div><div class="value">${bjTimesWon}</div></div>
          <div class="me-card"><div class="label">Times Drew</div><div class="value">${stats.blackjackTimesDrawn ?? 0}</div></div>
          <div class="me-card"><div class="label">Times Lost</div><div class="value">${bjTimesLost}</div></div>
          <div class="me-card"><div class="label">Win Rate (Excl Draws)</div><div class="value">${pct(bjTimesWon, bjTimesWon + bjTimesLost)}</div></div>
          <div class="me-card"><div class="label">Amount Gambled</div><div class="value">${format(bjGambled)}</div></div>
          <div class="me-card"><div class="label">Amount Won</div><div class="value">${format(bjWon)}</div></div>
          <div class="me-card"><div class="label">Net Winnings</div><div class="value">${format(bjWon - bjGambled)}</div></div>
          <div class="me-card"><div class="label">Relative Amount Won</div><div class="value">${format(stats.blackjackRelativeWon ?? 0, true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Relative Net Winnings</div><div class="value">${format((stats.blackjackRelativeWon ?? 0) - bjTimesPlayed, true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Current Streak</div><div class="value">${stats.blackjackStreak ?? 0}</div></div>
          <div class="me-card"><div class="label">Max Streak</div><div class="value">${stats.blackjackMaxStreak ?? 0}</div></div>
        </div>

        <h3 style="color:var(--accent-light); margin-top: 1.5rem; margin-bottom: 0.5rem;">Roulette</h3>
        <div class="me-grid">
          <div class="me-card"><div class="label">Times Played</div><div class="value">${stats.rouletteTimesPlayed ?? 0}</div></div>
          <div class="me-card"><div class="label">Times Won</div><div class="value">${stats.rouletteTimesWon ?? 0}</div></div>
          <div class="me-card"><div class="label">Percentage Won</div><div class="value">${pct(stats.rouletteTimesWon ?? 0, stats.rouletteTimesPlayed ?? 0)}</div></div>
          <div class="me-card"><div class="label">Amount Gambled</div><div class="value">${format(rGambled)}</div></div>
          <div class="me-card"><div class="label">Amount Won</div><div class="value">${format(rWon)}</div></div>
          <div class="me-card"><div class="label">Net Winnings</div><div class="value">${format(rWon - rGambled)}</div></div>
          <div class="me-card"><div class="label">Relative Amount Won</div><div class="value">${format(stats.rouletteRelativeWon ?? 0, true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Relative Net Winnings</div><div class="value">${format((stats.rouletteRelativeWon ?? 0) - (stats.rouletteTimesPlayed ?? 0), true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Current Streak</div><div class="value">${stats.rouletteStreak ?? 0}</div></div>
          <div class="me-card"><div class="label">Max Streak</div><div class="value">${stats.rouletteMaxStreak ?? 0}</div></div>
        </div>
      </div>
    </details>

    <details>
      <summary>Others</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card"><div class="label">Pity</div><div class="value">${stats.pity ?? 0}</div></div>
          <div class="me-card"><div class="label">Birthday</div><div class="value" style="font-size: 1.1rem">${stats.birthdays ? stats.birthdays : 'No birthday set'}</div></div>
        </div>
      </div>
    </details>

    <details>
      <summary>Pokemons</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card"><div class="label">Unique Pokemons Caught</div><div class="value">${pokemonCount}</div></div>
        </div>
      </div>
    </details>
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

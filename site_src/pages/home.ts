import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Layout } from '../components/layout';
import type { NavUser } from '../components/navbar';
import { DAILY_LIMIT, WEEKLY_LIMIT } from '../../utils/ai';
import { numSpan, numSpanSuffix } from '../format';
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
  poopStats: Record<string, any> | null;
  poopProfile: Record<string, any> | null;
  aiUsageDaily: number;
  aiUsageWeekly: number;
}

const styles = raw(`
<style>
  .me-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.5rem;
    background: color-mix(in oklab, var(--ink-800) 70%, transparent);
    border: 1px solid rgba(34, 211, 255, 0.25);
    border-radius: 0.75rem;
    margin-bottom: 1.75rem;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 0 15px rgba(34, 211, 255, 0.08);
    position: relative;
    overflow: hidden;
  }
  .me-header::after {
    content: 'USER PROFILE HUD v1.2';
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    font-size: 0.6rem;
    font-family: 'JetBrains Mono', monospace;
    color: rgba(34, 211, 255, 0.35);
    letter-spacing: 0.1em;
  }
  .me-header img {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 2px solid var(--accent);
    box-shadow: 0 0 15px rgba(34, 211, 255, 0.4);
    transition: transform 0.3s;
  }
  .me-header img:hover {
    transform: scale(1.08) rotate(4deg);
  }
  .me-header h1 {
    font-size: 1.6rem;
    margin: 0 0 0.25rem 0;
    color: var(--fog-100);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-shadow: 0 0 10px rgba(34, 211, 255, 0.2);
  }
  .me-header .me-id {
    font-size: 0.8rem;
    color: var(--accent-light);
    font-family: 'JetBrains Mono', monospace;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(34, 211, 255, 0.08);
    padding: 0.15rem 0.6rem;
    border-radius: 4px;
    border: 1px solid rgba(34, 211, 255, 0.15);
  }
  .me-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
  .me-card {
    background: color-mix(in oklab, var(--ink-800) 55%, transparent);
    border: 1px solid rgba(34, 211, 255, 0.12);
    border-radius: 0.6rem;
    padding: 1.1rem;
    backdrop-filter: blur(8px);
    transition: all 0.25s ease;
  }
  
  .lvl-progress-container {
    height: 5px;
    background: rgba(6, 8, 15, 0.6);
    border-radius: 999px;
    overflow: hidden;
    margin-top: 0.65rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .lvl-progress-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
  }
  .lvl-progress-bar.cyan {
    background: linear-gradient(90deg, var(--accent), var(--accent-pale));
    box-shadow: 0 0 8px rgba(34, 211, 255, 0.4);
  }
  .lvl-progress-bar.purple {
    background: linear-gradient(90deg, #a78bfa, #c084fc);
    box-shadow: 0 0 8px rgba(167, 139, 250, 0.4);
  }
  .me-card:hover {
    border-color: rgba(34, 211, 255, 0.35);
    transform: translateY(-2px);
    box-shadow: 
      0 6px 20px rgba(0, 0, 0, 0.3),
      0 0 12px rgba(34, 211, 255, 0.04);
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
  
  .details-content {
    margin-top: 1rem;
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

function pct(num: number, den: number) {
  if (den <= 0) return html`0%`;
  return numSpanSuffix((num / den) * 100, '%', true);
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

function renderLvlProgressBar(level: number, maxLevel: number, colorClass = 'cyan'): any {
  const percent = maxLevel > 0 ? Math.min(100, Math.max(0, (level / maxLevel) * 100)) : 0;
  return html`
    <div class="lvl-progress-container" title="Level ${level} / ${maxLevel} (${percent.toFixed(0)}%)">
      <div class="lvl-progress-bar ${colorClass}" style="width: ${percent}%"></div>
    </div>
  `;
}

export function HomePage(opts: {
  profile: DashboardProfile;
  user: NavUser;
  nonce: string;
  lv999?: boolean;
}) {
  const { profile } = opts;
  const {
    stats, pokemonCount, marriageBenefits, poopStats, poopProfile,
  } = profile;

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

  // Poop
  const poopTimezoneRaw = Number(poopProfile?.timezone ?? 0);
  const poopTimezone = Number.isFinite(poopTimezoneRaw) ? poopTimezoneRaw : 0;
  const poopSign = poopTimezone >= 0 ? '+' : '';
  const poopTimezoneLabel = `UTC${poopSign}${poopTimezone}`;
  const totalPoops = poopStats?.totalPoops ?? 0;
  const avgDailyRaw = parseFloat(poopStats?.avgDaily);
  const avgDailyPoops = Number.isFinite(avgDailyRaw)
    ? numSpan(avgDailyRaw, true)
    : 'N/A';
  const avgDurationRaw = Number(poopStats?.avgDuration);
  const avgPoopDuration = Number.isFinite(avgDurationRaw)
    ? `${Math.round(avgDurationRaw)} min`
    : 'N/A';
  const lastLoggedAtRaw = Number(poopStats?.lastLoggedAt);
  const lastPoopDate = Number.isFinite(lastLoggedAtRaw)
    ? new Date(lastLoggedAtRaw * 1000 + poopTimezone * 60 * 60 * 1000)
    : null;
  const lastPoopAt = lastPoopDate && !Number.isNaN(lastPoopDate.getTime())
    ? `${lastPoopDate.toUTCString().replace(' GMT', '')} (${poopTimezoneLabel})`
    : 'N/A';
  const commonPoopType = poopStats?.commonType ?? 'N/A';
  const commonPoopColour = poopStats?.commonColour ?? 'N/A';

  const reachedDaily = profile.aiUsageDaily >= DAILY_LIMIT;
  const reachedWeekly = profile.aiUsageWeekly >= WEEKLY_LIMIT;
  const isAiRateLimited = reachedDaily || reachedWeekly;

  const aiStatusLabel = isAiRateLimited
    ? html`<span style="color: #ef4444;">Rate Limited</span>`
    : html`<span style="color: #10b981;">Active</span>`;

  let aiStatusDetail = 'Token pool is cool';
  if (reachedDaily) {
    aiStatusDetail = 'Daily limit exceeded';
  } else if (reachedWeekly) {
    aiStatusDetail = 'Weekly limit exceeded';
  }

  const body = html`
    ${styles}
    <div class="me-header">
      ${profile.avatarURL ? html`<img src="${profile.avatarURL}" alt="${profile.username}" />` : ''}
      <div>
        <h1>@${profile.username}</h1>
        <div class="me-id"><span class="status-led status-led-green" style="width:6px;height:6px;margin-bottom:1px;"></span> ${profile.discordId}</div>
      </div>
    </div>

    <details open>
      <summary>Currency</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card">
            <div class="label">Mystic Credits</div>
            <div class="value">${numSpan(credits)}</div>
          </div>
          <div class="me-card">
            <div class="label">Dinonuggies</div>
            <div class="value">${numSpan(dinonuggies)}</div>
          </div>
          <div class="me-card">
            <div class="label">Heavenly Nuggies</div>
            <div class="value">${numSpan(stats.heavenlyNuggies ?? 0)}</div>
          </div>
        </div>
      </div>
    </details>

    <details>
      <summary>AI Usage</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card">
            <div class="label">Daily Usage (24h)</div>
            <div class="value">${numSpan(profile.aiUsageDaily)}</div>
            <div class="label" style="margin-top:0.25rem">of ${DAILY_LIMIT.toLocaleString()} tokens</div>
          </div>
          <div class="me-card">
            <div class="label">Weekly Usage (7d)</div>
            <div class="value">${numSpan(profile.aiUsageWeekly)}</div>
            <div class="label" style="margin-top:0.25rem">of ${WEEKLY_LIMIT.toLocaleString()} tokens</div>
          </div>
          <div class="me-card">
            <div class="label">Status</div>
            <div class="value" style="font-size: 1.5rem; font-weight: 600;">
              ${aiStatusLabel}
            </div>
            <div class="label" style="margin-top:0.25rem">
              ${aiStatusDetail}
            </div>
          </div>
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
          <div class="me-card">
            <div class="label">Multiplier Amount</div>
            <div class="upgrade-info">${renderUpgradeInfo(getMultiplierAmountInfo(stats.multiplierAmountLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div>
            ${renderLvlProgressBar(stats.multiplierAmountLevel ?? 0, maxLevel, 'cyan')}
          </div>
          <div class="me-card">
            <div class="label">Multiplier Rarity</div>
            <div class="upgrade-info">${renderUpgradeInfo(getMultiplierChanceInfo(stats.multiplierRarityLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div>
            ${renderLvlProgressBar(stats.multiplierRarityLevel ?? 0, maxLevel, 'cyan')}
          </div>
          <div class="me-card">
            <div class="label">Beki Cooldown</div>
            <div class="upgrade-info">${renderUpgradeInfo(getBekiCooldownInfo(stats.bekiLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div>
            ${renderLvlProgressBar(stats.bekiLevel ?? 0, maxLevel, 'cyan')}
          </div>
          <div class="me-card">
            <div class="label">Nuggie Flat Multiplier</div>
            <div class="upgrade-info">${renderUpgradeInfo(getNuggieFlatMultiplierInfo(stats.nuggieFlatMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div>
            ${renderLvlProgressBar(stats.nuggieFlatMultiplierLevel ?? 0, maxLevel, 'purple')}
          </div>
          <div class="me-card">
            <div class="label">Nuggie Streak Multiplier</div>
            <div class="upgrade-info">${renderUpgradeInfo(getNuggieStreakMultiplierInfo(stats.nuggieStreakMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div>
            ${renderLvlProgressBar(stats.nuggieStreakMultiplierLevel ?? 0, maxLevel, 'purple')}
          </div>
          <div class="me-card">
            <div class="label">Nuggie Credits Multiplier</div>
            <div class="upgrade-info">${renderUpgradeInfo(getNuggieCreditsMultiplierInfo(stats.nuggieCreditsMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div>
            ${renderLvlProgressBar(stats.nuggieCreditsMultiplierLevel ?? 0, maxLevel, 'purple')}
          </div>
          <div class="me-card">
            <div class="label">Nuggie Pokemon Multiplier</div>
            <div class="upgrade-info">${renderUpgradeInfo(getNuggiePokeMultiplierInfo(stats.nuggiePokemonMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div>
            ${renderLvlProgressBar(stats.nuggiePokemonMultiplierLevel ?? 0, maxLevel, 'purple')}
          </div>
          <div class="me-card">
            <div class="label">Nuggie Nuggie Multiplier</div>
            <div class="upgrade-info">${renderUpgradeInfo(getNuggieNuggieMultiplierInfo(stats.nuggieNuggieMultiplierLevel ?? 0, INFO_LEVEL.THIS_LEVEL))}</div>
            ${renderLvlProgressBar(stats.nuggieNuggieMultiplierLevel ?? 0, maxLevel, 'purple')}
          </div>
        </div>
      </div>
    </details>

    <details>
      <summary>Claims</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card"><div class="label">Current Streak</div><div class="value">${claimStreak}</div><div class="label" style="margin-top:0.25rem">days</div></div>
          <div class="me-card"><div class="label">Base Claim Amount</div><div class="value">${numSpan(5 + claimStreak)}</div><div class="label" style="margin-top:0.25rem">5 + ${numSpan(claimStreak)}</div></div>
          <div class="me-card"><div class="label">Streak Multiplier</div><div class="value">${numSpanSuffix(1 + nuggieStreakMultiplier * claimStreak, 'x', true)}</div><div class="label" style="margin-top:0.25rem">1 + ${numSpanSuffix(nuggieStreakMultiplier, 'x', true)} * ${numSpan(claimStreak)}</div></div>
          <div class="me-card"><div class="label">Flat Multiplier</div><div class="value">${numSpanSuffix(nuggieFlatMultiplier, 'x', true)}</div></div>
          <div class="me-card"><div class="label">Marriage Multiplier</div><div class="value">${numSpanSuffix(marriageBenefits, 'x', true)}</div></div>
          <div class="me-card"><div class="label">Credits Multiplier</div><div class="value">${numSpanSuffix(1 + nuggieCreditsMultiplier * log2Credits, 'x', true)}</div><div class="label" style="margin-top:0.25rem">1 + ${numSpan(nuggieCreditsMultiplier, true)} * ${numSpan(log2Credits, true)}</div></div>
          <div class="me-card"><div class="label">Pokemon Multiplier</div><div class="value">${numSpanSuffix(1 + nuggiePokemonMultiplier * pokemonCount, 'x', true)}</div><div class="label" style="margin-top:0.25rem">1 + ${numSpan(nuggiePokemonMultiplier, true)} * ${numSpan(pokemonCount, true)}</div></div>
          <div class="me-card"><div class="label">Nuggie Multiplier</div><div class="value">${numSpanSuffix(1 + nuggieNuggieMultiplier * log2Nuggies, 'x', true)}</div><div class="label" style="margin-top:0.25rem">1 + ${numSpan(nuggieNuggieMultiplier, true)} * ${numSpan(log2Nuggies, true)}</div></div>
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
          <div class="me-card"><div class="label">Amount Gambled</div><div class="value">${numSpan(sGambled)}</div></div>
          <div class="me-card"><div class="label">Amount Won</div><div class="value">${numSpan(sWon)}</div></div>
          <div class="me-card"><div class="label">Net Winnings</div><div class="value">${numSpan(sWon - sGambled)}</div></div>
          <div class="me-card"><div class="label">Relative Amount Won</div><div class="value">${numSpan(stats.slotsRelativeWon ?? 0, true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Relative Net Winnings</div><div class="value">${numSpan((stats.slotsRelativeWon ?? 0) - (stats.slotsTimesPlayed ?? 0), true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
        </div>
        
        <h3 style="color:var(--accent-light); margin-top: 1.5rem; margin-bottom: 0.5rem;">Blackjack</h3>
        <div class="me-grid">
          <div class="me-card"><div class="label">Times Played</div><div class="value">${bjTimesPlayed}</div></div>
          <div class="me-card"><div class="label">Times Won</div><div class="value">${bjTimesWon}</div></div>
          <div class="me-card"><div class="label">Times Drew</div><div class="value">${stats.blackjackTimesDrawn ?? 0}</div></div>
          <div class="me-card"><div class="label">Times Lost</div><div class="value">${bjTimesLost}</div></div>
          <div class="me-card"><div class="label">Win Rate (Excl Draws)</div><div class="value">${pct(bjTimesWon, bjTimesWon + bjTimesLost)}</div></div>
          <div class="me-card"><div class="label">Amount Gambled</div><div class="value">${numSpan(bjGambled)}</div></div>
          <div class="me-card"><div class="label">Amount Won</div><div class="value">${numSpan(bjWon)}</div></div>
          <div class="me-card"><div class="label">Net Winnings</div><div class="value">${numSpan(bjWon - bjGambled)}</div></div>
          <div class="me-card"><div class="label">Relative Amount Won</div><div class="value">${numSpan(stats.blackjackRelativeWon ?? 0, true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Relative Net Winnings</div><div class="value">${numSpan((stats.blackjackRelativeWon ?? 0) - bjTimesPlayed, true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Current Streak</div><div class="value">${stats.blackjackStreak ?? 0}</div></div>
          <div class="me-card"><div class="label">Max Streak</div><div class="value">${stats.blackjackMaxStreak ?? 0}</div></div>
        </div>

        <h3 style="color:var(--accent-light); margin-top: 1.5rem; margin-bottom: 0.5rem;">Roulette</h3>
        <div class="me-grid">
          <div class="me-card"><div class="label">Times Played</div><div class="value">${stats.rouletteTimesPlayed ?? 0}</div></div>
          <div class="me-card"><div class="label">Times Won</div><div class="value">${stats.rouletteTimesWon ?? 0}</div></div>
          <div class="me-card"><div class="label">Percentage Won</div><div class="value">${pct(stats.rouletteTimesWon ?? 0, stats.rouletteTimesPlayed ?? 0)}</div></div>
          <div class="me-card"><div class="label">Amount Gambled</div><div class="value">${numSpan(rGambled)}</div></div>
          <div class="me-card"><div class="label">Amount Won</div><div class="value">${numSpan(rWon)}</div></div>
          <div class="me-card"><div class="label">Net Winnings</div><div class="value">${numSpan(rWon - rGambled)}</div></div>
          <div class="me-card"><div class="label">Relative Amount Won</div><div class="value">${numSpan(stats.rouletteRelativeWon ?? 0, true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Relative Net Winnings</div><div class="value">${numSpan((stats.rouletteRelativeWon ?? 0) - (stats.rouletteTimesPlayed ?? 0), true)}</div><div class="label" style="margin-top:0.25rem">bets</div></div>
          <div class="me-card"><div class="label">Current Streak</div><div class="value">${stats.rouletteStreak ?? 0}</div></div>
          <div class="me-card"><div class="label">Max Streak</div><div class="value">${stats.rouletteMaxStreak ?? 0}</div></div>
        </div>
      </div>
    </details>

    <details>
      <summary>Poop</summary>
      <div class="details-content">
        ${totalPoops > 0 ? html`
        <div class="me-grid">
          <div class="me-card"><div class="label">Total Poops</div><div class="value">${numSpan(totalPoops)}</div></div>
          <div class="me-card"><div class="label">Avg Daily Poops</div><div class="value">${avgDailyPoops}</div></div>
          <div class="me-card"><div class="label">Avg Duration</div><div class="value">${avgPoopDuration}</div></div>
          <div class="me-card"><div class="label">Most Common Type</div><div class="value" style="font-size: 1.1rem">${commonPoopType}</div></div>
          <div class="me-card"><div class="label">Most Common Colour</div><div class="value" style="font-size: 1.1rem">${commonPoopColour}</div></div>
          <div class="me-card"><div class="label">Last Poop</div><div class="value" style="font-size: 0.95rem">${lastPoopAt}</div></div>
          <div class="me-card"><div class="label">Timezone</div><div class="value">${poopTimezoneLabel}</div></div>
        </div>
        ` : html`<p>No poop data logged yet.</p>`}
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

    <details>
      <summary>Others</summary>
      <div class="details-content">
        <div class="me-grid">
          <div class="me-card"><div class="label">Pity</div><div class="value">${stats.pity ?? 0}</div></div>
          <div class="me-card"><div class="label">Birthday</div><div class="value" style="font-size: 1.1rem">${stats.birthdays ? stats.birthdays : 'No birthday set'}</div></div>
        </div>
      </div>
    </details>
  `;

  return Layout({
    title: `Silverwolf — @${profile.username}`,
    // /me lives behind the profile chip, not the nav tabs, so no tab is active here.
    active: undefined,
    body: body as unknown as HtmlEscapedString,
    nonce: opts.nonce,
    lv999: opts.lv999,
    user: opts.user,
  });
}

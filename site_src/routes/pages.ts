import type { Hono } from 'hono';
import { logError } from '../../utils/log';
import type { Silverwolf } from '../../classes/silverwolf';
import { AboutPage } from '../pages/about';
import { LeaderboardsPage } from '../pages/leaderboards';
import { BirthdaysPage } from '../pages/birthdays';
import { GamesPage } from '../pages/games';
import { EightBallPage } from '../pages/games/8ball';
import { FlipPage } from '../pages/games/flip';
import { FortunePage } from '../pages/games/fortune';
import { LovePage } from '../pages/games/love';
import { BlackjackPage } from '../pages/games/blackjack';
import { PoopPage } from '../pages/games/poop';
import { RoulettePage } from '../pages/games/roulette';
import { SlotsPage } from '../pages/games/slots';
import { ClaimPage } from '../pages/games/claim';
import { DinonuggieUpgradesPage } from '../pages/games/dinonuggie_upgrades';
import { AwdangitPage } from '../pages/games/awdangit';
import { FakeQuotePage } from '../pages/games/fakequote';
import { AiSlopPage } from '../pages/games/ai-slop';
import { CyclicTicTacToePage } from '../pages/games/cyclic_tictactoe';
import { BattleshipsPage } from '../pages/games/battleships';
import { BottleFlipPage } from '../pages/games/bottleflip';
import { canUseAiSlop } from '../guild-access';
import { HomePage, type DashboardProfile } from '../pages/home';
import {
  getLeaderboard,
  getAllBirthdaysByMonth,
  getEightBallResponses,
  getFortunes,
  type LeaderboardKind,
} from '../bot-bridge';
import { type AppEnv, navUser } from '../shared';
import { fetchGamblingPageStats } from '../gambling-stats';

const VALID_BOARDS: LeaderboardKind[] = ['gambler', 'murder', 'nuggie', 'poop'];

export function registerPageRoutes(app: Hono<AppEnv>, silverwolf: Silverwolf) {
  app.get('/me', async (c) => {
    const user = c.get('user');
    if (!user) return c.redirect('/');
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    try {
      const getDailyUsageSafe = async () => {
        try {
          const usage = await silverwolf.db.aiUsage.getDailyUsage(user.discordId);
          return usage ?? 0;
        } catch (e) {
          logError('Dashboard failed to load daily AI usage:', e);
          return 0;
        }
      };

      const getWeeklyUsageSafe = async () => {
        try {
          const usage = await silverwolf.db.aiUsage.getWeeklyUsage(user.discordId);
          return usage ?? 0;
        } catch (e) {
          logError('Dashboard failed to load weekly AI usage:', e);
          return 0;
        }
      };

      const [
        stats,
        pokemonCount,
        marriageBenefits,
        poopStats,
        poopProfile,
        aiUsageDaily,
        aiUsageWeekly,
      ] = await Promise.all([
        silverwolf.db.user.getUser(user.discordId),
        silverwolf.db.pokemon.getUniquePokemonCount(user.discordId),
        silverwolf.db.marriage.getMarriageBenefits(user.discordId),
        silverwolf.db.poop.getUserStats(user.discordId),
        silverwolf.db.poop.getProfile(user.discordId),
        getDailyUsageSafe(),
        getWeeklyUsageSafe(),
      ]);

      const profile: DashboardProfile = {
        discordId: user.discordId,
        username: user.nav.username,
        avatarURL: user.nav.avatarURL,
        stats,
        pokemonCount,
        marriageBenefits,
        poopStats,
        poopProfile,
        aiUsageDaily,
        aiUsageWeekly,
      };
      return c.html(HomePage({
        profile, user: user.nav, nonce, lv999,
      }).toString());
    } catch (err) {
      logError('website /me dashboard failed:', err);
      return c.text('Failed to load dashboard', 500);
    }
  });

  app.get('/', (c) => {
    const user = c.get('user');
    return c.redirect(user ? '/me' : '/about');
  });

  app.get('/about', (c) => c.html(AboutPage({
    nonce: c.get('nonce'),
    lv999: c.req.query('lv') === '999',
    goof: c.req.query('theme') === 'goof',
    user: navUser(c),
  }).toString()));

  app.get('/leaderboards', async (c) => {
    const raw = c.req.query('board');
    const selected = raw && (VALID_BOARDS as string[]).includes(raw) ? (raw as LeaderboardKind) : undefined;
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';

    const user = navUser(c);
    if (!selected) {
      return c.html(LeaderboardsPage({ nonce, lv999, user }).toString());
    }

    try {
      const result = await getLeaderboard(silverwolf, selected);
      return c.html(LeaderboardsPage({
        selected, result, nonce, lv999, user,
      }).toString());
    } catch (err) {
      logError('website /leaderboards failed:', err);
      return c.html(
        LeaderboardsPage({
          selected, error: 'Failed to load leaderboard.', nonce, lv999, user,
        }).toString(),
        500,
      );
    }
  });

  app.get('/birthdays', async (c) => {
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';
    const user = navUser(c);
    try {
      const grouped = await getAllBirthdaysByMonth(silverwolf);
      return c.html(BirthdaysPage({
        grouped, nonce, lv999, user,
      }).toString());
    } catch (err) {
      logError('website /birthdays failed:', err);
      return c.html(BirthdaysPage({
        grouped: {}, error: 'Failed to load birthdays.', nonce, lv999, user,
      }).toString(), 500);
    }
  });

  app.get('/games', (c) => c.html(GamesPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/8ball', (c) => {
    const { normal, savage } = getEightBallResponses();
    return c.html(EightBallPage({
      normal, savage, nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
    }).toString());
  });

  app.get('/games/flip', (c) => c.html(FlipPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/fortune', (c) => {
    const fortunes = getFortunes();
    return c.html(FortunePage({
      fortunes, nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
    }).toString());
  });

  app.get('/games/love', (c) => c.html(LovePage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/cyclic-tictactoe', (c) => c.html(CyclicTicTacToePage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/battleships', (c) => c.html(BattleshipsPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/bottle-flip', (c) => c.html(BottleFlipPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/blackjack', async (c) => {
    const user = c.get('user');
    const gambleStats = user
      ? await fetchGamblingPageStats(silverwolf, user.discordId, 'blackjackStreak')
      : null;
    return c.html(BlackjackPage({
      nonce: c.get('nonce'),
      lv999: c.req.query('lv') === '999',
      user: navUser(c),
      gambleStats,
    }).toString());
  });

  app.get('/games/poop', (c) => c.html(PoopPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/roulette', async (c) => {
    const user = c.get('user');
    const gambleStats = user
      ? await fetchGamblingPageStats(silverwolf, user.discordId, 'rouletteStreak')
      : null;
    return c.html(RoulettePage({
      nonce: c.get('nonce'),
      lv999: c.req.query('lv') === '999',
      user: navUser(c),
      gambleStats,
    }).toString());
  });

  app.get('/games/slots', async (c) => {
    const user = c.get('user');
    const gambleStats = user
      ? await fetchGamblingPageStats(silverwolf, user.discordId)
      : null;
    return c.html(SlotsPage({
      nonce: c.get('nonce'),
      lv999: c.req.query('lv') === '999',
      user: navUser(c),
      gambleStats,
    }).toString());
  });

  app.get('/games/claim', (c) => c.html(ClaimPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/dinonuggie-upgrades', (c) => c.html(DinonuggieUpgradesPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/awdangit', (c) => c.html(AwdangitPage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/fakequote', (c) => c.html(FakeQuotePage({
    nonce: c.get('nonce'), lv999: c.req.query('lv') === '999', user: navUser(c),
  }).toString()));

  app.get('/games/ai-slop', async (c) => {
    const user = c.get('user');
    const nonce = c.get('nonce');
    const lv999 = c.req.query('lv') === '999';

    if (!user) {
      return c.html(AiSlopPage({
        nonce, lv999, user: null, sessions: [], guildAccess: false,
      }).toString());
    }

    const guildAccess = await canUseAiSlop(silverwolf, user.discordId);

    try {
      const sessions = guildAccess
        ? await silverwolf.db.aiChat.getUserWebSessions(user.discordId)
        : [];
      return c.html(AiSlopPage({
        nonce, lv999, user: user.nav, sessions, guildAccess,
      }).toString());
    } catch (err) {
      logError('website /games/ai-slop failed:', err);
      return c.html(AiSlopPage({
        nonce, lv999, user: user.nav, sessions: [], guildAccess,
      }).toString(), 500);
    }
  });
}

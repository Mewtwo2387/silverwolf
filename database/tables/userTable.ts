import type { TableDefinition } from '../types';

export interface UserRow {
  id: string;
  credits: number;
  bitcoin: number;
  last_bought_price: number;
  last_bought_amount: number;
  total_bought_price: number;
  total_bought_amount: number;
  total_sold_price: number;
  total_sold_amount: number;
  dinonuggies: number;
  dinonuggies_last_claimed: string | null;
  dinonuggies_claim_streak: number;
  multiplier_amount_level: number;
  multiplier_rarity_level: number;
  beki_level: number;
  birthdays: string | null;
  ascension_level: number;
  heavenly_nuggies: number;
  nuggie_flat_multiplier_level: number;
  nuggie_streak_multiplier_level: number;
  nuggie_credits_multiplier_level: number;
  pity: number;
  slots_times_played: number;
  slots_amount_gambled: number;
  slots_times_won: number;
  slots_amount_won: number;
  slots_relative_won: number;
  blackjack_times_played: number;
  blackjack_amount_gambled: number;
  blackjack_times_won: number;
  blackjack_times_drawn: number;
  blackjack_times_lost: number;
  blackjack_amount_won: number;
  blackjack_relative_won: number;
  roulette_times_played: number;
  roulette_amount_gambled: number;
  roulette_times_won: number;
  roulette_amount_won: number;
  roulette_relative_won: number;
  roulette_streak: number;
  roulette_max_streak: number;
  blackjack_streak: number;
  blackjack_max_streak: number;
  dinonuggie_last_gambled: string | null;
  nuggie_pokemon_multiplier_level: number;
  nuggie_nuggie_multiplier_level: number;
  stellar_nuggies: number;
  last_murder: string | null;
  murder_success: number;
  murder_fail: number;
}

/** Extended row returned by GET_USER_STATS (includes computed join columns). */
export interface UserStatsRow extends UserRow {
  total_pokemon: number;
  total_babies: number;
  blackjack_relative_net_winnings: number;
  blackjack_net_winnings: number;
  roulette_relative_net_winnings: number;
  roulette_net_winnings: number;
  slots_relative_net_winnings: number;
  slots_net_winnings: number;
}

const userTable: TableDefinition = {
  name: 'User',
  columns: [
    { name: 'id', type: 'VARCHAR PRIMARY KEY' },
    { name: 'credits', type: 'INTEGER DEFAULT 0' },
    { name: 'bitcoin', type: 'FLOAT DEFAULT 0' },
    { name: 'last_bought_price', type: 'FLOAT DEFAULT 0' },
    { name: 'last_bought_amount', type: 'FLOAT DEFAULT 0' },
    { name: 'total_bought_price', type: 'FLOAT DEFAULT 0' },
    { name: 'total_bought_amount', type: 'FLOAT DEFAULT 0' },
    { name: 'total_sold_price', type: 'FLOAT DEFAULT 0' },
    { name: 'total_sold_amount', type: 'FLOAT DEFAULT 0' },
    { name: 'dinonuggies', type: 'INTEGER DEFAULT 0' },
    { name: 'dinonuggies_last_claimed', type: 'DATETIME DEFAULT NULL' },
    { name: 'dinonuggies_claim_streak', type: 'INTEGER DEFAULT 0' },
    { name: 'multiplier_amount_level', type: 'INTEGER DEFAULT 1' },
    { name: 'multiplier_rarity_level', type: 'INTEGER DEFAULT 1' },
    { name: 'beki_level', type: 'INTEGER DEFAULT 1' },
    { name: 'birthdays', type: 'DATETIME DEFAULT NULL' },
    { name: 'ascension_level', type: 'INTEGER DEFAULT 1' },
    { name: 'heavenly_nuggies', type: 'INTEGER DEFAULT 0' },
    { name: 'nuggie_flat_multiplier_level', type: 'INTEGER DEFAULT 1' },
    { name: 'nuggie_streak_multiplier_level', type: 'INTEGER DEFAULT 1' },
    { name: 'nuggie_credits_multiplier_level', type: 'INTEGER DEFAULT 1' },
    { name: 'pity', type: 'INTEGER DEFAULT 0' },
    { name: 'slots_times_played', type: 'INTEGER DEFAULT 0' },
    { name: 'slots_amount_gambled', type: 'FLOAT DEFAULT 0' },
    { name: 'slots_times_won', type: 'INTEGER DEFAULT 0' },
    { name: 'slots_amount_won', type: 'FLOAT DEFAULT 0' },
    { name: 'slots_relative_won', type: 'FLOAT DEFAULT 0' },
    { name: 'blackjack_times_played', type: 'INTEGER DEFAULT 0' },
    { name: 'blackjack_amount_gambled', type: 'FLOAT DEFAULT 0' },
    { name: 'blackjack_times_won', type: 'INTEGER DEFAULT 0' },
    { name: 'blackjack_times_drawn', type: 'INTEGER DEFAULT 0' },
    { name: 'blackjack_times_lost', type: 'INTEGER DEFAULT 0' },
    { name: 'blackjack_amount_won', type: 'FLOAT DEFAULT 0' },
    { name: 'blackjack_relative_won', type: 'FLOAT DEFAULT 0' },
    { name: 'roulette_times_played', type: 'INTEGER DEFAULT 0' },
    { name: 'roulette_amount_gambled', type: 'FLOAT DEFAULT 0' },
    { name: 'roulette_times_won', type: 'INTEGER DEFAULT 0' },
    { name: 'roulette_amount_won', type: 'FLOAT DEFAULT 0' },
    { name: 'roulette_relative_won', type: 'FLOAT DEFAULT 0' },
    { name: 'roulette_streak', type: 'INTEGER DEFAULT 0' },
    { name: 'roulette_max_streak', type: 'INTEGER DEFAULT 0' },
    { name: 'blackjack_streak', type: 'INTEGER DEFAULT 0' },
    { name: 'blackjack_max_streak', type: 'INTEGER DEFAULT 0' },
    { name: 'dinonuggie_last_gambled', type: 'DATETIME DEFAULT NULL' },
    { name: 'nuggie_pokemon_multiplier_level', type: 'INTEGER DEFAULT 1' },
    { name: 'nuggie_nuggie_multiplier_level', type: 'INTEGER DEFAULT 1' },
    { name: 'stellar_nuggies', type: 'INTEGER DEFAULT 0' },
    { name: 'last_murder', type: 'DATETIME DEFAULT NULL' },
    { name: 'murder_success', type: 'INTEGER DEFAULT 0' },
    { name: 'murder_fail', type: 'INTEGER DEFAULT 0' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [],
};

export default userTable;

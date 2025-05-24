const userQueries = {
  // get user by discord id
  GET_USER_BY_ID: 'SELECT * FROM User WHERE id = ?',

  // get detailed user stats
  GET_USER_STATS: `
    SELECT 
      u.*,
      COUNT(DISTINCT p.id) as total_pokemon,
      COUNT(DISTINCT b.id) as total_babies,
      (u.blackjack_relative_won - u.blackjack_times_played) as blackjack_relative_net_winnings,
      (u.blackjack_amount_won - u.blackjack_amount_gambled) as blackjack_net_winnings,
      (u.roulette_relative_won - u.roulette_times_played) as roulette_relative_net_winnings,
      (u.roulette_amount_won - u.roulette_amount_gambled) as roulette_net_winnings,
      (u.slots_relative_won - u.slots_times_played) as slots_relative_net_winnings,
      (u.slots_amount_won - u.slots_amount_gambled) as slots_net_winnings
    FROM User u
    LEFT JOIN Pokemon p ON u.id = p.user_id
    LEFT JOIN Baby b ON u.id = b.mother_id OR u.id = b.father_id
    WHERE u.id = ?
    GROUP BY u.id
  `,

  // create user
  CREATE_USER: 'INSERT INTO User (id) VALUES (?)',

  // add user attribute
  ADD_USER_ATTR: (attr) => `
    UPDATE User SET ${attr} = ${attr} + ? WHERE id = ?
  `,

  // set user attribute
  SET_USER_ATTR: (attr) => `
    UPDATE User SET ${attr} = ? WHERE id = ?
  `,

  ASCEND_USER: `
    UPDATE User SET 
      credits = 0,
      bitcoin = 0,
      last_bought_price = 0,
      last_bought_amount = 0,
      dinonuggies = 0,
      dinonuggies_last_claimed = NULL,
      dinonuggies_claim_streak = 0,
      multiplier_amount_level = 1,
      multiplier_rarity_level = 1,
      beki_level = 1,
      heavenly_nuggies = heavenly_nuggies + dinonuggies
    WHERE id = ?
  `,

  // get a sorted list of users by attribute
  GET_EVERYONE_ATTR: (attr) => `
    SELECT
      id, ${attr}
    FROM User
    WHERE ${attr} <> 0
    ORDER BY ${attr} DESC
  `,

  // get a sorted list of users by attribute, with limit and offset
  GET_EVERYONE_ATTR_LIMIT: (attr, limit, offset) => `
    SELECT
      id, ${attr}
    FROM User
    WHERE ${attr} <> 0
    ORDER BY ${attr} DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `,

  GET_EVERYONE_ATTR_COUNT: (attr) => `
    SELECT COUNT(*) as count FROM User WHERE ${attr} <> 0
  `,

  GET_EVERYONE_RELATIVE_NET_WINNINGS: (type) => `
    SELECT
      id, 
      (${type}_relative_won - ${type}_times_played) as relative_won
    FROM User
    WHERE ${type}_times_played <> 0
    ORDER BY relative_won DESC
  `,

  GET_EVERYONE_RELATIVE_NET_WINNINGS_LIMIT: (type, limit, offset) => `
    SELECT
      id,
      (${type}_relative_won - ${type}_times_played) as relative_won
    FROM User
    WHERE ${type}_times_played <> 0
    ORDER BY relative_won DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `,

  GET_EVERYONE_RELATIVE_NET_WINNINGS_COUNT: (type) => `
    SELECT COUNT(*) as count FROM User WHERE ${type}_times_played <> 0
  `,

  GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL: `
    SELECT
      id,
      (slots_relative_won + blackjack_relative_won + roulette_relative_won - slots_times_played - blackjack_times_played - roulette_times_played) as relative_won
    FROM User
    WHERE slots_times_played <> 0 OR blackjack_times_played <> 0 OR roulette_times_played <> 0
    ORDER BY relative_won DESC
  `,

  GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL_LIMIT: (limit, offset) => `
    SELECT
      id,
      (slots_relative_won + blackjack_relative_won + roulette_relative_won - slots_times_played - blackjack_times_played - roulette_times_played) as relative_won
    FROM User
    WHERE slots_times_played <> 0 OR blackjack_times_played <> 0 OR roulette_times_played <> 0
    ORDER BY relative_won DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `,

  GET_EVERYONE_RELATIVE_NET_WINNINGS_ALL_COUNT: `
    SELECT
      COUNT(*) as count
    FROM User
    WHERE slots_times_played <> 0 OR blackjack_times_played <> 0 OR roulette_times_played <> 0
  `,

  GET_USERS_WITH_BIRTHDAY: `
    SELECT
      id
    FROM User
    WHERE strftime('%m-%dT%H', birthdays) = ?
  `,
};

module.exports = userQueries;

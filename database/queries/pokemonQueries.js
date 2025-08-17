const pokemonQueries = {
  CATCH_POKEMON: `
    INSERT INTO Pokemon (user_id, pokemon_name, pokemon_count)
    VALUES (?, LOWER(?), 1)
    ON CONFLICT(user_id, pokemon_name) DO UPDATE SET
    pokemon_count = pokemon_count + 1;
  `,

  GET_POKEMONS: `
    SELECT * FROM Pokemon WHERE user_id = ?;
  `,

  GET_POKEMON_COUNT: `
    SELECT pokemon_count FROM Pokemon WHERE user_id = ? AND pokemon_name = LOWER(?);
  `,

  DELETE_POKEMON: `
    DELETE FROM Pokemon WHERE user_id = ? AND pokemon_name = LOWER(?);
  `,

  MINUS_POKEMON: `
    UPDATE Pokemon SET pokemon_count = pokemon_count - 1 WHERE user_id = ? AND pokemon_name = LOWER(?);
  `,

  GET_UNIQUE_POKEMON_COUNT: `
    SELECT COUNT(*) as count FROM (SELECT DISTINCT pokemon_name FROM Pokemon WHERE user_id = ?);
  `,

  GET_TOTAL_POKEMON_COUNT: `
    SELECT SUM(pokemon_count) as count FROM Pokemon WHERE user_id = ?;
  `,

  GET_USERS_WITH_POKEMON: `
    SELECT DISTINCT u.id AS user_id, p.pokemon_count
    FROM User u
    INNER JOIN Pokemon p ON u.id = p.user_id
    WHERE LOWER(p.pokemon_name) = LOWER(?);
  `,
};

module.exports = pokemonQueries;

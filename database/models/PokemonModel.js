const { log } = require('../../utils/log');
const pokemonQueries = require('../queries/pokemonQueries');

class PokemonModel {
  constructor(database) {
    this.db = database;
  }

  async catchPokemon(userId, pokemonName) {
    await this.db.user.getUser(userId);
    const query = pokemonQueries.CATCH_POKEMON;
    await this.db.executeQuery(query, [userId, pokemonName]);
    log(`User ${userId} caught a ${pokemonName}`);
  }

  async getPokemons(userId) {
    const query = pokemonQueries.GET_POKEMONS;
    return this.db.executeSelectAllQuery(query, [userId]);
  }

  async getPokemonCount(userId, pokemonName) {
    const query = pokemonQueries.GET_POKEMON_COUNT;
    const row = await this.db.executeSelectQuery(query, [userId, pokemonName]);
    return row ? row.pokemonCount : 0;
  }

  async sacrificePokemon(userId, pokemonName) {
    const count = await this.getPokemonCount(userId, pokemonName);
    if (count <= 1) {
      const query = pokemonQueries.DELETE_POKEMON;
      await this.db.executeQuery(query, [userId, pokemonName]);
      log(`User ${userId} sacrificed their last ${pokemonName} and it was removed from the database`);
    } else {
      const query = pokemonQueries.MINUS_POKEMON;
      await this.db.executeQuery(query, [userId, pokemonName]);
      log(`User ${userId} sacrificed a ${pokemonName}`);
    }
  }

  async getUniquePokemonCount(userId) {
    const query = pokemonQueries.GET_UNIQUE_POKEMON_COUNT;
    const row = await this.db.executeSelectQuery(query, [userId]);
    return row ? (row.count || 0) : 0;
  }

  async getTotalPokemonCount(userId) {
    const query = pokemonQueries.GET_TOTAL_POKEMON_COUNT;
    const row = await this.db.executeSelectQuery(query, [userId]);
    return row ? (row.count || 0) : 0;
  }

  async getUsersWithPokemon(type) {
    const query = pokemonQueries.GET_USERS_WITH_POKEMON;
    const rows = await this.db.executeSelectAllQuery(query, [type]);
    return rows;
  }
}

module.exports = PokemonModel;

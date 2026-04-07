import { log } from '../../utils/log';
import pokemonQueries from '../queries/pokemonQueries';
import type Database from '../Database';

class PokemonModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async catchPokemon(userId: string, pokemonName: string): Promise<void> {
    await this.db.user.getUser(userId);
    const query = pokemonQueries.CATCH_POKEMON;
    await this.db.executeQuery(query, [userId, pokemonName]);
    log(`User ${userId} caught a ${pokemonName}`);
  }

  async getPokemons(userId: string): Promise<Record<string, any>[]> {
    const query = pokemonQueries.GET_POKEMONS;
    return this.db.executeSelectAllQuery(query, [userId]);
  }

  async getPokemonCount(userId: string, pokemonName: string): Promise<number> {
    const query = pokemonQueries.GET_POKEMON_COUNT;
    const row = await this.db.executeSelectQuery(query, [userId, pokemonName]);
    return row ? row.pokemonCount : 0;
  }

  async sacrificePokemon(userId: string, pokemonName: string): Promise<void> {
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

  async getUniquePokemonCount(userId: string): Promise<number> {
    const query = pokemonQueries.GET_UNIQUE_POKEMON_COUNT;
    const row = await this.db.executeSelectQuery(query, [userId]);
    return row ? (row.count || 0) : 0;
  }

  async getTotalPokemonCount(userId: string): Promise<number> {
    const query = pokemonQueries.GET_TOTAL_POKEMON_COUNT;
    const row = await this.db.executeSelectQuery(query, [userId]);
    return row ? (row.count || 0) : 0;
  }

  async getUsersWithPokemon(type: string): Promise<Record<string, any>[]> {
    const query = pokemonQueries.GET_USERS_WITH_POKEMON;
    return this.db.executeSelectAllQuery(query, [type]);
  }
}

export default PokemonModel;

const Database = require('../../database/Database');

describe('PokemonModel', () => {
  let db;
  let pokemonModel;

  beforeAll(async () => {
    // Create test database using current timestamp
    const timestamp = Date.now();
    db = new Database(`./tests/temp/testPokemon-${timestamp}.db`);
    await db.ready;
    pokemonModel = db.pokemon;
  });

  afterAll(() => {
    // Close database connection and delete test database
    db.db.close();
  });

  beforeEach(async () => {
    // Clear the Pokemon table before each test
    await db.executeQuery('DELETE FROM Pokemon');
    await db.executeQuery('DELETE FROM User');
  });

  describe('catchPokemon, getPokemons, and getPokemonCount', () => {
    it('should add a new pokemon and create a new user if they dont exist', async () => {
      const userId = '123456789';
      const pokemonName = 'Vaporeon';
      await pokemonModel.catchPokemon(userId, pokemonName);
      const pokemons = await pokemonModel.getPokemons(userId);
      expect(pokemons).toHaveLength(1);
      expect(pokemons[0].pokemonName).toBe(pokemonName.toLowerCase());
      expect(pokemons[0].userId).toBe(userId);
    });

    it('should increment count instead of creating a new pokemon when catching same pokemon', async () => {
      const userId = '123456789';
      const pokemonName = 'Vaporeon';
      await pokemonModel.catchPokemon(userId, pokemonName);
      await pokemonModel.catchPokemon(userId, pokemonName);
      const count = await pokemonModel.getPokemonCount(userId, pokemonName);
      expect(count).toBe(2);
      const pokemons = await pokemonModel.getPokemons(userId);
      expect(pokemons).toHaveLength(1);
      expect(pokemons[0].pokemonName).toBe(pokemonName.toLowerCase());
      expect(pokemons[0].userId).toBe(userId);
    });

    it('should not have pokemon that is not caught', async () => {
      const userId = '123456789';
      const pokemonName = 'Vaporeon';
      const pokemons = await pokemonModel.getPokemons(userId);
      expect(pokemons).toHaveLength(0);
      const count = await pokemonModel.getPokemonCount(userId, pokemonName);
      expect(count).toBe(0);
    });
  });

  describe('sacrificePokemon', () => {
    it('should remove pokemon when sacrificing last one', async () => {
      const userId = '123456789';
      const pokemonName = 'Vaporeon';
      await pokemonModel.catchPokemon(userId, pokemonName);
      await pokemonModel.sacrificePokemon(userId, pokemonName);
      const count = await pokemonModel.getPokemonCount(userId, pokemonName);
      expect(count).toBe(0);
      const pokemons = await pokemonModel.getPokemons(userId);
      expect(pokemons).toHaveLength(0);
    });

    it('should decrement count when sacrificing one of multiple', async () => {
      const userId = '123456789';
      const pokemonName = 'Vaporeon';
      await pokemonModel.catchPokemon(userId, pokemonName);
      await pokemonModel.catchPokemon(userId, pokemonName);
      await pokemonModel.sacrificePokemon(userId, pokemonName);
      const count = await pokemonModel.getPokemonCount(userId, pokemonName);
      expect(count).toBe(1);
    });
  });

  describe('getUniquePokemonCount', () => {
    it('should return correct count of unique pokemon', async () => {
      const userId = '123456789';
      await pokemonModel.catchPokemon(userId, 'Vaporeon');
      await pokemonModel.catchPokemon(userId, 'Vaporeon');
      await pokemonModel.catchPokemon(userId, 'Meowscarada');
      const uniqueCount = await pokemonModel.getUniquePokemonCount(userId);
      expect(uniqueCount).toBe(2);
    });

    it('should return 0 for user with no pokemon', async () => {
      const userId = '123456789';
      const uniqueCount = await pokemonModel.getUniquePokemonCount(userId);
      expect(uniqueCount).toBe(0);
    });
  });

  describe('getTotalPokemonCount', () => {
    it('should return correct total count of all pokemon', async () => {
      const userId = '123456789';
      await pokemonModel.catchPokemon(userId, 'Vaporeon');
      await pokemonModel.catchPokemon(userId, 'Vaporeon');
      await pokemonModel.catchPokemon(userId, 'Meowscarada');
      const totalCount = await pokemonModel.getTotalPokemonCount(userId);
      expect(totalCount).toBe(3);
    });

    it('should return 0 for user with no pokemon', async () => {
      const userId = '123456789';
      const totalCount = await pokemonModel.getTotalPokemonCount(userId);
      expect(totalCount).toBe(0);
    });
  });

  describe('getUsersWithPokemon', () => {
    it('should return all users who have a specific pokemon', async () => {
      const pokemonName = 'Vaporeon';
      const userId1 = '123456789';
      const userId2 = '987654321';
      await pokemonModel.catchPokemon(userId1, pokemonName);
      await pokemonModel.catchPokemon(userId2, pokemonName);
      const users = await pokemonModel.getUsersWithPokemon(pokemonName);
      expect(users).toHaveLength(2);
      expect(users.map((u) => u.userId)).toContain(userId1);
      expect(users.map((u) => u.userId)).toContain(userId2);
    });

    it('should return empty array for pokemon no one has', async () => {
      const pokemonName = 'Meowscarada';
      const users = await pokemonModel.getUsersWithPokemon(pokemonName);
      expect(users).toHaveLength(0);
    });
  });
});

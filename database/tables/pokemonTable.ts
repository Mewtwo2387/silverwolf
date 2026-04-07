import type { TableDefinition } from '../types';

export interface PokemonRow {
  id: number;
  user_id: string;
  pokemon_name: string;
  pokemon_count: number;
}

const pokemonTable: TableDefinition = {
  name: 'Pokemon',
  columns: [
    { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
    { name: 'user_id', type: 'VARCHAR' },
    { name: 'pokemon_name', type: 'TEXT' },
    { name: 'pokemon_count', type: 'INTEGER DEFAULT 0' },
  ],
  primaryKey: ['id'],
  specialConstraints: [],
  constraints: [
    'FOREIGN KEY (user_id) REFERENCES User(id)',
    'UNIQUE (user_id, pokemon_name)',
  ],
};

export default pokemonTable;

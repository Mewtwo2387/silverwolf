// Render a name + count column display used by the Discord `/pokemon` listing
// and `/profile` embeds. The list is sorted alphabetically and the count is
// right-justified by padding the name to a uniform width.

interface PokemonEntry {
  pokemonName: string;
  pokemonCount: number;
}

export function formatPokemonList(pokemons: PokemonEntry[]): string {
  if (pokemons.length === 0) return '';
  const maxNameLength = Math.max(...pokemons.map((p) => p.pokemonName.length));
  return pokemons.map(
    (p) => `${p.pokemonName.padEnd(maxNameLength + 2)} ${p.pokemonCount}`,
  ).join('\n');
}

// Sort by name (mutates input array to match the previous in-place behaviour
// from /profile, which relied on the array already being sorted for the pad).
export function sortPokemons(pokemons: PokemonEntry[]): PokemonEntry[] {
  return pokemons.sort((a, b) => a.pokemonName.localeCompare(b.pokemonName));
}

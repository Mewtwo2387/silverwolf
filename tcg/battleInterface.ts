/**
 * Barrel re-export kept for backwards compatibility. The battle interface was
 * split into:
 *   - {@link ./battleCore}  — transport-agnostic actions, target resolution, demo/debug.
 *   - {@link ./battleText}  — CLI + Discord ('cli' | 'markdown') text formatters.
 *   - {@link ./battleSnapshot} — serializable DTO for the website client.
 *
 * Prefer importing from those modules directly. Discord (`discordBattle.ts`) and
 * the CLI (`tests/battleExample.ts`) already do; the `commands/tcgbattle_*.ts`
 * files import from here.
 */
export * from './battleCore';
export * from './battleText';

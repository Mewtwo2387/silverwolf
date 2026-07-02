import { Command } from './classes/Command';
import { isAdmin } from '../utils/accessControl';
import { resolveCharOption, resolveCreatorLabel } from '../utils/rpCommand';
import { refreshRpChannel } from '../utils/rpRuntime';
import { logError } from '../utils/log';

/** Removes a character from this channel. Optionally wipes its memory of the channel. */
class AiRpRemove extends Command {
  constructor(client: any) {
    super(client, 'rp-remove', 'Remove a roleplay character from this channel', [
      {
        name: 'char', description: 'Character spawned here (search by name or id)', type: 3, required: true, autocomplete: true,
      },
      {
        name: 'clear_history',
        description: 'Also wipe its memory of this channel (default: keep)',
        type: 5,
        required: false,
      },
    ], { isSubcommandOf: 'ai', blame: 'xei' });
  }

  async autocomplete(interaction: any): Promise<void> {
    try {
      const term = (interaction.options.getFocused() || '').toLowerCase();
      const spawns = await this.client.db.rp.getActiveSpawnsInChannel(interaction.channelId);
      const choices = spawns
        .filter((s: any) => !term || s.charNameLower.includes(term) || s.charId.includes(term))
        .slice(0, 25)
        .map((s: any) => ({ name: `${s.charName} · ${s.charId}`, value: s.charId }));
      await interaction.respond(choices);
    } catch (err) {
      logError('AiRpRemove autocomplete error:', err);
      await interaction.respond([]).catch(() => {});
    }
  }

  async run(interaction: any): Promise<void> {
    const character = await resolveCharOption(this.client.db, interaction.options.getString('char'));
    if (!character) {
      await interaction.editReply('No character matched that.');
      return;
    }

    const spawn = await this.client.db.rp.getSpawn(interaction.channelId, character.charId);
    if (!spawn || spawn.active !== 1) {
      await interaction.editReply(`**${character.name}** isn't spawned in this channel.`);
      return;
    }

    if (spawn.spawnerId !== interaction.user.id && !isAdmin(interaction)) {
      await interaction.editReply('Only the person who spawned it (or an admin) can remove it.');
      return;
    }

    const clearHistory = interaction.options.getBoolean('clear_history') ?? false;
    try {
      const spawnerLabel = await resolveCreatorLabel(this.client, spawn.spawnerId);
      // One atomic op: deactivate (+ optionally wipe history & compaction) together,
      // so a mid-way failure can't leave the spawn half-cleared.
      await this.client.db.rp.removeSpawn(spawn.spawnId, clearHistory);
      await refreshRpChannel(this.client.db, interaction.channelId);

      await interaction.editReply(
        `Removed **${character.name}** (spawned by ${spawnerLabel}) from this channel.${
          clearHistory
            ? ' Its memory of this channel was wiped — a fresh spawn will start over.'
            : ' Its conversation is kept and will resume if you spawn it here again.'}`,
      );
    } catch (err) {
      logError('AiRpRemove error:', err);
      await interaction.editReply('Failed to remove the character. Please try again.');
    }
  }
}

export default AiRpRemove;

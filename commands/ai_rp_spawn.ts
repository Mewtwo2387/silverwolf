import { Command } from './classes/Command';
import { MAX_SPAWNS_PER_CHANNEL, applyUserVar } from '../utils/rpIdentity';
import { resolveCharOption, buildCharSearchChoices } from '../utils/rpCommand';
import { markRpChannelActive } from '../utils/rpRuntime';
import { sendAsCharacter } from '../utils/rpDelivery';
import { logError } from '../utils/log';

/** Spawns a character into the current channel (or reconfigures an existing spawn). */
class AiRpSpawn extends Command {
  constructor(client: any) {
    super(client, 'rp-spawn', 'Spawn a roleplay character into this channel', [
      {
        name: 'char', description: 'Character to spawn (search by name or id)', type: 3, required: true, autocomplete: true,
      },
      {
        name: 'interactability',
        description: 'Who it responds to',
        type: 3,
        required: true,
        choices: [
          { name: 'self — only you can interact', value: 'self' },
          { name: 'all — anyone; it also chimes in on its own', value: 'all' },
        ],
      },
      {
        name: 'compaction',
        description: 'Auto-summarize old messages to extend memory (default: enabled)',
        type: 3,
        required: false,
        choices: [
          { name: 'enabled', value: 'enabled' },
          { name: 'disabled', value: 'disabled' },
        ],
      },
    ], { isSubcommandOf: 'ai', blame: 'xei', ephemeral: true });
  }

  async autocomplete(interaction: any): Promise<void> {
    try {
      const choices = await buildCharSearchChoices(this.client.db, this.client, interaction.options.getFocused());
      await interaction.respond(choices);
    } catch (err) {
      logError('AiRpSpawn autocomplete error:', err);
      await interaction.respond([]).catch(() => {});
    }
  }

  async run(interaction: any): Promise<void> {
    const channel = interaction.channel;
    if (!channel || typeof channel.fetchWebhooks !== 'function') {
      await interaction.editReply('Characters can only be spawned in normal text channels.');
      return;
    }

    const character = await resolveCharOption(this.client.db, interaction.options.getString('char'));
    if (!character) {
      await interaction.editReply('No character matched that. Pick one from the suggestions.');
      return;
    }

    const interactability = interaction.options.getString('interactability') as 'self' | 'all';
    const compactionEnabled = (interaction.options.getString('compaction') ?? 'enabled') === 'enabled';

    try {
      const result = await this.client.db.rp.trySpawn({
        channelId: channel.id,
        guildId: interaction.guild.id,
        charId: character.charId,
        spawnerId: interaction.user.id,
        interactability,
        compactionEnabled,
      });

      if (!result.ok) {
        await interaction.editReply(
          `This channel already has the maximum of ${MAX_SPAWNS_PER_CHANNEL} characters. `
          + 'Remove one with `/ai rp-remove` first.',
        );
        return;
      }

      markRpChannelActive(channel.id);
      const compactionLabel = compactionEnabled ? 'enabled' : 'disabled';

      if (result.reconfigured) {
        await interaction.editReply(
          `Updated **${character.name}**'s settings here — interactability **${interactability}**, compaction **${compactionLabel}**.`,
        );
        return;
      }

      const historyCount = await this.client.db.rp.countHistory(result.spawnId);

      // Brand-new conversation → post the opening message as the character.
      let openerWarning = '';
      if (historyCount === 0 && character.startingMessage) {
        // Self-mode resolves {user} to the spawner; all-mode leaves it literal.
        const spawnerName = interaction.member?.displayName || interaction.user.username;
        const startingText = interactability === 'self'
          ? applyUserVar(character.startingMessage, spawnerName)
          : character.startingMessage;
        const delivered = await sendAsCharacter({
          client: this.client,
          db: this.client.db,
          channel,
          character: {
            charId: character.charId,
            name: character.name,
            pfpUrl: character.pfpUrl,
            pfpMessageId: character.pfpMessageId,
            pfpChannelId: character.pfpChannelId,
          },
          text: startingText,
        });
        if (!delivered) {
          openerWarning = '\n\n⚠️ The spawn is active, but I couldn\'t post its opening message here — '
            + 'check that I have the **Manage Webhooks** permission in this channel.';
        }
      }

      await interaction.editReply(
        `Spawned **${character.name}** here — interactability **${interactability}**, compaction **${compactionLabel}**.${
          historyCount > 0 ? ' Resumed its existing conversation.' : ''}${openerWarning}`,
      );
    } catch (err) {
      logError('AiRpSpawn error:', err);
      await interaction.editReply('Failed to spawn the character. Please try again.');
    }
  }
}

export default AiRpSpawn;

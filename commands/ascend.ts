import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { getMaxLevel } from '../utils/upgrades';
import { format } from '../utils/math';
import { getAscensionState, processAscend } from '../utils/ascend';

class Ascend extends Command {
  constructor(client: any) {
    super(client, 'ascend', 'Ascend to reset stuff but get more stuff', [], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const state = await getAscensionState(this.client, interaction.user.id);

    if (!state.canAscend) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('Cannot ascend')
          .setDescription(`You need at least 500 dinonuggies to ascend. You have ${format(state.dinonuggies)} dinonuggies.`)
          .setFooter({ text: 'so no one ascends and complains they cant buy anything from it' })],
      });
      return;
    }

    const confirmEmbed = new Discord.EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('Ascension Confirmation')
      .setDescription(`Are you sure you want to ascend?
- Your dinonuggies (${format(state.dinonuggies)}) will be converted to ${format(state.dinonuggies)} heavenly nuggies which can be used to buy better upgrades
- All your upgrades, credits, bitcoins, dinonuggies, and streak will reset
- If you ascend with all upgrades maxed, you will gain an ascension level, which increases the level cap by 10

Your current upgrades:
• Multiplier amount: ${state.multiplierAmountLevel}/${state.currentMaxLevel}
• Multiplier rarity: ${state.multiplierRarityLevel}/${state.currentMaxLevel}
• Beki cooldown: ${state.bekiLevel}/${state.currentMaxLevel}

${state.allMaxed ? `Your ascension level will increase from ${state.ascensionLevel} to ${state.ascensionLevel + 1} if you ascend now, allowing you to buy upgrades up to level ${getMaxLevel(state.ascensionLevel + 1)}` : `Your ascension level will remain at ${state.ascensionLevel} as not all upgrades are maxed.`}`)
      .setFooter({ text: 'what even is this game now' });

    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId('confirm_ascend')
          .setLabel('Confirm')
          .setStyle(Discord.ButtonStyle.Success),
        new Discord.ButtonBuilder()
          .setCustomId('cancel_ascend')
          .setLabel('Cancel')
          .setStyle(Discord.ButtonStyle.Danger),
      );

    const confirmMessage = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row],
    });

    const filter = (i: any) => ['confirm_ascend', 'cancel_ascend'].includes(i.customId) && i.user.id === interaction.user.id;
    const collector = confirmMessage.createMessageComponentCollector({ filter, time: 30000 });

    let clicked = false;
    collector.on('collect', async (i: any) => {
      clicked = true;
      await confirmMessage.edit({ components: [] });

      if (i.customId === 'confirm_ascend') {
        const result = await processAscend(this.client, interaction.user.id);

        if (result.status === 'too_few') {
          await interaction.followUp({
            embeds: [new Discord.EmbedBuilder()
              .setColor('#FFA500')
              .setTitle('Cannot ascend')
              .setDescription(`You need at least 500 dinonuggies to ascend. You have ${format(result.dinonuggies)} dinonuggies.`)
              .setFooter({ text: 'so no one ascends and complains they cant buy anything from it' })],
          });
          return;
        }

        const resultEmbed = new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('Ascension Successful!')
          .setDescription(`You have ascended!
- Gained ${format(result.gained)} heavenly nuggies
- All other stuff reset
${result.allMaxed ? `- Ascension level increased to ${result.ascensionLevel}` : '- Ascension level remained the same'}
- New max level: ${result.newMaxLevel}`)
          .setFooter({ text: 'what even is this game now' });

        await interaction.followUp({ embeds: [resultEmbed] });
      } else {
        await interaction.followUp({ content: 'Ascension cancelled.', embeds: [] });
      }
    });

    collector.on('end', async () => {
      if (!clicked) {
        await interaction.followUp({ content: 'Ascension timed out', embeds: [] });
      }
    });
  }
}

export default Ascend;

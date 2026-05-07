import * as Discord from 'discord.js';
import { format } from '../utils/math';
import { Command } from './classes/Command';
import {
  getNuggieFlatMultiplierInfo,
  getNuggieStreakMultiplierInfo,
  getNuggieCreditsMultiplierInfo,
  getNuggiePokeMultiplierInfo,
  getNuggieNuggieMultiplierInfo,
} from '../utils/ascensionupgradesInfo';
import { INFO_LEVEL } from '../utils/upgradesInfo';
import { processBuyAscensionUpgrade } from '../utils/buyAscensionUpgrade';

class BuyAscension extends Command {
  constructor(client: any) {
    super(client, 'ascension', 'buy ascension upgrades', [
      {
        name: 'upgrade',
        description: 'The upgrade to buy',
        type: 4,
        required: true,
      },
      {
        name: 'amount',
        description: 'The number of levels to buy at once',
        type: 4,
        required: false,
      },
    ], { isSubcommandOf: 'buy', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const upgradeId = interaction.options.getInteger('upgrade');
    const amount = interaction.options.getInteger('amount') || 1;

    const result = await processBuyAscensionUpgrade(
      this.client,
      interaction.user.id,
      upgradeId,
      amount,
    );

    if (result.status === 'invalid_upgrade' || result.status === 'invalid_amount') {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid upgrade')
          .setFooter({ text: 'dinonuggie' }),
        ],
      });
      return;
    }

    if (result.status === 'locked') {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You cannot buy this upgrade!')
          .setDescription(`You need to be at least ascension ${result.required} to buy this upgrade. You are currently at ascension ${result.ascensionLevel}`)
          .setFooter({ text: 'dinonuggie' }),
        ],
      });
      return;
    }

    if (result.status === 'poor') {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You dont have enough heavenly nuggies')
          .setDescription(`You have ${format(result.heavenlyNuggies)} heavenly nuggies, but you need ${format(result.cost)} to buy ${amount > 1 ? `${amount} upgrades` : 'the upgrade'}`)
          .setFooter({ text: 'heavenly nuggies can be obtained by /ascend' }),
        ],
      });
      return;
    }

    const {
      upgrade, level, cost, heavenlyNuggies,
    } = result;

    const heavenlyAfter = `Heavenly Nuggies: ${format(heavenlyNuggies)} -> ${format(heavenlyNuggies - cost)}`;

    switch (upgrade) {
      case 'nuggieFlatMultiplier':
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Flat Multiplier Upgrade Bought')
            .setDescription(`${getNuggieFlatMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
${heavenlyAfter}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'nuggieStreakMultiplier':
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Streak Multiplier Upgrade Bought')
            .setDescription(`${getNuggieStreakMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
${heavenlyAfter}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'nuggieCreditsMultiplier':
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Credits Multiplier Upgrade Bought')
            .setDescription(`${getNuggieCreditsMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
${heavenlyAfter}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'nuggiePokeMultiplier':
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie PokeMultiplier Upgrade Bought')
            .setDescription(`${getNuggiePokeMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
${heavenlyAfter}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'nuggieNuggieMultiplier':
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Nuggie Nuggie Multiplier Upgrade Bought')
            .setDescription(`${getNuggieNuggieMultiplierInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
${heavenlyAfter}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      default:
        break;
    }
  }
}

export default BuyAscension;

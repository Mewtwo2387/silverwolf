import * as Discord from 'discord.js';
import { format } from '../utils/math';
import { Command } from './classes/Command';
import {
  getMultiplierChanceInfo,
  getBekiCooldownInfo,
  getMultiplierAmountInfo,
  INFO_LEVEL,
} from '../utils/upgradesInfo';
import { processBuyUpgrade } from '../utils/buyUpgrade';

class BuyUpgrades extends Command {
  constructor(client: any) {
    super(client, 'upgrades', 'buy upgrades', [
      {
        name: 'upgrade',
        description: 'The upgrade to buy',
        type: 4,
        required: true,
      },
      {
        name: 'amount',
        description: 'The amount to buy',
        type: 4,
        required: false,
      },
    ], { isSubcommandOf: 'buy', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const upgradeId = interaction.options.getInteger('upgrade');
    const amount = interaction.options.getInteger('amount') || 1;

    const result = await processBuyUpgrade(this.client, interaction.user.id, upgradeId, amount);

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

    if (result.status === 'maxed') {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Upgrade maxed')
          .setDescription('how far do you even want to go')
          .setFooter({ text: 'increase the cap by ascending' }),
        ],
      });
      return;
    }

    if (result.status === 'too_many') {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You cannot buy this much')
          .setDescription(`The cap is ${result.maxLevel}, and you are at ${result.level}. You cannot buy more than ${result.maxLevel - result.level} upgrades.`)
          .setFooter({ text: 'increase the cap by ascending' }),
        ],
      });
      return;
    }

    if (result.status === 'poor') {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You dont have enough mystic credits')
          .setDescription(`You have ${format(result.credits)} mystic credits, but you need ${format(result.cost)} to buy the upgrade`)
          .setFooter({ text: 'Credits can sometimes be found when you /eat nuggies. You can also gamble them with /slots or invest them with /buybitcoin' }),
        ],
      });
      return;
    }

    const {
      upgrade, level, cost, credits,
    } = result;

    switch (upgrade) {
      case 'multiplierAmount':
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Multiplier Amount Upgrade Bought')
            .setDescription(`${getMultiplierAmountInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'multiplierRarity':
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Multiplier Rarity Upgrade Bought')
            .setDescription(`${getMultiplierChanceInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      case 'beki':
        await interaction.editReply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Beki Upgrade Bought')
            .setDescription(`${getBekiCooldownInfo(level, INFO_LEVEL.NEXT_LEVEL, amount)}
Mystic Credits: ${format(credits)} -> ${format(credits - cost)}`)
            .setFooter({ text: 'dinonuggie' }),
          ],
        });
        break;
      default:
        throw new Error('Unreachable code');
    }
  }
}

export default BuyUpgrades;

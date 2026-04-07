import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { Bitcoin } from '../classes/bitcoin';
import { log, logError } from '../utils/log';

class BitcoinPrice extends Command {
  constructor(client: any) {
    super(client, 'bitcoinprice', 'Fetches the current Bitcoin price', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    try {
      const bitcoin = new Bitcoin();
      const data = await bitcoin.getData();

      if (!data) {
        await interaction.editReply({ content: 'Failed to retrieve Bitcoin price - Empty response from API', ephemeral: true });
        return;
      }

      const date = new Date(data.time.updatedISO);

      const embed = new Discord.EmbedBuilder()
        .setTitle('Current Bitcoin Price')
        .setDescription(`As of ${date.toLocaleString()}`)
        .setFooter({ text: data.disclaimer, iconURL: 'https://th.bing.com/th/id/R.4077e337bac40b4e403a6ac336ac44b5?rik=uJ8OajioCe%2b%2b5g&riu=http%3a%2f%2ftech.eu%2fwp-content%2fuploads%2f2014%2f04%2fbitcoin.jpg&ehk=ON6Qtu9zJQwNIkoWtVz%2fy2pkZ8bITim2azHWPWkyoY4%3d&risl=&pid=ImgRaw&r=0' });

      const fields: { name: string; value: string; inline: boolean }[] = [];
      Object.keys(data.bpi).forEach((currency) => {
        const priceData = data.bpi[currency];
        fields.push({
          name: `${priceData.code} (${priceData.symbol})`,
          value: `**Rate:** ${priceData.rate} ${priceData.symbol}`,
          inline: true,
        });
      });

      log(`Current Bitcoin price: ${data.bpi.USD.rate} ${data.bpi.USD.symbol}`);

      embed.addFields(fields);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error fetching Bitcoin price:', error);
      if (!interaction.replied) {
        await interaction.editReply({ content: 'Failed to retrieve Bitcoin price. Please try again later.', ephemeral: true });
      }
    }
  }
}

export default BitcoinPrice;

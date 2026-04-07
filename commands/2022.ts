import * as Discord from 'discord.js';
import quotes from '../data/2022.json';
import { Command } from './classes/Command';

class TwentyTwentyTwo extends Command {
  constructor(client: any) {
    super(client, '2022', '2022 flashbacks', [], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const quote = (quotes as any[])[Math.floor(Math.random() * quotes.length)];
    const embed = new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setDescription(`*"${quote.quote}"* - ${quote.author}`);
    if (quote.reply !== undefined) {
      embed.setDescription(`*"${quote.quote}"* - ${quote.author}\n*"${quote.reply}"* - ${quote.replyauthor}`);
    }
    interaction.editReply({ embeds: [embed] });
  }
}

export default TwentyTwentyTwo;

import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { format } from '../utils/math';
import { processEat, formatEatItemLine } from '../utils/eat';

class Eat extends Command {
  constructor(client: any) {
    super(client, 'eat', 'Eat one or more dinonuggies', [
      {
        name: 'amount',
        description: 'The amount of dinonuggies to eat',
        type: 4,
        required: false,
      },
    ], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const amount = interaction.options.getInteger('amount') || 1;
    const result = await processEat(this.client, interaction.user.id, amount);

    if (result.status === 'invalid_amount') {
      await interaction.editReply('Please provide a positive integer amount.');
      return;
    }

    if (result.status === 'not_enough') {
      await interaction.editReply("smh you don't have enough dinonuggies to eat.");
      return;
    }

    if (result.status === 'cheat') {
      await interaction.editReply(`You ate ${amount} dinonuggies! You now have ${result.dinonuggies - amount} dinonuggies.`);
      setTimeout(() => {
        interaction.followUp("You're spotted cheating. Your dinonuggies have been reset to 0.");
      }, 5000);
      setTimeout(() => {
        interaction.followUp('/s');
      }, 15000);
      return;
    }

    if (result.status === 'single') {
      await interaction.editReply(formatEatItemLine(result.item));
      return;
    }

    let message = '';
    for (const item of result.items) {
      message += `- ${formatEatItemLine(item)}\n`;
    }
    message += '\n';
    if (result.remainingLost > 0) {
      message += `You lost the remaining ${result.remainingLost} dinonuggies.\n`;
    }
    if (result.totalEarned > 0) {
      message += `You earned a total of ${format(result.totalEarned)} mystic credits.\n`;
    }
    if (result.totalNuggiesEarned > 0) {
      message += `You earned a total of ${result.totalNuggiesEarned} dinonuggies.\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`You tried eating ${amount} dinonuggies`)
      .setDescription(message);

    await interaction.editReply({ embeds: [embed] });
  }
}

export default Eat;

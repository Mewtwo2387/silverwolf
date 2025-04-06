const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');
const { format } = require('../utils/math.js');

class Eat extends Command {
  constructor(client) {
    super(client, 'eat', 'Eat one or more dinonuggies', [
      {
        name: 'amount',
        description: 'The amount of dinonuggies to eat',
        type: 4, // INTEGER type
        required: false,
      },
    ]);
  }

  async run(interaction) {
    const amount = interaction.options.getInteger('amount') || 1; // Default to 1 if no amount is provided
    const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');

    // Check if the user has enough dinonuggies
    if (dinonuggies < amount) {
      await interaction.editReply("smh you don't have enough dinonuggies to eat.");
      return;
    }

    // If the amount is less than 0, handle as cheating case
    if (amount < 0) {
      await interaction.editReply(`You ate ${amount} dinonuggies! You now have ${dinonuggies - amount} dinonuggies.`);
      setTimeout(() => {
        interaction.followUp("You're spotted cheating. Your dinonuggies have been reset to 0.");
      }, 5000);
      setTimeout(() => {
        interaction.followUp('/s');
      }, 15000);
      return;
    }

    // Deduct the amount from user's dinonuggies
    await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', -amount);

    // For a single dinonuggie (default case)
    if (amount === 1) {
      const rand = Math.random();
      if (rand < 0.2) {
        const earned = 2000 + Math.floor(Math.random() * 1000);
        await interaction.editReply(`You found a hidden mystichunterzium nugget in the dinonuggie! You earned ${format(earned)} mystic credits.`);
        await this.client.db.addUserAttr(interaction.user.id, 'credits', earned);
      } else if (rand < 0.25) {
        const earned = 5000 + Math.floor(Math.random() * 2000);
        await interaction.editReply(`You found a huge mystichunterzium nugget in the dinonuggie! You earned ${format(earned)} mystic credits.`);
        await this.client.db.addUserAttr(interaction.user.id, 'credits', earned);
      } else if (rand < 0.35) {
        await interaction.editReply('You choked on the dinonuggie and died.');
      } else if (rand < 0.45) {
        await interaction.editReply("You found 2 dinonuggies in the dinonuggie! I don't know how that works, it just does.");
        await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', 2);
      } else if (rand < 0.48) {
        await interaction.editReply('You found 5 dinonuggies in the dinonuggie! Uhmmm what?');
        await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', 5);
      } else {
        await interaction.editReply('nom nom nom');
      }
      return;
    }

    // For eating multiple dinonuggies
    let message = '';
    let totalEarned = 0;
    let totalNuggiesEarned = 0;
    let remaining = amount;

    while (remaining > 0) {
      remaining--;
      const rand = Math.random();
      if (rand < 0.2) {
        const earned = 2000 + Math.floor(Math.random() * 1000);
        message += `- You found a hidden mystichunterzium nugget in the dinonuggie! You earned ${format(earned)} mystic credits.\n`;
        totalEarned += earned;
      } else if (rand < 0.25) {
        const earned = 5000 + Math.floor(Math.random() * 2000);
        message += `- You found a huge mystichunterzium nugget in the dinonuggie! You earned ${format(earned)} mystic credits.\n`;
        totalEarned += earned;
      } else if (rand < 0.35) {
        message += '- You choked on the dinonuggie and died.\n';
        break;
      } else if (rand < 0.45) {
        message += "- You found 2 dinonuggies in the dinonuggie! I don't know how that works, it just does.\n";
        totalNuggiesEarned += 2;
      } else if (rand < 0.48) {
        message += '- You found 5 dinonuggies in the dinonuggie! Uhmmm what?\n';
        totalNuggiesEarned += 5;
      } else {
        message += '- nom nom nom\n';
      }
    }

    message += '\n';

    if (remaining > 0) {
      message += `You lost the remaining ${remaining} dinonuggies.\n`;
    }

    if (totalEarned > 0) {
      message += `You earned a total of ${format(totalEarned)} mystic credits.\n`;
      await this.client.db.addUserAttr(interaction.user.id, 'credits', totalEarned);
    }

    if (totalNuggiesEarned > 0) {
      message += `You earned a total of ${totalNuggiesEarned} dinonuggies.\n`;
      await this.client.db.addUserAttr(interaction.user.id, 'dinonuggies', totalNuggiesEarned);
    }

    const embed = new EmbedBuilder()
      .setColor('#00AA00')
      .setTitle(`You tried eating ${amount} dinonuggies`)
      .setDescription(message);

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = Eat;

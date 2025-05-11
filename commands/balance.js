const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const { log } = require('../utils/log');

class Balance extends Command {
  constructor(client) {
    super(client, 'balance', 'check your mystic credits and bitcoin', []);
  }

  async run(interaction) {
    const credits = await this.client.db.getUserAttr(interaction.user.id, 'credits');
    const bitcoin = await this.client.db.getUserAttr(interaction.user.id, 'bitcoin');
    const dinonuggies = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies');
    const dinonuggies_streak = await this.client.db.getUserAttr(interaction.user.id, 'dinonuggies_claim_streak');
    const heavenly_nuggies = await this.client.db.getUserAttr(interaction.user.id, 'heavenly_nuggies');
    log(`${interaction.user.username} have ${format(credits)} mystic credits, ${bitcoin} bitcoin, ${format(dinonuggies)} dinonuggies, and ${format(heavenly_nuggies)} heavenly nuggies`);
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`You have ${format(credits)} mystic credits, ${bitcoin} bitcoin, ${format(dinonuggies)} dinonuggies, and ${format(heavenly_nuggies)} heavenly nuggies`)
        .setDescription(`Exact Credits: ${format(credits, false, 1000)}
Exact Nuggies: ${format(dinonuggies, false, 1000)}
Dinonuggies claim streak: ${dinonuggies_streak}`)
        .setFooter({ text: 'mommy mystic uwu' }),
      ],
    });
  }
}

module.exports = Balance;

const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const { log } = require('../utils/log');

class Balance extends Command {
  constructor(client) {
    super(client, 'balance', 'check your mystic credits and bitcoin', [
      {
        name: 'member',
        description: 'member to check the balance of (default: you)',
        type: 6,
        required: false,
      },
    ]);
  }

  async run(interaction) {
    const member = interaction.options.getMember('member') || interaction.user;
    log(JSON.stringify(member));
    const isSelf = member.id === interaction.user.id;
    const credits = await this.client.db.user.getUserAttr(member.id, 'credits');
    const bitcoin = await this.client.db.user.getUserAttr(member.id, 'bitcoin');
    const dinonuggies = await this.client.db.user.getUserAttr(member.id, 'dinonuggies');
    const dinonuggiesStreak = await this.client.db.user.getUserAttr(member.id, 'dinonuggiesClaimStreak');
    const heavenlyNuggies = await this.client.db.user.getUserAttr(member.id, 'heavenlyNuggies');

    const name = member.username ? member.username : member.displayName;
    log(`${name} have ${format(credits)} mystic credits, ${bitcoin} bitcoin, ${format(dinonuggies)} dinonuggies, and ${format(heavenlyNuggies)} heavenly nuggies`);
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`${isSelf ? 'You' : name} have ${format(credits)} mystic credits, ${bitcoin} bitcoin, ${format(dinonuggies)} dinonuggies, and ${format(heavenlyNuggies)} heavenly nuggies`)
        .setDescription(`Exact Credits: ${format(credits, false, 1000)}
Exact Nuggies: ${format(dinonuggies, false, 1000)}
Dinonuggies claim streak: ${dinonuggiesStreak}`)
        .setFooter({ text: 'mommy mystic uwu' }),
      ],
    });
  }
}

module.exports = Balance;

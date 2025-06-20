const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { log } = require('../utils/log');

class SexThrust extends Command {
  constructor(client) {
    super(client, 'thrust', 'In... and out', [], { isSubcommandOf: 'sex' });
  }

  async run(interaction) {
    if (!this.client.sexSessions.some((s) => s.hasUser(interaction.user.id))) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You\'re not fucking anyone!')
          .setFooter({ text: 'start a sex session with /sex start' })],
      });
      return;
    }

    const session = this.client.sexSessions.find((s) => s.hasUser(interaction.user.id));

    if (session.thrust()) {
      log('Ejaculated!');
      let footer = '';
      if (session.thrusts < 30) {
        footer = (Math.random() < 0.5) ? 'so quick smh' : 'that was fast';
      } else if (session.thrusts < 60) {
        footer = 'mmmwwahhh';
      } else if (session.thrusts < 100) {
        footer = 'woah, you lasted quite a while';
      } else {
        footer = 'holy shit, you lasted forever';
      }
      this.client.sexSessions = this.client.sexSessions.filter((s) => s !== session);
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('You ejaculated!')
          .setDescription(`Total thrusts: ${session.thrusts}`)
          .setFooter({ text: footer }),
        ],
      });

      const fatherId = interaction.user.id;
      const motherId = session.otherUser(fatherId);

      if (Math.random() < 0.5) {
        await interaction.followUp({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Oh...')
            .setDescription(`<@${motherId}> is pregnant! Check /baby get to see your babies!`),
          ],
        });
        await this.client.db.baby.createBaby(motherId, fatherId);
      }

      return;
    }

    const responses = [
      'Mwwaahhhh!',
      'More...',
      "Please don't stop...",
      'Deeper...',
      'Faster...',
      'Harder...',
      'Please~ More~',
    ];
    await interaction.editReply({
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(responses[Math.floor(Math.random() * responses.length)])],
    });
  }
}

module.exports = SexThrust;

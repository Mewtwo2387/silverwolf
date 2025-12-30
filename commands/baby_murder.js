const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');

const COOLDOWN = 1000 * 60 * 60 * 24; // 1 day

class BabyMurder extends Command {
  constructor(client) {
    super(
      client,
      'murder',
      'kill a baby (omba told me to add this)',
      [
        {
          name: 'id',
          description: 'The id of the baby',
          type: 4,
        },
      ],
      { isSubcommandOf: 'baby', blame: 'ei' },
    );
  }

  async run(interaction) {
    const babyId = interaction.options.getInteger('id');
    const baby = await this.client.db.baby.getBabyById(babyId);

    if (!baby) {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Invalid baby id!')
            .setFooter({ text: 'Check baby id with /baby get' }),
        ],
      });
    }

    if (baby.status === 'unborn') {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('You can\'t murder an unborn baby!'),
        ],
      });
      return;
    }

    if (baby.status === 'dead') {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('You can\'t murder a dead baby!'),
        ],
      });
      return;
    }

    const lastMurder = await this.client.db.user.getUserAttr(interaction.user.id, 'lastMurder');
    const now = new Date();

    const diffTime = lastMurder ? now - lastMurder : COOLDOWN;

    if (diffTime < COOLDOWN) {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`You can murder again in ${format(COOLDOWN / 1000 / 60 / 60, true)} hours.`),
        ],
      });
      return;
    }

    if (Math.random() < 0.5) {
      await this.client.db.baby.updateBabyStatus(babyId, 'dead');
      await this.client.db.user.setUserAttr(interaction.user.id, 'lastMurder', Date.now());
      await this.client.db.user.addUserAttr(interaction.user.id, 'murderSuccess', 1);
      await interaction.editReply({
        content: `You killed ${baby.name}!
<@${baby.motherId}> <@${baby.fatherId}> look at this murderer`,
      });
    } else {
      const dinonuggies = await this.client.db.user.getUserAttr(interaction.user.id, 'dinonuggies');
      await this.client.db.user.setUserAttr(interaction.user.id, 'dinonuggies', 0);
      const credits = await this.client.db.user.getUserAttr(interaction.user.id, 'credits');
      await this.client.db.user.setUserAttr(interaction.user.id, 'credits', 0);
      await this.client.db.user.setUserAttr(interaction.user.id, 'lastMurder', Date.now());
      await this.client.db.user.addUserAttr(interaction.user.id, 'murderFail', 1);
      await interaction.editReply({
        content: `You tried killing ${baby.name}, but ${baby.name} killed you instead! You lost ${format(dinonuggies)} dinonuggies and ${format(credits)} credits!
<@${baby.motherId}> <@${baby.fatherId}> look at this guy trying to murder your baby`,
      });
    }
  }
}

module.exports = BabyMurder;

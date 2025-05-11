const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');

const PREGNANCY_DURATION = 7 * 24 * 60 * 60 * 1000;

class BabyBirth extends Command {
  constructor(client) {
    super(client, 'birth', 'give birth to your baby', [
      {
        name: 'id',
        description: 'The id of the baby',
        type: 4,
        required: true,
      },
    ], { isSubcommandOf: 'baby' });
  }

  async run(interaction) {
    const userId = interaction.user.id;
    const babyId = interaction.options.getInteger('id');
    const baby = await this.client.db.getBabyFromId(babyId);

    if (!baby) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Invalid baby id!')
            .setFooter({ text: 'Check your baby id with /baby get' }),
        ],
      });
      return;
    }

    if (baby.mother_id != userId) {
      if (baby.father_id == userId) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('You are not the mother of this baby!')
              .setDescription('Fun fact: Only mothers can give birth.'),
          ],
        });
        return;
      }
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('This is not your baby smh smh')
            .setFooter({ text: 'Check your baby id with /baby get' }),
        ],
      });
      return;
    }

    if (baby.status != 'unborn') {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Your baby is already born!'),
        ],
      });
      return;
    }

    const created = new Date(baby.created);
    const now = new Date();

    const diffTime = Math.abs(now - created);

    if (diffTime < PREGNANCY_DURATION) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Your baby is not ready to be born yet!')
            .setDescription(`Can give birth in ${format(Math.ceil((PREGNANCY_DURATION - diffTime) / (1000 * 60 * 60 * 24)), true)} days!`),
        ],
      });
      return;
    }

    await this.client.db.bornBaby(userId, babyId);
    await this.client.db.levelUpBaby(babyId);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('Green')
          .setTitle('Congratulations!')
          .setDescription(`**${baby.name}** has been born!`),
      ],
    });
  }
}

module.exports = BabyBirth;

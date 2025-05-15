const Discord = require('discord.js');
const { Command } = require('./classes/command');

class BabyName extends Command {
  constructor(client) {
    super(client, 'name', 'name your baby', [
      {
        name: 'id',
        description: 'The id of the baby',
        type: 4,
        required: true,
      },
      {
        name: 'name',
        description: 'The name of the baby',
        type: 3,
        required: true,
      },
    ], { isSubcommandOf: 'baby' });
  }

  async run(interaction) {
    const name = interaction.options.getString('name');
    const babyId = interaction.options.getInteger('id');

    const baby = await this.client.db.getBabyFromId(babyId);

    if (!baby) {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Invalid baby id!')
            .setFooter({ text: 'Check your baby id with /baby get' }),
        ],
      });
      return;
    }

    if (baby.motherId != interaction.user.id && baby.fatherId != interaction.user.id) {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('This is not your baby smh smh')
            .setFooter({ text: 'Check your baby id with /baby get' }),
        ],
      });
      return;
    }

    await this.client.db.nameBaby(babyId, name);

    await interaction.editReply({
      embeds: [
        new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle(`Baby ${babyId} is now named ${name}!`)
          .setDescription(`Mother: <@${baby.motherId}>\nFather: <@${baby.fatherId}>\nStatus: ${baby.status}`),
      ],
    });
  }
}

module.exports = BabyName;

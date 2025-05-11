const Discord = require('discord.js');
const { Command } = require('./classes/command');

const jobs = [
  {
    name: 'Nuggie Claimer',
    value: 'nuggie_claimer',
    description: 'Auto claim nuggies every 24 hours, for an amount equivalent to no streak and no bronze/silver/gold.',
  },
  {
    name: 'Gambler',
    value: 'gambler',
    description: 'Auto bet on red once every 10 minutes, using 1% of your credits each time.',
  },
  {
    name: 'Pinger',
    value: 'pinger',
    description: 'Ping someone of your choice every day.',
  },
];

class BabyEnslave extends Command {
  constructor(client) {
    super(client, 'enslave', 'enslave a baby', [
      {
        name: 'id',
        description: 'The id of the baby',
        type: 4,
        required: true,
      },
      {
        name: 'job',
        description: 'The job to force the baby to do',
        type: 3,
        required: true,
        choices: jobs,
      },
      {
        name: 'pinger_target',
        description: 'The user to ping if the job is pinger',
        type: 6,
        required: false,
      },
    ], { isSubcommandOf: 'baby' });
  }

  async run(interaction) {
    const babyId = interaction.options.get('id').value;
    const job = interaction.options.get('job').value;

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

    if (baby.mother_id != interaction.user.id && baby.father_id != interaction.user.id) {
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

    if (baby.status == 'unborn') {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('This baby is not born yet!'),
        ],
      });
      return;
    }

    if (baby.status == 'dead') {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('This baby is dead!'),
        ],
      });
      return;
    }

    if (job == 'pinger') {
      const pingerTarget = interaction.options.get('pinger_target');
      if (!pingerTarget) {
        await interaction.editReply({
          embeds: [
            new Discord.EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('No pinger target provided!'),
          ],
        });
        return;
      }
      await this.client.db.updateBabyJob(babyId, job, pingerTarget.value, interaction.channel.id);
    } else {
      await this.client.db.updateBabyJob(babyId, job);
    }

    await interaction.editReply({
      embeds: [
        new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle(`${baby.name} is now a ${jobs.find((j) => j.value === job).name}!`)
          .setDescription(jobs.find((j) => j.value === job).description),
      ],
    });
  }
}

module.exports = BabyEnslave;

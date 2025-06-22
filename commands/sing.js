const Discord = require('discord.js');
const songs = require('../data/songs.json');
const { Command } = require('./classes/command');

class Sing extends Command {
  constructor(client) {
    super(
      client,
      'sing',
      'sing a song',
      [{
        name: 'song',
        description: 'song to sing',
        type: 3,
        required: true,
        choices: [
          { name: 'If I Can Stop One Heart From Breaking', value: 'ifICanStopOneHeartFromBreaking' },
          { name: 'Unauthorized Access', value: 'unauthorizedAccess' },
          { name: 'Fly Me To The Moon', value: 'flyMeToTheMoon' },
          { name: 'Women cheat', value: 'WomenCheat' },
          { name: 'All I Want for Christmas Is You', value: 'AllIWantforChristmasIsYou' },
        ],
      }],
    );
  }

  async run(interaction) {
    if (this.client.singing) {
      const embed = new Discord.EmbedBuilder()
        .setColor('#AA0000')
        .setTitle('No.')
        .setDescription('Another song is in progress');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    this.client.singing = true;

    const song = interaction.options.getString('song');
    const lyrics = songs[song];

    await interaction.editReply(lyrics[0]);

    const delay = (ms) => new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

    await lyrics.slice(1).reduce(async (promise, lyric) => {
      await promise;
      await delay(1000);
      return interaction.channel.send(lyric);
    }, Promise.resolve());

    this.client.singing = false;
  }
}

module.exports = Sing;

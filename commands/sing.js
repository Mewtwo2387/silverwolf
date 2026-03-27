const songs = require('../data/songs.json');
const { Command } = require('./classes/command');

const songChoices = Object.keys(songs).map((key) => {
  const name = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
  return {
    name,
    value: key,
  };
});

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
        choices: songChoices,
      }],
      { blame: 'both' },
    );
  }

  async run(interaction) {
    if (this.client.singing) {
      await interaction.editReply({
        content: 'Lettme finish this one first. I only have one mouth.',
      }); return;
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

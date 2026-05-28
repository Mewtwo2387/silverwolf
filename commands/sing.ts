import songsData from '../data/songs.json';
import { Command } from './classes/Command';

type Song = { name: string; lyrics: string[] };
const songs = songsData as Record<string, Song>;

const songChoices = Object.entries(songs).map(([key, song]) => ({
  name: song.name,
  value: key,
}));

class Sing extends Command {
  constructor(client: any) {
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

  async run(interaction: any): Promise<void> {
    if (this.client.singing) {
      await interaction.editReply({
        content: 'Lettme finish this one first. I only have one mouth.',
      }); return;
    }
    this.client.singing = true;
    const song = interaction.options.getString('song');
    const lyrics = songs[song].lyrics;
    await interaction.editReply(lyrics[0]);
    const delay = (ms: number) => new Promise((resolve) => {
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

export default Sing;

import { Command } from './classes/Command';
import { logError } from '../utils/log';

class Joke extends Command {
  constructor(client: any) {
    super(client, 'randomjoke', 'A random joke just like your existence that nobody asked for', [], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const jokeUrl = 'https://official-joke-api.appspot.com/random_joke';

    try {
      const response = await fetch(jokeUrl);
      if (!response.ok) throw new Error('Failed to fetch joke');
      const data = await response.json() as { setup: string; punchline: string };

      await interaction.editReply({ content: data.setup });

      setTimeout(() => {
        interaction.followUp({ content: data.punchline });
      }, 2000);
    } catch (error) {
      logError('Failed to retrieve joke:', error);
      await interaction.editReply({ content: 'Failed to retrieve joke. Please try again later.', ephemeral: true });
    }
  }
}

export default Joke;

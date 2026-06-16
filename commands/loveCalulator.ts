import { Command } from './classes/Command';
import { computeLoveCompatibility, lovePhraseFor } from '../utils/loveCalculator';

class LoveCalculator extends Command {
  constructor(client: any) {
    super(client, 'love-calculator', 'Calculate love compatibility between two members', [
      {
        name: 'input1',
        description: 'The first input (user mention or string)',
        type: 3,
        required: true,
      },
      {
        name: 'input2',
        description: 'The second input (user mention or string)',
        type: 3,
        required: true,
      },
    ], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    let input1 = interaction.options.getString('input1');
    let input2 = interaction.options.getString('input2');

    const replaceMentionWithUsername = async (input: string): Promise<string> => {
      const mentionRegex = /<@!?(\d+)>/;
      const match = input.match(mentionRegex);
      if (match) {
        try {
          const userId = match[1];
          const member = await interaction.guild.members.fetch(userId);
          return input.replace(mentionRegex, member.user.username);
        } catch {
          return input;
        }
      }
      return input;
    };

    input1 = await replaceMentionWithUsername(input1);
    input2 = await replaceMentionWithUsername(input2);

    const percentage = computeLoveCompatibility(input1, input2);
    const phrase = lovePhraseFor(percentage);

    await interaction.editReply({
      content: `${input1} ❤️ ${input2}: ${percentage}% compatibility\n${phrase}`,
    });
  }
}

export default LoveCalculator;

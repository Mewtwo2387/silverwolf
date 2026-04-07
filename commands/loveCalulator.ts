import crypto from 'crypto';
import { Command } from './classes/Command';

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

    const sortedInputs = [input1.toLowerCase(), input2.toLowerCase()].sort().join('');
    const hash = crypto.createHash('md5').update(sortedInputs).digest('hex');
    const percentage = parseInt(hash.slice(0, 4), 16) % 101;

    let phrase = '';
    if (percentage <= 20) {
      phrase = 'Chances are low, but never zero!';
    } else if (percentage <= 40) {
      phrase = 'You might be better off as friends.';
    } else if (percentage <= 60) {
      phrase = "There's something there... maybe!";
    } else if (percentage <= 80) {
      phrase = "Looks like there's some potential!";
    } else {
      phrase = 'True love! Get ready for the wedding bells!';
    }

    await interaction.editReply({
      content: `${input1} ❤️ ${input2}: ${percentage}% compatibility\n${phrase}`,
    });
  }
}

export default LoveCalculator;

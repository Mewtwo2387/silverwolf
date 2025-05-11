const crypto = require('crypto');
const { Command } = require('./classes/command');

class LoveCalculator extends Command {
  constructor(client) {
    super(client, 'love-calculator', 'Calculate love compatibility between two members', [
      {
        name: 'input1',
        description: 'The first input (user mention or string)',
        type: 3, // String type
        required: true,
      },
      {
        name: 'input2',
        description: 'The second input (user mention or string)',
        type: 3, // String type
        required: true,
      },
    ]);
  }

  async run(interaction) {
    let input1 = interaction.options.getString('input1');
    let input2 = interaction.options.getString('input2');

    // Helper function to extract user from mention and replace it with the username
    const replaceMentionWithUsername = async (input) => {
      const mentionRegex = /<@!?(\d+)>/; // Matches user mentions
      const match = input.match(mentionRegex);
      if (match) {
        try {
          const userId = match[1]; // Extract the user ID
          const member = await interaction.guild.members.fetch(userId);
          return input.replace(mentionRegex, member.user.username); // Replace mention with username
        } catch {
          return input; // If user not found, return the input as is
        }
      }
      return input;
    };

    // Replace mentions with usernames if they exist in both inputs
    input1 = await replaceMentionWithUsername(input1);
    input2 = await replaceMentionWithUsername(input2);

    // Sort inputs alphabetically to ensure consistent results
    const sortedInputs = [input1.toLowerCase(), input2.toLowerCase()].sort().join('');

    // Generate a hash based on the sorted inputs
    const hash = crypto.createHash('md5').update(sortedInputs).digest('hex');

    // Convert the hash to a percentage
    const percentage = parseInt(hash.slice(0, 4), 16) % 101;

    // Determine the phrase
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

    // Respond with the result
    await interaction.editReply({
      content: `${input1} ❤️ ${input2}: ${percentage}% compatibility\n${phrase}`,
    });
  }
}

module.exports = LoveCalculator;

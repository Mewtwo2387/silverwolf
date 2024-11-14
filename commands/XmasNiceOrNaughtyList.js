const { Command } = require('./classes/command.js');
const crypto = require('crypto');

class NiceOrNaughty extends Command {
    constructor(client) {
        super(client, "nice_or_naughty", "Check if someone is on the Nice or Naughty list!", [
            {
                name: 'input',
                description: 'The user to check (mention or string)',
                type: 3, // String type
                required: true
            }
        ]);
    }

    async run(interaction) {
        let input = interaction.options.getString('input');

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

        // Replace mention with username if applicable
        input = await replaceMentionWithUsername(input);

        // Generate a hash based on the user's input
        const hash = crypto.createHash('md5').update(input.toLowerCase()).digest('hex');

        // Use the hash to determine if they're Nice or Naughty
        const naughtyOrNice = parseInt(hash.slice(0, 2), 16) % 2 === 0 ? "Nice" : "Naughty";

        // Fun phrases for Nice and Naughty outcomes
        const nicePhrases = [
            "Santa has you on his good list! 🎅✨",
            "You're an angel this year! 😇",
            "Cookies and presents await you! 🍪🎁"
        ];
        const naughtyPhrases = [
            "Santa's watching... coal for you! 😈🎄",
            "Better luck next year! 👿",
            "Someone's been a little mischievous! 😏"
        ];

        const response = naughtyOrNice === "Nice" 
            ? nicePhrases[Math.floor(Math.random() * nicePhrases.length)]
            : naughtyPhrases[Math.floor(Math.random() * naughtyPhrases.length)];

        // Respond with the result
        await interaction.editReply({
            content: `${input} is on the **${naughtyOrNice}** list! ${response}`
        });
    }
}

module.exports = NiceOrNaughty;

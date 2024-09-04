const { Command } = require('./classes/command.js');
const crypto = require('crypto');

class LoveCalculator extends Command {
    constructor(client) {
        super(client, "love_calculator", "Calculate love compatibility between two members", [
            {
                name: 'user1',
                description: 'The first user',
                type: 6, // User type
                required: true
            },
            {
                name: 'user2',
                description: 'The second user',
                type: 6, // User type
                required: true
            }
        ]);
    }

    async run(interaction) {
        const user1 = interaction.options.getUser('user1');
        const user2 = interaction.options.getUser('user2');

        // Combine usernames and generate a hash
        const combinedNames = (user1.username.toLowerCase() + user2.username.toLowerCase());
        const hash = crypto.createHash('md5').update(combinedNames).digest('hex');
        
        // Convert the hash to a percentage
        const percentage = parseInt(hash.slice(0, 4), 16) % 101;

        // Determine the phrase
        let phrase = "";
        if (percentage <= 20) {
            phrase = "Chances are low, but never zero!";
        } else if (percentage <= 40) {
            phrase = "You might be better off as friends.";
        } else if (percentage <= 60) {
            phrase = "There's something there... maybe!";
        } else if (percentage <= 80) {
            phrase = "Looks like there's some potential!";
        } else {
            phrase = "True love! Get ready for the wedding bells!";
        }

        // Respond with the result
        await interaction.editReply({
            content: `${user1.username} ❤️ ${user2.username}: ${percentage}% compatibility\n${phrase}`
        });
    }
}

module.exports = LoveCalculator;

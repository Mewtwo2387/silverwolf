const { Command } = require("./classes/command.js");
const { EmbedBuilder } = require('discord.js');
const crypto = require('crypto');

class RealEightBall extends Command {
    constructor(client) {
        super(client, "8ball", "Ask the magic 8-ball a question", [
            {
                name: "question",
                description: "The question you want to ask the 8-ball",
                type: 3, // String type
                required: true
            }
        ]);
    }

    async run(interaction) {
        const question = interaction.options.getString('question');
        const user = interaction.user.id;
        const combined = question + user;

        const hash = crypto.createHash('md5').update(combined).digest('hex');

        const responses = [
            "Yes, definitely.",
            "Ask again later.",
            "Absolutely!",
            "Don't count on it.",
            "Yes, in due time.",
            "My sources say no.",
            "Outlook good.",
            "Very doubtful.",
            "It is certain.",
            "Yes.",
            "Cannot predict now.",
            "As I see it, yes.",
            "Most likely.",
            "No way.",
            "The future is unclear.",
            "Yes, but don't rush it.",
            "It is decidedly so.",
            "You may rely on it.",
            "Ask me again later.",
            "No."
        ];


        const randomIndex = parseInt(hash.slice(0, 4), 16) % responses.length;
        const answer = responses[randomIndex];

        const embed = new EmbedBuilder()
            .setTitle('Magic 8 Ball')
            .setColor(0x00ffff) // Light blue
            .setDescription(`**${question}**`)
            .addFields({ name: 'The magic 8 ball answers:', value: answer, inline: true });

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = RealEightBall;

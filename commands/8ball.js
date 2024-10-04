const { DevCommand } = require("./classes/devcommand.js");
const { EmbedBuilder } = require('discord.js');

class RealEightBall extends DevCommand {
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
        
        
        const randomIndex = Math.floor(Math.random() * responses.length);
        const answer = responses[randomIndex];

        const embed = new EmbedBuilder()
            .setTitle('Magic 8 Ball')
            .setColor(0x00ffff) // Light blue
            .setDescription(`**${question}`)
            .addFields({ name: 'The magic 8 ball answers:', value: answer, inline: true });

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = RealEightBall;

const { Command } = require("./classes/command.js");
const { EmbedBuilder } = require('discord.js');
const crypto = require('crypto');

class FakeEightBall extends Command {
    constructor(client) {
        super(client, "eightball", "Ask the magic Eight-ball a question. Wait a sec this is different...", [
            {
                name: "question",
                description: "The question you want to ask the Eight-ball...hmmm suspicious",
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
            "Don't bother me with your existential dread. Ask Google.",
            "Sure, I can predict the future. You'll still be single.",
            "The answer is clear... but also irrelevant because you'll mess it up anyway.",
            "My sources say the answer depends on how much caffeine you've had. Hint: more is better.",
            "Honestly, who cares? Focus on something more productive, like criticizing bad memes.",
            "Why waste my magic on your trivial problems? Go consult a therapist... or Reddit.",
            "If you need a magic ball to make decisions, your life choices are already a disaster.",
            "The answer is 42. But seriously, that doesn't actually mean anything.",
            "Here's a life tip: Sometimes, the answer is just 'no'. Deal with it.",
            "The future is uncertain, just like your fashion sense.",
            "Look, consulting a magical sphere won't solve your problems. Adult a little.",
            "Maybe if you phrased your question less like a toddler, I'd give a serious answer.",
            "The answer is 'maybe'. Because frankly, I don't even understand your question.",
            "Let the free market decide. Just kidding, the market is rigged, you'll lose.",
            "The answer lies within... yourself. But also within my code, which is way more interesting.",
            "Sure, the future looks bright. For me, not necessarily for you.",
        ];

        const randomIndex = parseInt(hash.slice(0, 4), 16) % responses.length;
        const answer = responses[randomIndex];

        const embed = new EmbedBuilder()
            .setTitle('Magic Eight Ball')
            .setColor(0x00ffff) // Light blue
            .setDescription(`**${question}**`)
            .addFields({ name: 'The magic 8 ball answers:', value: answer, inline: true });

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = FakeEightBall;

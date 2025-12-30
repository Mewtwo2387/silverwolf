const { EmbedBuilder } = require('discord.js');
const crypto = require('crypto');
const { Command } = require('./classes/command');

class EightBall extends Command {
  constructor(client) {
    super(client, '8ball', 'Ask the combined magic 8-ball a question', [
      {
        name: 'question',
        description: 'The question you want to ask the magic 8-ball',
        type: 3, // String type
        required: true,
      },
    ], { blame: 'xei' });
  }

  async run(interaction) {
    const question = interaction.options.getString('question');
    const user = interaction.user.id;
    const combined = question + user;

    // Step 1: Determine response type (normal or savage)
    const hash1 = crypto.createHash('md5').update(combined).digest('hex');
    const isSavage = parseInt(hash1.slice(0, 4), 16) % 2 === 0;

    // Step 2: Choose specific response based on type
    const hash2 = crypto.createHash('sha256').update(combined).digest('hex');

    const normalResponses = [
      'Yes, definitely.',
      'Ask again later.',
      'Absolutely!',
      "Don't count on it.",
      'Yes, in due time.',
      'My sources say no.',
      'Outlook good.',
      'Very doubtful.',
      'It is certain.',
      'Yes.',
      'Cannot predict now.',
      'As I see it, yes.',
      'Most likely.',
      'No way.',
      'The future is unclear.',
      "Yes, but don't rush it.",
      'It is decidedly so.',
      'You may rely on it.',
      'Ask me again later.',
      'No.',
    ];

    const savageResponses = [
      "Don't bother me with your existential dread. Ask Google.",
      "Sure, I can predict the future. You'll still be single.",
      "The answer is clear... but also irrelevant because you'll mess it up anyway.",
      "My sources say the answer depends on how much caffeine you've had. Hint: more is better.",
      'Honestly, who cares? Focus on something more productive, like criticizing bad memes.',
      'Why waste my magic on your trivial problems? Go consult a therapist... or Reddit.',
      'If you need a magic ball to make decisions, your life choices are already a disaster.',
      "The answer is 42. But seriously, that doesn't actually mean anything.",
      "Here's a life tip: Sometimes, the answer is just 'no'. Deal with it.",
      'The future is uncertain, just like your fashion sense.',
      "Look, consulting a magical sphere won't solve your problems. Adult a little.",
      "Maybe if you phrased your question less like a toddler, I'd give a serious answer.",
      "The answer is 'maybe'. Because frankly, I don't even understand your question.",
      "Let the free market decide. Just kidding, the market is rigged, you'll lose.",
      'The answer lies within... yourself. But also within my code, which is way more interesting.',
      'Sure, the future looks bright. For me, not necessarily for you.',
    ];

    const responses = isSavage ? savageResponses : normalResponses;
    const randomIndex = parseInt(hash2.slice(0, 4), 16) % responses.length;
    const answer = responses[randomIndex];

    const embed = new EmbedBuilder()
      .setTitle('Magic 8 Ball')
      .setColor(isSavage ? 0xff0000 : 0x00ffff) // Red for savage, blue for normal
      .setDescription(`**${question}**`)
      .addFields({ name: 'The magic 8 ball answers:', value: answer, inline: true });

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = EightBall;

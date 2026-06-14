import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import eightBallData from '../data/8ball.json';

class EightBall extends Command {
  constructor(client: any) {
    super(client, '8ball', 'Ask the combined magic 8-ball a question', [
      {
        name: 'question',
        description: 'The question you want to ask the magic 8-ball',
        type: 3,
        required: true,
      },
    ], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const question = interaction.options.getString('question');
    const user = interaction.user.id;
    const combined = question + user;

    const hash1 = new Bun.CryptoHasher('md5').update(combined).digest('hex');
    const isSavage = parseInt(hash1.slice(0, 4), 16) % 2 === 0;

    const hash2 = new Bun.CryptoHasher('sha256').update(combined).digest('hex');

    const { normal: normalResponses, savage: savageResponses } = eightBallData;

    const responses = isSavage ? savageResponses : normalResponses;
    const randomIndex = parseInt(hash2.slice(0, 4), 16) % responses.length;
    const answer = responses[randomIndex];

    const embed = new EmbedBuilder()
      .setTitle('Magic 8 Ball')
      .setColor(isSavage ? 0xff0000 : 0x00ffff)
      .setDescription(`**${question}**`)
      .addFields({ name: 'The magic 8 ball answers:', value: answer, inline: true });

    await interaction.editReply({ embeds: [embed] });
  }
}

export default EightBall;

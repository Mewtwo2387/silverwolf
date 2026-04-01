import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

class Cat extends Command {
  constructor(client: any) {
    super(client, 'cat', 'Fetch a random cat fact, picture, or both', [
      {
        name: 'option',
        description: 'Choose what you want: fact, img, or both',
        type: 3,
        required: true,
        choices: [
          { name: 'fact', value: 'fact' },
          { name: 'img', value: 'img' },
          { name: 'both', value: 'both' },
        ],
      },
    ], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const option = interaction.options.getString('option');

    const catFactUrl = 'https://catfact.ninja/fact';
    const catPicUrl = 'https://api.thecatapi.com/v1/images/search';

    try {
      let catFact = '';
      let catImageUrl = '';
      let catId = '';

      if (option === 'fact' || option === 'both') {
        const factResponse = await fetch(catFactUrl);
        if (!factResponse.ok) throw new Error('Failed to fetch cat fact');
        const factData = await factResponse.json();
        catFact = factData.fact;
      }

      if (option === 'img' || option === 'both') {
        const picResponse = await fetch(catPicUrl);
        if (!picResponse.ok) throw new Error('Failed to fetch cat picture');
        const picData = await picResponse.json();
        if (!picData || picData.length === 0) {
          throw new Error('No cat picture found.');
        }
        const cat = picData[0];
        catImageUrl = cat.url;
        catId = cat.id;
      }

      const embed = new EmbedBuilder().setColor(0x3498db);

      if (option === 'fact') {
        embed.setTitle('Cat Fact').setDescription(catFact);
      } else if (option === 'img') {
        embed.setTitle('Found a cat! 🐈').setImage(catImageUrl).setFooter({ text: `Cat ID: ${catId}` });
      } else if (option === 'both') {
        embed
          .setTitle('Cat fact and unrelated pic')
          .setDescription(catFact)
          .setImage(catImageUrl)
          .setFooter({ text: `Cat ID: ${catId}` });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error fetching cat data:', error);
      await interaction.editReply({ content: 'Sorry, I couldn\'t fetch the cat data. Please try again later.', ephemeral: true });
    }
  }
}

export default Cat;

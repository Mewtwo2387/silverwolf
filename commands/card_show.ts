import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { Command } from './classes/Command';
import {
  CHARACTER_ROSTER_DISCORD_CHOICES,
  characterFromRosterValue,
} from '../tcg/characterRoster';

class CardShow extends Command {
  constructor(client: any) {
    super(client, 'show', 'Show a card from the built-in TCG character list', [
      {
        name: 'character',
        description: 'Choose a character from the TCG roster',
        type: 3,
        required: true,
        choices: CHARACTER_ROSTER_DISCORD_CHOICES,
      },
    ], { isSubcommandOf: 'card', blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const selectedCharacter = interaction.options.getString('character');
    const character = characterFromRosterValue(selectedCharacter);

    if (!character) {
      await interaction.editReply('Character not found in the TCG roster.');
      return;
    }

    try {
      const canvas = await character.generateCard();
      const buffer = canvas.toBuffer('image/png');
      const filename = `${character.name.toLowerCase().replace(/\s+/g, '_')}_card.png`;
      const attachment = new AttachmentBuilder(buffer, { name: filename });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(character.name)
        .setDescription(`${character.titleDesc.title}`)
        .setImage(`attachment://${filename}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
      console.error('Error generating built-in character card:', error);
      await interaction.editReply(`Failed to generate ${character.name}'s card.`);
    }
  }
}

export default CardShow;

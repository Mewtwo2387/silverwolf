const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Command } = require('./classes/command');
const { CHARACTERS } = require('../tcg/characters.ts');

class CardShow extends Command {
  constructor(client) {
    const choices = CHARACTERS.map((character) => ({
      name: character.name,
      value: character.name.toLowerCase(),
    }));

    super(client, 'show', 'Show a card from the built-in TCG character list', [
      {
        name: 'character',
        description: 'Choose a character from the TCG roster',
        type: 3,
        required: true,
        choices,
      },
    ], { isSubcommandOf: 'card', blame: 'ei' });
  }

  async run(interaction) {
    const selectedCharacter = interaction.options.getString('character');
    const character = CHARACTERS.find((entry) => entry.name.toLowerCase() === selectedCharacter);

    if (!character) {
      await interaction.editReply('Character not found in the TCG roster.');
      return;
    }

    if (!character.image || !character.image.trim()) {
      await interaction.editReply(`${character.name} does not have an image configured yet.`);
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

module.exports = CardShow;

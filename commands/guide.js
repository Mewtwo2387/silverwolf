const { EmbedBuilder } = require('discord.js');
const Discord = require('discord.js');
const { Command } = require('./classes/command.js');
const { logError } = require('../utils/log');

class Guide extends Command {
  constructor(client) {
    super(client, 'guide', 'Sends a guide on how to play Dinonuggies', []);
  }

  async run(interaction) {
    try {
      const guide = `
            ## since you are stupid and you need to learn common sense, let's teach you how to play silverwolf bot!

            1. \`/claim\` - this is how you earn dinonuggies. There is a low chance that it will have a bonus attached to it. If you hit the bonus, you'll earn more.
            2. \`/eat\` and \`/eatmultiple\` - Eating is the easiest early game tactic to gain mystic credits.
            3. \`/upgrades\` - Upgrades are the best way to increase your dinonuggie earnings.
            4. \`/slots\` - The meta way to earn dinonuggies. Make a bet and spin away! The natural statistical earnings from this are 70%, just gamble and you'll increase.
            5. \`/blackjack\` and \`/roulette\` are other great alternatives.
            6. \`/upgradedata\` to see how much mystic credits are needed for each upgrade.
            7. Once you're maxed out to level 30, you can increase your cap via \`/ascend\`.

            The grind doesn't stop! Rahhh!
            `;

      // Send the guide in an embed
      const embed = new EmbedBuilder()
        .setTitle('Dinonuggies Guide')
        .setColor('#FFD700')
        .setDescription(guide)
        .setTimestamp();
      // Respond with the embed
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error fetching Dinonuggies guide:', error);
      await interaction.editReply({ content: 'Sorry, I couldn’t fetch the Dinonuggies guide. Please try again later.', ephemeral: true });
    }
  }
}

module.exports = Guide;

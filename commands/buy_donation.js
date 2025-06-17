const { Command } = require('./classes/command');
const { handleSuccessfulClaim } = require('../utils/claim');

class BuyDonation extends Command {
  constructor(client) {
    super(client, 'donation', 'buy stuff with stellar nuggies', [
      {
        name: 'upgrade',
        description: 'The upgrade to buy',
        type: 4,
        required: true,
      },
    ], { isSubcommandOf: 'buy' });
  }

  async run(interaction) {
    const upgrade = interaction.options.getInteger('upgrade');
    const stellarNuggies = await this.client.db.user.getUserAttr(interaction.user.id, 'stellarNuggies');

    switch (upgrade) {
      case 1:
        if (stellarNuggies >= 10) {
          await this.client.db.user.addUserAttr(interaction.user.id, 'stellarNuggies', -10);
          await interaction.editReply({ content: 'You successfully bought a dinonuggie claim!' });
          await handleSuccessfulClaim(this.client, interaction, true);
        } else {
          await interaction.editReply({ content: "You don't have enough stellar nuggies to buy this! Get more with /donate" });
        }
        break;
      case 2:
        if (stellarNuggies >= 40) {
          await this.client.db.user.addUserAttr(interaction.user.id, 'stellarNuggies', -40);
          await interaction.editReply({ content: 'You successfully bought 5 dinonuggie claims!' });
          for (let i = 0; i < 5; i += 1) {
            handleSuccessfulClaim(this.client, interaction, true);
          }
        } else {
          await interaction.editReply({ content: "You don't have enough stellar nuggies to buy this! Get more with /donate" });
        }
        break;
      case 3:
        if (stellarNuggies >= 70) {
          await this.client.db.user.addUserAttr(interaction.user.id, 'stellarNuggies', -70);
          await interaction.editReply({ content: 'You successfully bought 10 dinonuggie claims!' });
          for (let i = 0; i < 10; i += 1) {
            handleSuccessfulClaim(this.client, interaction, true);
          }
        } else {
          await interaction.editReply({ content: "You don't have enough stellar nuggies to buy this! Get more with /donate" });
        }
        break;
      case 4:
        if (stellarNuggies >= 120) {
          await this.client.db.user.addUserAttr(interaction.user.id, 'stellarNuggies', -120);
          await interaction.editReply({ content: 'You successfully bought 20 dinonuggie claims!' });
          for (let i = 0; i < 20; i += 1) {
            handleSuccessfulClaim(this.client, interaction, true);
          }
        } else {
          await interaction.editReply({ content: "You don't have enough stellar nuggies to buy this! Get more with /donate" });
        }
        break;
      case 5: {
        const ascensionLevel = await this.client.db.user.getUserAttr(interaction.user.id, 'ascensionLevel');
        if (stellarNuggies >= 60 + (ascensionLevel * 10)) {
          await this.client.db.user.addUserAttr(interaction.user.id, 'stellarNuggies', -60 - (ascensionLevel * 10));
          const nuggies = await this.client.db.user.getUserAttr(interaction.user.id, 'dinonuggies');
          await this.client.db.user.addUserAttr(interaction.user.id, 'heavenlyNuggies', nuggies);
          await this.client.db.user.addUserAttr(interaction.user.id, 'ascensionLevel', 1);
          await interaction.editReply({ content: `You obtained ${nuggies} heavenly nuggies and reached ascension level ${ascensionLevel + 1}!` });
        } else {
          await interaction.editReply({ content: "You don't have enough stellar nuggies to buy this! Get more with /donate" });
        }
        break;
      }
      case 6:
        await interaction.editReply({ content: 'This upgrade is not available yet!' });
        break;
      default:
        await interaction.editReply({ content: 'Invalid upgrade!' });
        break;
    }
  }
}

module.exports = BuyDonation;

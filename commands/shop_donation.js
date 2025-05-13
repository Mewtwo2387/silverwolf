const Discord = require('discord.js');
const { Command } = require('./classes/command');

class ShopDonation extends Command {
  constructor(client) {
    super(client, 'donation', 'buy stuff with stellar nuggies', [], { isSubcommandOf: 'shop' });
  }

  async run(interaction) {
    const stellar_nuggies = await this.client.db.getUserAttr(interaction.user.id, 'stellar_nuggies');
    const ascension_level = await this.client.db.getUserAttr(interaction.user.id, 'ascension_level');

    const embed = new Discord.EmbedBuilder()
      .setColor('#00AA00')
      .setTitle('Donation Shop')
      .setDescription(`You have ${stellar_nuggies} stellar nuggies. You can obtain more with /donate.
                
**Instantly claim dinonuggies once**
Cost: 10 stellar nuggies
Buy with \`/buy donation 1\`

**Instantly claim dinonuggies 5 times**
Cost: 40 stellar nuggies (20% off!)
Buy with \`/buy donation 2\`

**Instantly claim dinonuggies 10 times**
Cost: 70 stellar nuggies (30% off!)
Buy with \`/buy donation 3\`

**Instantly claim dinonuggies 20 times**
Cost: 120 stellar nuggies (40% off!)
Buy with \`/buy donation 4\`

**Instantly get one ascension level and heavenly nuggies equivalent to your nuggie count without resetting anything**
Cost: ${60 + (ascension_level * 10)} stellar nuggies (Scales with ascension level)
Buy with \`/buy donation 5\`

**Permanently increase your gambling earnings by 10%**
*Not implemented yet*
0% -> 10%
Cost: 200 stellar nuggies
Buy with \`/buy donation 6\``);

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = ShopDonation;

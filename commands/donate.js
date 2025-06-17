const Discord = require('discord.js');
const { Command } = require('./classes/command');

const BASEMENT_ID = '969953667597893672';

class Donate extends Command {
  constructor(client) {
    super(client, 'donate', "our server's donation links and rewards (real)", []);
  }

  async run(interaction) {
    if (interaction.guild.id === BASEMENT_ID) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('«« ━━ ✦・Donation Links and Rewards・✦ ━━ »»')
          .setDescription(`Donate for a series of rewards! (real)

Silverwolf funds:
https://www.gofundme.com/f/melissa-fahns-family-needs-your-support
                    
Gaza:
https://donate.unrwa.org/    
https://linktr.ee/fundsforgaza/

Send a screenshot of your donation to get your rewards!

**$1** - 60 stellar nuggies

**$5** - 300 + 30 stellar nuggies

**$15** - 980 + 110 stellar nuggies

**$30** - 1980 + 260 stellar nuggies

**$50** - 3280 + 600 stellar nuggies

**$100** - 6480 + 1600 stellar nuggies

----
                
**$5** - A kiss mwwaaahhh

**$10** - A hug <3

**$69** - Passionate gay sex session with Gamebang (Side note: He lasts for 3 seconds on a good day)

**$69** - Ei's super secret folder (I cannot confirm nor deny that there's loli in it)

**$5** - Access to the secret Electro slander channel

**$10** - Access to the super secret admin furry roleplay channel

**$25** - Mod role

**$50** - Admin role

**$100** - Owner role`),
        ],
      });
    } else {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('«« ━━ ✦・Donation Links and Rewards・✦ ━━ »»')
          .setDescription(`Donate for a series of rewards! (real)

Silverwolf funds:
https://www.gofundme.com/f/melissa-fahns-family-needs-your-support

Gaza:
https://donate.unrwa.org/    
https://linktr.ee/fundsforgaza/

Send a screenshot of your donation to get your rewards!

**$1** - 60 stellar nuggies

**$5** - 300 + 30 stellar nuggies

**$15** - 980 + 110 stellar nuggies

**$30** - 1980 + 260 stellar nuggies

**$50** - 3280 + 600 stellar nuggies

**$100** - 6480 + 1600 stellar nuggies

----
                
**$5** - A kiss mwwaaahhh

**$10** - A hug <3

**$5** - Access to the secret Xei slander channel

**$10** - Access to the super secret admin furry roleplay channel

**$25** - Mod role

**$50** - Admin role

**$100** - Owner role

**$▮▮** - ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮
`),
        ],
      });
    }
  }
}

module.exports = Donate;

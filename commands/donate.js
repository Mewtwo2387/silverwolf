const Discord = require('discord.js');
const { Command } = require('./classes/command.js');

class Donate extends Command {
    constructor(client){
        super(client, "donate", "our server's donation links and rewards (real)", []);
    }

    async run(interaction){
        await interaction.editReply({embeds: [ new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('«« ━━ ✦・Donation Links and Rewards・✦ ━━ »»')
            .setDescription(`Donate for a series of rewards! (real)
                
https://donate.unrwa.org/
                
https://linktr.ee/fundsforgaza/
                
**$5** - A kiss mwwaaahhh

**$10** - A hug <3

**$69** - Passionate gay sex session with Gamebang (Side note: He lasts for 3 seconds on a good day)

**$69** - Ei's super secret folder (I cannot confirm nor deny that there's loli in it)

**$5** - Access to the secret Electro slander channel

**$10** - Access to the super secret admin furry roleplay channel

**$25** - Mod role

**$50** - Admin role

**$100** - Owner role`)
        ]});
    }
}

module.exports = Donate;
const {
  EmbedBuilder,
} = require('discord.js');
require('dotenv').config();
const Handler = require('./handler');

class AprilFoolsHandler extends Handler {
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonShinyPokemon(client, message, _member, _pfp) {
    this.summonSilverwolf(client, message);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonMysteryPokemon(client, message, _member, _pfp) {
    this.summonSilverwolf(client, message);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonNormalPokemon(client, message, _member, _pfp) {
    this.summonSilverwolf(client, message);
  }

  async summonSilverwolf(client, message) {
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('A Silverwolf appeared!')
        .setImage('https://cdn.donmai.us/sample/2d/4a/__silver_wolf_honkai_and_1_more_drawn_by_caisena__sample-2d4a2a28c06586827eb8a3dc66b44e38.jpg')
        .setColor('#00FF00')
        .setFooter({ text: 'catch them with /catch [username]!' }),
      ],
    });
    client.setCurrentPokemon('Silverwolf');
  }
}

module.exports = AprilFoolsHandler;

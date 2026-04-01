import { EmbedBuilder } from 'discord.js';
import Handler from './handler';

class AprilFoolsHandler extends Handler {
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonShinyPokemon(client: any, message: any, _member: any, _pfp: string): Promise<void> {
    this.summonSilverwolf(client, message);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonMysteryPokemon(client: any, message: any, _member: any, _pfp: string): Promise<void> {
    this.summonSilverwolf(client, message);
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async summonNormalPokemon(client: any, message: any, _member: any, _pfp: string): Promise<void> {
    this.summonSilverwolf(client, message);
  }

  async summonSilverwolf(client: any, message: any): Promise<void> {
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

export default AprilFoolsHandler;

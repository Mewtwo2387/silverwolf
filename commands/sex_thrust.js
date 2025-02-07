const { Command } = require('./classes/command.js');
const Discord = require('discord.js');
const SexSession = require('../classes/sexSession.js');
const { log } = require('../utils/log.js');

class SexThrust extends Command {
    constructor(client){
        super(client, "thrust", "In... and out", [], {isSubcommandOf: "sex"});
    }

    async run(interaction){
        if (!this.client.sex_sessions.some(session => session.hasUser(interaction.user.id))){
            await interaction.editReply({
                embeds: [new Discord.EmbedBuilder()
                    .setColor('#AA0000')
                    .setTitle(`You're not fucking anyone!`)
                    .setFooter({text: `start a sex session with /sex start`})]
            });
            return;
        }

        const session = this.client.sex_sessions.find(session => session.hasUser(interaction.user.id));



        if (session.thrust()){
          log(`Ejaculated!`);
          this.client.sex_sessions = this.client.sex_sessions.filter(s => s !== session);
          await interaction.editReply({
            embeds: [new Discord.EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`You ejaculated!`)
                .setDescription(`Total thrusts: ${session.thrusts}`)
                .setFooter({text: `so quick smh`})
              ]
          });

          const fatherId = interaction.user.id;
          const motherId = session.otherUser(fatherId);

          // already have a baby
          if (await this.client.db.haveBaby(motherId, fatherId)){
            log(`Already have a baby for ${motherId} and ${fatherId}`);
            return
          }

          if (Math.random() < 0.5){
            await interaction.followUp({
              embeds: [new Discord.EmbedBuilder()
                  .setColor('#00FF00')
                  .setTitle(`Oh...`)
                  .setDescription(`<@${motherId}> is pregnant! Please name the baby with /baby name <name>`)
                ]
            });
            await this.client.db.addBaby(motherId, fatherId);
          }

          return;
        }

        const responses = [
          "Mwwaahhhh!",
          "More...",
          "Please don't stop...",
          "Deeper...",
          "Faster...",
          "Harder...",
          "Please~ More~"
        ]
        await interaction.editReply({
            embeds: [new Discord.EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(responses[Math.floor(Math.random() * responses.length)])]
        });
    }
}

module.exports = SexThrust;
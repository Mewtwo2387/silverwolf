import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} from 'discord.js';
import { Command } from './classes/Command';

class RussianRouletteSingleplayer extends Command {
  constructor(client: any) {
    super(client, 'singleplayer', 'Play a single-player game of Russian Roulette', [], { isSubcommandOf: 'russianroulette', blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const totalChambers = 6;
    const loadedChamber = Math.floor(Math.random() * totalChambers);
    let currentChamber = 0;
    let shotsFired = 0;
    let thisChamberCooldown = false;

    const embed = new EmbedBuilder()
      .setTitle('Single-Player Russian Roulette')
      .setColor('#FF0000')
      .setDescription(`Round ${shotsFired + 1}: What will you do?`)
      .setFooter({ text: `Chambers checked: ${shotsFired}/${totalChambers}` })
      .setImage('https://media1.tenor.com/m/NT9p3cPLcvIAAAAC/pull-the-trigger-squid-game-season-2.gif');

    const row = this.createButtons(thisChamberCooldown);

    const message = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = message.createMessageComponentCollector({ time: 120000 });

    collector.on('collect', async (i: any) => {
      if (i.customId === 'shootSelf') {
        if (currentChamber === loadedChamber) {
          embed.setDescription('💥 You pulled the trigger and the chamber was loaded! You lose.');
          embed.setColor('#AA0000');
          embed.setImage('https://media1.tenor.com/m/xJUgKa1lPZ4AAAAd/squidgames-dead.gif');
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        } else {
          shotsFired += 1;
          currentChamber += 1;
          thisChamberCooldown = false;

          embed.setDescription(`Click! You survived round ${shotsFired}. What will you do next?`)
            .setFooter({ text: `Chambers checked: ${shotsFired}/${totalChambers}` });

          if (shotsFired === totalChambers) {
            embed.setDescription(
              '💥 You survived until the last round but failed to discharge the loaded chamber. You lose.',
            );
            embed.setColor('#AA0000');
            embed.setImage('https://media1.tenor.com/m/xJUgKa1lPZ4AAAAd/squidgames-dead.gif');
            await i.update({ embeds: [embed], components: [] });
            collector.stop();
          } else {
            await i.update({ embeds: [embed], components: [this.createButtons(thisChamberCooldown)] });
          }
        }
      } else if (i.customId === 'thisChamber') {
        if (thisChamberCooldown) {
          await i.reply({ content: 'You cannot press "This Chamber" consecutively!', ephemeral: true });
          return;
        }

        if (currentChamber === loadedChamber) {
          embed.setDescription(
            '🎉 You discharged the loaded chamber without harming yourself. You win!',
          );
          embed.setImage('https://media1.tenor.com/m/caIrExQfdiEAAAAd/clap-smile.gif');

          embed.setColor('#00FF00');
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        } else {
          thisChamberCooldown = true;
          shotsFired += 1;
          currentChamber += 1;

          embed.setDescription(
            `The chamber was empty. You have survived round ${shotsFired}. What will you do next?`,
          ).setFooter({ text: `Chambers checked: ${shotsFired}/${totalChambers}` });

          if (shotsFired === totalChambers) {
            embed.setDescription(
              '🎉 You survived all 5 rounds and successfully discharged the loaded chamber. You win!',
            );
            embed.setColor('#00FF00');
            embed.setImage('https://media1.tenor.com/m/caIrExQfdiEAAAAd/clap-smile.gif');
            await i.update({ embeds: [embed], components: [] });
            collector.stop();
          } else {
            await i.update({ embeds: [embed], components: [this.createButtons(thisChamberCooldown)] });
          }
        }
      }
    });

    collector.on('end', (_: any, reason: string) => {
      if (reason === 'time') {
        embed.setDescription('The game ended due to inactivity. No shots were fired.');
        embed.setColor('#AAAAAA');
        if (message.editable) message.edit({ embeds: [embed], components: [] });
      }
    });
  }

  createButtons(thisChamberCooldown: boolean) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('shootSelf')
          .setLabel('Shoot Self')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('thisChamber')
          .setLabel('This Chamber')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(thisChamberCooldown),
      );
  }
}

export default RussianRouletteSingleplayer;

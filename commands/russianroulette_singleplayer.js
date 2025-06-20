const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} = require('discord.js');
const { Command } = require('./classes/command');

class RussianRouletteSingleplayer extends Command {
  constructor(client) {
    super(client, 'singleplayer', 'Play a single-player game of Russian Roulette', [], { isSubcommandOf: 'russianroulette' });
  }

  async run(interaction) {
    const totalChambers = 6;
    const loadedChamber = Math.floor(Math.random() * totalChambers); // Randomly select the loaded chamber
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

    const collector = message.createMessageComponentCollector({ time: 120000 }); // 2-minute timeout

    collector.on('collect', async (i) => {
      if (i.customId === 'shootSelf') {
        if (currentChamber === loadedChamber) {
          // Player loses
          embed.setDescription('💥 You pulled the trigger and the chamber was loaded! You lose.');
          embed.setColor('#AA0000');
          embed.setImage('https://media1.tenor.com/m/xJUgKa1lPZ4AAAAd/squidgames-dead.gif');
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        } else {
          // Survive this round
          shotsFired += 1;
          currentChamber += 1;
          thisChamberCooldown = false; // Reset cooldown for "This Chamber"

          embed.setDescription(`Click! You survived round ${shotsFired}. What will you do next?`)
            .setFooter({ text: `Chambers checked: ${shotsFired}/${totalChambers}` });

          if (shotsFired === totalChambers) {
            // Player loses on final shot
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
          // Prevent consecutive presses of "This Chamber"
          await i.reply({ content: 'You cannot press "This Chamber" consecutively!', ephemeral: true });
          return;
        }

        if (currentChamber === loadedChamber) {
          // Player wins
          embed.setDescription(
            '🎉 You discharged the loaded chamber without harming yourself. You win!',
          );
          embed.setImage('https://media1.tenor.com/m/caIrExQfdiEAAAAd/clap-smile.gif');

          embed.setColor('#00FF00');
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        } else {
          // Cooldown applied, survive this round
          thisChamberCooldown = true;
          shotsFired += 1;
          currentChamber += 1;

          embed.setDescription(
            `The chamber was empty. You have survived round ${shotsFired}. What will you do next?`,
          ).setFooter({ text: `Chambers checked: ${shotsFired}/${totalChambers}` });

          if (shotsFired === totalChambers) {
            // Player wins by surviving all rounds
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

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        embed.setDescription('The game ended due to inactivity. No shots were fired.');
        embed.setColor('#AAAAAA');
        if (message.editable) message.edit({ embeds: [embed], components: [] });
      }
    });
  }

  createButtons(thisChamberCooldown) {
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

module.exports = RussianRouletteSingleplayer;

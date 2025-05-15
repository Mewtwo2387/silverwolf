const Discord = require('discord.js');
const { Command } = require('./classes/command');

const DEATH_RATE = 0.05;

class Trade extends Command {
  constructor(client) {
    super(client, 'trade', 'trade pokemon', [
      {
        name: 'user',
        description: 'the user to trade with',
        type: 6,
        required: true,
      },
      {
        name: 'sending',
        description: 'the pokemon you are sending',
        type: 3,
        required: true,
      },
      {
        name: 'requesting',
        description: 'the pokemon you are requesting',
        type: 3,
        required: true,
      },
    ]);
  }

  async run(interaction) {
    const self = interaction.user.id;
    const target = interaction.options.getUser('user').id;
    const pokemonSending = interaction.options.getString('sending');
    const pokemonRequesting = interaction.options.getString('requesting');

    let selfPokemonCount = await this.client.db.getPokemonCount(self, pokemonSending);
    let targetPokemonCount = await this.client.db.getPokemonCount(target, pokemonRequesting);

    if (self === target) {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription('You can\'t trade with yourself smh')
            .setColor('Red'),
        ],
      });
      return;
    }

    if (selfPokemonCount < 1) {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription(`You don't have any ${pokemonSending}s to trade!`)
            .setColor('Red'),
        ],
      });
      return;
    }
    if (targetPokemonCount < 1) {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setDescription(`<@${target}> doesn't have any ${pokemonRequesting}s to trade!`)
            .setColor('Red'),
        ],
      });
      return;
    }

    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId('acceptTrade')
          .setLabel('Accept')
          .setStyle(Discord.ButtonStyle.Success),
        new Discord.ButtonBuilder()
          .setCustomId('rejectTrade')
          .setLabel('Reject')
          .setStyle(Discord.ButtonStyle.Danger),
      );

    await interaction.editReply({
      content: `<@${target}>, ${interaction.user.username} has sent you a trade request!`,
      embeds: [
        new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle('Trade Request')
          .setDescription(`${interaction.user.username} wants to trade their ${pokemonSending} for your ${pokemonRequesting}!`),
      ],
      components: [row],
    });

    const filter = (i) => (i.customId === 'acceptTrade' || i.customId === 'rejectTrade');
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 }); // 1 minute collector

    collector.on('collect', async (i) => {
      if (i.user.id !== target) {
        i.reply({
          embeds: [
            new Discord.EmbedBuilder()
              .setColor('Red')
              .setDescription('don\'t steal pokemon smh'),
          ],
        });
        return;
      }

      if (i.customId === 'acceptTrade') {
        selfPokemonCount = await this.client.db.getPokemonCount(self, pokemonSending);
        targetPokemonCount = await this.client.db.getPokemonCount(target, pokemonRequesting);

        if (selfPokemonCount < 1 || targetPokemonCount < 1) {
          await i.reply({
            embeds: [
              new Discord.EmbedBuilder()
                .setColor('Red')
                .setDescription('This pokemon no longer exist'),
            ],
          });

          collector.stop();
          return;
        }

        const pokemonSendingDied = Math.random() < DEATH_RATE;
        const pokemonRequestingDied = Math.random() < DEATH_RATE;

        await this.client.db.sacrificePokemon(self, pokemonSending);
        await this.client.db.sacrificePokemon(target, pokemonRequesting);

        if (!pokemonSendingDied) {
          await this.client.db.catchPokemon(target, pokemonSending);
        }
        if (!pokemonRequestingDied) {
          await this.client.db.catchPokemon(self, pokemonRequesting);
        }

        let message = `<@${self}> traded their ${pokemonSending} for <@${target}>'s ${pokemonRequesting}!`;
        let footer = 'crytek-chan my bot is better uwu~';

        if (pokemonSendingDied && pokemonRequestingDied) {
          message += '\nHowever, both pokemon died in the trade.';
          footer = "how did you even manage that it's 5% each side";
        } else if (pokemonSendingDied) {
          message += `\nHowever, <@${self}>'s ${pokemonSending} died in the trade.`;
          footer = 'rip';
        } else if (pokemonRequestingDied) {
          message += `\nHowever, <@${target}>'s ${pokemonRequesting} died in the trade.`;
          footer = 'rip';
        }

        await i.reply({
          embeds: [
            new Discord.EmbedBuilder()
              .setColor('Green')
              .setDescription(message)
              .setFooter({ text: footer }),
          ],
        });

        collector.stop();
        return;
      }

      if (i.customId === 'rejectTrade') {
        await i.reply({
          embeds: [
            new Discord.EmbedBuilder()
              .setColor('Red')
              .setDescription(`<@${self}> rejected the trade request!`),
          ],
        });

        collector.stop();
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        // If no response was collected, disable the buttons
        await interaction.editReply({
          content: 'The trade request has timed out.',
          components: [],
        });
      }
    });
  }
}

module.exports = Trade;

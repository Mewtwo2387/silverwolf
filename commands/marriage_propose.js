require('dotenv').config();
const Discord = require('discord.js');
const { Command } = require('./classes/command');

class MarriagePropose extends Command {
  constructor(client) {
    super(client, 'propose', 'Propose to a user', [
      {
        name: 'user',
        description: 'The user you want to propose to',
        type: 6, // user
        required: true,
      },
    ], { isSubcommandOf: 'marriage' });
  }

  async run(interaction) {
    const targetUser = interaction.options.getUser('user');
    const userId = interaction.user.id;
    const allowedUsers = process.env.ALLOWED_USERS.split(',');

    let modAbooz = targetUser.id === this.client.user.id && allowedUsers.includes(userId);

    // Check if the proposing user is trying to marry themselves
    if (targetUser.id === userId) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('And then... THEY PUT THEMSELF AS THE ONE TO MARRY... KEKW')
          .setImage('https://media1.tenor.com/m/tFvnLWU0zWMAAAAC/resitas-laugh.gif')],
      });
      return;
    }

    // Check if the target user is a bot
    if (targetUser.bot && !modAbooz) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Seriously?')
          .setDescription('How about you go outside instead of trying to marry a bot-')
          .setImage('https://media1.tenor.com/m/aefLV3eg758AAAAd/silver-wolf-honkai-star-rail.gif')],
      });
      return;
    }

    // Check if the proposing user is already married
    const userMarriageStatus = await this.client.db.checkMarriageStatus(userId);
    if (userMarriageStatus.isMarried) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You\'re already married!')
          .setImage('https://media1.tenor.com/m/VCBut_Csl-cAAAAC/yo-stop-trying-to-cheat-conceited.gif')],
      });
      return;
    }

    // Check if the target user is already married
    const targetMarriageStatus = await this.client.db.checkMarriageStatus(targetUser.id);
    if (targetMarriageStatus.isMarried) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle(`${targetUser.username} is already married!`)],
      });
      return;
    }

    // Send the proposal message with buttons
    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
          .setCustomId('acceptProposal')
          .setLabel('Accept💍')
          .setStyle(Discord.ButtonStyle.Success),
        new Discord.ButtonBuilder()
          .setCustomId('rejectProposal')
          .setLabel('Reject💔')
          .setStyle(Discord.ButtonStyle.Danger),
      );

    await interaction.editReply({
      content: `<@${targetUser.id}>, you have a marriage proposal from <@${userId}>!`,
      embeds: [new Discord.EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('Marriage Proposal')
        .setDescription(`✨${interaction.user.username} has proposed to you.✨`)],
      components: [row],
    });

    // Create a collector to handle button interactions
    const filter = (i) => (i.customId === 'acceptProposal' || i.customId === 'rejectProposal');
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 }); // 1 minute collector

    collector.on('collect', async (i) => {
      modAbooz = targetUser.id === this.client.user.id && allowedUsers.includes(i.user.id);
      if (i.user.id !== targetUser.id && !modAbooz) {
        // Fourth wall break response for unauthorized users
        const responses = [
          `Yo <@${i.user.id}>, this is not for you to decide!`,
          `Hey <@${i.user.id}>! Are you trying to crash the party?`,
          `Hello <@${i.user.id}>? What are you trying to do? This is between them, not you.`,
          `Excuse me, <@${i.user.id}>? This is a private matter!`,
        ];

        const gifs = [
          'https://media1.tenor.com/m/5IBH0NSUPLQAAAAC/lynette-genshin-impact.gif',
          'https://media1.tenor.com/m/Db72dfVmRUoAAAAC/anime-game.gif',
          'https://media1.tenor.com/m/VFSdoooIp14AAAAC/genshin-impact.gif',
          'https://media1.tenor.com/m/N5jGrowCtRIAAAAC/venti-paimon-slap.gif',
          'https://media1.tenor.com/m/DXMFACgb6EsAAAAd/hotaru-firefly.gif',
        ];

        // Randomly select a response and GIF
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

        await i.reply({
          embeds: [new Discord.EmbedBuilder()
            .setColor('#FFAA00')
            .setTitle('Hold On!')
            .setDescription(randomResponse)
            .setImage(randomGif)],
          ephemeral: true, // Only the user who clicked the button will see this
        });
        return; // Stop further processing
      }

      if (i.customId === 'acceptProposal') {
        // Array of acceptance GIFs
        const acceptanceGifs = [
          'https://media1.tenor.com/m/vor_61NjS7oAAAAC/anime-couple.gif',
          'https://media1.tenor.com/m/an0diNvfSSwAAAAC/marriage-anime-sailor-moon.gif',
          'https://media1.tenor.com/m/WCeJaacSAecAAAAC/anime-wedding.gif',
          'https://media1.tenor.com/m/If1oqh_gE0kAAAAC/anime-wedding.gif',
          'https://media1.tenor.com/m/nyS7gg5Ii0oAAAAC/gurren-lagann-marriage.gif',
          'https://media1.tenor.com/m/fLCsfPKZrlkAAAAC/goku-chichi.gif',
          'https://media1.tenor.com/m/R4EeoV4R-kUAAAAd/spy-x-family-loid-forger.gif',
          'https://media1.tenor.com/m/3OYmSePDSVUAAAAC/black-clover-licht.gif',
          'https://media1.tenor.com/m/UcfxIbNWVyQAAAAC/sailor-moon.gif',
        ];

        // Randomly select an acceptance GIF
        const randomAcceptanceGif = acceptanceGifs[Math.floor(Math.random() * acceptanceGifs.length)];

        // Save the marriage to the database
        await this.client.db.addMarriage(userId, targetUser.id);

        await i.update({
          content: `<@${targetUser.id}> has accepted the proposal! Congratulations!`,
          embeds: [new Discord.EmbedBuilder()
            .setColor('#00AA00')
            .setTitle('Proposal Accepted')
            .setDescription(`${targetUser.username} and ${interaction.user.username} are now married! 🎉💍`)
            .setImage(randomAcceptanceGif)],
          components: [],
        });

        collector.stop();
      } else if (i.customId === 'rejectProposal') {
        await i.update({
          content: `<@${targetUser.id}> has rejected the proposal.`,
          embeds: [new Discord.EmbedBuilder()
            .setColor('#AA0000')
            .setTitle('Proposal Rejected')
            .setDescription(`${targetUser.username} has rejected the proposal from ${interaction.user.username}.`)],
          components: [],
        });

        collector.stop();
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        // If no response was collected, disable the buttons
        await interaction.editReply({
          content: 'The proposal has timed out.',
          components: [],
        });
      }
    });
  }
}

module.exports = MarriagePropose;

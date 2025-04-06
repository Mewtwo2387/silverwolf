const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');

class Snipe extends Command {
  constructor(client) {
    super(client, 'snipe', 'Snipe a message (edited or deleted)', [
      {
        name: 'type',
        description: 'The type of snipe: edited or deleted',
        type: 3,
        required: true,
        choices: [
          { name: 'Edited', value: 'edited' },
          { name: 'Deleted', value: 'deleted' },
        ],
      },
      {
        name: 'id',
        description: 'The nth message to snipe',
        type: 4,
        required: false,
      },
    ]);
  }

  async run(interaction) {
    const snipeType = interaction.options.getString('type');
    const count = interaction.options.getInteger('id') || 1;

    if (snipeType === 'edited') {
      await this.handleEditedSnipe(interaction, count);
    } else if (snipeType === 'deleted') {
      await this.handleDeletedSnipe(interaction, count);
    } else {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#AA0000')
            .setTitle('Invalid Snipe Type')
            .setDescription("Please choose either 'edited' or 'deleted'."),
        ],
      });
    }
  }

  async handleEditedSnipe(interaction, count) {
    const { editedMessages } = this.client;
    let total = 0;

    for (const msg of editedMessages) {
      if (msg.old.author.bot) continue;
      if (msg.old.channel.id !== interaction.channel.id) continue;

      total++;
      if (total !== count) continue;

      const embed = new EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`Edited Message #${count}`)
        .setDescription(`Author: ${msg.old.author.username}\nOld: ${msg.old.content}\nNew: ${msg.new.content}`)
        .setTimestamp(msg.new.createdAt);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#AA0000')
      .setTitle('Snipe Failed!')
      .setDescription(`There are only ${total} edited messages to snipe in this channel.`);

    await interaction.editReply({ embeds: [embed] });
  }

  async handleDeletedSnipe(interaction, count) {
    const { deletedMessages } = this.client;
    let total = 0;

    for (const msgData of deletedMessages) {
      const { message, repliedMessageContent, repliedMessageAuthor } = msgData;

      if (message.author.bot) continue;
      if (message.channel.id !== interaction.channel.id) continue;

      total++;
      if (total !== count) continue;

      const embed = new EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`Deleted Message #${count}`)
        .setDescription(`**${message.author.username}**: ${message.content}`)
        .setTimestamp(message.createdAt);

      if (repliedMessageContent && repliedMessageAuthor) {
        const replyLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.reference.messageId}`;
        embed.addFields({
          name: 'Replying To',
          value: `**${repliedMessageAuthor.username}**: [${repliedMessageContent}](${replyLink})`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#AA0000')
      .setTitle('Snipe Failed!')
      .setDescription(`There are only ${total} deleted messages to snipe in this channel.`);

    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = Snipe;

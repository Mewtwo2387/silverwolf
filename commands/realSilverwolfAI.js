const { EmbedBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');

class SilverwolfAI extends Command {
  constructor(client) {
    super(client, 'real-silverwolf-ai', 'talk to silverwolf', [{
      name: 'message',
      description: 'the message to send to silverwolf',
      type: 3,
      required: true,
    }]);
  }

  async run(interaction) {
    if (!this.client.chat) {
      return await interaction.reply('Silverwolf AI is not loaded.');
    }

    const message = interaction.options.getString('message');

    const response = await this.client.chat.sendAndAwaitResponse(message, true);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Silverwolf says...')
          .setDescription(response.text),
      ],
    });
  }
}

module.exports = SilverwolfAI;

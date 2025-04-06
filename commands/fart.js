const { SlashCommandBuilder } = require('discord.js');
const { Command } = require('./classes/command.js');

const cooldowns = new Map();
require('dotenv').config();

class FartCommand extends Command {
  constructor(client) {
    super(client, 'fart', 'Let out a big... one?');
  }

  async run(interaction) {
    const { user } = interaction;
    const userId = user.id;
    const now = Date.now();
    const cooldownAmount = 24 * 60 * 60 * 1000; // 1 day in milliseconds

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = Math.round((expirationTime - now) / (60 * 1000)); // Time left in minutes
        await interaction.editReply('you shat yourself.');

        // Sending a follow-up message without replying directly to the interaction
        await interaction.channel.send('https://tenor.com/view/laughing-cat-catlaughing-laughingcat-point-gif-7577620470218150413');
        return;
      }
    }

    // Set the cooldown
    cooldowns.set(userId, now);

    // Check if the server ID matches the one in the .env file
    const serverId = process.env.ALLOWED_SERVERS;
    const mention = interaction.guild.id === serverId ? '<@&1182683941308747856>' : '@everyone';

    // Send the fart message
    await interaction.editReply({
      content: `# ${mention} ${user} has farted! 💨`,
      allowedMentions: { parse: ['roles', 'everyone'] }, // Ensure role and everyone mentions are allowed
    });
  }
}

module.exports = FartCommand;

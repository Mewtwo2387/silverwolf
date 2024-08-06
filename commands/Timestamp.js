const { Command } = require('./classes/command.js');
const { EmbedBuilder } = require('discord.js');

class TimeCommand extends Command {
    constructor(client) {
        super(client, "discord_timestamp", "Displays the current time in various formats", []);
    }

    async run(interaction) {
        const now = new Date();
        const unixTime = Math.floor(now.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setTitle('Current Time')
            .setColor(0x0099ff) // Optional color
            .addFields([
                { name: 'Relative', value: `<t:${unixTime}:R>`, inline: true },
                { name: 'Short Time', value: `<t:${unixTime}:t>`, inline: true },
                { name: 'Long Time', value: `<t:${unixTime}:T>`, inline: true },
                { name: 'Short Date', value: `<t:${unixTime}:d>`, inline: true },
                { name: 'Long Date', value: `<t:${unixTime}:D>`, inline: true },
                { name: 'Short Date & Time', value: `<t:${unixTime}:f>`, inline: true },
                { name: 'Long Date & Time', value: `<t:${unixTime}:F>`, inline: true },
            ]);

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = TimeCommand;

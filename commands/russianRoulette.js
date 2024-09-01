const { Command } = require('./classes/command.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class RussianRouletteCommand extends Command {
    constructor(client) {
        super(client, "russian_roulette", "Play a game of Russian Roulette", [
            {
                name: 'user1',
                type: 6, // USER type
                description: 'The first participant',
                required: true,
            },
            {
                name: 'user2',
                type: 6, // USER type
                description: 'The second participant',
                required: true,
            },
            {
                name: 'user3',
                type: 6, // USER type
                description: 'The third participant',
                required: false,
            },
            {
                name: 'user4',
                type: 6, // USER type
                description: 'The fourth participant',
                required: false,
            },
            {
                name: 'user5',
                type: 6, // USER type
                description: 'The fifth participant',
                required: false,
            },
            {
                name: 'user6',
                type: 6, // USER type
                description: 'The sixth participant',
                required: false,
            }
        ]);
    }

    async run(interaction) {
        const participants = [];
        
        for (let i = 1; i <= 6; i++) {
            const user = interaction.options.getUser(`user${i}`);
            if (user) participants.push(user);
        }

        if (participants.length < 2) {
            return interaction.reply('At least 2 participants are required to play Russian Roulette.');
        }

        let unluckyPerson = Math.floor(Math.random() * participants.length);
        let turn = 0;

        const embed = new EmbedBuilder()
            .setTitle('Russian Roulette')
            .setColor('#FF0000')
            .setDescription(`${participants[turn].toString()}'s turn!`)
            .setFooter({ text: 'Click the button below to pull the trigger.' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('trigger')
                    .setLabel('Pull the Trigger')
                    .setStyle(ButtonStyle.Danger)
            );

        const message = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });

        const filter = i => i.customId === 'trigger' && i.user.id === participants[turn].id;
        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (turn === unluckyPerson) {
                embed.setDescription(`${participants[turn].toString()} was shot! 💥\n\nGame Over!`);
                await i.update({ embeds: [embed], components: [] });
                collector.stop();
            } else if (turn === participants.length - 1) {
                embed.setDescription(`${participants[turn].toString()} was lucky! 🎉\n\nBut ${participants[unluckyPerson].toString()} was destined to be shot 💥`);
                await i.update({ embeds: [embed], components: [] });
                collector.stop();
            } else {
                turn++;
                embed.setDescription(`${participants[turn].toString()}'s turn!`);
                await i.update({ embeds: [embed] });
            }
        });

        collector.on('end', () => {
            if (message.editable) message.edit({ components: [] });
        });
    }
}

module.exports = RussianRouletteCommand;

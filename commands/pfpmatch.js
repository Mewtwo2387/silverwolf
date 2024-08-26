const { Command } = require('./classes/command.js');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

class PfpMatchReqCommand extends Command {
    constructor(client) {
        super(client, "pfp_match_req", "request a profile picture match", [
            {
                name: 'attachment',
                type: 11, // ATTACHMENT type
                description: 'Upload the image attachment for the match request',
                required: true,
            },
            {
                name: 'user1',
                type: 6, // USER type
                description: 'The first user you want to request a match with',
                required: false,
            },
            {
                name: 'user2',
                type: 6, // USER type
                description: 'The second user you want to request a match with',
                required: false,
            }
            // Add more user options if needed up to 8
        ]);
    }

    async run(interaction) {
        const members = [];
        const acceptanceStatus = {}; // To track the status of each member

        for (let i = 1; i <= 2; i++) { // Adjust the limit to match your command options
            const member = interaction.options.getMember(`user${i}`);
            if (member) {
                members.push(member);
                acceptanceStatus[member.id] = null; // Initially, no one has responded
            }
        }

        const attachment = interaction.options.getAttachment('attachment');
        const requestor = interaction.user;

        // Embed creation
        const embed = new EmbedBuilder()
            .setTitle(`${requestor.username} has requested a match`)
            .setImage(attachment.url)
            .setColor(0x00AE86)
            .setFooter({ text: `Requested by ${requestor.username}`, iconURL: requestor.displayAvatarURL() });

        // Only set the description if there are members to mention
        if (members.length > 0) {
            embed.setDescription(`With:\n${members.map(m => m.toString()).join('\n')}`);
        }

        // Buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('accept')
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('decline')
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
            );

        const message = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });

        // Collector for button interactions
        const filter = i => i.customId === 'accept' || i.customId === 'decline';
        const collector = message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            const user = i.user;

            if (i.customId === 'accept') {
                acceptanceStatus[user.id] = 'accepted';
            } else if (i.customId === 'decline') {
                acceptanceStatus[user.id] = 'declined';
            }

            // If no members were provided, update the description with the button presser
            if (members.length === 0) {
                embed.setDescription(`${user} ${acceptanceStatus[user.id]} ✅`);
            } else {
                // Update the description only if members exist
                embed.setDescription(
                    `${members.map(m => {
                        const status = acceptanceStatus[m.id];
                        if (status === 'accepted') return `${m} accepted ✅`;
                        if (status === 'declined') return `${m} declined ❌`;
                        return m.toString();
                    }).join('\n')}`
                );
            }

            // Check if all members have responded
            const allResponded = Object.values(acceptanceStatus).every(status => status !== null);

            if (allResponded || members.length === 0) {
                await i.update({ embeds: [embed], components: [] });
            } else {
                await i.update({ embeds: [embed] }); // Update the embed without removing buttons
            }
        });

        collector.on('end', async () => {
            if (!message.editable) return;
            await message.edit({ components: [] });
        });
    }
}

module.exports = PfpMatchReqCommand;

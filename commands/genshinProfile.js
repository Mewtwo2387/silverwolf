const { Command } = require('./classes/command.js');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const genshinPfp = path.join(__dirname, '../data/genshinPfps.json');
const genshinNamecards = path.join(__dirname, '../data/genshinNamecards.json');

class GenshinProfile extends Command {
    constructor(client) {
        super(client, 'genshinprofile', 'Get Genshin Impact player data. stolen from collei-bot', [
            {
                name: 'uid',
                description: 'The UID of the Genshin Impact player',
                type: 3, // STRING type for the UID input
                required: true
            }
        ]);
    }

    async run(interaction) {
        const uid = interaction.options.getString('uid');
        const url = `https://enka.network/api/uid/${uid}/`;
        const headers = {
            'User-Agent': 'Silverwolf-bot/1.0 (Example@gmail.com)'
        };

        // Load the profile picture and namecard data
        const profilePictures = JSON.parse(fs.readFileSync(genshinPfp, 'utf8'));
        const namecards = JSON.parse(fs.readFileSync(genshinNamecards, 'utf8'));

        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                console.error(`HTTP Error Response: Status ${response.status} ${response.statusText}`);
                await interaction.editReply({ content: `Failed to fetch data: HTTP status ${response.status}. Please contact mystichunterz for assistance.`, ephemeral: true });
                return;
            }

            const data = await response.json();

            if (!data.playerInfo) {
                await interaction.editReply({ content: 'No data found for the given UID. Please check the UID and try again.', ephemeral: true });
                return;
            }

            const playerInfo = data.playerInfo;

            // Get the profile picture icon name
            const profilePictureId = playerInfo.profilePicture?.id;
            let profilePictureUrl = null;
            if (profilePictureId && profilePictures[profilePictureId]) {
                const iconPath = profilePictures[profilePictureId].iconPath;
                profilePictureUrl = `https://enka.network/ui/${iconPath}.png`;
            }

            // Get the namecard image URL
            const nameCardId = playerInfo.nameCardId;
            let namecardUrl = null;
            if (nameCardId && namecards[nameCardId]) {
                const namecardPath = namecards[nameCardId].icon;
                namecardUrl = `https://enka.network/ui/${namecardPath}.png`;
            }

            // Create an embed to format the response
            const embed = {
                color: 0x00AA00,
                title: `${playerInfo.nickname ?? 'Unknown'}'s Genshin Profile`,
                description: `**Level:** ${playerInfo.level ?? 'Unknown'}\n` +
                    `**World Level:** ${playerInfo.worldLevel ?? 'Unknown'}\n` +
                    `**Signature:** ${playerInfo.signature ?? 'No signature provided'}\n` +
                    `**Achievements:** ${playerInfo.finishAchievementNum ?? '0'}\n` +
                    `**Spiral Abyss:** Floor ${playerInfo.towerFloorIndex ?? 'N/A'}, Level ${playerInfo.towerLevelIndex ?? 'N/A'}\n`+
                    `**namecard_id:** ${playerInfo.nameCardId ?? 'N/A'}\n`,
                thumbnail: profilePictureUrl ? { url: profilePictureUrl } : undefined,
                image: namecardUrl ? { url: namecardUrl } : undefined,
                timestamp: new Date(),
                footer: {
                    text: `UID: ${uid} • Powered by enka.network`
                }
            };

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching data from Genshin Impact API:', error);
            await interaction.editReply({ content: 'Failed to fetch data from Genshin Impact API. Please contact mystichunterz for assistance.', ephemeral: true });
        }
    }
}

module.exports = GenshinProfile;
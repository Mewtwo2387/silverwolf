const { Command } = require('./classes/command.js');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { logError } = require('../utils/log');

const hsrAvatars = path.join(__dirname, '../data/hsrAvartars.json'); // Path to your local avatar data
const hsrCharacters = path.join(__dirname, '../data/hsrCharacters.json'); // Path to character data
const hsrNames = path.join(__dirname, '../data/hsr.json'); // Path to names data
const hsrLC = path.join(__dirname, '../data/hsrLC.json'); // Path to local Lightcone data

class HsrProfile extends Command {
    constructor(client) {
        super(client, 'hsrprofile', 'Get Honkai Star Rail player data.', [
            {
                name: 'uid',
                description: 'The UID of the Honkai Star Rail player',
                type: 3, // STRING type for the UID input
                required: true
            }
        ]);
    }

    async run(interaction) {
        const uid = interaction.options.getString('uid');
        const url = `https://enka.network/api/hsr/uid/${uid}`;
        const headers = {
            'User-Agent': 'Silverwolf-bot/1.0 (Example@gmail.com)'
        };

        // Load the avatar, character, and Lightcone data
        const avatarData = JSON.parse(fs.readFileSync(hsrAvatars, 'utf8'));
        const characterData = JSON.parse(fs.readFileSync(hsrCharacters, 'utf8'));
        const namesData = JSON.parse(fs.readFileSync(hsrNames, 'utf8'));
        const lightconeData = JSON.parse(fs.readFileSync(hsrLC, 'utf8')); // Load Lightcone data

        try {
            const response = await fetch(url, { headers });
            if (!response.ok) {
                logError(`HTTP Error Response: Status ${response.status} ${response.statusText}`);
                await interaction.editReply({ content: `Failed to fetch data: HTTP status ${response.status}. Please contact mystichunterz for assistance.`, ephemeral: true });
                return;
            }

            const data = await response.json();

            if (!data.detailInfo) {
                await interaction.editReply({ content: 'No data found for the given UID. Please check the UID and try again.', ephemeral: true });
                return;
            }

            const detailInfo = data.detailInfo;

            // Get the avatar image URL
            const headIconId = detailInfo.headIcon;
            let avatarUrl = null;
            if (headIconId && avatarData[headIconId]) {
                const iconPath = avatarData[headIconId].Icon;
                avatarUrl = `https://enka.network/ui/hsr/${iconPath}`;
            }

            // Build the Characters on Display section
            let charactersOnDisplay = [];
            for (const character of detailInfo.avatarDetailList) {
                const avatarId = character.avatarId;
                const characterInfo = characterData[avatarId];

                if (characterInfo) {
                    const nameHash = characterInfo.AvatarName.Hash;
                    const characterName = namesData.en[nameHash.toString()] || 'Unknown Character';

                    // Get Lightcone name from Lightcone TID
                    const equipmentTid = character.equipment?.tid;
                    let lightconeName = 'N/A';
                    if (equipmentTid && lightconeData[equipmentTid]) {
                        const lightconeInfo = lightconeData[equipmentTid];
                        const lightconeNameHash = lightconeInfo.EquipmentName.Hash;
                        lightconeName = namesData.en[lightconeNameHash.toString()] || 'Unknown Lightcone';
                    }

                    charactersOnDisplay.push({
                        name: characterName,
                        level: character.level,
                        rarity: characterInfo.Rarity,
                        promotion: character.promotion,
                        equipmentLevel: character.equipment?.level,
                        equipmentTid: equipmentTid,
                        lightconeName: lightconeName // Add Lightcone name to the character info
                    });
                }
            }

            // Create the characters display string
            let charactersDisplayString = charactersOnDisplay.map(character => {
                return `**${character.name}**\n` +`Lvl: ${character.level} | ` +`${character.rarity}⭐\n` + // Include character name, level, and rarity
                    `Lightcone: ${character.lightconeName} | ` + `Lvl: ${character.equipmentLevel || 'N/A'}\n` +
                    '\n'; // Add an empty line between characters
            }).join('');

            // Create an embed to format the response
            const embed = {
                color: 0x00AA00,
                title: `${detailInfo.nickname ?? 'Unknown'}'s Honkai Star Rail Profile`,
                description: `**Level:** ${detailInfo.level ?? 'Unknown'}\n` +
                    `**World Level:** ${detailInfo.worldLevel ?? 'Unknown'}\n` +
                    `**Signature:** ${detailInfo.signature ?? 'No signature provided'}\n` +
                    `**Achievements:** ${detailInfo.recordInfo?.achievementCount ?? '0'}\n` +
                    `**Avatar Count:** ${detailInfo.recordInfo?.avatarCount ?? '0'}\n` +
                    `**Equipment Count:** ${detailInfo.recordInfo?.equipmentCount ?? '0'}\n` +
                    `**Max Rogue Challenge Score:** ${detailInfo.recordInfo?.maxRogueChallengeScore ?? 'N/A'}\n` +
                    `**Friend Count:** ${detailInfo.friendCount ?? '0'}\n` +
                    `**Books Owned:** ${detailInfo.recordInfo?.bookCount ?? '0'}\n` +
                    `**Relics Owned:** ${detailInfo.recordInfo?.relicCount ?? '0'}\n` +
                    `**Music Count:** ${detailInfo.recordInfo?.musicCount ?? '0'}`,
                thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
                fields: [
                    {
                        name: 'Characters on Display',
                        value: charactersDisplayString || 'No characters found.',
                        inline: false
                    }
                ],
                timestamp: new Date(),
                footer: {
                    text: `UID: ${uid} • Powered by enka.network`
                }
            };

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            logError('Error fetching data from Honkai Star Rail API:', error);
            await interaction.editReply({ content: 'Failed to fetch data from Honkai Star Rail API. Please contact mystichunterz for assistance.', ephemeral: true });
        }
    }
}

module.exports = HsrProfile;

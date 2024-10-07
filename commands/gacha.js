const { Command } = require('./classes/command.js');
const fs = require('fs');
const { EmbedBuilder } = require('discord.js');

class GachaRollCommand extends Command {
    constructor(client) {
        super(client, "gacha", "TECHNICAL TEST, WORK IN PROGRESS", [
            {
                name: 'amount',
                description: 'Number of rolls (1 or 10)',
                type: 4, // integer
                required: true,
                choices: [
                    { name: '1', value: 1 },
                    { name: '10', value: 10 }
                ]
            }
        ]);

        // Load character pool from JSON
        this.characterPool = JSON.parse(fs.readFileSync('./data/characters.json', 'utf-8'));
    }

    getRandomCharacter(rarity) {
        const filteredPool = this.characterPool.filter(character => character.rarity === rarity);
        return filteredPool[Math.floor(Math.random() * filteredPool.length)];
    }

    calculatePityRate(pityCount) {
        if (pityCount >= 74) {
            return Math.min(1, (pityCount - 73) * 0.1); // Increase rate from 74 rolls onwards
        }
        return 0.006; // Base rate for 5-star (0.6%)
    }

    async run(interaction) {
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;
        let pityCount = await this.client.db.getUserAttr(interaction.user.id, 'pity');
        let results = [];
        let gotFiveStar = false;

        for (let i = 0; i < amount; i++) {
            let rollResult;
            const pityRate = this.calculatePityRate(pityCount);
            const roll = Math.random();

            if (roll < pityRate) {
                // 5-star roll
                rollResult = this.getRandomCharacter(5);
                gotFiveStar = true;
                pityCount = 0; // Reset pity
            } else if (roll < 0.056) {
                // 4-star roll (base rate 5.6%)
                rollResult = this.getRandomCharacter(4);
                pityCount++;
            } else {
                // 3-star roll (common)
                rollResult = this.getRandomCharacter(3);
                pityCount++;
            }

            results.push(rollResult);
        }

        // Update the user's pity count
        await this.client.db.setUserAttr(userId, 'pity', pityCount);

        // Build the result embed
        const embed = new EmbedBuilder()
            .setTitle(`NOT FINAL, TECHNICAL TEST, WORK IN PROGRESS, PROGRESS IS NOT SAVED`)
            //.setTitle(`Gacha Roll Results (${amount})`)
            .setDescription(results.map(char => `**${char.name}** - ${char.type} - ${char.rarity}★`).join('\n'))
            .setColor(gotFiveStar ? 0xFFD700 : 0x00FF00) // Gold for 5-star, green otherwise
            .setFooter({ text: `Pity: ${pityCount}, names are placeholders` });

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = GachaRollCommand;

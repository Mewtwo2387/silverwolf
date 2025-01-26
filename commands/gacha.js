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

        // Load JSON data
        const charactersRaw = JSON.parse(fs.readFileSync('./data/hsrCharacters.json', 'utf-8'));
        const lightconesRaw = JSON.parse(fs.readFileSync('./data/hsrLC.json', 'utf-8'));
        this.namesData = JSON.parse(fs.readFileSync('./data/hsr.json', 'utf-8'));

        // Convert JSON objects into arrays
        this.characterPool = Object.values(charactersRaw);
        this.lightconePool = Object.values(lightconesRaw);
    }

    getRandomItem(pool) {
        return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
    }

    calculatePityRate(pityCount) {
        return pityCount >= 74 ? Math.min(1, (pityCount - 73) * 0.1) : 0.006;
    }

    getItemName(item) {
        if (!item) return 'Unknown';
    
        // Check for character name first
        if (item.AvatarName?.Hash) {
            let nameHash = item.AvatarName.Hash.toString();
            return this.namesData.en[nameHash] || 'Unknown';
        }
    
        // Check for lightcone name
        if (item.EquipmentName?.Hash) {
            let nameHash = item.EquipmentName.Hash.toString();
            return this.namesData.en[nameHash] || 'Unknown';
        }
    
        return 'Unknown';
    }
    

    async run(interaction) {
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;
        let pityCount = await this.client.db.getUserAttr(userId, 'pity');
        let dinonuggies = await this.client.db.getUserAttr(userId, 'dinonuggies');

        const costPerRoll = 160;
        const totalCost = costPerRoll * amount;

        if (dinonuggies < totalCost) {
            const embed = new EmbedBuilder()
                .setTitle('Not enough dinonuggies!')
                .setDescription(`You need ${totalCost}, but you only have ${dinonuggies}.`)
                .setColor(0xFF0000);
            return interaction.editReply({ embeds: [embed] });
        }

        // Deduct cost
        dinonuggies -= totalCost;
        await this.client.db.setUserAttr(userId, 'dinonuggies', dinonuggies);

        let results = [];
        let gotFiveStar = false;

        for (let i = 0; i < amount; i++) {
            let rollResult;
            const pityRate = this.calculatePityRate(pityCount);
            const roll = Math.random();

            if (roll < pityRate) {
                rollResult = Math.random() < 0.5 ? this.getRandomItem(this.characterPool.filter(c => c.Rarity === 5)) : this.getRandomItem(this.lightconePool.filter(lc => lc.Rarity === 5));
                gotFiveStar = true;
                pityCount = 0;
            } else if (roll < 0.056) {
                rollResult = Math.random() < 0.5 ? this.getRandomItem(this.characterPool.filter(c => c.Rarity === 4)) : this.getRandomItem(this.lightconePool.filter(lc => lc.Rarity === 4));
                pityCount++;
            } else {
                rollResult =  this.getRandomItem(this.lightconePool.filter(lc => lc.Rarity === 3));
                pityCount++;
            }

            results.push({
                name: this.getItemName(rollResult),
                type: rollResult?.AvatarName ? 'Character' : 'Lightcone',
                rarity: rollResult?.Rarity || '?'
            });
        }

        await this.client.db.setUserAttr(userId, 'pity', pityCount);

        const embed = new EmbedBuilder()
            .setTitle(`Gacha Roll Results for ${interaction.user.username} (${amount})`)
            .setDescription(results.map(item => `**${item.name}** - ${item.type} - ${item.rarity}★`).join('\n'))
            .setColor(gotFiveStar ? 0xFFD700 : 0x00FF00)
            .setFooter({ text: `Pity: ${pityCount}` });

        await interaction.editReply({ embeds: [embed] });
    }
}

module.exports = GachaRollCommand;

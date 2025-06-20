const fs = require('fs');
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { Command } = require('./classes/command');

class Gacha extends Command {
  constructor(client) {
    super(client, 'gacha', 'TECHNICAL TEST, WORK IN PROGRESS', [
      {
        name: 'amount',
        description: 'Number of rolls (1 or 10)',
        type: 4,
        required: true,
        choices: [
          { name: '1', value: 1 },
          { name: '10', value: 10 },
        ],
      },
    ]);

    const charactersRaw = JSON.parse(fs.readFileSync('./data/hsrCharacters.json', 'utf-8'));
    const lightconesRaw = JSON.parse(fs.readFileSync('./data/hsrLC.json', 'utf-8'));
    this.namesData = JSON.parse(fs.readFileSync('./data/hsr.json', 'utf-8'));

    this.characterPool = Object.values(charactersRaw);
    this.lightconePool = Object.values(lightconesRaw);
  }

  getRandomItem(pool) {
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  calculatePityRate(pityCount) {
    return pityCount >= 74 ? Math.min(1, (pityCount - 73) * 0.1) : 0.006;
  }

  getItemDetails(item) {
    if (!item) return { name: 'Unknown', imagePath: null, rarity: 'Unknown' };

    const nameHash = item.AvatarName?.Hash?.toString() || item.EquipmentName?.Hash?.toString();
    const name = this.namesData.en[nameHash] || 'Unknown';
    const imagePath = item.AvatarCutinFrontImgPath || item.ImagePath || null;
    const rarity = item.Rarity || 'Unknown'; // Assuming Rarity is a property in your item data

    return {
      name,
      imageUrl: imagePath ? `https://enka.network/ui/hsr/${imagePath}` : null,
      rarity,
    };
  }

  async run(interaction) {
    const amount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    let pityCount = await this.client.db.user.getUserAttr(userId, 'pity');
    const dinonuggies = await this.client.db.user.getUserAttr(userId, 'dinonuggies');

    const costPerRoll = 160;
    const totalCost = costPerRoll * amount;

    if (dinonuggies < totalCost) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setTitle('Not enough dinonuggies!')
          .setDescription(`You need ${totalCost}, but you only have ${dinonuggies}.`)
          .setColor(0xFF0000)],
      });
      return;
    }

    await this.client.db.user.addUserAttr(userId, 'dinonuggies', -totalCost);

    const results = [];
    let gotFiveStar = false;

    for (let i = 0; i < amount; i += 1) {
      let rollResult;
      const pityRate = this.calculatePityRate(pityCount);
      const roll = Math.random();

      if (roll < pityRate) {
        rollResult = Math.random() < 0.5
          ? this.getRandomItem(this.characterPool.filter((c) => c.Rarity === 5))
          : this.getRandomItem(this.lightconePool.filter((lc) => lc.Rarity === 5));
        gotFiveStar = true;
        pityCount = 0;
      } else if (roll < 0.056) {
        rollResult = Math.random() < 0.5
          ? this.getRandomItem(this.characterPool.filter((c) => c.Rarity === 4))
          : this.getRandomItem(this.lightconePool.filter((lc) => lc.Rarity === 4));
        pityCount += 1;
      } else {
        rollResult = this.getRandomItem(this.lightconePool.filter((lc) => lc.Rarity === 3));
        pityCount += 1;
      }

      const itemDetails = this.getItemDetails(rollResult);
      results.push(itemDetails);

      // Determine if it's a character or lightcone
      const itemType = this.characterPool.some((c) => c.name === itemDetails.name) ? 'Character' : 'Lightcone';
      // Store roll in the database
      this.client.db.gacha.addGachaItem(userId, itemDetails.name, itemType, itemDetails.rarity);
    }

    await this.client.db.user.setUserAttr(userId, 'pity', pityCount);

    let currentIndex = 0;

    const updateMessage = async (i) => {
      const item = results[currentIndex];
      const embed = new EmbedBuilder()
        .setTitle(`Gacha Roll #${currentIndex + 1}`)
        .setDescription(`**${item.name}**`)
        .setImage(item.imageUrl)
        .setColor(gotFiveStar ? 0xFFD700 : 0x00FF00)
        .setFooter({ text: `Pity: ${pityCount}` });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('nextRoll')
            .setLabel('➡️ Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentIndex === results.length - 1),
          new ButtonBuilder()
            .setCustomId('skipResults')
            .setLabel('Skip to Results')
            .setStyle(ButtonStyle.Danger),
        );

      await i.update({ embeds: [embed], components: [row] });
    };

    const initialEmbed = new EmbedBuilder()
      .setTitle('Gacha Roll #1')
      .setDescription(`**${results[0].name}**`)
      .setImage(results[0].imageUrl)
      .setColor(gotFiveStar ? 0xFFD700 : 0x00FF00)
      .setFooter({ text: `Pity: ${pityCount}` });

    const initialRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('nextRoll')
          .setLabel('➡️ Next')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('skipResults')
          .setLabel('Skip to Results')
          .setStyle(ButtonStyle.Danger),
      );

    const message = await interaction.editReply({ embeds: [initialEmbed], components: [initialRow] });

    const collector = message.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (i) => {
      if (i.customId === 'next_roll') {
        currentIndex += 1;
        if (currentIndex < results.length) {
          await updateMessage(i);
        }
      } else if (i.customId === 'skip_results') {
        collector.stop();
      }
    });

    collector.on('end', async () => {
      await message.edit({ components: [] });
      const finalEmbed = new EmbedBuilder()
        .setTitle(`Gacha Roll Results for ${interaction.user.username} (${amount})`)
        .setDescription(results.map((item) => `**${item.name}** - ${item.rarity}★`).join('\n'))
        .setColor(gotFiveStar ? 0xFFD700 : 0x00FF00);
      await interaction.followUp({ embeds: [finalEmbed] });
    });
  }
}

module.exports = Gacha;

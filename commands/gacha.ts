/* eslint-disable no-unreachable */
import path from 'path';
import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { Command } from './classes/Command';

let pools: { namesData: any; characterPool: any[]; lightconePool: any[] } | null = null;

async function getPools() {
  if (!pools) {
    const [charactersRaw, lightconesRaw, hsrNames] = await Promise.all([
      Bun.file(path.join(__dirname, '../data/hsrCharacters.json')).json(),
      Bun.file(path.join(__dirname, '../data/hsrLC.json')).json(),
      Bun.file(path.join(__dirname, '../data/hsr.json')).json(),
    ]);
    pools = {
      namesData: hsrNames,
      characterPool: Object.values(charactersRaw),
      lightconePool: Object.values(lightconesRaw),
    };
  }
  return pools!;
}

class Gacha extends Command {
  namesData: any;
  characterPool: any[];
  lightconePool: any[];

  constructor(client: any) {
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
    ], { blame: 'xei' });

    this.namesData = null;
    this.characterPool = [];
    this.lightconePool = [];
  }

  getRandomItem(pool: any[]) {
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  calculatePityRate(pityCount: number) {
    return pityCount >= 74 ? Math.min(1, (pityCount - 73) * 0.1) : 0.006;
  }

  getItemDetails(item: any) {
    if (!item) return { name: 'Unknown', imagePath: null, rarity: 'Unknown' };

    const nameHash = item.AvatarName?.Hash?.toString() || item.EquipmentName?.Hash?.toString();
    const name = this.namesData.en[nameHash] || 'Unknown';
    const imagePath = item.AvatarCutinFrontImgPath || item.ImagePath || null;
    const rarity = item.Rarity || 'Unknown';

    return {
      name,
      imageUrl: imagePath ? `https://enka.network${imagePath}` : null,
      rarity,
    };
  }

  async run(interaction: any): Promise<void> {
    await interaction.editReply({ content: 'gacha is not ready yet', ephemeral: true });
    return;

    const loaded = await getPools();
    this.namesData = loaded.namesData;
    this.characterPool = loaded.characterPool;
    this.lightconePool = loaded.lightconePool;

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

    const results: any[] = [];
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

      const itemType = this.characterPool.some((c) => c.name === itemDetails.name) ? 'Character' : 'Lightcone';
      this.client.db.gacha.addGachaItem(userId, itemDetails.name, itemType, itemDetails.rarity);
    }

    await this.client.db.user.setUserAttr(userId, 'pity', pityCount);

    let currentIndex = 0;

    const updateMessage = async (i: any) => {
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

    collector.on('collect', async (i: any) => {
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

export default Gacha;

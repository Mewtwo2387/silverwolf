import { Command } from './classes/Command';
import { logError } from '../utils/log';
import _avatarData from '../data/hsrAvartars.json';
import _characterData from '../data/hsrCharacters.json';
import _namesData from '../data/hsr.json';
import _lightconeData from '../data/hsrLC.json';

const avatarData: any = _avatarData;
const characterData: any = _characterData;
const namesData: any = _namesData;
const lightconeData: any = _lightconeData;

class HsrProfile extends Command {
  constructor(client: any) {
    super(client, 'hsrprofile', 'Get Honkai Star Rail player data.', [
      {
        name: 'uid',
        description: 'The UID of the Honkai Star Rail player',
        type: 3,
        required: true,
      },
    ], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const uid = interaction.options.getString('uid');
    const url = `https://enka.network/api/hsr/uid/${uid}`;
    const headers = {
      'User-Agent': 'Silverwolf-bot/1.0 (Example@gmail.com)',
    };

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

      const { detailInfo } = data;

      const headIconId = detailInfo.headIcon;
      let avatarUrl = null;
      if (headIconId && avatarData[headIconId]) {
        const iconPath = avatarData[headIconId].Icon;
        avatarUrl = `https://enka.network/ui/hsr/${iconPath}`;
      }

      const charactersOnDisplay: any[] = [];
      detailInfo.avatarDetailList.forEach((character: any) => {
        const { avatarId } = character;
        const characterInfo = characterData[avatarId];

        if (characterInfo) {
          const nameHash = characterInfo.AvatarName.Hash;
          const characterName = namesData.en[nameHash.toString()] || 'Unknown Character';

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
            equipmentTid,
            lightconeName,
          });
        }
      });

      const charactersDisplayString = charactersOnDisplay.map((character) => `**${character.name}**\nLvl: ${character.level} | ${character.rarity}⭐\nLightcone: ${character.lightconeName} | Lvl: ${character.equipmentLevel || 'N/A'}\n\n`).join('');

      const embed = {
        color: 0x00AA00,
        title: `${detailInfo.nickname ?? 'Unknown'}'s Honkai Star Rail Profile`,
        description: `**Level:** ${detailInfo.level ?? 'Unknown'}\n`
          + `**World Level:** ${detailInfo.worldLevel ?? 'Unknown'}\n`
          + `**Signature:** ${detailInfo.signature ?? 'No signature provided'}\n`
          + `**Achievements:** ${detailInfo.recordInfo?.achievementCount ?? '0'}\n`
          + `**Avatar Count:** ${detailInfo.recordInfo?.avatarCount ?? '0'}\n`
          + `**Equipment Count:** ${detailInfo.recordInfo?.equipmentCount ?? '0'}\n`
          + `**Max Rogue Challenge Score:** ${detailInfo.recordInfo?.maxRogueChallengeScore ?? 'N/A'}\n`
          + `**Friend Count:** ${detailInfo.friendCount ?? '0'}\n`
          + `**Books Owned:** ${detailInfo.recordInfo?.bookCount ?? '0'}\n`
          + `**Relics Owned:** ${detailInfo.recordInfo?.relicCount ?? '0'}\n`
          + `**Music Count:** ${detailInfo.recordInfo?.musicCount ?? '0'}`,
        thumbnail: avatarUrl ? { url: avatarUrl } : undefined,
        fields: [
          {
            name: 'Characters on Display',
            value: charactersDisplayString || 'No characters found.',
            inline: false,
          },
        ],
        timestamp: new Date(),
        footer: {
          text: `UID: ${uid} • Powered by enka.network`,
        },
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error fetching data from Honkai Star Rail API:', error);
      await interaction.editReply({ content: 'Failed to fetch data from Honkai Star Rail API. Please contact mystichunterz for assistance.', ephemeral: true });
    }
  }
}

export default HsrProfile;

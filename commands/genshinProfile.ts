import { Command } from './classes/Command';
import { logError } from '../utils/log';
import _profilePictures from '../data/genshinPfps.json';
import _namecards from '../data/genshinNamecards.json';

const profilePictures: any = _profilePictures;
const namecards: any = _namecards;

class GenshinProfile extends Command {
  constructor(client: any) {
    super(client, 'genshinprofile', 'Get Genshin Impact player data. stolen from collei-bot', [
      {
        name: 'uid',
        description: 'The UID of the Genshin Impact player',
        type: 3,
        required: true,
      },
    ], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const uid = interaction.options.getString('uid');
    const url = `https://enka.network/api/uid/${uid}/`;
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

      if (!data.playerInfo) {
        await interaction.editReply({ content: 'No data found for the given UID. Please check the UID and try again.', ephemeral: true });
        return;
      }

      const { playerInfo } = data;

      const profilePictureId = playerInfo.profilePicture?.id;
      let profilePictureUrl = null;
      if (profilePictureId && profilePictures[profilePictureId]) {
        const { iconPath } = profilePictures[profilePictureId];
        profilePictureUrl = `https://enka.network/ui/${iconPath}.png`;
      }

      const { nameCardId } = playerInfo;
      let namecardUrl = null;
      if (nameCardId && namecards[nameCardId]) {
        const namecardPath = namecards[nameCardId].icon;
        namecardUrl = `https://enka.network/ui/${namecardPath}.png`;
      }

      const embed = {
        color: 0x00AA00,
        title: `${playerInfo.nickname ?? 'Unknown'}'s Genshin Profile`,
        description: `**Level:** ${playerInfo.level ?? 'Unknown'}\n`
          + `**World Level:** ${playerInfo.worldLevel ?? 'Unknown'}\n`
          + `**Signature:** ${playerInfo.signature ?? 'No signature provided'}\n`
          + `**Achievements:** ${playerInfo.finishAchievementNum ?? '0'}\n`
          + `**Spiral Abyss:** Floor ${playerInfo.towerFloorIndex ?? 'N/A'}, Level ${playerInfo.towerLevelIndex ?? 'N/A'}\n`
          + `**Namecard ID:** ${playerInfo.nameCardId ?? 'N/A'}\n`,
        thumbnail: profilePictureUrl ? { url: profilePictureUrl } : undefined,
        image: namecardUrl ? { url: namecardUrl } : undefined,
        timestamp: new Date(),
        footer: {
          text: `UID: ${uid} • Powered by enka.network`,
        },
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error fetching data from Genshin Impact API:', error);
      await interaction.editReply({ content: 'Failed to fetch data from Genshin Impact API. Please contact mystichunterz for assistance.', ephemeral: true });
    }
  }
}

export default GenshinProfile;

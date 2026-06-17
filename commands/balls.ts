import { EmbedBuilder } from 'discord.js';
import { Command } from './classes/Command';
import { logError } from '../utils/log';

// Unsplash requires attribution back to the photographer and to Unsplash, with
// the UTM params below, per their API guidelines:
// https://help.unsplash.com/en/articles/2511315-guideline-attribution
const UTM = 'utm_source=silverwolf&utm_medium=referral';

class Balls extends Command {
  constructor(client: any) {
    super(client, 'balls', 'Fetch a random picture of balls', [], {
      ephemeral: false,
      skipDefer: false,
      isSubcommandOf: null,
      blame: 'xei',
    });
  }

  async run(interaction: any): Promise<void> {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
      logError('Balls: UNSPLASH_ACCESS_KEY is not set');
      await interaction.editReply({ content: 'Balls are unavailable right now (missing API key).' });
      return;
    }

    try {
      const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent('balls')}&orientation=landscape`;
      const timeoutMs = Number(process.env.DISCORD_FETCH_TIMEOUT_MS ?? 10000);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          'Accept-Version': 'v1',
        },
      });

      if (!response.ok) throw new Error(`Unsplash responded ${response.status}`);

      const photo = await response.json();
      const imageUrl = photo?.urls?.regular;
      if (!imageUrl) throw new Error('No image in Unsplash response');

      // Trigger a download event so the photographer gets credited, as Unsplash requires.
      const downloadLocation = photo?.links?.download_location;
      if (downloadLocation) {
        const attributionUrl = new URL(downloadLocation);
        attributionUrl.searchParams.set('client_id', accessKey);
        fetch(attributionUrl.toString()).catch(() => {});
      }

      const photographer = photo?.user?.name || 'Unknown';
      const photographerLink = photo?.user?.links?.html
        ? `${photo.user.links.html}?${UTM}`
        : null;
      const photoLink = photo?.links?.html ? `${photo.links.html}?${UTM}` : null;
      const credit = photographerLink
        ? `[${photographer}](${photographerLink})`
        : photographer;

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Balls ⚽')
        .setImage(imageUrl)
        .setDescription(
          `Photo by ${credit} on [Unsplash](https://unsplash.com/?${UTM})`,
        );

      if (photo?.description || photo?.alt_description) {
        embed.setFooter({ text: photo.description || photo.alt_description });
      }
      if (photoLink) embed.setURL(photoLink);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error fetching balls from Unsplash:', error);
      await interaction.editReply({ content: 'Sorry, I couldn\'t fetch any balls. Please try again later.' });
    }
  }
}

export default Balls;

import * as Discord from 'discord.js';
import * as cheerio from 'cheerio';
import { logError } from '../utils/log';
import { Command } from './classes/Command';

function extractStandings(html: string, type: string): any[] {
  const $ = cheerio.load(html);
  const rows = $('#results-table tbody tr').toArray();

  return rows.map((rowEl) => {
    const row = $(rowEl);
    const columns = row.find('td');

    if (type === 'drivers' && columns.length === 5) {
      const driverLinkEl = $(columns[1]).find('a');
      let driverName = '';

      if (driverLinkEl.length) {
        const nameContainerSpanCandidates = [
          driverLinkEl.find('span').eq(1),
          driverLinkEl.find('span').eq(0),
        ];

        let nameContainerSpan: any = null;
        for (const candidate of nameContainerSpanCandidates) {
          if (candidate.length && candidate.find('.max-lg\\:hidden').length) {
            nameContainerSpan = candidate;
            break;
          }
        }

        if (nameContainerSpan) {
          const firstName = nameContainerSpan.find('.max-lg\\:hidden').text().trim();
          const lastName = nameContainerSpan.find('.max-md\\:hidden').text().trim();
          driverName = `${firstName} ${lastName}`.trim();
        } else {
          driverName = driverLinkEl.text().trim().replace(/\s+/g, ' ');
        }
      } else {
        driverName = $(columns[1]).text().trim().replace(/\s+/g, ' ');
      }

      return {
        position: parseInt($(columns[0]).text().trim(), 10),
        driver: driverName,
        nationality: $(columns[2]).text().trim(),
        car: $(columns[3]).text().trim(),
        points: parseInt($(columns[4]).text().trim(), 10),
      };
    }

    if (type === 'teams' && columns.length === 3) {
      return {
        position: parseInt($(columns[0]).text().trim(), 10),
        team: $(columns[1]).text().trim(),
        points: parseInt($(columns[2]).text().trim(), 10),
      };
    }

    return null;
  }).filter(Boolean);
}

function buildEmbed(data: any[], type: string, year: number): Discord.EmbedBuilder {
  const title = type === 'drivers' ? `F1 Driver Standings (${year})` : `F1 Team Standings (${year})`;
  const color = type === 'drivers' ? '#FF0000' : '#008000';
  const rows = type === 'drivers' ? 25 : 10;

  const description = data.slice(0, rows).map((entry) => (type === 'drivers'
    ? `${entry.position}. **${entry.driver}** (${entry.nationality}) - Car: ${entry.car}, Points: ${entry.points}`
    : `${entry.position}. **${entry.team}** - Points: ${entry.points}`)).join('\n');

  return new Discord.EmbedBuilder()
    .setTitle(title)
    .setColor(color as Discord.ColorResolvable)
    .setDescription(description)
    .setTimestamp()
    .setThumbnail('https://logodownload.org/wp-content/uploads/2016/11/formula-1-logo-0.png')
    .setFooter({ text: 'Data provided by Formula1.com' });
}

class F1Standings extends Command {
  constructor(client: any) {
    super(client, 'f1-standings', 'Fetch F1 standings (drivers or constructors)', [
      {
        name: 'type',
        description: 'Choose between driver or constructor standings',
        type: 3,
        required: true,
        choices: [
          { name: 'Drivers', value: 'drivers' },
          { name: 'Teams', value: 'teams' },
        ],
      },
      {
        name: 'year',
        description: 'Select a year (default: current year)',
        type: 4,
        required: false,
      },
    ], { blame: 'xei' });
  }

  async run(interaction: any): Promise<void> {
    const type = interaction.options.getString('type');
    const yearInput = interaction.options.getInteger('year');
    const currentYear = new Date().getFullYear();
    const year = yearInput || currentYear;

    const minYear = type === 'drivers' ? 1950 : 1958;

    if (year > currentYear || year < minYear) {
      interaction.editReply({
        content: `Invalid year for ${type} standings. Must be between ${minYear} and ${currentYear}.`,
        ephemeral: true,
      });
    }

    const endpoint = type === 'drivers' ? 'drivers' : 'team';
    const apiUrl = `https://www.formula1.com/en/results/${year}/${endpoint}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const html = await response.text();
      const standings = extractStandings(html, type);
      const embed = buildEmbed(standings, type, year);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logError('Error fetching F1 standings:', error);
      await interaction.editReply({
        content: 'Failed to fetch the F1 standings. Please try again later.',
        ephemeral: true,
      });
    }
  }
}

export default F1Standings;

import * as Discord from 'discord.js';
import { logError } from '../utils/log';
import { Command } from './classes/Command';

function extractStandings(html: string, type: string): any[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JSDOM } = require('jsdom') as { JSDOM: any };
  const dom = new JSDOM(html);
  const rows: any[] = dom.window.document.getElementById('results-table')
    ?.querySelector('tbody')
    ?.querySelectorAll('tr') || [];
  return Array.from(rows)
    .map((row: any) => {
      const columns = row.querySelectorAll('td');
      if (type === 'drivers' && columns.length === 5) {
        const driverLinkEl = columns[1].querySelector('a');
        let driverName = '';

        if (driverLinkEl) {
          const nameContainerSpanCandidates = [
            driverLinkEl.querySelectorAll('span')[1],
            driverLinkEl.querySelectorAll('span')[0],
          ];

          let nameContainerSpan: Element | null = null;
          nameContainerSpanCandidates.forEach((nameContainerSpanCandidate) => {
            if (nameContainerSpanCandidate && nameContainerSpanCandidate.querySelector('.max-lg\\:hidden')) {
              nameContainerSpan = nameContainerSpanCandidate;
            }
          });

          if (nameContainerSpan) {
            const firstNameEl = (nameContainerSpan as Element).querySelector('.max-lg\\:hidden');
            const lastNameEl = (nameContainerSpan as Element).querySelector('.max-md\\:hidden');

            const firstName = firstNameEl ? firstNameEl.textContent!.trim() : '';
            const lastName = lastNameEl ? lastNameEl.textContent!.trim() : '';
            driverName = `${firstName} ${lastName}`.trim();
          } else {
            driverName = driverLinkEl.textContent!.trim().replace(/\s+/g, ' ');
          }
        } else {
          driverName = columns[1].textContent!.trim().replace(/\s+/g, ' ');
        }

        return {
          position: parseInt(columns[0].textContent!.trim(), 10),
          driver: driverName,
          nationality: columns[2].textContent!.trim(),
          car: columns[3].textContent!.trim(),
          points: parseInt(columns[4].textContent!.trim(), 10),
        };
      }

      if (type === 'teams' && columns.length === 3) {
        return {
          position: parseInt(columns[0].textContent!.trim(), 10),
          team: columns[1].textContent!.trim(),
          points: parseInt(columns[2].textContent!.trim(), 10),
        };
      }

      return null;
    })
    .filter(Boolean);
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

const Discord = require('discord.js');
const { Command } = require('./classes/command');
const { format } = require('../utils/math');
const { log } = require('../utils/log');

const PREGNANCY_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week

class BabyGet extends Command {
  constructor(client) {
    super(client, 'get', 'get a list of babies from parents', [
      {
        name: 'parent',
        description: 'The parent of the baby (default: you)',
        type: 6,
        required: false,
      },
    ], { isSubcommandOf: 'baby' });
  }

  async run(interaction) {
    const parent = interaction.options.getUser('parent') || interaction.user;

    const babies = await this.client.db.baby.getBabiesByParentId(parent.id);
    log(`babies: ${JSON.stringify(babies)}`);

    if (babies.length === 0) {
      await interaction.editReply({
        embeds: [
          new Discord.EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('404 Baby Not Found'),
        ],
      });
      return;
    }

    let result = '';

    babies.forEach((baby) => {
      result += `**${baby.name}**\n`;
      result += `ID: ${baby.id}\n`;
      result += `Status: ${baby.status}\n`;
      switch (baby.job) {
        case 'nuggieClaimer':
          result += `Nuggie Claimer - ${baby.nuggieClaimerClaims} claims, ${format(baby.nuggieClaimerClaimed)} nuggies claimed\n`;
          break;
        case 'gambler':
          result += `Gambler - ${baby.gamblerGames} games (${baby.gamblerWins} wins, ${baby.gamblerLosses} losses), ${format(baby.gamblerCreditsWon - baby.gamblerCreditsGambled)} net winnings (${format(baby.gamblerCreditsWon)} won, ${format(baby.gamblerCreditsGambled)} gambled)\n`;
          break;
        case 'pinger':
          result += `Pinger - ${baby.pingerPings} pings\n`;
          break;
        default:
          result += 'No job\n';
          break;
      }
      result += `Level: Lv ${baby.level}\n`;
      result += `Mother: <@${baby.motherId}>\n`;
      result += `Father: <@${baby.fatherId}>\n`;
      if (baby.status === 'unborn') {
        const created = new Date(baby.created);
        const now = new Date();
        const diffTime = Math.abs(now - created);
        if (diffTime > PREGNANCY_DURATION) {
          result += 'Can give birth now! Use /baby birth!\n';
        } else {
          result += `Can give birth in ${format((PREGNANCY_DURATION - diffTime) / (1000 * 60 * 60 * 24), true)} days!\n`;
        }
      } else {
        result += `Born: ${baby.born}\n`;
      }
      result += '\n';
    });

    await interaction.editReply({
      embeds: [
        new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle(`Babies of ${parent.username}`)
          .setDescription(result),
      ],
    });
  }
}

module.exports = BabyGet;

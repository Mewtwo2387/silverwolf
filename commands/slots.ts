import * as Discord from 'discord.js';
import { Command } from './classes/Command';
import { format } from '../utils/math';
import { checkValidBet } from '../utils/betting';
import skins from '../data/config/skin/slots.json';

export interface SlotsEmote { emote: string; value: number; }
export interface SlotsSkin {
  name: string;
  emotes: SlotsEmote[];
  color: string;
  winMessage: string;
  loseMessage: string;
}

const lines = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 1, 2, 2, 2],
  [2, 1, 0, 0, 0],
  [0, 0, 0, 1, 2],
  [2, 2, 2, 1, 0],
];

export interface SlotsResult {
  results: SlotsEmote[][];
  multi: number;
  winnings: number;
  isWin: boolean;
  season: string;
  skin: SlotsSkin;
  winMessage: string;
  loseMessage: string;
}

export async function spinSlots(client: any, userId: string, amount: number): Promise<SlotsResult> {
  const season = await client.db.globalConfig.getGlobalConfig('season') || 'normal';
  const skinsAny = skins as any;
  const resolvedSeason = Object.hasOwn(skinsAny, season) ? season : 'normal';
  const skin: SlotsSkin = skinsAny[resolvedSeason];

  const smugs = skin.emotes;

  const results: SlotsEmote[][] = [[], [], []];

  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      results[i].push(smugs[Math.floor(Math.random() * smugs.length)]);
    }
  }

  let multi = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (
      results[line[0]][0].emote === results[line[1]][1].emote
      && results[line[1]][1].emote === results[line[2]][2].emote
      && results[line[2]][2].emote === results[line[3]][3].emote
      && results[line[3]][3].emote === results[line[4]][4].emote) {
      multi += results[line[0]][0].value * 20;
    } else if (results[line[0]][0].emote === results[line[1]][1].emote
      && results[line[1]][1].emote === results[line[2]][2].emote
      && results[line[2]][2].emote === results[line[3]][3].emote) {
      multi += results[line[0]][0].value * 4;
    } else if (results[line[0]][0].emote === results[line[1]][1].emote
      && results[line[1]][1].emote === results[line[2]][2].emote) {
      multi += results[line[1]][1].value;
    }
  }

  if (resolvedSeason === 'aprilFools') {
    multi = 0.9;
  }

  multi *= await client.db.marriage.getMarriageBenefits(userId);
  const winnings = multi * amount;
  const netProfit = winnings - amount;
  await client.db.user.addUserAttr(userId, 'slotsTimesPlayed', 1);
  await client.db.user.addUserAttr(userId, 'slotsTimesGambled', amount);
  await client.db.user.addUserAttr(userId, 'slotsTimesWon', netProfit > 0 ? 1 : 0);
  await client.db.user.addUserAttr(userId, 'slotsAmountWon', winnings);
  await client.db.user.addUserAttr(userId, 'slotsRelativeWon', multi);
  await client.db.user.addUserAttr(userId, 'credits', winnings - amount);

  const winMessage = skin.winMessage.replace('{amount}', format(amount)).replace('{winnings}', format(winnings));
  const loseMessage = skin.loseMessage.replace('{amount}', format(amount));

  return {
    results,
    multi,
    winnings,
    isWin: netProfit > 0,
    season: resolvedSeason,
    skin,
    winMessage,
    loseMessage,
  };
}

class Slots extends Command {
  constructor(client: any) {
    super(client, 'slots', 'lose all your mystic credits', [
      {
        name: 'amount',
        description: 'the amount of mystic credits to bet',
        type: 3,
        required: true,
      },
    ], { blame: 'ei' });
  }

  async run(interaction: any): Promise<void> {
    const amountString = interaction.options.getString('amount');
    const amount = await checkValidBet(interaction, amountString);
    if (amount === null) {
      return;
    }

    if (amount < 0) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Betting debt is disabled'),
        ],
      });
      return;
    }

    const result = await spinSlots(this.client, interaction.user.id, amount);
    const { results } = result;
    const description = `${results[0][0].emote} ${results[0][1].emote} ${results[0][2].emote} ${results[0][3].emote} ${results[0][4].emote}\n${results[1][0].emote} ${results[1][1].emote} ${results[1][2].emote} ${results[1][3].emote} ${results[1][4].emote}\n${results[2][0].emote} ${results[2][1].emote} ${results[2][2].emote} ${results[2][3].emote} ${results[2][4].emote}`;

    if (result.isWin) {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#00AA00')
          .setTitle(result.winMessage)
          .setDescription(description),
        ],
      });
    } else {
      await interaction.editReply({
        embeds: [new Discord.EmbedBuilder()
          .setColor('#AA0000')
          .setTitle(result.loseMessage)
          .setDescription(description),
        ],
      });
    }
  }
}

export default Slots;

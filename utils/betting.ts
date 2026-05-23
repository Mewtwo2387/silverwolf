import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { antiFormat } from './math';

export const INVALID_AMOUNT = -1;
export const NEGATIVE_AMOUNT = -2;
export const POOR_AMOUNT = -3;
export const INFINITY_AMOUNT = -4;

// Shared string codes used by both the Discord command error embeds and the
// web JSON responses. Lives here so the JSON-mapping helper and the embed
// switch can't drift apart.
export type BetErrorCode = 'invalid' | 'negative' | 'poor' | 'infinity';

// Convert a `checkValidBetRaw` return code into a `{ error }` object, or null
// when the code is actually a parsed amount (positive number). Used by the
// web bet routes which want JSON instead of Discord embeds.
export function mapBetCode(code: number): { error: BetErrorCode } | null {
  switch (code) {
    case INVALID_AMOUNT: return { error: 'invalid' };
    case NEGATIVE_AMOUNT: return { error: 'negative' };
    case POOR_AMOUNT: return { error: 'poor' };
    case INFINITY_AMOUNT: return { error: 'infinity' };
    default: return null;
  }
}

const INFINITY_KEYWORDS = [
  'infinity', 'inf', '∞', 'unlimited', 'forever',
  'endless', 'neverending', 'boundless', 'limitless',
  'eternal', 'never-ending',
];

export async function checkValidBetRaw(client: any, user: { id: string }, amountString: string): Promise<number> {
  if (INFINITY_KEYWORDS.some((keyword) => amountString.toLowerCase().includes(keyword.toLowerCase()))) {
    return INFINITY_AMOUNT;
  }
  const amount = antiFormat(amountString);
  if (Number.isNaN(amount)) {
    return INVALID_AMOUNT;
  }
  if (amount < 0) {
    return NEGATIVE_AMOUNT;
  }
  if (amount === 0) {
    return INVALID_AMOUNT;
  }

  const credits = await client.db.user.getUserAttr(user.id, 'credits');
  if (amount > credits) {
    return POOR_AMOUNT;
  }
  return amount;
}

async function checkValidBet(interaction: ChatInputCommandInteraction, amountString: string): Promise<number | null> {
  const result = await checkValidBetRaw(interaction.client, interaction.user, amountString);
  switch (result) {
    case INVALID_AMOUNT:
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('Invalid amount')
          .setDescription('idk if this parsing actually works'),
        ],
      });
      return null;
    case NEGATIVE_AMOUNT:
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You can\'t bet debt here'),
        ],
      });
      return null;
    case POOR_AMOUNT:
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You don\'t have enough credits smh'),
        ],
      });
      return null;
    case INFINITY_AMOUNT:
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#AA0000')
          .setTitle('You have been spotted cheating! Mystic credits set to 0.'),
        ],
      });
      setTimeout(async () => {
        await interaction.followUp({ content: '/j' });
      }, 10000);
      return null;
    default:
      return result;
  }
}

export { checkValidBet };

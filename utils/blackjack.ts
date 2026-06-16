// Pure blackjack game state and DB stat updates. Shared by the Discord
// `/blackjack` command (which adds a button-collector UI) and the web blackjack
// pages (which drive a stateful REST API). Keeps deck shuffling, hand scoring,
// dealer resolution, and the per-outcome stat updates in one place.

export interface Card { suit: string; value: string; }

export interface BlackjackWinResult { multi: number; streak: number; winnings: number; }

export type BlackjackOutcome = 'win' | 'loss' | 'tie';

export function createDeck(): Card[] {
  const suits = ['♠', '♣', '♥', '♦'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  suits.forEach((suit) => {
    values.forEach((value) => {
      deck.push({ suit, value });
    });
  });

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function drawCard(deck: Card[]): Card {
  return deck.pop() as Card;
}

export function calculateHand(hand: Card[]): number {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    if (card.value === 'A') {
      aces += 1;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      total += 10;
    } else {
      total += parseInt(card.value, 10);
    }
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

export function formatHand(hand: Card[]): string {
  return hand.map((card) => `${card.suit}${card.value}`).join(', ');
}

// Resolve a stand: dealer draws to 17 then we compare totals.
// Pure — only mutates the provided dealerHand by pushing draws to it.
export function resolveBlackjackStand(
  deck: Card[],
  playerHand: Card[],
  dealerHand: Card[],
): { outcome: BlackjackOutcome; playerTotal: number; dealerTotal: number } {
  while (calculateHand(dealerHand) < 17) {
    dealerHand.push(drawCard(deck));
  }
  const playerTotal = calculateHand(playerHand);
  const dealerTotal = calculateHand(dealerHand);

  let outcome: BlackjackOutcome;
  if (dealerTotal > 21 || playerTotal > dealerTotal) outcome = 'win';
  else if (playerTotal < dealerTotal) outcome = 'loss';
  else outcome = 'tie';

  return { outcome, playerTotal, dealerTotal };
}

export async function recordBlackjackWin(client: any, userId: string, amount: number): Promise<BlackjackWinResult> {
  const currentStreak = await client.db.user.getUserAttr(userId, 'blackjackStreak');
  const currentMaxStreak = await client.db.user.getUserAttr(userId, 'blackjackMaxStreak');
  const marriageBenefits = await client.db.marriage.getMarriageBenefits(userId);

  const multi = marriageBenefits * 2.1 * 1.08 ** currentStreak;
  const streak = currentStreak + 1;
  const winnings = amount * multi;

  const sets: Record<string, any> = { blackjackStreak: streak };
  if (streak > currentMaxStreak) sets.blackjackMaxStreak = streak;

  await client.db.user.updateUserAttrs(userId, {
    adds: {
      blackjackTimesPlayed: 1,
      blackjackAmountGambled: amount,
      blackjackTimesWon: 1,
      blackjackAmountWon: winnings,
      blackjackRelativeWon: multi,
      credits: winnings - amount,
    },
    sets,
  });

  return { multi, streak, winnings };
}

export async function recordBlackjackLoss(client: any, userId: string, amount: number): Promise<void> {
  await client.db.user.updateUserAttrs(userId, {
    adds: {
      blackjackTimesPlayed: 1,
      blackjackAmountGambled: amount,
      blackjackTimesLost: 1,
      credits: -amount,
    },
    sets: { blackjackStreak: 0 },
  });
}

export async function recordBlackjackTie(client: any, userId: string, amount: number): Promise<void> {
  await client.db.user.updateUserAttrs(userId, {
    adds: {
      blackjackTimesPlayed: 1,
      blackjackAmountGambled: amount,
      blackjackTimesDrawn: 1,
      blackjackAmountWon: amount,
      blackjackRelativeWon: 1,
    },
  });
}

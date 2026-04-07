import cron from 'node-cron';
import { log } from '../utils/log';
// Note: Bun automatically reads .env files
import { getAmount } from '../utils/claim';

class BabyScheduler {
  client: any;

  constructor(client: any) {
    this.client = client;
  }

  start(): void {
    cron.schedule('0 0 * * *', async () => {
      await this.dailyAutomations();
    });
    cron.schedule('*/10 * * * *', async () => {
      await this.tenMinuteAutomations();
    });
  }

  async dailyAutomations(): Promise<void> {
    const babies = await this.client.db.baby.getAllBabies();
    for (const baby of babies) {
      if (baby.status === 'born') {
        switch (baby.job) {
          case 'nuggieClaimer':
            await this.dailyNuggieClaim(baby);
            break;
          case 'pinger':
            await this.dailyPing(baby);
            break;
          default:
            log(`${baby.name} (${baby.id}) have no daily tasks`);
        }
      } else {
        log(`${baby.name} (${baby.id}) is not born`);
      }
    }
  }

  async tenMinuteAutomations(): Promise<void> {
    const babies = await this.client.db.baby.getAllBabies();
    for (const baby of babies) {
      if (baby.status === 'born') {
        switch (baby.job) {
          case 'gambler':
            await this.tenMinuteGamble(baby);
            break;
          default:
            log(`${baby.name} (${baby.id}) have no ten minute tasks`);
        }
      } else {
        log(`${baby.name} (${baby.id}) is not born`);
      }
    }
  }

  async dailyNuggieClaim(baby: any): Promise<void> {
    const parents = [baby.motherId, baby.fatherId];
    for (const parent of parents) {
      const { amount } = await getAmount(this.client, parent, 0);
      await this.client.db.user.addUserAttr(parent, 'dinonuggies', amount);
      await this.client.db.baby.addBabyAttr(baby.id, 'nuggieClaimerClaims', 1);
      await this.client.db.baby.addBabyAttr(baby.id, 'nuggieClaimerClaimed', amount);
      log(`${baby.name} (${baby.id}) claimed ${amount} dinonuggies for ${parent}`);
    }
  }

  async dailyPing(baby: any): Promise<void> {
    const channel = await this.client.channels.cache.get(baby.pingerChannel);
    if (channel) {
      await channel.send(`${baby.name}: <@${baby.pingerTarget}>`);
      await this.client.db.baby.addBabyAttr(baby.id, 'pingerPings', 1);
      log(`${baby.name} (${baby.id}) pinged ${baby.pingerTarget} in ${channel.name}`);
    } else {
      log(`Channel ${baby.pingerChannel} not found`);
    }
  }

  async tenMinuteGamble(baby: any): Promise<void> {
    const parents = [baby.motherId, baby.fatherId];
    for (const parent of parents) {
      const credits = await this.client.db.user.getUserAttr(parent, 'credits');
      const betAmount = Math.floor(credits * 0.01);
      if (betAmount > 0) {
        await this.client.db.user.addUserAttr(parent, 'credits', -betAmount);
        await this.client.db.baby.addBabyAttr(baby.id, 'gamblerGames', 1);
        await this.client.db.baby.addBabyAttr(baby.id, 'gamblerCreditsGambled', betAmount);
        if (Math.random() < 18 / 37) {
          await this.client.db.user.addUserAttr(parent, 'credits', betAmount * 2.2);
          await this.client.db.baby.addBabyAttr(baby.id, 'gamblerWins', 1);
          await this.client.db.baby.addBabyAttr(baby.id, 'gamblerCreditsWon', betAmount * 2.2);
          log(`${baby.name} (${baby.id}) won ${betAmount * 2.2} credits for ${parent}`);
        } else {
          await this.client.db.baby.addBabyAttr(baby.id, 'gamblerLosses', 1);
          log(`${baby.name} (${baby.id}) lost ${betAmount} credits for ${parent}`);
        }
      }
    }
  }
}

export default BabyScheduler;

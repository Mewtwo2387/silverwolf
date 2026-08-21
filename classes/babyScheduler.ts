import { log, logError } from '../utils/log';
// Note: Bun automatically reads .env files
import { getAmount } from '../utils/claim';

class BabyScheduler {
  client: any;
  private dailyJob: Bun.CronJob | null = null;
  private tenMinuteJob: Bun.CronJob | null = null;

  constructor(client: any) {
    this.client = client;
  }

  start(): void {
    // utils/log installs a global unhandledRejection handler, so a rejection
    // escaping here no longer kills the process. These catches are still worth
    // having: they name the failing automation in the log instead of surfacing a
    // bare stack from the scheduler, and they keep the job's next fire clean.
    // Both automations touch the DB and Discord, either of which can throw.
    this.dailyJob = Bun.cron('0 0 * * *', async () => {
      try {
        await this.dailyAutomations();
      } catch (error) {
        logError('Error during daily baby automations:', error);
      }
    }, { tz: 'UTC' });
    this.tenMinuteJob = Bun.cron('*/10 * * * *', async () => {
      try {
        await this.tenMinuteAutomations();
      } catch (error) {
        logError('Error during ten-minute baby automations:', error);
      }
    }, { tz: 'UTC' });
  }

  stop(): void {
    this.dailyJob?.stop();
    this.tenMinuteJob?.stop();
  }

  async dailyAutomations(): Promise<void> {
    // Loading the list is all-or-nothing, so a failure here propagates to the
    // scheduler's catch. Each baby is then isolated: a deleted channel or a bad
    // row for one baby must not skip everyone after it in the list, which would
    // silently cost them their daily automation every day.
    const babies = await this.client.db.baby.getAllBabies();
    for (const baby of babies) {
      if (baby.status === 'born') {
        try {
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
        } catch (error) {
          logError(`Daily automation failed for ${baby.name} (${baby.id}):`, error);
        }
      } else {
        log(`${baby.name} (${baby.id}) is not born`);
      }
    }
  }

  async tenMinuteAutomations(): Promise<void> {
    // Same isolation as dailyAutomations: one baby's failure must not stop the rest.
    const babies = await this.client.db.baby.getAllBabies();
    for (const baby of babies) {
      if (baby.status === 'born') {
        try {
          switch (baby.job) {
            case 'gambler':
              await this.tenMinuteGamble(baby);
              break;
            default:
              log(`${baby.name} (${baby.id}) have no ten minute tasks`);
          }
        } catch (error) {
          logError(`Ten-minute automation failed for ${baby.name} (${baby.id}):`, error);
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

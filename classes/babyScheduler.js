const cron = require('node-cron');
const { log } = require('../utils/log');
require('dotenv').config();
const Claim = require('../commands/claim');

class BabyScheduler {
  constructor(client) {
    this.client = client;
  }

  start() {
    this.dailyAutomations();
    this.hourlyAutomations();
  }

  dailyAutomations() {
    cron.schedule('0 0 * * *', async () => {
      const babies = await this.client.db.getAllBabies();
      for (const baby of babies) {
        if (baby.status == 'born') {
          switch (baby.job) {
            case 'nuggieClaimer':
              const parents = [baby.motherId, baby.fatherId];
              for (const parent of parents) {
                const baseAmount = await new Claim(this.client).getBaseAmount(parent, 0);
                await this.client.db.addUserAttr(parent, 'dinonuggies', baseAmount);
                await this.client.db.addBabyAttr(baby.id, 'nuggieClaimerClaims', 1);
                await this.client.db.addBabyAttr(baby.id, 'nuggieClaimerClaimed', baseAmount);
                log(`${baby.name} (${baby.id}) claimed ${baseAmount} dinonuggies for ${parent}`);
              }
              break;
            case 'pinger':
              const channel = await this.client.channels.cache.get(baby.pingerChannel);
              if (channel) {
                await channel.send(`${baby.name}: <@${baby.pingerTarget}>`);
                await this.client.db.addBabyAttr(baby.id, 'pingerPings', 1);
                log(`${baby.name} (${baby.id}) pinged ${baby.pingerTarget} in ${channel.name}`);
              } else {
                log(`Channel ${baby.pingerChannel} not found`);
              }
              break;
            default:
              log(`${baby.name} (${baby.id}) have no daily tasks`);
          }
        }
      }
    });
  }

  hourlyAutomations() {
    cron.schedule('0 * * * *', async () => {
      const babies = await this.client.db.getAllBabies();
      for (const baby of babies) {
        if (baby.status == 'born') {
          switch (baby.job) {
            case 'gambler':
              const parents = [baby.motherId, baby.fatherId];
              for (const parent of parents) {
                const credits = await this.client.db.getUserAttr(parent, 'credits');
                const betAmount = Math.floor(credits * 0.01);
                if (betAmount > 0) {
                  await this.client.db.addUserAttr(parent, 'credits', -betAmount);
                  await this.client.db.addBabyAttr(baby.id, 'gamblerGames', 1);
                  await this.client.db.addBabyAttr(baby.id, 'gamblerCreditsGambled', betAmount);
                  if (Math.random() < 18 / 37) {
                    await this.client.db.addUserAttr(parent, 'credits', betAmount * 2.2);
                    await this.client.db.addBabyAttr(baby.id, 'gamblerWins', 1);
                    await this.client.db.addBabyAttr(baby.id, 'gamblerCreditsWon', betAmount * 2.2);
                    log(`${baby.name} (${baby.id}) won ${betAmount * 2.2} credits for ${parent}`);
                  } else {
                    await this.client.db.addBabyAttr(baby.id, 'gamblerLosses', 1);
                    log(`${baby.name} (${baby.id}) lost ${betAmount} credits for ${parent}`);
                  }
                }
              }
              break;
            default:
              log(`${baby.name} (${baby.id}) have no hourly tasks`);
          }
        }
      }
    });
  }
}

module.exports = BabyScheduler;

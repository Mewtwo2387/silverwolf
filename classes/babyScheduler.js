const cron = require('node-cron');
const { log, logError } = require('../utils/log');
require('dotenv').config(); 
const Claim = require('../commands/claim');

class BabyScheduler {
    constructor(client) {
        this.client = client;
    }

    start(){
      this.dailyAutomations();
      this.hourlyAutomations();
    }
    
    dailyAutomations(){
      cron.schedule('0 0 * * *', async () => {
        const babies = await this.client.db.getAllBabies();
        for (const baby of babies) {
          if (baby.status == "born"){
            switch (baby.job){
              case "nuggie_claimer":
                const parents = [baby.mother_id, baby.father_id];
                for (const parent of parents){
                  const baseAmount = await new Claim(this.client).getBaseAmount(parent, 0);
                  await this.client.db.addUserAttr(parent, 'dinonuggies', baseAmount);
                  await this.client.db.addBabyAttr(baby.id, 'nuggie_claimer_claims', 1);
                  await this.client.db.addBabyAttr(baby.id, 'nuggie_claimer_claimed', baseAmount);
                  log(`${baby.name} (${baby.id}) claimed ${baseAmount} dinonuggies for ${parent}`);
                }
                break;
              case "pinger":
                const channel = await this.client.channels.cache.get(baby.pinger_channel);
                if (channel){
                  await channel.send(`${baby.name}: <@${baby.pinger_target}>`);
                  await this.client.db.addBabyAttr(baby.id, 'pinger_pings', 1);
                  log(`${baby.name} (${baby.id}) pinged ${baby.pinger_target} in ${channel.name}`);
                } else {
                  log(`Channel ${baby.pinger_channel} not found`);
                }
                break;
              default:
                log(`${baby.name} (${baby.id}) have no daily tasks`);
            }
          }
        }
      });
    }

    hourlyAutomations(){
      cron.schedule('0 * * * *', async () => {
        const babies = await this.client.db.getAllBabies();
        for (const baby of babies) {
          if (baby.status == "born"){
            switch (baby.job){
              case "gambler":
                const parents = [baby.mother_id, baby.father_id];
                for (const parent of parents){
                  const credits = await this.client.db.getUserAttr(parent, 'credits');
                  const betAmount = Math.floor(credits * 0.01);
                  if (betAmount > 0){
                    await this.client.db.addUserAttr(parent, 'credits', -betAmount);
                    await this.client.db.addBabyAttr(baby.id, 'gambler_games', 1);
                    await this.client.db.addBabyAttr(baby.id, 'gambler_credits_gambled', betAmount);
                    if (Math.random() < 18/37){
                      await this.client.db.addUserAttr(parent, 'credits', betAmount * 2.2);
                      await this.client.db.addBabyAttr(baby.id, 'gambler_wins', 1);
                      await this.client.db.addBabyAttr(baby.id, 'gambler_credits_won', betAmount * 2.2);
                      log(`${baby.name} (${baby.id}) won ${betAmount * 2.2} credits for ${parent}`);
                    } else {
                      await this.client.db.addBabyAttr(baby.id, 'gambler_losses', 1);
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
const cron = require('node-cron');
const { log, logError } = require('../utils/log');
require('dotenv').config(); 
const Claim = require('../commands/claim');

class BabyScheduler {
    constructor(client) {
        this.client = client;
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
                  log(`${baby.name} (${baby.id}) claimed ${baseAmount} dinonuggies for ${parent}`);
                }
                break;
              case "gambler":
                // TODO
                break;
              case "pinger":
                const channel = await this.client.channels.cache.get(baby.pinger_channel);
                if (channel){
                  await channel.send(`${baby.name}: <@${baby.pinger_target}>`);
                  log(`${baby.name} (${baby.id}) pinged ${baby.pinger_target} in ${channel.name}`);
                } else {
                  log(`Channel ${baby.pinger_channel} not found`);
                }
                break;
              default:
                log(`${baby.name} (${baby.id}) is doing nothing`);
            }
          }
        }
      });
    }
}

module.exports = BabyScheduler;
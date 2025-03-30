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
                parents = [baby.mother_id, baby.father_id];
                for (const parent of parents){
                  baseAmount = await Claim.getBaseAmount(parent, 0);
                  await this.client.db.addUserAttr(parent, 'dinonuggies', baseAmount);
                  log(`${baby.name} (${baby.id}) claimed ${baseAmount} dinonuggies for ${parent}`);
                }
                break;
              case "gambler":
                // TODO
                break;
              case "pinger":
                // TODO
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
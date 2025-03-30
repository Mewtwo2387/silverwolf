const cron = require('node-cron');
const { log, logError } = require('../utils/log');
require('dotenv').config(); 


class BabyScheduler {
    constructor(client) {
        this.client = client;
    }

    async getBaseAmount(uid) {
      const nuggie_flat_multiplier_level = await this.client.db.getUserAttr(uid, 'nuggie_flat_multiplier_level');
      const marriage_benefits = await marriageBenefits(this.client, uid);
      
      const nuggie_credits_multiplier_level = await this.client.db.getUserAttr(uid, 'nuggie_credits_multiplier_level');
      const credits = await this.client.db.getUserAttr(uid, 'credits');
      const log2_credits = credits > 1 ? Math.log2(credits) : 0;
      
      const nuggie_pokemon_multiplier_level = await this.client.db.getUserAttr(uid, 'nuggie_pokemon_multiplier_level');
      const pokemon_count = await this.client.db.getUniquePokemonCount(uid);
      
      const nuggie_nuggie_multiplier_level = await this.client.db.getUserAttr(uid, 'nuggie_nuggie_multiplier_level');
      const nuggies = await this.client.db.getUserAttr(uid, 'dinonuggies');
      const log2_nuggies = nuggies > 1 ? Math.log2(nuggies) : 0;
      
      let baseAmount = 5
      log("Base amount: " + baseAmount);
      baseAmount *= getNuggieFlatMultiplier(nuggie_flat_multiplier_level)
      log("Base amount after flat multiplier: " + baseAmount);
      baseAmount *= (1 + log2_credits * getNuggieCreditsMultiplier(nuggie_credits_multiplier_level))
      log("Base amount after credits multiplier: " + baseAmount);
      baseAmount *= (1 + pokemon_count * getNuggiePokeMultiplier(nuggie_pokemon_multiplier_level))
      log("Base amount after pokemon multiplier: " + baseAmount);
      baseAmount *= (1 + log2_nuggies * getNuggieNuggieMultiplier(nuggie_nuggie_multiplier_level))
      log("Base amount after nuggie multiplier: " + baseAmount);
      baseAmount *= marriage_benefits
      log("Base amount after marriage benefits: " + baseAmount);
      return baseAmount;
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
                  baseAmount = await this.getBaseAmount(parent);
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
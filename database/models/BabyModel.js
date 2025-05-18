const { log, logError } = require('../../utils/log');
const babyQueries = require('../queries/babyQueries');

class BabyModel {
  constructor(db) {
    this.db = db;
  }

  async createBaby(motherId, fatherId) {
    try {
      const query = babyQueries.CREATE_BABY;
      await this.db.executeQuery(query, [motherId, fatherId]);
    } catch (error) {
      logError('Error creating baby:', error);
      throw error;
    }
  }

  async getBabyById(id) {
    try {
      const query = babyQueries.GET_BABY_BY_ID;
      return await this.db.executeSelectQuery(query, [id]);
    } catch (error) {
      logError('Error getting baby by ID:', error);
      throw error;
    }
  }

  async getBabiesByParentId(parentId) {
    try {
      const query = babyQueries.GET_BABIES_BY_PARENT;
      return await this.db.executeSelectAllQuery(query, [parentId, parentId]);
    } catch (error) {
      logError('Error getting babies by parent ID:', error);
      throw error;
    }
  }

  async updateBabyAttr(id, attr, value) {
    try {
      const query = babyQueries.SET_BABY_ATTR(attr);
      await this.db.executeQuery(query, [value, id]);
      return true;
    } catch (error) {
      logError('Error updating baby attribute:', error);
      throw error;
    }
  }

  async addBabyAttr(id, attr, value) {
    try {
      const query = babyQueries.ADD_BABY_ATTR(attr);
      await this.db.executeQuery(query, [value, id]);
      return true;
    } catch (error) {
      logError('Error adding baby attribute:', error);
      throw error;
    }
  }

  async deleteBaby(id) {
    try {
      const query = babyQueries.DELETE_BABY;
      await this.db.executeQuery(query, [id]);
      return true;
    } catch (error) {
      logError('Error deleting baby:', error);
      throw error;
    }
  }

  async updateBabyStatus(id, status) {
    return this.updateBabyAttr(id, 'status', status);
  }

  async updateBabyName(id, name) {
    return this.updateBabyAttr(id, 'name', name);
  }

  async updateBabyBirthday(id) {
    try {
      const query = babyQueries.SET_BABY_BIRTHDAY;
      await this.db.executeQuery(query, [id]);
    } catch (error) {
      logError('Error updating baby birthday:', error);
      throw error;
    }
  }

  async babyIsUnborn(id) {
    const baby = await this.getBabyById(id);
    return baby.status === 'unborn';
  }

  async bornBaby(id) {
    if (!(await this.babyIsUnborn(id))) {
      log('Baby is not unborn');
      return false;
    }
    this.updateBabyAttr(id, 'status', 'born');
    this.updateBabyBirthday(id);
    const baby = await this.getBabyById(id);
    log(`Baby ${id} was born. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}, Birthday: ${baby.born}`);
    return true;
  }

  async updateBabyJob(id, job, pingerTarget = null, pingerChannel = null) {
    this.updateBabyAttr(id, 'job', job);
    if (pingerTarget) {
      this.updateBabyAttr(id, 'pinger_target', pingerTarget);
      this.updateBabyAttr(id, 'pinger_channel', pingerChannel);
    }
    log(`Updated job to ${job} for baby ${id}. Pinger target: ${pingerTarget}, Pinger channel: ${pingerChannel}`);
    return true;
  }

  async levelUpBaby(id) {
    this.addBabyAttr(id, 'level', 1);
    log(`Baby ${id} leveled up.`);
    return true;
  }

  async incrementNuggieClaimerStats(id, claimed) {
    this.addBabyAttr(id, 'nuggie_claimer_claims', 1);
    this.addBabyAttr(id, 'nuggie_claimer_claimed', claimed);
    log(`Baby ${id} claimed ${claimed} nuggies.`);
    return true;
  }

  async incrementGamblerStats(id, games, wins, losses, creditsGambled, creditsWon) {
    this.addBabyAttr(id, 'gambler_games', games);
    this.addBabyAttr(id, 'gambler_wins', wins);
    this.addBabyAttr(id, 'gambler_losses', losses);
    this.addBabyAttr(id, 'gambler_credits_gambled', creditsGambled);
    this.addBabyAttr(id, 'gambler_credits_won', creditsWon);
    log(`Baby ${id} incremented gambler stats.`);
  }

  async incrementPingerPings(id) {
    this.addBabyAttr(id, 'pinger_pings', 1);
    log(`Baby ${id} incremented pinger pings.`);
    return true;
  }
}

module.exports = BabyModel;

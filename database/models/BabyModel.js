const { log } = require('../../utils/log');
const babyQueries = require('../queries/babyQueries');

class BabyModel {
  constructor(db) {
    this.db = db;
  }

  async createBaby(motherId, fatherId) {
    const query = babyQueries.CREATE_BABY;
    await this.db.executeQuery(query, [motherId, fatherId]);
  }

  async getBabyById(id) {
    const query = babyQueries.GET_BABY_BY_ID;
    await this.db.executeSelectQuery(query, [id]);
  }

  async getBabiesByParentId(parentId) {
    const query = babyQueries.GET_BABIES_BY_PARENT;
    await this.db.executeSelectAllQuery(query, [parentId, parentId]);
  }

  async updateBabyAttr(id, attr, value) {
    const query = babyQueries.SET_BABY_ATTR(attr);
    await this.db.executeQuery(query, [value, id]);
  }

  async addBabyAttr(id, attr, value) {
    const query = babyQueries.ADD_BABY_ATTR(attr);
    await this.db.executeQuery(query, [value, id]);
  }

  async deleteBaby(id) {
    const query = babyQueries.DELETE_BABY;
    await this.db.executeQuery(query, [id]);
  }

  async updateBabyStatus(id, status) {
    return this.updateBabyAttr(id, 'status', status);
  }

  async updateBabyName(id, name) {
    return this.updateBabyAttr(id, 'name', name);
  }

  async updateBabyBirthday(id) {
    const query = babyQueries.SET_BABY_BIRTHDAY;
    await this.db.executeQuery(query, [id]);
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

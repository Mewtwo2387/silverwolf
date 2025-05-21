const { log } = require('../../utils/log');
const babyQueries = require('../queries/babyQueries');
const { camelToSnake } = require('../../utils/caseConvert');

class BabyModel {
  constructor(db) {
    this.db = db;
  }

  async createBaby(motherId, fatherId) {
    await this.db.user.getUser(motherId);
    await this.db.user.getUser(fatherId);
    const query = babyQueries.CREATE_BABY;
    await this.db.executeQuery(query, [motherId, fatherId]);
  }

  async getBabyById(id) {
    const query = babyQueries.GET_BABY_BY_ID;
    return this.db.executeSelectQuery(query, [id]);
  }

  async getBabiesByParentId(parentId) {
    const query = babyQueries.GET_BABIES_BY_PARENT;
    return this.db.executeSelectAllQuery(query, [parentId, parentId]);
  }

  async getAllBabies() {
    const query = babyQueries.GET_ALL_BABIES;
    return this.db.executeSelectAllQuery(query);
  }

  async updateBabyAttr(id, attr, value) {
    const snakeAttr = camelToSnake(attr);
    const query = babyQueries.SET_BABY_ATTR(snakeAttr);
    await this.db.executeQuery(query, [value, id]);
  }

  async addBabyAttr(id, attr, value) {
    const snakeAttr = camelToSnake(attr);
    const query = babyQueries.ADD_BABY_ATTR(snakeAttr);
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
    await this.updateBabyAttr(id, 'status', 'born');
    await this.updateBabyBirthday(id);
    const baby = await this.getBabyById(id);
    log(`Baby ${id} was born. Mother: ${baby.mother_id}, Father: ${baby.father_id}, Status: ${baby.status}, Birthday: ${baby.born}`);
    return true;
  }

  async updateBabyJob(id, job, pingerTarget = null, pingerChannel = null) {
    await this.updateBabyAttr(id, 'job', job);
    if (pingerTarget) {
      await this.updateBabyAttr(id, 'pingerTarget', pingerTarget);
      await this.updateBabyAttr(id, 'pingerChannel', pingerChannel);
    }
    log(`Updated job to ${job} for baby ${id}. Pinger target: ${pingerTarget}, Pinger channel: ${pingerChannel}`);
    return true;
  }

  async levelUpBaby(id) {
    await this.addBabyAttr(id, 'level', 1);
    log(`Baby ${id} leveled up.`);
    return true;
  }

  async incrementNuggieClaimerStats(id, claimed) {
    await this.addBabyAttr(id, 'nuggieClaimerClaims', 1);
    await this.addBabyAttr(id, 'nuggieClaimerClaimed', claimed);
    log(`Baby ${id} claimed ${claimed} nuggies.`);
    return true;
  }

  async incrementGamblerStats(id, games, wins, losses, creditsGambled, creditsWon) {
    await this.addBabyAttr(id, 'gamblerGames', games);
    await this.addBabyAttr(id, 'gamblerWins', wins);
    await this.addBabyAttr(id, 'gamblerLosses', losses);
    await this.addBabyAttr(id, 'gamblerCreditsGambled', creditsGambled);
    await this.addBabyAttr(id, 'gamblerCreditsWon', creditsWon);
    log(`Baby ${id} incremented gambler stats.`);
  }

  async incrementPingerPings(id) {
    await this.addBabyAttr(id, 'pingerPings', 1);
    log(`Baby ${id} incremented pinger pings.`);
    return true;
  }
}

module.exports = BabyModel;

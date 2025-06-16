const { log } = require('../../utils/log');
const marriageQueries = require('../queries/marriageQueries');

class MarriageModel {
  constructor(database) {
    this.db = database;
  }

  async addMarriage(user1Id, user2Id) {
    await this.db.user.getUser(user1Id);
    await this.db.user.getUser(user2Id);
    const query = marriageQueries.ADD_MARRIAGE;
    await this.db.executeQuery(query, [user1Id, user2Id]);
    log(`Marriage added between ${user1Id} and ${user2Id}.`);
  }

  async removeMarriage(user1Id, user2Id) {
    const query = marriageQueries.DELETE_MARRIAGE;
    await this.db.executeQuery(query, [user1Id, user2Id, user2Id, user1Id]);
    log(`Marriage removed between ${user1Id} and ${user2Id}.`);
  }

  async checkMarriageStatus(userId) {
    const query = marriageQueries.GET_MARRIAGE;
    const result = await this.db.executeSelectQuery(query, [userId, userId]);
    if (result) {
      const partnerId = result.user1Id === userId ? result.user2Id : result.user1Id;
      return { isMarried: true, partnerId };
    }
    return { isMarried: false };
  }

  async getMarriageDate(userId) {
    const query = marriageQueries.GET_MARRIAGE;
    const result = await this.db.executeSelectQuery(query, [userId, userId]);
    return result ? result.marriedOn : null;
  }

  async getMarriageBenefits(userId) {
    // Check the user's marriage status
    log('Checking user marriage status... for user ID:', userId);
    const userMarriageStatus = await this.checkMarriageStatus(userId);

    // If the user is married, increase the amount by 10% (rounding up)
    if (userMarriageStatus.isMarried) {
      log('User is married. Increasing the amount by 10%...');
      return 1.1;
    }

    // If the user is single, return the original amount
    log('User is single. No bonus applied.');
    return 1;
  }
}

module.exports = MarriageModel;

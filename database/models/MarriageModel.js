const { log } = require('../../utils/log');
const marriageQueries = require('../queries/marriageQueries');

class MarriageModel {
  constructor(database) {
    this.db = database;
  }

  async addMarriage(user1Id, user2Id) {
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
    if (result.length > 0) {
      const partnerId = result[0].user1Id === userId ? result[0].user2Id : result[0].user1Id;
      return { isMarried: true, partnerId };
    }
    return { isMarried: false };
  }

  async getMarriageDate(user1Id, user2Id) {
    const query = marriageQueries.GET_MARRIAGE;
    const result = await this.db.executeSelectQuery(query, [user1Id, user2Id, user2Id, user1Id]);
    return result.length > 0 ? result[0].marriedOn : null;
  }
}

module.exports = MarriageModel;

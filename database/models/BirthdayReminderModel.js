const { log } = require('../../utils/log');
const birthdayReminderQueries = require('../queries/birthdayReminderQueries');

class BirthdayReminderModel {
  constructor(database) {
    this.db = database;
  }

  async upsertReminder(notifierId, trackedUserId, daysBefore) {
    const query = birthdayReminderQueries.UPSERT_REMINDER;
    const result = await this.db.executeQuery(query, [notifierId, trackedUserId, daysBefore]);
    if (!result.changes) {
      throw new Error(`Failed to upsert birthday reminder: notifier=${notifierId}, tracked=${trackedUserId}`);
    }
    log(`Upserted birthday reminder: notifier=${notifierId}, tracked=${trackedUserId}, days=${daysBefore}`);
  }

  async deleteReminder(notifierId, trackedUserId) {
    const query = birthdayReminderQueries.DELETE_REMINDER;
    const result = await this.db.executeQuery(query, [notifierId, trackedUserId]);
    if (!result.changes) {
      throw new Error(`Failed to delete birthday reminder: notifier=${notifierId}, tracked=${trackedUserId}`);
    }
    log(`Deleted birthday reminder: notifier=${notifierId}, tracked=${trackedUserId}`);
    return result;
  }

  async getReminder(notifierId, trackedUserId) {
    const query = birthdayReminderQueries.GET_REMINDER;
    return this.db.executeSelectQuery(query, [notifierId, trackedUserId]);
  }

  async getPendingReminders(currentYear) {
    const query = birthdayReminderQueries.GET_ALL_PENDING;
    return this.db.executeSelectAllQuery(query, [currentYear]);
  }

  async markReminderSent(notifierId, trackedUserId, year) {
    const query = birthdayReminderQueries.UPDATE_REMINDED_YEAR;
    const result = await this.db.executeQuery(query, [year, notifierId, trackedUserId]);
    if (!result.changes) {
      throw new Error(`Failed to mark reminder sent for year ${year}: notifier=${notifierId}, tracked=${trackedUserId}`);
    }
    log(`Marked reminder sent for year ${year}: notifier=${notifierId}, tracked=${trackedUserId}`);
  }
}

module.exports = BirthdayReminderModel;

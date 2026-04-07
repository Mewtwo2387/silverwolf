import { log } from '../../utils/log';
import birthdayReminderQueries from '../queries/birthdayReminderQueries';
import type Database from '../Database';
import type { QueryResult } from '../types';

class BirthdayReminderModel {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  async upsertReminder(notifierId: string, trackedUserId: string, daysBefore: number): Promise<void> {
    const query = birthdayReminderQueries.UPSERT_REMINDER;
    const result = await this.db.executeQuery(query, [notifierId, trackedUserId, daysBefore]);
    if (!result.changes) {
      throw new Error(`Failed to upsert birthday reminder: notifier=${notifierId}, tracked=${trackedUserId}`);
    }
    log(`Upserted birthday reminder: notifier=${notifierId}, tracked=${trackedUserId}, days=${daysBefore}`);
  }

  async deleteReminder(notifierId: string, trackedUserId: string): Promise<QueryResult> {
    const query = birthdayReminderQueries.DELETE_REMINDER;
    const result = await this.db.executeQuery(query, [notifierId, trackedUserId]);
    if (!result.changes) {
      throw new Error(`Failed to delete birthday reminder: notifier=${notifierId}, tracked=${trackedUserId}`);
    }
    log(`Deleted birthday reminder: notifier=${notifierId}, tracked=${trackedUserId}`);
    return result;
  }

  async getReminder(notifierId: string, trackedUserId: string): Promise<Record<string, any> | null> {
    const query = birthdayReminderQueries.GET_REMINDER;
    return this.db.executeSelectQuery(query, [notifierId, trackedUserId]);
  }

  async getPendingReminders(currentYear: number): Promise<Record<string, any>[]> {
    const query = birthdayReminderQueries.GET_ALL_PENDING;
    return this.db.executeSelectAllQuery(query, [currentYear]);
  }

  async markReminderSent(notifierId: string, trackedUserId: string, year: number): Promise<void> {
    const query = birthdayReminderQueries.UPDATE_REMINDED_YEAR;
    const result = await this.db.executeQuery(query, [year, notifierId, trackedUserId]);
    if (!result.changes) {
      throw new Error(`Failed to mark reminder sent for year ${year}: notifier=${notifierId}, tracked=${trackedUserId}`);
    }
    log(`Marked reminder sent for year ${year}: notifier=${notifierId}, tracked=${trackedUserId}`);
  }
}

export default BirthdayReminderModel;

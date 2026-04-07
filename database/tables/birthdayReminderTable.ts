import type { TableDefinition } from '../types';

export interface BirthdayReminderRow {
  notifier_id: string;
  tracked_user_id: string;
  days_before: number;
  last_reminded_year: number;
}

const birthdayReminderTable: TableDefinition = {
  name: 'BirthdayReminder',
  columns: [
    { name: 'notifier_id', type: 'VARCHAR NOT NULL' },
    { name: 'tracked_user_id', type: 'VARCHAR NOT NULL' },
    { name: 'days_before', type: 'INTEGER NOT NULL' },
    { name: 'last_reminded_year', type: 'INTEGER DEFAULT 0' },
  ],
  primaryKey: ['notifier_id', 'tracked_user_id'],
  specialConstraints: ['PRIMARY KEY (notifier_id, tracked_user_id)'],
  constraints: [
    'FOREIGN KEY (notifier_id) REFERENCES User(id)',
    'FOREIGN KEY (tracked_user_id) REFERENCES User(id)',
  ],
};

export default birthdayReminderTable;

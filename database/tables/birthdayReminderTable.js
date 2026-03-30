const birthdayReminderTable = {
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

module.exports = birthdayReminderTable;

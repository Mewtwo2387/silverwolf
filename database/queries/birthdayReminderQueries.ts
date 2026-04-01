const birthdayReminderQueries = {
  UPSERT_REMINDER: `
    INSERT INTO BirthdayReminder (notifier_id, tracked_user_id, days_before)
    VALUES (?, ?, ?)
    ON CONFLICT(notifier_id, tracked_user_id)
    DO UPDATE SET days_before = excluded.days_before, last_reminded_year = 0
  `,
  DELETE_REMINDER: `
    DELETE FROM BirthdayReminder WHERE notifier_id = ? AND tracked_user_id = ?
  `,
  GET_REMINDER: `
    SELECT * FROM BirthdayReminder WHERE notifier_id = ? AND tracked_user_id = ?
  `,
  GET_ALL_PENDING: `
    SELECT r.notifier_id, r.tracked_user_id, r.days_before, u.birthdays
    FROM BirthdayReminder r
    JOIN User u ON r.tracked_user_id = u.id
    WHERE u.birthdays IS NOT NULL AND r.last_reminded_year != ?
  `,
  UPDATE_REMINDED_YEAR: `
    UPDATE BirthdayReminder SET last_reminded_year = ? WHERE notifier_id = ? AND tracked_user_id = ?
  `,
};

export default birthdayReminderQueries;

use crate::database::models::BirthdayReminder;

impl super::Database {
    pub async fn upsert_birthday_reminder(&self, notifier_id: &str, tracked_user_id: &str, days_before: i64) -> anyhow::Result<()> {
        sqlx::query(
            "INSERT INTO BirthdayReminder (notifier_id, tracked_user_id, days_before) VALUES (?, ?, ?) \
             ON CONFLICT(notifier_id, tracked_user_id) DO UPDATE SET days_before = EXCLUDED.days_before"
        )
        .bind(notifier_id)
        .bind(tracked_user_id)
        .bind(days_before)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_birthday_reminder(&self, notifier_id: &str, tracked_user_id: &str) -> anyhow::Result<bool> {
        let result = sqlx::query("DELETE FROM BirthdayReminder WHERE notifier_id = ? AND tracked_user_id = ?")
            .bind(notifier_id)
            .bind(tracked_user_id)
            .execute(&self.pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn get_all_birthday_reminders(&self) -> anyhow::Result<Vec<BirthdayReminder>> {
        let reminders = sqlx::query_as::<_, BirthdayReminder>("SELECT * FROM BirthdayReminder")
            .fetch_all(&self.pool)
            .await?;
        Ok(reminders)
    }

    pub async fn update_birthday_reminder_last_year(&self, id: i64, year: i64) -> anyhow::Result<()> {
        sqlx::query("UPDATE BirthdayReminder SET last_reminded_year = ? WHERE id = ?")
            .bind(year)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_users_with_birthday(&self, today_hour: &str) -> anyhow::Result<Vec<String>> {
        let rows = sqlx::query("SELECT id FROM User WHERE strftime('%m-%dT%H', birthdays) = ?")
            .bind(today_hour)
            .fetch_all(&self.pool)
            .await?;
        
        let ids = rows.iter().map(|r| {
            use sqlx::Row;
            r.get::<String, _>("id")
        }).collect();
        Ok(ids)
    }

    pub async fn get_pending_birthday_reminders(&self, current_year: i64) -> anyhow::Result<Vec<serde_json::Value>> {
        let rows = sqlx::query(
            "SELECT r.notifier_id, r.tracked_user_id, r.days_before, u.birthdays \
             FROM BirthdayReminder r \
             JOIN User u ON r.tracked_user_id = u.id \
             WHERE u.birthdays IS NOT NULL AND r.last_reminded_year != ?"
        )
        .bind(current_year)
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::new();
        for row in rows {
            use sqlx::Row;
            use chrono::NaiveDateTime;
            let val = serde_json::json!({
                "notifierId": row.get::<String, _>("notifier_id"),
                "trackedUserId": row.get::<String, _>("tracked_user_id"),
                "daysBefore": row.get::<i64, _>("days_before"),
                "birthdays": row.get::<NaiveDateTime, _>("birthdays"),
            });
            result.push(val);
        }
        Ok(result)
    }

    pub async fn mark_birthday_reminder_sent(&self, notifier_id: &str, tracked_user_id: &str, year: i64) -> anyhow::Result<()> {
        sqlx::query("UPDATE BirthdayReminder SET last_reminded_year = ? WHERE notifier_id = ? AND tracked_user_id = ?")
            .bind(year)
            .bind(notifier_id)
            .bind(tracked_user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

impl super::Database {
    pub async fn log_poop(&self, user_id: &str, colour: Option<&str>, size: Option<&str>, poop_type: Option<&str>, duration: Option<i64>) -> anyhow::Result<()> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query("INSERT INTO PoopEntry (user_id, logged_at, colour, size, type, duration) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(user_id)
            .bind(now)
            .bind(colour)
            .bind(size)
            .bind(poop_type)
            .bind(duration)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_poop_stats(&self, user_id: &str) -> anyhow::Result<(i64, Option<i64>)> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM PoopEntry WHERE user_id = ?")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;
        
        let last: Option<(i64,)> = sqlx::query_as("SELECT logged_at FROM PoopEntry WHERE user_id = ? ORDER BY logged_at DESC LIMIT 1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;
            
        Ok((count.0, last.map(|l| l.0)))
    }

    pub async fn get_poop_leaderboard(&self, period: &str, limit: i64, offset: i64) -> anyhow::Result<Vec<(String, f64)>> {
        let since = match period {
            "weekly" => chrono::Utc::now().timestamp() - 7 * 24 * 3600,
            "monthly" => chrono::Utc::now().timestamp() - 30 * 24 * 3600,
            _ => 0,
        };

        let rows = sqlx::query_as::<_, (String, i64)>(
            "SELECT user_id, COUNT(*) as count FROM PoopEntry WHERE logged_at >= ? GROUP BY user_id ORDER BY count DESC LIMIT ? OFFSET ?"
        )
        .bind(since)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|(id, count)| (id, count as f64)).collect())
    }

    pub async fn get_poop_leaderboard_count(&self, period: &str) -> anyhow::Result<i64> {
        let since = match period {
            "weekly" => chrono::Utc::now().timestamp() - 7 * 24 * 3600,
            "monthly" => chrono::Utc::now().timestamp() - 30 * 24 * 3600,
            _ => 0,
        };

        let count: (i64,) = sqlx::query_as("SELECT COUNT(DISTINCT user_id) FROM PoopEntry WHERE logged_at >= ?")
            .bind(since)
            .fetch_one(&self.pool)
            .await?;
            
        Ok(count.0)
    }

    pub async fn get_random_poop(&self) -> anyhow::Result<Option<crate::database::models::PoopEntry>> {
        let entry = sqlx::query_as::<_, crate::database::models::PoopEntry>("SELECT * FROM PoopEntry ORDER BY RANDOM() LIMIT 1")
            .fetch_optional(&self.pool)
            .await?;
        Ok(entry)
    }
}

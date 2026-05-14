use crate::database::models::User;
use chrono::{NaiveDateTime, Utc};

impl super::Database {
    pub async fn get_user(&self, user_id: &str) -> anyhow::Result<User> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM User WHERE id = ?")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some(user) = user {
            Ok(user)
        } else {
            // Create user if they don't exist
            sqlx::query("INSERT INTO User (id) VALUES (?)")
                .bind(user_id)
                .execute(&self.pool)
                .await?;
            
            let user = sqlx::query_as::<_, User>("SELECT * FROM User WHERE id = ?")
                .bind(user_id)
                .fetch_one(&self.pool)
                .await?;
            Ok(user)
        }
    }

    pub async fn set_user_attr_birthday(&self, user_id: &str, birthday: Option<NaiveDateTime>) -> anyhow::Result<()> {
        sqlx::query("UPDATE User SET birthdays = ? WHERE id = ?")
            .bind(birthday)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn add_credits(&self, user_id: &str, amount: f64) -> anyhow::Result<()> {
        // Ensure user exists first
        self.get_user(user_id).await?;

        sqlx::query("UPDATE User SET credits = credits + ? WHERE id = ?")
            .bind(amount)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn update_user_attr(&self, user_id: &str, attr: &str, value: f64, is_incremental: bool) -> anyhow::Result<()> {
        let query = if is_incremental {
            format!("UPDATE User SET {} = {} + ? WHERE id = ?", attr, attr)
        } else {
            format!("UPDATE User SET {} = ? WHERE id = ?", attr)
        };

        sqlx::query(&query)
            .bind(value)
            .bind(user_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn add_user_attr(&self, user_id: &str, attr: &str, value: f64) -> anyhow::Result<()> {
        self.update_user_attr(user_id, attr, value, true).await
    }

    pub async fn set_user_attr(&self, user_id: &str, attr: &str, value: f64) -> anyhow::Result<()> {
        self.update_user_attr(user_id, attr, value, false).await
    }

    pub async fn get_everyone_attr(&self, attr: &str, limit: i64, offset: i64) -> anyhow::Result<Vec<(String, f64)>> {
        let query = format!("SELECT id, {} FROM User WHERE {} <> 0 ORDER BY {} DESC LIMIT ? OFFSET ?", attr, attr, attr);
        let rows = sqlx::query(&query)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await?;

        let result = rows.iter().map(|r| {
            use sqlx::Row;
            (r.get::<String, _>(0), r.get::<f64, _>(1))
        }).collect();
        Ok(result)
    }

    pub async fn get_everyone_attr_count(&self, attr: &str) -> anyhow::Result<i64> {
        let query = format!("SELECT COUNT(*) FROM User WHERE {} <> 0", attr);
        let row: (i64,) = sqlx::query_as(&query)
            .fetch_one(&self.pool)
            .await?;
        Ok(row.0)
    }

    pub async fn get_gambling_stats(&self, type_name: &str, limit: i64, offset: i64) -> anyhow::Result<Vec<(String, f64)>> {
        let query = format!(
            "SELECT id, ({}_relative_won - {}_times_played) as relative_won \
             FROM User WHERE {}_times_played <> 0 ORDER BY relative_won DESC LIMIT ? OFFSET ?",
            type_name, type_name, type_name
        );
        let rows = sqlx::query(&query)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool)
            .await?;

        let result = rows.iter().map(|r| {
            use sqlx::Row;
            (r.get::<String, _>(0), r.get::<f64, _>(1))
        }).collect();
        Ok(result)
    }

    pub async fn get_gambling_stats_count(&self, type_name: &str) -> anyhow::Result<i64> {
        let query = format!("SELECT COUNT(*) FROM User WHERE {}_times_played <> 0", type_name);
        let row: (i64,) = sqlx::query_as(&query)
            .fetch_one(&self.pool)
            .await?;
        Ok(row.0)
    }

    pub async fn get_all_relative_net_winnings(&self, limit: i64, offset: i64) -> anyhow::Result<Vec<(String, f64)>> {
        let rows = sqlx::query(
            "SELECT id, (slots_relative_won + blackjack_relative_won + roulette_relative_won - slots_times_played - blackjack_times_played - roulette_times_played) as relative_won \
             FROM User WHERE slots_times_played <> 0 OR blackjack_times_played <> 0 OR roulette_times_played <> 0 \
             ORDER BY relative_won DESC LIMIT ? OFFSET ?"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        let result = rows.iter().map(|r| {
            use sqlx::Row;
            (r.get::<String, _>(0), r.get::<f64, _>(1))
        }).collect();
        Ok(result)
    }

    pub async fn get_all_relative_net_winnings_count(&self) -> anyhow::Result<i64> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM User WHERE slots_times_played <> 0 OR blackjack_times_played <> 0 OR roulette_times_played <> 0"
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(row.0)
    }

    pub async fn claim_nuggies(&self, user_id: &str, amount: f64, is_streak: bool) -> anyhow::Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("UPDATE User SET dinonuggies = dinonuggies + ?, dinonuggies_last_claimed = ? WHERE id = ?")
            .bind(amount)
            .bind(Utc::now().naive_utc())
            .bind(user_id)
            .execute(&mut *tx)
            .await?;

        if is_streak {
            sqlx::query("UPDATE User SET dinonuggies_claim_streak = dinonuggies_claim_streak + 1 WHERE id = ?")
                .bind(user_id)
                .execute(&mut *tx)
                .await?;
        } else {
            // Note: In TS, some claims don't reset streak, some do. 
            // Usually regular claim increases it.
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn get_murder_stats(&self, limit: i64, offset: i64) -> anyhow::Result<Vec<(String, i64)>> {
        let rows = sqlx::query(
            "SELECT id, murder_success FROM User WHERE murder_success <> 0 ORDER BY murder_success DESC LIMIT ? OFFSET ?"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        let result = rows.iter().map(|r| {
            use sqlx::Row;
            (r.get::<String, _>(0), r.get::<i64, _>(1))
        }).collect();
        Ok(result)
    }

    pub async fn get_murder_stats_count(&self) -> anyhow::Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM User WHERE murder_success <> 0")
            .fetch_one(&self.pool)
            .await?;
        Ok(row.0)
    }

    pub async fn ascend_user(&self, user_id: &str, all_upgrades_maxed: bool) -> anyhow::Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query(
            "UPDATE User SET \
             credits = 0, \
             bitcoin = 0, \
             last_bought_price = 0, \
             last_bought_amount = 0, \
             dinonuggies = 0, \
             dinonuggies_last_claimed = NULL, \
             dinonuggies_claim_streak = 0, \
             multiplier_amount_level = 1, \
             multiplier_rarity_level = 1, \
             beki_level = 1, \
             heavenly_nuggies = heavenly_nuggies + dinonuggies \
             WHERE id = ?"
        )
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        if all_upgrades_maxed {
            sqlx::query("UPDATE User SET ascension_level = ascension_level + 1 WHERE id = ?")
                .bind(user_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(())
    }
}

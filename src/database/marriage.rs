use crate::database::models::Marriage;

impl super::Database {
    pub async fn add_marriage(&self, user1_id: &str, user2_id: &str) -> anyhow::Result<()> {
        sqlx::query("INSERT INTO Marriage (user1_id, user2_id) VALUES (?, ?)")
            .bind(user1_id)
            .bind(user2_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn remove_marriage(&self, user1_id: &str, user2_id: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM Marriage WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)")
            .bind(user1_id)
            .bind(user2_id)
            .bind(user2_id)
            .bind(user1_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_marriage(&self, user_id: &str) -> anyhow::Result<Option<Marriage>> {
        let marriage = sqlx::query_as::<_, Marriage>("SELECT * FROM Marriage WHERE user1_id = ? OR user2_id = ?")
            .bind(user_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(marriage)
    }

    pub async fn get_marriage_status(&self, user_id: &str) -> anyhow::Result<(bool, Option<String>)> {
        let marriage = self.get_marriage(user_id).await?;
        if let Some(m) = marriage {
            let partner_id = if m.user1_id == user_id { m.user2_id } else { m.user1_id };
            Ok((true, Some(partner_id)))
        } else {
            Ok((false, None))
        }
    }

    pub async fn get_marriage_benefits(&self, user_id: &str) -> anyhow::Result<f64> {
        let (is_married, _) = self.get_marriage_status(user_id).await?;
        if is_married {
            Ok(1.1)
        } else {
            Ok(1.0)
        }
    }
}

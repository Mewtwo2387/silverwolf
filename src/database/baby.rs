use crate::database::models::Baby;

impl super::Database {
    pub async fn create_baby(&self, mother_id: &str, father_id: &str) -> anyhow::Result<()> {
        sqlx::query("INSERT INTO Baby (mother_id, father_id, status, name) VALUES (?, ?, 'unborn', 'baby')")
            .bind(mother_id)
            .bind(father_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_baby_by_id(&self, id: i64) -> anyhow::Result<Option<Baby>> {
        let baby = sqlx::query_as::<_, Baby>("SELECT * FROM Baby WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(baby)
    }

    pub async fn get_babies_by_parent(&self, parent_id: &str) -> anyhow::Result<Vec<Baby>> {
        let babies = sqlx::query_as::<_, Baby>("SELECT * FROM Baby WHERE mother_id = ? OR father_id = ?")
            .bind(parent_id)
            .bind(parent_id)
            .fetch_all(&self.pool)
            .await?;
        Ok(babies)
    }

    pub async fn update_baby_attr(&self, id: i64, attr: &str, value: &str) -> anyhow::Result<()> {
        let query = format!("UPDATE Baby SET {} = ? WHERE id = ?", attr);
        sqlx::query(&query)
            .bind(value)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn update_baby_attr_i64(&self, id: i64, attr: &str, value: i64) -> anyhow::Result<()> {
        let query = format!("UPDATE Baby SET {} = ? WHERE id = ?", attr);
        sqlx::query(&query)
            .bind(value)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn add_baby_attr(&self, id: i64, attr: &str, amount: i64) -> anyhow::Result<()> {
        let query = format!("UPDATE Baby SET {} = {} + ? WHERE id = ?", attr, attr);
        sqlx::query(&query)
            .bind(amount)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn born_baby(&self, id: i64) -> anyhow::Result<()> {
        let now = chrono::Utc::now().naive_utc();
        sqlx::query("UPDATE Baby SET status = 'born', born = ? WHERE id = ?")
            .bind(now)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_baby(&self, id: i64) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM Baby WHERE id = ?").bind(id).execute(&self.pool).await?;
        Ok(())
    }
}

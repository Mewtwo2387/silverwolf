impl super::Database {
    pub async fn get_global_config(&self, key: &str) -> anyhow::Result<Option<String>> {
        let row: Option<(String,)> = sqlx::query_as("SELECT value FROM GlobalConfig WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.0))
    }

    pub async fn set_global_config(&self, key: &str, value: &str) -> anyhow::Result<()> {
        sqlx::query("INSERT INTO GlobalConfig (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value")
            .bind(key)
            .bind(value)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_global_config(&self, key: &str) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM GlobalConfig WHERE key = ?")
            .bind(key)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_all_global_config(&self) -> anyhow::Result<Vec<(String, String)>> {
        let rows = sqlx::query_as::<_, (String, String)>("SELECT key, value FROM GlobalConfig")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows)
    }

    pub async fn append_unique_to_list(&self, key: &str, value: &str) -> anyhow::Result<bool> {
        let mut tx = self.pool.begin().await?;
        
        let existing = sqlx::query_as::<_, (String,)>("SELECT value FROM GlobalConfig WHERE key = ?")
            .bind(key)
            .fetch_optional(&mut *tx)
            .await?;
        
        let mut items: Vec<String> = match existing {
            Some((val,)) => val.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            None => Vec::new(),
        };

        if items.contains(&value.to_string()) {
            tx.rollback().await?;
            return Ok(false);
        }

        items.push(value.to_string());
        let new_value = items.join(",");
        
        sqlx::query("INSERT INTO GlobalConfig (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value")
            .bind(key)
            .bind(new_value)
            .execute(&mut *tx)
            .await?;
        
        tx.commit().await?;
        Ok(true)
    }

    pub async fn remove_from_list(&self, key: &str, value: &str) -> anyhow::Result<bool> {
        let mut tx = self.pool.begin().await?;
        
        let existing = sqlx::query_as::<_, (String,)>("SELECT value FROM GlobalConfig WHERE key = ?")
            .bind(key)
            .fetch_optional(&mut *tx)
            .await?;
        
        let items: Vec<String> = match existing {
            Some((val,)) => val.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect(),
            None => Vec::new(),
        };

        if !items.contains(&value.to_string()) {
            tx.rollback().await?;
            return Ok(false);
        }

        let updated: Vec<String> = items.into_iter().filter(|s| s != value).collect();
        
        if updated.is_empty() {
            sqlx::query("DELETE FROM GlobalConfig WHERE key = ?")
                .bind(key)
                .execute(&mut *tx)
                .await?;
        } else {
            let new_value = updated.join(",");
            sqlx::query("UPDATE GlobalConfig SET value = ? WHERE key = ?")
                .bind(new_value)
                .bind(key)
                .execute(&mut *tx)
                .await?;
        }
        
        tx.commit().await?;
        Ok(true)
    }
}

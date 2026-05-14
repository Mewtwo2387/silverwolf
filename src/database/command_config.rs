impl super::Database {
    pub async fn add_or_update_command_blacklist(&self, command_name: &str, server_id: &str, reason: &str) -> anyhow::Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO CommandConfig (command_name, server_id, reason, disabled_date) VALUES (?, ?, ?, ?) ON CONFLICT(command_name, server_id) DO UPDATE SET reason = EXCLUDED.reason, disabled_date = EXCLUDED.disabled_date")
            .bind(command_name)
            .bind(server_id)
            .bind(reason)
            .bind(now)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_command_blacklist(&self, command_name: &str, server_id: &str) -> anyhow::Result<String> {
        let res = sqlx::query("DELETE FROM CommandConfig WHERE command_name = ? AND server_id = ?")
            .bind(command_name)
            .bind(server_id)
            .execute(&self.pool)
            .await?;
        
        if res.rows_affected() > 0 {
            Ok(format!("Command {} is no longer blacklisted in server {}.", command_name, server_id))
        } else {
            Ok(format!("Command {} was not blacklisted in server {}.", command_name, server_id))
        }
    }

    pub async fn get_blacklisted_commands(&self, server_id: &str) -> anyhow::Result<Vec<serde_json::Value>> {
        let rows = sqlx::query_as::<_, (String, String, String)>("SELECT command_name, reason, disabled_date FROM CommandConfig WHERE server_id = ?")
            .bind(server_id)
            .fetch_all(&self.pool)
            .await?;
        
        let mut result = Vec::new();
        for (name, reason, date) in rows {
            result.push(serde_json::json!({
                "commandName": name,
                "reason": reason,
                "disabled_date": date,
            }));
        }
        Ok(result)
    }
}

impl super::Database {
    pub async fn set_server_role(&self, server_id: &str, role_name: &str, role_id: &str) -> anyhow::Result<()> {
        sqlx::query("INSERT INTO ServerRoles (server_id, role_name, role_id) VALUES (?, ?, ?) ON CONFLICT(server_id, role_name) DO UPDATE SET role_id = EXCLUDED.role_id")
            .bind(server_id)
            .bind(role_name)
            .bind(role_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_server_role(&self, server_id: &str, role_name: &str) -> anyhow::Result<Option<String>> {
        let row: Option<(String,)> = sqlx::query_as("SELECT role_id FROM ServerRoles WHERE server_id = ? AND role_name = ?")
            .bind(server_id)
            .bind(role_name)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.0))
    }
}

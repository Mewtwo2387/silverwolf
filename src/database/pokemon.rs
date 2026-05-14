use crate::database::models::Pokemon;

impl super::Database {
    pub async fn catch_pokemon(&self, user_id: &str, pokemon_name: &str) -> anyhow::Result<()> {
        // Ensure user exists
        self.get_user(user_id).await?;

        sqlx::query(
            "INSERT INTO Pokemon (user_id, pokemon_name, pokemon_count) \
             VALUES (?, ?, 1) \
             ON CONFLICT(user_id, pokemon_name) DO UPDATE SET pokemon_count = pokemon_count + 1"
        )
        .bind(user_id)
        .bind(pokemon_name)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_pokemons(&self, user_id: &str) -> anyhow::Result<Vec<Pokemon>> {
        let pokemons = sqlx::query_as::<_, Pokemon>("SELECT * FROM Pokemon WHERE user_id = ? ORDER BY pokemon_name")
            .bind(user_id)
            .fetch_all(&self.pool)
            .await?;
        Ok(pokemons)
    }

    pub async fn get_unique_pokemon_count(&self, user_id: &str) -> anyhow::Result<i64> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM Pokemon WHERE user_id = ?")
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;
        Ok(row.0)
    }

    pub async fn sacrifice_pokemon(&self, user_id: &str, pokemon_name: &str) -> anyhow::Result<()> {
        sqlx::query(
            "UPDATE Pokemon SET pokemon_count = pokemon_count - 1 \
             WHERE user_id = ? AND pokemon_name = ? AND pokemon_count > 0"
        )
        .bind(user_id)
        .bind(pokemon_name)
        .execute(&self.pool)
        .await?;
        
        // Remove entry if count is 0
        sqlx::query("DELETE FROM Pokemon WHERE user_id = ? AND pokemon_name = ? AND pokemon_count <= 0")
            .bind(user_id)
            .bind(pokemon_name)
            .execute(&self.pool)
            .await?;
            
        Ok(())
    }

    pub async fn get_pokemon_count(&self, user_id: &str, pokemon_name: &str) -> anyhow::Result<i64> {
        let row: Option<(i64,)> = sqlx::query_as("SELECT pokemon_count FROM Pokemon WHERE user_id = ? AND pokemon_name = ?")
            .bind(user_id)
            .bind(pokemon_name)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.0).unwrap_or(0))
    }

    pub async fn get_users_with_pokemon(&self, pokemon_name: &str) -> anyhow::Result<Vec<(String, i64)>> {
        let rows = sqlx::query_as::<_, (String, i64)>("SELECT user_id, pokemon_count FROM Pokemon WHERE pokemon_name = ?")
            .bind(pokemon_name)
            .fetch_all(&self.pool)
            .await?;
        Ok(rows)
    }
}

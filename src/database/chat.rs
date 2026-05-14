use crate::database::models::{ChatSession, ChatHistory, AiChatSession, AiChatHistory};
use chrono::{Utc, NaiveDateTime};

impl super::Database {
    // --- General Chat (for /ask) ---

    pub async fn get_active_chat_session(&self, user_id: &str, server_id: &str) -> anyhow::Result<Option<ChatSession>> {
        let session = sqlx::query_as::<_, ChatSession>(
            "SELECT * FROM ChatSession WHERE started_by = ? AND server_id = ? AND active = 1 ORDER BY session_id DESC LIMIT 1"
        )
        .bind(user_id)
        .bind(server_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(session)
    }

    pub async fn start_chat_session(&self, user_id: &str, server_id: &str) -> anyhow::Result<ChatSession> {
        // Deactivate old ones
        sqlx::query("UPDATE ChatSession SET active = 0 WHERE started_by = ? AND server_id = ?")
            .bind(user_id)
            .bind(server_id)
            .execute(&self.pool)
            .await?;

        let id = sqlx::query("INSERT INTO ChatSession (started_by, server_id, created_at) VALUES (?, ?, ?)")
            .bind(user_id)
            .bind(server_id)
            .bind(Utc::now().naive_utc())
            .execute(&self.pool)
            .await?
            .last_insert_rowid();

        let session = sqlx::query_as::<_, ChatSession>("SELECT * FROM ChatSession WHERE session_id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await?;
        Ok(session)
    }

    pub async fn get_chat_history(&self, session_id: i64) -> anyhow::Result<Vec<ChatHistory>> {
        let history = sqlx::query_as::<_, ChatHistory>(
            "SELECT * FROM ChatHistory WHERE session_id = ? ORDER BY id DESC LIMIT 100"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(history)
    }

    pub async fn add_chat_history(&self, session_id: i64, role: &str, message: &str) -> anyhow::Result<()> {
        sqlx::query("INSERT INTO ChatHistory (session_id, role, message, timestamp) VALUES (?, ?, ?, ?)")
            .bind(session_id)
            .bind(role)
            .bind(message)
            .bind(Utc::now().naive_utc())
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // --- Persona Chat (AiChat) ---

    pub async fn get_active_ai_chat_session(&self, user_id: &str, persona_name: &str) -> anyhow::Result<Option<AiChatSession>> {
        let session = sqlx::query_as::<_, AiChatSession>(
            "SELECT * FROM AiChatSession WHERE user_id = ? AND persona_name = ? AND active = 1 ORDER BY session_id DESC LIMIT 1"
        )
        .bind(user_id)
        .bind(persona_name)
        .fetch_optional(&self.pool)
        .await?;
        Ok(session)
    }

    pub async fn start_new_ai_chat_session(&self, user_id: &str, persona_name: &str) -> anyhow::Result<AiChatSession> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("UPDATE AiChatSession SET active = 0 WHERE user_id = ? AND persona_name = ?")
            .bind(user_id)
            .bind(persona_name)
            .execute(&mut *tx)
            .await?;

        let id = sqlx::query("INSERT INTO AiChatSession (user_id, persona_name, active, created_at) VALUES (?, ?, 1, ?)")
            .bind(user_id)
            .bind(persona_name)
            .bind(Utc::now().naive_utc())
            .execute(&mut *tx)
            .await?
            .last_insert_rowid();

        tx.commit().await?;

        let session = sqlx::query_as::<_, AiChatSession>("SELECT * FROM AiChatSession WHERE session_id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await?;
        Ok(session)
    }

    pub async fn get_ai_chat_session_by_id(&self, session_id: i64) -> anyhow::Result<Option<AiChatSession>> {
        let session = sqlx::query_as::<_, AiChatSession>("SELECT * FROM AiChatSession WHERE session_id = ?")
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(session)
    }

    pub async fn get_all_user_ai_chat_sessions(&self, user_id: &str) -> anyhow::Result<Vec<serde_json::Value>> {
        // We use a raw JSON value because we want to include messageCount which isn't in the model
        let sessions = sqlx::query(
            "SELECT s.*, (SELECT COUNT(*) FROM AiChatHistory h WHERE h.session_id = s.session_id) as message_count \
             FROM AiChatSession s WHERE s.user_id = ? ORDER BY s.session_id DESC"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;
        
        // Map manually to handle message_count
        let mut result = Vec::new();
        for row in sessions {
            use sqlx::Row;
            let val = serde_json::json!({
                "sessionId": row.get::<i64, _>("session_id"),
                "userId": row.get::<String, _>("user_id"),
                "personaName": row.get::<String, _>("persona_name"),
                "active": row.get::<i64, _>("active"),
                "createdAt": row.get::<NaiveDateTime, _>("created_at"),
                "title": row.get::<Option<String>, _>("title"),
                "messageCount": row.get::<i64, _>("message_count"),
            });
            result.push(val);
        }
        Ok(result)
    }

    pub async fn switch_ai_chat_session(&self, user_id: &str, session_id: i64) -> anyhow::Result<Option<AiChatSession>> {
        let session = self.get_ai_chat_session_by_id(session_id).await?;
        let session_data = match session {
            Some(s) => s,
            None => return Ok(None),
        };

        let mut tx = self.pool.begin().await?;

        sqlx::query("UPDATE AiChatSession SET active = 0 WHERE user_id = ? AND persona_name = ?")
            .bind(user_id)
            .bind(&session_data.persona_name)
            .execute(&mut *tx)
            .await?;

        sqlx::query("UPDATE AiChatSession SET active = 1 WHERE session_id = ?")
            .bind(session_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        self.get_ai_chat_session_by_id(session_id).await
    }

    pub async fn delete_ai_chat_session(&self, user_id: &str, session_id: i64) -> anyhow::Result<bool> {
        let session = self.get_ai_chat_session_by_id(session_id).await?;
        let _session = match session {
            Some(s) if s.user_id == user_id => s,
            _ => return Ok(false),
        };

        let mut tx = self.pool.begin().await?;

        sqlx::query("DELETE FROM AiChatHistory WHERE session_id = ?")
            .bind(session_id)
            .execute(&mut *tx)
            .await?;

        sqlx::query("DELETE FROM AiChatSession WHERE session_id = ?")
            .bind(session_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(true)
    }

    pub async fn get_ai_chat_history(&self, session_id: i64, limit: i64) -> anyhow::Result<Vec<AiChatHistory>> {
        let history = sqlx::query_as::<_, AiChatHistory>(
            "SELECT * FROM AiChatHistory WHERE session_id = ? ORDER BY id DESC LIMIT ?"
        )
        .bind(session_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        
        let mut history = history;
        history.reverse();
        Ok(history)
    }

    pub async fn add_ai_chat_history(&self, session_id: i64, role: &str, message: &str) -> anyhow::Result<()> {
        sqlx::query("INSERT INTO AiChatHistory (session_id, role, message, timestamp) VALUES (?, ?, ?, ?)")
            .bind(session_id)
            .bind(role)
            .bind(message)
            .bind(Utc::now().naive_utc())
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

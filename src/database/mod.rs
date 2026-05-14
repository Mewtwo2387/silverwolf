pub mod models;
pub mod user;
pub mod chat;
pub mod baby;
pub mod pokemon;
pub mod marriage;
pub mod birthday;
pub mod config;
pub mod command_config;
pub mod games;
pub mod server_roles;
pub mod poop;

use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::env;

pub struct Database {
    pub pool: SqlitePool,
}

impl Database {
    pub async fn new() -> anyhow::Result<Self> {
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:persistence/database.db".to_string());
        
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await?;

        // Enable WAL mode
        sqlx::query("PRAGMA journal_mode = WAL").execute(&pool).await?;
        sqlx::query("PRAGMA foreign_keys = ON").execute(&pool).await?;

        Ok(Database { pool })
    }

    pub async fn dump_table(&self, table_name: &str, format_user_ids: &[&str]) -> anyhow::Result<String> {
        use sqlx::{Row, Column};
        
        // Basic SQL injection protection for table name
        if !table_name.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err(anyhow::anyhow!("Invalid table name"));
        }

        let query = format!("SELECT * FROM {}", table_name);
        let rows = sqlx::query(&query).fetch_all(&self.pool).await?;

        if rows.is_empty() {
            return Ok(String::new());
        }

        let mut csv = String::new();
        
        // Header
        let columns = rows[0].columns();
        let column_names: Vec<&str> = columns.iter().map(|c| c.name()).collect();
        csv.push_str(&column_names.join(","));
        csv.push('\n');

        // Rows
        for row in rows {
            let mut values = Vec::new();
            for col in columns {
                let col_name = col.name();
                let value = if format_user_ids.contains(&col_name) {
                    // Try to get as string and wrap in <@>
                    let raw_val: Option<String> = row.try_get(col_name).ok();
                    if let Some(v) = raw_val {
                        format!("<@{}>", v)
                    } else {
                        "NULL".to_string()
                    }
                } else {
                    // Generic string conversion
                    // We might need to handle different types here
                    // For now, let's try common types
                    if let Ok(v) = row.try_get::<String, _>(col_name) {
                        v
                    } else if let Ok(v) = row.try_get::<i64, _>(col_name) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<f64, _>(col_name) {
                        v.to_string()
                    } else if let Ok(v) = row.try_get::<bool, _>(col_name) {
                        v.to_string()
                    } else {
                        "NULL".to_string()
                    }
                };
                values.push(value);
            }
            csv.push_str(&values.join(","));
            csv.push('\n');
        }

        Ok(csv)
    }
}

use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct ListToolsResponse {
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Serialize)]
struct CallToolRequest {
    pub name: String,
    pub arguments: serde_json::Value,
}

pub struct McpClient {
    url: String,
    client: Client,
    tools: Arc<Mutex<Vec<ToolDefinition>>>,
}

impl McpClient {
    pub fn new(url: String) -> Self {
        Self {
            url,
            client: Client::new(),
            tools: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn list_tools(&self) -> anyhow::Result<Vec<ToolDefinition>> {
        let resp = self.client.get(format!("{}/tools", self.url))
            .send()
            .await?
            .json::<ListToolsResponse>()
            .await?;
        
        let mut tools = self.tools.lock().await;
        *tools = resp.tools.clone();
        
        Ok(resp.tools)
    }

    pub async fn call_tool(&self, name: &str, args: serde_json::Value) -> anyhow::Result<String> {
        let resp = self.client.post(format!("{}/tools/call", self.url))
            .json(&CallToolRequest {
                name: name.to_string(),
                arguments: args,
            })
            .send()
            .await?;

        let body = resp.text().await?;
        // Simplification: handle response content extraction here
        Ok(body)
    }
}

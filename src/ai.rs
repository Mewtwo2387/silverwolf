use serde::{Deserialize, Serialize};
use crate::Error;
use std::env;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Persona {
    pub name: String,
    pub provider: String,
    pub model: String,
    pub system_prompt: Option<String>,
    pub system_prompt_file: Option<String>,
}

pub async fn get_persona_by_name(name: &str) -> anyhow::Result<Option<Persona>> {
    let personas_json = std::fs::read_to_string("data/aiPersonas.json")?;
    let data: serde_json::Value = serde_json::from_str(&personas_json)?;
    let personas = data["personas"].as_array().ok_or(anyhow::anyhow!("Invalid personas JSON"))?;
    
    for p in personas {
        if p["name"].as_str().map(|s| s.to_lowercase()) == Some(name.to_lowercase()) {
            let mut persona: Persona = serde_json::from_value(p.clone())?;
            if let Some(ref file) = persona.system_prompt_file {
                persona.system_prompt = Some(std::fs::read_to_string(file)?);
            }
            return Ok(Some(persona));
        }
    }
    Ok(None)
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    system_instruction: Option<GeminiSystemInstruction>,
}

#[derive(Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiSystemInstruction {
    parts: Vec<GeminiPart>,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiContentResponse,
}

#[derive(Deserialize)]
struct GeminiContentResponse {
    parts: Vec<GeminiPartResponse>,
}

#[derive(Deserialize)]
struct GeminiPartResponse {
    text: Option<String>,
}

pub async fn generate_content(
    http_client: &reqwest::Client,
    provider: &str,
    model: &str,
    system_prompt: &str,
    prompt: &str,
) -> anyhow::Result<String> {
    if provider == "gemini" {
        let api_key = env::var("GEMINI_TOKEN")?;
        let url = format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, api_key);
        
        let request = GeminiRequest {
            contents: vec![GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart { text: prompt.to_string() }],
            }],
            system_instruction: Some(GeminiSystemInstruction {
                parts: vec![GeminiPart { text: system_prompt.to_string() }],
            }),
        };

        let resp = http_client.post(&url)
            .json(&request)
            .send()
            .await?
            .json::<GeminiResponse>()
            .await?;
        
        let text = resp.candidates.get(0)
            .and_then(|c| c.content.parts.get(0))
            .and_then(|p| p.text.clone())
            .unwrap_or_default();
            
        return Ok(text);
    }
    
    Err(anyhow::anyhow!("Provider {} not implemented in Rust yet", provider))
}

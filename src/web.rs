use axum::{
    routing::get,
    Router,
    response::IntoResponse,
};
use tower_http::services::ServeDir;
use tower_http::cors::CorsLayer;
use std::net::SocketAddr;
use std::sync::Arc;
use crate::Data;
use tracing::info;

pub async fn start_website(data: Data) -> anyhow::Result<()> {
    let state = Arc::new(data);
    
    let app = Router::new()
        .route("/health", get(health_check))
        // Static files
        .nest_service("/assets", ServeDir::new("site_src/Assets"))
        // API routes would go here
        // .nest("/api", api_router())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 6769));
    info!("Web server listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> impl IntoResponse {
    "OK"
}

use axum::{routing::get, Router};
use std::net::SocketAddr;
use tokio::net::TcpListener;

async fn healthz() -> &'static str {
    "ok"
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(healthz));
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    println!("Catalog service running on {}", addr);
    
    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
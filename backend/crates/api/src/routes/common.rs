use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Attachment {
    pub id: Uuid,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    pub storage_key: String,
    pub task_id: Uuid,
    pub uploaded_by_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_attachment_serde_roundtrip() {
        let now = Utc::now();
        let attachment = Attachment {
            id: Uuid::new_v4(),
            file_name: "document.pdf".to_string(),
            file_size: 1024 * 50,
            mime_type: "application/pdf".to_string(),
            storage_key: "attachments/abc123/document.pdf".to_string(),
            task_id: Uuid::new_v4(),
            uploaded_by_id: Uuid::new_v4(),
            created_at: now,
        };
        let json = serde_json::to_string(&attachment).unwrap();
        let deserialized: Attachment = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.file_name, "document.pdf");
        assert_eq!(deserialized.file_size, 51200);
        assert_eq!(deserialized.mime_type, "application/pdf");
    }

    #[test]
    fn test_attachment_json_fields() {
        let now = Utc::now();
        let attachment = Attachment {
            id: Uuid::new_v4(),
            file_name: "image.png".to_string(),
            file_size: 2048,
            mime_type: "image/png".to_string(),
            storage_key: "uploads/img.png".to_string(),
            task_id: Uuid::new_v4(),
            uploaded_by_id: Uuid::new_v4(),
            created_at: now,
        };
        let parsed: serde_json::Value = serde_json::to_value(&attachment).unwrap();
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("file_name").is_some());
        assert!(parsed.get("file_size").is_some());
        assert!(parsed.get("mime_type").is_some());
        assert!(parsed.get("storage_key").is_some());
        assert!(parsed.get("task_id").is_some());
        assert!(parsed.get("uploaded_by_id").is_some());
    }
}

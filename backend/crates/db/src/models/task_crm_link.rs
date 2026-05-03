//! Task ↔ CRM entity linking.
//!
//! Represents links between tasks and CRM entities: contacts, companies, deals.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaskCrmContact {
    pub task_id: Uuid,
    pub twenty_workspace_id: String,
    pub crm_contact_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub created_by_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaskCrmCompany {
    pub task_id: Uuid,
    pub twenty_workspace_id: String,
    pub crm_company_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub created_by_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TaskCrmDeal {
    pub task_id: Uuid,
    pub twenty_workspace_id: String,
    pub crm_deal_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub created_by_id: Uuid,
}

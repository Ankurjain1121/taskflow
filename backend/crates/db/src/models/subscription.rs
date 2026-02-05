use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::SubscriptionStatus;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Subscription {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub lago_subscription_id: Option<String>,
    pub stripe_customer_id: Option<String>,
    pub plan_code: String,
    pub status: SubscriptionStatus,
    pub trial_ends_at: Option<DateTime<Utc>>,
    pub grace_period_ends_at: Option<DateTime<Utc>>,
    pub current_period_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProcessedWebhook {
    pub id: Uuid,
    pub event_id: String,
    pub processed_at: DateTime<Utc>,
}

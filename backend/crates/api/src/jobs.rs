use std::time::Duration;

use crate::config::Config;
use crate::state::AppState;

pub async fn spawn_background_jobs(state: &AppState, config: &Config) {
    // Spawn background job: recurring task scheduler (every 10 minutes)
    let recurring_pool = state.db.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(600));
        // Skip the first immediate tick to let the server finish starting
        interval.tick().await;
        tracing::info!("Recurring task scheduler started (interval: 10 min)");
        loop {
            interval.tick().await;
            match taskflow_db::queries::recurring_generation::get_due_configs(&recurring_pool).await
            {
                Ok(configs) => {
                    if configs.is_empty() {
                        tracing::debug!("Recurring scheduler: no configs due");
                        continue;
                    }
                    let total = configs.len();
                    let mut created = 0usize;
                    let mut errors = 0usize;
                    for config in &configs {
                        match taskflow_db::queries::recurring_generation::create_recurring_instance(
                            &recurring_pool,
                            config,
                        )
                        .await
                        {
                            Ok(_) => created += 1,
                            Err(e) => {
                                tracing::error!(
                                    config_id = %config.id,
                                    "Recurring instance creation failed: {e}"
                                );
                                errors += 1;
                            }
                        }
                    }
                    tracing::info!(total, created, errors, "Recurring scheduler tick completed");
                }
                Err(e) => {
                    tracing::error!("Recurring scheduler: failed to fetch due configs: {e}");
                }
            }
        }
    });

    // Spawn background job: email worker (dequeues from Redis and sends emails)
    // Only starts if Postal is configured. Resend-only setups skip the worker
    // (the dispatcher enqueues jobs; a future worker upgrade will use the trait).
    if !config.postal_api_key.is_empty() {
        let postal = taskflow_services::PostalClient::new(
            config.postal_api_url.clone(),
            config.postal_api_key.clone(),
            config.postal_from_address.clone(),
            config.postal_from_name.clone(),
        );
        let worker_redis = state.redis.clone();
        tracing::info!("Email worker started (provider: Postal)");
        tokio::spawn(taskflow_services::jobs::email_worker::run_email_worker(
            worker_redis,
            postal,
        ));
    } else if std::env::var("RESEND_API_KEY")
        .ok()
        .filter(|s| !s.is_empty())
        .is_some()
    {
        tracing::info!("Email worker skipped: RESEND_API_KEY set but email worker requires POSTAL_API_KEY (emails sent inline via dispatcher)");
    } else {
        tracing::warn!("Email worker disabled: neither RESEND_API_KEY nor POSTAL_API_KEY is set");
    }

    // Spawn background job: daily digest (every 24 hours)
    {
        let digest_pool = state.db.clone();
        let digest_config = config.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(10)).await;
            let mut interval = tokio::time::interval(Duration::from_secs(86400));
            interval.tick().await; // skip first immediate tick
            tracing::info!("Daily digest scheduler started (interval: 24h)");
            loop {
                interval.tick().await;
                if digest_config.postal_api_key.is_empty() {
                    tracing::debug!("Daily digest skipped: no email provider configured");
                    continue;
                }
                let postal = taskflow_services::PostalClient::new(
                    digest_config.postal_api_url.clone(),
                    digest_config.postal_api_key.clone(),
                    digest_config.postal_from_address.clone(),
                    digest_config.postal_from_name.clone(),
                );
                match taskflow_services::jobs::daily_digest::send_daily_digests(
                    &digest_pool,
                    &postal,
                    &digest_config.app_url,
                )
                .await
                {
                    Ok(r) => tracing::info!(
                        users = r.users_processed,
                        sent = r.emails_sent,
                        errs = r.errors,
                        "Daily digest completed"
                    ),
                    Err(e) => tracing::error!(error = %e, "Daily digest failed"),
                }
            }
        });
    }

    // Spawn background job: weekly digest (every 7 days)
    {
        let digest_pool = state.db.clone();
        let digest_config = config.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(15)).await;
            let mut interval = tokio::time::interval(Duration::from_secs(604800));
            interval.tick().await; // skip first immediate tick
            tracing::info!("Weekly digest scheduler started (interval: 7d)");
            loop {
                interval.tick().await;
                if digest_config.postal_api_key.is_empty() {
                    tracing::debug!("Weekly digest skipped: no email provider configured");
                    continue;
                }
                let postal = taskflow_services::PostalClient::new(
                    digest_config.postal_api_url.clone(),
                    digest_config.postal_api_key.clone(),
                    digest_config.postal_from_address.clone(),
                    digest_config.postal_from_name.clone(),
                );
                match taskflow_services::send_weekly_digests(
                    &digest_pool,
                    &postal,
                    &digest_config.app_url,
                )
                .await
                {
                    Ok(r) => tracing::info!(
                        users = r.users_processed,
                        sent = r.emails_sent,
                        errs = r.errors,
                        "Weekly digest completed"
                    ),
                    Err(e) => tracing::error!(error = %e, "Weekly digest failed"),
                }
            }
        });
    }
}

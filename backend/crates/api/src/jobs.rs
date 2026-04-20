use std::time::Duration;

use crate::config::Config;
use crate::state::AppState;

#[allow(clippy::unused_async)]
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
            match taskbolt_db::queries::recurring_generation::get_due_configs(&recurring_pool).await
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
                        match taskbolt_db::queries::recurring_generation::create_recurring_instance(
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
        match taskbolt_services::PostalClient::new(
            config.postal_api_url.clone(),
            config.postal_api_key.clone(),
            config.postal_from_address.clone(),
            config.postal_from_name.clone(),
        ) {
            Ok(postal) => {
                let worker_redis = state.redis.clone();
                tracing::info!("Email worker started (provider: Postal)");
                tokio::spawn(taskbolt_services::jobs::email_worker::run_email_worker(
                    worker_redis,
                    postal,
                ));
            }
            Err(e) => {
                tracing::error!(error = %e, "Failed to create Postal client for email worker");
            }
        }
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
                let postal = match taskbolt_services::PostalClient::new(
                    digest_config.postal_api_url.clone(),
                    digest_config.postal_api_key.clone(),
                    digest_config.postal_from_address.clone(),
                    digest_config.postal_from_name.clone(),
                ) {
                    Ok(p) => p,
                    Err(e) => {
                        tracing::error!(error = %e, "Daily digest: failed to create Postal client");
                        continue;
                    }
                };
                match taskbolt_services::jobs::daily_digest::send_daily_digests(
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
                let postal = match taskbolt_services::PostalClient::new(
                    digest_config.postal_api_url.clone(),
                    digest_config.postal_api_key.clone(),
                    digest_config.postal_from_address.clone(),
                    digest_config.postal_from_name.clone(),
                ) {
                    Ok(p) => p,
                    Err(e) => {
                        tracing::error!(error = %e, "Weekly digest: failed to create Postal client");
                        continue;
                    }
                };
                match taskbolt_services::send_weekly_digests(
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

    // Spawn background job: daily WhatsApp digest (8 AM IST = 02:30 UTC)
    if let Some(waha_client) = &state.waha_client {
        // Daily WhatsApp digest
        {
            let wa_pool = state.db.clone();
            let wa_client = waha_client.clone();
            let wa_app_url = config.app_url.clone();
            tokio::spawn(async move {
                // Calculate delay until next 02:30 UTC
                let now = chrono::Utc::now();
                let today_0230 = now
                    .date_naive()
                    .and_hms_opt(2, 30, 0)
                    .expect("valid time")
                    .and_utc();
                let next_run = if now < today_0230 {
                    today_0230
                } else {
                    today_0230 + chrono::Duration::days(1)
                };
                let delay = (next_run - now).to_std().unwrap_or(Duration::from_secs(60));
                tracing::info!(
                    next_run = %next_run,
                    delay_secs = delay.as_secs(),
                    "WhatsApp daily digest scheduled (8 AM IST)"
                );
                tokio::time::sleep(delay).await;

                // Run first digest immediately, then every 24h
                loop {
                    match taskbolt_services::jobs::whatsapp_digest::send_daily_whatsapp_digests(
                        &wa_pool,
                        &wa_client,
                        &wa_app_url,
                    )
                    .await
                    {
                        Ok(r) => tracing::info!(
                            users = r.users_processed,
                            sent = r.messages_sent,
                            errs = r.errors,
                            "WhatsApp daily digest completed"
                        ),
                        Err(e) => tracing::error!(error = %e, "WhatsApp daily digest failed"),
                    }
                    tokio::time::sleep(Duration::from_secs(86400)).await;
                }
            });
        }

        // Weekly WhatsApp summary (Mondays at 02:30 UTC)
        {
            let wa_pool = state.db.clone();
            let wa_client = waha_client.clone();
            let wa_app_url = config.app_url.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_secs(20)).await;
                tracing::info!("WhatsApp weekly summary scheduler started (interval: 7d)");
                // Run first summary immediately, then every 7d
                loop {
                    match taskbolt_services::jobs::whatsapp_digest::send_weekly_whatsapp_summaries(
                        &wa_pool,
                        &wa_client,
                        &wa_app_url,
                    )
                    .await
                    {
                        Ok(r) => tracing::info!(
                            users = r.users_processed,
                            sent = r.messages_sent,
                            errs = r.errors,
                            "WhatsApp weekly summary completed"
                        ),
                        Err(e) => tracing::error!(error = %e, "WhatsApp weekly summary failed"),
                    }
                    tokio::time::sleep(Duration::from_secs(604800)).await;
                }
            });
        }
        // Enhanced daily digest with due time details (replaces basic daily digest)
        {
            let wa_pool = state.db.clone();
            let wa_client = waha_client.clone();
            let wa_app_url = config.app_url.clone();
            tokio::spawn(async move {
                // Calculate delay until next 02:35 UTC (5 min after basic digest)
                let now = chrono::Utc::now();
                let today_0235 = now
                    .date_naive()
                    .and_hms_opt(2, 35, 0)
                    .expect("valid time")
                    .and_utc();
                let next_run = if now < today_0235 {
                    today_0235
                } else {
                    today_0235 + chrono::Duration::days(1)
                };
                let delay = (next_run - now).to_std().unwrap_or(Duration::from_secs(60));
                tracing::info!(
                    next_run = %next_run,
                    delay_secs = delay.as_secs(),
                    "Enhanced daily digest scheduled (8:05 AM IST)"
                );
                tokio::time::sleep(delay).await;

                loop {
                    match taskbolt_services::jobs::whatsapp_digest::send_enhanced_daily_digests(
                        &wa_pool,
                        &wa_client,
                        &wa_app_url,
                    )
                    .await
                    {
                        Ok(r) => tracing::info!(
                            users = r.users_processed,
                            sent = r.messages_sent,
                            errs = r.errors,
                            "Enhanced daily digest completed"
                        ),
                        Err(e) => tracing::error!(error = %e, "Enhanced daily digest failed"),
                    }
                    tokio::time::sleep(Duration::from_secs(86400)).await;
                }
            });
        }

        // Admin daily org report (8:10 AM IST)
        {
            let wa_pool = state.db.clone();
            let wa_client = waha_client.clone();
            let wa_app_url = config.app_url.clone();
            tokio::spawn(async move {
                let now = chrono::Utc::now();
                let today_0240 = now
                    .date_naive()
                    .and_hms_opt(2, 40, 0)
                    .expect("valid time")
                    .and_utc();
                let next_run = if now < today_0240 {
                    today_0240
                } else {
                    today_0240 + chrono::Duration::days(1)
                };
                let delay = (next_run - now).to_std().unwrap_or(Duration::from_secs(60));
                tracing::info!(
                    next_run = %next_run,
                    delay_secs = delay.as_secs(),
                    "Admin daily org report scheduled (8:10 AM IST)"
                );
                tokio::time::sleep(delay).await;

                loop {
                    match taskbolt_services::jobs::whatsapp_digest::send_admin_daily_org_report(
                        &wa_pool,
                        &wa_client,
                        &wa_app_url,
                    )
                    .await
                    {
                        Ok(r) => tracing::info!(
                            admins = r.users_processed,
                            sent = r.messages_sent,
                            errs = r.errors,
                            "Admin daily org report completed"
                        ),
                        Err(e) => tracing::error!(error = %e, "Admin daily org report failed"),
                    }
                    tokio::time::sleep(Duration::from_secs(86400)).await;
                }
            });
        }
        // PDF Morning Agenda Reports (8:15 AM IST = 02:45 UTC)
        {
            let wa_pool = state.db.clone();
            let wa_client = waha_client.clone();
            let wa_app_url = config.app_url.clone();
            tokio::spawn(async move {
                let now = chrono::Utc::now();
                let today_0245 = now
                    .date_naive()
                    .and_hms_opt(2, 45, 0)
                    .expect("valid time")
                    .and_utc();
                let next_run = if now < today_0245 {
                    today_0245
                } else {
                    today_0245 + chrono::Duration::days(1)
                };
                let delay = (next_run - now).to_std().unwrap_or(Duration::from_secs(60));
                tracing::info!(
                    next_run = %next_run,
                    delay_secs = delay.as_secs(),
                    "PDF morning agenda reports scheduled (8:15 AM IST)"
                );
                tokio::time::sleep(delay).await;

                loop {
                    match taskbolt_services::jobs::report_jobs::send_morning_agenda_reports(
                        &wa_pool,
                        &wa_client,
                        &wa_app_url,
                    )
                    .await
                    {
                        Ok(r) => tracing::info!(
                            sent = r.reports_sent,
                            errs = r.errors,
                            "PDF morning agenda reports completed"
                        ),
                        Err(e) => tracing::error!(error = %e, "PDF morning agenda reports failed"),
                    }
                    tokio::time::sleep(Duration::from_secs(86400)).await;
                }
            });
        }

        // PDF Evening Achievement Reports (8:00 PM IST = 14:30 UTC)
        {
            let wa_pool = state.db.clone();
            let wa_client = waha_client.clone();
            let wa_app_url = config.app_url.clone();
            tokio::spawn(async move {
                let now = chrono::Utc::now();
                let today_1430 = now
                    .date_naive()
                    .and_hms_opt(14, 30, 0)
                    .expect("valid time")
                    .and_utc();
                let next_run = if now < today_1430 {
                    today_1430
                } else {
                    today_1430 + chrono::Duration::days(1)
                };
                let delay = (next_run - now).to_std().unwrap_or(Duration::from_secs(60));
                tracing::info!(
                    next_run = %next_run,
                    delay_secs = delay.as_secs(),
                    "PDF evening achievement reports scheduled (8:00 PM IST)"
                );
                tokio::time::sleep(delay).await;

                loop {
                    match taskbolt_services::jobs::report_jobs::send_evening_achievement_reports(
                        &wa_pool,
                        &wa_client,
                        &wa_app_url,
                    )
                    .await
                    {
                        Ok(r) => tracing::info!(
                            sent = r.reports_sent,
                            errs = r.errors,
                            "PDF evening achievement reports completed"
                        ),
                        Err(e) => {
                            tracing::error!(error = %e, "PDF evening achievement reports failed");
                        }
                    }
                    tokio::time::sleep(Duration::from_secs(86400)).await;
                }
            });
        }
    } else {
        tracing::info!("WhatsApp digest jobs skipped: WAHA client not configured");
    }
}

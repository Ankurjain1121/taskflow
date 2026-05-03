use std::time::Duration;

use tokio::sync::watch;

use crate::config::Config;
use crate::state::AppState;

/// Global shutdown signal for worker tasks. Flipped to `true` by the SIGTERM
/// handler in main.rs (see `install_shutdown_broadcaster`). Workers cooperatively
/// stop their loops when this changes.
pub static TWENTY_SYNC_SHUTDOWN: once_cell::sync::OnceCell<watch::Sender<bool>> =
    once_cell::sync::OnceCell::new();

#[allow(clippy::unused_async)]
pub async fn spawn_background_jobs(state: &AppState, config: &Config) {
    // Phase 6b: Twenty CRM outbound sync worker. Only starts when both
    // TWENTY_API_URL and TWENTY_API_KEY are set; otherwise the queue
    // simply accumulates jobs until configuration arrives.
    if !config.twenty_api_url.is_empty() && !config.twenty_api_key.is_empty() {
        let (shutdown_tx, shutdown_rx) = watch::channel(false);

        // Companion task: flip the shutdown flag on SIGINT/SIGTERM so the worker
        // exits its loop cleanly. Independent of axum's `with_graceful_shutdown`.
        {
            let tx = shutdown_tx.clone();
            tokio::spawn(async move {
                use tokio::signal::unix::{signal, SignalKind};
                let sigterm = signal(SignalKind::terminate()).ok();
                tokio::select! {
                    _ = tokio::signal::ctrl_c() => {},
                    () = async {
                        match sigterm {
                            Some(mut s) => { let _ = s.recv().await; }
                            None => std::future::pending::<()>().await,
                        }
                    } => {},
                }
                let _ = tx.send(true);
            });
        }

        if TWENTY_SYNC_SHUTDOWN.set(shutdown_tx).is_err() {
            tracing::warn!("TWENTY_SYNC_SHUTDOWN already initialized; skipping worker spawn");
        } else {
            let pool = state.db.clone();
            let client = taskbolt_services::TwentyClient::new(
                config.twenty_api_url.clone(),
                config.twenty_api_key.clone(),
            );
            tracing::info!("Twenty sync worker spawning (Phase 6b outbound)");
            tokio::spawn(async move {
                taskbolt_services::jobs::twenty_sync::run_twenty_sync_worker(
                    pool,
                    client,
                    shutdown_rx,
                )
                .await;
            });
        }
    } else {
        tracing::info!("Twenty sync worker disabled: TWENTY_API_URL and/or TWENTY_API_KEY not set");
    }

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

//! PDF report generation jobs — morning agenda + evening achievement
//!
//! Schedule:
//! - Morning agenda: 02:30 UTC (8:00 AM IST)
//! - Evening achievement: 14:30 UTC (8:00 PM IST)

use chrono::{DateTime, Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::notifications::whatsapp::WahaClient;
use crate::reports::pdf::{generate_and_send_pdf, PdfError};
use crate::reports::templates::{
    morning_agenda_admin, morning_agenda_employee, evening_achievement_admin,
    evening_achievement_employee, EmployeeStats, ReportTask,
};

#[derive(Debug)]
pub struct ReportJobResult {
    pub reports_sent: usize,
    pub errors: usize,
}

// ─────────────────────────────────────────────────────────────────────────────
// Morning Agenda
// ─────────────────────────────────────────────────────────────────────────────

pub async fn send_morning_agenda_reports(
    pool: &PgPool,
    waha_client: &WahaClient,
    app_url: &str,
) -> Result<ReportJobResult, PdfError> {
    let mut result = ReportJobResult { reports_sent: 0, errors: 0 };
    let now = Utc::now();

    // 1. Get all workspaces that have admins with phone numbers
    let workspaces: Vec<(Uuid, String)> = sqlx::query_as(
        r#"SELECT DISTINCT w.id, w.name
           FROM workspaces w
           JOIN workspace_members wm ON wm.workspace_id = w.id
           JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
           WHERE u.phone_number IS NOT NULL AND u.phone_number != ''
           ORDER BY w.name"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| PdfError::Chrome(e.to_string()))?;

    for (workspace_id, workspace_name) in &workspaces {
        // 2. Get all members with phone numbers in this workspace
        let members: Vec<(Uuid, String, String, String)> = sqlx::query_as(
            r#"SELECT u.id, u.name, u.phone_number, wm.role::text
               FROM workspace_members wm
               JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
               WHERE wm.workspace_id = $1
                 AND u.phone_number IS NOT NULL
                 AND u.phone_number != ''
               ORDER BY u.name"#,
        )
        .bind(workspace_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        if members.is_empty() {
            continue;
        }

        // 3. For each member, fetch their open tasks
        let mut all_employee_stats = Vec::new();

        for (user_id, user_name, phone, _role) in &members {
            let open_tasks = fetch_open_tasks(pool, *user_id, *workspace_id).await;
            let (overdue, pending) = count_task_stats(&open_tasks, now);

            let completed_yesterday = count_completed_period(
                pool, *user_id, *workspace_id, now - Duration::days(1), now,
            ).await;
            let completed_late = count_completed_late(
                pool, *user_id, *workspace_id, now - Duration::days(1), now,
            ).await;
            let subtasks_done = count_subtasks_completed(
                pool, *user_id, *workspace_id, now - Duration::days(1), now,
            ).await;

            let stats = EmployeeStats {
                name: user_name.clone(),
                completed: completed_yesterday,
                completed_late,
                overdue,
                pending,
                subtasks_completed: subtasks_done,
                open_tasks: open_tasks.clone(),
            };

            // Send individual employee agenda PDF
            if !open_tasks.is_empty() || overdue > 0 {
                let html = morning_agenda_employee(
                    user_name, &open_tasks, pending, overdue,
                );
                let filename = format!(
                    "agenda_{}_{}.pdf",
                    sanitize_filename(user_name),
                    now.format("%Y%m%d")
                );
                let caption = format!(
                    "\u{2615} Good morning, {}!\nYour daily agenda — {} tasks due today, {} overdue",
                    user_name,
                    open_tasks.iter().filter(|t| is_due_today(t, now)).count(),  // usize is fine in format!
                    overdue
                );

                match generate_and_send_pdf(
                    waha_client, phone, &html, &filename,
                    Some(&caption), app_url,
                ).await {
                    Ok(()) => result.reports_sent += 1,
                    Err(e) => {
                        tracing::error!(user = %user_name, error = %e, "Failed to send morning agenda");
                        result.errors += 1;
                    }
                }

                // Rate limit: 500ms between sends
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }

            all_employee_stats.push(stats);
        }

        // 4. Send admin report for this workspace
        let admins: Vec<&(Uuid, String, String, String)> = members
            .iter()
            .filter(|(_, _, _, role)| role == "admin" || role == "owner")
            .collect();

        if !admins.is_empty() && !all_employee_stats.is_empty() {
            let total_due_today = i64::try_from(
                all_employee_stats
                    .iter()
                    .flat_map(|e| e.open_tasks.iter())
                    .filter(|t| is_due_today(t, now))
                    .count(),
            )
            .unwrap_or(0);
            let total_overdue: i64 = all_employee_stats.iter().map(|e| e.overdue).sum();
            let total_pending: i64 = all_employee_stats.iter().map(|e| e.pending).sum();

            for (_, admin_name, admin_phone, _) in &admins {
                let html = morning_agenda_admin(
                    admin_name, workspace_name, &all_employee_stats,
                    total_due_today, total_overdue, total_pending,
                );
                let filename = format!(
                    "company_agenda_{}_{}.pdf",
                    sanitize_filename(workspace_name),
                    now.format("%Y%m%d")
                );
                let caption = format!(
                    "\u{1F4CA} Company Agenda — {}\n{} tasks today \u{2022} {} overdue \u{2022} {} pending",
                    workspace_name, total_due_today, total_overdue, total_pending
                );

                match generate_and_send_pdf(
                    waha_client, admin_phone, &html, &filename,
                    Some(&caption), app_url,
                ).await {
                    Ok(()) => result.reports_sent += 1,
                    Err(e) => {
                        tracing::error!(admin = %admin_name, error = %e, "Failed to send admin agenda");
                        result.errors += 1;
                    }
                }

                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }
    }

    tracing::info!(sent = result.reports_sent, errors = result.errors, "Morning agenda reports done");
    Ok(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// Evening Achievement
// ─────────────────────────────────────────────────────────────────────────────

pub async fn send_evening_achievement_reports(
    pool: &PgPool,
    waha_client: &WahaClient,
    app_url: &str,
) -> Result<ReportJobResult, PdfError> {
    let mut result = ReportJobResult { reports_sent: 0, errors: 0 };
    let now = Utc::now();
    let day_start = now - Duration::hours(12); // roughly today

    let workspaces: Vec<(Uuid, String)> = sqlx::query_as(
        r#"SELECT DISTINCT w.id, w.name
           FROM workspaces w
           JOIN workspace_members wm ON wm.workspace_id = w.id
           JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
           WHERE u.phone_number IS NOT NULL AND u.phone_number != ''"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| PdfError::Chrome(e.to_string()))?;

    for (workspace_id, workspace_name) in &workspaces {
        let members: Vec<(Uuid, String, String, String)> = sqlx::query_as(
            r#"SELECT u.id, u.name, u.phone_number, wm.role::text
               FROM workspace_members wm
               JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
               WHERE wm.workspace_id = $1
                 AND u.phone_number IS NOT NULL
                 AND u.phone_number != ''
               ORDER BY u.name"#,
        )
        .bind(workspace_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        if members.is_empty() {
            continue;
        }

        let mut all_employee_stats = Vec::new();

        for (user_id, user_name, phone, _role) in &members {
            let completed_tasks = fetch_completed_tasks(pool, *user_id, *workspace_id, day_start).await;
            let remaining_tasks = fetch_open_tasks(pool, *user_id, *workspace_id).await;
            let completed_late = count_completed_late(pool, *user_id, *workspace_id, day_start, now).await;
            let subtasks_done = count_subtasks_completed(pool, *user_id, *workspace_id, day_start, now).await;
            let (overdue, pending) = count_task_stats(&remaining_tasks, now);

            let total_completed = i64::try_from(completed_tasks.len()).unwrap_or(0);
            let total_remaining = i64::try_from(remaining_tasks.len()).unwrap_or(0);

            let stats = EmployeeStats {
                name: user_name.clone(),
                completed: total_completed,
                completed_late,
                overdue,
                pending,
                subtasks_completed: subtasks_done,
                open_tasks: remaining_tasks.clone(),
            };

            // Send individual employee achievement PDF
            if total_completed > 0 || !remaining_tasks.is_empty() {
                let html = evening_achievement_employee(
                    user_name, &completed_tasks, &remaining_tasks,
                    total_completed, total_remaining,
                );
                let filename = format!(
                    "achievement_{}_{}.pdf",
                    sanitize_filename(user_name),
                    now.format("%Y%m%d")
                );
                let caption = format!(
                    "\u{2705} End of Day — {}\n{} completed \u{2022} {} remaining",
                    user_name, total_completed, total_remaining
                );

                match generate_and_send_pdf(
                    waha_client, phone, &html, &filename,
                    Some(&caption), app_url,
                ).await {
                    Ok(()) => result.reports_sent += 1,
                    Err(e) => {
                        tracing::error!(user = %user_name, error = %e, "Failed to send achievement report");
                        result.errors += 1;
                    }
                }

                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }

            all_employee_stats.push(stats);
        }

        // Admin EOD report
        let admins: Vec<&(Uuid, String, String, String)> = members
            .iter()
            .filter(|(_, _, _, role)| role == "admin" || role == "owner")
            .collect();

        if !admins.is_empty() && !all_employee_stats.is_empty() {
            let total_completed: i64 = all_employee_stats.iter().map(|e| e.completed).sum();
            let total_overdue: i64 = all_employee_stats.iter().map(|e| e.overdue).sum();
            let total_pending: i64 = all_employee_stats.iter().map(|e| e.pending).sum();

            for (_, admin_name, admin_phone, _) in &admins {
                let html = evening_achievement_admin(
                    admin_name, workspace_name, &all_employee_stats,
                    total_completed, total_overdue, total_pending,
                );
                let filename = format!(
                    "eod_report_{}_{}.pdf",
                    sanitize_filename(workspace_name),
                    now.format("%Y%m%d")
                );
                let caption = format!(
                    "\u{1F4CA} End of Day Report — {}\n\u{2705} {} done \u{2022} \u{26A0}\u{FE0F} {} overdue \u{2022} \u{1F4CB} {} pending",
                    workspace_name, total_completed, total_overdue, total_pending
                );

                match generate_and_send_pdf(
                    waha_client, admin_phone, &html, &filename,
                    Some(&caption), app_url,
                ).await {
                    Ok(()) => result.reports_sent += 1,
                    Err(e) => {
                        tracing::error!(admin = %admin_name, error = %e, "Failed to send admin EOD report");
                        result.errors += 1;
                    }
                }

                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }
    }

    tracing::info!(sent = result.reports_sent, errors = result.errors, "Evening achievement reports done");
    Ok(result)
}

// ─────────────────────────────────────────────────────────────────────────────
// DB query helpers
// ─────────────────────────────────────────────────────────────────────────────

async fn fetch_open_tasks(pool: &PgPool, user_id: Uuid, workspace_id: Uuid) -> Vec<ReportTask> {
    #[allow(clippy::type_complexity)]
    let rows: Vec<(String, String, Option<DateTime<Utc>>, String, String, bool)> = sqlx::query_as(
        r#"SELECT t.title, COALESCE(p.name, ''), t.due_date,
                  LOWER(t.priority::text), COALESCE(ps.name, ''),
                  (t.parent_task_id IS NOT NULL)
           FROM task_assignees ta
           JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
           JOIN projects p ON p.id = t.project_id AND p.workspace_id = $2 AND p.deleted_at IS NULL
           LEFT JOIN project_statuses ps ON ps.id = t.status_id
           WHERE ta.user_id = $1
             AND NOT EXISTS (
                 SELECT 1 FROM project_statuses ps2
                 WHERE ps2.id = t.status_id AND ps2.type = 'done'
             )
           ORDER BY t.due_date ASC NULLS LAST
           LIMIT 20"#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|(title, project_name, due_date, priority, status, is_subtask)| ReportTask {
            title,
            project_name,
            due_date,
            priority,
            status,
            is_subtask,
            completed_at: None,
        })
        .collect()
}

async fn fetch_completed_tasks(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Uuid,
    since: DateTime<Utc>,
) -> Vec<ReportTask> {
    #[allow(clippy::type_complexity)]
    let rows: Vec<(String, String, Option<DateTime<Utc>>, String, String, bool)> = sqlx::query_as(
        r#"SELECT t.title, COALESCE(p.name, ''), t.due_date,
                  LOWER(t.priority::text), COALESCE(ps.name, ''),
                  (t.parent_task_id IS NOT NULL)
           FROM task_assignees ta
           JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
           JOIN projects p ON p.id = t.project_id AND p.workspace_id = $2 AND p.deleted_at IS NULL
           JOIN project_statuses ps ON ps.id = t.status_id AND ps.type = 'done'
           JOIN activity_log al ON al.entity_id = t.id
               AND al.entity_type = 'task'
               AND al.action = 'moved'
               AND al.created_at >= $3
           WHERE ta.user_id = $1
           ORDER BY al.created_at DESC
           LIMIT 20"#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|(title, project_name, due_date, priority, status, is_subtask)| ReportTask {
            title,
            project_name,
            due_date,
            priority,
            status,
            is_subtask,
            completed_at: None,
        })
        .collect()
}

async fn count_completed_period(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Uuid,
    since: DateTime<Utc>,
    until: DateTime<Utc>,
) -> i64 {
    sqlx::query_scalar(
        r#"SELECT COUNT(DISTINCT t.id)
           FROM task_assignees ta
           JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
           JOIN projects p ON p.id = t.project_id AND p.workspace_id = $2 AND p.deleted_at IS NULL
           JOIN project_statuses ps ON ps.id = t.status_id AND ps.type = 'done'
           JOIN activity_log al ON al.entity_id = t.id
               AND al.entity_type = 'task' AND al.action = 'moved'
               AND al.created_at >= $3 AND al.created_at < $4
           WHERE ta.user_id = $1"#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .bind(since)
    .bind(until)
    .fetch_one(pool)
    .await
    .unwrap_or(0)
}

async fn count_completed_late(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Uuid,
    since: DateTime<Utc>,
    until: DateTime<Utc>,
) -> i64 {
    // Tasks completed after their due date
    sqlx::query_scalar(
        r#"SELECT COUNT(DISTINCT t.id)
           FROM task_assignees ta
           JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
           JOIN projects p ON p.id = t.project_id AND p.workspace_id = $2 AND p.deleted_at IS NULL
           JOIN project_statuses ps ON ps.id = t.status_id AND ps.type = 'done'
           JOIN activity_log al ON al.entity_id = t.id
               AND al.entity_type = 'task' AND al.action = 'moved'
               AND al.created_at >= $3 AND al.created_at < $4
           WHERE ta.user_id = $1
             AND t.due_date IS NOT NULL
             AND al.created_at > t.due_date"#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .bind(since)
    .bind(until)
    .fetch_one(pool)
    .await
    .unwrap_or(0)
}

async fn count_subtasks_completed(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Uuid,
    since: DateTime<Utc>,
    until: DateTime<Utc>,
) -> i64 {
    sqlx::query_scalar(
        r#"SELECT COUNT(DISTINCT t.id)
           FROM task_assignees ta
           JOIN tasks t ON t.id = ta.task_id AND t.deleted_at IS NULL
           JOIN projects p ON p.id = t.project_id AND p.workspace_id = $2 AND p.deleted_at IS NULL
           JOIN project_statuses ps ON ps.id = t.status_id AND ps.type = 'done'
           JOIN activity_log al ON al.entity_id = t.id
               AND al.entity_type = 'task' AND al.action = 'moved'
               AND al.created_at >= $3 AND al.created_at < $4
           WHERE ta.user_id = $1
             AND t.parent_task_id IS NOT NULL"#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .bind(since)
    .bind(until)
    .fetch_one(pool)
    .await
    .unwrap_or(0)
}

fn count_task_stats(tasks: &[ReportTask], now: DateTime<Utc>) -> (i64, i64) {
    let overdue = i64::try_from(
        tasks.iter().filter(|t| t.due_date.is_some_and(|d| d < now)).count(),
    )
    .unwrap_or(0);
    let pending = i64::try_from(tasks.len()).unwrap_or(0);
    (overdue, pending)
}

fn is_due_today(task: &ReportTask, now: DateTime<Utc>) -> bool {
    task.due_date.is_some_and(|d| d.date_naive() == now.date_naive())
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>()
        .to_lowercase()
}

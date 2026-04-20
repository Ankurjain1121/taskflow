//! HTML report templates for PDF generation
//!
//! Generates branded, colorful HTML with SVG charts for:
//! - Morning Agenda (employee + admin variants)
//! - Evening Achievement (employee + admin variants)

use std::fmt::Write as _;

use chrono::{DateTime, Utc};

/// A single task entry for reports
#[derive(Debug, Clone)]
pub struct ReportTask {
    pub title: String,
    pub project_name: String,
    pub due_date: Option<DateTime<Utc>>,
    pub priority: String,
    pub status: String,
    pub is_subtask: bool,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Per-employee stats for admin reports
#[derive(Debug, Clone)]
pub struct EmployeeStats {
    pub name: String,
    pub completed: i64,
    pub completed_late: i64,
    pub overdue: i64,
    pub pending: i64,
    pub subtasks_completed: i64,
    /// Open tasks assigned to this employee (for detailed admin view)
    pub open_tasks: Vec<ReportTask>,
}

// Brand colors (Warm Earth theme)
const PRIMARY: &str = "#A0663E";
const PRIMARY_DARK: &str = "#7A4D2E";
const ACCENT: &str = "#BF7B54";
const _BG_WARM: &str = "#FAF7F2";
const SURFACE: &str = "#EDE9DD";
const TEXT_PRIMARY: &str = "#2C2316";
const TEXT_SECONDARY: &str = "#6B5D4F";
const GREEN: &str = "#059669";
const RED: &str = "#DC2626";
const AMBER: &str = "#D97706";
const BLUE: &str = "#2563EB";

fn css_base() -> &'static str {
    r#"
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
        size: A4;
        margin: 24px 32px;
    }
    body {
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        background: #FAF7F2;
        color: #2C2316;
        line-height: 1.5;
        padding: 0;
    }
    .page {
        width: 100%;
        padding: 0;
        background: #FAF7F2;
    }
    .employee-section {
        page-break-inside: avoid;
        break-inside: avoid;
        margin-top: 16px;
    }
    .no-break {
        page-break-inside: avoid;
        break-inside: avoid;
    }
    "#
}

fn header_html(title: &str, subtitle: &str, date_str: &str) -> String {
    format!(
        r#"
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; background: linear-gradient(135deg, {PRIMARY} 0%, {PRIMARY_DARK} 100%); border-radius: 16px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <svg width="32" height="32" viewBox="0 0 192 192">
                        <text x="96" y="130" text-anchor="middle" font-family="system-ui" font-size="100" font-weight="700" fill="white">TB</text>
                    </svg>
                </div>
                <div>
                    <h1 style="color: white; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">{title}</h1>
                    <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 2px;">{subtitle}</p>
                </div>
            </div>
            <div style="text-align: right;">
                <p style="color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600;">{date_str}</p>
                <p style="color: rgba(255,255,255,0.6); font-size: 11px; margin-top: 2px;">TaskBolt Report</p>
            </div>
        </div>
        "#
    )
}

fn stat_card(label: &str, value: i64, color: &str, icon: &str) -> String {
    format!(
        r#"
        <div style="flex: 1; background: white; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 4px solid {color};">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span style="font-size: 18px;">{icon}</span>
                <span style="font-size: 12px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">{label}</span>
            </div>
            <p style="font-size: 28px; font-weight: 700; color: {color};">{value}</p>
        </div>
        "#
    )
}

fn priority_badge(priority: &str) -> String {
    let (color, bg) = match priority {
        "urgent" => (RED, "#FEE2E2"),
        "high" => (AMBER, "#FEF3C7"),
        "medium" => (BLUE, "#DBEAFE"),
        "low" => (GREEN, "#D1FAE5"),
        _ => (TEXT_SECONDARY, SURFACE),
    };
    format!(
        r#"<span style="display: inline-block; padding: 2px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; color: {}; background: {}; text-transform: capitalize;">{}</span>"#,
        color, bg, priority
    )
}

fn svg_donut_chart(completed: i64, completed_late: i64, pending: i64, overdue: i64) -> String {
    let total = (completed + completed_late + pending + overdue).max(1) as f64;
    let circumference = 2.0 * std::f64::consts::PI * 60.0;

    let c_len = (completed as f64 / total) * circumference;
    let cl_len = (completed_late as f64 / total) * circumference;
    let p_len = (pending as f64 / total) * circumference;
    let o_len = (overdue as f64 / total) * circumference;

    let c_offset = 0.0;
    let cl_offset = -c_len;
    let p_offset = -(c_len + cl_len);
    let o_offset = -(c_len + cl_len + p_len);

    let total_done = completed + completed_late;

    let mut svg = String::from(r#"<svg width="160" height="160" viewBox="0 0 160 160">"#);
    let _ = write!(
        svg,
        r##"<circle cx="80" cy="80" r="60" fill="none" stroke="#E5E1D8" stroke-width="20"/>"##
    );
    let _ = write!(
        svg,
        r#"<circle cx="80" cy="80" r="60" fill="none" stroke="{}" stroke-width="20" stroke-dasharray="{} {}" stroke-dashoffset="{}" transform="rotate(-90 80 80)" stroke-linecap="round"/>"#,
        GREEN, c_len, circumference, c_offset
    );
    let _ = write!(
        svg,
        r#"<circle cx="80" cy="80" r="60" fill="none" stroke="{}" stroke-width="20" stroke-dasharray="{} {}" stroke-dashoffset="{}" transform="rotate(-90 80 80)"/>"#,
        AMBER, cl_len, circumference, cl_offset
    );
    let _ = write!(
        svg,
        r#"<circle cx="80" cy="80" r="60" fill="none" stroke="{}" stroke-width="20" stroke-dasharray="{} {}" stroke-dashoffset="{}" transform="rotate(-90 80 80)"/>"#,
        BLUE, p_len, circumference, p_offset
    );
    let _ = write!(
        svg,
        r#"<circle cx="80" cy="80" r="60" fill="none" stroke="{}" stroke-width="20" stroke-dasharray="{} {}" stroke-dashoffset="{}" transform="rotate(-90 80 80)"/>"#,
        RED, o_len, circumference, o_offset
    );
    let _ = write!(
        svg,
        r#"<text x="80" y="75" text-anchor="middle" font-size="24" font-weight="700" fill="{}">{}</text>"#,
        TEXT_PRIMARY, total_done
    );
    let _ = write!(
        svg,
        r#"<text x="80" y="95" text-anchor="middle" font-size="11" fill="{}">completed</text>"#,
        TEXT_SECONDARY
    );
    let _ = write!(svg, "</svg>");
    svg
}

fn svg_bar_chart(employees: &[EmployeeStats]) -> String {
    if employees.is_empty() {
        return String::new();
    }

    let max_val = employees
        .iter()
        .map(|e| e.completed + e.pending + e.overdue)
        .max()
        .unwrap_or(1)
        .max(1) as f64;

    let bar_height = 28;
    let gap = 8;
    let chart_height = employees.len() * (bar_height + gap) + 20;
    let chart_width = 500;
    let label_width = 120;
    let bar_area = chart_width - label_width - 40;

    let mut svg = format!(
        r#"<svg width="{chart_width}" height="{chart_height}" viewBox="0 0 {chart_width} {chart_height}">"#
    );

    for (i, emp) in employees.iter().enumerate() {
        let y = (i * (bar_height + gap) + 10) as f64;
        let completed_w = (emp.completed as f64 / max_val * bar_area as f64).max(0.0);
        let overdue_w = (emp.overdue as f64 / max_val * bar_area as f64).max(0.0);
        let pending_w = (emp.pending as f64 / max_val * bar_area as f64).max(0.0);

        // Name label
        let _ = write!(
            svg,
            r#"<text x="{label_width}" y="{}" text-anchor="end" font-size="12" font-weight="500" fill="{TEXT_PRIMARY}" dominant-baseline="central">{}</text>"#,
            y + bar_height as f64 / 2.0,
            emp.name
        );

        // Stacked bars: completed (green) + overdue (red) + pending (blue)
        let bar_x = (label_width + 12) as f64;
        let _ = write!(
            svg,
            r#"<rect x="{bar_x}" y="{y}" width="{completed_w}" height="{bar_height}" rx="4" fill="{GREEN}" opacity="0.85"/>"#
        );
        let _ = write!(
            svg,
            r#"<rect x="{}" y="{y}" width="{overdue_w}" height="{bar_height}" rx="4" fill="{RED}" opacity="0.85"/>"#,
            bar_x + completed_w
        );
        let _ = write!(
            svg,
            r#"<rect x="{}" y="{y}" width="{pending_w}" height="{bar_height}" rx="4" fill="{BLUE}" opacity="0.3"/>"#,
            bar_x + completed_w + overdue_w
        );

        // Value label
        let total = emp.completed + emp.overdue + emp.pending;
        let _ = write!(
            svg,
            r#"<text x="{}" y="{}" font-size="11" font-weight="600" fill="{TEXT_SECONDARY}" dominant-baseline="central">{}</text>"#,
            bar_x + completed_w + overdue_w + pending_w + 8.0,
            y + bar_height as f64 / 2.0,
            total
        );
    }

    let _ = write!(svg, "</svg>");
    svg
}

fn chart_legend() -> String {
    let mut s = String::from(
        r#"<div style="display: flex; gap: 16px; margin-top: 8px; justify-content: center; flex-wrap: wrap;">"#,
    );
    let items = [
        (GREEN, "On Time"),
        (AMBER, "Completed Late"),
        (RED, "Overdue"),
        (BLUE, "Pending"),
    ];
    for (color, label) in items {
        let opacity = if color == BLUE { " opacity: 0.4;" } else { "" };
        let _ = write!(
            s,
            r#"<div style="display: flex; align-items: center; gap: 6px;"><div style="width: 12px; height: 12px; border-radius: 3px; background: {};{}"></div><span style="font-size: 11px; color: {};">{}</span></div>"#,
            color, opacity, TEXT_SECONDARY, label
        );
    }
    s.push_str("</div>");
    s
}

fn format_time_ist(dt: &DateTime<Utc>) -> String {
    let ist = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60).expect("valid IST offset");
    let dt_ist = dt.with_timezone(&ist);
    dt_ist.format("%I:%M %p").to_string()
}

fn format_date_ist(dt: &DateTime<Utc>) -> String {
    let ist = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60).expect("valid IST offset");
    let dt_ist = dt.with_timezone(&ist);
    dt_ist.format("%B %d, %Y").to_string()
}

fn time_remaining_html(due: &DateTime<Utc>) -> String {
    let now = Utc::now();
    let diff = due.signed_duration_since(now);
    if diff.num_seconds() < 0 {
        let mins = (-diff).num_minutes();
        if mins > 60 {
            format!(
                r#"<span style="color: {}; font-weight: 600;">{}h overdue</span>"#,
                RED,
                (-diff).num_hours()
            )
        } else {
            format!(
                r#"<span style="color: {}; font-weight: 600;">{}m overdue</span>"#,
                RED, mins
            )
        }
    } else if diff.num_hours() < 2 {
        format!(
            r#"<span style="color: {}; font-weight: 600;">{}m left</span>"#,
            AMBER,
            diff.num_minutes()
        )
    } else {
        format!(
            r#"<span style="color: {};">{}h left</span>"#,
            TEXT_SECONDARY,
            diff.num_hours()
        )
    }
}

// =============================================================================
// Morning Agenda — Employee
// =============================================================================

pub fn morning_agenda_employee(
    employee_name: &str,
    tasks: &[ReportTask],
    total_pending: i64,
    total_overdue: i64,
) -> String {
    let now = Utc::now();
    let date_str = format_date_ist(&now);
    let due_today = i64::try_from(tasks.len()).unwrap_or(0);

    let mut html = format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8"><style>{}</style></head><body><div class="page">"#,
        css_base()
    );

    // Header
    let _ = write!(
        html,
        "{}",
        header_html("Daily Agenda", employee_name, &date_str)
    );

    // Stats row
    let _ = write!(
        html,
        r#"<div style="display: flex; gap: 12px; margin-bottom: 24px;">"#
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Due Today", due_today, ACCENT, "\u{1F4CB}")
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Overdue", total_overdue, RED, "\u{26A0}\u{FE0F}")
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Total Pending", total_pending, BLUE, "\u{1F4CA}")
    );
    let _ = write!(html, "</div>");

    // Task table
    let _ = write!(
        html,
        r#"
        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <h3 style="font-size: 15px; font-weight: 700; color: {PRIMARY}; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">{}</span> Today's Tasks
            </h3>
            <table style="width: 100%; border-collapse: separate; border-spacing: 0 6px;">
                <thead>
                    <tr style="text-align: left;">
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Task</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Project</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Due Time</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Priority</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Remaining</th>
                    </tr>
                </thead>
                <tbody>
    "#,
        "\u{23F0}"
    );

    for task in tasks {
        let subtask_prefix = if task.is_subtask { "\u{2514} " } else { "" };
        let row_bg = if task.due_date.is_some_and(|d| d < now) {
            "#FEF2F2"
        } else {
            SURFACE
        };
        let time_str = match task.due_date.as_ref() {
            Some(d) => format_time_ist(d),
            None => "—".to_string(),
        };
        let remaining = match task.due_date.as_ref() {
            Some(d) => time_remaining_html(d),
            None => "—".to_string(),
        };

        let _ = write!(
            html,
            r#"
            <tr style="background: {row_bg}; border-radius: 8px;">
                <td style="padding: 10px 12px; border-radius: 8px 0 0 8px; font-size: 13px; font-weight: 500;">{subtask_prefix}{}</td>
                <td style="padding: 10px 12px; font-size: 12px; color: {TEXT_SECONDARY};">{}</td>
                <td style="padding: 10px 12px; font-size: 13px; font-weight: 600;">{time_str}</td>
                <td style="padding: 10px 12px;">{}</td>
                <td style="padding: 10px 12px; border-radius: 0 8px 8px 0; font-size: 12px;">{remaining}</td>
            </tr>
        "#,
            task.title,
            task.project_name,
            priority_badge(&task.priority)
        );
    }

    let _ = write!(html, "</tbody></table></div>");

    // Footer
    let _ = write!(
        html,
        r#"
        <div style="margin-top: 24px; text-align: center; padding: 12px; color: {TEXT_SECONDARY}; font-size: 11px;">
            Generated by TaskBolt &bull; {date_str}
        </div>
    </div></body></html>"#
    );

    html
}

// =============================================================================
// Morning Agenda — Admin (company-wide)
// =============================================================================

pub fn morning_agenda_admin(
    admin_name: &str,
    workspace_name: &str,
    employees: &[EmployeeStats],
    total_tasks_today: i64,
    total_overdue: i64,
    total_pending: i64,
) -> String {
    let now = Utc::now();
    let date_str = format_date_ist(&now);
    let total_completed: i64 = employees.iter().map(|e| e.completed).sum();
    let total_completed_late: i64 = employees.iter().map(|e| e.completed_late).sum();

    let mut html = format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8"><style>{}</style></head><body><div class="page">"#,
        css_base()
    );

    // Header
    let _ = write!(
        html,
        "{}",
        header_html(
            &format!("Company Agenda — {}", workspace_name),
            admin_name,
            &date_str,
        )
    );

    // Stats row
    let _ = write!(
        html,
        r#"<div style="display: flex; gap: 12px; margin-bottom: 24px;">"#
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Due Today", total_tasks_today, ACCENT, "\u{1F4CB}")
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Overdue", total_overdue, RED, "\u{26A0}\u{FE0F}")
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Pending", total_pending, BLUE, "\u{1F4CA}")
    );
    let _ = write!(html, "</div>");

    // Charts section
    let _ = write!(
        html,
        r#"
        <div style="display: flex; gap: 20px; margin-bottom: 24px;">
            <div style="flex: 1; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-align: center;">
                <h4 style="font-size: 13px; font-weight: 600; color: {TEXT_SECONDARY}; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Task Status</h4>
                {}
                {}
            </div>
            <div style="flex: 2; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                <h4 style="font-size: 13px; font-weight: 600; color: {TEXT_SECONDARY}; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Tasks per Employee</h4>
                {}
                {}
            </div>
        </div>
    "#,
        svg_donut_chart(
            total_completed,
            total_completed_late,
            total_pending,
            total_overdue
        ),
        chart_legend(),
        svg_bar_chart(employees),
        chart_legend(),
    );

    // Employee table
    let _ = write!(
        html,
        r#"
        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <h3 style="font-size: 15px; font-weight: 700; color: {PRIMARY}; margin-bottom: 16px;">{} Team Overview</h3>
            <table style="width: 100%; border-collapse: separate; border-spacing: 0 6px;">
                <thead>
                    <tr style="text-align: left;">
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Employee</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: center;">Completed</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: center;">Overdue</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: center;">Pending</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Status</th>
                    </tr>
                </thead>
                <tbody>
    "#,
        "\u{1F465}"
    );

    for emp in employees {
        let status_icon = if emp.overdue > 0 {
            format!(
                r#"<span style="color: {};">{}</span>"#,
                RED, "\u{1F534} Needs attention"
            )
        } else if emp.completed > 0 {
            format!(
                r#"<span style="color: {};">{}</span>"#,
                GREEN, "\u{1F7E2} On track"
            )
        } else {
            format!(
                r#"<span style="color: {};">{}</span>"#,
                TEXT_SECONDARY, "\u{26AA} No activity"
            )
        };

        let _ = write!(
            html,
            r#"
            <tr style="background: {SURFACE}; border-radius: 8px;">
                <td style="padding: 10px 12px; border-radius: 8px 0 0 8px; font-size: 13px; font-weight: 600;">{}</td>
                <td style="padding: 10px 12px; text-align: center; font-size: 14px; font-weight: 700; color: {GREEN};">{}</td>
                <td style="padding: 10px 12px; text-align: center; font-size: 14px; font-weight: 700; color: {};">{}</td>
                <td style="padding: 10px 12px; text-align: center; font-size: 14px; font-weight: 700; color: {BLUE};">{}</td>
                <td style="padding: 10px 12px; border-radius: 0 8px 8px 0; font-size: 12px;">{status_icon}</td>
            </tr>
        "#,
            emp.name,
            emp.completed,
            if emp.overdue > 0 { RED } else { TEXT_SECONDARY },
            emp.overdue,
            emp.pending,
        );
    }

    let _ = write!(html, "</tbody></table></div>");

    // Detailed open tasks per employee
    for emp in employees {
        if emp.open_tasks.is_empty() {
            continue;
        }
        let _ = write!(
            html,
            r#"
            <div class="employee-section" style="background: white; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-top: 16px;">
                <h4 style="font-size: 14px; font-weight: 700; color: {}; margin-bottom: 12px; border-bottom: 2px solid {}; padding-bottom: 8px;">
                    {} {} — Open Tasks ({})
                </h4>
        "#,
            PRIMARY,
            SURFACE,
            "\u{1F464}",
            emp.name,
            emp.open_tasks.len()
        );

        for task in &emp.open_tasks {
            let ist = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60).expect("valid IST offset");
            let is_overdue = task.due_date.is_some_and(|d| d < now);
            let row_bg = if is_overdue { "#FEF2F2" } else { SURFACE };
            let border_color = if is_overdue { RED } else { "transparent" };

            let due_str = match &task.due_date {
                Some(d) => {
                    let d_ist = d.with_timezone(&ist);
                    d_ist.format("%b %d, %I:%M %p").to_string()
                }
                None => "No due date".to_string(),
            };

            let overdue_badge = if is_overdue {
                format!(
                    r#"<span style="background: {}; color: white; padding: 1px 8px; border-radius: 100px; font-size: 10px; font-weight: 700; margin-left: 8px;">OVERDUE</span>"#,
                    RED
                )
            } else {
                String::new()
            };

            let subtask_marker = if task.is_subtask { "\u{2514} " } else { "" };

            let _ = write!(
                html,
                r#"
                <div style="display: flex; align-items: center; padding: 8px 12px; background: {row_bg}; border-radius: 8px; margin-bottom: 4px; border-left: 3px solid {border_color};">
                    <div style="flex: 1;">
                        <span style="font-size: 13px; font-weight: 500;">{subtask_marker}{}</span>{overdue_badge}
                        <span style="font-size: 11px; color: {}; margin-left: 8px;">{}</span>
                    </div>
                    <div style="text-align: right; min-width: 130px;">
                        <span style="font-size: 12px; font-weight: 600; color: {};">{due_str}</span>
                    </div>
                    <div style="min-width: 70px; text-align: right;">{}</div>
                </div>
            "#,
                task.title,
                TEXT_SECONDARY,
                task.project_name,
                if is_overdue { RED } else { TEXT_PRIMARY },
                priority_badge(&task.priority),
            );
        }

        let _ = write!(html, "</div>");
    }

    // Footer
    let _ = write!(
        html,
        r#"
        <div style="margin-top: 24px; text-align: center; padding: 12px; color: {TEXT_SECONDARY}; font-size: 11px;">
            Generated by TaskBolt &bull; {date_str}
        </div>
    </div></body></html>"#
    );

    html
}

// =============================================================================
// Evening Achievement — Employee
// =============================================================================

pub fn evening_achievement_employee(
    employee_name: &str,
    completed_tasks: &[ReportTask],
    remaining_tasks: &[ReportTask],
    total_completed: i64,
    total_remaining: i64,
) -> String {
    let now = Utc::now();
    let date_str = format_date_ist(&now);

    let mut html = format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8"><style>{}</style></head><body><div class="page">"#,
        css_base()
    );

    // Header
    let _ = write!(
        html,
        "{}",
        header_html("Daily Achievement", employee_name, &date_str)
    );

    // Stats + donut
    let _ = write!(
        html,
        r#"<div style="display: flex; gap: 16px; margin-bottom: 24px;">"#
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Completed", total_completed, GREEN, "\u{2705}")
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Remaining", total_remaining, AMBER, "\u{1F4CB}")
    );
    let _ = write!(
        html,
        r#"
        <div style="flex: 1; background: white; border-radius: 12px; padding: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center;">
            {}
        </div>
    "#,
        svg_donut_chart(total_completed, 0, total_remaining, 0)
    );
    let _ = write!(html, "</div>");

    // Completed tasks
    if !completed_tasks.is_empty() {
        let _ = write!(
            html,
            r#"
            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 16px;">
                <h3 style="font-size: 15px; font-weight: 700; color: {GREEN}; margin-bottom: 16px;">{} Completed Today</h3>
        "#,
            "\u{2705}"
        );

        for task in completed_tasks {
            let subtask_prefix = if task.is_subtask { "\u{2514} " } else { "" };
            let _ = write!(
                html,
                r#"
                <div style="display: flex; align-items: center; padding: 8px 12px; background: #F0FDF4; border-radius: 8px; margin-bottom: 6px;">
                    <span style="color: {GREEN}; margin-right: 10px; font-size: 16px;">{}</span>
                    <div style="flex: 1;">
                        <span style="font-size: 13px; font-weight: 500; text-decoration: line-through; color: {TEXT_SECONDARY};">{subtask_prefix}{}</span>
                        <span style="font-size: 11px; color: {TEXT_SECONDARY}; margin-left: 8px;">{}</span>
                    </div>
                </div>
            "#,
                "\u{2713}", task.title, task.project_name
            );
        }

        let _ = write!(html, "</div>");
    }

    // Remaining tasks
    if !remaining_tasks.is_empty() {
        let _ = write!(
            html,
            r#"
            <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                <h3 style="font-size: 15px; font-weight: 700; color: {AMBER}; margin-bottom: 16px;">{} Still Pending</h3>
        "#,
            "\u{1F4CB}"
        );

        for task in remaining_tasks.iter().take(10) {
            let overdue_badge = task.due_date
                .filter(|d| *d < now)
                .map(|_| format!(r#" <span style="color: {}; font-size: 10px; font-weight: 600;">OVERDUE</span>"#, RED))
                .unwrap_or_default();

            let _ = write!(
                html,
                r#"
                <div style="display: flex; align-items: center; padding: 8px 12px; background: {SURFACE}; border-radius: 8px; margin-bottom: 6px;">
                    <span style="color: {AMBER}; margin-right: 10px; font-size: 14px;">{}</span>
                    <div style="flex: 1;">
                        <span style="font-size: 13px; font-weight: 500;">{}</span>{overdue_badge}
                        <span style="font-size: 11px; color: {TEXT_SECONDARY}; margin-left: 8px;">{}</span>
                    </div>
                    {}
                </div>
            "#,
                "\u{25CB}",
                task.title,
                task.project_name,
                priority_badge(&task.priority)
            );
        }

        let _ = write!(html, "</div>");
    }

    // Footer
    let _ = write!(
        html,
        r#"
        <div style="margin-top: 24px; text-align: center; padding: 12px; color: {TEXT_SECONDARY}; font-size: 11px;">
            Generated by TaskBolt &bull; {date_str}
        </div>
    </div></body></html>"#
    );

    html
}

// =============================================================================
// Evening Achievement — Admin (company health)
// =============================================================================

pub fn evening_achievement_admin(
    admin_name: &str,
    workspace_name: &str,
    employees: &[EmployeeStats],
    total_completed: i64,
    total_overdue: i64,
    total_pending: i64,
) -> String {
    // Reuse the admin morning layout with evening-specific header
    let now = Utc::now();
    let date_str = format_date_ist(&now);
    let total_subtasks: i64 = employees.iter().map(|e| e.subtasks_completed).sum();
    let total_completed_late: i64 = employees.iter().map(|e| e.completed_late).sum();

    let mut html = format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8"><style>{}</style></head><body><div class="page">"#,
        css_base()
    );

    // Header
    let _ = write!(
        html,
        "{}",
        header_html(
            &format!("End of Day Report — {}", workspace_name),
            admin_name,
            &date_str,
        )
    );

    // Stats row
    let _ = write!(
        html,
        r#"<div style="display: flex; gap: 12px; margin-bottom: 24px;">"#
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Completed", total_completed, GREEN, "\u{2705}")
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Overdue", total_overdue, RED, "\u{26A0}\u{FE0F}")
    );
    let _ = write!(
        html,
        "{}",
        stat_card("Pending", total_pending, BLUE, "\u{1F4CA}")
    );
    if total_subtasks > 0 {
        let _ = write!(
            html,
            "{}",
            stat_card("Subtasks Done", total_subtasks, ACCENT, "\u{1F517}")
        );
    }
    let _ = write!(html, "</div>");

    // Charts
    let _ = write!(
        html,
        r#"
        <div style="display: flex; gap: 20px; margin-bottom: 24px;">
            <div style="flex: 1; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-align: center;">
                <h4 style="font-size: 13px; font-weight: 600; color: {TEXT_SECONDARY}; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Completion Status</h4>
                {}
                {}
            </div>
            <div style="flex: 2; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                <h4 style="font-size: 13px; font-weight: 600; color: {TEXT_SECONDARY}; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Employee Performance</h4>
                {}
                {}
            </div>
        </div>
    "#,
        svg_donut_chart(
            total_completed,
            total_completed_late,
            total_pending,
            total_overdue
        ),
        chart_legend(),
        svg_bar_chart(employees),
        chart_legend(),
    );

    // Employee breakdown table
    let _ = write!(
        html,
        r#"
        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <h3 style="font-size: 15px; font-weight: 700; color: {PRIMARY}; margin-bottom: 16px;">{} Team Performance</h3>
            <table style="width: 100%; border-collapse: separate; border-spacing: 0 6px;">
                <thead>
                    <tr>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: left;">Employee</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: center;">Done</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: center;">Subtasks</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: center;">Overdue</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; text-align: center;">Pending</th>
                        <th style="padding: 8px 12px; font-size: 11px; color: {TEXT_SECONDARY}; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Status</th>
                    </tr>
                </thead>
                <tbody>
    "#,
        "\u{1F4CA}"
    );

    for emp in employees {
        let status = if emp.overdue > 0 {
            format!(
                r#"<span style="color: {RED}; font-weight: 600;">{} Needs attention</span>"#,
                "\u{1F534}"
            )
        } else if emp.completed > 0 {
            format!(
                r#"<span style="color: {GREEN}; font-weight: 600;">{} On track</span>"#,
                "\u{1F7E2}"
            )
        } else {
            format!(
                r#"<span style="color: {TEXT_SECONDARY};">{} Idle</span>"#,
                "\u{26AA}"
            )
        };

        let _ = write!(
            html,
            r#"
            <tr style="background: {SURFACE}; border-radius: 8px;">
                <td style="padding: 10px 12px; border-radius: 8px 0 0 8px; font-size: 13px; font-weight: 600;">{}</td>
                <td style="padding: 10px 12px; text-align: center; font-size: 16px; font-weight: 700; color: {GREEN};">{}</td>
                <td style="padding: 10px 12px; text-align: center; font-size: 14px; color: {ACCENT};">{}</td>
                <td style="padding: 10px 12px; text-align: center; font-size: 16px; font-weight: 700; color: {};">{}</td>
                <td style="padding: 10px 12px; text-align: center; font-size: 14px; color: {BLUE};">{}</td>
                <td style="padding: 10px 12px; border-radius: 0 8px 8px 0; font-size: 12px;">{status}</td>
            </tr>
        "#,
            emp.name,
            emp.completed,
            emp.subtasks_completed,
            if emp.overdue > 0 { RED } else { TEXT_SECONDARY },
            emp.overdue,
            emp.pending,
        );
    }

    let _ = write!(html, "</tbody></table></div>");

    // Footer
    let _ = write!(
        html,
        r#"
        <div style="margin-top: 24px; text-align: center; padding: 12px; color: {TEXT_SECONDARY}; font-size: 11px;">
            Generated by TaskBolt &bull; {date_str}
        </div>
    </div></body></html>"#
    );

    html
}

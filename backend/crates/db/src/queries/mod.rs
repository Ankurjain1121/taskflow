pub mod activity_log;
pub mod archive;
pub mod attachments;
pub mod auth;
pub mod automation_evaluation;
pub mod automation_templates;
pub mod automations;
pub mod batch_my_tasks;
pub mod bulk_operations;
pub mod comments;
pub mod custom_fields;
pub mod dashboard;
pub mod dashboard_charts;
pub mod dependencies;
pub mod eisenhower;
pub mod favorites;
pub mod invitations;
pub mod issues;
pub mod membership;
pub mod metrics;
pub mod milestones;
pub mod my_tasks;
pub mod notification_deliveries;
pub mod notification_preferences;
pub mod notifications;
pub mod personal_board;
pub mod portfolio;
pub mod positions;
pub mod project_groups;
pub mod project_overview;
pub mod project_shares;
pub mod project_statuses;
pub mod project_templates;
pub mod projects;
pub mod recent_items;
pub mod recurring;
pub mod recurring_generation;
pub mod reports;
pub mod saved_views;
pub mod search;
pub mod task_assignments;
pub mod task_budgets;
pub mod task_bulk;
pub mod task_groups;
pub mod task_issue_links;
pub mod task_reminders;
pub mod task_snooze;
pub mod task_templates;
pub mod task_views;
pub mod task_watchers;
pub mod tasks;
pub mod tasks_helpers;
pub mod team_overview;
pub mod themes;
pub mod time_entries;
pub mod user_preferences;
pub mod webhooks;
pub mod workspace_api_keys;
pub mod workspace_job_roles;
pub mod workspace_roles;
pub mod workspace_tasks;
pub mod workspaces;

#[cfg(test)]
mod integration_tests;
#[cfg(test)]
mod integration_tests_advanced;
#[cfg(test)]
mod integration_tests_extra;
#[cfg(test)]
mod integration_tests_favorites;
#[cfg(test)]
mod integration_tests_tasks;
#[cfg(test)]
mod integration_tests_views;
#[cfg(test)]
mod integration_tests_workspace;
#[cfg(test)]
mod test_helpers;

// ── Explicit re-exports ────────────────────────────────────────────────────

// membership
pub use membership::{filter_project_members, verify_project_membership};

// activity_log
pub use activity_log::{
    ActivityLogWithActor, PaginatedActivityLog, StatusTimelineEntry, insert_activity_log,
    list_activity_by_project, list_activity_by_task, list_task_status_timeline,
};

// attachments
pub use attachments::{
    AttachmentQueryError, AttachmentWithUploader, DeletedAttachment, can_delete_attachment,
    create_attachment, delete_attachment, get_attachment_by_id, get_attachment_with_uploader,
    list_by_task, verify_task_board_membership,
};

// automation_evaluation
pub use automation_evaluation::{
    ScheduledTriggerTask, get_active_rules_for_trigger, get_scheduled_trigger_tasks, log_automation,
};

// automation_templates
pub use automation_templates::{
    apply_template, get_template as get_automation_template,
    list_templates as list_automation_templates, seed_system_templates, toggle_template,
};

// automations
pub use automations::{
    AutomationQueryError, AutomationRuleWithActions, CreateActionInput, CreateRuleInput,
    UpdateRuleInput, create_rule, delete_rule, get_rule, get_rule_logs, list_rules, update_rule,
};

// project_shares
pub use project_shares::{
    BoardShareQueryError, CreateBoardShareInput, SharedBoardAccess, SharedColumn, SharedTask,
    access_shared_board, create_board_share, delete_board_share, list_board_shares,
    toggle_board_share,
};

// projects
pub use projects::{
    BoardTaskAssignee, BoardTaskLabel, PaginatedTasks, ProjectMemberWithUser, ProjectWithTaskLists,
    TaskWithBadgesRow, add_project_member, create_project, duplicate_project, get_project_by_id,
    get_project_internal, get_project_member_role, is_project_member, list_project_members,
    list_project_task_assignees, list_project_task_labels, list_project_tasks_with_badges,
    list_projects_by_workspace, remove_project_member, soft_delete_project, update_project,
    update_project_member_role,
};

// comments
pub use comments::{
    CommentQueryError, CommentWithAuthor, CreateCommentInput, UpdateCommentInput, create_comment,
    delete_comment, get_comment_author_id, get_comment_by_id, get_comment_task_id,
    list_comments_by_task, update_comment,
};

// custom_fields
pub use custom_fields::{
    CreateCustomFieldInput, CustomFieldQueryError, SetFieldValue, TaskCustomFieldValueWithField,
    UpdateCustomFieldInput, create_custom_field, delete_custom_field, get_task_custom_field_values,
    list_board_custom_fields, set_task_custom_field_values, update_custom_field,
};

// dashboard
pub use dashboard::{
    CompletionTrendPoint, DashboardActivityEntry, DashboardStats, OverdueTask, TasksByPriority,
    TasksByStatus, UpcomingDeadline, get_completion_trend, get_dashboard_stats, get_overdue_tasks,
    get_recent_activity, get_tasks_by_priority, get_tasks_by_status, get_upcoming_deadlines,
};

// dependencies
pub use dependencies::{
    BlockerInfo, CreateDependencyInput, DependencyQueryError, DependencyWithTask, check_blockers,
    create_dependency, delete_dependency, get_board_dependencies, list_dependencies,
};

// eisenhower
pub use eisenhower::{
    EisenhowerAssignee, EisenhowerFilters, EisenhowerMatrixResponse, EisenhowerQuadrant,
    EisenhowerTaskItem, get_eisenhower_matrix, reset_eisenhower_overrides,
    update_eisenhower_overrides,
};

// my_tasks
pub use my_tasks::{
    MyTaskItem, MyTasksSortBy, MyTasksSummary, PaginatedMyTasks, SortOrder, list_my_tasks,
    my_tasks_summary,
};

// notification_deliveries
pub use notification_deliveries::log_delivery;

// notification_preferences
pub use notification_preferences::{
    NotificationChannel, NotificationPreferenceError, UpsertPreferenceInput, get_preference,
    list_by_user as list_notification_preferences, reset_all as reset_notification_preferences,
    should_notify, upsert as upsert_notification_preference,
};

// notifications
pub use notifications::{
    NotificationListResponse, NotificationQueryError, archive_notification,
    delete_old_notifications, get_unread_count, list_notifications, mark_all_read, mark_read,
};

// positions
pub use positions::{
    add_holder, create_position, delete_position, get_position, list_holders, list_positions,
    list_recurring_tasks_for_position, remove_holder, resolve_assignees, update_position,
};

// project_statuses
pub use project_statuses::{
    create_project_status, delete_project_status, get_default_status, get_transitions,
    list_project_statuses, reorder_project_status, seed_default_statuses, set_transitions,
    update_project_status,
};

// project_templates
pub use project_templates::{
    CreateBoardFromTemplateInput, CreateTemplateFromBoardInput, CreateTemplateInput,
    ProjectTemplateQueryError, TemplateWithDetails, create_board_from_template, create_template,
    delete_template, get_template, list_templates, save_board_as_template,
};

// recurring
pub use recurring::{
    CreateRecurringInput, RecurringQueryError, UpdateRecurringInput, create_config, delete_config,
    get_config_for_task, update_config,
};

// recurring_generation
pub use recurring_generation::{create_recurring_instance, get_due_configs};

// task_assignments
pub use task_assignments::{assign_user, get_task_assignee_ids, unassign_user};

// task_budgets
pub use task_budgets::{BudgetSummaryError, ProjectBudgetSummary, get_project_budget_summary};

// task_bulk
pub use task_bulk::{BulkUpdateInput, bulk_delete_tasks, bulk_update_tasks};

// task_groups
pub use task_groups::{
    create_task_group, get_default_task_list, get_task_group_by_id, list_task_groups_by_board,
    list_task_groups_with_stats, list_task_lists_by_project, soft_delete_task_group,
    toggle_task_group_collapse, update_task_group_color, update_task_group_name,
    update_task_group_position,
};

// task_reminders
pub use task_reminders::{
    PendingReminder, ReminderInfo, get_pending_reminders, list_reminders_for_task,
    mark_reminder_sent, remove_reminder, reset_reminders_for_task, set_reminder,
};

// task_templates
pub use task_templates::{
    CreateTaskTemplateInput, TaskTemplateQueryError, TaskTemplateWithDetails,
    TemplateCustomFieldInput, UpdateTaskTemplateInput, create_task_from_template,
    create_task_template, delete_task_template, get_task_template, list_task_templates,
    save_task_as_template, update_task_template,
};

// task_views
pub use task_views::{
    CalendarTask, GanttTask, TaskListItem, list_tasks_flat, list_tasks_for_calendar,
    list_tasks_for_gantt,
};

// task_watchers
pub use task_watchers::{
    WatcherInfo, add_watcher, get_task_watcher_ids, get_watcher_info, remove_watcher,
};

// tasks
pub use tasks::{
    AssigneeInfo, ChildTaskWithDetails, CreateTaskInput, TaskQueryError, TaskWithDetails,
    UpdateTaskInput, create_task, duplicate_task, find_done_status, find_non_done_status,
    get_project_status_name, get_task_board_id, get_task_by_id, get_task_project_id, get_task_row,
    get_task_status_id, get_user_display_name, is_done_status, list_child_tasks,
    list_child_tasks_with_details, list_tasks_by_board, move_subtasks_to_project, move_task,
    move_task_to_project, soft_delete_task, strip_task_labels_for_project, update_task,
    update_task_list, update_task_status, validate_transition,
};

// team_overview
pub use team_overview::{
    MemberTask, MemberWorkload, OverloadedMember, get_member_active_tasks, get_overloaded_members,
    get_workload, reassign_tasks,
};

// time_entries
pub use time_entries::{
    ManualEntryInput, StartTimerInput, TaskTimeReport, TimeEntryQueryError, TimeEntryWithTask,
    TimesheetEntry, TimesheetReport, TimesheetSummary, UpdateEntryInput, create_manual_entry,
    delete_entry, get_board_time_report, get_running_timer, get_timesheet_report,
    list_task_time_entries, start_timer, stop_timer, update_entry,
};

// webhooks
pub use webhooks::{
    CreateWebhookInput, UpdateWebhookInput, WebhookQueryError, create_webhook, delete_webhook,
    get_active_webhooks_for_event, get_webhook_deliveries, list_webhooks, log_webhook_delivery,
    update_webhook,
};

// workspaces
pub use workspaces::{
    TenantMemberInfo, UserWorkspaceMembership, WorkspaceMemberInfo, WorkspaceWithMembers,
    add_workspace_member, bulk_add_workspace_members, create_workspace, get_user_workspaces,
    get_workspace_by_id, get_workspace_member_role, get_workspace_visibility, is_workspace_member,
    join_open_workspace, list_open_workspaces, list_tenant_members, list_workspaces_for_user,
    remove_workspace_member, search_workspace_members, soft_delete_workspace, update_workspace,
    update_workspace_member_role, update_workspace_visibility,
};

// workspace_roles
pub use workspace_roles::{
    CreateWorkspaceRoleInput, UpdateWorkspaceRoleInput, WorkspaceRoleSummary,
    create_workspace_role, delete_workspace_role, get_workspace_role, get_workspace_role_by_name,
    list_workspace_roles, seed_system_roles, update_workspace_role,
};

// workspace_job_roles
pub use workspace_job_roles::{
    CreateJobRoleInput, MemberJobRoleInfo, MemberRoleBatch, UpdateJobRoleInput,
    assign_role_to_member, create_job_role, delete_job_role, get_member_roles,
    get_members_with_role, get_roles_for_all_members, list_job_roles, remove_role_from_member,
    update_job_role,
};

// archive
pub use archive::{ArchiveItem, PaginatedArchive, list_archive};

// auth
pub use auth::{
    create_password_reset_token, create_refresh_token, create_user, create_user_with_tenant,
    get_refresh_token, get_user_by_email, get_user_by_id, get_valid_reset_token,
    mark_reset_token_used, revoke_all_user_tokens, revoke_refresh_token, update_user_password,
};

// favorites
pub use favorites::{FavoriteItem, add_favorite, is_favorited, list_favorites, remove_favorite};

// invitations
pub use invitations::{
    accept_invitation, add_workspace_member as invitation_add_workspace_member, create_invitation,
    create_invitation_with_details, delete_invitation, get_invitation_by_id,
    get_invitation_by_token, get_pending_invitation_by_email, get_workspace_tenant_id,
    list_all_invitations, list_pending_invitations, resend_invitation,
};

// milestones
pub use milestones::{
    CreateMilestoneInput, MilestoneQueryError, MilestoneWithProgress, UpdateMilestoneInput,
    assign_task_to_milestone, create_milestone, delete_milestone, get_milestone,
    get_milestone_board_id, list_milestones, unassign_task_from_milestone, update_milestone,
};

// issues
pub use issues::{
    CreateIssueInput, IssueFilters, IssueQueryError, IssueSummary, IssueWithDetails,
    ResolveIssueInput, UpdateIssueInput, create_issue, get_issue, get_issue_project_id,
    get_issue_summary, list_issues, reopen_issue, resolve_issue, soft_delete_issue, update_issue,
};

// portfolio
pub use portfolio::{
    PortfolioMilestone, PortfolioProject, PortfolioResponse, get_portfolio_milestones,
    get_portfolio_projects,
};

// recent_items
pub use recent_items::{RecentItem, list_recent_items, upsert_recent_item};

// reports
pub use reports::{
    AssigneeWorkload, BoardReport, BurndownPoint, CompletionRate, OverdueBucket, PriorityCount,
    ReportQueryError, get_board_report,
};

// search
pub use search::{
    BoardSearchResult, CommentSearchResult, SearchFilters, SearchResultCounts, SearchResults,
    TaskSearchResult, search_all,
};

// themes
pub use themes::{ThemeQueryError, get_by_slug, list_themes};

// bulk_operations
pub use bulk_operations::{
    BulkAction, BulkOperationResult, MAX_BULK_TASKS, PreviewSummary, TaskSnapshot,
    execute_bulk_operation, list_bulk_operations, preview_bulk_operation, snapshot_tasks,
    undo_bulk_operation,
};

// metrics
pub use metrics::{
    CycleTimePoint, PersonalDashboard, TeamDashboard, VelocityPoint, WorkloadRow,
    WorkspaceDashboard, get_personal_dashboard, get_team_dashboard, get_workspace_dashboard,
    refresh_metrics,
};

// user_preferences
pub use user_preferences::{get_quiet_hours, is_in_quiet_hours};

// Re-export with module paths for clarity (avoid name collisions)
pub use user_preferences as user_prefs;
pub use workspace_api_keys as api_keys;

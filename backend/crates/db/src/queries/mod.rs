pub mod activity_log;
pub mod archive;
pub mod attachments;
pub mod auth;
pub mod automation_evaluation;
pub mod automation_templates;
pub mod automations;
pub mod board_shares;
pub mod boards;
pub mod bulk_operations;
pub mod comments;
pub mod custom_fields;
pub mod dashboard;
pub mod dependencies;
pub mod eisenhower;
pub mod favorites;
pub mod invitations;
pub mod membership;
pub mod metrics;
pub mod milestones;
pub mod my_tasks;
pub mod notification_preferences;
pub mod notifications;
pub mod portfolio;
pub mod positions;
pub mod project_statuses;
pub mod project_templates;
pub mod recent_items;
pub mod recurring;
pub mod recurring_generation;
pub mod reports;
pub mod search;
pub mod subtasks;
pub mod task_assignments;
pub mod task_bulk;
pub mod task_groups;
pub mod task_reminders;
pub mod task_templates;
pub mod task_views;
pub mod task_watchers;
pub mod tasks;
pub mod team_overview;
pub mod teams;
pub mod themes;
pub mod time_entries;
pub mod user_preferences;
pub mod webhooks;
pub mod workspace_api_keys;
pub mod workspace_job_roles;
pub mod workspaces;

#[cfg(test)]
mod integration_tests;
#[cfg(test)]
mod integration_tests_advanced;
#[cfg(test)]
mod integration_tests_extra;

// ── Explicit re-exports ────────────────────────────────────────────────────

// membership
pub use membership::verify_project_membership;

// activity_log
pub use activity_log::{
    insert_activity_log, list_activity_by_project, list_activity_by_task, ActivityLogWithActor,
    PaginatedActivityLog,
};

// attachments
pub use attachments::{
    can_delete_attachment, create_attachment, delete_attachment, get_attachment_by_id,
    get_attachment_with_uploader, list_by_task, verify_task_board_membership, AttachmentQueryError,
    AttachmentWithUploader, DeletedAttachment,
};

// automation_evaluation
pub use automation_evaluation::{
    get_active_rules_for_trigger, get_scheduled_trigger_tasks, log_automation, ScheduledTriggerTask,
};

// automation_templates
pub use automation_templates::{
    apply_template, get_template as get_automation_template,
    list_templates as list_automation_templates, seed_system_templates, toggle_template,
};

// automations
pub use automations::{
    create_rule, delete_rule, get_rule, get_rule_logs, list_rules, update_rule,
    AutomationQueryError, AutomationRuleWithActions, CreateActionInput, CreateRuleInput,
    UpdateRuleInput,
};

// board_shares
pub use board_shares::{
    access_shared_board, create_board_share, delete_board_share, list_board_shares,
    toggle_board_share, BoardShareQueryError, CreateBoardShareInput, SharedBoardAccess,
    SharedColumn, SharedTask,
};

// boards
pub use boards::{
    add_board_member, add_project_member, create_board, create_project, duplicate_board,
    duplicate_project, get_board_by_id, get_board_internal, get_board_member_role,
    get_project_by_id, get_project_internal, get_project_member_role, is_board_member,
    is_project_member, list_board_members, list_board_task_assignees, list_board_task_labels,
    list_board_tasks_with_badges, list_boards_by_workspace, list_project_members,
    list_project_task_assignees, list_project_task_labels, list_project_tasks_with_badges,
    list_projects_by_workspace, remove_board_member, remove_project_member, soft_delete_board,
    soft_delete_project, update_board, update_board_member_role, update_project,
    update_project_member_role, BoardMemberWithUser, BoardTaskAssignee, BoardTaskLabel,
    BoardWithColumns, PaginatedTasks, ProjectMemberWithUser, ProjectWithTaskLists,
    TaskWithBadgesRow,
};

// comments
pub use comments::{
    create_comment, delete_comment, get_comment_author_id, get_comment_by_id, get_comment_task_id,
    list_comments_by_task, update_comment, CommentQueryError, CommentWithAuthor,
    CreateCommentInput, UpdateCommentInput,
};

// custom_fields
pub use custom_fields::{
    create_custom_field, delete_custom_field, get_task_custom_field_values,
    list_board_custom_fields, set_task_custom_field_values, update_custom_field,
    CreateCustomFieldInput, CustomFieldQueryError, SetFieldValue, TaskCustomFieldValueWithField,
    UpdateCustomFieldInput,
};

// dashboard
pub use dashboard::{
    get_completion_trend, get_dashboard_stats, get_overdue_tasks, get_recent_activity,
    get_tasks_by_priority, get_tasks_by_status, get_upcoming_deadlines, CompletionTrendPoint,
    DashboardActivityEntry, DashboardStats, OverdueTask, TasksByPriority, TasksByStatus,
    UpcomingDeadline,
};

// dependencies
pub use dependencies::{
    check_blockers, create_dependency, delete_dependency, get_board_dependencies,
    list_dependencies, BlockerInfo, CreateDependencyInput, DependencyQueryError,
    DependencyWithTask,
};

// eisenhower
pub use eisenhower::{
    get_eisenhower_matrix, reset_eisenhower_overrides, update_eisenhower_overrides,
    EisenhowerAssignee, EisenhowerFilters, EisenhowerMatrixResponse, EisenhowerQuadrant,
    EisenhowerTaskItem,
};

// my_tasks
pub use my_tasks::{
    list_my_tasks, my_tasks_summary, MyTaskItem, MyTasksSortBy, MyTasksSummary, PaginatedMyTasks,
    SortOrder,
};

// notification_preferences
pub use notification_preferences::{
    get_preference, list_by_user as list_notification_preferences,
    reset_all as reset_notification_preferences, should_notify,
    upsert as upsert_notification_preference, NotificationChannel, NotificationPreferenceError,
    UpsertPreferenceInput,
};

// notifications
pub use notifications::{
    archive_notification, delete_old_notifications, get_unread_count, list_notifications,
    mark_all_read, mark_read, NotificationListResponse, NotificationQueryError,
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
    create_board_from_template, create_template, delete_template, get_template, list_templates,
    save_board_as_template, CreateBoardFromTemplateInput, CreateTemplateFromBoardInput,
    CreateTemplateInput, ProjectTemplateQueryError, TemplateWithDetails,
};

// recurring
pub use recurring::{
    create_config, delete_config, get_config_for_task, update_config, CreateRecurringInput,
    RecurringQueryError, UpdateRecurringInput,
};

// recurring_generation
pub use recurring_generation::{create_recurring_instance, get_due_configs};

// subtasks
pub use subtasks::{
    create_subtask, delete_subtask, get_subtask_progress, get_subtask_task_id,
    list_subtasks_by_task, promote_subtask_to_task, reorder_subtask, toggle_subtask,
    update_subtask, SubtaskProgress, SubtaskQueryError,
};

// task_assignments
pub use task_assignments::{assign_user, get_task_assignee_ids, unassign_user};

// task_bulk
pub use task_bulk::{bulk_delete_tasks, bulk_update_tasks, BulkUpdateInput};

// task_groups
pub use task_groups::{
    create_task_group, get_default_task_list, get_task_group_by_id, list_task_groups_by_board,
    list_task_groups_with_stats, list_task_lists_by_project, soft_delete_task_group,
    toggle_task_group_collapse, update_task_group_color, update_task_group_name,
    update_task_group_position,
};

// task_reminders
pub use task_reminders::{
    get_pending_reminders, list_reminders_for_task, mark_reminder_sent, remove_reminder,
    reset_reminders_for_task, set_reminder, PendingReminder, ReminderInfo,
};

// task_templates
pub use task_templates::{
    create_task_from_template, create_task_template, delete_task_template, get_task_template,
    list_task_templates, save_task_as_template, update_task_template, CreateTaskTemplateInput,
    TaskTemplateQueryError, TaskTemplateWithDetails, TemplateCustomFieldInput,
    UpdateTaskTemplateInput,
};

// task_views
pub use task_views::{
    list_tasks_flat, list_tasks_for_calendar, list_tasks_for_gantt, CalendarTask, GanttTask,
    TaskListItem,
};

// task_watchers
pub use task_watchers::{
    add_watcher, get_task_watcher_ids, get_watcher_info, remove_watcher, WatcherInfo,
};

// tasks
pub use tasks::{
    create_task, duplicate_task, find_done_status, find_non_done_status, get_task_board_id,
    get_task_by_id, get_task_project_id, get_task_row, get_task_status_id, get_user_display_name,
    is_done_status, list_child_tasks, list_tasks_by_board, move_task, soft_delete_task,
    update_task, update_task_list, update_task_status, validate_transition, AssigneeInfo,
    CreateTaskInput, TaskQueryError, TaskWithDetails, UpdateTaskInput,
};

// team_overview
pub use team_overview::{
    get_member_active_tasks, get_overloaded_members, get_workload, reassign_tasks, MemberTask,
    MemberWorkload, OverloadedMember,
};

// teams
pub use teams::{
    add_team_member, create_team, delete_team, get_team_by_id, list_team_members,
    list_teams_by_workspace, remove_team_member, update_team, TeamMemberWithUser,
    TeamWithMemberCount,
};

// time_entries
pub use time_entries::{
    create_manual_entry, delete_entry, get_board_time_report, get_running_timer,
    get_timesheet_report, list_task_time_entries, start_timer, stop_timer, update_entry,
    ManualEntryInput, StartTimerInput, TaskTimeReport, TimeEntryQueryError, TimeEntryWithTask,
    TimesheetEntry, TimesheetReport, TimesheetSummary, UpdateEntryInput,
};

// webhooks
pub use webhooks::{
    create_webhook, delete_webhook, get_active_webhooks_for_event, get_webhook_deliveries,
    list_webhooks, log_webhook_delivery, update_webhook, CreateWebhookInput, UpdateWebhookInput,
    WebhookQueryError,
};

// workspaces
pub use workspaces::{
    add_workspace_member, bulk_add_workspace_members, create_workspace, get_user_workspaces,
    get_workspace_by_id, get_workspace_member_role, get_workspace_visibility, is_workspace_member,
    join_open_workspace, list_open_workspaces, list_tenant_members, list_workspaces_for_user,
    remove_workspace_member, search_workspace_members, soft_delete_workspace, update_workspace,
    update_workspace_member_role, update_workspace_visibility, TenantMemberInfo,
    UserWorkspaceMembership, WorkspaceMemberInfo, WorkspaceWithMembers,
};

// workspace_job_roles
pub use workspace_job_roles::{
    assign_role_to_member, create_job_role, delete_job_role, get_member_roles,
    get_members_with_role, get_roles_for_all_members, list_job_roles, remove_role_from_member,
    update_job_role, CreateJobRoleInput, MemberJobRoleInfo, MemberRoleBatch, UpdateJobRoleInput,
};

// archive
pub use archive::{list_archive, ArchiveItem, PaginatedArchive};

// auth
pub use auth::{
    create_password_reset_token, create_refresh_token, create_user, create_user_with_tenant,
    get_refresh_token, get_user_by_email, get_user_by_id, get_valid_reset_token,
    mark_reset_token_used, revoke_all_user_tokens, revoke_refresh_token, update_user_password,
};

// favorites
pub use favorites::{add_favorite, is_favorited, list_favorites, remove_favorite, FavoriteItem};

// invitations
pub use invitations::{
    accept_invitation, add_workspace_member as invitation_add_workspace_member, create_invitation,
    create_invitation_with_details, delete_invitation, get_invitation_by_id,
    get_invitation_by_token, get_pending_invitation_by_email, get_workspace_tenant_id,
    list_all_invitations, list_pending_invitations, resend_invitation,
};

// milestones
pub use milestones::{
    assign_task_to_milestone, create_milestone, delete_milestone, get_milestone,
    get_milestone_board_id, list_milestones, unassign_task_from_milestone, update_milestone,
    CreateMilestoneInput, MilestoneQueryError, MilestoneWithProgress, UpdateMilestoneInput,
};

// portfolio
pub use portfolio::{
    get_portfolio_milestones, get_portfolio_projects, PortfolioMilestone, PortfolioProject,
    PortfolioResponse,
};

// recent_items
pub use recent_items::{list_recent_items, upsert_recent_item, RecentItem};

// reports
pub use reports::{
    get_board_report, AssigneeWorkload, BoardReport, BurndownPoint, CompletionRate, OverdueBucket,
    PriorityCount, ReportQueryError,
};

// search
pub use search::{
    search_all, BoardSearchResult, CommentSearchResult, SearchFilters, SearchResultCounts,
    SearchResults, TaskSearchResult,
};

// themes
pub use themes::{get_by_slug, list_themes, ThemeQueryError};

// bulk_operations
pub use bulk_operations::{
    execute_bulk_operation, list_bulk_operations, preview_bulk_operation, snapshot_tasks,
    undo_bulk_operation, BulkAction, BulkOperationResult, PreviewSummary, TaskSnapshot,
    MAX_BULK_TASKS,
};

// metrics
pub use metrics::{
    get_personal_dashboard, get_team_dashboard, get_workspace_dashboard, refresh_metrics,
    CycleTimePoint, PersonalDashboard, TeamDashboard, VelocityPoint, WorkloadRow,
    WorkspaceDashboard,
};

// Re-export with module paths for clarity (avoid name collisions)
pub use user_preferences as user_prefs;
pub use workspace_api_keys as api_keys;

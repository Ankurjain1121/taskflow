# TaskFlow API Contracts

> Auto-generated mapping of every backend REST endpoint to its frontend service consumer.
> Last updated: 2026-02-23

Legend:
- **Auth Tier**: `public` = no auth, `protected` = `AuthUserExtractor`/`TenantContext`, `manager` = `ManagerOrAdmin`, `admin` = `AdminUser`, `cron` = `X-Cron-Secret` header

---

## 1. Authentication

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| POST | `/api/auth/sign-in` | `SignInRequest` | `AuthResponse` | `AuthService` | `signIn()` | public |
| POST | `/api/auth/sign-up` | `SignUpRequest` | `AuthResponse` | `AuthService` | `signUp()` | public |
| POST | `/api/auth/refresh` | `RefreshRequest` (cookie) | `AuthResponse` | `AuthService` | `refresh()` | public |
| POST | `/api/auth/sign-out` | `RefreshRequest` | `MessageResponse` | -- | -- | protected |
| POST | `/api/auth/logout` | (cookie) | `MessageResponse` | `AuthService` | `signOut()` | public |
| GET | `/api/auth/me` | -- | `UserResponse` | `AuthService` / `ProfileService` | `validateSession()` / `getProfile()` | protected |
| PATCH | `/api/auth/me` | `UpdateProfileRequest` | `UserResponse` | `AuthService` / `ProfileService` | `updateProfile()` | protected |
| DELETE | `/api/auth/me` | `DeleteAccountRequest` | `MessageResponse` | `AuthService` | `deleteAccount()` | protected |
| POST | `/api/auth/change-password` | `ChangePasswordRequest` | `MessageResponse` | `AuthService` | `changePassword()` | protected |
| POST | `/api/auth/forgot-password` | `ForgotPasswordRequest` | `MessageResponse` | `AuthService` | `forgotPassword()` | public |
| POST | `/api/auth/reset-password` | `ResetPasswordRequest` | `MessageResponse` | `AuthService` | `resetPassword()` | public |

---

## 2. Workspaces

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/workspaces` | -- | `Vec<WorkspaceResponse>` | `WorkspaceService` | `list()` | protected |
| POST | `/api/workspaces` | `CreateWorkspaceRequest` | `WorkspaceResponse` | `WorkspaceService` | `create()` | protected |
| GET | `/api/workspaces/discover` | -- | `Vec<WorkspaceResponse>` | `WorkspaceService` | `discoverWorkspaces()` | protected |
| GET | `/api/workspaces/{id}` | -- | `WorkspaceDetailResponse` | `WorkspaceService` | `get()` | protected |
| PUT | `/api/workspaces/{id}` | `UpdateWorkspaceRequest` | `WorkspaceResponse` | `WorkspaceService` | `update()` | manager |
| DELETE | `/api/workspaces/{id}` | -- | `MessageResponse` | `WorkspaceService` | `delete()` | manager |
| POST | `/api/workspaces/{id}/join` | -- | `JoinWorkspaceResponse` | `WorkspaceService` | `joinWorkspace()` | protected |
| GET | `/api/workspaces/{id}/members/search?q=` | query: `q`, `limit` | `Vec<UserSearchResult>` | `WorkspaceService` | `searchMembers()` | protected |
| POST | `/api/workspaces/{id}/members` | `AddMemberRequest` | `MessageResponse` | `WorkspaceService` | (via invitation) | manager |
| POST | `/api/workspaces/{id}/members/bulk` | `BulkAddMembersRequest` | `BulkAddMembersResponse` | `WorkspaceService` | `bulkAddMembers()` | manager |
| DELETE | `/api/workspaces/{id}/members/{user_id}` | -- | `MessageResponse` | `WorkspaceService` | `removeMember()` | manager |
| PATCH | `/api/workspaces/{id}/members/{user_id}` | `UpdateMemberRoleRequest` | `MemberInfo` | `WorkspaceService` | `updateMemberRole()` | protected |

---

## 3. Boards

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/workspaces/{ws_id}/boards` | -- | `Vec<BoardResponse>` | `BoardService` | `listBoards()` | protected |
| POST | `/api/workspaces/{ws_id}/boards` | `CreateBoardRequest` | `BoardDetailResponse` | `BoardService` | `createBoard()` | protected |
| GET | `/api/boards/{id}` | -- | `BoardDetailResponse` | `BoardService` | `getBoard()` | protected |
| GET | `/api/boards/{id}/full` | -- | `BoardFullResponse` | `BoardService` | `getBoardFull()` | protected |
| PUT | `/api/boards/{id}` | `UpdateBoardRequest` | `BoardResponse` | `BoardService` | `updateBoard()` | protected |
| DELETE | `/api/boards/{id}` | -- | `MessageResponse` | `BoardService` | `deleteBoard()` | manager |
| GET | `/api/boards/{id}/members` | -- | `Vec<BoardMemberResponse>` | `BoardService` | `getBoardMembers()` | protected |
| POST | `/api/boards/{id}/members` | `AddBoardMemberRequest` | `MessageResponse` | `BoardService` | `inviteBoardMember()` | manager |
| DELETE | `/api/boards/{id}/members/{user_id}` | -- | `MessageResponse` | `BoardService` | `removeBoardMember()` | manager |
| PATCH | `/api/boards/{id}/members/{user_id}` | `UpdateBoardMemberRoleRequest` | `BoardMemberResponse` | `BoardService` | `updateBoardMemberRole()` | protected |
| GET | `/api/board-templates` | -- | `Vec<BoardTemplate>` | -- | -- | protected |

---

## 4. Columns

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/columns` | -- | `Vec<ColumnResponse>` | `BoardService` | `listColumns()` | protected |
| POST | `/api/boards/{board_id}/columns` | `CreateColumnRequest` | `ColumnResponse` | `BoardService` | `createColumn()` | protected |
| DELETE | `/api/columns/{id}` | -- | `MessageResponse` | `BoardService` | `deleteColumn()` | protected |
| PUT | `/api/columns/{id}/name` | `RenameColumnRequest` | `ColumnResponse` | `BoardService` | `updateColumn()` | protected |
| PUT | `/api/columns/{id}/position` | `ReorderColumnRequest` | `ColumnResponse` | `BoardService` | `reorderColumn()` | protected |
| PUT | `/api/columns/{id}/status-mapping` | `UpdateStatusMappingRequest` | `ColumnResponse` | `BoardService` | `updateColumn()` | protected |
| PUT | `/api/columns/{id}/color` | `UpdateColumnColorRequest` | `ColumnResponse` | `BoardService` | `updateColumn()` | protected |

---

## 5. Tasks

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/tasks` | -- | `ListTasksResponse` | `TaskService` | `listByBoard()` | protected |
| POST | `/api/boards/{board_id}/tasks` | `CreateTaskRequest` | `Task` | `TaskService` | `createTask()` | protected |
| GET | `/api/tasks/{id}` | -- | `TaskWithDetails` | `TaskService` | `getTask()` | protected |
| PUT | `/api/tasks/{id}` | `UpdateTaskRequest` | `Task` | `TaskService` | `updateTask()` | protected |
| DELETE | `/api/tasks/{id}` | -- | `{ success: true }` | `TaskService` | `deleteTask()` | protected |
| PATCH | `/api/tasks/{id}/move` | `MoveTaskRequest` | `Task` | `TaskService` | `moveTask()` | protected |
| POST | `/api/tasks/{id}/assignees` | `AssignUserRequest` | `{ success: true }` | `TaskService` | `assignUser()` | protected |
| DELETE | `/api/tasks/{id}/assignees/{user_id}` | -- | `{ success: true }` | `TaskService` | `unassignUser()` | protected |

### 5.1 Task Views

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/tasks/list` | -- | `Vec<TaskListItem>` | `TaskService` | `listFlat()` | protected |
| GET | `/api/boards/{board_id}/tasks/calendar?start=&end=` | query: `start`, `end` | `Vec<CalendarTask>` | `TaskService` | `listCalendarTasks()` | protected |
| GET | `/api/boards/{board_id}/tasks/gantt` | -- | `Vec<GanttTask>` | `TaskService` | `listGanttTasks()` | protected |

### 5.2 Bulk Operations

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| POST | `/api/boards/{board_id}/tasks/bulk-update` | `BulkUpdateRequest` | `{ updated: N }` | `TaskService` | `bulkUpdate()` | protected |
| POST | `/api/boards/{board_id}/tasks/bulk-delete` | `BulkDeleteRequest` | `{ deleted: N }` | `TaskService` | `bulkDelete()` | protected |

---

## 6. Comments

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/tasks/{task_id}/comments` | -- | `ListCommentsResponse` | `CommentService` | `listByTask()` | protected |
| POST | `/api/tasks/{task_id}/comments` | `CreateCommentRequest` | `CommentWithAuthor` | `CommentService` | `create()` | protected |
| PUT | `/api/comments/{id}` | `UpdateCommentRequest` | `CommentWithAuthor` | `CommentService` | `update()` | protected |
| DELETE | `/api/comments/{id}` | -- | `204 No Content` | `CommentService` | `delete()` | protected |

---

## 7. Subtasks

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/tasks/{task_id}/subtasks` | -- | `SubtaskListResponse` | `SubtaskService` | `list()` | protected |
| POST | `/api/tasks/{task_id}/subtasks` | `CreateSubtaskRequest` | `Subtask` | `SubtaskService` | `create()` | protected |
| PUT | `/api/subtasks/{id}` | `UpdateSubtaskRequest` | `Subtask` | `SubtaskService` | `update()` | protected |
| PATCH | `/api/subtasks/{id}/toggle` | -- | `Subtask` | `SubtaskService` | `toggle()` | protected |
| PUT | `/api/subtasks/{id}/reorder` | `ReorderSubtaskRequest` | `Subtask` | `SubtaskService` | `reorder()` | protected |
| DELETE | `/api/subtasks/{id}` | -- | `{ success: true }` | `SubtaskService` | `delete()` | protected |

---

## 8. Dashboard

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/dashboard/stats?workspace_id=` | query: `workspace_id` | `DashboardStats` | `DashboardService` | `getStats()` | protected |
| GET | `/api/dashboard/recent-activity?limit=&workspace_id=` | query: `limit`, `workspace_id` | `Vec<DashboardActivityEntry>` | `DashboardService` | `getRecentActivity()` | protected |
| GET | `/api/dashboard/tasks-by-status?workspace_id=` | query: `workspace_id` | `Vec<TasksByStatus>` | `DashboardService` | `getTasksByStatus()` | protected |
| GET | `/api/dashboard/tasks-by-priority?workspace_id=` | query: `workspace_id` | `Vec<TasksByPriority>` | `DashboardService` | `getTasksByPriority()` | protected |
| GET | `/api/dashboard/overdue-tasks?workspace_id=` | query: `workspace_id` | `Vec<OverdueTask>` | `DashboardService` | `getOverdueTasks()` | protected |
| GET | `/api/dashboard/completion-trend?days=&workspace_id=` | query: `days`, `workspace_id` | `Vec<CompletionTrendPoint>` | `DashboardService` | `getCompletionTrend()` | protected |
| GET | `/api/dashboard/upcoming-deadlines?days=&workspace_id=` | query: `days`, `workspace_id` | `Vec<UpcomingDeadline>` | `DashboardService` | `getUpcomingDeadlines()` | protected |

---

## 9. My Tasks

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/my-tasks?sort_by=&sort_order=&board_id=&cursor=&limit=` | query params | `PaginatedMyTasks` | `MyTasksService` | `getMyTasks()` | protected |
| GET | `/api/my-tasks/summary` | -- | `MyTasksSummary` | `MyTasksService` | `getMyTasksSummary()` | protected |

---

## 10. Notifications

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/notifications?cursor=&limit=` | query: `cursor`, `limit` | `NotificationListResponse` | `NotificationService` | `listNotifications()` | protected |
| GET | `/api/notifications/unread-count` | -- | `UnreadCountResponse` | `NotificationService` | `getUnreadCount()` | protected |
| PUT | `/api/notifications/{id}/read` | -- | `{ success: true }` | `NotificationService` | `markRead()` | protected |
| PUT | `/api/notifications/read-all` | -- | `{ success, markedCount }` | `NotificationService` | `markAllRead()` | protected |

---

## 11. Notification Preferences

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/notification-preferences` | -- | `ListPreferencesResponse` | `ProfileService` | `getNotificationPreferences()` | protected |
| PUT | `/api/notification-preferences` | `UpdatePreferenceRequest` | `NotificationPreference` | `ProfileService` | `updateNotificationPreference()` | protected |
| DELETE | `/api/notification-preferences` | -- | `{ success, deletedCount }` | `ProfileService` | `resetNotificationPreferences()` | protected |

---

## 12. Search

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/search?q=&limit=` | query: `q`, `limit` | `SearchResults` | `SearchService` | `search()` | protected |

---

## 13. Favorites

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/favorites` | -- | `Vec<FavoriteItem>` | `FavoritesService` | `list()` | protected |
| POST | `/api/favorites` | `AddFavoriteRequest` | `{ id, success }` | `FavoritesService` | `add()` | protected |
| DELETE | `/api/favorites/{entity_type}/{entity_id}` | -- | `{ success: true }` | `FavoritesService` | `remove()` | protected |
| GET | `/api/favorites/check/{entity_type}/{entity_id}` | -- | `{ favorited: bool }` | `FavoritesService` | `check()` | protected |

---

## 14. Activity Log

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/tasks/{task_id}/activity?cursor=&limit=` | query: `cursor`, `limit` | `PaginatedActivityLog` | `ActivityService` | `listByTask()` | protected |

---

## 15. Archive

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/archive?entity_type=&cursor=&page_size=` | query params | `PaginatedArchive` | `ArchiveService` | `list()` | protected |
| POST | `/api/archive/restore` | `RestoreRequest` | `ArchiveOperationResponse` | `ArchiveService` | `restore()` | protected |
| DELETE | `/api/archive/{entity_type}/{entity_id}` | -- | `ArchiveOperationResponse` | `ArchiveService` | `permanentlyDelete()` | admin |

---

## 16. Attachments

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| POST | `/api/tasks/{task_id}/attachments/upload-url` | `GetUploadUrlRequest` | `GetUploadUrlResponse` | `AttachmentService` | `getUploadUrl()` | protected |
| POST | `/api/tasks/{task_id}/attachments/confirm` | `ConfirmUploadRequest` | `AttachmentWithUploader` | `AttachmentService` | `confirmUpload()` | protected |
| GET | `/api/tasks/{task_id}/attachments` | -- | `Vec<AttachmentWithUploader>` | `AttachmentService` | `listByTask()` | protected |
| GET | `/api/attachments/{id}/download-url` | -- | `DownloadUrlResponse` | `AttachmentService` | `getDownloadUrl()` | protected |
| DELETE | `/api/attachments/{id}` | -- | `{ success: true }` | `AttachmentService` | `delete()` | protected |

---

## 17. Automations

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/automations` | -- | `Vec<AutomationRuleWithActions>` | `AutomationService` | `listRules()` | protected |
| POST | `/api/boards/{board_id}/automations` | `CreateRuleRequest` | `AutomationRuleWithActions` | `AutomationService` | `createRule()` | protected |
| GET | `/api/automations/{id}` | -- | `AutomationRuleWithActions` | `AutomationService` | `getRule()` | protected |
| PUT | `/api/automations/{id}` | `UpdateRuleRequest` | `AutomationRuleWithActions` | `AutomationService` | `updateRule()` | protected |
| DELETE | `/api/automations/{id}` | -- | `{ success: true }` | `AutomationService` | `deleteRule()` | protected |
| GET | `/api/automations/{id}/logs?limit=` | query: `limit` | `Vec<AutomationLog>` | `AutomationService` | `getRuleLogs()` | protected |

---

## 18. Milestones

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/milestones` | -- | `Vec<MilestoneWithProgress>` | `MilestoneService` | `list()` | protected |
| POST | `/api/boards/{board_id}/milestones` | `CreateMilestoneRequest` | `Milestone` | `MilestoneService` | `create()` | protected |
| GET | `/api/milestones/{id}` | -- | `MilestoneWithProgress` | `MilestoneService` | `get()` | protected |
| PUT | `/api/milestones/{id}` | `UpdateMilestoneRequest` | `Milestone` | `MilestoneService` | `update()` | protected |
| DELETE | `/api/milestones/{id}` | -- | `{ success: true }` | `MilestoneService` | `delete()` | protected |
| POST | `/api/tasks/{task_id}/milestone` | `AssignMilestoneRequest` | `{ success: true }` | `MilestoneService` | `assignTask()` | protected |
| DELETE | `/api/tasks/{task_id}/milestone` | -- | `{ success: true }` | `MilestoneService` | `unassignTask()` | protected |

---

## 19. Dependencies

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/tasks/{task_id}/dependencies` | -- | `Vec<DependencyWithTask>` | `DependencyService` | `listDependencies()` | protected |
| POST | `/api/tasks/{task_id}/dependencies` | `CreateDependencyInput` | `DependencyWithTask` | `DependencyService` | `createDependency()` | protected |
| DELETE | `/api/dependencies/{id}` | -- | `{ success: true }` | `DependencyService` | `deleteDependency()` | protected |
| GET | `/api/tasks/{task_id}/blockers` | -- | `Vec<BlockerInfo>` | `DependencyService` | `checkBlockers()` | protected |
| GET | `/api/boards/{board_id}/dependencies` | -- | `Vec<DependencyWithTask>` | `DependencyService` | `getBoardDependencies()` | protected |

---

## 20. Time Tracking

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/tasks/{task_id}/time-entries` | -- | `Vec<TimeEntry>` | `TimeTrackingService` | `listEntries()` | protected |
| POST | `/api/tasks/{task_id}/time-entries/start` | `StartTimerRequest` | `TimeEntry` | `TimeTrackingService` | `startTimer()` | protected |
| POST | `/api/tasks/{task_id}/time-entries` | `CreateManualEntryRequest` | `TimeEntry` | `TimeTrackingService` | `createManualEntry()` | protected |
| POST | `/api/time-entries/{id}/stop` | -- | `TimeEntry` | `TimeTrackingService` | `stopTimer()` | protected |
| PUT | `/api/time-entries/{id}` | `UpdateEntryRequest` | `TimeEntry` | `TimeTrackingService` | `updateEntry()` | protected |
| DELETE | `/api/time-entries/{id}` | -- | `{ success: true }` | `TimeTrackingService` | `deleteEntry()` | protected |
| GET | `/api/boards/{board_id}/time-report` | -- | `Vec<TaskTimeReport>` | `TimeTrackingService` | `getBoardTimeReport()` | protected |
| GET | `/api/time-entries/running` | -- | `Option<TimeEntryWithTask>` | `TimeTrackingService` | `getRunningTimer()` | protected |

---

## 21. Custom Fields

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/custom-fields` | -- | `Vec<BoardCustomField>` | `CustomFieldService` | `listBoardFields()` | protected |
| POST | `/api/boards/{board_id}/custom-fields` | `CreateCustomFieldRequest` | `BoardCustomField` | `CustomFieldService` | `createField()` | protected |
| PUT | `/api/custom-fields/{id}` | `UpdateCustomFieldRequest` | `BoardCustomField` | `CustomFieldService` | `updateField()` | protected |
| DELETE | `/api/custom-fields/{id}` | -- | `{ success: true }` | `CustomFieldService` | `deleteField()` | protected |
| GET | `/api/tasks/{task_id}/custom-fields` | -- | `Vec<TaskCustomFieldValueWithField>` | `CustomFieldService` | `getTaskValues()` | protected |
| PUT | `/api/tasks/{task_id}/custom-fields` | `SetTaskFieldValuesRequest` | `Vec<TaskCustomFieldValue>` | `CustomFieldService` | `setTaskValues()` | protected |

---

## 22. Task Groups

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/groups` | -- | JSON | `TaskGroupService` | `listGroups()` | protected |
| GET | `/api/boards/{board_id}/groups/stats` | -- | JSON | `TaskGroupService` | `listGroupsWithStats()` | protected |
| POST | `/api/boards/{board_id}/groups` | `CreateTaskGroupRequest` | JSON | `TaskGroupService` | `createGroup()` | protected |
| GET | `/api/groups/{id}` | -- | JSON | `TaskGroupService` | `getGroup()` | protected |
| PUT | `/api/groups/{id}` | `UpdateTaskGroupRequest` | JSON | `TaskGroupService` | `updateGroup()` | protected |
| PUT | `/api/groups/{id}/collapse` | `{ collapsed: bool }` | JSON | `TaskGroupService` | `toggleCollapse()` | protected |
| DELETE | `/api/groups/{id}` | -- | `{ success: true }` | `TaskGroupService` | `deleteGroup()` | protected |

---

## 23. Eisenhower Matrix

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/eisenhower` | -- | `EisenhowerMatrixResponse` | `EisenhowerService` | `getMatrix()` | protected |
| PUT | `/api/eisenhower/tasks/{id}` | `UpdateEisenhowerRequest` | `()` | `EisenhowerService` | `updateTaskOverride()` | protected |
| PUT | `/api/eisenhower/reset` | -- | `ResetEisenhowerResponse` | `EisenhowerService` | `resetAllOverrides()` | protected |

---

## 24. Board Sharing

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/shares` | -- | `Vec<BoardShare>` | `BoardShareService` | `listShares()` | protected |
| POST | `/api/boards/{board_id}/shares` | `CreateBoardShareInput` | `BoardShare` | `BoardShareService` | `createShare()` | protected |
| DELETE | `/api/shares/{id}` | -- | `{ success: true }` | `BoardShareService` | `deleteShare()` | protected |
| PUT | `/api/shares/{id}` | `ToggleShareRequest` | `BoardShare` | `BoardShareService` | `toggleShare()` | protected |
| GET | `/api/shared/{token}?password=` | query: `password` | `SharedBoardAccess` | `BoardShareService` | `accessSharedBoard()` | public |

---

## 25. Recurring Tasks

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/tasks/{task_id}/recurring` | -- | `RecurringTaskConfig` | `RecurringService` | `getConfig()` | protected |
| POST | `/api/tasks/{task_id}/recurring` | `CreateRecurringInput` | `RecurringTaskConfig` | `RecurringService` | `createConfig()` | protected |
| PUT | `/api/recurring/{id}` | `UpdateRecurringInput` | `RecurringTaskConfig` | `RecurringService` | `updateConfig()` | protected |
| DELETE | `/api/recurring/{id}` | -- | `{ success: true }` | `RecurringService` | `deleteConfig()` | protected |

---

## 26. Reports

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/reports?days=` | query: `days` | `BoardReport` | `ReportsService` | `getBoardReport()` | protected |

---

## 27. Admin: User Management

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/admin/users?search=&role=` | query: `search`, `role` | `Vec<AdminUserView>` | `AdminService` | `getUsers()` | admin |
| PUT | `/api/admin/users/{id}/role` | `UpdateRoleRequest` | `UserOperationResponse` | `AdminService` | `updateUserRole()` | admin |
| DELETE | `/api/admin/users/{id}` | -- | `UserOperationResponse` | `AdminService` | `deleteUser()` | admin |

---

## 28. Admin: Audit Log

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/admin/audit-log` | query: `cursor`, `page_size`, `user_id`, `action`, `entity_type`, `date_from`, `date_to`, `search` | `PaginatedAuditLog` | `AdminService` | `getAuditLog()` | admin |
| GET | `/api/admin/audit-log/actions` | -- | `AuditActionsResponse` | `AdminService` | `getAuditActions()` | admin |

---

## 29. Admin: Trash

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/admin/trash?entity_type=&cursor=&page_size=` | query params | `PaginatedTrashItems` | `AdminService` | `getTrashItems()` | admin |
| POST | `/api/admin/trash/restore` | `RestoreRequest` | `TrashOperationResponse` | `AdminService` | `restoreItem()` | admin |
| DELETE | `/api/admin/trash/{entity_type}/{entity_id}` | -- | `TrashOperationResponse` | `AdminService` | `permanentlyDelete()` | admin |
| DELETE | `/api/admin/trash/empty` | -- | `EmptyTrashResponse` | `AdminService` | `emptyTrash()` | admin |

---

## 30. Onboarding

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/onboarding/invitation-context?token=` | query: `token` | `InvitationContextResponse` | `OnboardingService` | `getInvitationContext()` | public |
| POST | `/api/onboarding/create-workspace` | `CreateWorkspaceRequest` | `CreateWorkspaceResponse` | `OnboardingService` | `createWorkspace()` | protected |
| POST | `/api/onboarding/invite-members` | `InviteMembersRequest` | `InviteMembersResponse` | `OnboardingService` | `inviteMembers()` | protected |
| POST | `/api/onboarding/generate-sample-board` | `GenerateSampleBoardRequest` | `GenerateSampleBoardResponse` | `OnboardingService` | `generateSampleBoard()` | protected |
| POST | `/api/onboarding/complete` | -- | `SuccessResponse` | `OnboardingService` | `completeOnboarding()` | protected |

---

## 31. Sessions

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/users/me/sessions` | -- | `Vec<SessionInfo>` | `SessionService` | `listSessions()` | protected |
| DELETE | `/api/users/me/sessions` | -- | `{ success, revoked_count }` | `SessionService` | `revokeAllOtherSessions()` | protected |
| DELETE | `/api/users/me/sessions/{id}` | -- | `{ success: true }` | `SessionService` | `revokeSession()` | protected |

---

## 32. Uploads

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| POST | `/api/uploads/avatar` | `UploadRequest` | `UploadResponse` | `UploadService` | `getAvatarUploadUrl()` | protected |
| POST | `/api/uploads/avatar/confirm` | `ConfirmRequest` | `{ avatar_url }` | `UploadService` | `confirmAvatarUpload()` | protected |
| POST | `/api/uploads/workspace-logo` | `UploadLogoRequest` | `UploadResponse` | `UploadService` | `getLogoUploadUrl()` | manager |
| POST | `/api/uploads/workspace-logo/confirm` | `ConfirmLogoRequest` | `{ logo_url }` | `UploadService` | `confirmLogoUpload()` | manager |

---

## 33. Webhooks

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/webhooks` | -- | `Vec<Webhook>` | `WebhookService` | `listWebhooks()` | protected |
| POST | `/api/boards/{board_id}/webhooks` | `CreateWebhookInput` | `Webhook` | `WebhookService` | `createWebhook()` | protected |
| PUT | `/api/webhooks/{id}` | `UpdateWebhookInput` | `Webhook` | `WebhookService` | `updateWebhook()` | protected |
| DELETE | `/api/webhooks/{id}` | -- | `{ success: true }` | `WebhookService` | `deleteWebhook()` | protected |
| GET | `/api/webhooks/{id}/deliveries?limit=` | query: `limit` | `Vec<WebhookDelivery>` | `WebhookService` | `getDeliveries()` | protected |

---

## 34. Project Templates

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/project-templates` | -- | `Vec<ProjectTemplate>` | `ProjectTemplateService` | `listTemplates()` | protected |
| POST | `/api/project-templates` | `CreateTemplateInput` | `ProjectTemplate` | `ProjectTemplateService` | `createTemplate()` | protected |
| GET | `/api/project-templates/{id}` | -- | `TemplateWithDetails` | `ProjectTemplateService` | `getTemplate()` | protected |
| DELETE | `/api/project-templates/{id}` | -- | `{ success: true }` | `ProjectTemplateService` | `deleteTemplate()` | protected |
| POST | `/api/project-templates/{id}/create-board` | `CreateBoardFromTemplateInput` | `{ board_id }` | `ProjectTemplateService` | `createBoardFromTemplate()` | protected |
| POST | `/api/boards/{board_id}/save-as-template` | `CreateTemplateFromBoardInput` | `ProjectTemplate` | `ProjectTemplateService` | `saveBoardAsTemplate()` | protected |

---

## 35. Task Templates

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/task-templates?scope=&board_id=` | query: `scope`, `board_id` | `Vec<TaskTemplate>` | `TaskTemplateService` | `list()` | protected |
| POST | `/api/task-templates` | `CreateTaskTemplateInput` | `TaskTemplate` | `TaskTemplateService` | `create()` | protected |
| GET | `/api/task-templates/{id}` | -- | `TaskTemplateWithDetails` | `TaskTemplateService` | `get()` | protected |
| PUT | `/api/task-templates/{id}` | `UpdateTaskTemplateInput` | `TaskTemplate` | `TaskTemplateService` | `update()` | protected |
| DELETE | `/api/task-templates/{id}` | -- | `{ success: true }` | `TaskTemplateService` | `delete()` | protected |
| POST | `/api/tasks/{task_id}/save-as-template` | `SaveAsTemplateRequest` | `TaskTemplate` | `TaskTemplateService` | `saveTaskAsTemplate()` | protected |
| POST | `/api/task-templates/{id}/create-task` | `CreateFromTemplateRequest` | `{ task_id }` | `TaskTemplateService` | `createTaskFromTemplate()` | protected |

---

## 36. Invitations

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| POST | `/api/invitations` | `CreateInvitationRequest` | `InvitationResponse` | `InvitationService` / `WorkspaceService` | `create()` / `inviteMember()` | protected |
| GET | `/api/invitations?workspace_id=` | query: `workspace_id` | `Vec<InvitationResponse>` | `InvitationService` | `listByWorkspace()` | protected |
| POST | `/api/invitations/bulk` | `BulkCreateInvitationRequest` | `BulkCreateInvitationResponse` | `WorkspaceService` | `bulkInviteMembers()` | protected |
| GET | `/api/invitations/all?workspace_id=` | query: `workspace_id` | `Vec<InvitationWithStatusResponse>` | `WorkspaceService` | `listAllInvitations()` | protected |
| GET | `/api/invitations/validate/{token}` | -- | `InvitationValidateResponse` | `InvitationService` | `validate()` | public |
| POST | `/api/invitations/accept` | `AcceptInvitationRequest` | `AcceptInvitationResponse` | `InvitationService` | `accept()` | public |
| DELETE | `/api/invitations/{id}` | -- | `{ success: true }` | `InvitationService` / `WorkspaceService` | `cancel()` / `cancelInvitation()` | protected |
| POST | `/api/invitations/{id}/resend` | -- | `InvitationResponse` | `InvitationService` / `WorkspaceService` | `resend()` / `resendInvitation()` | protected |

---

## 37. Tenant

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/tenant/members` | -- | `Vec<TenantMemberInfo>` | `WorkspaceService` | `listTenantMembers()` | protected |
| GET | `/api/tenant/members/{user_id}/workspaces` | -- | `Vec<UserWorkspaceMembership>` | `WorkspaceService` | `getUserWorkspaces()` | protected |

---

## 38. Themes

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/themes?is_dark=` | query: `is_dark` | `ThemesResponse` | `ThemeApiService` | `listThemes()` | public |
| GET | `/api/themes/{slug}` | -- | `Theme` | `ThemeApiService` | `getTheme()` | public |

---

## 39. User Preferences

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/users/me/preferences` | -- | `UserPreferences` | `UserPreferencesService` | `getPreferences()` | protected |
| PUT | `/api/users/me/preferences` | `UpdatePreferencesRequest` | `UserPreferences` | `UserPreferencesService` | `updatePreferences()` / `updateThemePreferences()` | protected |

---

## 40. API Keys

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| POST | `/api/workspaces/{ws_id}/api-keys` | `CreateApiKeyRequest` | `CreateApiKeyResponse` | `ApiKeyService` | `createKey()` | manager |
| GET | `/api/workspaces/{ws_id}/api-keys` | -- | `Vec<ApiKeyListItem>` | `ApiKeyService` | `listKeys()` | manager |
| DELETE | `/api/workspaces/{ws_id}/api-keys/{key_id}` | -- | `{ success: true }` | `ApiKeyService` | `revokeKey()` | manager |

---

## 41. Export / Import

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/export?format=csv\|json` | query: `format` | CSV blob or `ExportBoardJson` | `ImportExportService` | `exportCsv()` / `exportJson()` | protected |
| POST | `/api/boards/{board_id}/import` | `Vec<ImportTaskItem>` | `ImportResult` | `ImportExportService` | `importJson()` | protected |
| POST | `/api/boards/{board_id}/import/csv` | `ImportCsvBody` | `ImportResult` | `ImportExportService` | `importCsv()` | protected |
| POST | `/api/boards/{board_id}/import/trello` | `TrelloExport` | `TrelloImportResult` | `ImportExportService` | `importTrello()` | protected |

---

## 42. Teams (Groups)

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/workspaces/{ws_id}/teams` | -- | `Vec<TeamResponse>` | `TeamGroupsService` | `listTeams()` | protected |
| POST | `/api/workspaces/{ws_id}/teams` | `CreateTeamRequest` | `TeamDetailResponse` | `TeamGroupsService` | `createTeam()` | manager |
| GET | `/api/teams/{id}` | -- | `TeamDetailResponse` | `TeamGroupsService` | `getTeam()` | protected |
| PUT | `/api/teams/{id}` | `UpdateTeamRequest` | `TeamDetailResponse` | `TeamGroupsService` | `updateTeam()` | manager |
| DELETE | `/api/teams/{id}` | -- | `MessageResponse` | `TeamGroupsService` | `deleteTeam()` | manager |
| POST | `/api/teams/{id}/members` | `AddTeamMemberRequest` | `MessageResponse` | `TeamGroupsService` | `addMember()` | manager |
| DELETE | `/api/teams/{id}/members/{user_id}` | -- | `MessageResponse` | `TeamGroupsService` | `removeMember()` | manager |

---

## 43. Team Overview (Workload)

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/workspaces/{ws_id}/team-workload` | -- | `Vec<MemberWorkload>` | `TeamService` | `getTeamWorkload()` | manager |
| GET | `/api/workspaces/{ws_id}/overloaded-members?threshold=` | query: `threshold` | `Vec<OverloadedMember>` | `TeamService` | `getOverloadedMembers()` | manager |
| GET | `/api/workspaces/{ws_id}/members/{user_id}/tasks` | -- | `Vec<MemberTask>` | `TeamService` | `getMemberTasks()` | manager |
| POST | `/api/workspaces/{ws_id}/reassign-tasks` | `ReassignTasksRequest` | `ReassignTasksResponse` | `TeamService` | `reassignTasks()` | manager |

---

## 44. Positions

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/boards/{board_id}/positions` | -- | `Vec<PositionWithHolders>` | `PositionService` | `listPositions()` | protected |
| POST | `/api/boards/{board_id}/positions` | `CreatePositionRequest` | `PositionWithHolders` | `PositionService` | `createPosition()` | manager |
| GET | `/api/positions/{id}` | -- | `PositionWithHolders` | `PositionService` | `getPosition()` | protected |
| PUT | `/api/positions/{id}` | `UpdatePositionRequest` | `PositionWithHolders` | `PositionService` | `updatePosition()` | manager |
| DELETE | `/api/positions/{id}` | -- | `MessageResponse` | `PositionService` | `deletePosition()` | manager |
| POST | `/api/positions/{id}/holders` | `AddHolderRequest` | `MessageResponse` | `PositionService` | `addHolder()` | manager |
| DELETE | `/api/positions/{id}/holders/{user_id}` | -- | `MessageResponse` | `PositionService` | `removeHolder()` | manager |
| GET | `/api/positions/{id}/recurring-tasks` | -- | `Vec<RecurringTaskConfig>` | `PositionService` | `getPositionRecurringTasks()` | protected |

---

## 45. Health

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/health` | -- | `HealthResponse` | -- | -- | public |
| GET | `/api/health/live` | -- | `200` | -- | -- | public |
| GET | `/api/health/ready` | -- | `200` or `503` | -- | -- | public |

---

## 46. Cron Jobs

| Method | Path | Request DTO (Rust) | Response DTO (Rust) | Frontend Service | Frontend Method | Auth |
|--------|------|---------------------|----------------------|------------------|-----------------|------|
| GET | `/api/cron/health` | -- | `CronHealthResponse` | -- | -- | public |
| GET | `/api/cron/deadline-scan` | -- | `DeadlineScanResult` | -- | -- | cron |
| GET | `/api/cron/weekly-digest` | -- | `WeeklyDigestResult` | -- | -- | cron |
| GET | `/api/cron/trash-cleanup` | -- | `TrashCleanupResult` | -- | -- | cron |
| POST | `/api/cron/recurring-tasks` | -- | `RecurringTasksResult` | -- | -- | cron |

---

## Summary

| Domain | Endpoints | Auth Tiers |
|--------|-----------|------------|
| Auth | 11 | public (7), protected (4) |
| Workspaces | 12 | protected (7), manager (5) |
| Boards | 11 | protected (8), manager (3) |
| Columns | 7 | protected (7) |
| Tasks | 8 | protected (8) |
| Task Views | 3 | protected (3) |
| Bulk Ops | 2 | protected (2) |
| Comments | 4 | protected (4) |
| Subtasks | 6 | protected (6) |
| Dashboard | 7 | protected (7) |
| My Tasks | 2 | protected (2) |
| Notifications | 4 | protected (4) |
| Notification Prefs | 3 | protected (3) |
| Search | 1 | protected (1) |
| Favorites | 4 | protected (4) |
| Activity Log | 1 | protected (1) |
| Archive | 3 | protected (2), admin (1) |
| Attachments | 5 | protected (5) |
| Automations | 6 | protected (6) |
| Milestones | 7 | protected (7) |
| Dependencies | 5 | protected (5) |
| Time Tracking | 8 | protected (8) |
| Custom Fields | 6 | protected (6) |
| Task Groups | 7 | protected (7) |
| Eisenhower | 3 | protected (3) |
| Board Sharing | 5 | protected (4), public (1) |
| Recurring | 4 | protected (4) |
| Reports | 1 | protected (1) |
| Admin Users | 3 | admin (3) |
| Admin Audit | 2 | admin (2) |
| Admin Trash | 4 | admin (4) |
| Onboarding | 5 | public (1), protected (4) |
| Sessions | 3 | protected (3) |
| Uploads | 4 | protected (2), manager (2) |
| Webhooks | 5 | protected (5) |
| Project Templates | 6 | protected (6) |
| Task Templates | 7 | protected (7) |
| Invitations | 8 | public (2), protected (6) |
| Tenant | 2 | protected (2) |
| Themes | 2 | public (2) |
| User Preferences | 2 | protected (2) |
| API Keys | 3 | manager (3) |
| Export/Import | 4 | protected (4) |
| Teams | 7 | protected (2), manager (5) |
| Team Overview | 4 | manager (4) |
| Positions | 8 | protected (3), manager (5) |
| Health | 3 | public (3) |
| Cron | 5 | public (1), cron (4) |
| **Total** | **~205** | |

export type NotificationEventType =
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_commented'
  | 'task_completed'
  | 'mention_in_comment'
  | 'task_updated_watcher'
  | 'task_reminder';

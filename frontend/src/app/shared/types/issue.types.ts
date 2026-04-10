// Issue types — mirrors backend/crates/db/src/models/issue.rs
//
// These values must match the Rust enum serde outputs (snake_case).

export type IssueStatus =
  | 'open'
  | 'in_progress'
  | 'on_hold'
  | 'closed'
  | 'reopened';

export type IssueSeverity =
  | 'none'
  | 'minor'
  | 'major'
  | 'critical'
  | 'show_stopper';

export type IssueClassification =
  | 'bug'
  | 'feature_request'
  | 'improvement'
  | 'task'
  | 'other';

export type IssueReproducibility =
  | 'always'
  | 'sometimes'
  | 'rarely'
  | 'unable'
  | 'not_applicable';

export type IssueResolutionType =
  | 'fixed'
  | 'wont_fix'
  | 'duplicate'
  | 'deferred'
  | 'not_a_bug'
  | 'cannot_reproduce';

/** Backend returns this for list + detail (joins reporter/assignee names). */
export interface Issue {
  id: string;
  project_id: string;
  tenant_id: string;
  issue_number: number;
  title: string;
  description: string | null;
  reporter_id: string;
  reporter_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  status: IssueStatus;
  severity: IssueSeverity;
  classification: IssueClassification;
  reproducibility: IssueReproducibility | null;
  module: string | null;
  affected_milestone_id: string | null;
  release_milestone_id: string | null;
  due_date: string | null;
  resolution_type: IssueResolutionType | null;
  resolution_notes: string | null;
  resolved_by_id: string | null;
  closed_at: string | null;
  flag: string;
  created_at: string;
  updated_at: string;
}

export interface IssueSummary {
  total: number;
  open: number;
  closed: number;
  critical: number;
  show_stopper: number;
}

export interface CreateIssueRequest {
  title: string;
  description?: string | null;
  assignee_id?: string | null;
  severity?: IssueSeverity;
  classification?: IssueClassification;
  reproducibility?: IssueReproducibility | null;
  module?: string | null;
  affected_milestone_id?: string | null;
  release_milestone_id?: string | null;
  due_date?: string | null;
  flag?: string;
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string | null;
  assignee_id?: string | null;
  status?: IssueStatus;
  severity?: IssueSeverity;
  classification?: IssueClassification;
  reproducibility?: IssueReproducibility | null;
  module?: string | null;
  affected_milestone_id?: string | null;
  release_milestone_id?: string | null;
  due_date?: string | null;
  flag?: string;
}

export interface ResolveIssueRequest {
  resolution_type: IssueResolutionType;
  resolution_notes?: string | null;
}

export interface IssueFilters {
  status?: IssueStatus;
  severity?: IssueSeverity;
  assignee_id?: string;
  reporter_id?: string;
  classification?: IssueClassification;
  search?: string;
}

// ============================================================
// UI metadata (labels, colors)
// ============================================================

export const ISSUE_STATUS_OPTIONS: ReadonlyArray<{
  value: IssueStatus;
  label: string;
  /** Semantic color token (use with CSS vars for theme awareness) */
  tone: 'open' | 'progress' | 'hold' | 'closed' | 'reopen';
}> = [
  { value: 'open', label: 'Open', tone: 'open' },
  { value: 'in_progress', label: 'In Progress', tone: 'progress' },
  { value: 'on_hold', label: 'On Hold', tone: 'hold' },
  { value: 'closed', label: 'Closed', tone: 'closed' },
  { value: 'reopened', label: 'Reopened', tone: 'reopen' },
];

export const ISSUE_SEVERITY_OPTIONS: ReadonlyArray<{
  value: IssueSeverity;
  label: string;
  /** Numeric weight for sorting; 0 = worst */
  weight: number;
}> = [
  { value: 'show_stopper', label: 'Show Stopper', weight: 0 },
  { value: 'critical', label: 'Critical', weight: 1 },
  { value: 'major', label: 'Major', weight: 2 },
  { value: 'minor', label: 'Minor', weight: 3 },
  { value: 'none', label: 'None', weight: 4 },
];

export const ISSUE_CLASSIFICATION_OPTIONS: ReadonlyArray<{
  value: IssueClassification;
  label: string;
}> = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'improvement', label: 'Improvement' },
  { value: 'task', label: 'Task' },
  { value: 'other', label: 'Other' },
];

export const ISSUE_REPRODUCIBILITY_OPTIONS: ReadonlyArray<{
  value: IssueReproducibility;
  label: string;
}> = [
  { value: 'always', label: 'Always' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'unable', label: 'Unable to reproduce' },
  { value: 'not_applicable', label: 'Not applicable' },
];

export const ISSUE_RESOLUTION_OPTIONS: ReadonlyArray<{
  value: IssueResolutionType;
  label: string;
}> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'wont_fix', label: "Won't Fix" },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'deferred', label: 'Deferred' },
  { value: 'not_a_bug', label: 'Not a Bug' },
  { value: 'cannot_reproduce', label: 'Cannot Reproduce' },
];

export function severityLabel(v: IssueSeverity): string {
  return ISSUE_SEVERITY_OPTIONS.find(o => o.value === v)?.label ?? v;
}

export function statusLabel(v: IssueStatus): string {
  return ISSUE_STATUS_OPTIONS.find(o => o.value === v)?.label ?? v;
}

export function isIssueOpen(i: Pick<Issue, 'status'>): boolean {
  return i.status !== 'closed';
}

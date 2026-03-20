export interface WorkspaceMemberInfo {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  joined_at: string;
  is_org_admin: boolean;
}

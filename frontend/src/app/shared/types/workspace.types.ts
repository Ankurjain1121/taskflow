export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberInfo {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'member' | 'viewer';
  joined_at: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  tenant_id: string;
  created_by_id: string;
  color: string | null;
  icon: string | null;
  status: 'active' | 'archived';
  key_prefix: string | null;
  task_counter: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectColumn {
  id: string;
  name: string;
  project_id: string;
  position: string;
  color: string | null;
  status_mapping: Record<string, any> | null;
  created_at: string;
}

export interface ProjectMemberInfo {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: 'owner' | 'manager' | 'viewer' | 'editor';
  joined_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateProjectRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

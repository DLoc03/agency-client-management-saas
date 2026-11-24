export interface TeamMember {
  id: number;
  name: string;
  email: string;
  job_title?: string | null;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  lead_id: number | null;
  lead: { id: number; name: string; email: string } | null;
  members_count: number | null;
  members?: TeamMember[];
  created_at: string | null;
  updated_at: string | null;
}

export interface DirectoryUser {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
  phone: string | null;
  locale: string;
  is_active: boolean;
  roles: { id: number; key: string; name: string }[];
  teams: { id: number; name: string }[];
  open_tasks_count?: number;
}

export interface Invitation {
  id: number;
  email: string;
  roles: { id: number; key: string; name: string }[];
  expires_at: string;
  invited_by: { id: number; name: string } | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
}

export interface WorkloadRow {
  user_id: number;
  name: string;
  email: string;
  open_tasks: number;
  overdue_tasks: number;
  due_next_7_days: number;
  projects_count: number;
}

export interface RoleOption {
  id: number;
  key: string;
  name: string;
}
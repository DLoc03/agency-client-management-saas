export type ProjectStatus = "draft" | "in_progress" | "on_hold" | "completed" | "cancelled";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type MilestoneStatus = "planned" | "in_progress" | "completed";

export interface ProjectClient {
  id: number;
  name: string;
}

export interface ProjectManager {
  id: number;
  name: string;
  email: string;
}

export interface ProjectMember {
  id: number;
  name: string;
  email: string;
  via_team_id: number | null;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  client: ProjectClient | null;
  project_manager: ProjectManager | null;
  start_date: string | null;
  due_date: string | null;
  budget: string | number | null;
  tasks_count: number | null;
  tasks_done_count: number | null;
  progress_percent: number | null;
  milestones_count: number | null;
  invoiced_total: string | number | null;
  collected_total: string | number | null;
  remaining_budget: string | number | null;
  members?: ProjectMember[];
  created_at: string | null;
  updated_at: string | null;
}

export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  tasks_count: number | null;
  tasks_done_count: number | null;
  progress_percent: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  milestone: { id: number; name: string } | null;
  assignee: { id: number; name: string; email: string } | null;
  project: { id: number; name: string } | null;
  due_date: string | null;
  completed_at: string | null;
  position: number | null;
  checklist?: ChecklistItem[];
  comments?: TaskComment[];
  created_at: string | null;
  updated_at: string | null;
}

export interface TaskComment {
  id: number;
  body: string;
  author: { id: number; name: string; email?: string } | null;
  author_id?: number;
  created_at: string | null;
}

export interface ChecklistItem {
  id: number;
  title: string;
  is_done: boolean;
  position: number | null;
}

export interface TimelineItem {
  type: "milestone" | "task";
  id: number;
  name: string;
  status: string;
  due_date: string | null;
  progress_percent?: number;
  priority?: string;
  assignee?: { id: number; name: string } | null;
}

export interface Paginated<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
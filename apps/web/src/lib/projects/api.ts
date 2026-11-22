import type {
  ChecklistItem,
  Milestone,
  Paginated,
  Project,
  Task,
  TaskComment,
  TimelineItem,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export async function listProjects(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await request<Paginated<Project>>(`/api/projects${q ? `?${q}` : ""}`);
  return res.data || [];
}

export async function getProject(id: number) {
  const res = await request<{ data: Project }>(`/api/projects/${id}`);
  return res.data;
}

export async function createProject(payload: Record<string, unknown>) {
  const res = await request<{ data: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateProject(id: number, payload: Record<string, unknown>) {
  const res = await request<{ data: Project }>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteProject(id: number) {
  await request(`/api/projects/${id}`, { method: "DELETE" });
}

export async function listMembers(projectId: number) {
  const res = await request<{ data: { id: number; name: string; email: string }[] }>(
    `/api/projects/${projectId}/members`
  );
  return res.data || [];
}

export async function addMember(projectId: number, userId: number) {
  const res = await request<{ data: unknown }>(`/api/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  return res.data;
}

export async function removeMember(projectId: number, userId: number) {
  await request(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });
}

export async function listMilestones(projectId: number) {
  const res = await request<Paginated<Milestone>>(`/api/projects/${projectId}/milestones`);
  return res.data || [];
}

export async function createMilestone(projectId: number, payload: Record<string, unknown>) {
  const res = await request<{ data: Milestone }>(`/api/projects/${projectId}/milestones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateMilestone(
  projectId: number,
  milestoneId: number,
  payload: Record<string, unknown>
) {
  const res = await request<{ data: Milestone }>(
    `/api/projects/${projectId}/milestones/${milestoneId}`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );
  return res.data;
}

export async function deleteMilestone(projectId: number, milestoneId: number) {
  await request(`/api/projects/${projectId}/milestones/${milestoneId}`, { method: "DELETE" });
}

export async function listTasks(projectId: number, params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await request<Paginated<Task>>(`/api/projects/${projectId}/tasks${q ? `?${q}` : ""}`);
  return res.data || [];
}

export async function createTask(projectId: number, payload: Record<string, unknown>) {
  const res = await request<{ data: Task }>(`/api/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function getTask(id: number) {
  const res = await request<{ data: Task }>(`/api/tasks/${id}`);
  return res.data;
}

export async function updateTask(id: number, payload: Record<string, unknown>) {
  const res = await request<{ data: Task }>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteTask(id: number) {
  await request(`/api/tasks/${id}`, { method: "DELETE" });
}

export async function getTimeline(projectId: number) {
  const res = await request<{ data: TimelineItem[] }>(`/api/projects/${projectId}/timeline`);
  return res.data || [];
}

export async function listComments(taskId: number) {
  const res = await request<Paginated<TaskComment>>(`/api/tasks/${taskId}/comments`);
  return res.data || [];
}

export async function addComment(taskId: number, body: string) {
  const res = await request<{ data: TaskComment }>(`/api/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return res.data;
}

export async function deleteComment(taskId: number, commentId: number) {
  await request(`/api/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" });
}

export async function listChecklist(taskId: number) {
  const res = await request<Paginated<ChecklistItem>>(`/api/tasks/${taskId}/checklist`);
  return res.data || [];
}

export async function addChecklistItem(taskId: number, title: string) {
  const res = await request<{ data: ChecklistItem }>(`/api/tasks/${taskId}/checklist`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return res.data;
}

export async function updateChecklistItem(taskId: number, itemId: number, payload: Record<string, unknown>) {
  const res = await request<{ data: ChecklistItem }>(`/api/tasks/${taskId}/checklist/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteChecklistItem(taskId: number, itemId: number) {
  await request(`/api/tasks/${taskId}/checklist/${itemId}`, { method: "DELETE" });
}

export async function listClients() {
  const res = await request<Paginated<{ id: number; name: string }>>(`/api/clients`);
  return res.data || [];
}
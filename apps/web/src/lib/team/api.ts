import type {
  AcceptInvitationResult,
  DirectoryUser,
  Invitation,
  InvitationPreview,
  Team,
  WorkloadRow,
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
    const err = new Error(msg) as Error & { code?: string; status?: number };
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

function paginated<T>(res: { data?: T[] }) {
  return res.data || [];
}

export async function listTeams(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  const q = qs.toString();
  const res = await request<{ data: Team[] }>(`/api/teams${q ? `?${q}` : ""}`);
  return paginated(res);
}

export async function getTeam(id: number) {
  const res = await request<{ data: Team }>(`/api/teams/${id}`);
  return res.data;
}

export async function createTeam(payload: Record<string, unknown>) {
  const res = await request<{ data: Team }>("/api/teams", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateTeam(id: number, payload: Record<string, unknown>) {
  const res = await request<{ data: Team }>(`/api/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteTeam(id: number) {
  await request(`/api/teams/${id}`, { method: "DELETE" });
}

export async function addTeamMember(teamId: number, userId: number) {
  const res = await request<{ data: Team }>(`/api/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  return res.data;
}

export async function removeTeamMember(teamId: number, userId: number) {
  await request(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
}

export async function listUsers(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  });
  const q = qs.toString();
  const res = await request<{ data: DirectoryUser[] }>(`/api/users${q ? `?${q}` : ""}`);
  return paginated(res);
}

export async function getUser(id: number) {
  const res = await request<{ data: DirectoryUser }>(`/api/users/${id}`);
  return res.data;
}

export async function updateUser(id: number, payload: Record<string, unknown>) {
  const res = await request<{ data: DirectoryUser }>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateUserRoles(id: number, roleIds: number[]) {
  const res = await request<{ data: DirectoryUser }>(`/api/users/${id}/roles`, {
    method: "PUT",
    body: JSON.stringify({ role_ids: roleIds }),
  });
  return res.data;
}

export async function updateUserActivation(id: number, isActive: boolean) {
  const res = await request<{ data: DirectoryUser }>(`/api/users/${id}/activation`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
  return res.data;
}

export async function listInvitations() {
  const res = await request<{ data: Invitation[] }>("/api/invitations");
  return paginated(res);
}

export async function createInvitation(payload: Record<string, unknown>) {
  const res = await request<{ data: Invitation }>("/api/invitations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function resendInvitation(id: number) {
  const res = await request<{ data: Invitation }>(`/api/invitations/${id}/resend`, {
    method: "POST",
  });
  return res.data;
}

export async function revokeInvitation(id: number) {
  await request(`/api/invitations/${id}`, { method: "DELETE" });
}

export async function previewInvitation(
  token: string,
  options: { portal?: boolean } = {}
) {
  const base = options.portal
    ? "/api/portal/invitations/preview"
    : "/api/invitations/preview";
  const res = await request<{ data: InvitationPreview }>(
    `${base}?token=${encodeURIComponent(token)}`
  );
  return res.data;
}

export async function acceptInvitation(
  payload: { token: string; name?: string; password?: string },
  options: { portal?: boolean } = {}
) {
  const base = options.portal
    ? "/api/portal/invitations/accept"
    : "/api/invitations/accept";
  const res = await request<{ data: AcceptInvitationResult }>(base, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function getWorkload() {
  const res = await request<{ data: WorkloadRow[] }>("/api/workload");
  return paginated(res);
}

export async function assignTeamToProject(projectId: number, teamId: number) {
  const res = await request<{ data: { added_user_ids: number[]; members: { id: number; name: string; email: string; via_team_id: number | null }[] } }>(
    `/api/projects/${projectId}/teams`,
    { method: "POST", body: JSON.stringify({ team_id: teamId }) }
  );
  return res.data;
}

export async function removeTeamFromProject(projectId: number, teamId: number) {
  const res = await request<{ data: { removed_user_ids: number[]; kept_user_ids: number[]; members: { id: number; name: string; email: string; via_team_id: number | null }[] } }>(
    `/api/projects/${projectId}/teams/${teamId}`,
    { method: "DELETE" }
  );
  return res.data;
}
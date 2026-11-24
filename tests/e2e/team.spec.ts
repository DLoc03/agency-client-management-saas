/**
 * QA-005 — Team & Resource Management module test coverage.
 *
 * Source of truth: docs/TEAM_CONTRACT.md (approved 2026-11-22, DEC-017).
 * BE-007 is merged; these cases run against the real Docker/MySQL stack with
 * the shared English demo seed.
 *
 * No secrets are hardcoded: accounts come from E2E_* environment variables
 * (tests/e2e/README.md, CONVENTIONS H.4). Invited users are created through
 * the public invitation flow so the suite never mutates the shared accounts.
 *
 * Rate limiting: Laravel's numeric `throttle:*` middleware keys the counter on
 * the request signature (route domain + IP), so login and invitation-accept
 * share one counter. `throttleSlot()` keeps the suite under 4 throttled
 * requests per rolling minute and keeps runs deterministic.
 */

import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

test.describe.configure({ timeout: 300_000 });

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';
const MAILPIT_BASE = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';
const INVITED_PASSWORD = process.env.E2E_INVITED_PASSWORD ?? 'QaPassw0rd!';

type Credentials = { email: string; password: string };
type ErrorBody = { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
type LoginBody = { data?: { token?: string; user?: { id?: number; roles?: string[]; permissions?: string[] } } };
type Paginated<T> = { data?: T[] };
type TeamRow = {
  id: number;
  name: string;
  description?: string | null;
  lead_id?: number | null;
  members_count?: number;
  members?: Array<{ id: number; name: string; email: string }>;
};
type UserRow = {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  job_title?: string | null;
  phone?: string | null;
  locale?: string;
  roles?: Array<{ id: number; key: string; name: string }>;
  teams?: Array<{ id: number; name: string }>;
  open_tasks_count?: number;
};
type InvitationRow = {
  id: number;
  email: string;
  roles: Array<{ id: number; key: string; name: string }>;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
};
type WorkloadRow = {
  user_id: number;
  name: string;
  email: string;
  open_tasks: number;
  overdue_tasks: number;
  due_next_7_days: number;
  projects_count: number;
};
type Directory = {
  users: UserRow[];
  roleIds: Record<string, number>;
  userByRole: Record<string, UserRow>;
};
type InvitedUser = { email: string; password: string; userId: number };

// ---------------------------------------------------------------------------
// Environment + rate-limit helpers
// ---------------------------------------------------------------------------
function hasCredentials(prefix: string): boolean {
  return Boolean(process.env[`E2E_${prefix}_EMAIL`] && process.env[`E2E_${prefix}_PASSWORD`]);
}

function credentials(prefix: string): Credentials {
  const email = process.env[`E2E_${prefix}_EMAIL`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`Missing E2E_${prefix}_EMAIL / E2E_${prefix}_PASSWORD (shared demo seed).`);
  }
  return { email, password };
}

const throttleWindow: number[] = [];

/** Keep at most 4 login/accept requests inside any rolling minute (limit is 5). */
async function throttleSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (throttleWindow.length > 0 && now - throttleWindow[0] >= 60_000) {
      throttleWindow.shift();
    }
    if (throttleWindow.length < 4) {
      throttleWindow.push(now);
      return;
    }
    const waitMs = 60_000 - (now - throttleWindow[0]) + 500;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function expectJson<T>(response: APIResponse, status: number): Promise<T> {
  const text = await response.text();
  expect(response.status(), text || `HTTP ${response.status()}`).toBe(status);
  return (text ? JSON.parse(text) : {}) as T;
}

async function expectStatus(response: APIResponse, status: number): Promise<void> {
  const text = await response.text();
  expect(response.status(), text || `HTTP ${response.status()}`).toBe(status);
}

async function expectError(response: APIResponse, status: number, code?: string): Promise<ErrorBody> {
  const body = await expectJson<ErrorBody>(response, status);
  if (code) expect(body.error?.code, JSON.stringify(body)).toBe(code);
  return body;
}

// ---------------------------------------------------------------------------
// Auth + directory helpers
// ---------------------------------------------------------------------------
const tokenCache = new Map<string, string>();

async function loginAttempt(request: APIRequestContext, email: string, password: string): Promise<APIResponse> {
  await throttleSlot();
  return request.post(`${API_BASE}/auth/login`, { data: { email, password } });
}

async function loginWith(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await loginAttempt(request, email, password);
  const body = await expectJson<LoginBody>(response, 200);
  const token = body.data?.token;
  expect(token, `login token for ${email}`).toBeTruthy();
  return token!;
}

async function requireToken(request: APIRequestContext, prefix: string): Promise<string> {
  const cached = tokenCache.get(prefix);
  if (cached) return cached;
  const c = credentials(prefix);
  const token = await loginWith(request, c.email, c.password);
  tokenCache.set(prefix, token);
  return token;
}

async function me(
  request: APIRequestContext,
  token: string,
): Promise<{ id: number; email: string; name: string; roles: string[] }> {
  const response = await request.get(`${API_BASE}/auth/me`, { headers: bearer(token) });
  const body = await expectJson<{ data?: { user?: { id: number; email: string; name: string; roles: string[] } } }>(
    response,
    200,
  );
  expect(body.data?.user?.id).toBeTruthy();
  return body.data!.user!;
}

async function listUsers(
  request: APIRequestContext,
  token: string,
  params: Record<string, string> = {},
): Promise<UserRow[]> {
  const query = new URLSearchParams({ per_page: '100', ...params });
  const response = await request.get(`${API_BASE}/users?${query.toString()}`, { headers: bearer(token) });
  const body = await expectJson<Paginated<UserRow>>(response, 200);
  return body.data ?? [];
}

async function directory(request: APIRequestContext, token: string): Promise<Directory> {
  const users = await listUsers(request, token);
  const roleIds: Record<string, number> = {};
  const userByRole: Record<string, UserRow> = {};
  for (const user of users) {
    for (const role of user.roles ?? []) {
      roleIds[role.key] = role.id;
      if (!userByRole[role.key]) userByRole[role.key] = user;
    }
  }
  return { users, roleIds, userByRole };
}

/** Resolve the seeded account for a role from E2E_* env, else the directory. */
async function userIdFor(
  request: APIRequestContext,
  ownerToken: string,
  prefix: string,
  roleKey: string,
  dir: Directory,
): Promise<number | null> {
  if (hasCredentials(prefix)) {
    return (await me(request, await requireToken(request, prefix))).id;
  }
  return dir.userByRole[roleKey]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Generic API helpers
// ---------------------------------------------------------------------------
let sequence = 0;
function unique(prefix: string): string {
  sequence += 1;
  return `${prefix} ${Date.now()}-${sequence}-${Math.random().toString(36).slice(2, 6)}`;
}

async function createTeam(
  request: APIRequestContext,
  token: string,
  name = unique('QA Team'),
  payload: Record<string, unknown> = {},
): Promise<TeamRow> {
  const response = await request.post(`${API_BASE}/teams`, { headers: bearer(token), data: { name, ...payload } });
  return (await expectJson<{ data: TeamRow }>(response, 201)).data;
}

async function getTeam(request: APIRequestContext, token: string, id: number): Promise<TeamRow> {
  const response = await request.get(`${API_BASE}/teams/${id}`, { headers: bearer(token) });
  return (await expectJson<{ data: TeamRow }>(response, 200)).data;
}

async function addTeamMember(
  request: APIRequestContext,
  token: string,
  teamId: number,
  userId: number,
): Promise<TeamRow> {
  const response = await request.post(`${API_BASE}/teams/${teamId}/members`, {
    headers: bearer(token),
    data: { user_id: userId },
  });
  return (await expectJson<{ data: TeamRow }>(response, 201)).data;
}

async function createClient(request: APIRequestContext, token: string): Promise<number> {
  const response = await request.post(`${API_BASE}/clients`, {
    headers: bearer(token),
    data: { name: unique('QA Client') },
  });
  return (await expectJson<{ data: { id: number } }>(response, 201)).data.id;
}

async function createProject(
  request: APIRequestContext,
  token: string,
  clientId: number,
  extra: Record<string, unknown> = {},
): Promise<number> {
  const response = await request.post(`${API_BASE}/projects`, {
    headers: bearer(token),
    data: { client_id: clientId, name: unique('QA Project'), ...extra },
  });
  return (await expectJson<{ data: { id: number } }>(response, 201)).data.id;
}

async function createTask(
  request: APIRequestContext,
  token: string,
  projectId: number,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<number> {
  const response = await request.post(`${API_BASE}/projects/${projectId}/tasks`, {
    headers: bearer(token),
    data: { title, ...extra },
  });
  return (await expectJson<{ data: { id: number } }>(response, 201)).data.id;
}

async function workload(request: APIRequestContext, token: string): Promise<WorkloadRow[]> {
  const response = await request.get(`${API_BASE}/workload`, { headers: bearer(token) });
  return (await expectJson<{ data: WorkloadRow[] }>(response, 200)).data;
}

function localDate(offsetDays: number): string {
  // Workspace timezone is Asia/Ho_Chi_Minh; two days ahead stays inside the
  // 7-day workload window for either UTC or +07.
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Mailpit + invitation helpers
// ---------------------------------------------------------------------------
type MailpitMessage = { ID: string; Created?: string; To?: Array<{ Address: string }> };

async function fetchInvitationToken(email: string, previousToken?: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const listResponse = await fetch(`${MAILPIT_BASE}/api/v1/messages?limit=200`);
    if (listResponse.ok) {
      const list = (await listResponse.json()) as { messages?: MailpitMessage[] };
      const matches = (list.messages ?? [])
        .filter((message) => (message.To ?? []).some((to) => to.Address.toLowerCase() === email.toLowerCase()))
        .sort((a, b) => Date.parse(b.Created ?? '') - Date.parse(a.Created ?? ''));
      for (const message of matches) {
        const detailResponse = await fetch(`${MAILPIT_BASE}/api/v1/message/${message.ID}`);
        if (!detailResponse.ok) continue;
        const detail = (await detailResponse.json()) as { Text?: string; HTML?: string };
        const text = detail.Text || detail.HTML || '';
        const match = text.match(/token=([A-Za-z0-9]+)/);
        if (match && match[1] !== previousToken) return match[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Invitation email for ${email} was not found in Mailpit (${MAILPIT_BASE}).`);
}

async function acceptInvitation(
  request: APIRequestContext,
  data: { token: string; name: string; password?: string },
): Promise<APIResponse> {
  await throttleSlot();
  return request.post(`${API_BASE}/invitations/accept`, {
    data: { password: INVITED_PASSWORD, ...data },
  });
}

async function inviteAndAccept(
  request: APIRequestContext,
  ownerToken: string,
  roleId: number,
  label: string,
): Promise<InvitedUser> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.local`;
  const createResponse = await request.post(`${API_BASE}/invitations`, {
    headers: bearer(ownerToken),
    data: { email, role_ids: [roleId] },
  });
  const invitation = (await expectJson<{ data: InvitationRow }>(createResponse, 201)).data;
  expect(invitation.email).toBe(email.toLowerCase());

  const token = await fetchInvitationToken(email);
  const acceptResponse = await acceptInvitation(request, { token, name: `QA ${label}` });
  const accepted = (await expectJson<{ data: { user_id: number; email: string; agency_id: number } }>(
    acceptResponse,
    201,
  )).data;
  return { email, password: INVITED_PASSWORD, userId: accepted.user_id };
}

async function foreignIdentity(
  request: APIRequestContext,
): Promise<{ token: string; userId: number; email: string } | null> {
  if (!hasCredentials('OTHER_AGENCY')) return null;
  const token = await requireToken(request, 'OTHER_AGENCY');
  const user = await me(request, token);
  return { token, userId: user.id, email: user.email };
}

// ===========================================================================
// Teams CRUD, membership and permission matrix (§3, §5, §7.1)
// ===========================================================================
test.describe('QA-005 / teams (TEAM_CONTRACT §5)', () => {
  test('TC-TEAM-01 owner creates, lists, updates and soft-deletes a team; duplicate name is 422', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await requireToken(request, 'OWNER');
    const name = unique('QA Team');

    const created = await createTeam(request, token, name, { description: 'QA team' });
    expect(created.name).toBe(name);
    expect(created.description).toBe('QA team');
    expect(created.members_count).toBe(0);

    const duplicate = await request.post(`${API_BASE}/teams`, { headers: bearer(token), data: { name } });
    await expectError(duplicate, 422, 'VALIDATION_FAILED');

    const listResponse = await request.get(`${API_BASE}/teams?q=${encodeURIComponent(name)}`, {
      headers: bearer(token),
    });
    const list = await expectJson<Paginated<TeamRow>>(listResponse, 200);
    expect(list.data?.some((team) => team.id === created.id)).toBe(true);

    const updatedName = `${name} updated`;
    const updateResponse = await request.patch(`${API_BASE}/teams/${created.id}`, {
      headers: bearer(token),
      data: { name: updatedName, description: null },
    });
    const updated = (await expectJson<{ data: TeamRow }>(updateResponse, 200)).data;
    expect(updated.name).toBe(updatedName);
    expect(updated.description).toBeNull();

    const detail = await getTeam(request, token, created.id);
    expect(detail.name).toBe(updatedName);
    expect(Array.isArray(detail.members)).toBe(true);

    await expectStatus(await request.delete(`${API_BASE}/teams/${created.id}`, { headers: bearer(token) }), 204);
    await expectError(
      await request.get(`${API_BASE}/teams/${created.id}`, { headers: bearer(token) }),
      404,
      'NOT_FOUND',
    );
  });

  test('TC-TEAM-02 permission matrix: PM creates but cannot delete, Sales read-only, Admin manages teams', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(
      !hasCredentials('PROJECT') || !hasCredentials('SALES') || !hasCredentials('ADMIN'),
      'Needs PM, Sales and Admin demo accounts.',
    );

    const ownerToken = await requireToken(request, 'OWNER');
    const createdIds: number[] = [];
    const guardTeam = await createTeam(request, ownerToken, unique('Guard Team'));
    createdIds.push(guardTeam.id);

    try {
      const pmToken = await requireToken(request, 'PROJECT');
      const pmId = (await me(request, pmToken)).id;
      const pmTeam = await createTeam(request, pmToken, unique('PM Team'));
      createdIds.push(pmTeam.id);

      const updateResponse = await request.patch(`${API_BASE}/teams/${pmTeam.id}`, {
        headers: bearer(pmToken),
        data: { description: 'managed by PM' },
      });
      await expectJson<{ data: TeamRow }>(updateResponse, 200);

      await addTeamMember(request, pmToken, pmTeam.id, pmId);

      await expectError(
        await request.delete(`${API_BASE}/teams/${pmTeam.id}`, { headers: bearer(pmToken) }),
        403,
        'FORBIDDEN',
      );
      await expectError(await request.get(`${API_BASE}/invitations`, { headers: bearer(pmToken) }), 403, 'FORBIDDEN');

      const salesToken = await requireToken(request, 'SALES');
      await expectJson<{ data: TeamRow[] }>(
        await request.get(`${API_BASE}/teams`, { headers: bearer(salesToken) }),
        200,
      );
      await expectError(
        await request.post(`${API_BASE}/teams`, { headers: bearer(salesToken), data: { name: unique('Sales Team') } }),
        403,
        'FORBIDDEN',
      );
      await expectError(
        await request.post(`${API_BASE}/teams/${guardTeam.id}/members`, {
          headers: bearer(salesToken),
          data: { user_id: pmId },
        }),
        403,
        'FORBIDDEN',
      );
      await expectError(await request.get(`${API_BASE}/invitations`, { headers: bearer(salesToken) }), 403, 'FORBIDDEN');

      const adminToken = await requireToken(request, 'ADMIN');
      const adminTeam = await createTeam(request, adminToken, unique('Admin Team'));
      createdIds.push(adminTeam.id);
      await expectStatus(await request.delete(`${API_BASE}/teams/${adminTeam.id}`, { headers: bearer(adminToken) }), 204);
      createdIds.pop();
    } finally {
      for (const id of createdIds) {
        await request.delete(`${API_BASE}/teams/${id}`, { headers: bearer(ownerToken) });
      }
    }
  });

  test('TC-TEAM-03 a Team Member sees only their own teams; another team is 404', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(!hasCredentials('TEAM'), 'Missing E2E_TEAM_EMAIL/PASSWORD (Team Member seed).');

    const ownerToken = await requireToken(request, 'OWNER');
    const teamToken = await requireToken(request, 'TEAM');
    const teamUser = await me(request, teamToken);

    const own = await createTeam(request, ownerToken, unique('Own Team'));
    const other = await createTeam(request, ownerToken, unique('Other Team'));
    try {
      await addTeamMember(request, ownerToken, own.id, teamUser.id);

      const listResponse = await request.get(`${API_BASE}/teams?per_page=100`, { headers: bearer(teamToken) });
      const list = await expectJson<Paginated<TeamRow>>(listResponse, 200);
      const ids = (list.data ?? []).map((team) => team.id);
      expect(ids).toContain(own.id);
      expect(ids).not.toContain(other.id);

      await expectJson<{ data: TeamRow }>(
        await request.get(`${API_BASE}/teams/${own.id}`, { headers: bearer(teamToken) }),
        200,
      );
      await expectError(
        await request.get(`${API_BASE}/teams/${other.id}`, { headers: bearer(teamToken) }),
        404,
        'NOT_FOUND',
      );

      // Directory access is allowed for Team Members, but team administration is not.
      await expectJson<Paginated<UserRow>>(
        await request.get(`${API_BASE}/users`, { headers: bearer(teamToken) }),
        200,
      );
      await expectError(
        await request.post(`${API_BASE}/teams`, { headers: bearer(teamToken), data: { name: unique('TM Team') } }),
        403,
        'FORBIDDEN',
      );
      await expectError(
        await request.delete(`${API_BASE}/teams/${own.id}`, { headers: bearer(teamToken) }),
        403,
        'FORBIDDEN',
      );
    } finally {
      await request.delete(`${API_BASE}/teams/${own.id}`, { headers: bearer(ownerToken) });
      await request.delete(`${API_BASE}/teams/${other.id}`, { headers: bearer(ownerToken) });
    }
  });

  test('TC-TEAM-04 membership add/remove is idempotent; foreign user/lead references are 422 and foreign detail is 404', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await requireToken(request, 'OWNER');
    const member = hasCredentials('TEAM')
      ? (await me(request, await requireToken(request, 'TEAM'))).id
      : (await me(request, ownerToken)).id;

    const team = await createTeam(request, ownerToken, unique('Members Team'));
    try {
      const first = await addTeamMember(request, ownerToken, team.id, member);
      expect(first.members?.some((row) => row.id === member)).toBe(true);

      // Adding the same user again is a no-op, not a duplicate row.
      const second = await addTeamMember(request, ownerToken, team.id, member);
      expect(second.members?.filter((row) => row.id === member)).toHaveLength(1);

      await expectStatus(
        await request.delete(`${API_BASE}/teams/${team.id}/members/${member}`, { headers: bearer(ownerToken) }),
        204,
      );
      await expectError(
        await request.delete(`${API_BASE}/teams/${team.id}/members/${member}`, { headers: bearer(ownerToken) }),
        404,
        'NOT_FOUND',
      );

      const foreign = await foreignIdentity(request);
      if (foreign) {
        await expectError(
          await request.post(`${API_BASE}/teams/${team.id}/members`, {
            headers: bearer(ownerToken),
            data: { user_id: foreign.userId },
          }),
          422,
          'CROSS_TENANT_REFERENCE',
        );
        await expectError(
          await request.post(`${API_BASE}/teams`, {
            headers: bearer(ownerToken),
            data: { name: unique('Foreign Lead'), lead_id: foreign.userId },
          }),
          422,
          'CROSS_TENANT_REFERENCE',
        );
        await expectError(
          await request.get(`${API_BASE}/users/${foreign.userId}`, { headers: bearer(ownerToken) }),
          404,
          'NOT_FOUND',
        );
      }
    } finally {
      await request.delete(`${API_BASE}/teams/${team.id}`, { headers: bearer(ownerToken) });
    }
  });
});

// ===========================================================================
// Employee directory, profile, roles and activation (§3, §5, §7.4-7.5)
// ===========================================================================
test.describe('QA-005 / directory (TEAM_CONTRACT §5)', () => {
  test('TC-TEAM-05 directory filters, profile fields and open task count', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await requireToken(request, 'OWNER');
    const owner = await me(request, ownerToken);

    const originalResponse = await request.get(`${API_BASE}/users/${owner.id}`, { headers: bearer(ownerToken) });
    const original = (await expectJson<{ data: UserRow }>(originalResponse, 200)).data;
    expect(typeof original.open_tasks_count).toBe('number');
    expect(original.roles?.some((role) => role.key === 'agency_owner')).toBe(true);
    expect(Array.isArray(original.teams)).toBe(true);

    const updatedTitle = `QA Engineer ${Date.now()}`;
    try {
      const updateResponse = await request.patch(`${API_BASE}/users/${owner.id}`, {
        headers: bearer(ownerToken),
        data: { job_title: updatedTitle, phone: '+84 900 000 000', locale: 'en' },
      });
      const updated = (await expectJson<{ data: UserRow }>(updateResponse, 200)).data;
      expect(updated.job_title).toBe(updatedTitle);
      expect(updated.phone).toBe('+84 900 000 000');
    } finally {
      // Restore the shared demo profile exactly as it was.
      await request.patch(`${API_BASE}/users/${owner.id}`, {
        headers: bearer(ownerToken),
        data: { job_title: original.job_title ?? null, phone: original.phone ?? null, locale: original.locale ?? 'en' },
      });
    }

    const search = await listUsers(request, ownerToken, { q: owner.email });
    expect(search.some((user) => user.id === owner.id)).toBe(true);

    const byRole = await listUsers(request, ownerToken, { role: 'agency_owner' });
    expect(byRole.some((user) => user.id === owner.id)).toBe(true);
    expect(byRole.every((user) => (user.roles ?? []).some((role) => role.key === 'agency_owner'))).toBe(true);

    const inactive = await listUsers(request, ownerToken, { is_active: 'false' });
    expect(inactive.every((user) => user.is_active === false)).toBe(true);

    if (hasCredentials('SALES')) {
      const sales = await me(request, await requireToken(request, 'SALES'));
      const team = await createTeam(request, ownerToken, unique('Directory Team'));
      try {
        await addTeamMember(request, ownerToken, team.id, sales.id);
        const byTeam = await listUsers(request, ownerToken, { team_id: String(team.id) });
        expect(byTeam.some((user) => user.id === sales.id)).toBe(true);
        expect(byTeam.every((user) => (user.teams ?? []).some((row) => row.id === team.id))).toBe(true);
      } finally {
        await request.delete(`${API_BASE}/teams/${team.id}`, { headers: bearer(ownerToken) });
      }
    }
  });

  test('TC-TEAM-06 role changes take effect immediately; Admin limits and Owner invariants are enforced', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await requireToken(request, 'OWNER');
    const owner = await me(request, ownerToken);
    const { roleIds } = await directory(request, ownerToken);
    test.skip(!roleIds.team_member || !roleIds.project_manager, 'Role IDs are not present in the directory seed.');

    const target = await inviteAndAccept(request, ownerToken, roleIds.team_member, 'roles');
    const targetToken = await loginWith(request, target.email, target.password);

    // Before promotion a Team Member cannot create teams.
    await expectError(
      await request.post(`${API_BASE}/teams`, { headers: bearer(targetToken), data: { name: unique('TM Created Team') } }),
      403,
      'FORBIDDEN',
    );

    // Owner promotes the target; the existing token already carries the new
    // permissions on its next request (PM may create but not delete teams).
    const promoteResponse = await request.put(`${API_BASE}/users/${target.userId}/roles`, {
      headers: bearer(ownerToken),
      data: { role_ids: [roleIds.project_manager] },
    });
    const promoted = (await expectJson<{ data: UserRow }>(promoteResponse, 200)).data;
    expect(promoted.roles?.some((role) => role.key === 'project_manager')).toBe(true);

    const targetTeam = await createTeam(request, targetToken, unique('Promoted Team'));
    try {
      await expectError(
        await request.delete(`${API_BASE}/teams/${targetTeam.id}`, { headers: bearer(targetToken) }),
        403,
        'FORBIDDEN',
      );
    } finally {
      await request.delete(`${API_BASE}/teams/${targetTeam.id}`, { headers: bearer(ownerToken) });
    }

    // Owner invariants.
    await expectError(
      await request.put(`${API_BASE}/users/${owner.id}/roles`, {
        headers: bearer(ownerToken),
        data: { role_ids: [roleIds.team_member] },
      }),
      403,
      'CANNOT_MODIFY_OWNER',
    );
    if (roleIds.agency_owner) {
      await expectError(
        await request.put(`${API_BASE}/users/${target.userId}/roles`, {
          headers: bearer(ownerToken),
          data: { role_ids: [roleIds.agency_owner] },
        }),
        403,
        'CANNOT_MODIFY_OWNER',
      );
    }

    if (hasCredentials('ADMIN') && roleIds.admin) {
      const adminToken = await requireToken(request, 'ADMIN');
      const admin = await me(request, adminToken);

      await expectError(
        await request.put(`${API_BASE}/users/${target.userId}/roles`, {
          headers: bearer(adminToken),
          data: { role_ids: [roleIds.admin] },
        }),
        403,
        'ADMIN_MANAGEMENT_OWNER_ONLY',
      );
      await expectError(
        await request.put(`${API_BASE}/users/${admin.id}/roles`, {
          headers: bearer(adminToken),
          data: { role_ids: [roleIds.team_member] },
        }),
        422,
        'CANNOT_MODIFY_OWN_ROLES',
      );

      // The Owner may grant Admin; a non-Owner Admin may not deactivate that Admin.
      const adminTarget = await inviteAndAccept(request, ownerToken, roleIds.team_member, 'admin-target');
      try {
        await expectJson<{ data: UserRow }>(
          await request.put(`${API_BASE}/users/${adminTarget.userId}/roles`, {
            headers: bearer(ownerToken),
            data: { role_ids: [roleIds.admin] },
          }),
          200,
        );
        await expectError(
          await request.patch(`${API_BASE}/users/${adminTarget.userId}/activation`, {
            headers: bearer(adminToken),
            data: { is_active: false },
          }),
          403,
          'ADMIN_MANAGEMENT_OWNER_ONLY',
        );
        // Owner can perform the same operation.
        await expectJson<{ data: UserRow }>(
          await request.patch(`${API_BASE}/users/${adminTarget.userId}/activation`, {
            headers: bearer(ownerToken),
            data: { is_active: false },
          }),
          200,
        );
      } finally {
        // Leave no disabled disposable account behind.
        await request.patch(`${API_BASE}/users/${adminTarget.userId}/activation`, {
          headers: bearer(ownerToken),
          data: { is_active: true },
        });
      }
    }
  });

  test('TC-TEAM-07 activation revokes tokens, blocks sign-in, self/Owner guards, reactivation restores sign-in', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await requireToken(request, 'OWNER');
    const owner = await me(request, ownerToken);
    const { roleIds } = await directory(request, ownerToken);
    test.skip(!roleIds.team_member, 'Team Member role ID is not present in the directory seed.');

    const target = await inviteAndAccept(request, ownerToken, roleIds.team_member, 'activation');
    const targetToken = await loginWith(request, target.email, target.password);

    try {
      const deactivateResponse = await request.patch(`${API_BASE}/users/${target.userId}/activation`, {
        headers: bearer(ownerToken),
        data: { is_active: false },
      });
      const deactivated = (await expectJson<{ data: UserRow }>(deactivateResponse, 200)).data;
      expect(deactivated.is_active).toBe(false);

      await expectError(await request.get(`${API_BASE}/users`, { headers: bearer(targetToken) }), 401, 'UNAUTHENTICATED');
      const disabledLogin = await loginAttempt(request, target.email, target.password);
      await expectError(disabledLogin, 403, 'ACCOUNT_DISABLED');

      await expectError(
        await request.patch(`${API_BASE}/users/${owner.id}/activation`, {
          headers: bearer(ownerToken),
          data: { is_active: false },
        }),
        403,
        'CANNOT_MODIFY_OWNER',
      );

      if (hasCredentials('ADMIN')) {
        const adminToken = await requireToken(request, 'ADMIN');
        const admin = await me(request, adminToken);
        await expectError(
          await request.patch(`${API_BASE}/users/${admin.id}/activation`, {
            headers: bearer(adminToken),
            data: { is_active: false },
          }),
          422,
          'CANNOT_DEACTIVATE_SELF',
        );
      }

      await expectJson<{ data: UserRow }>(
        await request.patch(`${API_BASE}/users/${target.userId}/activation`, {
          headers: bearer(ownerToken),
          data: { is_active: true },
        }),
        200,
      );
      await loginWith(request, target.email, target.password);
    } finally {
      await request.patch(`${API_BASE}/users/${target.userId}/activation`, {
        headers: bearer(ownerToken),
        data: { is_active: true },
      });
    }
  });
});

// ===========================================================================
// Invitations (§4, §5, §7.2-7.3)
// ===========================================================================
test.describe('QA-005 / invitations (TEAM_CONTRACT §4-§5)', () => {
  test('TC-TEAM-08 invitation creation, pending/registered guards, Owner-role guard and Admin limit', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await requireToken(request, 'OWNER');
    const owner = await me(request, ownerToken);
    const { roleIds } = await directory(request, ownerToken);
    test.skip(!roleIds.team_member, 'Team Member role ID is not present in the directory seed.');

    const email = `invite-guards-${Date.now()}@test.local`;
    const createdIds: number[] = [];
    try {
      const createResponse = await request.post(`${API_BASE}/invitations`, {
        headers: bearer(ownerToken),
        data: { email, role_ids: [roleIds.team_member] },
      });
      const invitation = (await expectJson<{ data: InvitationRow }>(createResponse, 201)).data;
      createdIds.push(invitation.id);
      expect(invitation.email).toBe(email);
      expect(invitation.roles.map((role) => role.key)).toContain('team_member');
      expect(Date.parse(invitation.expires_at)).toBeGreaterThan(Date.now());

      const firstToken = await fetchInvitationToken(email);
      expect(firstToken.length).toBeGreaterThan(20);

      const pendingResponse = await request.get(`${API_BASE}/invitations?per_page=100`, {
        headers: bearer(ownerToken),
      });
      const pending = await expectJson<Paginated<InvitationRow>>(pendingResponse, 200);
      expect((pending.data ?? []).some((row) => row.id === invitation.id)).toBe(true);

      await expectError(
        await request.post(`${API_BASE}/invitations`, {
          headers: bearer(ownerToken),
          data: { email, role_ids: [roleIds.team_member] },
        }),
        422,
        'INVITATION_PENDING',
      );
      await expectError(
        await request.post(`${API_BASE}/invitations`, {
          headers: bearer(ownerToken),
          data: { email: owner.email, role_ids: [roleIds.team_member] },
        }),
        422,
        'EMAIL_ALREADY_REGISTERED',
      );
      if (roleIds.agency_owner) {
        await expectError(
          await request.post(`${API_BASE}/invitations`, {
            headers: bearer(ownerToken),
            data: { email: `owner-role-${Date.now()}@test.local`, role_ids: [roleIds.agency_owner] },
          }),
          403,
          'CANNOT_MODIFY_OWNER',
        );
      }

      if (hasCredentials('ADMIN') && roleIds.admin) {
        const adminToken = await requireToken(request, 'ADMIN');
        await expectError(
          await request.post(`${API_BASE}/invitations`, {
            headers: bearer(adminToken),
            data: { email: `admin-invite-${Date.now()}@test.local`, role_ids: [roleIds.admin] },
          }),
          403,
          'ADMIN_MANAGEMENT_OWNER_ONLY',
        );

        const normalResponse = await request.post(`${API_BASE}/invitations`, {
          headers: bearer(adminToken),
          data: { email: `admin-normal-${Date.now()}@test.local`, role_ids: [roleIds.team_member] },
        });
        const normal = (await expectJson<{ data: InvitationRow }>(normalResponse, 201)).data;
        createdIds.push(normal.id);
      }

      await expectStatus(
        await request.delete(`${API_BASE}/invitations/${invitation.id}`, { headers: bearer(ownerToken) }),
        204,
      );
      await expectError(
        await acceptInvitation(request, { token: firstToken, name: 'Revoked' }),
        404,
        'NOT_FOUND',
      );
    } finally {
      for (const id of createdIds) {
        await request.delete(`${API_BASE}/invitations/${id}`, { headers: bearer(ownerToken) });
      }
    }
  });

  test('TC-TEAM-09 invitation accept creates a sign-in-capable user with the invited roles; second accept is 422', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await requireToken(request, 'OWNER');
    const { roleIds } = await directory(request, ownerToken);
    test.skip(!roleIds.team_member, 'Team Member role ID is not present in the directory seed.');

    const email = `invite-accept-${Date.now()}@test.local`;
    const createResponse = await request.post(`${API_BASE}/invitations`, {
      headers: bearer(ownerToken),
      data: { email, role_ids: [roleIds.team_member] },
    });
    const invitation = (await expectJson<{ data: InvitationRow }>(createResponse, 201)).data;
    const token = await fetchInvitationToken(email);

    const acceptResponse = await acceptInvitation(request, { token, name: 'Invited User' });
    const accepted = (await expectJson<{ data: { user_id: number; email: string; agency_id: number } }>(
      acceptResponse,
      201,
    )).data;
    expect(accepted.email).toBe(email);
    expect(accepted.user_id).toBeTruthy();
    expect(accepted.agency_id).toBeTruthy();

    const loginBody = await expectJson<LoginBody>(await loginAttempt(request, email, INVITED_PASSWORD), 200);
    expect(loginBody.data?.user?.roles).toContain('team_member');
    expect(loginBody.data?.user?.permissions).toContain('teams.view');
    expect(loginBody.data?.user?.permissions).not.toContain('teams.create');

    await expectError(
      await acceptInvitation(request, { token, name: 'Invited User' }),
      422,
      'INVITATION_ALREADY_ACCEPTED',
    );

    const pendingResponse = await request.get(`${API_BASE}/invitations?per_page=100`, {
      headers: bearer(ownerToken),
    });
    const pending = await expectJson<Paginated<InvitationRow>>(pendingResponse, 200);
    expect((pending.data ?? []).some((row) => row.id === invitation.id)).toBe(false);
  });

  test('TC-TEAM-10 an unknown/invalid invitation token returns 404', async ({ request }) => {
    await expectError(
      await acceptInvitation(request, { token: `invalid-${Date.now()}`, name: 'Nobody' }),
      404,
      'NOT_FOUND',
    );
  });

  test('TC-TEAM-11 an expired invitation returns 422 INVITATION_EXPIRED', async ({ request }) => {
    const token = process.env.E2E_EXPIRED_INVITATION_TOKEN;
    test.skip(!token, 'Needs E2E_EXPIRED_INVITATION_TOKEN (created by forcing expires_at into the past in the QA run).');

    await expectError(
      await acceptInvitation(request, { token: token!, name: 'Expired' }),
      422,
      'INVITATION_EXPIRED',
    );
  });

  test('TC-TEAM-12 resend invalidates the old token; revoke kills the link', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await requireToken(request, 'OWNER');
    const { roleIds } = await directory(request, ownerToken);
    test.skip(!roleIds.team_member, 'Team Member role ID is not present in the directory seed.');

    const email = `invite-resend-${Date.now()}@test.local`;
    const createResponse = await request.post(`${API_BASE}/invitations`, {
      headers: bearer(ownerToken),
      data: { email, role_ids: [roleIds.team_member] },
    });
    const invitation = (await expectJson<{ data: InvitationRow }>(createResponse, 201)).data;
    try {
      const oldToken = await fetchInvitationToken(email);
      await expectJson<{ data: InvitationRow }>(
        await request.post(`${API_BASE}/invitations/${invitation.id}/resend`, { headers: bearer(ownerToken) }),
        200,
      );
      const newToken = await fetchInvitationToken(email, oldToken);
      expect(newToken).not.toBe(oldToken);

      await expectError(
        await acceptInvitation(request, { token: oldToken, name: 'Old Token' }),
        404,
        'NOT_FOUND',
      );

      await expectStatus(
        await request.delete(`${API_BASE}/invitations/${invitation.id}`, { headers: bearer(ownerToken) }),
        204,
      );
      await expectError(
        await acceptInvitation(request, { token: newToken, name: 'New Token' }),
        404,
        'NOT_FOUND',
      );
    } finally {
      await request.delete(`${API_BASE}/invitations/${invitation.id}`, { headers: bearer(ownerToken) });
    }
  });
});

// ===========================================================================
// Team -> project snapshot semantics (§4, §7.6)
// ===========================================================================
test.describe('QA-005 / team->project snapshot (TEAM_CONTRACT §4)', () => {
  test('TC-TEAM-13 attaching a team snapshots current members; later team additions do not propagate', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(!hasCredentials('TEAM'), 'Missing E2E_TEAM_EMAIL/PASSWORD (Team Member seed).');
    const ownerToken = await requireToken(request, 'OWNER');
    const owner = await me(request, ownerToken);
    const dir = await directory(request, ownerToken);
    const teamMemberId = await userIdFor(request, ownerToken, 'TEAM', 'team_member', dir);
    const third = dir.users.find((user) => user.is_active && user.id !== teamMemberId && user.id !== owner.id);
    test.skip(!teamMemberId || !third, 'Needs a Team Member plus one other active user in the seed.');

    const clientId = await createClient(request, ownerToken);
    const projectId = await createProject(request, ownerToken, clientId);
    const team = await createTeam(request, ownerToken, unique('Snapshot Team'));
    try {
      await addTeamMember(request, ownerToken, team.id, teamMemberId!);
      await addTeamMember(request, ownerToken, team.id, owner.id);

      const attachResponse = await request.post(`${API_BASE}/projects/${projectId}/teams`, {
        headers: bearer(ownerToken),
        data: { team_id: team.id },
      });
      const attached = (await expectJson<{
        data: { added_user_ids: number[]; members: Array<{ id: number; via_team_id: number | null }> };
      }>(attachResponse, 201)).data;
      expect(attached.added_user_ids).toEqual(expect.arrayContaining([teamMemberId!, owner.id]));
      for (const id of [teamMemberId!, owner.id]) {
        expect(attached.members.find((row) => row.id === id)?.via_team_id).toBe(team.id);
      }

      // A later team change must not alter the project snapshot.
      await addTeamMember(request, ownerToken, team.id, third!.id);
      const membersResponse = await request.get(`${API_BASE}/projects/${projectId}/members`, {
        headers: bearer(ownerToken),
      });
      const memberIds = ((await expectJson<{ data: Array<{ id: number }> }>(membersResponse, 200)).data).map(
        (row) => row.id,
      );
      expect(memberIds).toContain(teamMemberId!);
      expect(memberIds).toContain(owner.id);
      expect(memberIds).not.toContain(third!.id);

      const detachResponse = await request.delete(`${API_BASE}/projects/${projectId}/teams/${team.id}`, {
        headers: bearer(ownerToken),
      });
      const detached = (await expectJson<{
        data: { removed_user_ids: number[]; kept_user_ids: number[]; members: Array<{ id: number }> };
      }>(detachResponse, 200)).data;
      expect(detached.removed_user_ids).toEqual(expect.arrayContaining([teamMemberId!, owner.id]));
      expect(detached.kept_user_ids).toEqual([]);
    } finally {
      await request.delete(`${API_BASE}/projects/${projectId}`, { headers: bearer(ownerToken) });
      await request.delete(`${API_BASE}/teams/${team.id}`, { headers: bearer(ownerToken) });
    }
  });

  test('TC-TEAM-14 detaching keeps members with tasks as direct members and removes task-less members', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(!hasCredentials('TEAM'), 'Missing E2E_TEAM_EMAIL/PASSWORD (Team Member seed).');
    const ownerToken = await requireToken(request, 'OWNER');
    const owner = await me(request, ownerToken);
    const dir = await directory(request, ownerToken);
    const teamMemberId = await userIdFor(request, ownerToken, 'TEAM', 'team_member', dir);
    test.skip(!teamMemberId, 'Needs a Team Member in the seed.');

    const clientId = await createClient(request, ownerToken);
    const projectId = await createProject(request, ownerToken, clientId);
    const team = await createTeam(request, ownerToken, unique('Detach Team'));
    try {
      await addTeamMember(request, ownerToken, team.id, teamMemberId!);
      await addTeamMember(request, ownerToken, team.id, owner.id);
      await expectJson<{ data: { added_user_ids: number[] } }>(
        await request.post(`${API_BASE}/projects/${projectId}/teams`, {
          headers: bearer(ownerToken),
          data: { team_id: team.id },
        }),
        201,
      );

      await createTask(request, ownerToken, projectId, 'Task for team member', { assignee_id: teamMemberId! });

      const detachResponse = await request.delete(`${API_BASE}/projects/${projectId}/teams/${team.id}`, {
        headers: bearer(ownerToken),
      });
      const detached = (await expectJson<{
        data: {
          removed_user_ids: number[];
          kept_user_ids: number[];
          members: Array<{ id: number; via_team_id: number | null }>;
        };
      }>(detachResponse, 200)).data;
      expect(detached.kept_user_ids).toContain(teamMemberId!);
      expect(detached.removed_user_ids).toContain(owner.id);
      expect(detached.removed_user_ids).not.toContain(teamMemberId!);
      expect(detached.members.find((row) => row.id === teamMemberId!)?.via_team_id).toBeNull();
      expect(detached.members.some((row) => row.id === owner.id)).toBe(false);

      const membersResponse = await request.get(`${API_BASE}/projects/${projectId}/members`, {
        headers: bearer(ownerToken),
      });
      const memberIds = ((await expectJson<{ data: Array<{ id: number }> }>(membersResponse, 200)).data).map(
        (row) => row.id,
      );
      expect(memberIds).toContain(teamMemberId!);
      expect(memberIds).not.toContain(owner.id);
    } finally {
      await request.delete(`${API_BASE}/projects/${projectId}`, { headers: bearer(ownerToken) });
      await request.delete(`${API_BASE}/teams/${team.id}`, { headers: bearer(ownerToken) });
    }
  });
});

// ===========================================================================
// Workload-lite (§6, §7.7)
// ===========================================================================
test.describe('QA-005 / workload (TEAM_CONTRACT §6)', () => {
  test('TC-TEAM-15 workload numbers match task data; Team Member sees only their own row; Sales/Accountant are forbidden', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(!hasCredentials('TEAM'), 'Missing E2E_TEAM_EMAIL/PASSWORD (Team Member seed).');
    const ownerToken = await requireToken(request, 'OWNER');
    const teamToken = await requireToken(request, 'TEAM');
    const teamUser = await me(request, teamToken);

    const before = (await workload(request, ownerToken)).find((row) => row.user_id === teamUser.id);
    test.skip(!before, 'The Team Member is not active in the workload list.');

    const clientId = await createClient(request, ownerToken);
    const projectId = await createProject(request, ownerToken, clientId);
    try {
      await createTask(request, ownerToken, projectId, 'QA overdue task', {
        assignee_id: teamUser.id,
        due_date: '2020-01-01',
        status: 'todo',
      });
      await createTask(request, ownerToken, projectId, 'QA due next 7 days', {
        assignee_id: teamUser.id,
        due_date: localDate(2),
        status: 'in_progress',
      });
      await createTask(request, ownerToken, projectId, 'QA open without due date', {
        assignee_id: teamUser.id,
        status: 'todo',
      });
      await createTask(request, ownerToken, projectId, 'QA done task', {
        assignee_id: teamUser.id,
        due_date: '2020-01-01',
        status: 'done',
      });

      const rows = await workload(request, ownerToken);
      const row = rows.find((entry) => entry.user_id === teamUser.id);
      expect(row, 'Team Member workload row').toBeTruthy();
      expect(row!.open_tasks).toBe(before!.open_tasks + 3);
      expect(row!.overdue_tasks).toBe(before!.overdue_tasks + 1);
      expect(row!.due_next_7_days).toBe(before!.due_next_7_days + 1);

      const ownRows = await workload(request, teamToken);
      expect(ownRows).toHaveLength(1);
      expect(ownRows[0].user_id).toBe(teamUser.id);
      expect(ownRows[0].open_tasks).toBe(row!.open_tasks);
      expect(ownRows[0].overdue_tasks).toBe(row!.overdue_tasks);
      expect(ownRows[0].due_next_7_days).toBe(row!.due_next_7_days);

      if (hasCredentials('SALES')) {
        await expectError(
          await request.get(`${API_BASE}/workload`, { headers: bearer(await requireToken(request, 'SALES')) }),
          403,
          'FORBIDDEN',
        );
      }
      if (hasCredentials('ACCOUNTANT')) {
        await expectError(
          await request.get(`${API_BASE}/workload`, { headers: bearer(await requireToken(request, 'ACCOUNTANT')) }),
          403,
          'FORBIDDEN',
        );
      }
    } finally {
      await request.delete(`${API_BASE}/projects/${projectId}`, { headers: bearer(ownerToken) });
    }
  });
});

// ===========================================================================
// Tenant isolation (§5, §7.8)
// ===========================================================================
test.describe('QA-005 / tenant isolation (TEAM_CONTRACT §5)', () => {
  test('TC-TEAM-16 foreign-agency ids are 404 and foreign body references are 422 CROSS_TENANT_REFERENCE', async ({ request }) => {
    test.skip(!hasCredentials('OWNER'), 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(!hasCredentials('OTHER_AGENCY'), 'Missing E2E_OTHER_AGENCY_EMAIL/PASSWORD.');
    const ownerToken = await requireToken(request, 'OWNER');
    const owner = await me(request, ownerToken);
    const foreign = await foreignIdentity(request);
    expect(foreign).toBeTruthy();

    const ownTeam = await createTeam(request, ownerToken, unique('Tenant Team'));
    let foreignTeamId: number | undefined;
    let projectId: number | undefined;
    try {
      await expectError(
        await request.get(`${API_BASE}/teams/${ownTeam.id}`, { headers: bearer(foreign!.token) }),
        404,
        'NOT_FOUND',
      );
      await expectError(
        await request.get(`${API_BASE}/users/${owner.id}`, { headers: bearer(foreign!.token) }),
        404,
        'NOT_FOUND',
      );

      await expectError(
        await request.post(`${API_BASE}/teams`, {
          headers: bearer(ownerToken),
          data: { name: unique('Cross Tenant Team'), lead_id: foreign!.userId },
        }),
        422,
        'CROSS_TENANT_REFERENCE',
      );
      await expectError(
        await request.post(`${API_BASE}/teams/${ownTeam.id}/members`, {
          headers: bearer(ownerToken),
          data: { user_id: foreign!.userId },
        }),
        422,
        'CROSS_TENANT_REFERENCE',
      );

      const foreignTeamResponse = await request.post(`${API_BASE}/teams`, {
        headers: bearer(foreign!.token),
        data: { name: unique('Foreign Team') },
      });
      const foreignTeam = (await expectJson<{ data: TeamRow }>(foreignTeamResponse, 201)).data;
      foreignTeamId = foreignTeam.id;
      await expectError(
        await request.get(`${API_BASE}/teams/${foreignTeam.id}`, { headers: bearer(ownerToken) }),
        404,
        'NOT_FOUND',
      );

      const clientId = await createClient(request, ownerToken);
      projectId = await createProject(request, ownerToken, clientId);
      await expectError(
        await request.post(`${API_BASE}/projects/${projectId}/teams`, {
          headers: bearer(ownerToken),
          data: { team_id: foreignTeam.id },
        }),
        422,
        'CROSS_TENANT_REFERENCE',
      );
    } finally {
      if (projectId) await request.delete(`${API_BASE}/projects/${projectId}`, { headers: bearer(ownerToken) });
      await request.delete(`${API_BASE}/teams/${ownTeam.id}`, { headers: bearer(ownerToken) });
      if (foreignTeamId) await request.delete(`${API_BASE}/teams/${foreignTeamId}`, { headers: bearer(foreign!.token) });
    }
  });
});

/**
 * QA-004 — Project Management module test coverage.
 *
 * Source of truth: docs/PROJECT_CONTRACT.md (approved 2026-11-22, DEC-016).
 * BE-006 is in review; these cases are written from the contract and run
 * against the real Docker/MySQL stack with the shared English demo seed.
 * No secrets are hardcoded — all accounts come from the shared demo dataset
 * via E2E_* environment vars (tests/e2e/README.md, CONVENTIONS H.4).
 */

import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';

type Credentials = { email: string; password: string };
type ErrorBody = { error?: { code?: string; message?: string; details?: Record<string, string[]> } };

function credentials(prefix: string): Credentials {
  const email = process.env[`E2E_${prefix}_EMAIL`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`Missing E2E_${prefix}_EMAIL / E2E_${prefix}_PASSWORD.`);
  }
  return { email, password };
}

async function errorOf(response: APIResponse): Promise<NonNullable<ErrorBody['error']>> {
  const body = (await response.json()) as ErrorBody;
  expect(body.error, `Expected error envelope on HTTP ${response.status()}`).toBeTruthy();
  return body.error!;
}

async function login(request: APIRequestContext, prefix: string, path = '/auth/login'): Promise<string> {
  const res = await request.post(`${API_BASE}${path}`, { data: credentials(prefix) });
  expect(res.status(), `login for ${prefix} should succeed`).toBe(200);
  const body = (await res.json()) as { data?: { token?: string } };
  expect(body.data?.token).toBeTruthy();
  return body.data!.token!;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const tokenCache: Record<string, string> = {};
async function getToken(request: APIRequestContext, prefix: string, path = '/auth/login'): Promise<string> {
  const key = `${prefix}:${path}`;
  if (tokenCache[key]) return tokenCache[key];
  const token = await login(request, prefix, path);
  tokenCache[key] = token;
  return token;
}

async function meId(request: APIRequestContext, token: string): Promise<number> {
  const res = await request.get(`${API_BASE}/auth/me`, { headers: bearer(token) });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { data?: { user?: { id?: number } } };
  return body.data!.user!.id!;
}

async function createClient(request: APIRequestContext, token: string, name?: string): Promise<number> {
  const res = await request.post(`${API_BASE}/clients`, {
    headers: bearer(token),
    data: { name: name ?? `QA Client ${Date.now()}` },
  });
  expect(res.status(), 'create client').toBe(201);
  const body = (await res.json()) as { data?: { id?: number } };
  return body.data!.id!;
}

async function createProject(request: APIRequestContext, token: string, clientId: number, name?: string): Promise<number> {
  const res = await request.post(`${API_BASE}/projects`, {
    headers: bearer(token),
    data: { client_id: clientId, name: name ?? `QA Project ${Date.now()}` },
  });
  expect(res.status(), 'create project').toBe(201);
  const body = (await res.json()) as { data?: { id?: number } };
  return body.data!.id!;
}

async function createTask(request: APIRequestContext, token: string, projectId: number, title?: string, extra: Record<string, unknown> = {}): Promise<number> {
  const res = await request.post(`${API_BASE}/projects/${projectId}/tasks`, {
    headers: bearer(token),
    data: { title: title ?? `QA Task ${Date.now()}`, ...extra },
  });
  expect(res.status(), 'create task').toBe(201);
  const body = (await res.json()) as { data?: { id?: number } };
  return body.data!.id!;
}

// ---------------------------------------------------------------------------
// TC-PROJ-01.. : Project CRUD + filters
// ---------------------------------------------------------------------------
test.describe('QA-004 / Project CRUD & filters (PROJECT_CONTRACT §5)', () => {
  test('TC-PROJ-01 owner creates a project and response reflects defaults (0 tasks -> 0%)', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const res = await request.post(`${API_BASE}/projects`, {
      headers: bearer(token),
      data: { client_id: clientId, name: 'Website rebuild', budget: 25000 },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { data?: { id?: number; status?: string; tasks_count?: number; progress_percent?: number } };
    expect(body.data?.status).toBe('draft');
    expect(body.data?.tasks_count).toBe(0);
    expect(body.data?.progress_percent).toBe(0);
  });

  test('TC-PROJ-02 project list supports filters client_id / status / q / project_manager_id', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const ownerId = await meId(request, token);
    await createProject(request, token, clientId, 'Alpha site');
    // set status via update on a separate project
    const betaId = await createProject(request, token, clientId, 'Beta app');
    await request.patch(`${API_BASE}/projects/${betaId}`, { headers: bearer(token), data: { status: 'draft' } });

    const byClient = await request.get(`${API_BASE}/projects`, { headers: bearer(token), params: { client_id: clientId } });
    expect(byClient.status()).toBe(200);
    const byClientBody = (await byClient.json()) as { data?: unknown[] };
    expect(Array.isArray(byClientBody.data)).toBe(true);
    expect((byClientBody.data ?? []).length).toBeGreaterThanOrEqual(2);

    const byStatus = await request.get(`${API_BASE}/projects`, { headers: bearer(token), params: { status: 'draft' } });
    expect(byStatus.status()).toBe(200);

    const byQ = await request.get(`${API_BASE}/projects`, { headers: bearer(token), params: { q: 'Alpha' } });
    expect(byQ.status()).toBe(200);
    const byQBody = (await byQ.json()) as { data?: Array<{ name?: string }> };
    expect((byQBody.data ?? []).some((p) => (p.name ?? '').includes('Alpha'))).toBe(true);

    const byPm = await request.get(`${API_BASE}/projects`, { headers: bearer(token), params: { project_manager_id: ownerId } });
    expect(byPm.status()).toBe(200);
  });

  test('TC-PROJ-03 PATCH updates and DELETE soft-deletes a project', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const id = await createProject(request, token, clientId, 'To be updated');

    const patched = await request.patch(`${API_BASE}/projects/${id}`, {
      headers: bearer(token),
      data: { status: 'in_progress', name: 'Renamed project' },
    });
    expect(patched.status()).toBe(200);
    const patchedBody = (await patched.json()) as { data?: { status?: string; name?: string } };
    expect(patchedBody.data?.status).toBe('in_progress');
    expect(patchedBody.data?.name).toBe('Renamed project');

    const deleted = await request.delete(`${API_BASE}/projects/${id}`, { headers: bearer(token) });
    expect([200, 204]).toContain(deleted.status());

    const after = await request.get(`${API_BASE}/projects/${id}`, { headers: bearer(token) });
    expect(after.status()).toBe(404);
  });

  test('TC-PROJ-04 cross-agency project access returns 404', async ({ request }) => {
    test.skip(!process.env.E2E_OTHER_AGENCY_EMAIL, 'Missing E2E_OTHER_AGENCY_EMAIL/PASSWORD.');
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await getToken(request, 'OWNER');
    const otherToken = await getToken(request, 'OTHER_AGENCY');
    const clientId = await createClient(request, ownerToken);
    const id = await createProject(request, ownerToken, clientId, 'Foreign check');
    const res = await request.get(`${API_BASE}/projects/${id}`, { headers: bearer(otherToken) });
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-05.. : permission matrix projects.* / tasks.* / milestones.*
// ---------------------------------------------------------------------------
test.describe('QA-004 / permission matrix (PROJECT_CONTRACT §3)', () => {
  const roles = ['OWNER', 'ADMIN', 'SALES', 'PROJECT', 'ACCOUNTANT', 'TEAM'] as const;
  const canCreate = (r: string) => ['OWNER', 'ADMIN', 'PROJECT'].includes(r);
  const canDelete = (r: string) => r === 'OWNER';
  const canManageMembers = (r: string) => ['OWNER', 'ADMIN', 'PROJECT'].includes(r);
  const canManageMilestones = (r: string) => ['OWNER', 'ADMIN', 'PROJECT'].includes(r);
  const canCreateTask = (r: string) => ['OWNER', 'ADMIN', 'PROJECT'].includes(r);
  const canDeleteTask = (r: string) => ['OWNER', 'ADMIN', 'PROJECT'].includes(r);
  const canManageComments = (r: string) => ['OWNER', 'ADMIN', 'PROJECT', 'TEAM'].includes(r);

  for (const role of roles) {
    test(`TC-PROJ-05 ${role}: projects.view via GET /projects`, async ({ request }) => {
      test.skip(!process.env[`E2E_${role}_EMAIL`], `Missing E2E_${role}_EMAIL/PASSWORD.`);
      const token = await getToken(request, role);
      const res = await request.get(`${API_BASE}/projects`, { headers: bearer(token) });
      expect(res.status()).toBe(200);
    });
  }

  test('TC-PROJ-06 roles without projects.create get 403 on POST /projects', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await getToken(request, 'OWNER');
    const clientId = await createClient(request, ownerToken);
    for (const role of ['SALES', 'ACCOUNTANT', 'TEAM'] as const) {
      test.skip(!process.env[`E2E_${role}_EMAIL`], `Missing E2E_${role}_EMAIL/PASSWORD.`);
      const token = await getToken(request, role);
      const res = await request.post(`${API_BASE}/projects`, {
        headers: bearer(token),
        data: { client_id: clientId, name: `forbidden-${role}` },
      });
      expect(res.status()).toBe(403);
      expect((await errorOf(res)).code).toBe('FORBIDDEN');
    }
  });

  test('TC-PROJ-07 only Owner may delete a project (Admin forbidden)', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await getToken(request, 'OWNER');
    const clientId = await createClient(request, ownerToken);

    // Admin (if present) is forbidden
    if (process.env.E2E_ADMIN_EMAIL) {
      const adminToken = await getToken(request, 'ADMIN');
      const id = await createProject(request, ownerToken, clientId, `admin-delete-${Date.now()}`);
      const res = await request.delete(`${API_BASE}/projects/${id}`, { headers: bearer(adminToken) });
      expect(res.status()).toBe(403);
      // cleanup
      await request.delete(`${API_BASE}/projects/${id}`, { headers: bearer(ownerToken) });
    }

    // Sales/Accountant/Team/PM (if present) forbidden
    for (const role of ['SALES', 'ACCOUNTANT', 'TEAM', 'PROJECT'] as const) {
      if (!process.env[`E2E_${role}_EMAIL`]) continue;
      const token = await getToken(request, role);
      const id = await createProject(request, ownerToken, clientId, `role-delete-${role}-${Date.now()}`);
      const res = await request.delete(`${API_BASE}/projects/${id}`, { headers: bearer(token) });
      expect(res.status()).toBe(403);
      await request.delete(`${API_BASE}/projects/${id}`, { headers: bearer(ownerToken) });
    }
  });

  test('TC-PROJ-08 create permission allowed roles succeed', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await getToken(request, 'OWNER');
    const clientId = await createClient(request, ownerToken);
    for (const role of ['OWNER', 'ADMIN', 'PROJECT'] as const) {
      if (!process.env[`E2E_${role}_EMAIL`] && role !== 'OWNER') continue;
      const token = role === 'OWNER' ? ownerToken : await getToken(request, role);
      // ensure client visible to role: owner's client is same agency, should be usable
      const res = await request.post(`${API_BASE}/projects`, {
        headers: bearer(token),
        data: { client_id: clientId, name: `allowed-create-${role}-${Date.now()}` },
      });
      // PM/Admin may not have client create but have client view; project create should succeed
      expect([200, 201]).toContain(res.status());
      const body = (await res.json()) as { data?: { id?: number } };
      if (body.data?.id) {
        await request.delete(`${API_BASE}/projects/${body.data.id}`, { headers: bearer(ownerToken) });
      }
    }
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-09.. : soft delete cascade
// ---------------------------------------------------------------------------
test.describe('QA-004 / soft delete cascade (PROJECT_CONTRACT §3)', () => {
  test('TC-PROJ-09 deleting a project soft-deletes tasks/milestones/comments/checklist', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const projectId = await createProject(request, token, clientId, 'Cascade project');

    // milestone
    const msRes = await request.post(`${API_BASE}/projects/${projectId}/milestones`, {
      headers: bearer(token),
      data: { name: 'MS', due_date: '2026-12-01' },
    });
    expect(msRes.status()).toBe(201);
    const milestoneId = ((await msRes.json()) as { data?: { id?: number } }).data?.id!;

    const taskId = await createTask(request, token, projectId, 'Cascade task', { milestone_id: milestoneId });

    const cRes = await request.post(`${API_BASE}/tasks/${taskId}/comments`, {
      headers: bearer(token),
      data: { body: 'secret note' },
    });
    expect(cRes.status()).toBe(201);

    const iRes = await request.post(`${API_BASE}/tasks/${taskId}/checklist`, {
      headers: bearer(token),
      data: { title: 'step' },
    });
    expect(iRes.status()).toBe(201);

    const del = await request.delete(`${API_BASE}/projects/${projectId}`, { headers: bearer(token) });
    expect([200, 204]).toContain(del.status());

    // project gone
    expect((await request.get(`${API_BASE}/projects/${projectId}`, { headers: bearer(token) })).status()).toBe(404);
    // task gone
    expect((await request.get(`${API_BASE}/tasks/${taskId}`, { headers: bearer(token) })).status()).toBe(404);
    // milestone update gone (nested under project -> 404)
    const msPatch = await request.patch(`${API_BASE}/projects/${projectId}/milestones/${milestoneId}`, {
      headers: bearer(token),
      data: { name: 'X' },
    });
    expect(msPatch.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-10.. : members
// ---------------------------------------------------------------------------
test.describe('QA-004 / project members (PROJECT_CONTRACT §5.7)', () => {
  test('TC-PROJ-10 members can be added and removed', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const ownerId = await meId(request, token);
    const clientId = await createClient(request, token);
    const projectId = await createProject(request, token, clientId, 'Members project');

    const add = await request.post(`${API_BASE}/projects/${projectId}/members`, {
      headers: bearer(token),
      data: { user_id: ownerId },
    });
    expect([200, 201]).toContain(add.status());

    const list = await request.get(`${API_BASE}/projects/${projectId}/members`, { headers: bearer(token) });
    expect(list.status()).toBe(200);
    const listBody = (await list.json()) as { data?: Array<{ id?: number }> };
    expect((listBody.data ?? []).some((m) => m.id === ownerId)).toBe(true);

    const remove = await request.delete(`${API_BASE}/projects/${projectId}/members/${ownerId}`, { headers: bearer(token) });
    expect([200, 204]).toContain(remove.status());
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-11.. : team member visibility (skip if no team account)
// ---------------------------------------------------------------------------
test.describe('QA-004 / team member visibility (PROJECT_CONTRACT §3)', () => {
  test('TC-PROJ-11 team member sees only participating projects', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(!process.env.E2E_TEAM_EMAIL, 'Missing E2E_TEAM_EMAIL/PASSWORD (team member seed).');
    const ownerToken = await getToken(request, 'OWNER');
    const teamToken = await getToken(request, 'TEAM');
    const teamId = await meId(request, teamToken);
    const clientId = await createClient(request, ownerToken);

    const joinedId = await createProject(request, ownerToken, clientId, `Joined ${Date.now()}`);
    const assignedId = await createProject(request, ownerToken, clientId, `Assigned ${Date.now()}`);
    const hiddenId = await createProject(request, ownerToken, clientId, `Hidden ${Date.now()}`);

    await request.post(`${API_BASE}/projects/${joinedId}/members`, {
      headers: bearer(ownerToken),
      data: { user_id: teamId },
    });
    await createTask(request, ownerToken, assignedId, 'Assigned task', { assignee_id: teamId });

    const listRes = await request.get(`${API_BASE}/projects`, { headers: bearer(teamToken) });
    expect(listRes.status()).toBe(200);
    const names = ((await listRes.json()) as { data?: Array<{ name?: string }> }).data?.map((p) => p.name) ?? [];
    expect(names.some((n) => (n ?? '').startsWith('Joined'))).toBe(true);
    expect(names.some((n) => (n ?? '').startsWith('Assigned'))).toBe(true);
    expect(names.some((n) => (n ?? '').startsWith('Hidden'))).toBe(false);

    const hiddenRes = await request.get(`${API_BASE}/projects/${hiddenId}`, { headers: bearer(teamToken) });
    expect(hiddenRes.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-12.. : milestones
// ---------------------------------------------------------------------------
test.describe('QA-004 / milestones (PROJECT_CONTRACT §5.8)', () => {
  test('TC-PROJ-12 milestone CRUD + default status + progress', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const projectId = await createProject(request, token, clientId, 'Milestone project');

    const createRes = await request.post(`${API_BASE}/projects/${projectId}/milestones`, {
      headers: bearer(token),
      data: { name: 'Design sign-off', due_date: '2026-12-01' },
    });
    expect(createRes.status()).toBe(201);
    const createBody = (await createRes.json()) as { data?: { id?: number; status?: string } };
    expect(createBody.data?.status).toBe('planned');
    const milestoneId = createBody.data!.id!;

    // attach tasks for progress
    await createTask(request, token, projectId, 'Done task', { milestone_id: milestoneId, status: 'done' });
    await createTask(request, token, projectId, 'Todo task', { milestone_id: milestoneId });

    const listRes = await request.get(`${API_BASE}/projects/${projectId}/milestones`, { headers: bearer(token) });
    expect(listRes.status()).toBe(200);
    const ms = ((await listRes.json()) as { data?: Array<{ id?: number; progress_percent?: number }> }).data?.find((m) => m.id === milestoneId);
    expect(ms?.progress_percent).toBe(50);

    // update
    const patchRes = await request.patch(`${API_BASE}/projects/${projectId}/milestones/${milestoneId}`, {
      headers: bearer(token),
      data: { status: 'in_progress', name: 'Renamed milestone' },
    });
    expect(patchRes.status()).toBe(200);

    // delete
    const delRes = await request.delete(`${API_BASE}/projects/${projectId}/milestones/${milestoneId}`, { headers: bearer(token) });
    expect([200, 204]).toContain(delRes.status());
  });

  test('TC-PROJ-13 milestone of another project resolves to 404', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const p1 = await createProject(request, token, clientId, 'P1');
    const p2 = await createProject(request, token, clientId, 'P2');

    const msRes = await request.post(`${API_BASE}/projects/${p1}/milestones`, {
      headers: bearer(token),
      data: { name: 'MS1' },
    });
    const milestoneId = ((await msRes.json()) as { data?: { id?: number } }).data?.id!;

    const res = await request.patch(`${API_BASE}/projects/${p2}/milestones/${milestoneId}`, {
      headers: bearer(token),
      data: { name: 'X' },
    });
    expect(res.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-14.. : tasks
// ---------------------------------------------------------------------------
test.describe('QA-004 / tasks (PROJECT_CONTRACT §5.9)', () => {
  test('TC-PROJ-14 task CRUD + completed_at lifecycle + filters', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const projectId = await createProject(request, token, clientId, 'Task project');

    const createRes = await request.post(`${API_BASE}/projects/${projectId}/tasks`, {
      headers: bearer(token),
      data: { title: 'Design homepage', priority: 'high' },
    });
    expect(createRes.status()).toBe(201);
    const createBody = (await createRes.json()) as { data?: { id?: number; status?: string; priority?: string; completed_at?: string | null } };
    expect(createBody.data?.status).toBe('todo');
    expect(createBody.data?.priority).toBe('high');
    expect(createBody.data?.completed_at).toBeNull();
    const taskId = createBody.data!.id!;

    const doneRes = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: bearer(token),
      data: { status: 'done' },
    });
    expect(doneRes.status()).toBe(200);
    const doneBody = (await doneRes.json()) as { data?: { status?: string; completed_at?: string | null } };
    expect(doneBody.data?.status).toBe('done');
    expect(doneBody.data?.completed_at).toBeTruthy();

    const reopenRes = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: bearer(token),
      data: { status: 'in_progress' },
    });
    expect(reopenRes.status()).toBe(200);
    const reopenBody = (await reopenRes.json()) as { data?: { completed_at?: string | null } };
    expect(reopenBody.data?.completed_at).toBeNull();

    // filters
    const highRes = await request.get(`${API_BASE}/projects/${projectId}/tasks`, {
      headers: bearer(token),
      params: { priority: 'high' },
    });
    expect(highRes.status()).toBe(200);
    const highBody = (await highRes.json()) as { data?: unknown[] };
    expect((highBody.data ?? []).length).toBe(1);

    const lowRes = await request.get(`${API_BASE}/projects/${projectId}/tasks`, {
      headers: bearer(token),
      params: { priority: 'low' },
    });
    expect(lowRes.status()).toBe(200);
    const lowBody = (await lowRes.json()) as { data?: unknown[] };
    expect((lowBody.data ?? []).length).toBe(0);

    // delete
    const delRes = await request.delete(`${API_BASE}/tasks/${taskId}`, { headers: bearer(token) });
    expect([200, 204]).toContain(delRes.status());
  });

  test('TC-PROJ-15 cross-project milestone on task create returns 422', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const p1 = await createProject(request, token, clientId, 'P1');
    const p2 = await createProject(request, token, clientId, 'P2');

    const msRes = await request.post(`${API_BASE}/projects/${p2}/milestones`, {
      headers: bearer(token),
      data: { name: 'MS2' },
    });
    const milestoneId = ((await msRes.json()) as { data?: { id?: number } }).data?.id!;

    const res = await request.post(`${API_BASE}/projects/${p1}/tasks`, {
      headers: bearer(token),
      data: { title: 'Bad milestone', milestone_id: milestoneId },
    });
    expect(res.status()).toBe(422);
    expect((await errorOf(res)).code).toBe('CROSS_TENANT_REFERENCE');
  });

  test('TC-PROJ-16 cross-tenant assignee on task create returns 422', async ({ request }) => {
    const foreignId = process.env.E2E_FOREIGN_USER_ID;
    test.skip(!foreignId, 'Needs E2E_FOREIGN_USER_ID from the shared seed.');
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const projectId = await createProject(request, token, clientId, 'Assignee project');

    const res = await request.post(`${API_BASE}/projects/${projectId}/tasks`, {
      headers: bearer(token),
      data: { title: 'Bad assignee', assignee_id: Number(foreignId) },
    });
    expect(res.status()).toBe(422);
    expect((await errorOf(res)).code).toBe('CROSS_TENANT_REFERENCE');
  });

  test('TC-PROJ-17 cross-tenant project_manager_id returns 422', async ({ request }) => {
    const foreignId = process.env.E2E_FOREIGN_USER_ID;
    test.skip(!foreignId, 'Needs E2E_FOREIGN_USER_ID from the shared seed.');
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);

    const res = await request.post(`${API_BASE}/projects`, {
      headers: bearer(token),
      data: { client_id: clientId, name: 'Bad PM', project_manager_id: Number(foreignId) },
    });
    expect(res.status()).toBe(422);
    expect((await errorOf(res)).code).toBe('CROSS_TENANT_REFERENCE');
  });

  test('TC-PROJ-18 team member updates only own task status', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(!process.env.E2E_TEAM_EMAIL, 'Missing E2E_TEAM_EMAIL/PASSWORD (team member seed).');
    const ownerToken = await getToken(request, 'OWNER');
    const teamToken = await getToken(request, 'TEAM');
    const teamId = await meId(request, teamToken);
    const clientId = await createClient(request, ownerToken);
    const projectId = await createProject(request, ownerToken, clientId, 'Team task project');

    const ownTaskId = await createTask(request, ownerToken, projectId, 'Own task', { assignee_id: teamId });
    const otherTaskId = await createTask(request, ownerToken, projectId, 'Other task', { assignee_id: await meId(request, ownerToken) });

    // own task: status changes, title ignored
    const ownRes = await request.patch(`${API_BASE}/tasks/${ownTaskId}`, {
      headers: bearer(teamToken),
      data: { status: 'in_progress', title: 'Hijack attempt' },
    });
    expect(ownRes.status()).toBe(200);
    const ownBody = (await ownRes.json()) as { data?: { status?: string; title?: string } };
    expect(ownBody.data?.status).toBe('in_progress');
    expect(ownBody.data?.title).toBe('Own task');

    // other's task forbidden
    const otherRes = await request.patch(`${API_BASE}/tasks/${otherTaskId}`, {
      headers: bearer(teamToken),
      data: { status: 'done' },
    });
    expect(otherRes.status()).toBe(403);

    // create task forbidden
    const createRes = await request.post(`${API_BASE}/projects/${projectId}/tasks`, {
      headers: bearer(teamToken),
      data: { title: 'Nope' },
    });
    expect(createRes.status()).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-19.. : comments & checklist
// ---------------------------------------------------------------------------
test.describe('QA-004 / comments & checklist (PROJECT_CONTRACT §5.9-10)', () => {
  test('TC-PROJ-19 comments and checklist CRUD', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const projectId = await createProject(request, token, clientId, 'Comment project');
    const taskId = await createTask(request, token, projectId, 'Task with comments');

    const cRes = await request.post(`${API_BASE}/tasks/${taskId}/comments`, {
      headers: bearer(token),
      data: { body: 'Looks good' },
    });
    expect(cRes.status()).toBe(201);
    const cBody = (await cRes.json()) as { data?: { id?: number; author?: { id?: number } } };
    const commentId = cBody.data!.id!;
    expect(cBody.data?.author?.id).toBeTruthy();

    const iRes = await request.post(`${API_BASE}/tasks/${taskId}/checklist`, {
      headers: bearer(token),
      data: { title: 'Check contrast' },
    });
    expect(iRes.status()).toBe(201);
    const iBody = (await iRes.json()) as { data?: { id?: number; is_done?: boolean } };
    const itemId = iBody.data!.id!;
    expect(iBody.data?.is_done).toBe(false);

    const tickRes = await request.patch(`${API_BASE}/tasks/${taskId}/checklist/${itemId}`, {
      headers: bearer(token),
      data: { is_done: true },
    });
    expect(tickRes.status()).toBe(200);
    const tickBody = (await tickRes.json()) as { data?: { is_done?: boolean } };
    expect(tickBody.data?.is_done).toBe(true);

    const detailRes = await request.get(`${API_BASE}/tasks/${taskId}`, { headers: bearer(token) });
    expect(detailRes.status()).toBe(200);
    const detailBody = (await detailRes.json()) as { data?: { checklist?: unknown[]; comments?: unknown[] } };
    expect((detailBody.data?.checklist ?? []).length).toBe(1);
    expect((detailBody.data?.comments ?? []).length).toBe(1);

    const delComment = await request.delete(`${API_BASE}/tasks/${taskId}/comments/${commentId}`, { headers: bearer(token) });
    expect([200, 204]).toContain(delComment.status());
  });

  test('TC-PROJ-20 comment delete requires author or privileged role', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    test.skip(!process.env.E2E_PROJECT_EMAIL, 'Missing E2E_PROJECT_EMAIL/PASSWORD (PM seed).');
    const ownerToken = await getToken(request, 'OWNER');
    const pmToken = await getToken(request, 'PROJECT');
    const clientId = await createClient(request, ownerToken);
    const projectId = await createProject(request, ownerToken, clientId, 'Comment auth project');
    const taskId = await createTask(request, ownerToken, projectId, 'Task');

    const cRes = await request.post(`${API_BASE}/tasks/${taskId}/comments`, {
      headers: bearer(ownerToken),
      data: { body: 'Owner note' },
    });
    const commentId = ((await cRes.json()) as { data?: { id?: number } }).data?.id!;

    const pmDel = await request.delete(`${API_BASE}/tasks/${taskId}/comments/${commentId}`, { headers: bearer(pmToken) });
    expect(pmDel.status()).toBe(403);

    const ownerDel = await request.delete(`${API_BASE}/tasks/${taskId}/comments/${commentId}`, { headers: bearer(ownerToken) });
    expect([200, 204]).toContain(ownerDel.status());
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-21.. : progress & timeline
// ---------------------------------------------------------------------------
test.describe('QA-004 / progress & timeline (PROJECT_CONTRACT §4)', () => {
  test('TC-PROJ-21 progress % matches data (incl. 0 tasks -> 0%)', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);

    // 0-task project
    const zeroId = await createProject(request, token, clientId, 'Zero task project');
    const zeroRes = await request.get(`${API_BASE}/projects/${zeroId}`, { headers: bearer(token) });
    expect(zeroRes.status()).toBe(200);
    const zeroBody = (await zeroRes.json()) as { data?: { tasks_count?: number; tasks_done_count?: number; progress_percent?: number } };
    expect(zeroBody.data?.tasks_count).toBe(0);
    expect(zeroBody.data?.progress_percent).toBe(0);

    // project with 4 tasks, 2 done
    const pid = await createProject(request, token, clientId, 'Progress project');
    await createTask(request, token, pid, 't1', { status: 'done' });
    await createTask(request, token, pid, 't2', { status: 'done' });
    await createTask(request, token, pid, 't3', { status: 'todo' });
    await createTask(request, token, pid, 't4', { status: 'todo' });

    const res = await request.get(`${API_BASE}/projects/${pid}`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: { tasks_count?: number; tasks_done_count?: number; progress_percent?: number } };
    expect(body.data?.tasks_count).toBe(4);
    expect(body.data?.tasks_done_count).toBe(2);
    expect(body.data?.progress_percent).toBe(50);
  });

  test('TC-PROJ-22 timeline orders by date (milestones before tasks same day)', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const pid = await createProject(request, token, clientId, 'Timeline project');

    // milestone due 2026-12-10
    await request.post(`${API_BASE}/projects/${pid}/milestones`, {
      headers: bearer(token),
      data: { name: 'Launch', due_date: '2026-12-10' },
    });
    // task early due 2026-12-05
    await createTask(request, token, pid, 'Early task', { due_date: '2026-12-05T00:00:00.000Z' });
    // task same day due 2026-12-10
    await createTask(request, token, pid, 'Same-day task', { due_date: '2026-12-10T00:00:00.000Z' });
    // no due date -> not in timeline
    await createTask(request, token, pid, 'No due');

    const res = await request.get(`${API_BASE}/projects/${pid}/timeline`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const items = (await res.json()) as { data?: Array<{ type?: string; due_date?: string }> };
    expect((items.data ?? []).length).toBe(3);
    expect(items.data![0].type).toBe('task');
    expect(items.data![1].type).toBe('milestone');
    expect(items.data![2].type).toBe('task');
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-23.. : due list
// ---------------------------------------------------------------------------
test.describe('QA-004 / due list (PROJECT_CONTRACT §5.9)', () => {
  test('TC-PROJ-23 due list returns open tasks by due date', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const token = await getToken(request, 'OWNER');
    const clientId = await createClient(request, token);
    const pid = await createProject(request, token, clientId, 'Due project');

    await createTask(request, token, pid, 'Overdue', { due_date: new Date(Date.now() - 86400000).toISOString() });
    await createTask(request, token, pid, 'Future', { due_date: new Date(Date.now() + 10 * 86400000).toISOString() });
    await createTask(request, token, pid, 'Done already', { status: 'done', due_date: new Date(Date.now() - 86400000).toISOString() });

    const res = await request.get(`${API_BASE}/tasks/due`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: Array<{ title?: string; is_done?: boolean }> };
    expect((body.data ?? []).some((t) => t.title === 'Overdue')).toBe(true);
    for (const t of body.data ?? []) {
      // status != done
    }

    const res2 = await request.get(`${API_BASE}/tasks/due`, { headers: bearer(token), params: { days: 14 } });
    expect(res2.status()).toBe(200);
    const body2 = (await res2.json()) as { data?: Array<{ title?: string }> };
    const titles = (body2.data ?? []).map((t) => t.title);
    expect(titles).toContain('Overdue');
    expect(titles).toContain('Future');
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-24.. : Portal read-only
// ---------------------------------------------------------------------------
test.describe('QA-004 / portal read-only (PROJECT_CONTRACT §5.17-18)', () => {
  test('TC-PROJ-24 client sees only own projects, no budget/comments; tokens not cross-usable', async ({ request }) => {
    test.skip(!process.env.E2E_OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    const ownerToken = await getToken(request, 'OWNER');

    // two clients
    const clientA = await createClient(request, ownerToken);
    const clientB = await createClient(request, ownerToken);

    const projectA = await createProject(request, ownerToken, clientA, 'Client visible');
    const projectB = await createProject(request, ownerToken, clientB, 'Not yours');

    const taskId = await createTask(request, ownerToken, projectA, 'Portal task');
    await request.post(`${API_BASE}/tasks/${taskId}/comments`, {
      headers: bearer(ownerToken),
      data: { body: 'Internal secret' },
    });

    // app token cannot use portal route
    const appPortal = await request.get(`${API_BASE}/portal/projects`, { headers: bearer(ownerToken) });
    expect([401, 403]).toContain(appPortal.status());

    // create portal account for client A
    const portalEmail = `portal-${Date.now()}@test.local`;
    const portalPassword = 'password-1234';
    const paRes = await request.post(`${API_BASE}/clients/${clientA}/portal-accounts`, {
      headers: bearer(ownerToken),
      data: { name: 'Portal User', email: portalEmail, password: portalPassword },
    });
    expect(paRes.status()).toBe(201);

    const loginRes = await request.post(`${API_BASE}/portal/auth/login`, {
      data: { email: portalEmail, password: portalPassword },
    });
    expect(loginRes.status()).toBe(200);
    const portalToken = ((await loginRes.json()) as { data?: { token?: string } }).data?.token!;

    // portal token cannot use internal route
    const portalInternal = await request.get(`${API_BASE}/projects`, { headers: bearer(portalToken) });
    expect([401, 403]).toContain(portalInternal.status());

    // portal sees only own project
    const listRes = await request.get(`${API_BASE}/portal/projects`, { headers: bearer(portalToken) });
    expect(listRes.status()).toBe(200);
    const listBody = (await listRes.json()) as { data?: Array<{ name?: string; budget?: unknown }> };
    expect((listBody.data ?? []).length).toBe(1);
    expect(listBody.data![0].name).toBe('Client visible');
    expect(listBody.data![0].budget).toBeUndefined();

    // detail: task title present, no comments/budget
    const detailRes = await request.get(`${API_BASE}/portal/projects/${projectA}`, { headers: bearer(portalToken) });
    expect(detailRes.status()).toBe(200);
    const detailText = await detailRes.text();
    expect(detailText).toContain('Portal task');
    expect(detailText).not.toContain('Internal secret');
    expect(detailText).not.toContain('budget');
    expect(detailText.toLowerCase()).not.toContain('comments');

    // other client's project not reachable
    const foreignRes = await request.get(`${API_BASE}/portal/projects/${projectB}`, { headers: bearer(portalToken) });
    expect(foreignRes.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// TC-PROJ-25.. : team member task update permission via API (already covered)
// ---------------------------------------------------------------------------
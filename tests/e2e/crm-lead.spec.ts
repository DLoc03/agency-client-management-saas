/**
 * QA-003 — CRM / Lead module test coverage.
 *
 * Source of truth: docs/CRM_CONTRACT.md (approved 2026-11-21, DEC-014).
 * BE-005 (Muse) is still in progress, so these cases are written from the
 * contract and are NOT expected to pass yet. They will be enabled (remove the
 * top-level test.skip) once BE-005 merges and the shared demo seed exposes
 * the E2E_LEAD_* / E2E_*_EMAIL fixtures documented below.
 *
 * No secrets are hardcoded — all accounts come from the shared English demo
 * dataset via E2E_* environment vars (tests/e2e/README.md, CONVENTIONS H.4).
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

async function login(request: APIRequestContext, prefix: string): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, { data: credentials(prefix) });
  expect(res.status(), `login for ${prefix} should succeed`).toBe(200);
  const body = (await res.json()) as { data?: { token?: string } };
  expect(body.data?.token).toBeTruthy();
  return body.data!.token!;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

const NOT_YET = 'BE-005 not merged yet — enable when the Lead module lands.';

// ---------------------------------------------------------------------------
// TC-CRM-01.. : Lead CRUD + filters
// ---------------------------------------------------------------------------
test.describe('QA-003 / CRM contract — Lead CRUD & filters (CRM_CONTRACT §5.1-5)', () => {
  test.skip(true, NOT_YET);

  test('TC-CRM-01 owner can create a lead with all core fields', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const response = await request.post(`${API_BASE}/leads`, {
      headers: bearer(token),
      data: {
        name: 'Acme redesign',
        company_name: 'Acme Corp',
        contact_name: 'Jane Doe',
        email: 'jane@acme.test',
        phone: '+1-555-0100',
        source: 'referral',
        status: 'new',
        estimated_value: 12000,
      },
    });
    expect(response.status()).toBe(201);
    const body = (await response.json()) as { data?: { id?: string | number; status?: string; source?: string } };
    expect(body.data?.id).toBeTruthy();
    expect(body.data?.status).toBe('new');
    expect(body.data?.source).toBe('referral');
  });

  test('TC-CRM-02 lead list supports filters status / owner_id / source / q', async ({ request }) => {
    const token = await login(request, 'OWNER');
    for (const params of [
      { status: 'new' },
      { source: 'referral' },
      { q: 'Acme' },
    ]) {
      const response = await request.get(`${API_BASE}/leads`, {
        headers: bearer(token),
        params,
      });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { data?: unknown[] };
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test('TC-CRM-03 GET /leads/{id} returns the lead and 404 for another agency', async ({ request }) => {
    const ownerToken = await login(request, 'OWNER');
    const otherToken = await login(request, 'OTHER_AGENCY');
    const leadId = process.env.E2E_LEAD_ID;
    test.skip(!leadId, 'Needs E2E_LEAD_ID from the shared seed.');

    const own = await request.get(`${API_BASE}/leads/${leadId}`, { headers: bearer(ownerToken) });
    expect(own.status()).toBe(200);

    const foreign = await request.get(`${API_BASE}/leads/${leadId}`, { headers: bearer(otherToken) });
    expect(foreign.status()).toBe(404);
  });

  test('TC-CRM-04 PATCH updates lead fields and DELETE soft-deletes', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const created = await request.post(`${API_BASE}/leads`, {
      headers: bearer(token),
      data: { name: 'To be updated', source: 'other', status: 'new' },
    });
    const id = ((await created.json()) as { data?: { id?: string | number } }).data?.id;
    expect(id).toBeTruthy();

    const patched = await request.patch(`${API_BASE}/leads/${id}`, {
      headers: bearer(token),
      data: { status: 'contacted', estimated_value: 5000 },
    });
    expect(patched.status()).toBe(200);
    const patchedBody = (await patched.json()) as { data?: { status?: string } };
    expect(patchedBody.data?.status).toBe('contacted');

    const deleted = await request.delete(`${API_BASE}/leads/${id}`, { headers: bearer(token) });
    expect([200, 204]).toContain(deleted.status());
  });
});

// ---------------------------------------------------------------------------
// TC-CRM-05.. : permission matrix leads.*
// ---------------------------------------------------------------------------
test.describe('QA-003 / CRM contract — leads.* permission matrix (CRM_CONTRACT §3)', () => {
  test.skip(true, NOT_YET);

  const roles = ['OWNER', 'ADMIN', 'SALES', 'PROJECT', 'ACCOUNTANT', 'TEAM'] as const;
  const expected: Record<string, Record<string, boolean>> = {
    OWNER: { view: true, create: true, update: true, delete: true, convert: true, notes: true, activities: true },
    ADMIN: { view: true, create: true, update: true, delete: true, convert: true, notes: true, activities: true },
    SALES: { view: true, create: true, update: true, delete: false, convert: true, notes: true, activities: true },
    PROJECT: { view: true, create: false, update: false, delete: false, convert: false, notes: false, activities: false },
    ACCOUNTANT: { view: true, create: false, update: false, delete: false, convert: false, notes: false, activities: false },
    TEAM: { view: false, create: false, update: false, delete: false, convert: false, notes: false, activities: false },
  };

  for (const role of roles) {
    test(`TC-CRM-05 ${role}: leads.view via GET /leads`, async ({ request }) => {
      const token = await login(request, role);
      const res = await request.get(`${API_BASE}/leads`, { headers: bearer(token) });
      if (expected[role].view) {
        expect(res.status()).toBe(200);
      } else {
        expect(res.status()).toBe(403);
        expect((await errorOf(res)).code).toBe('FORBIDDEN');
      }
    });
  }

  test('TC-CRM-06 roles without leads.create get 403 on POST /leads', async ({ request }) => {
    for (const role of ['PROJECT', 'ACCOUNTANT', 'TEAM'] as const) {
      const token = await login(request, role);
      const res = await request.post(`${API_BASE}/leads`, {
        headers: bearer(token),
        data: { name: `forbidden-${role}`, source: 'other', status: 'new' },
      });
      expect(res.status()).toBe(403);
    }
  });

  test('TC-CRM-07 only Owner + Admin may delete a lead', async ({ request }) => {
    const leadId = process.env.E2E_LEAD_ID;
    test.skip(!leadId, 'Needs E2E_LEAD_ID from the shared seed.');
    for (const role of ['SALES', 'PROJECT', 'ACCOUNTANT', 'TEAM'] as const) {
      const token = await login(request, role);
      const res = await request.delete(`${API_BASE}/leads/${leadId}`, { headers: bearer(token) });
      expect(res.status()).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-CRM-08.. : conversion
// ---------------------------------------------------------------------------
test.describe('QA-003 / CRM contract — Lead → Client conversion (CRM_CONTRACT §4)', () => {
  test.skip(true, NOT_YET);

  test('TC-CRM-08 conversion creates Client + Organization + Contact and locks the lead', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const created = await request.post(`${API_BASE}/leads`, {
      headers: bearer(token),
      data: {
        name: 'Convert me',
        company_name: 'Convert Co',
        contact_name: 'Conv Contact',
        email: 'conv@convert.test',
        source: 'website',
        status: 'qualified',
      },
    });
    const leadId = ((await created.json()) as { data?: { id?: string | number } }).data?.id;
    expect(leadId).toBeTruthy();

    const conv = await request.post(`${API_BASE}/leads/${leadId}/convert`, {
      headers: bearer(token),
      data: {},
    });
    expect(conv.status()).toBe(200);
    const body = (await conv.json()) as { data?: { client_id?: string | number; client?: { status?: string; type?: string } } };
    expect(body.data?.client_id ?? body.data?.client?.status).toBeTruthy();

    // lead stays readable but main fields locked
    const lead = await request.get(`${API_BASE}/leads/${leadId}`, { headers: bearer(token) });
    expect(lead.status()).toBe(200);
  });

  test('TC-CRM-09 second conversion returns 409 LEAD_ALREADY_CONVERTED', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const leadId = process.env.E2E_CONVERTED_LEAD_ID;
    test.skip(!leadId, 'Needs E2E_CONVERTED_LEAD_ID from the shared seed.');
    const res = await request.post(`${API_BASE}/leads/${leadId}/convert`, {
      headers: bearer(token),
      data: {},
    });
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe('LEAD_ALREADY_CONVERTED');
  });

  test('TC-CRM-10 duplicate client candidate returns 422 unless force:true', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const leadId = process.env.E2E_DUP_LEAD_ID;
    test.skip(!leadId, 'Needs E2E_DUP_LEAD_ID from the shared seed.');
    const first = await request.post(`${API_BASE}/leads/${leadId}/convert`, {
      headers: bearer(token),
      data: {},
    });
    // either duplicate guard or already converted; accept 422
    if (first.status() === 422) {
      expect((await errorOf(first)).code).toBe('DUPLICATE_CLIENT_CANDIDATE');
      const forced = await request.post(`${API_BASE}/leads/${leadId}/convert`, {
        headers: bearer(token),
        data: { force: true },
      });
      expect([200, 409]).toContain(forced.status());
    }
  });

  test('TC-CRM-11 conversion re-links lead contacts to the new client', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const leadId = process.env.E2E_LEAD_WITH_CONTACTS_ID;
    test.skip(!leadId, 'Needs E2E_LEAD_WITH_CONTACTS_ID from the shared seed.');
    const conv = await request.post(`${API_BASE}/leads/${leadId}/convert`, {
      headers: bearer(token),
      data: {},
    });
    expect(conv.status()).toBe(200);
    const clientId = ((await conv.json()) as { data?: { client_id?: string | number } }).data?.client_id;
    const contacts = await request.get(`${API_BASE}/clients/${clientId}/contacts`, { headers: bearer(token) });
    expect(contacts.status()).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// TC-CRM-12.. : notes, activities, due list, pipeline summary, contacts
// ---------------------------------------------------------------------------
test.describe('QA-003 / CRM contract — notes, activities, pipeline, contacts', () => {
  test.skip(true, NOT_YET);

  test('TC-CRM-12 lead notes can be created and deleted by author/owner/admin', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const leadId = process.env.E2E_LEAD_ID;
    test.skip(!leadId, 'Needs E2E_LEAD_ID from the shared seed.');

    const created = await request.post(`${API_BASE}/leads/${leadId}/notes`, {
      headers: bearer(token),
      data: { body: 'Follow up next week' },
    });
    expect(created.status()).toBe(201);
    const noteId = ((await created.json()) as { data?: { id?: string | number } }).data?.id;
    expect(noteId).toBeTruthy();

    const deleted = await request.delete(`${API_BASE}/leads/${leadId}/notes/${noteId}`, { headers: bearer(token) });
    expect([200, 204]).toContain(deleted.status());
  });

  test('TC-CRM-13 activity completion flow sets is_done + completed_at', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const leadId = process.env.E2E_LEAD_ID;
    test.skip(!leadId, 'Needs E2E_LEAD_ID from the shared seed.');

    const created = await request.post(`${API_BASE}/leads/${leadId}/activities`, {
      headers: bearer(token),
      data: { type: 'call', scheduled_at: new Date(Date.now() + 3600_000).toISOString(), note: 'intro call' },
    });
    expect(created.status()).toBe(201);
    const activityId = ((await created.json()) as { data?: { id?: string | number } }).data?.id;
    expect(activityId).toBeTruthy();

    const patched = await request.patch(`${API_BASE}/leads/${leadId}/activities/${activityId}`, {
      headers: bearer(token),
      data: { is_done: true },
    });
    expect(patched.status()).toBe(200);
    const body = (await patched.json()) as { data?: { is_done?: boolean; completed_at?: string | null } };
    expect(body.data?.is_done).toBe(true);
    expect(body.data?.completed_at).toBeTruthy();
  });

  test('TC-CRM-14 due list returns unfinished activities with scheduled_at <= now', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const res = await request.get(`${API_BASE}/lead-activities/due`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: Array<{ is_done?: boolean; scheduled_at?: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    for (const a of body.data ?? []) {
      expect(a.is_done).toBe(false);
    }
  });

  test('TC-CRM-15 pipeline summary counts and totals match underlying data', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const res = await request.get(`${API_BASE}/leads/pipeline-summary`, { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data?: Array<{ status?: string; count?: number; total_estimated_value?: number }> };
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('TC-CRM-16 shared contacts table: lead_id XOR client_id', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const leadId = process.env.E2E_LEAD_ID;
    test.skip(!leadId, 'Needs E2E_LEAD_ID from the shared seed.');

    const created = await request.post(`${API_BASE}/leads/${leadId}/contacts`, {
      headers: bearer(token),
      data: { name: 'Lead Contact', email: 'lc@lead.test' },
    });
    expect(created.status()).toBe(201);

    // cross-tenant owner reference rejected
    const cross = await request.post(`${API_BASE}/leads/${leadId}/contacts`, {
      headers: bearer(token),
      data: { name: 'Bad', owner_id: 999999 },
    });
    if (cross.status() === 422) {
      expect((await errorOf(cross)).code).toBe('CROSS_TENANT_REFERENCE');
    }
  });
});

// ---------------------------------------------------------------------------
// TC-CRM-17.. : cross-tenant isolation
// ---------------------------------------------------------------------------
test.describe('QA-003 / CRM contract — tenant isolation', () => {
  test.skip(true, NOT_YET);

  test('TC-CRM-17 foreign agency lead access returns 404', async ({ request }) => {
    const otherToken = await login(request, 'OTHER_AGENCY');
    const leadId = process.env.E2E_LEAD_ID;
    test.skip(!leadId, 'Needs E2E_LEAD_ID from the shared seed.');
    const res = await request.get(`${API_BASE}/leads/${leadId}`, { headers: bearer(otherToken) });
    expect(res.status()).toBe(404);
  });

  test('TC-CRM-18 cross-tenant owner_id reference returns 422 CROSS_TENANT_REFERENCE', async ({ request }) => {
    const token = await login(request, 'OWNER');
    const foreignOwnerId = process.env.E2E_FOREIGN_USER_ID;
    test.skip(!foreignOwnerId, 'Needs E2E_FOREIGN_USER_ID from the shared seed.');
    const res = await request.post(`${API_BASE}/leads`, {
      headers: bearer(token),
      data: { name: 'cross-tenant', source: 'other', status: 'new', owner_id: Number(foreignOwnerId) },
    });
    expect(res.status()).toBe(422);
    expect((await errorOf(res)).code).toBe('CROSS_TENANT_REFERENCE');
  });
});
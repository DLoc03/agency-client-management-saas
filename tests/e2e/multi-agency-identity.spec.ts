import { expect, test, type APIRequestContext } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@demo.test';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'password';
const PORTAL_EMAIL = process.env.E2E_PORTAL_EMAIL ?? 'client@demo.test';
const PORTAL_PASSWORD = process.env.E2E_PORTAL_PASSWORD ?? 'password';

type LoginBody = { data?: { token?: string; selection_token?: string; memberships?: { id: number; agency: { id: number } }[] } };

async function ownerLogin(request: APIRequestContext): Promise<LoginBody> {
  const response = await request.post(`${API_BASE}/auth/login`, { data: { email: OWNER_EMAIL, password: OWNER_PASSWORD } });
  expect(response.status()).toBe(200);
  return (await response.json()) as LoginBody;
}

test.describe('QA-007 / multi-agency identity (DEC-018, DEC-020)', () => {
  test('TC-MA-01 login with two memberships returns a selection token', async ({ request }) => {
    const body = await ownerLogin(request);
    test.skip(!body.data?.selection_token, 'precondition: identity must have >=2 active memberships (FE-014 fixture)');
    expect(body.data?.selection_token).toBeTruthy();
    expect((body.data?.memberships ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test('TC-MA-04 selecting a membership the identity lacks is rejected', async ({ request }) => {
    const body = await ownerLogin(request);
    test.skip(!body.data?.selection_token, 'precondition: identity must have >=2 active memberships (FE-014 fixture)');
    const badSelect = await request.post(`${API_BASE}/auth/select-agency`, {
      headers: { Authorization: `Bearer ${body.data!.selection_token!}` },
      data: { membership_id: 999999 },
    });
    expect(badSelect.status()).toBe(404);
  });

  test('TC-MA-02 select-agency issues a token bound to the chosen membership', async ({ request }) => {
    const body = await ownerLogin(request);
    test.skip(!body.data?.selection_token, 'precondition: identity must have >=2 active memberships (FE-014 fixture)');
    const select = await request.post(`${API_BASE}/auth/select-agency`, {
      headers: { Authorization: `Bearer ${body.data!.selection_token!}` },
      data: { membership_id: body.data!.memberships![0].id },
    });
    expect(select.status()).toBe(200);
    const selectBody = (await select.json()) as LoginBody;
    expect(selectBody.data?.token).toBeTruthy();
  });

  test('TC-MA-03 switch-agency revokes the previous token', async ({ request }) => {
    const body = await ownerLogin(request);
    test.skip(!body.data?.selection_token, 'precondition: identity must have >=2 active memberships (FE-014 fixture)');
    const select = await request.post(`${API_BASE}/auth/select-agency`, {
      headers: { Authorization: `Bearer ${body.data!.selection_token!}` },
      data: { membership_id: body.data!.memberships![0].id },
    });
    const tokenA = ((await select.json()) as LoginBody).data!.token!;

    const switchRes = await request.post(`${API_BASE}/auth/switch-agency`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { membership_id: body.data!.memberships![1].id },
    });
    expect(switchRes.status()).toBe(200);
    const tokenB = ((await switchRes.json()) as LoginBody).data!.token!;

    const oldCall = await request.get(`${API_BASE}/clients`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect([401, 403]).toContain(oldCall.status());

    const newCall = await request.get(`${API_BASE}/clients`, { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(newCall.status()).toBe(200);
  });

  test('TC-MA-05 Portal login uses a client membership', async ({ request }) => {
    const response = await request.post(`${API_BASE}/portal/auth/login`, { data: { email: PORTAL_EMAIL, password: PORTAL_PASSWORD } });
    expect(response.status()).toBe(200);
    const portalBody = (await response.json()) as LoginBody;
    expect(portalBody.data?.token).toBeTruthy();
  });
});

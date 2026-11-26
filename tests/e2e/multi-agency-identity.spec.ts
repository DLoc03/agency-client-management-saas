import { expect, test, type APIRequestContext } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner@demo.test';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'password';
const PORTAL_EMAIL = process.env.E2E_PORTAL_EMAIL ?? 'client@demo.test';
const PORTAL_PASSWORD = process.env.E2E_PORTAL_PASSWORD ?? 'password';

type LoginBody = { data?: { token?: string; selection_token?: string; memberships?: { id: number; agency: { id: number } }[] } };

test.describe('QA-007 / multi-agency identity (DEC-018, DEC-020)', () => {
  test('TC-MA-01..05 multi-agency identity API flows', async ({ request }) => {
    // TC-MA-01
    const login = await request.post(`${API_BASE}/auth/login`, { data: { email: OWNER_EMAIL, password: OWNER_PASSWORD } });
    expect(login.status()).toBe(200);
    const loginBody = (await login.json()) as LoginBody;
    expect(loginBody.data?.selection_token).toBeTruthy();
    expect((loginBody.data?.memberships ?? []).length).toBeGreaterThanOrEqual(2);

    // TC-MA-04
    const badSelect = await request.post(`${API_BASE}/auth/select-agency`, {
      headers: { Authorization: `Bearer ${loginBody.data!.selection_token!}` },
      data: { membership_id: 999999 },
    });
    expect(badSelect.status()).toBe(404);

    // TC-MA-02
    const select = await request.post(`${API_BASE}/auth/select-agency`, {
      headers: { Authorization: `Bearer ${loginBody.data!.selection_token!}` },
      data: { membership_id: loginBody.data!.memberships![0].id },
    });
    expect(select.status()).toBe(200);
    const selectBody = (await select.json()) as LoginBody;
    expect(selectBody.data?.token).toBeTruthy();
    const tokenA = selectBody.data!.token!;

    // TC-MA-03
    const switchRes = await request.post(`${API_BASE}/auth/switch-agency`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { membership_id: loginBody.data!.memberships![1].id },
    });
    expect(switchRes.status()).toBe(200);
    const tokenB = (await switchRes.json() as LoginBody).data!.token!;

    const oldCall = await request.get(`${API_BASE}/clients`, { headers: { Authorization: `Bearer ${tokenA}` } });
    expect([401, 403]).toContain(oldCall.status());

    const newCall = await request.get(`${API_BASE}/clients`, { headers: { Authorization: `Bearer ${tokenB}` } });
    expect(newCall.status()).toBe(200);

    // TC-MA-05
    const portalLogin = await request.post(`${API_BASE}/portal/auth/login`, { data: { email: PORTAL_EMAIL, password: PORTAL_PASSWORD } });
    expect(portalLogin.status()).toBe(200);
    const portalBody = (await portalLogin.json()) as LoginBody;
    expect(portalBody.data?.token).toBeTruthy();
  });
});

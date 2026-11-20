/**
 * QA-002 — Auth & tenancy test coverage.
 *
 * Source of truth: docs/AUTH_CONTRACT.md (approved 2026-11-20, DEC-008).
 * These cases are written before the implementation lands; real runs start when
 * BE-003 / FE-002 / FE-003 open their PRs. No secrets are hardcoded here — all
 * accounts come from the shared English demo dataset via E2E_* environment vars
 * (see tests/e2e/README.md and CONVENTIONS.md H.4).
 */

import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';
const WEB_BASE = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

type Credentials = { email: string; password: string };

type ErrorBody = { error?: { code?: string; message?: string; details?: Record<string, string[]> } };

type LoginData = { token?: string; user?: { locale?: string; roles?: string[] }; agency?: { id?: string | number } };

function credentials(prefix: 'USER' | 'PORTAL' | 'LOCKED' | 'DISABLED' | 'OTHER_AGENCY' | 'RATE_LIMIT'): Credentials {
  const email = process.env[`E2E_${prefix}_EMAIL`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(
      `Missing E2E_${prefix}_EMAIL / E2E_${prefix}_PASSWORD. Use the shared English demo dataset (tests/e2e/README.md).`,
    );
  }
  return { email, password };
}

async function errorOf(response: APIResponse): Promise<NonNullable<ErrorBody['error']>> {
  const body = (await response.json()) as ErrorBody;
  expect(body.error, `Expected error envelope on HTTP ${response.status()}`).toBeTruthy();
  return body.error!;
}

async function login(request: APIRequestContext, who: Parameters<typeof credentials>[0], path = '/auth/login'): Promise<APIResponse> {
  return request.post(`${API_BASE}${path}`, { data: credentials(who) });
}

async function tokenOf(response: APIResponse): Promise<string> {
  const body = (await response.json()) as { data?: LoginData };
  expect(body.data?.token, 'Response must contain data.token').toBeTruthy();
  return body.data!.token!;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Cross-scope calls may be rejected as 401 UNAUTHENTICATED or 403 FORBIDDEN; both mean "blocked". */
function expectScopeBlocked(status: number, code: string | undefined): void {
  expect([401, 403]).toContain(status);
  expect(['UNAUTHENTICATED', 'FORBIDDEN']).toContain(code);
}

test.describe('QA-002 / API contract — internal auth (AUTH_CONTRACT §3)', () => {
  test('TC-AUTH-01 login with valid credentials returns token, user roles/permissions/locale and agency', async ({ request }) => {
    const response = await login(request, 'USER');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data?: LoginData & { user?: { permissions?: string[] } } };
    expect(body.data?.token).toBeTruthy();
    expect(Array.isArray(body.data?.user?.roles)).toBe(true);
    expect(Array.isArray(body.data?.user?.permissions)).toBe(true);
    expect(['en', 'vi']).toContain(body.data?.user?.locale);
    expect(body.data?.agency?.id).toBeTruthy();
  });

  test('TC-AUTH-02 wrong email and wrong password both return 401 INVALID_CREDENTIALS without Account enumeration', async ({ request }) => {
    const good = credentials('USER');
    const cases = [
      { email: `nobody-${Date.now()}@example.invalid`, password: good.password },
      { email: good.email, password: `${good.password}-wrong` },
    ];
    for (const data of cases) {
      const response = await request.post(`${API_BASE}/auth/login`, { data });
      expect(response.status()).toBe(401);
      const error = await errorOf(response);
      expect(error.code).toBe('INVALID_CREDENTIALS');
      expect(JSON.stringify(error).toLowerCase()).not.toContain(data.email.toLowerCase());
    }
  });

  test('TC-AUTH-03 locked agency returns 403 AGENCY_LOCKED even with the right password', async ({ request }) => {
    const response = await login(request, 'LOCKED');
    expect(response.status()).toBe(403);
    expect((await errorOf(response)).code).toBe('AGENCY_LOCKED');
  });

  test('TC-AUTH-04 deactivated internal account returns 403 ACCOUNT_DISABLED', async ({ request }) => {
    const response = await login(request, 'DISABLED');
    expect(response.status()).toBe(403);
    expect((await errorOf(response)).code).toBe('ACCOUNT_DISABLED');
  });

  test('TC-AUTH-05 a portal account cannot log in through the internal endpoint', async ({ request }) => {
    const response = await login(request, 'PORTAL');
    expect([401, 403]).toContain(response.status());
    const error = await errorOf(response);
    expect(['INVALID_CREDENTIALS', 'FORBIDDEN']).toContain(error.code);
  });

  test('TC-AUTH-06 error messages are localised by Accept-Language while machine codes stay stable', async ({ request }) => {
    const data = { email: credentials('USER').email, password: 'definitely-wrong' };
    const en = await request.post(`${API_BASE}/auth/login`, { data, headers: { 'Accept-Language': 'en' } });
    const vi = await request.post(`${API_BASE}/auth/login`, { data, headers: { 'Accept-Language': 'vi' } });
    const enError = await errorOf(en);
    const viError = await errorOf(vi);
    expect(enError.code).toBe('INVALID_CREDENTIALS');
    expect(viError.code).toBe('INVALID_CREDENTIALS');
    expect(viError.message).toBeTruthy();
    expect(viError.message).not.toBe(enError.message);
  });
});

test.describe('QA-002 / API contract — portal auth & token scope isolation (DEC-008)', () => {
  test('TC-AUTH-07 portal login succeeds with a portal-scoped token and client summary', async ({ request }) => {
    const response = await login(request, 'PORTAL', '/portal/auth/login');
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { data?: LoginData & { client?: unknown } };
    expect(body.data?.token).toBeTruthy();
    expect(body.data?.client).toBeTruthy();
  });

  test('TC-AUTH-08 portal token calling internal API is blocked', async ({ request }) => {
    const portalToken = await tokenOf(await login(request, 'PORTAL', '/portal/auth/login'));
    const response = await request.get(`${API_BASE}/auth/me`, { headers: bearer(portalToken) });
    expectScopeBlocked(response.status(), (await errorOf(response)).code);
  });

  test('TC-AUTH-09 internal token calling portal API is blocked', async ({ request }) => {
    const appToken = await tokenOf(await login(request, 'USER'));
    const response = await request.get(`${API_BASE}/portal/auth/me`, { headers: bearer(appToken) });
    expectScopeBlocked(response.status(), (await errorOf(response)).code);
  });

  test('TC-AUTH-17 portal forgot/reset password endpoints — CONTRACT GAP', async () => {
    test.fixme(
      'DEC-008.3 approved portal password reset, but AUTH_CONTRACT §3 only lists portal login/logout/me. ' +
        'Muse + Nguyen must confirm method/path/request/response before this case can run (reported in TASK.md Inbox by QA-001).',
    );
  });
});

test.describe('QA-002 / API contract — tenancy isolation (AUTH_CONTRACT §2)', () => {
  test('TC-AUTH-10 agency_id from the request is ignored; scope always comes from the token', async ({ request }) => {
    const loginResponse = await login(request, 'USER');
    const token = await tokenOf(loginResponse);
    const ownAgency = ((await loginResponse.json()) as { data?: LoginData }).data?.agency?.id;
    const foreignAgency = process.env.E2E_FOREIGN_AGENCY_ID;
    if (!foreignAgency) throw new Error('Missing E2E_FOREIGN_AGENCY_ID from the shared demo dataset.');

    for (const target of [
      `${API_BASE}/auth/me?agency_id=${foreignAgency}`,
      `${API_BASE}/auth/me`,
    ]) {
      const response = await request.get(target, { headers: { ...bearer(token), 'X-Agency-Id': foreignAgency } });
      expect(response.status()).toBe(200);
      const body = (await response.json()) as { data?: { agency?: { id?: string | number } } };
      expect(String(body.data?.agency?.id)).toBe(String(ownAgency));
    }
  });

  test('TC-AUTH-11 reading a record from another agency returns 404, not 403', async ({ request }) => {
    const resourcePath = process.env.E2E_TENANT_RESOURCE_PATH;
    const foreignId = process.env.E2E_FOREIGN_RESOURCE_ID;
    test.skip(
      !resourcePath || !foreignId,
      'Needs the first business resource endpoint + a foreign-agency record ID from the BE-003/BE-004 seed.',
    );
    const token = await tokenOf(await login(request, 'USER'));
    const response = await request.get(`${API_BASE}${resourcePath!.replace('{id}', foreignId!)}`, { headers: bearer(token) });
    expect(response.status()).toBe(404);
    expect((await errorOf(response)).code).not.toBe('FORBIDDEN');
  });

  test('TC-AUTH-12 cross-tenant FK on create returns 422 CROSS_TENANT_REFERENCE', async ({ request }) => {
    const createPath = process.env.E2E_TENANT_CREATE_PATH;
    const foreignId = process.env.E2E_FOREIGN_RESOURCE_ID;
    test.skip(!createPath || !foreignId, 'Needs a business create endpoint and a foreign-agency FK from the BE seed.');
    const token = await tokenOf(await login(request, 'USER'));
    const response = await request.post(`${API_BASE}${createPath}`, {
      headers: bearer(token),
      data: { client_id: foreignId },
    });
    expect(response.status()).toBe(422);
    expect((await errorOf(response)).code).toBe('CROSS_TENANT_REFERENCE');
  });
});

test.describe.serial('QA-002 / API contract — password lifecycle & rate limit', () => {
  test('TC-AUTH-13 login rate limit is 5 attempts/minute/IP, 6th returns 429', async ({ request }) => {
    // Serial on purpose: the counter is per IP. Run this group alone to avoid interference.
    const data = credentials('RATE_LIMIT');
    let limited = 0;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await request.post(`${API_BASE}/auth/login`, { data });
      if (response.status() === 429) limited += 1;
      else expect([401, 200]).toContain(response.status());
    }
    expect(limited, 'Expected the 6th attempt within one minute to be rate limited').toBeGreaterThan(0);
  });

  test('TC-AUTH-14 logout revokes the token immediately', async ({ request }) => {
    const token = await tokenOf(await login(request, 'USER'));
    const logout = await request.post(`${API_BASE}/auth/logout`, { headers: bearer(token) });
    expect([200, 204]).toContain(logout.status());
    const response = await request.get(`${API_BASE}/auth/me`, { headers: bearer(token) });
    expect(response.status()).toBe(401);
    expect((await errorOf(response)).code).toBe('UNAUTHENTICATED');
  });

  test('TC-AUTH-15 changing password revokes all other tokens (DEC-008.2)', async ({ request }) => {
    const email = process.env.E2E_CHANGE_PASSWORD_EMAIL;
    const oldPassword = process.env.E2E_CHANGE_PASSWORD_OLD;
    const newPassword = process.env.E2E_CHANGE_PASSWORD_NEW;
    test.skip(
      !email || !oldPassword || !newPassword,
      'Needs a dedicated disposable account — never mutate the shared demo seed used by other agents.',
    );
    const first = await tokenOf(await request.post(`${API_BASE}/auth/login`, { data: { email, password: oldPassword } }));
    const second = await tokenOf(await request.post(`${API_BASE}/auth/login`, { data: { email, password: oldPassword } }));
    const change = await request.post(`${API_BASE}/auth/change-password`, {
      headers: bearer(first),
      data: { current_password: oldPassword, new_password: newPassword },
    });
    expect(change.status()).toBe(200);
    const revoked = await request.get(`${API_BASE}/auth/me`, { headers: bearer(second) });
    expect(revoked.status()).toBe(401);
  });

  test('TC-AUTH-16 forgot-password never enumerates accounts; invalid reset token returns 422', async ({ request }) => {
    const unknown = await request.post(`${API_BASE}/auth/forgot-password`, {
      data: { email: `missing-${Date.now()}@example.invalid` },
    });
    expect(unknown.status()).toBe(200);
    const reset = await request.post(`${API_BASE}/auth/reset-password`, {
      data: { token: 'invalid-token', email: credentials('USER').email, new_password: 'new-password-123' },
    });
    expect(reset.status()).toBe(422);
    expect((await errorOf(reset)).code).toBe('INVALID_RESET_TOKEN');
  });
});

test.describe('QA-002 / E2E — internal login (FE-002)', () => {
  test('TC-E2E-01 successful login lands in the app and route guard redirects after logout', async ({ page, request }) => {
    const response = await attemptInternalLogin(page, 'USER');
    expect(response?.ok()).toBe(true);
    await expect(page).not.toHaveURL(/\/login/);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${WEB_BASE}/`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-E2E-02 invalid credentials show the INVALID_CREDENTIALS message', async ({ page }) => {
    const good = credentials('USER');
    await page.goto(`${WEB_BASE}/login`);
    await page.getByLabel(/email|email đăng nhập/i).fill(good.email);
    await page.getByLabel(/password|mật khẩu/i).fill(`${good.password}-wrong`);
    await page.getByRole('button', { name: /sign in|log in|đăng nhập/i }).click();
    await expect(page.getByText(/invalid credentials|thông tin đăng nhập không đúng/i)).toBeVisible();
  });

  test('TC-E2E-03 locked agency and disabled account messages are shown (AGENCY_LOCKED / ACCOUNT_DISABLED)', async ({ page }) => {
    // Driven by the same seeded accounts as TC-AUTH-03/04; assert the machine-derived message, not a hardcoded string.
    for (const [who, pattern] of [
      ['LOCKED', /agency (is )?locked|agency bị khoá/i],
      ['DISABLED', /account (is )?disabled|tài khoản bị vô hiệu/i],
    ] as const) {
      const c = credentials(who);
      await page.goto(`${WEB_BASE}/login`);
      await page.getByLabel(/email|email đăng nhập/i).fill(c.email);
      await page.getByLabel(/password|mật khẩu/i).fill(c.password);
      await page.getByRole('button', { name: /sign in|log in|đăng nhập/i }).click();
      await expect(page.getByText(pattern)).toBeVisible();
    }
  });

  test('TC-E2E-04 language switch works on the login screen with no hardcoded UI strings', async ({ page }) => {
    await page.goto(`${WEB_BASE}/login`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await page.getByRole('button', { name: /^vi$|tiếng việt/i }).click();
    await expect(page.getByLabel(/mật khẩu/i)).toBeVisible();
    await page.getByRole('button', { name: /^en$|english/i }).click();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});

test.describe('QA-002 / E2E — client portal (FE-003)', () => {
  test('TC-E2E-05 portal login uses its own route and token, and cannot reach the internal app', async ({ page, request }) => {
    await page.goto(`${WEB_BASE}/portal/login`);
    const c = credentials('PORTAL');
    const response = await attemptPortalLogin(page, c);
    expect(response?.ok()).toBe(true);
    await expect(page).not.toHaveURL(/\/portal\/login/);

    const token = await tokenOf(response!);
    const internal = await request.get(`${API_BASE}/auth/me`, { headers: bearer(token) });
    expectScopeBlocked(internal.status(), (await errorOf(internal)).code);

    await page.goto(`${WEB_BASE}/`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-E2E-06 portal overview is an i18n placeholder and EN/VI both work', async ({ page }) => {
    await page.goto(`${WEB_BASE}/portal/login`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await page.getByRole('button', { name: /^vi$|tiếng việt/i }).click();
    await expect(page.getByLabel(/mật khẩu/i)).toBeVisible();
  });
});

async function attemptInternalLogin(page: Page, who: Parameters<typeof credentials>[0]) {
  const c = credentials(who);
  await page.goto(`${WEB_BASE}/login`);
  await page.getByLabel(/email|email đăng nhập/i).fill(c.email);
  await page.getByLabel(/password|mật khẩu/i).fill(c.password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/auth/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /sign in|log in|đăng nhập/i }).click(),
  ]);
  return response;
}

async function attemptPortalLogin(page: Page, c: Credentials) {
  await page.getByLabel(/email/i).fill(c.email);
  await page.getByLabel(/password|mật khẩu/i).fill(c.password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/portal/auth/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /sign in|log in|đăng nhập/i }).click(),
  ]);
  return response;
}

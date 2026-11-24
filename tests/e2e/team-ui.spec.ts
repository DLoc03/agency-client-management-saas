/**
 * QA-005 — Team & Resource Management on the real UI (FE-009).
 *
 * Mirrors tests/e2e/project-ui.spec.ts: the browser talks to the Next.js app
 * (which proxies the real Laravel API); nothing is mocked.
 *
 * Accounts come from the shared English demo seed via E2E_* vars. A disposable
 * team is created through the API in beforeAll and removed in afterAll.
 */

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.describe.configure({ timeout: 300_000 });

const WEB_BASE = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';
const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? '';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? '';

type Team = { id: number; name: string };
type User = { id: number; name: string; email: string };

let ownerToken = '';
let team: Team | null = null;
let member: User | null = null;

// The UI login goes through the Next.js BFF, so its backend requests come from
// the web container IP. Keep at most 4 logins per rolling minute (limit is 5).
const uiThrottleWindow: number[] = [];

async function uiThrottleSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (uiThrottleWindow.length > 0 && now - uiThrottleWindow[0] >= 60_000) {
      uiThrottleWindow.shift();
    }
    if (uiThrottleWindow.length < 4) {
      uiThrottleWindow.push(now);
      return;
    }
    const waitMs = 60_000 - (now - uiThrottleWindow[0]) + 500;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

async function loginAsOwner(page: Page): Promise<void> {
  await uiThrottleSlot();
  await page.goto(`${WEB_BASE}/en/login`);
  await page.getByLabel(/email|email đăng nhập/i).fill(OWNER_EMAIL);
  await page.getByLabel(/password|mật khẩu/i).fill(OWNER_PASSWORD);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /sign in|log in|đăng nhập/i }).click(),
  ]);
  expect(response.ok(), 'owner login via the app BFF').toBeTruthy();
  await expect(page).not.toHaveURL(/\/login/);
}

async function apiLogin(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_BASE}/auth/login`, {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as { data?: { token?: string } };
  expect(body.data?.token).toBeTruthy();
  return body.data!.token!;
}

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

test.beforeAll(async ({ request }) => {
  if (!OWNER_EMAIL || !OWNER_PASSWORD) return;

  ownerToken = await apiLogin(request);
  // Sorts to the top of the alphabetical first page (the list is not filtered).
  const name = `000 QA UI Team ${Date.now()}`;
  const teamResponse = await request.post(`${API_BASE}/teams`, {
    headers: bearer(ownerToken),
    data: { name, description: 'Created by QA-005 UI setup' },
  });
  expect(teamResponse.status(), await teamResponse.text()).toBe(201);
  team = ((await teamResponse.json()) as { data: Team }).data;

  // Prefer the seeded Team Member account; fall back to the owner so the
  // "view members" flow still has a visible member.
  const memberEmail = process.env.E2E_TEAM_EMAIL || OWNER_EMAIL;
  const usersResponse = await request.get(`${API_BASE}/users?per_page=100&q=${encodeURIComponent(memberEmail)}`, {
    headers: bearer(ownerToken),
  });
  const users = ((await usersResponse.json()) as { data?: User[] }).data ?? [];
  member = users.find((user) => user.email === memberEmail) ?? null;

  if (member) {
    const addResponse = await request.post(`${API_BASE}/teams/${team.id}/members`, {
      headers: bearer(ownerToken),
      data: { user_id: member.id },
    });
    expect(addResponse.status(), await addResponse.text()).toBe(201);
  }
});

test.afterAll(async ({ request }) => {
  if (!team || !ownerToken) return;
  await request.delete(`${API_BASE}/teams/${team.id}`, { headers: bearer(ownerToken) });
});

test.describe('QA-005 / UI — Team & Resource Management (FE-009)', () => {
  test('TC-TEAM-UI-01 Team Members directory lists people and filters by search and role', async ({ page }) => {
    test.skip(!OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/team/members`);

    await expect(page.getByRole('heading', { level: 1, name: /team & resources/i })).toBeVisible();
    await expect(page.getByPlaceholder('Search')).toBeVisible();

    // Seed order is alphabetical: the demo owner is visible in the full directory.
    await expect(page.getByText(OWNER_EMAIL).first()).toBeVisible();

    // Role filter.
    await page.locator('select').first().selectOption('accountant');
    await expect(page.getByText('accountant@demo.test').first()).toBeVisible({ timeout: 15_000 });

    // Search filter (reset the role filter first).
    await page.locator('select').first().selectOption('');
    await page.getByPlaceholder('Search').fill(OWNER_EMAIL);
    await expect(page.getByText(OWNER_EMAIL).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-TEAM-UI-02 Teams list shows seeded/disposable teams and the New team action', async ({ page }) => {
    test.skip(!OWNER_EMAIL || !team, 'Missing owner credentials or UI team fixture.');
    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/team/teams`);

    await expect(page.getByRole('heading', { level: 1, name: /team & resources/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new team/i })).toBeVisible();
    await expect(page.getByText(team!.name).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-TEAM-UI-03 opening a team shows its member list', async ({ page }) => {
    test.skip(!OWNER_EMAIL || !team, 'Missing owner credentials or UI team fixture.');
    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/team/teams/${team!.id}`);

    await expect(page.getByRole('heading', { level: 1, name: team!.name })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 2, name: /^members$/i })).toBeVisible();
    if (member) {
      await expect(page.getByText(member.email).first()).toBeVisible();
    }
  });

  test('TC-TEAM-UI-04 workload page renders per-person task numbers', async ({ page }) => {
    test.skip(!OWNER_EMAIL, 'Missing E2E_OWNER_EMAIL/PASSWORD.');
    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/team/workload`);

    await expect(page.getByRole('heading', { level: 1, name: /workload/i })).toBeVisible();
    await expect(page.getByText(/open tasks:\s*\d+/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/overdue:\s*\d+/i).first()).toBeVisible();
    await expect(page.getByText(/due in 7 days:\s*\d+/i).first()).toBeVisible();
    await expect(page.getByText(OWNER_EMAIL).first()).toBeVisible();
  });

  test('TC-TEAM-UI-05 accept-invitation surfaces a clear error for an invalid token', async ({ page }) => {
    await page.goto(`${WEB_BASE}/en/accept-invitation?token=invalid-qa-${Date.now()}`);
    // The form labels are not associated with their inputs in FE-009, so use
    // positional selectors instead of getByLabel.
    const inputs = page.locator('form input');
    await inputs.nth(0).fill('Invalid Token QA');
    await inputs.nth(1).fill('QaPassw0rd!');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/invitations/accept') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /accept invitation/i }).click(),
    ]);
    expect(response.status()).toBe(404);

    const errorBox = page.locator('.text-red-700').first();
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText(/not found|invalid|expired|404/i);
  });
});

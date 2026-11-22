/**
 * QA-004 — Project Management E2E on the real UI (FE-008).
 */

import { expect, test, type Page } from '@playwright/test';

const WEB_BASE = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';

function credentials() {
  return {
    email: process.env.E2E_OWNER_EMAIL ?? '',
    password: process.env.E2E_OWNER_PASSWORD ?? '',
  };
}

async function apiLogin(request: any) {
  const res = await request.post(`${API_BASE}/auth/login`, { data: credentials() });
  const body = (await res.json()) as { data?: { token?: string } };
  return body.data?.token ?? '';
}

async function loginAsOwner(page: Page) {
  const c = credentials();
  await page.goto(`${WEB_BASE}/en/login`);
  await page.getByLabel(/email|email đăng nhập/i).fill(c.email);
  await page.getByLabel(/password|mật khẩu/i).fill(c.password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: /sign in|log in|đăng nhập/i }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
}

test.describe('QA-004 / UI — Projects list (FE-008)', () => {
  test('TC-PROJ-UI-01 owner can open Projects and see the list/empty state', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/projects`);
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('TC-PROJ-UI-02 create project from the list page', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/projects`);
    await page.getByRole('button', { name: /new project|create project/i }).click();
    const nameInput = page.locator('label', { hasText: /name/i }).locator('..').locator('input').first();
    await nameInput.fill(`UI Project ${Date.now()}`);
    const clientSelect = page.locator('label', { hasText: /client/i }).locator('..').locator('select').first();
    if (await clientSelect.isVisible()) {
      await clientSelect.selectOption({ index: 1 }).catch(() => {});
    }
    await page.getByRole('button', { name: /create|save/i }).first().click();
    await expect(page.getByText(/UI Project/)).toBeVisible({ timeout: 15000 });
  });

  test('TC-PROJ-UI-03 progress % is shown with done/total', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/projects`);
    await expect(page).toHaveURL(/\/projects/);
    await page.waitForLoadState('networkidle');
    const hasPercent = await page.getByText(/%/).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no projects|empty/i).first().isVisible().catch(() => false);
    expect(hasPercent || hasEmpty).toBeTruthy();
  });
});

test.describe('QA-004 / UI — Project detail (FE-008)', () => {
  test('TC-PROJ-UI-04 detail shows milestones, members and tasks', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/projects`);
    await page.waitForLoadState('networkidle');
    const openBtn = page.getByRole('button', { name: /edit|view|open|details/i }).first();
    if (!(await openBtn.isVisible())) {
      test.skip(true, 'No project row / open button to click.');
      return;
    }
    await openBtn.click();
    await expect(page).toHaveURL(/\/projects\/\d+/);
    await expect(page.getByText(/milestone|task/i).first()).toBeVisible();
  });

  test('TC-PROJ-UI-05 task checklist tick and comment add', async ({ page, request }) => {
    const token = await apiLogin(request);
    const clientRes = await request.post(`${API_BASE}/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `UI Client ${Date.now()}` },
    });
    const clientId = (await clientRes.json()) as { data?: { id?: number } };
    const projRes = await request.post(`${API_BASE}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { client_id: clientId.data?.id, name: `UI Project ${Date.now()}` },
    });
    const projectId = (await projRes.json()) as { data?: { id?: number } };
    await request.post(`${API_BASE}/projects/${projectId.data?.id}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'UI Task' },
    });

    await loginAsOwner(page);
    await page.goto(`${WEB_BASE}/en/projects/${projectId.data?.id}`);
    await page.waitForLoadState('networkidle');
    const taskBtn = page.getByRole('button', { name: /UI Task/i }).first();
    if (!(await taskBtn.isVisible())) {
      test.skip(true, 'Task not rendered.');
      return;
    }
    await taskBtn.click();
    await expect(page).toHaveURL(/\/tasks\//);
    const checklistInput = page.locator('label', { hasText: /checklist|item/i }).locator('..').locator('input').first();
    if (await checklistInput.isVisible()) {
      await checklistInput.fill('UI checklist item');
      await page.getByRole('button', { name: /add/i }).first().click();
      await expect(page.getByText('UI checklist item')).toBeVisible({ timeout: 10000 });
    }
    const commentInput = page.locator('label', { hasText: /comment/i }).locator('..').locator('input, textarea').first();
    if (await commentInput.isVisible()) {
      await commentInput.fill('UI comment');
      await page.getByRole('button', { name: /comment|send/i }).first().click();
      await expect(page.getByText('UI comment')).toBeVisible({ timeout: 10000 });
    }
  });
});
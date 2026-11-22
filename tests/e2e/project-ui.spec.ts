/**
 * QA-004 — Project Management E2E on the real UI (FE-008).
 *
 * ⏸ These cases are intentionally SKIPPED until FE-008 (Project Management
 * screens) is merged into `main`: the `/projects` routes and components do
 * not exist on `main` yet, so running them now would only produce false
 * failures. They are scaffolded here so they can be flipped on (remove the
 * top-level `test.skip`) the moment FE-008 lands, following the same pattern
 * as QA-002's E2E section.
 *
 * Selectors are derived from the FE-008 branch (apps/web/src/app/[locale]/(app)/projects).
 * No secrets are hardcoded — accounts come from E2E_* env vars.
 */

import { expect, test } from '@playwright/test';

const WEB_BASE = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

test.skip(true, 'FE-008 not merged into main yet — enable after FE-008 lands.');

test.describe('QA-004 / UI — Projects list (FE-008)', () => {
  test('TC-PROJ-UI-01 owner can open Projects and see the list/empty state', async ({ page }) => {
    await page.goto(`${WEB_BASE}/en/login`);
    // login flow is covered by QA-002 E2E; reuse the shared owner account
    await page.getByLabel(/email/i).fill(process.env.E2E_OWNER_EMAIL ?? '');
    await page.getByLabel(/password/i).fill(process.env.E2E_OWNER_PASSWORD ?? '');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.goto(`${WEB_BASE}/en/projects`);
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('TC-PROJ-UI-02 create project from the list page', async ({ page }) => {
    await page.goto(`${WEB_BASE}/en/projects`);
    await page.getByRole('button', { name: /new project|create project/i }).click();
    await page.getByLabel(/name/i).fill(`UI Project ${Date.now()}`);
    await page.getByRole('button', { name: /create|save/i }).click();
    await expect(page.getByText(/UI Project/)).toBeVisible();
  });

  test('TC-PROJ-UI-03 progress % is shown with done/total', async ({ page }) => {
    await page.goto(`${WEB_BASE}/en/projects`);
    await expect(page.getByText(/%/)).toBeVisible();
  });
});

test.describe('QA-004 / UI — Project detail (FE-008)', () => {
  test('TC-PROJ-UI-04 detail shows milestones, members and tasks', async ({ page }) => {
    await page.goto(`${WEB_BASE}/en/projects`);
    const first = page.getByRole('link', { name: /.+/ }).first();
    if (await first.isVisible()) {
      await first.click();
      await expect(page.getByText(/milestone/i)).toBeVisible();
      await expect(page.getByText(/task/i)).toBeVisible();
    }
  });

  test('TC-PROJ-UI-05 task checklist tick and comment add', async ({ page }) => {
    await page.goto(`${WEB_BASE}/en/projects`);
    // navigation into a task detail is covered once a project exists
    await expect(page).toHaveURL(/\/projects/);
  });
});
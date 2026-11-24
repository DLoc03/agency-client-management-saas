# Brewbase — Agency & Client Management

A SaaS system that helps agencies manage their entire business and operational activities — from initial outreach to potential clients, through project completion and product delivery, to ongoing client relationship management.

> **Status:** v0.1.0 — project foundation phase. Conventions, stack, MVP scope, permissions and i18n strategy are finalized (see `docs/` and `DECISIONS.md`). Application code is being initialized.

[🇻🇳 Đọc bản tiếng Việt](README.vi.md)

## What is this?

Agencies typically run their work across chat apps, spreadsheets and email: leads in one place, client information in another, project progress in a third, and invoices somewhere else. This product brings the whole flow into one system with three surfaces:

- **Agency App** — for agency owners and staff to run the business day to day.
- **Client Portal** — a separate, restricted space where each client follows their own projects, receives files, gives feedback and approves deliverables.
- **Platform Admin (minimal)** — for the product owner to create and manage agency workspaces.

Core flow: **Lead → Client → Project → Tasks & Milestones → Client Portal review & approval → Invoice → Payment tracking → Dashboard & Reports.**

## Business domains

1. **CRM** — Lead Management, Contact Management, Sales Pipeline, Follow-up Activities, Customer Interaction History.
2. **Client Management** — Client Profiles, Organizations & Contacts, Client Segmentation, Client Notes, Client History.
3. **Project Management** — Project Overview, Task Management, Milestones, Project Timeline, Team Assignment, Progress Tracking.
4. **Team & Resource Management** — Employee Management, Team Management, Roles & Permissions, Workload Management, Timesheets, Availability.
5. **Finance & Billing** — Quotations, Contracts, Invoices, Payment Tracking, Project Budget, Expenses & Profitability.
6. **Workflow & Automation** — Task Automation, Approval Workflow, Status Notifications, Recurring Tasks, Deadline Reminders.
7. **Client Portal & Collaboration** — Client Dashboard, Project Progress, File Sharing, Feedback & Comments, Approval Requests, Communication History.
8. **Analytics & Reporting** — Revenue Reports, Project Performance, Client Performance, Team Productivity, Profitability Reports.

The MVP implements the core of every domain so the flow above runs end to end; advanced features are scheduled for Phase 2. The detailed, per-feature scope is in [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md).

## Roles & permissions

Seven roles, finalized in [`docs/RBAC_AND_I18N.md`](docs/RBAC_AND_I18N.md): **Agency Owner** (sole owner per workspace), **Admin**, **Sales Manager**, **Project Manager**, **Team Member**, **Accountant**, and **Client** (a separate Portal account type, scoped strictly to its own data). Internal users may hold multiple roles. Permissions are always enforced at the API layer together with a data scope — never by merely hiding UI elements.

## Internationalization

**English is the primary language; Vietnamese is fully supported — both ship in the MVP.** Only system strings are translated (UI, emails, PDF invoices, error messages); user-entered data is never translated. Each user has their own locale, and each workspace has one base currency and timezone.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | PHP 8.3 · Laravel 12 · MySQL 8 · Redis · Laravel Sanctum (Bearer token) |
| API contract | OpenAPI generated with Scramble; TypeScript types generated for the frontend |
| Frontend | Next.js (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui · TanStack Query · React Hook Form + Zod · next-intl |
| Testing | Playwright (E2E) · Pest / PHPUnit (backend) · Vitest (frontend) |
| Local environment | Docker Compose — `api`, `web`, `mysql`, `redis`, `mailpit`, `minio` |
| CI | GitHub Actions — three parallel jobs: backend, frontend, e2e |

Full rationale: [`docs/STACK.md`](docs/STACK.md).

## Repository layout

```
apps/api/            Laravel API — owned by the Backend Developer
apps/web/            Next.js web app — owned by the Frontend Developer
packages/contracts/  Generated OpenAPI & TypeScript types (change only via the contract process)
tests/e2e/           Playwright end-to-end tests — owned by QA
docs/                Conventions, stack, scope, RBAC & i18n documents
```

## How this project is built

This project is developed by a human Product Owner working with three AI coding agents, each with a strictly separated scope — this is documented openly because the workflow itself is part of the project:

- **Nguyen** — Product Owner, final authority on scope and decisions.
- **Muse** — Backend Developer, and co-planner who breaks work down with the Product Owner.
- **Google Antigravity** — Frontend Developer.
- **OpenCode** — QA Review & Tester, and backup Frontend Developer.

All collaboration rules (file ownership, a 5-level decision scale, branch & worktree conventions, pull-request review) are in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).

## Getting started

Local setup instructions will be added here once the monorepo foundation (Docker Compose) lands. The target is a single command:

```bash
docker compose up
```

## Project documents

- [`TASK.md`](TASK.md) — task list by ID and status
- [`CHANGELOG.md`](CHANGELOG.md) — change history by version
- [`VERSION.md`](VERSION.md) — current version (a single line)
- [`DECISIONS.md`](DECISIONS.md) — decision log
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — mandatory collaboration conventions
- [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md) — finalized MVP scope

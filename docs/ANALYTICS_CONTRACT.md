# ANALYTICS CONTRACT — Group 8: Analytics & Reporting (MVP)

Status: APPROVED (DEC-029, 2026-11-28). This document is the official FE–BE contract for
Group 8. Companion documents: `docs/MVP_SCOPE.md` (Group 8 table), `docs/RBAC_AND_I18N.md`
(role matrix row "Analytics & Reports"), `docs/FINANCE_CONTRACT.md` (invoice/payment
definitions reused here), `docs/UI_GUIDELINES.md` (display rules).

## 1. Scope

MVP Group 8 has exactly three deliverables:

1. **Agency overview dashboard** — the internal `/dashboard` page becomes a metrics
   dashboard (stat cards + simple charts): new leads, active clients, projects by
   status, overdue tasks, revenue collected this month.
2. **Revenue report** — invoiced vs collected by month over a selectable date range,
   current outstanding receivables, CSV export.
3. **Project performance report** — one row per project: progress %, on-time/overdue,
   collected vs budget. Plus a simple **per-client revenue list** (invoiced / collected /
   outstanding per client), included because the same aggregates already exist.

Out of scope (Phase 2, do not build): team productivity (needs timesheets), profitability
(needs expenses), custom report builder, PDF report export, scheduled/emailed reports,
client-facing analytics of any kind (Portal unchanged).

## 2. Definitions (single source of truth — reuse, never redefine)

All figures are computed at read time inside the current tenant (agency from the token
only, per DEC-018). No caching and no pre-aggregation tables in MVP.

- **Collected revenue** = sum of `payments.amount` grouped by `payments.paid_on`
  (cash basis). A payment counts in the month it was paid, regardless of the invoice's
  issue date.
- **Invoiced revenue** = sum of `invoices.total` grouped by `invoices.issue_date`,
  EXCLUDING invoices whose stored status is `cancelled`. Draft invoices are included
  (they are issued work in the pipeline sense of this report — see §7 note).
- **Outstanding receivables** = for every invoice with stored status `sent` (which
  includes derived-overdue invoices): `total − sum(payments)`, summed. Draft, paid and
  cancelled invoices contribute 0.
- **Overdue task** = `tasks.status != done` AND `tasks.due_date <` today in the agency
  timezone — the same definition the deadline reminders use (DEC-026).
- **Overdue project** = `projects.due_date <` today in the agency timezone AND status is
  not `completed`/`cancelled` (use the exact project status enum values in code).
- **New leads** = leads with `created_at` inside the period. **Active clients** =
  `clients.status = 'active'`.
- **Project progress %** and per-project **invoiced/collected totals** reuse the exact
  computations already exposed by `ProjectResource` (`progress_percent`,
  `invoiced_total`, `collected_total`, `remaining_budget`) — the reports must not fork
  those formulas.
- **Periods and month boundaries** are evaluated in the agency's timezone
  (`agencies.timezone`). Money is returned as decimal strings in the agency base
  currency, exactly like the Finance resources; the FE formats currency.
- **Month-over-month delta** for a stat card = `(current − previous) / previous × 100`,
  rounded to 1 decimal; when the previous month is 0 the delta is `null` (FE renders no
  delta), never a division by zero or an invented percentage.

## 3. Endpoints

All endpoints are staff-side (`/api/v1`), Bearer token, standard `{ data: ... }`
envelope and standard error shape. No new permission keys are introduced (§4).

### 3.1 `GET /analytics/overview`

One aggregate for the dashboard. The payload is sectioned; **a section the caller may
not see is omitted from the payload entirely** (never zero-filled):

```json
{
  "data": {
    "sales": {
      "new_leads_this_month": 4,
      "new_leads_last_month": 3,
      "new_leads_delta_percent": 33.3,
      "active_clients": 12,
      "leads_by_stage": { "new": 5, "contacted": 3, "qualified": 2, "unqualified": 1 }
    },
    "projects": {
      "projects_by_status": { "draft": 1, "in_progress": 4, "on_hold": 0, "completed": 6, "cancelled": 0 },
      "overdue_tasks": 3,
      "overdue_projects": 1
    },
    "finance": {
      "collected_this_month": "4850.00",
      "collected_last_month": "3200.00",
      "collected_delta_percent": 51.6,
      "invoiced_this_month": "6900.00",
      "outstanding_total": "2750.00",
      "monthly_series": [
        { "month": "2026-06", "invoiced": "4100.00", "collected": "3900.00" }
      ]
    },
    "personal": {
      "my_open_tasks": 5,
      "my_overdue_tasks": 1
    }
  }
}
```

- `monthly_series` = the current month and the 5 preceding months (6 entries, oldest
  first), months labelled `YYYY-MM` in the agency timezone.
- `projects_by_status` keys = the project status enum; every key is present (0 allowed)
  so the FE chart is stable.
- `personal` is returned **only when the caller receives none of** `sales`, `projects`,
  `finance` (the Team Member case in the RBAC matrix): counts of tasks assigned to the
  caller (`my_open_tasks` = status != done; `my_overdue_tasks` per §2). When at least
  one real section is present, `personal` is omitted.
- A caller with no section at all and no assigned tasks still receives
  `{ "personal": { "my_open_tasks": 0, "my_overdue_tasks": 0 } }` — the endpoint never
  403s a signed-in staff member; the dashboard always has something truthful to render.

### 3.2 `GET /reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD`

- Defaults: `from` = first day of the month 5 months ago, `to` = today (agency
  timezone) — i.e. the same 6-month window as the dashboard series.
- `from > to` → 422 `VALIDATION_ERROR` (standard shape). A range longer than 24 months
  → 422 `VALIDATION_ERROR` (guard against unbounded aggregation).
- Response:
  ```json
  {
    "data": {
      "from": "2026-06-01", "to": "2026-11-28",
      "months": [ { "month": "2026-06", "invoiced": "4100.00", "collected": "3900.00" } ],
      "totals": { "invoiced": "…", "collected": "…" },
      "outstanding_total": "2750.00"
    }
  }
  ```
  Every month inside the range appears exactly once (zero-filled), oldest first.
  `outstanding_total` is a current snapshot (it is not historical — see §2) and is
  labelled as such in the FE.

### 3.3 `GET /reports/projects`

- Response: `{ "data": [ { "id", "name", "client": { "id", "name" }, "status",
  "progress_percent", "due_date", "is_overdue", "budget", "invoiced_total",
  "collected_total", "remaining_budget" } ] }` — one row per non-cancelled project,
  ordered by due date ascending (nulls last). Cancelled projects are excluded (they are
  not performance). Supports the shared pagination parameters; the FE loads
  `per_page=100` per the standing sub-list convention.

### 3.4 `GET /reports/clients`

- Response: `{ "data": [ { "id", "name", "status", "projects_count", "invoiced_total",
  "collected_total", "outstanding" } ] }` — one row per client (all statuses),
  ordered by `collected_total` descending. `outstanding` is per-client §2 outstanding.
  Same pagination behaviour as §3.3.

### 3.5 `GET /reports/revenue/export?from&to`

- Same parameters, defaults and validation as §3.2. Returns `text/csv` with
  `Content-Disposition: attachment; filename="revenue-YYYY-MM-DD-to-YYYY-MM-DD.csv"`.
- Columns: `month,invoiced,collected` — one row per month in range, then a final
  `total,<invoiced>,<collected>` row. Amounts are plain decimal numbers (no currency
  symbol, no thousand separators) so spreadsheets parse them.
- The export is generated server-side from the same query code as §3.2 (one code path,
  two renderings).

## 4. Permissions (no new keys)

| Endpoint | Required permission |
|---|---|
| `GET /analytics/overview` | any staff token; sections gated per below |
| overview `sales` section | `leads.view` |
| overview `projects` section | `projects.view` |
| overview `finance` section | `invoices.view` |
| `GET /reports/revenue` + `/export` | `invoices.view` |
| `GET /reports/projects` | `projects.view` |
| `GET /reports/clients` | `clients.view` |

A report endpoint called without its permission → 403 `FORBIDDEN` (standard). This
mapping implements the RBAC matrix row "Analytics & Reports" (Owner/Admin see all
sections; Sales sees the sales part; PM the project part; Accountant the finance part;
Team Member none → `personal`; Client never — these are staff endpoints and Portal
tokens are rejected by the existing ability checks).

## 5. Frontend surface (FE-024, for orientation — UI rules in UI_GUIDELINES)

- `/dashboard`: compact welcome header (existing greeting/agency line, condensed), then
  the permitted sections as stat cards + one hand-rolled CSS bar chart for
  `monthly_series` (no chart library). Delta chips use semantic colours; a `null` delta
  renders nothing. Skeleton = geometric twin of the card grid (§9 rules).
- `/reports`: sidebar entry "Reports"; tabs Revenue / Projects / Clients, each tab
  rendered only when its permission's data loaded (403 → the tab is hidden, not an
  error page, when other tabs are usable; if no tab is usable, the shared `Forbidden`
  state shows). Revenue tab: date-range inputs + Apply, monthly table, totals row,
  outstanding snapshot card, Export CSV button (download icon). Tables follow §3
  (desktop table, mobile cards), money right-aligned, one border level per block.
- Every string via i18n EN + VI (new `Analytics` / `Reports` namespaces); no raw enum on
  screen — project statuses render as the existing localized chips.

## 6. Settled decisions (DEC-029)

1. Dashboard lives on the existing `/dashboard` route; one sectioned overview endpoint;
   sections omitted (not zeroed) when not permitted.
2. Team Member receives the `personal` section only (own task counts) — the RBAC
   matrix's "no access" is honoured for agency figures, while the landing page stays
   useful and truthful.
3. Revenue definitions per §2: collected is cash-basis by `paid_on`; invoiced excludes
   cancelled; outstanding is a current snapshot over sent/overdue invoices.
4. Dashboard series and the revenue report default to a 6-month window; report range
   capped at 24 months.
5. Per-client revenue list is IN MVP as a simple third report (no ranking score — that
   stays Phase 2).
6. CSV export is server-side, invoices permission, same query path as the JSON report.
7. Charts are hand-rolled CSS bars; no chart library is added in MVP.
8. Overdue definitions reuse the reminder definitions (agency timezone).
9. No new permission keys; no caching; everything computed at read.
10. Task split: BE-012 (this contract's API) → QA-009 → FE-024 (dashboard + reports).

## 7. Notes for implementers

- Draft invoices counting toward "invoiced" is deliberate for MVP simplicity and is
  documented here so QA tests the documented behaviour, not an assumption. Changing it
  needs a decision amendment.
- All aggregation queries run under the tenant scope (agency from token). Raw query
  builder usage on business tables needs the AGENTS.md bypass-reason comment if it ever
  bypasses the global scope — prefer Eloquent aggregates on scoped models.
- Tests must cover: section omission per permission set, the `personal`-only case,
  month-boundary behaviour in a non-UTC agency timezone, delta `null` when the previous
  month is 0, CSV content (header, zero-filled months, total row), 403s on the report
  endpoints, and cross-tenant isolation (another agency's figures never leak).

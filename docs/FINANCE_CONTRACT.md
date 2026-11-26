# Finance Contract — BE-008 (Finance & Billing, Group 5)

Approved by the Product Owner as proposed on 2026-11-25 (DEC-019). This contract is the single source of truth for the Finance & Billing module API. It builds on the Auth/Tenancy/RBAC platform (BE-003, reworked by DEC-018), the Client module (BE-004), CRM (BE-005), Projects (BE-006) and Team (BE-007). Group 5 is the "money" group of the core flow Lead → Client → Project → Task → Portal review → **Invoice → Payment**: invoices for clients/projects, manual payment recording, and project budget reconciliation.

## 1. Scope (MVP, per docs/MVP_SCOPE.md Group 5 — all "simple form")

- **Invoices**: create invoices attached to a client and optionally a project; line items (description, quantity, unit price); one simple tax %; totals; statuses Draft/Sent/Paid/Overdue/Cancelled; PDF export.
- **Payment Tracking**: **manual payment recording** (amount, date, method bank transfer/cash, note); multiple partial payments per invoice with the balance computed; the agency's static bank-transfer/VietQR details shown on the invoice.
- **Project Budget**: one budget number on the project plus invoiced/collected totals for reconciliation only — no detailed budget management. The `projects.budget` column already exists (BE-006); BE-008 only adds read-time reconciliation figures, no new budget column.
- **Out of scope (Phase 2)**: Quotations (quote → approve → convert to invoice), Contracts as a module (MVP covers this via file upload in Group 7), Expenses & Profitability (needs full Timesheets + costs), online payment gateways (Stripe/VNPay/MoMo auto-reconciliation — MVP records payments manually).

## 2. Data model

### Table `invoices`
- `id`, `agency_id` (BelongsToAgency like every module), `client_id` (FK clients, required), `project_id` (FK projects, nullable — an invoice may attach to a client only).
- `number` (required, unique per agency — see 4.1), `status` enum `draft/sent/paid/cancelled` (see 4.3 for Overdue), `issue_date` (defaults to creation date), `due_date` (nullable).
- `tax_rate` (decimal 5,2, nullable — the invoice's single tax %, 0–100), `subtotal`, `tax_amount`, `total` (decimal 15,2 — **stored** at create/update time, never recomputed at read, so PDFs and reconciliation figures stay stable; see 4.2).
- `notes` (nullable — shown on the invoice), `sent_at` (nullable), `paid_at` (nullable).
- Timestamps, soft deletes.

### Table `invoice_items`
- `id`, `invoice_id`, `description` (required), `quantity` (decimal 10,2 > 0), `unit_price` (decimal 15,2 ≥ 0), `amount` (decimal 15,2 = quantity × unit_price, stored).
- Display order: `sort_order` (int, defaults to creation order).

### Table `payments`
- `id`, `invoice_id`, `agency_id` (BelongsToAgency — direct filtering without joining through the invoice for tenant checks).
- `amount` (decimal 15,2 > 0), `paid_on` (date, required — the real date the money arrived, defaults to today), `method` enum `bank_transfer/cash` (see 4.4), `note` (nullable), `recorded_by` (FK users — who recorded it).
- Timestamps, soft deletes (deleting a payment is an error correction — see 4.4).

### Additions to `agencies` (static payment details)
- `bank_name`, `bank_account_number`, `bank_account_holder`, `vietqr_payload` (static VietQR string — all four nullable). Shown on InvoiceResource + PDF. Edited through a dedicated endpoint in BE-008 (see section 5) because Group 0 has no workspace-settings screen yet.

### No new Project Budget column
- `projects.budget` already exists (BE-006, decimal 15,2, nullable). BE-008 adds two read-time figures to `ProjectResource`: `invoiced_total` (sum of the project's non-soft-deleted invoices, excluding Cancelled) and `collected_total` (sum of non-soft-deleted payments on those invoices). `remaining_budget = budget - invoiced_total` when budget is set.

## 3. Permissions `invoices.*` / `payments.*`

| Permission | Owner | Admin | Sales Mgr | PM | Accountant | Team Member |
|---|---|---|---|---|---|---|
| invoices.view | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| invoices.create / update | ✓ | ✓ | — | — | ✓ | — |
| invoices.send (Draft → Sent) | ✓ | ✓ | — | — | ✓ | — |
| invoices.cancel | ✓ | ✓ | — | — | ✓ | — |
| invoices.delete | ✓ | — | — | — | — | — |
| invoices.pdf (PDF export) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| payments.manage (record/delete) | ✓ | ✓ | — | — | ✓ | — |
| agencies.payment-details.update | ✓ | ✓ | — | — | — | — |

- Sales Manager is view-only (DEC-005: Sales does not touch invoices — view supports the lead → client → project handover); PM is view-only; Team Member holds no Finance permission.
- `invoices.delete` is Owner-only like `clients.delete` / `projects.delete` (DEC-009.5 / DEC-016): an invoice is a financial document, deleting it is the heaviest operation.
- Data scope: every Finance permission is agency-wide in the MVP (like the Sales scope in DEC-009.2) — not limited by account manager.

## 4. Core business rules

### 4.1 Invoice numbers
- Auto-generated per agency: `INV-{YYYY}-{4-digit sequence}` (e.g. `INV-2026-0001`), the sequence increasing per year, unique within the agency. Assigned **at creation** (even while Draft) so drafts carry a reference; **immutable** afterwards — never renumbered on send/cancel.
- Counter: counted per `(agency_id, year)` over all invoices ever created (including soft-deleted ones — numbers are never reused).

### 4.2 Money and tax
- One tax rate for the whole invoice: `tax_rate` nullable (null = no tax), 0–100. `subtotal` = sum of item `amount`s; `tax_amount` = subtotal × tax_rate%; `total` = subtotal + tax_amount. Rounded to 2 decimals (half-up) at each step.
- All amounts are in the **workspace base currency** — no conversion (Phase 2). No per-line tax, no multiple taxes.
- Line items are editable only while the invoice is Draft; from Sent on they are locked (to change them, cancel the old invoice and create a new one — the document trail is preserved).

### 4.3 Statuses
- **Stored** statuses: `draft/sent/paid/cancelled`.
- **Overdue is derived at read time** (like project progress % in BE-006, no stored column): an invoice that is `sent` + past its `due_date` (in the workspace timezone) + balance due > 0 is returned by the API as `status: "overdue"` (with `stored_status: "sent"` so the FE can distinguish when needed). Filtering `?status=overdue` works on this derived status. Rationale: no background job or manual action is needed to "mark overdue"; the status is always correct for the current date.
- Transitions:
  - Draft → Sent: `POST /invoices/{id}/send` — requires at least 1 line item (otherwise 422 `INVOICE_EMPTY`); sets `sent_at`.
  - Sent → Paid: **automatic** when total payments reach `total` (sets `paid_at`); there is no manual mark-paid endpoint (avoids Paid without a matching payment).
  - Sent → Cancelled: `POST /invoices/{id}/cancel` — only when **no payment exists yet** (with payments → 422 `CANNOT_CANCEL_INVOICE`); Paid can never be cancelled (no refunds in the MVP).
  - Draft → Delete: Owner only, soft delete; Sent/Paid/Cancelled cannot be deleted (422 `CANNOT_DELETE_INVOICE`) — cancel first instead.
  - Any other mutation of a non-Draft invoice (PATCH on Sent/Paid/Cancelled, send on a non-Draft invoice) → 422 `INVOICE_NOT_EDITABLE`. (Code named at implementation time in BE-008; this contract originally specified the Draft-only rule in §4.2 without naming the rejection code.)

### 4.4 Manual payments
- Recordable only on Sent/Overdue invoices (Draft/Cancelled → 422 `PAYMENT_NOT_ALLOWED`).
- `amount` > 0 and ≤ the balance due (`total - paid_total`); exceeding it → 422 `OVERPAYMENT_NOT_ALLOWED` (no overpayment in the MVP — excess money is handled outside the system).
- `method` enum: `bank_transfer` / `cash` (per MVP_SCOPE). `paid_on` defaults to today; past dates are allowed (money arrived yesterday, recorded today).
- Recording a payment that covers the full balance moves the invoice to Paid (`paid_at` = recording time). Deleting a payment (soft delete, `payments.manage` permission) recomputes balance and status — a Paid invoice can return to Sent if a balance reappears (and `paid_at` is cleared). Deleting a payment is an error correction, not a refund.

### 4.5 PDF
- Library `barryvdh/laravel-dompdf` (a new dependency — the Laravel community standard; noted for the PO because it is the first dependency beyond the approved stack). Simple Blade view: agency logo/name, invoice number, client, project, items table, tax, total, balance due, static bank/VietQR details, status.
- Endpoint `GET /invoices/{id}/pdf` → streams the file `INV-2026-0001.pdf`. Watermark by status: DRAFT / CANCELLED (Overdue renders like Sent plus an overdue note). Permission `invoices.pdf`.

### 4.6 Portal
- Read-only Portal: `GET /portal/invoices` (own client's) + `GET /portal/invoices/{id}` — amounts, status (including derived Overdue), balance due, line items, and the bank details so the client can transfer. **No payment creation through the Portal in the MVP** (recording payments is internal work).
- The Portal never sees another client's invoices (scoped by the client membership's `client_id`, per DEC-018 — same pattern as BE-004/BE-006 portal endpoints).

## 5. Endpoints (prefix `/api/v1`, same mold as previous modules)

1. `GET /invoices` (filters `client_id`, `project_id`, `status` — including derived `overdue`, `q` by invoice number/client name; includes read-time `paid_total`, `balance_due`) · 2. `POST /invoices` (with `items[]` in the same request) · 3. `GET /invoices/{id}` (with items + payments + agency payment details) · 4. `PATCH /invoices/{id}` (Draft only: items, tax, dates, notes — sending `items[]` replaces all items) · 5. `DELETE /invoices/{id}` (Draft only, Owner)
6. `POST /invoices/{id}/send` · 7. `POST /invoices/{id}/cancel`
8. `GET /invoices/{id}/pdf`
9. `POST /invoices/{id}/payments` · 10. `GET /invoices/{id}/payments` · 11. `DELETE /payments/{id}` (soft delete, recompute balance/status)
12. `PATCH /agencies/{id}/payment-details` (bank_name, bank_account_number, bank_account_holder, vietqr_payload — Owner/Admin)
13. `GET /portal/invoices` · 14. `GET /portal/invoices/{id}` (read-only, client-scoped)

## 6. Project Budget reconciliation figures (read-time, like BE-006 progress %)

- `ProjectResource` gains `invoiced_total`, `collected_total` (computed at read from non-soft-deleted invoices/payments; Cancelled invoices do not count into `invoiced_total`).
- No dedicated budget endpoint in the MVP — the FE reads these two figures from project detail to show `budget vs invoiced vs collected`.
- The Portal never sees these figures (like the budget itself, hidden since BE-006).

## 7. Acceptance criteria (for the Finance QA task)

1. Invoice + items CRUD follows the section 3 matrix; invoice numbers auto-generate in the right format, unique per agency, immutable; client/project from another agency → 422 `CROSS_TENANT_REFERENCE`; invoice of another agency → 404.
2. Money: subtotal/tax/total computed correctly (including null tax, 0 tax, rounding); editing Draft items recomputes totals; items locked from Sent on.
3. Statuses: Draft with 0 items cannot send (422 `INVOICE_EMPTY`); send sets `sent_at`; Overdue derives correctly when past `due_date` with a balance (and clears when fully paid); cancel with payments → 422; Paid cannot cancel; only Draft can be deleted, Owner-only.
4. Payments: recording on Draft/Cancelled → 422; overpayment → 422 `OVERPAYMENT_NOT_ALLOWED`; multiple partial payments accumulate correctly, full coverage → Paid + `paid_at`; deleting a payment recomputes balance and status (Paid returns to Sent).
5. PDF: exports, file name matches the invoice number, content includes items/tax/total/balance due/payment details; `invoices.pdf` permission follows the matrix.
6. Portal: sees only own client's invoices; cannot create payments via the Portal; cannot see budget/invoiced/collected figures.
7. Agency payment details: only Owner/Admin can edit; shown on the invoice + PDF.
8. Tenant isolation: every other-agency id → 404 (detail) / 422 (body reference), as in previous modules.

## 8. Explicitly out of scope

- Quotations, Contracts, Expenses & Profitability, online payment gateways — Phase 2 per MVP_SCOPE.
- Refunds: none in the MVP — Paid cannot be cancelled; recorded payments are deleted only to correct errors.
- Multi-currency, exchange conversion — Phase 2.
- Automatic invoice email on Send (BE-008 only updates status; overdue reminder emails belong to Group 6).
- Per-line tax, multiple tax rates, deductible VAT — not in the MVP.

# CRM Contract — BE-005 (Lead Management, Group 1)

Approved by the Product Owner on 2026-11-21 (DEC-014). This contract is the single source of truth for the CRM/Lead module API. It builds on the Auth/Tenancy/RBAC platform (BE-003) and the Client module (BE-004): a Lead is the entry point of the core flow Lead → Client → Project → Task → Invoice.

## 1. Scope (MVP, per docs/MVP_SCOPE.md Group 1)

- Lead Management: CRUD for leads (name, company, contact, source, estimated value, owner).
- Sales Pipeline (simple form): lead statuses act as the pipeline; lists filter by status. Drag-and-drop Kanban is Phase 2 — the API only needs stage plus ordering.
- Follow-up Activities (simple form): follow-up activities (call / message / meeting, scheduled time, note) with a due list. Push notifications belong to Group 0 and come later.
- Customer Interaction History: the timeline is manual notes plus follow-up activities in the MVP. The Group 0 Activity Log does not exist yet and is integrated later; no separate module is built.
- Lead → Client conversion: one action creates Client + Organization + Contact from the lead and keeps the history link.
- Out of scope: bulk import, website/Facebook form integrations (Phase 2), custom pipeline stages, drag-and-drop Kanban.

## 2. Data model

### Table `leads`
- `id`, `agency_id` (BelongsToAgency, like every module).
- `name` (lead/opportunity name), `company_name` (nullable — empty for individual leads).
- `contact_name`, `email`, `phone` (primary contact details on the lead itself).
- `source` (enum key): `website` / `referral` / `social` / `cold_outreach` / `other`. The DB stores keys; the FE renders labels via i18n.
- `status` (enum key): `new` / `contacted` / `qualified` / `unqualified`, plus the conversion fields below.
- `estimated_value` (decimal, nullable) — implicitly in the workspace base currency; no per-lead currency in the MVP.
- `owner_id` (FK users, nullable).
- `unqualified_reason` (text, nullable).
- `converted_client_id` (FK clients, nullable), `converted_at` (nullable).
- `last_contacted_at` (nullable), timestamps, soft deletes.

### Table `lead_notes`
Same shape as `client_notes` (body, author_id, timestamps, soft deletes).

### Table `lead_activities` (follow-ups)
- `type` (enum key): `call` / `message` / `meeting` / `other`.
- `scheduled_at` (datetime), `note` (nullable), `is_done` (bool), `completed_at` (nullable), `created_by` (FK users).

### Change to the existing `contacts` table (approved as part of DEC-014)
- Add `lead_id` (FK leads, nullable); `client_id` becomes nullable; each contact belongs to exactly one owner (lead XOR client).
- On conversion, the lead's contacts are re-linked to the new client.
- Add `source_lead_id` (FK leads, nullable) to `clients` for conversion traceability.

## 3. Permissions `leads.*`

| Permission | Owner | Admin | Sales Mgr | Project Mgr | Accountant | Team Member |
|---|---|---|---|---|---|---|
| leads.view | yes | yes | yes | yes | yes | no |
| leads.create | yes | yes | yes | no | no | no |
| leads.update | yes | yes | yes | no | no | no |
| leads.delete | yes | yes | no | no | no | no |
| leads.convert | yes | yes | yes | no | no | no |
| leads.notes.manage | yes | yes | yes | no | no | no |
| leads.activities.manage | yes | yes | yes | no | no | no |

- Sales Manager data scope is the whole agency in the MVP (consistent with DEC-009.2).
- Lead deletion is Owner + Admin (looser than clients.delete, which is Owner-only, because leads are lower-value sales data).

## 4. Lead → Client conversion rules

- A lead that was already converted returns 409 `LEAD_ALREADY_CONVERTED`.
- Conversion creates:
  - A Client with `status = active`, `type` = company when company_name is present, otherwise individual, `account_manager_id` = the lead's owner unless the request body overrides it, email/phone copied from the lead, and `source_lead_id` set.
  - An Organization (for company leads) with legal_name = company_name.
  - A primary Contact from the lead's contact fields; every contact attached to the lead is re-linked to the client.
- After conversion the lead's main fields are locked (notes and activities may still be added to preserve history) and the lead stays readable for traceability.
- Duplicate guard: if the agency already has a client with the same email or tax_code, conversion returns 422 `DUPLICATE_CLIENT_CANDIDATE` unless the body sends `force: true`.

## 5. Endpoints (prefix /api/v1, auth:sanctum + ability:app + per-route permission)

1. `GET /leads` — filters: status, owner_id, source, q (name/company/email).
2. `POST /leads`
3. `GET /leads/{id}`
4. `PATCH /leads/{id}`
5. `DELETE /leads/{id}` — soft delete.
6. `POST /leads/{id}/convert` — optional body: account_manager_id, force.
7. `GET /leads/pipeline-summary` — lead count and total estimated_value per status.
8. `GET /leads/{id}/notes`, `POST /leads/{id}/notes`, `DELETE /leads/{id}/notes/{noteId}` — same author rules as client notes.
9. `GET /leads/{id}/activities`, `POST /leads/{id}/activities`, `PATCH /leads/{id}/activities/{activityId}`, `DELETE /leads/{id}/activities/{activityId}`.
10. `GET /lead-activities/due` — unfinished activities with scheduled_at <= now, agency-wide.
11. `GET /leads/{id}/contacts`, `POST /leads/{id}/contacts`, `PATCH /leads/{id}/contacts/{contactId}`, `DELETE /leads/{id}/contacts/{contactId}` — shared contacts table (section 2).

## 6. Errors and i18n

- New error codes: `LEAD_ALREADY_CONVERTED` (409), `DUPLICATE_CLIENT_CANDIDATE` (422). `CROSS_TENANT_REFERENCE` (422) is reused for cross-tenant owner references.
- Enums are stored as keys; error messages are bilingual EN/VI via lang files, as in BE-003 and BE-004.

## 7. Expected test coverage (QA derives cases from these Acceptance Criteria)

- CRUD plus filters; the six-role permission matrix; tenant isolation (404 and 422).
- Conversion: creates Client + Organization + Contact correctly, re-links contacts, locks the lead, second conversion returns 409, duplicate client returns 422 and passes with force.
- Activities: completion flow and the due list.
- Pipeline summary numbers match the underlying data.

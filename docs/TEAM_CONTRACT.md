# TEAM_CONTRACT — Team & Resource Management (Group 4)

Approved by the Product Owner on 2026-11-22 (DEC-017), as proposed by Muse. Scope follows `docs/MVP_SCOPE.md` Group 4 (simple MVP forms) plus the member-invitation capability from Group 0, which Employee Management depends on. Builds on BE-003 (auth/tenancy/RBAC), BE-004, BE-005, BE-006 (shipped in v0.4.0).

## 1. Scope

**In scope (MVP, simple forms):**
- Employee Management: workspace employee directory — basic profiles, invite/activate, deactivate accounts.
- Team Management: create teams and assign members — teams exist **only** to serve project/task assignment by group.
- Roles & Permissions administration: the 7-role model from BE-003 is unchanged; BE-007 adds the management API (assign/change roles).
- Member invitations (from Group 0): invite by email, accept via token, activate the account.
- Team-based project assignment (deferred here from BE-006).
- Workload-lite: per-user open/overdue task counts (the full Workload module is Phase 2 per MVP_SCOPE).

**Out of scope (Phase 2):** Timesheets, Availability, full Workload Management, custom per-permission roles, avatar upload (no file infrastructure yet — decided in Group 7), assigning tasks directly to a whole team, in-app invitation notifications (email only).

## 2. Data model

### `teams`
- `id`, `agency_id` (BelongsToAgency), `name` (required, unique per agency), `description` (nullable).
- `lead_id` (FK users, nullable) — informational only in MVP; grants no extra permissions.
- Timestamps, soft deletes.

### `team_user` (pivot)
- `team_id`, `user_id` — both must belong to the same agency (cross-tenant checks apply). A user may belong to many teams. Timestamps.

### `invitations`
- `id`, `agency_id`, `email` (required), `role_ids` (JSON — roles granted on accept; never contains the Owner role).
- `token_hash` (hash only — the raw token exists solely in the emailed link), `expires_at` (default +7 days), `invited_by` (FK users), `accepted_at` (nullable), `revoked_at` (nullable).
- At most one pending invitation per email per agency. Timestamps.

### `users` additions
- `job_title` (nullable), `phone` (nullable) — basic employee profile fields. No avatar column (see §1).

### `project_members` addition
- `via_team_id` (FK teams, nullable) — records that this membership came from a team assignment (§4). Direct assignments keep `via_team_id = null`.

## 3. Permissions — `teams.*` / `users.*` / `invitations.*`

| Permission | Owner | Admin | Sales Mgr | PM | Accountant | Team Member |
|---|---|---|---|---|---|---|
| teams.view | ✓ | ✓ | ✓ | ✓ | ✓ | own teams only |
| teams.create / teams.update | ✓ | ✓ | — | ✓ | — | — |
| teams.delete | ✓ | ✓ | — | — | — | — |
| teams.members.manage | ✓ | ✓ | — | ✓ | — | — |
| users.view (directory) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| users.update (others' basic profile) | ✓ | ✓ | — | — | — | — |
| users.roles.manage | ✓ | ✓* | — | — | — | — |
| users.activation | ✓ | ✓* | — | — | — | — |
| invitations.manage | ✓ | ✓* | — | — | — | — |
| workload.view | ✓ | ✓ | — | ✓ | — | own row only |

\* **Admin limit (consistent with DEC-005, "the Owner manages Admins"):** an Admin may not invite anyone with the Admin role, may not grant or remove the Admin role, and may not deactivate an Admin account. Any operation touching Admin accounts/roles is Owner-only → violations return 403 `ADMIN_MANAGEMENT_OWNER_ONLY`.

Additional invariants: the Owner's roles are immutable (403 `CANNOT_MODIFY_OWNER`, existing code); nobody changes their own roles (422 `CANNOT_MODIFY_OWN_ROLES`); nobody deactivates themselves (422 `CANNOT_DEACTIVATE_SELF`); the Owner cannot be deactivated.

## 4. Business rules

- **Invite:** Owner/Admin creates an invitation (email + roles) → the system emails a link `{FRONTEND_URL}/accept-invitation?token=...` (Mailpit locally). Email already registered anywhere in the system (globally unique, DEC-008) → 422 `EMAIL_ALREADY_REGISTERED`. Email with a pending invitation in the same agency → 422 `INVITATION_PENDING`. **Resend** issues a new token + expiry and invalidates the old one. **Revoke** sets `revoked_at`; the link dies.
- **Accept (public endpoint):** the invitee submits `name` + `password` → a user is created in the invitation's agency (`locale` default `en`, `is_active = true`), the invited roles are assigned, `accepted_at` is set. Expired token → 422 `INVITATION_EXPIRED`; already accepted → 422 `INVITATION_ALREADY_ACCEPTED`; revoked/unknown token → 404.
- **Team → project assignment (snapshot semantics):** `POST /projects/{id}/teams { team_id }` copies the team's **current** members into `project_members` with `via_team_id` set. Later team membership changes do **not** propagate to the project. `DELETE /projects/{id}/teams/{team_id}` removes only members whose `via_team_id` matches **and** who have no task assigned in the project; members with assigned tasks are kept and converted to direct members (`via_team_id = null`). The response lists both groups (removed / kept). Governed by the existing `projects.update` permission from BE-006.
- **Deactivation:** sets `is_active = false` and **revokes all of the user's tokens** (same pattern as password change in BE-003). Reactivation sets `is_active = true`; the user signs in again. Users are **never hard-deleted** (assignment/authorship history is preserved).
- **Role changes:** `PUT /users/{id}/roles { role_ids }` replaces the user's whole role set (union semantics per DEC-005) and takes effect on the next request.

## 5. Endpoints (prefix `/api/v1`)

1. `GET /teams` (filter `q`; includes member counts) · 2. `POST /teams` · 3. `GET /teams/{id}` (includes members) · 4. `PATCH /teams/{id}` · 5. `DELETE /teams/{id}` (soft)
6. `POST /teams/{id}/members { user_id }` · 7. `DELETE /teams/{id}/members/{userId}`
8. `GET /users` (filters `q`, `role`, `team_id`, `is_active`; includes roles + teams) · 9. `GET /users/{id}` (profile + roles + teams + open task count) · 10. `PATCH /users/{id}` (`name`, `job_title`, `phone`, `locale`)
11. `PUT /users/{id}/roles` · 12. `PATCH /users/{id}/activation { is_active }`
13. `GET /invitations` (pending) · 14. `POST /invitations` · 15. `POST /invitations/{id}/resend` · 16. `DELETE /invitations/{id}` (revoke) · 17. `POST /invitations/accept { token, name, password }` (public)
18. `POST /projects/{id}/teams` · 19. `DELETE /projects/{id}/teams/{teamId}` (extends BE-006)
20. `GET /workload` (fixed path — §6)

Cross-tenant behaviour matches earlier modules: foreign-agency detail ids → 404; foreign-agency references in request bodies → 422 `CROSS_TENANT_REFERENCE`. Create responses reflect database defaults (FIX-005 pattern).

## 6. Workload-lite (`GET /workload`)

Per active user in the agency, computed at read time (no counter columns): `open_tasks` (not done, not soft-deleted), `overdue_tasks` (not done, `due_date` before today in the workspace timezone), `due_next_7_days`, `projects_count` (member of projects not completed/cancelled). Visibility: Owner/Admin/PM see the whole agency; a Team Member receives only their own row; Sales/Accountant have no access in MVP.

## 7. Acceptance criteria

1. Team CRUD + membership follow the §3 matrix; duplicate team name in an agency → 422; foreign-agency user → 422 `CROSS_TENANT_REFERENCE`; foreign-agency team → 404.
2. Invitations: create → email with link exists; accept in time → the user can sign in immediately with the invited roles; second accept → 422; expired token → correct error code; resend kills the old token; revoke kills the link; inviting a registered email → 422.
3. Admin limits: Admin inviting with the Admin role / granting the Admin role / deactivating an Admin → 403 `ADMIN_MANAGEMENT_OWNER_ONLY`; the Owner can do all of these.
4. Deactivation: existing tokens revoked (API call → 401); sign-in while deactivated → `ACCOUNT_DISABLED`; reactivation restores sign-in; self-deactivation → 422; deactivating the Owner → 403.
5. Role changes apply from the next request; changing the Owner's roles → 403; changing one's own roles → 422.
6. Team → project: snapshot copies exactly the members at assignment time; later team additions do NOT appear in the project; team removal drops task-less members and keeps members with tasks (converted to direct), with both groups listed in the response.
7. Workload numbers match real task data (open/overdue/next-7-days); a Team Member sees only their own row.
8. Tenant isolation: foreign-agency ids → 404 (details) / 422 (body references), as in earlier modules.

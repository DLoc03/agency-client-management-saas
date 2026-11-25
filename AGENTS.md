# AGENTS.md — Working rules for AI agents on this repo

Read `docs/CONVENTIONS.md` first (ownership, PR and review rules live
there). This file adds the tenant-safety rules introduced by DEC-018
(one identity, many agencies). They are binding for every agent.

## Tenant rules (DEC-018)

1. **The active agency comes from the token, never from the client.**
   Every Sanctum token is bound to a membership (`agency_id` +
   `membership_id` on the token row). Any `agency_id` sent in a
   request body, query string or header is ignored. `ResolveTenant`
   re-validates the membership on every request.
2. **Tenant context is fail-closed.** Business models use the
   `BelongsToAgency` scope: querying one without a context throws
   `TenantContextMissing`. Set the context with `Tenant::run()` in
   jobs, console commands and seeders; HTTP requests get it from
   `ResolveTenant`.
3. **Every bypass is explicit and explained.** Any
   `withoutGlobalScopes()`, `Tenant::bypass()` or raw `DB::table()`
   query on a business table must carry a short comment stating why
   it is safe (e.g. lookup by an unguessable token, explicit agency
   filter in the query). No silent unscoped queries.
4. **Cache keys must contain `agency_id`.** Any cache entry holding
   tenant data is keyed with the agency id, and tenant data is never
   cached across requests without it.
5. **Job payloads must carry `agency_id`.** A queued job that touches
   tenant data receives the agency id in its payload and runs its
   work inside `Tenant::run($agencyId, ...)`.
6. **Memberships are the only source of roles.** Roles live on the
   membership (`membership_role`), never on the user. Checks go
   through the current membership (`$user->currentMembership()` /
   `$membership->hasPermission(...)`).

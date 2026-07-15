# Salexa SaaS — Architecture (Phase 1, as built)

> Status: LIVE in `backend/` — 2026-07-15. Companion to `SAAS_PACKAGE_BLUEPRINT.md` (what we sell) and `SUPERADMIN_AND_NEW_PAGES_SPEC.md` (every screen).

## 1. Topology

```
main domain (marketing + checkout)          subdomain portal (clients)         mobile app
        │                                          │                              │
        └────────────► Django + DRF API ◄──────────┴──────────────────────────────┘
                             │
              ┌──────────────┴────────────────┐
              │ default DB (control plane)    │   apps/control
              │ tenants·packages·subs·jobs    │
              └──────────────┬────────────────┘
                             │  provisioning / entitlement sync
      ┌──────────────┬───────┴──────┬──────────────┐
      │ salexa_t_a   │ salexa_t_b   │ salexa_t_c…  │   one Postgres DB per tenant
      │ (tenant A)   │ (tenant B)   │              │   apps/foundation + module apps
      └──────────────┴──────────────┴──────────────┘
              all tenant traffic via PgBouncer (transaction pooling)
```

## 2. Tenancy mechanics (apps/tenancy)

- **Context** (`context.py`): a `contextvar` holds the active control-plane `Tenant`. `use_tenant(t)` for code, JWT authentication for requests.
- **Router** (`router.py`): models of tenant apps (`TENANCY.TENANT_APP_LABELS`) route to the active tenant's alias; **no context → `TenantContextError`** — the hard isolation guard. `allow_migrate` keeps each plane's tables out of the other's DBs (verified: control DB contains zero `foundation_*` tables).
- **Dynamic aliases** (`db.py`): tenant DBs are not in `settings.DATABASES`; `ensure_alias()` registers `t_<slug>` lazily (thread-safe). `forget_alias()` also purges the per-thread cached wrapper (stale-wrapper bug found by tests). Dev/test engine = sqlite file per tenant; prod = Postgres.
- **Provisioning** (`provisioning.py`): signup → `CREATE DATABASE` (or sqlite file) → `migrate --database t_<slug>` → industry preset labels → role templates for purchased modules → entitlement snapshot → owner admin user. **Idempotent** (safe retry from the SuperAdmin Provisioning Monitor). This is what replaces seed scripts.

## 3. Connection-exhaustion strategy (the #1 scale requirement)

| Layer | Rule |
|---|---|
| PgBouncer | every tenant alias points at PgBouncer in **transaction pooling** mode → hundreds of tenant DBs share one small server-side pool |
| Django | `CONN_MAX_AGE=0` on tenant aliases → connections released at request end; a worker holds only what it is actively using |
| Django | `DISABLE_SERVER_SIDE_CURSORS=True` (required for transaction pooling) |
| Design | entitlements are snapshotted INTO each tenant DB, so tenant requests never query the control DB on the hot path |
| Ops | pool utilization surfaces on SuperAdmin Platform Health (SA-12) |

## 4. Auth

One JWT format (PyJWT, HS256, access 24h / refresh 30d), two scopes:

- `scope=control` → `control.AdminUser` (Salexa staff, SuperAdmin APIs `/api/sa/*`).
- `scope=tenant` + `tid` → sets tenant context, loads `foundation.TenantUser` **from that tenant's DB**. Login = org code + email + password. A token can never reach another tenant: the `tid` claim IS the tenant selection (verified by test).
- Tenant status is re-checked on every request → suspending a tenant kills live tokens instantly (verified by test + live smoke).
- Throttles: `auth` 30/min, `signup` 20/hour (scoped DRF throttles).

## 5. Entitlements (what the customer bought)

- Source of truth: `control.TenantModule` rows (package purchase / add-on / manual SuperAdmin override).
- Synced into `foundation.EntitlementSnapshot` (pk=1) inside the tenant DB on provision + every change; role templates for newly added modules are created on sync.
- Enforcement: `HasModule("CODE")` DRF permission; each module exposes `/api/t/<module>/ping` as its gate check. Frontend hides menus from `org.modules` in the login/me payload.

## 6. Test + verification status (2026-07-15)

- `pytest`: **27/27 green** — provisioning, isolation (incl. same-email-in-two-tenants, token-cannot-cross-tenants), auth, entitlement gating + live unlock, suspend, superadmin, audit, foundation CRUD, industry presets.
- Live HTTP smoke: **18/18** — full journey: pricing → signup (DB provisioned live) → org-code login → catalog (service kind) → gating 200/403 → invite agent → agent login → superadmin search → set-modules unlock → suspend kills token → reactivate restores.
- Test infra notes: dynamic tenant aliases are allowed via a conftest patch (Django freezes `TestCase.databases` before aliases exist); throttle cache cleared per test.

## 7. What Phase 1 does NOT include yet (next)

Payments/Razorpay + checkout, setup-wizard endpoints, Celery (provisioning currently runs inline in the request — moves to a worker before launch), refresh-token rotation/revocation list, Next.js frontend (SuperAdmin + portal + marketing), module apps beyond Foundation (TRACK first), per-tenant Appearance storage, audit middleware for tenant CRUD, OpenAPI schema.

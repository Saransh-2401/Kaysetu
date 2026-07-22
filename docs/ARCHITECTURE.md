# KaySetu SaaS — Architecture (as built)

> Status: LIVE in `backend/`. All eleven modules plus the reporting and document
> layers are built and wired to the portal. Companion to
> `SAAS_PACKAGE_BLUEPRINT.md` (what we sell) and
> `SUPERADMIN_AND_NEW_PAGES_SPEC.md` (every screen).

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
      │ kaysetu_t_a   │ kaysetu_t_b   │ kaysetu_t_c…  │   one Postgres DB per tenant
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

- `scope=control` → `control.AdminUser` (KaySetu staff, SuperAdmin APIs `/api/sa/*`).
- `scope=tenant` + `tid` → sets tenant context, loads `foundation.TenantUser` **from that tenant's DB**. Login = org code + email + password. A token can never reach another tenant: the `tid` claim IS the tenant selection (verified by test).
- Tenant status is re-checked on every request → suspending a tenant kills live tokens instantly (verified by test + live smoke).
- Throttles: `auth` 30/min, `signup` 20/hour (scoped DRF throttles).

## 5. Entitlements (what the customer bought)

- Source of truth: `control.TenantModule` rows (package purchase / add-on / manual SuperAdmin override).
- Synced into `foundation.EntitlementSnapshot` (pk=1) inside the tenant DB on provision + every change; role templates for newly added modules are created on sync.
- Enforcement: `HasModule("CODE")` DRF permission; each module exposes `/api/t/<module>/ping` as its gate check. Frontend hides menus from `org.modules` in the login/me payload.

## 5b. The two Next.js apps (do not confuse them)

- **`frontend/`** — the operator surface only: `/ops` (the SuperAdmin console)
  plus the `/signup` provisioning wizard. Its root (`/`) redirects to
  `/ops/login`; it has NO tenant-facing screens and no tenant sign-in.
- **`portal/`** — the tenant application: public landing, `/login`, and the
  previous platform's screens imported as-is and repointed at this backend.
  This is what a customer's staff log into — ALL tenant links must point here
  (`NEXT_PUBLIC_PORTAL_URL` / backend `PORTAL_BASE_URL`).

The interim tenant portal that once lived at `frontend/src/app/portal/` was
deleted (2026-07-22) after it superseded nothing and kept catching sign-ins on
the ops domain. If a tenant-looking screen shows up under the ops domain again,
it is a regression.

## 6. Reading across modules (analytics, dashboards, drawers)

A reporting screen needs data from every module at once, which would normally
mean importing all eleven — exactly the coupling the module rule forbids. Two
patterns solve it without an import:

- **`apps/analytics/sources.py`** resolves other apps' models by LABEL at call
  time (`django.apps.get_model`) and gates each on the owning module's
  entitlement. Analytics therefore imports nothing, and a block fed by a module
  the tenant didn't buy reports zero instead of raising. `None` from `sources`
  always means *no data available*, never *zero* — the caller decides which the
  screen should show.
- **The capability registry** for anything that needs logic, not just rows:
  `/t/parties/{id}/detail/` assembles orders, visits and distributor history
  from three modules via `capabilities.call(...)`, and reports
  `ledger_available: false` rather than rendering an empty statement that would
  read as a zero balance.

## 7. The document layer (`apps/sales`)

ORDERS records what was agreed; BOOKS records what it did to the ledger.
Neither is the invoice a customer receives — that needs a per-line GST split, an
HSN code, a due date, a discount and a running balance. `apps/sales` owns that
document plus the two things that move its balance (payments, credit/debit
notes) and the free-text manual invoice, which has no order behind it at all.

It imports no module: the link back to a sales order is a loose integer with a
unique constraint, the same convention PURCH uses for warehouses. It emits
`sales.invoice_issued` / `sales.payment_recorded` / `sales.adjustment_created`,
and BOOKS subscribes with its own `source_key` namespace so a sales invoice #5
and an order invoice #5 can never collide on an idempotency key.

**Money is always computed server-side.** The previous platform stored whatever
totals the browser sent, so a buggy or tampered client could book an invoice
whose parts didn't add up — and the ledger inherited it.

## 8. Durability: the event outbox

Every event delivery is written to `foundation.EventDelivery` inside the
emitter's transaction and dispatched on commit, so a rollback emits nothing and
a commit is always replayable. Claim-and-apply is atomic, which makes replay
exactly-once.

Three sweeps keep it honest (see docs/DEPLOYMENT.md):

- `deliver_events` retries what is known to have failed.
- `reconcile_events` requeues rows stuck `pending` — a process that died between
  writing the row and running the handler raises no exception, so nothing else
  can find them — and prunes settled rows. It never prunes failed, abandoned or
  skipped rows: those are the record of what did *not* happen.
- A replay whose module is no longer entitled becomes `skipped_unentitled`, NOT
  `delivered`. The work will never be applied, and calling it done would hide a
  real hole in the ledger.

## 9. Verification status

- `pytest`: full suite green across provisioning, isolation, auth, entitlement
  gating, all eleven modules, the outbox, notifications, analytics, sales
  documents, tenant configuration and masters.
- Portal `tsc --noEmit`: clean.
- Live HTTP smoke covers the signup → login → module-gating → upgrade journey.
- Test-infra notes: dynamic tenant aliases are allowed via a conftest patch
  (Django freezes `TestCase.databases` before aliases exist); the throttle cache
  is cleared per test; `conftest`'s `run_on_commit_hooks` autouse fixture is
  load-bearing — without it every integration test silently no-ops, because
  handlers are deferred to `transaction.on_commit`.
- `conftest.auth()` rebinds credentials on the SHARED client. Re-authenticate
  immediately before each request when a test interleaves two identities.

## 10. Known limits

- **Notification delivery**: only `in_app` is really sent. push/email/sms are
  resolved and reported in `not_dispatched` but no provider is wired; Indian SMS
  additionally needs a DLT-registered template per event key.
- **Stock accuracy** (`analytics/warehouse`) is reported as `"—"` /
  `no_audit`: the ledger records an adjustment but not the counted-vs-system
  pair, so a match rate would be invented.
- **Distributor sell-out** (`secondary_sales`, `total_clients` per distributor)
  returns `null`, not `0` — ORDERS has no distributor link, so the figure has no
  source.
- **Territory** is a single `TenantUser.city`. The previous platform kept a JSON
  list and apportioned revenue across cities; that model was not carried over.
- **Background provisioning is Postgres-only.** SQLite allows one writer, so the
  dev backend stays synchronous.

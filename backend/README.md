# KaySetu SaaS — Backend

Django 5.2 + DRF. Two data planes:

- **Control plane** (`apps/control`, `default` DB): tenants, packages, subscriptions, entitlements, provisioning jobs, KaySetu admin users. Powers the marketing site + SuperAdmin dashboard.
- **Tenant plane** (`apps/foundation` + future module apps): **one database per tenant**, created automatically at signup. Powers the client portal + mobile app.

See `../docs/ARCHITECTURE.md` for how tenancy, routing, and provisioning work,
and `../docs/SAAS_PACKAGE_BLUEPRINT.md` for the module/package model.

## Quickstart (dev)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt
.venv\Scripts\python manage.py migrate          # control DB + module/package registry
.venv\Scripts\python manage.py runserver
```

No further seeding: tenant databases are created by the signup API itself.

Create a SuperAdmin (for `/api/auth/admin/login` and `/api/sa/*`):

```powershell
.venv\Scripts\python manage.py createsuperuser  # email + full name + password
```

## Test

```powershell
.venv\Scripts\python -m pytest
```

The suite provisions real (sqlite) tenant databases per test and covers:
provisioning, tenant isolation, org-code auth, entitlement gating, suspend
flow, superadmin APIs, audit logging.

## API map (Phase 1)

| Area | Endpoints |
|---|---|
| Public | `GET /api/public/packages`, `POST /api/public/signup` |
| Auth | `POST /api/auth/tenant/login` (org_code+email+password), `POST /api/auth/admin/login`, `POST /api/auth/refresh`, `GET /api/me` |
| Tenant portal | `/api/t/users/`, `/api/t/roles/`, `/api/t/catalog/`, `/api/t/parties/`, `/api/t/<module>/ping` |
| SuperAdmin | `/api/sa/tenants/` (+ `suspend/`, `activate/`, `set-modules/`, `retry-provisioning/`), `/api/sa/packages/`, `/api/sa/modules/`, `/api/sa/provisioning-jobs/` |

## Production notes (the connection-exhaustion answer)

- Control DB + every tenant DB sit behind **PgBouncer (transaction pooling)** —
  set `TENANT_PG_PORT` to the PgBouncer port.
- Tenant aliases use `CONN_MAX_AGE=0` + `DISABLE_SERVER_SIDE_CURSORS=True`:
  a worker only holds connections it is actively using, no matter how many
  tenant databases exist.
- `TENANT_DB_ENGINE=postgres` switches tenant provisioning to real
  `CREATE DATABASE` (needs `psycopg[binary]` installed).

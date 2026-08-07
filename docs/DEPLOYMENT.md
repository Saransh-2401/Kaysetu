# KaySetu SaaS — Deployment

## Local / single-server (Docker Compose)

```bash
docker compose up --build -d
# frontend  -> http://localhost:3000       (SuperAdmin ops console + /signup)
# portal    -> http://localhost:3001       (tenant application — tenant sign-in lives HERE)
# backend   -> http://localhost:8000/api   (health: /api/health)
```

Services: `postgres` (control DB + all tenant DBs), `pgbouncer` (transaction
pooling — ALL app query traffic), `backend` (Django, stateless), `scheduler`,
`frontend` (ops console), `portal` (tenant app). First superadmin:

```bash
docker compose exec backend python manage.py createsuperuser
```

Production `.env` at repo root (compose reads it): `SECRET_KEY`, `PG_USER`,
`PG_PASSWORD`, `NEXT_PUBLIC_API_BASE` (public API URL — baked into the
frontend at build), plus domain config when the reverse proxy is added.

## Connection topology (the scale answer)

```
backend ──(control + tenant queries)──> pgbouncer:5432 ──> postgres
backend ──(CREATE DATABASE only)──────────────────────────> postgres  (direct)
```

- PgBouncer runs `POOL_MODE=transaction`, `MAX_CLIENT_CONN=2000`,
  `DEFAULT_POOL_SIZE=20` — thousands of client connections funnel into a
  small server-side pool regardless of tenant count.
- Django side: `CONN_MAX_AGE=0`, `DISABLE_SERVER_SIDE_CURSORS`, psycopg
  `prepare_threshold=None` (all three are REQUIRED for transaction pooling).
- Scale API capacity with `docker compose up --scale backend=4` behind a
  reverse proxy; the backend is stateless (JWT auth, no sessions, no local
  files) so replicas need no coordination.

## Periodic jobs (REQUIRED — not optional)

The `scheduler` service runs the platform's recurring work in one supervised
process. **It is not decorative:** the event outbox records a failed auto-post
(an invoice that never reached the ledger, a dispatch that never left stock) but
only ever retries it when `deliver_events` runs. Without the scheduler those
rows sit as `failed` forever.

| Job | Every | What breaks without it |
|---|---|---|
| `deliver_events` | 2 min | Failed ledger/stock posts are never retried — books and stock silently drift |
| `provision_pending` | 5 min | A signup whose provisioning died mid-migrate never finishes; the customer can never log in |
| `reconcile_events` | 1 hour | Deliveries stuck because a worker died stay `pending` forever — no exception was ever raised, so nothing else finds them |
| `resolve_login_locations` | 5 min | The Logs → Login Activity screen shows "Resolving…" in the Location column against every row, forever |
| `track_maintenance` | 15 min | Agents never flagged offline; duty days never auto-close |
| `attendance_maintenance` | daily | Forgotten punch-outs leave open rows, so working hours never compute |
| `billing_maintenance` | daily | Lapsed trials and past-due subscriptions are never suspended |

It comes up automatically with the stack:

```bash
docker compose up -d            # includes `scheduler`
docker compose logs -f scheduler
```

Verify it by hand at any time:

```bash
docker compose exec backend python manage.py run_scheduler --once
docker compose exec backend python manage.py run_scheduler --once --only deliver_events
docker compose exec backend python manage.py deliver_events --org-code KST-ABC123
docker compose exec backend python manage.py reconcile_events --no-prune
docker compose exec backend python manage.py provision_pending
```

### What `reconcile_events` reports

It prints two counts that **do not resolve themselves** and mean a human needs
to look:

* **abandoned** — a delivery that failed past `--max-attempts`. Something is
  genuinely broken in that handler; the business event never took effect.
* **skipped for lost entitlement** — the event fired while the tenant had a
  module, and by the time it was retried they no longer did. The work will
  never be applied. Deliberately NOT counted as delivered: an invoice with no
  ledger entry is a real hole, and calling it "done" would hide it forever.

Pruning only ever deletes `delivered` rows. Failed, abandoned and skipped rows
are the record of what did *not* happen and are kept indefinitely.

### Asynchronous provisioning

Signup hands database creation and migration to a worker thread and returns
immediately with `status: "provisioning"`; the portal polls
`/api/public/signup-status?org_code=…` until `ready` is true. Pass `?wait=1` to
`/api/public/signup` for the old synchronous behaviour (seed scripts, E2E).

This is a thread rather than a task queue on purpose: it is one job per signup
with no fan-out, and a broker would be an entire extra service to run and to
fail. Durability comes from the `ProvisioningJob` row plus `provision_pending`,
not from the thread — if the process dies mid-provision the sweep finishes it.

**It is disabled on SQLite.** SQLite allows one writer, so a provisioning
thread and the request that spawned it deadlock on the same file; the dev
backend stays synchronous. Postgres has no such limit, which is what production
runs.

**Without Docker**, run the same commands from cron — each is independently
runnable and safe to re-run (they iterate tenants and isolate per-tenant
failures):

```cron
*/2  * * * * cd /srv/kaysetu/backend && ./.venv/bin/python manage.py deliver_events
*/5  * * * * cd /srv/kaysetu/backend && ./.venv/bin/python manage.py resolve_login_locations
*/15 * * * * cd /srv/kaysetu/backend && ./.venv/bin/python manage.py track_maintenance
15   0 * * * cd /srv/kaysetu/backend && ./.venv/bin/python manage.py attendance_maintenance
30   0 * * * cd /srv/kaysetu/backend && ./.venv/bin/python manage.py billing_maintenance
```

Deliberately not Celery: these are a handful of periodic commands with no
fan-out, so a single process avoids deploying and operating a broker. When
async task queues do arrive (async provisioning, bulk imports), move these onto
Celery beat — the management commands themselves stay unchanged.

Operational check: `GET /api/t/event-deliveries` (tenant admin) shows anything
undelivered; `POST /api/t/event-deliveries/retry` forces a sweep now.

## Kubernetes migration path (when needed)

Everything is 12-factor already, so the move is mechanical:

| Compose service | K8s shape |
|---|---|
| backend | Deployment + HPA; `migrate` moves from entrypoint to an initContainer/Job; probes = `/api/health` |
| scheduler | Deployment with **replicas: 1** (a second replica would duplicate sweeps), or split the jobs into CronJobs |
| frontend | Deployment (standalone Next server) |
| pgbouncer | Deployment/sidecar (or the cloud DB's built-in pooler) |
| postgres | Managed Postgres (RDS/Cloud SQL) or StatefulSet |
| env vars | ConfigMap + Secrets (SECRET_KEY, DB creds, gateway keys) |

Later additions slot in the same way: Celery worker (provisioning + async) as
its own Deployment, Redis as managed cache, media on S3-compatible storage.

## Domain wiring (see `Caddyfile` — it must match `docker-compose.prod.yml` ports)

- `kaysetu.in` (+ `www.` redirect) -> landing, host port **3004** (public marketing site)
- `app.kaysetu.in` -> portal, host port **3003** (tenant `/login` + all module screens)
- `ops.kaysetu.in` -> frontend, host port **3002** (SuperAdmin console; root redirects to `/ops/login`)
- `api.kaysetu.in` -> backend, host port **3001**
- `img.kaysetu.in` -> the separate media service (**not** part of this stack)

Host Caddy terminates TLS and reverse-proxies to the 127.0.0.1-bound container
ports above. Tenant sign-in happens ONLY on the `app.` domain; the ops domain
serves no tenant screens.

## Upgrading a running deployment

`./deploy.sh` is safe to re-run — it rebuilds, migrates and restarts in place.
Two things it does that a bare `docker compose up -d` does NOT:

* **`migrate_tenants`** — the entrypoint migrates only the CONTROL database.
  Tenant-plane apps (`foundation`, `field`, `travel`, `books`, …) live in one
  database per tenant, and the provisioner migrates a tenant DB only when it is
  first created. Ship a tenant-app migration without this and every EXISTING
  org keeps the old schema; the screen 500s with "no such column", which looks
  like a code bug and isn't.
* Re-runs `bootstrap` (idempotent — it will not duplicate tenants).

**Rebuild, don't just restart**, whenever any of these change: Python
dependencies, or any `NEXT_PUBLIC_*` value. The frontend/portal/landing bake
their API URLs into the JS bundle at build time, so a restart keeps serving the
old host.

## Marketing lead capture (kaysetu.in -> ops console)

The contact form and footer demo box on the marketing site POST to the API:

```
POST https://api.kaysetu.in/api/public/leads      (unauthenticated)
  name*, email*, phone, company, message, source, attachment (PNG/JPG/PDF <=5MB)
  + utm_source / utm_medium / utm_campaign / page_url / referrer
  + "website"  <- honeypot; if filled the submission is dropped
```

Leads land in the SuperAdmin console under **Leads** (`/ops/leads`), where they
can be assigned, noted, status-tracked and linked to the tenant they became.

Two things that will silently break lead capture if missed:

1. **CORS** — `kaysetu.in` and `www.kaysetu.in` MUST be in
   `CORS_ALLOWED_ORIGINS`. The marketing site is a different origin from the
   API, so without them every submission dies in the preflight.
2. **`NEXT_PUBLIC_API_BASE_URL` is baked in at BUILD time** for the landing
   image (compose passes it as a build arg). Changing it needs a rebuild, not
   just a restart.

Abuse controls: `10/hour` per IP (`leads` throttle scope) plus the honeypot.
Attachments go to the media service; if that upload fails the enquiry is still
saved without the file — losing the whole lead over an attachment is worse.

## Media / image service

Uploads (user photo + KYC scans, TA receipts) are POSTed to the external media
service rather than written to container disk — the API runs as several
stateless replicas, so a locally written file would 404 from the next replica.

```
POST https://img.kaysetu.in/upload/<section>
headers: X-API-Key: $IMAGE_SERVICE_API_KEY
body:    multipart "file"   ->  {"original_url": "...", "processed_url": "..."}
```

Set `IMAGE_SERVICE_URL` and `IMAGE_SERVICE_API_KEY` in `.env.production`.
**Without a key the API refuses uploads with 503** — deliberately loud, because
silently saving a KYC record whose scan vanished is far worse than failing.

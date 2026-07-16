# Salexa SaaS — Deployment

## Local / single-server (Docker Compose)

```bash
docker compose up --build -d
# frontend  -> http://localhost:3000
# backend   -> http://localhost:8000/api  (health: /api/health)
```

Services: `postgres` (control DB + all tenant DBs), `pgbouncer` (transaction
pooling — ALL app query traffic), `backend` (Django, stateless), `frontend`
(Next.js standalone). First superadmin:

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

## Kubernetes migration path (when needed)

Everything is 12-factor already, so the move is mechanical:

| Compose service | K8s shape |
|---|---|
| backend | Deployment + HPA; `migrate` moves from entrypoint to an initContainer/Job; probes = `/api/health` |
| frontend | Deployment (standalone Next server) |
| pgbouncer | Deployment/sidecar (or the cloud DB's built-in pooler) |
| postgres | Managed Postgres (RDS/Cloud SQL) or StatefulSet |
| env vars | ConfigMap + Secrets (SECRET_KEY, DB creds, gateway keys) |

Later additions slot in the same way: Celery worker (provisioning + async) as
its own Deployment, Redis as managed cache, media on S3-compatible storage.

## Domain wiring (per the SaaS spec)

- Main domain -> frontend `/` (marketing + signup)
- `admin.` subdomain -> frontend `/ops` (SuperAdmin)
- Portal subdomain -> frontend `/portal` (org-code sign-in)
- `api.` subdomain -> backend

A reverse proxy (Caddy/Traefik/nginx) terminates TLS and routes; add it as a
compose service when the domains are ready.

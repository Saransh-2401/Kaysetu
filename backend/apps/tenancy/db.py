"""
Dynamic per-tenant database registration.

Tenant databases are NOT in settings.DATABASES — they are registered lazily,
once per process, the first time a tenant is touched. Connection-exhaustion
rules (the #1 scale risk of DB-per-tenant on Postgres):

  * CONN_MAX_AGE = 0  -> tenant connections close at request end, so a worker
    never holds more than the handful of connections it is actively using.
  * In production every tenant alias points at PgBouncer (transaction
    pooling), so hundreds of tenant DBs share one small server-side pool.
  * DISABLE_SERVER_SIDE_CURSORS -> required for transaction pooling.
"""
import threading

from django.conf import settings
from django.db import connections

_register_lock = threading.Lock()


def alias_for(tenant) -> str:
    return "t_" + tenant.slug.replace("-", "_")


def _sqlite_path(tenant):
    directory = settings.TENANCY["SQLITE_DIR"]
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{tenant.db_name}.sqlite3"


def build_db_config(tenant) -> dict:
    base = {
        "ATOMIC_REQUESTS": False,
        "AUTOCOMMIT": True,
        "CONN_MAX_AGE": 0,
        "CONN_HEALTH_CHECKS": False,
        "OPTIONS": {},
        "TIME_ZONE": None,
        "TEST": {},
    }
    if settings.TENANCY["DB_ENGINE"] == "postgres":
        pg = settings.TENANCY["PG"]
        return {
            **base,
            "ENGINE": "django.db.backends.postgresql",
            "NAME": tenant.db_name,
            "USER": pg["USER"],
            "PASSWORD": pg["PASSWORD"],
            "HOST": pg["HOST"],
            "PORT": pg["PORT"],
            "DISABLE_SERVER_SIDE_CURSORS": True,
            # psycopg3 auto-prepared statements break behind PgBouncer
            # transaction pooling — disable.
            "OPTIONS": {"prepare_threshold": None},
        }
    return {
        **base,
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": str(_sqlite_path(tenant)),
        "USER": "",
        "PASSWORD": "",
        "HOST": "",
        "PORT": "",
    }


def ensure_alias(tenant) -> str:
    """Register the tenant's DB alias (idempotent, thread-safe)."""
    alias = alias_for(tenant)
    if alias in connections.databases:
        return alias
    with _register_lock:
        if alias not in connections.databases:
            connections.databases[alias] = build_db_config(tenant)
    return alias


def forget_alias(alias: str):
    """Close and drop a dynamic alias (used by tests and tenant deletion).

    Dropping only the config is not enough: the handler caches wrapper objects
    per thread, and a later re-registration of the same alias would resurrect
    a stale wrapper still pointing at the old database. Purge both.
    """
    if alias in connections.databases:
        try:
            connections[alias].close()
        except Exception:
            pass
        try:
            del connections[alias]  # purge this thread's cached wrapper
        except AttributeError:
            pass
        del connections.databases[alias]


def create_database_if_needed(tenant):
    """Physically create the tenant database (CREATE DATABASE / sqlite file)."""
    if settings.TENANCY["DB_ENGINE"] == "postgres":
        import psycopg
        from psycopg import errors, sql

        # CREATE DATABASE goes DIRECT to Postgres — never through the pooler.
        pg = settings.TENANCY["PG"]
        conn = psycopg.connect(
            dbname=pg["MAINTENANCE_DB"],
            user=pg["USER"],
            password=pg["PASSWORD"],
            host=pg["MAINTENANCE_HOST"],
            port=pg["MAINTENANCE_PORT"],
            autocommit=True,
        )
        try:
            conn.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(tenant.db_name))
            )
        except errors.DuplicateDatabase:
            pass
        finally:
            conn.close()
    else:
        # sqlite: the file is created on first connect; just ensure the folder.
        _sqlite_path(tenant)

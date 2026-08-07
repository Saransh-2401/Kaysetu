"""
KaySetu SaaS — Django settings.

Two data planes:
  * default DB  -> control plane (tenants, packages, subscriptions, admin users)
  * t_<slug> DB -> one database per tenant (foundation + module apps), registered
                   lazily at runtime by apps.tenancy — see apps/tenancy/db.py.
"""
from datetime import timedelta
from pathlib import Path
import os

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-insecure-secret-key-do-not-use-in-prod")
DEBUG = os.environ.get("DEBUG", "1") == "1"
ALLOWED_HOSTS = [h for h in os.environ.get("ALLOWED_HOSTS", "*").split(",") if h]

# Tenant selection trusts the JWT `tid` claim, which is only as trustworthy as
# SECRET_KEY. Refuse to boot in production with an unset/known-default secret so
# a forged tenant token can never read another tenant's data.
_INSECURE_SECRETS = {
    "dev-insecure-secret-key-do-not-use-in-prod",
    "compose-dev-secret-change-me",
    "change-me-in-production",
}
if not DEBUG and (not os.environ.get("SECRET_KEY") or SECRET_KEY in _INSECURE_SECRETS):
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured(
        "SECRET_KEY must be set to a strong, unique value when DEBUG is off."
    )

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "rest_framework",
    "corsheaders",
    "apps.control",
    "apps.tenancy",
    "apps.foundation",
    "apps.billing",
    "apps.support",
    "apps.marketing",
    "apps.tracking",
    "apps.field",
    "apps.crm",
    "apps.orders",
    "apps.inventory",
    "apps.books",
    "apps.purchase",
    "apps.distribution",
    "apps.production",
    "apps.attendance",
    "apps.travel",
    "apps.notifications",
    "apps.sales",
    "apps.analytics",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "apps.tenancy.middleware.TenantContextMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
TEMPLATES = []

# ---------------------------------------------------------------- databases
def _control_db():
    if os.environ.get("POSTGRES_DB"):
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["POSTGRES_DB"],
            "USER": os.environ.get("POSTGRES_USER", "kaysetu"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
            "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            # PgBouncer (transaction pooling) compatibility:
            "CONN_MAX_AGE": 0,
            "DISABLE_SERVER_SIDE_CURSORS": True,
            # psycopg3 auto-prepares statements after repeated use, which
            # breaks behind transaction pooling — disable.
            "OPTIONS": {"prepare_threshold": None},
        }
    (BASE_DIR / "var").mkdir(exist_ok=True)
    return {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "var" / "control.sqlite3",
    }


DATABASES = {"default": _control_db()}
DATABASE_ROUTERS = ["apps.tenancy.router.TenantRouter"]

# Tenant-plane configuration. App labels listed here live ONLY in tenant DBs.
TENANCY = {
    "TENANT_APP_LABELS": ["foundation", "tracking", "field", "crm", "orders", "inventory", "books", "purchase", "distribution", "production", "attendance", "travel", "notifications", "sales"],
    "DB_ENGINE": os.environ.get("TENANT_DB_ENGINE", "sqlite"),  # sqlite | postgres
    "SQLITE_DIR": Path(os.environ.get("TENANT_SQLITE_DIR", BASE_DIR / "var" / "tenants")),
    "DB_PREFIX": "kaysetu_t_",
    "PG": {
        # Tenant query traffic — ALWAYS PgBouncer in production.
        "HOST": os.environ.get("TENANT_PG_HOST", "127.0.0.1"),
        "PORT": os.environ.get("TENANT_PG_PORT", "6432"),
        "USER": os.environ.get("TENANT_PG_USER", "kaysetu"),
        "PASSWORD": os.environ.get("TENANT_PG_PASSWORD", ""),
        # CREATE DATABASE must go DIRECT to Postgres (not through the pooler).
        "MAINTENANCE_HOST": os.environ.get(
            "TENANT_PG_MAINTENANCE_HOST", os.environ.get("TENANT_PG_HOST", "127.0.0.1")
        ),
        "MAINTENANCE_PORT": os.environ.get("TENANT_PG_MAINTENANCE_PORT", "5432"),
        "MAINTENANCE_DB": os.environ.get("TENANT_PG_MAINTENANCE_DB", "postgres"),
    },
}

# ---------------------------------------------------------------- auth / api
AUTH_USER_MODEL = "control.AdminUser"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.foundation.auth.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_RATES": {
        "auth": "30/min",
        "signup": "20/hour",
        # Public, unauthenticated lead capture on the marketing site. Low
        # enough to blunt bulk spam, high enough that a genuine visitor
        # correcting a mistake is never blocked.
        "leads": "10/hour",
    },
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

JWT_ALGORITHM = "HS256"
JWT_ACCESS_TTL = timedelta(hours=24)
JWT_REFRESH_TTL = timedelta(days=30)

# Dev portal runs on :3001 (:3000 is the ops console — never send tenants there).
PORTAL_BASE_URL = os.environ.get("PORTAL_BASE_URL", "http://localhost:3001")
TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "14"))

# ---------------------------------------------------------------- billing
BILLING = {
    # "razorpay" activates the live gateway (requires the keys below);
    # anything else (default "mock") auto-approves — dev/test/E2E.
    "GATEWAY": os.environ.get("BILLING_GATEWAY", "mock"),
    "RAZORPAY_KEY_ID": os.environ.get("RAZORPAY_KEY_ID", ""),
    "RAZORPAY_KEY_SECRET": os.environ.get("RAZORPAY_KEY_SECRET", ""),
    "RAZORPAY_WEBHOOK_SECRET": os.environ.get("RAZORPAY_WEBHOOK_SECRET", ""),
    "GST_RATE": int(os.environ.get("BILLING_GST_RATE", "18")),
    "GRACE_DAYS": int(os.environ.get("BILLING_GRACE_DAYS", "3")),
    # Seller identity printed on GST invoices.
    "SELLER_NAME": os.environ.get("BILLING_SELLER_NAME", "KaySetu — Kayease Global Pvt. Ltd."),
    "SELLER_ADDRESS": os.environ.get("BILLING_SELLER_ADDRESS", "Jaipur, Rajasthan, India"),
    "SELLER_GSTIN": os.environ.get("BILLING_SELLER_GSTIN", ""),
}

# ---------------------------------------------------------------- misc
CORS_ALLOW_ALL_ORIGINS = DEBUG
if not DEBUG:
    CORS_ALLOWED_ORIGINS = [o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o]

# Uploaded files (TA claim documents today). Paths are tenant-scoped by the
# model's upload_to, so one tenant's files never land in another's directory.
# In production this is served by the reverse proxy / object storage, not Django.
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "var" / "media"))

# External media service (img.kaysetu.in) — same contract as the previous
# platform: POST <URL>/upload/<section> with an X-API-Key header, response
# carries original_url/processed_url. Uploads go there and we store the URL, so
# the API never hands out a relative path the mobile client cannot resolve and
# the app servers stay stateless (no shared disk between replicas).
IMAGE_SERVICE_URL = os.environ.get("IMAGE_SERVICE_URL", "https://img.kaysetu.in").rstrip("/")
IMAGE_SERVICE_API_KEY = os.environ.get("IMAGE_SERVICE_API_KEY", "")
# Fallback host for any FileField still stored locally (TA documents in dev).
MEDIA_BASE_URL = os.environ.get("MEDIA_BASE_URL", "").rstrip("/")

# Login-audit geolocation. The Login Activity log shows where a sign-in came
# from; turning an IP into a city is a third-party call, so the scheduler does
# it after the fact rather than the login path doing it inline. ip-api.com's
# free tier needs no key but is plaintext HTTP (TLS is a paid feature), so this
# does send end-user IPs to them in the clear — set GEOIP_LOOKUP_ENABLED=0 to
# stop that. Rows are then left unresolved rather than stamped "unknown", so
# turning it back on backfills the history instead of skipping it.
GEOIP_LOOKUP_ENABLED = os.environ.get("GEOIP_LOOKUP_ENABLED", "1").lower() not in ("0", "false", "no")
GEOIP_BATCH_URL = os.environ.get("GEOIP_BATCH_URL", "http://ip-api.com/batch")

LANGUAGE_CODE = "en-us"
# Operational wall-clock timezone (attendance day rollover, auto-punchout time).
# Datetimes are still STORED in UTC (USE_TZ=True); this only sets the default
# zone for localdate()/localtime()/get_current_timezone(). Default = India
# (the target market). Per-tenant timezones would activate() this per request.
TIME_ZONE = os.environ.get("TIME_ZONE", "Asia/Kolkata")
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "kaysetu": {"handlers": ["console"], "level": "INFO"},
    },
}

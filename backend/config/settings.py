"""
Salexa SaaS — Django settings.

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

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "rest_framework",
    "corsheaders",
    "apps.control",
    "apps.tenancy",
    "apps.foundation",
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
            "USER": os.environ.get("POSTGRES_USER", "salexa"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
            "HOST": os.environ.get("POSTGRES_HOST", "127.0.0.1"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            # PgBouncer (transaction pooling) compatibility:
            "CONN_MAX_AGE": 0,
            "DISABLE_SERVER_SIDE_CURSORS": True,
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
    "TENANT_APP_LABELS": ["foundation"],
    "DB_ENGINE": os.environ.get("TENANT_DB_ENGINE", "sqlite"),  # sqlite | postgres
    "SQLITE_DIR": Path(os.environ.get("TENANT_SQLITE_DIR", BASE_DIR / "var" / "tenants")),
    "DB_PREFIX": "salexa_t_",
    "PG": {
        "HOST": os.environ.get("TENANT_PG_HOST", "127.0.0.1"),
        "PORT": os.environ.get("TENANT_PG_PORT", "6432"),
        "USER": os.environ.get("TENANT_PG_USER", "salexa"),
        "PASSWORD": os.environ.get("TENANT_PG_PASSWORD", ""),
        "MAINTENANCE_DB": os.environ.get("TENANT_PG_MAINTENANCE_DB", "postgres"),
    },
}

# ---------------------------------------------------------------- auth / api
AUTH_USER_MODEL = "control.AdminUser"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.foundation.auth.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_RATES": {
        "auth": "30/min",
        "signup": "20/hour",
    },
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

JWT_ALGORITHM = "HS256"
JWT_ACCESS_TTL = timedelta(hours=24)
JWT_REFRESH_TTL = timedelta(days=30)

PORTAL_BASE_URL = os.environ.get("PORTAL_BASE_URL", "http://localhost:3000")
TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "14"))

# ---------------------------------------------------------------- misc
CORS_ALLOW_ALL_ORIGINS = DEBUG
if not DEBUG:
    CORS_ALLOWED_ORIGINS = [o for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "salexa": {"handlers": ["console"], "level": "INFO"},
    },
}

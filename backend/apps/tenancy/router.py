"""
Database router splitting the two planes.

  * control-plane apps (control, auth, contenttypes, ...) -> 'default' only
  * tenant-plane apps (settings.TENANCY.TENANT_APP_LABELS) -> the active
    tenant's alias only; raises TenantContextError when no tenant is set.
"""
from django.conf import settings

from .context import require_tenant
from .db import ensure_alias


class TenantRouter:
    @staticmethod
    def _is_tenant_app(app_label: str) -> bool:
        return app_label in settings.TENANCY["TENANT_APP_LABELS"]

    def _route(self, model):
        if self._is_tenant_app(model._meta.app_label):
            return ensure_alias(require_tenant())
        return "default"

    def db_for_read(self, model, **hints):
        return self._route(model)

    def db_for_write(self, model, **hints):
        return self._route(model)

    def allow_relation(self, obj1, obj2, **hints):
        # Cross-plane relations are impossible (different databases).
        a = self._is_tenant_app(obj1._meta.app_label)
        b = self._is_tenant_app(obj2._meta.app_label)
        if a != b:
            return False
        return None

    def allow_migrate(self, db, app_label, **hints):
        if db == "default":
            return not self._is_tenant_app(app_label)
        if db.startswith("t_"):
            return self._is_tenant_app(app_label)
        return None

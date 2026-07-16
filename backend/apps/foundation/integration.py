"""
Dependency-free integration layer — how modules share data WITHOUT importing
each other, so any module runs standalone and plugs into the others when the
tenant later upgrades.

Two mechanisms:

  CapabilityRegistry — synchronous "ask, don't import". A provider module
    registers a named capability (e.g. "tracking.distance_for") from its
    AppConfig.ready(). A consumer module asks the registry for that name and
    gets the callable back ONLY IF the providing module is entitled for the
    current tenant; otherwise None, and the consumer uses its documented
    degraded behaviour. The consumer never imports the provider.

  EventBus — fire-and-forget. A module emits a domain event
    (e.g. "track.punched_out"); zero or more modules that subscribed in their
    AppConfig.ready() react. No subscriber (module not installed/entitled) ⇒
    the event is a silent no-op. Emitters never know who listens.

Both registries are process-global and populated once at Django startup from
each app's ready(). Entitlement is per-tenant and checked at call time against
the active tenant's EntitlementSnapshot.
"""
import logging
from collections import defaultdict

logger = logging.getLogger("salexa.integration")


class CapabilityRegistry:
    def __init__(self):
        # name -> (module_code | None, callable)
        self._providers: dict[str, tuple[str | None, callable]] = {}

    def provide(self, name: str, module_code: str | None, fn) -> None:
        """Register a capability. `module_code` is the package that must be
        entitled for this capability to be usable (None = always available)."""
        if name in self._providers:
            logger.warning("capability %s re-registered (overwriting)", name)
        self._providers[name] = (module_code, fn)

    def get(self, name: str, entitled_modules=None):
        """Return the provider callable if registered AND its module is
        entitled for the given modules; else None (caller degrades)."""
        entry = self._providers.get(name)
        if entry is None:
            return None
        module_code, fn = entry
        if module_code is not None:
            if entitled_modules is None:
                entitled_modules = _current_entitlements()
            if module_code not in set(entitled_modules or []):
                return None
        return fn

    def call(self, name: str, *args, default=None, entitled_modules=None, **kwargs):
        """Convenience: call the capability if available, else return `default`."""
        fn = self.get(name, entitled_modules)
        if fn is None:
            return default
        try:
            return fn(*args, **kwargs)
        except Exception:
            logger.exception("capability %s raised; returning default", name)
            return default

    def names(self) -> list[str]:
        return sorted(self._providers)


class EventBus:
    def __init__(self):
        self._subs: dict[str, list] = defaultdict(list)

    def subscribe(self, event: str, fn) -> None:
        self._subs[event].append(fn)

    def emit(self, event: str, **payload) -> None:
        """Notify every subscriber. A raising subscriber is logged and skipped —
        one module's listener must never break the emitter."""
        for fn in list(self._subs.get(event, ())):
            try:
                fn(**payload)
            except Exception:
                logger.exception("subscriber for %s failed", event)


def _current_entitlements():
    """Entitled modules for the active tenant (empty when no tenant context)."""
    from apps.tenancy.context import get_tenant

    if get_tenant() is None:
        return []
    from .models import EntitlementSnapshot

    return EntitlementSnapshot.current_modules()


# Process-global singletons.
capabilities = CapabilityRegistry()
events = EventBus()

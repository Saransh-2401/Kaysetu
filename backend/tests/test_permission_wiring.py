"""Structural guard: per-action permissions must actually be enforced.

DRF stores an `@action(permission_classes=[...])` on the instance's
`self.permission_classes`, and `get_permissions()` is the ONLY thing that reads
it. A `get_permissions()` override that builds a fresh list therefore discards
every per-action gate in its class — silently, with no error and no failing
test, leaving privileged actions open to any authenticated user.

That bug has now shipped TWICE (DIST, then PURCH: `override_status`, `receive`
and `bill` were reachable by any tenant user). It is invisible in review because
the declaration looks right. So it is checked mechanically here, for every
viewset in the project, instead of being remembered.
"""
import importlib
import inspect
import pkgutil

import pytest
from rest_framework.viewsets import ViewSetMixin


def _viewset_classes():
    """Every DRF viewset defined under apps/."""
    import apps

    found = []
    for module_info in pkgutil.iter_modules(apps.__path__):
        for suffix in ("views", "config_views", "catalog_compat", "masters_views"):
            name = f"apps.{module_info.name}.{suffix}"
            try:
                module = importlib.import_module(name)
            except ModuleNotFoundError:
                continue
            for _, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, ViewSetMixin) and obj.__module__ == name
                        and not obj.__name__.startswith("_")):
                    found.append(obj)
    return found


def _declared_action_permissions(viewset):
    """[(action_name, [PermissionClass, ...])] for actions that declare their own."""
    rows = []
    for action in viewset.get_extra_actions():
        declared = (action.kwargs or {}).get("permission_classes")
        if declared:
            rows.append((action.__name__, list(declared)))
    return rows


def test_every_per_action_permission_is_actually_enforced():
    """If an action declares permission_classes, get_permissions() must return them.

    A failure here means the action is running with WEAKER permissions than its
    own declaration claims — i.e. an open endpoint that reads as locked.
    """
    violations = []
    checked = 0

    for viewset in _viewset_classes():
        for action_name, declared in _declared_action_permissions(viewset):
            checked += 1
            view = viewset()
            view.action = action_name
            # Exactly what ViewSetMixin.as_view(initkwargs) does for an @action.
            view.permission_classes = declared

            try:
                resolved = view.get_permissions()
            except Exception as exc:                       # noqa: BLE001
                violations.append(
                    f"{viewset.__module__}.{viewset.__name__}.{action_name}: "
                    f"get_permissions() raised {type(exc).__name__}: {exc}")
                continue

            for permission_class in declared:
                if not any(isinstance(p, permission_class) for p in resolved):
                    violations.append(
                        f"{viewset.__module__}.{viewset.__name__}.{action_name} declares "
                        f"{permission_class.__name__} but get_permissions() dropped it — "
                        f"the action runs with {[type(p).__name__ for p in resolved]}")

    assert checked, "no per-action permissions found — the introspection is broken"
    assert not violations, (
        "per-action permissions are declared but NOT enforced:\n  "
        + "\n  ".join(violations))


def test_module_gate_survives_every_action():
    """A module viewset must be entitlement-gated on EVERY action.

    The mirror of the bug above: a `get_permissions()` that rebuilds the list
    keeps the module gate only for the branches it remembers to include, and a
    class with no class-level `permission_classes` falls through to the project
    default (IsAuthenticated) the moment it starts from super(). Either way an
    un-entitled tenant reads data they never bought.
    """
    module_apps = {
        "tracking", "field", "crm", "orders", "inventory", "books", "purchase",
        "distribution", "production", "attendance", "travel", "sales",
    }
    violations = []

    for viewset in _viewset_classes():
        app_label = viewset.__module__.split(".")[1]
        if app_label not in module_apps:
            continue
        # Every action this viewset can be dispatched for.
        actions = {"list", "retrieve", "create", "update", "partial_update", "destroy"}
        actions |= {a.__name__ for a in viewset.get_extra_actions()}

        for action_name in sorted(actions):
            view = viewset()
            view.action = action_name
            declared = next(
                ((a.kwargs or {}).get("permission_classes")
                 for a in viewset.get_extra_actions() if a.__name__ == action_name),
                None)
            if declared:
                view.permission_classes = declared
            try:
                resolved = view.get_permissions()
            except Exception:                              # noqa: BLE001
                continue                                   # covered by the test above
            if not any(type(p).__name__.startswith("HasModule_") for p in resolved):
                violations.append(
                    f"{viewset.__module__}.{viewset.__name__}.{action_name} runs with "
                    f"{[type(p).__name__ for p in resolved]} — no module entitlement gate")

    assert not violations, (
        "module viewsets reachable without an entitlement check:\n  "
        + "\n  ".join(violations))


def test_the_guard_would_catch_a_regression():
    """The check above is only worth having if it actually fails on the bug.

    Rebuilds the exact mistake — a get_permissions() that ignores
    self.permission_classes — and asserts the assertion above would fire.
    """
    from rest_framework import viewsets
    from rest_framework.decorators import action
    from rest_framework.permissions import AllowAny, BasePermission

    class IsSomethingStrict(BasePermission):
        def has_permission(self, request, view):
            return False

    class BrokenViewSet(viewsets.ViewSet):
        permission_classes = [AllowAny]

        def get_permissions(self):
            return [AllowAny()]            # <-- discards the action's own gate

        @action(detail=True, methods=["post"], permission_classes=[IsSomethingStrict])
        def dangerous(self, request, pk=None):
            return None

    rows = _declared_action_permissions(BrokenViewSet)
    assert rows == [("dangerous", [IsSomethingStrict])]

    view = BrokenViewSet()
    view.action = "dangerous"
    view.permission_classes = [IsSomethingStrict]
    resolved = view.get_permissions()
    assert not any(isinstance(p, IsSomethingStrict) for p in resolved), (
        "the broken pattern no longer reproduces — this guard needs rewriting")

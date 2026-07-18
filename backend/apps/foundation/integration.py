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


def subscriber_key(fn) -> str:
    """Stable identity for a subscriber so a stored delivery can be replayed."""
    return f"{fn.__module__}.{fn.__qualname__}"


def _json_safe(payload: dict) -> dict:
    """Payloads must survive a round-trip through the database to be replayable."""
    import json

    try:
        return json.loads(json.dumps(payload, default=str))
    except (TypeError, ValueError):
        return {k: str(v) for k, v in payload.items()}


class EventBus:
    """Fire-and-forget domain events with a durable delivery record.

    A subscriber must never break the emitter, so exceptions are still swallowed
    — but every delivery is now written to foundation.EventDelivery BEFORE it is
    attempted. A failure (or a hard crash mid-handler) therefore leaves a row
    that can be retried and reconciled instead of vanishing into a log line.
    """

    def __init__(self):
        self._subs: dict[str, list] = defaultdict(list)

    def subscribe(self, event: str, fn) -> None:
        self._subs[event].append(fn)

    def subscriber_for(self, event: str, key: str):
        """Look a subscriber back up by its stored key (used when redelivering)."""
        for fn in self._subs.get(event, ()):
            if subscriber_key(fn) == key:
                return fn
        return None

    def emit(self, event: str, **payload) -> None:
        subscribers = list(self._subs.get(event, ()))
        if not subscribers:
            return

        if not _tenant_present():
            # No tenant DB to record into (a background job that forgot
            # use_tenant). Deliver anyway, but say so — the durability
            # guarantee is silently off for these.
            logger.warning("emitting %s with no tenant context — delivery NOT recorded", event)
            for fn in subscribers:
                try:
                    fn(**payload)
                except Exception:
                    logger.exception("subscriber for %s failed", event)
            return

        # Replay feeds handlers the JSON round-tripped payload, so deliver the
        # same shape live — otherwise the replay path is never exercised.
        safe_payload = _json_safe(payload)
        for fn in subscribers:
            delivery = _open_delivery(event, subscriber_key(fn), safe_payload)
            if delivery is None:
                logger.critical(
                    "event %s delivered WITHOUT a durability record — a failure here is unrecoverable",
                    event,
                )
                try:
                    fn(**safe_payload)
                except Exception:
                    logger.exception("subscriber for %s failed", event)
                continue
            _dispatch_after_commit(delivery, fn, safe_payload, event)


def _dispatch_after_commit(delivery, fn, payload, event):
    """Run the handler — but only once the emitter's transaction has COMMITTED.

    Called inside an emitter's transaction, the delivery row above was written in
    that same transaction, which is what makes this a real outbox:

      * the business change rolls back  -> the delivery row rolls back with it,
        so no phantom event survives a failed operation;
      * the business change commits     -> the row is durable BEFORE any handler
        runs, so a crash before/inside dispatch leaves a row the retry sweep
        picks up. There is no window where the change is committed but the
        event is lost.

    Outside a transaction it dispatches immediately (still durably recorded).
    """
    from django.db import connections, transaction

    from apps.tenancy.context import require_tenant
    from apps.tenancy.db import ensure_alias

    def _run():
        try:
            apply_delivery(delivery, fn, payload)
        except Exception as exc:
            logger.exception("subscriber for %s failed", event)
            _record_failure(delivery, exc)

    try:
        alias = ensure_alias(require_tenant())
        in_transaction = connections[alias].in_atomic_block
    except Exception:
        in_transaction = False
        alias = None

    if in_transaction:
        transaction.on_commit(_run, using=alias)
    else:
        _run()


def _tenant_present() -> bool:
    from apps.tenancy.context import get_tenant

    return get_tenant() is not None


def _open_delivery(event: str, key: str, payload):
    """Record the attempt up-front. Never let bookkeeping break the emit."""
    from .models import EventDelivery

    try:
        return EventDelivery.objects.create(
            event=event, subscriber=key, payload=payload or {},
            status=EventDelivery.Status.PENDING, attempts=0,
        )
    except Exception:
        logger.exception("could not record event delivery for %s", event)
        return None


def apply_delivery(delivery, fn, payload) -> str:
    """Claim the delivery and run the handler inside ONE transaction.

    This is what makes replay safe for handlers that are NOT themselves
    idempotent (INV moves stock; it has no source_ref to dedupe on):

      * the claim is a CONDITIONAL update, so a second runner racing the same
        row updates zero rows and skips it — no concurrent double-apply;
      * the claim and the handler's effect commit TOGETHER, so a crash anywhere
        rolls back both (the row stays replayable) and a success marks both done
        (the row is never replayed).

    Without this, a handler that succeeded but whose status write was lost — a
    worker killed mid-deploy — would be replayed and applied twice.
    """
    from django.db import transaction
    from django.db.models import F
    from django.utils import timezone

    from apps.tenancy.context import require_tenant
    from apps.tenancy.db import ensure_alias

    from .models import EventDelivery

    alias = ensure_alias(require_tenant())
    with transaction.atomic(using=alias):
        claimed = (EventDelivery.objects.filter(pk=delivery.pk)
                   .exclude(status=EventDelivery.Status.DELIVERED)
                   .update(status=EventDelivery.Status.DELIVERED,
                           delivered_at=timezone.now(),
                           attempts=F("attempts") + 1,
                           last_error=""))
        if not claimed:
            return "skipped"          # already applied by someone else
        fn(**(payload or {}))
    return "delivered"


def _record_failure(delivery, error, *, max_attempts=None) -> str:
    """Write the failure in its OWN transaction — the attempt itself rolled back."""
    import traceback

    from .models import EventDelivery

    try:
        delivery.refresh_from_db()
        delivery.attempts += 1
        delivery.last_error = "".join(
            traceback.format_exception_only(type(error), error)
        ).strip()[:2000]
        outcome = "failed"
        if max_attempts is not None and delivery.attempts >= max_attempts:
            delivery.status = EventDelivery.Status.ABANDONED
            outcome = "abandoned"
        else:
            delivery.status = EventDelivery.Status.FAILED
        delivery.save(update_fields=["status", "attempts", "last_error", "updated_at"])
        return outcome
    except Exception:
        logger.exception("could not record failure for delivery %s", getattr(delivery, "pk", None))
        return "failed"


def redeliver(*, max_attempts: int = 5, limit: int = 200, delivery_ids=None) -> dict:
    """Retry deliveries that never succeeded, in the CURRENT tenant.

    Safe to run repeatedly and concurrently: each delivery is claimed and applied
    in one transaction (see apply_delivery), so an overlapping cron run and a
    manual retry cannot both apply the same row.

    Rows failing past `max_attempts` become `abandoned` so they stop consuming
    the retry budget — but naming them explicitly (`delivery_ids`) retries them
    anyway, because an operator asking for a specific row has already made that
    judgement call.
    """
    from .models import EventDelivery

    statuses = [EventDelivery.Status.PENDING, EventDelivery.Status.FAILED]
    if delivery_ids:
        statuses.append(EventDelivery.Status.ABANDONED)   # explicit operator override
    qs = EventDelivery.objects.filter(status__in=statuses)
    if delivery_ids:
        qs = qs.filter(pk__in=delivery_ids)
    result = {"attempted": 0, "delivered": 0, "failed": 0, "abandoned": 0,
              "skipped": 0, "unknown_subscriber": 0}

    for delivery in qs.order_by("created_at")[:limit]:
        fn = events.subscriber_for(delivery.event, delivery.subscriber)
        if fn is None:
            # The handler was renamed/removed, so this row can never be matched.
            # Park it — left pending it would sort to the front of every future
            # run and starve real, retryable deliveries behind it.
            result["unknown_subscriber"] += 1
            EventDelivery.objects.filter(pk=delivery.pk).update(
                status=EventDelivery.Status.ABANDONED,
                last_error=f"no registered subscriber named {delivery.subscriber}",
            )
            continue
        result["attempted"] += 1
        try:
            outcome = apply_delivery(delivery, fn, delivery.payload)
        except Exception as exc:
            logger.exception("redelivery of %s failed", delivery.event)
            result[_record_failure(delivery, exc, max_attempts=max_attempts)] += 1
        else:
            result["delivered" if outcome == "delivered" else "skipped"] += 1
    return result


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

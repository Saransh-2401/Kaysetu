"""The dependency-free integration layer: capability registry + event bus.
These are what let a module run standalone yet be consumed by others later."""
import pytest

from apps.foundation.integration import CapabilityRegistry, EventBus

pytestmark = pytest.mark.django_db(databases="__all__")


def test_capability_entitlement_gating():
    reg = CapabilityRegistry()
    reg.provide("tracking.distance_for", "TRACK", lambda agent, date: 12.5)

    # Provider present AND module entitled -> callable returned
    fn = reg.get("tracking.distance_for", entitled_modules=["TRACK", "FIELD"])
    assert fn is not None and fn("a", "d") == 12.5

    # Module NOT entitled -> None (consumer must degrade)
    assert reg.get("tracking.distance_for", entitled_modules=["FIELD"]) is None

    # Unknown capability -> None
    assert reg.get("nonexistent.thing", entitled_modules=["TRACK"]) is None


def test_capability_call_degrades_to_default():
    reg = CapabilityRegistry()
    reg.provide("tracking.distance_for", "TRACK", lambda agent, date: 30.0)

    # Entitled: real value
    assert reg.call("tracking.distance_for", "a", "d", default=0.0, entitled_modules=["TRACK"]) == 30.0
    # Not entitled: default (this is how TA falls back to manual distance)
    assert reg.call("tracking.distance_for", "a", "d", default=0.0, entitled_modules=[]) == 0.0
    # A raising provider must not crash the consumer
    reg.provide("bad.cap", None, lambda: 1 / 0)
    assert reg.call("bad.cap", default="safe") == "safe"


def test_core_capability_always_available():
    reg = CapabilityRegistry()
    reg.provide("foundation.labels", None, lambda: {"catalog_item": "Item"})
    # module_code None -> available regardless of entitlements
    assert reg.get("foundation.labels", entitled_modules=[])() == {"catalog_item": "Item"}


def test_event_bus_fanout_and_absent_subscriber():
    bus = EventBus()
    received = []
    bus.subscribe("track.punched_out", lambda **p: received.append(p))
    bus.subscribe("track.punched_out", lambda **p: received.append({"second": True}))

    bus.emit("track.punched_out", agent_id=7, date="2026-07-16")
    assert received[0] == {"agent_id": 7, "date": "2026-07-16"}
    assert received[1] == {"second": True}

    # No subscriber -> silent no-op (module not installed)
    bus.emit("orders.invoice_issued", invoice_id=1)  # must not raise


def test_event_bus_isolates_failing_subscriber():
    bus = EventBus()
    hits = []
    bus.subscribe("e", lambda **p: (_ for _ in ()).throw(RuntimeError("boom")))
    bus.subscribe("e", lambda **p: hits.append(1))
    bus.emit("e")  # first raises, second must still run
    assert hits == [1]

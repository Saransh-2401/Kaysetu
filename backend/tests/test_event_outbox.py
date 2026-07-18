"""The event outbox: no auto-post is ever silently lost.

The bus stays fire-and-forget (a broken subscriber must not break the emitter),
but every delivery is recorded before it is attempted. A failure therefore leaves
a durable row that can be replayed — and because each handler applies its whole
effect in one transaction, replaying applies it EXACTLY once.
"""
import pytest

from apps.foundation.integration import events, redeliver, subscriber_key
from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _item(api, token, name="Widget", price="100"):
    return auth(api, token).post("/api/t/catalog/", {"name": name, "price": price, "tax_rate": "0"}).data["id"]


def _party(api, token, name="Buyer Co"):
    return auth(api, token).post("/api/t/parties/", {"name": name, "kind": "customer"}).data["id"]


def _deliver_and_invoice(client, order_id):
    client.post(f"/api/t/sales-orders/{order_id}/confirm/")
    client.post(f"/api/t/sales-orders/{order_id}/delivery-note/", {})
    client.post(f"/api/t/sales-orders/{order_id}/mark-delivered/")
    return client.post(f"/api/t/sales-orders/{order_id}/invoice/")


def test_successful_delivery_is_recorded(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)
    order = client.post("/api/t/sales-orders/", {
        "customer": party, "items": [{"item": item, "item_name": "Widget", "quantity": 2, "rate": "100"}]}).data
    assert _deliver_and_invoice(client, order["id"]).status_code == 201

    with use_tenant(tenant):
        from apps.foundation.models import EventDelivery
        posted = EventDelivery.objects.filter(event="orders.invoice_issued")
        assert posted.exists()
        assert all(d.status == EventDelivery.Status.DELIVERED for d in posted)
        assert all(d.delivered_at is not None and d.attempts == 1 for d in posted)


def test_failed_subscriber_is_recorded_then_replayed_exactly_once(api, make_tenant, tenant_token):
    """THE HEADLINE: a ledger post that blows up no longer vanishes. It is
    recorded as failed, the emitter still succeeds, and a retry applies it once."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)

    from apps.books import handlers as books_handlers

    real = books_handlers.on_invoice_issued
    calls = {"n": 0}

    def exploding(**payload):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("ledger unavailable")
        return real(**payload)

    # keep the SAME identity so the stored delivery can be looked back up
    exploding.__module__ = real.__module__
    exploding.__qualname__ = real.__qualname__
    subs = events._subs["orders.invoice_issued"]
    subs[subs.index(real)] = exploding
    try:
        order = client.post("/api/t/sales-orders/", {
            "customer": party,
            "items": [{"item": item, "item_name": "Widget", "quantity": 3, "rate": "100"}]}).data
        # the emitter still succeeds — a broken subscriber must not break ORDERS
        assert _deliver_and_invoice(client, order["id"]).status_code == 201

        with use_tenant(tenant):
            from apps.books.models import JournalEntry
            from apps.foundation.models import EventDelivery
            failed = EventDelivery.objects.get(event="orders.invoice_issued",
                                               subscriber=subscriber_key(real))
            assert failed.status == EventDelivery.Status.FAILED
            assert "ledger unavailable" in failed.last_error
            assert JournalEntry.objects.count() == 0        # nothing posted yet

            # replay -> the invoice reaches the ledger
            result = redeliver()
            assert result["delivered"] == 1 and result["failed"] == 0
            failed.refresh_from_db()
            assert failed.status == EventDelivery.Status.DELIVERED and failed.attempts == 2
            assert JournalEntry.objects.filter(source="sales_invoice").count() == 1

            # replaying again is a no-op: delivered rows are never retouched
            assert redeliver()["attempted"] == 0
            assert JournalEntry.objects.filter(source="sales_invoice").count() == 1
    finally:
        subs[subs.index(exploding)] = real


def test_replay_of_a_stock_handler_does_not_double_apply(api, make_tenant, tenant_token):
    """A half-applied handler would double-count on retry — so handlers are
    atomic: a failed dispatch moved NO stock, and the replay moves it once."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 100, "rate": 40})

    from apps.inventory import handlers as inv_handlers

    real = inv_handlers._on_order_dispatched
    state = {"fail": True}

    def flaky(**payload):
        if state["fail"]:
            state["fail"] = False
            raise RuntimeError("stock service down")
        return real(**payload)

    flaky.__module__, flaky.__qualname__ = real.__module__, real.__qualname__
    subs = events._subs["orders.dispatched"]
    subs[subs.index(real)] = flaky
    try:
        order = client.post("/api/t/sales-orders/", {
            "customer": party,
            "items": [{"item": item, "item_name": "Widget", "quantity": 30, "rate": "100"}]}).data
        client.post(f"/api/t/sales-orders/{order['id']}/confirm/")
        assert client.post(f"/api/t/sales-orders/{order['id']}/delivery-note/", {}).status_code == 201

        levels = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
        assert str(levels[0]["on_hand"]) == "100.000"   # failed handler moved nothing

        with use_tenant(tenant):
            assert redeliver()["delivered"] == 1
        levels = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
        assert str(levels[0]["on_hand"]) == "70.000"    # applied exactly once

        with use_tenant(tenant):
            redeliver()                                  # no-op
        levels = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
        assert str(levels[0]["on_hand"]) == "70.000"
    finally:
        subs[subs.index(flaky)] = real


def test_delivery_is_abandoned_after_max_attempts(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)

    from apps.books import handlers as books_handlers

    real = books_handlers.on_invoice_issued

    def always_fails(**payload):
        raise RuntimeError("permanently broken")

    always_fails.__module__, always_fails.__qualname__ = real.__module__, real.__qualname__
    subs = events._subs["orders.invoice_issued"]
    subs[subs.index(real)] = always_fails
    try:
        order = client.post("/api/t/sales-orders/", {
            "customer": party,
            "items": [{"item": item, "item_name": "Widget", "quantity": 1, "rate": "100"}]}).data
        _deliver_and_invoice(client, order["id"])

        with use_tenant(tenant):
            from apps.foundation.models import EventDelivery
            for _ in range(5):
                redeliver(max_attempts=3)
            row = EventDelivery.objects.get(event="orders.invoice_issued",
                                            subscriber=subscriber_key(real))
            assert row.status == EventDelivery.Status.ABANDONED
            assert row.attempts == 3                     # stopped burning retries
            assert redeliver(max_attempts=3)["attempted"] == 0
    finally:
        subs[subs.index(always_fails)] = real


def test_outbox_api_surfaces_failures_and_retries(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)

    from apps.books import handlers as books_handlers

    real = books_handlers.on_invoice_issued
    state = {"fail": True}

    def flaky(**payload):
        if state["fail"]:
            state["fail"] = False
            raise RuntimeError("ledger unavailable")
        return real(**payload)

    flaky.__module__, flaky.__qualname__ = real.__module__, real.__qualname__
    subs = events._subs["orders.invoice_issued"]
    subs[subs.index(real)] = flaky
    try:
        order = client.post("/api/t/sales-orders/", {
            "customer": party,
            "items": [{"item": item, "item_name": "Widget", "quantity": 1, "rate": "100"}]}).data
        _deliver_and_invoice(client, order["id"])

        listing = client.get("/api/t/event-deliveries").data
        assert listing["counts"].get("failed") == 1
        row = next(r for r in listing["results"] if r["event"] == "orders.invoice_issued")
        assert "ledger unavailable" in row["last_error"]

        retried = client.post("/api/t/event-deliveries/retry", {})
        assert retried.data["delivered"] == 1
        # nothing outstanding afterwards
        assert client.get("/api/t/event-deliveries").data["results"] == []
    finally:
        subs[subs.index(flaky)] = real


def test_partial_work_rolls_back_with_the_claim(api, make_tenant, tenant_token):
    """The claim and the handler's effect commit TOGETHER. A handler that does
    real work and THEN fails must leave neither — otherwise the retry would
    re-apply the part that stuck (INV moves stock and cannot dedupe itself)."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 100, "rate": 40})

    from apps.inventory import handlers as inv_handlers

    real = inv_handlers._on_order_dispatched
    state = {"fail": True}

    def half_then_fail(**payload):
        # do the real deduction, then blow up — as a crash mid-handler would
        real(**payload)
        if state["fail"]:
            state["fail"] = False
            raise RuntimeError("died after moving stock")

    half_then_fail.__module__, half_then_fail.__qualname__ = real.__module__, real.__qualname__
    subs = events._subs["orders.dispatched"]
    subs[subs.index(real)] = half_then_fail
    try:
        order = client.post("/api/t/sales-orders/", {
            "customer": party,
            "items": [{"item": item, "item_name": "Widget", "quantity": 30, "rate": "100"}]}).data
        client.post(f"/api/t/sales-orders/{order['id']}/confirm/")
        client.post(f"/api/t/sales-orders/{order['id']}/delivery-note/", {})

        # the deduction was rolled back along with the claim
        levels = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
        assert str(levels[0]["on_hand"]) == "100.000"
        with use_tenant(tenant):
            from apps.foundation.models import EventDelivery
            row = EventDelivery.objects.get(event="orders.dispatched")
            assert row.status == EventDelivery.Status.FAILED and row.attempts == 1

            assert redeliver()["delivered"] == 1
        levels = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
        assert str(levels[0]["on_hand"]) == "70.000"   # applied exactly once, not twice
    finally:
        subs[subs.index(half_then_fail)] = real


def test_claiming_is_atomic_so_a_second_runner_skips(api, make_tenant, tenant_token):
    """Two runners (cron + a manual retry) must not both apply one delivery."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)
    client.post("/api/t/inv/receive", {"item": item, "quantity": 100, "rate": 40})
    order = client.post("/api/t/sales-orders/", {
        "customer": party,
        "items": [{"item": item, "item_name": "Widget", "quantity": 10, "rate": "100"}]}).data
    client.post(f"/api/t/sales-orders/{order['id']}/confirm/")
    client.post(f"/api/t/sales-orders/{order['id']}/delivery-note/", {})

    with use_tenant(tenant):
        from apps.foundation.integration import apply_delivery
        from apps.foundation.models import EventDelivery
        from apps.inventory import handlers as inv_handlers

        row = EventDelivery.objects.get(event="orders.dispatched")
        assert row.status == EventDelivery.Status.DELIVERED
        # a second runner re-applying the SAME row is refused by the claim
        assert apply_delivery(row, inv_handlers._on_order_dispatched, row.payload) == "skipped"

    levels = client.get(f"/api/t/inv/stock-levels/?item={item}").data["results"]
    assert str(levels[0]["on_hand"]) == "90.000"   # still deducted exactly once


def test_orphaned_subscriber_is_parked_not_left_blocking(api, make_tenant, tenant_token):
    """A renamed/removed handler can never be matched again — park the row so it
    stops sorting to the front of every run and starving live deliveries."""
    tenant, _ = make_tenant(package_code="P8")
    tenant_token(tenant)
    with use_tenant(tenant):
        from apps.foundation.models import EventDelivery

        EventDelivery.objects.create(
            event="orders.invoice_issued", subscriber="apps.gone.handlers.vanished",
            payload={}, status=EventDelivery.Status.FAILED,
        )
        result = redeliver()
        assert result["unknown_subscriber"] == 1 and result["attempted"] == 0
        row = EventDelivery.objects.get(subscriber="apps.gone.handlers.vanished")
        assert row.status == EventDelivery.Status.ABANDONED
        assert "no registered subscriber" in row.last_error
        assert redeliver()["unknown_subscriber"] == 0   # no longer in the working set


def test_abandoned_row_can_be_retried_when_named_explicitly(api, make_tenant, tenant_token):
    """Automatic retries give up, but an operator naming the row still gets a
    lever — otherwise a transient outage permanently destroys a real post."""
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    item, party = _item(api, token), _party(api, token)

    from apps.books import handlers as books_handlers

    real = books_handlers.on_invoice_issued
    state = {"fail": True}

    def flaky(**payload):
        if state["fail"]:
            raise RuntimeError("ledger down")
        return real(**payload)

    flaky.__module__, flaky.__qualname__ = real.__module__, real.__qualname__
    subs = events._subs["orders.invoice_issued"]
    subs[subs.index(real)] = flaky
    try:
        order = client.post("/api/t/sales-orders/", {
            "customer": party,
            "items": [{"item": item, "item_name": "Widget", "quantity": 1, "rate": "100"}]}).data
        _deliver_and_invoice(client, order["id"])
        with use_tenant(tenant):
            from apps.foundation.models import EventDelivery
            for _ in range(4):
                redeliver(max_attempts=2)
            row = EventDelivery.objects.get(event="orders.invoice_issued",
                                            subscriber=subscriber_key(real))
            assert row.status == EventDelivery.Status.ABANDONED
            assert redeliver()["attempted"] == 0        # excluded from automatic runs

        state["fail"] = False                            # the outage is over
        retried = client.post("/api/t/event-deliveries/retry", {"ids": [row.pk]})
        assert retried.data["delivered"] == 1
        with use_tenant(tenant):
            from apps.books.models import JournalEntry
            assert JournalEntry.objects.filter(source="sales_invoice").count() == 1
    finally:
        subs[subs.index(flaky)] = real


def test_outbox_api_is_admin_only(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": "clerk@ob.test", "full_name": "Clerk", "role_slug": "sales_agent",
        "password": "clerk-pass-123", "password_confirm": "clerk-pass-123"})
    staff = api.post("/api/auth/tenant/login", {
        "org_code": tenant.org_code, "email": "clerk@ob.test",
        "password": "clerk-pass-123"}).data["access"]

    assert auth(api, staff).get("/api/t/event-deliveries").status_code == 403
    assert auth(api, staff).post("/api/t/event-deliveries/retry", {}).status_code == 403
    assert auth(api, owner).get("/api/t/event-deliveries").status_code == 200

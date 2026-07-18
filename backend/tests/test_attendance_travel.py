"""MOD-ATT + MOD-TA: the two add-on modules (packages A2 and A1).

ATT — office attendance, leave and the holiday calendar.
TA  — trips rolled into a claim through Manager -> Finance -> Paid. Its headline
      is that trip distance is taken from TRACK's GPS when that module is
      installed (asked via capability, never imported), and paying a claim posts
      the reimbursement into BOOKS.
"""
import pytest

from apps.tenancy.context import use_tenant
from tests.conftest import auth

pytestmark = pytest.mark.django_db(databases="__all__")


def _entitle(tenant, modules):
    with use_tenant(tenant):
        from apps.foundation.models import EntitlementSnapshot
        EntitlementSnapshot.objects.update_or_create(pk=1, defaults={"modules": modules})


def _staff(api, tenant, tenant_token, role_slug, email):
    owner = tenant_token(tenant)["access"]
    auth(api, owner).post("/api/t/users/", {
        "email": email, "full_name": "Staff", "role_slug": role_slug,
        "password": "staff-pass-123", "password_confirm": "staff-pass-123"})
    login = api.post("/api/auth/tenant/login",
                     {"org_code": tenant.org_code, "email": email, "password": "staff-pass-123"})
    return login.data["access"]


# ============================================================== ATT
def test_attendance_check_in_out_cycle(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)

    # the punch endpoints serve the flat status shape the portal widget reads
    assert client.post("/api/t/att/attendance/check-out/").status_code == 400  # not in yet
    first = client.post("/api/t/att/attendance/check-in/", {})
    assert first.status_code == 201 and first.data["success"] is True
    assert first.data["checked_in"] is True and first.data["checked_out"] is False

    # checking in twice the same day is a no-op, not a second row
    again = client.post("/api/t/att/attendance/check-in/", {})
    assert again.data["check_in_time"] == first.data["check_in_time"]
    with use_tenant(tenant):
        from apps.attendance.models import OfficeAttendance
        assert OfficeAttendance.objects.count() == 1

    out = client.post("/api/t/att/attendance/check-out/")
    assert out.status_code == 200 and out.data["success"] is True
    assert out.data["checked_out"] is True and out.data["check_out_type"] == "manual"
    assert "working_hours" in out.data
    assert client.post("/api/t/att/attendance/check-out/").status_code == 400  # already out

    today = client.get("/api/t/att/attendance/today/").data
    assert today["applicable"] and today["checked_in"] and today["checked_out"]


def test_leave_days_exclude_weekends_and_holidays(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    lt = client.post("/api/t/att/leave-types/", {"name": "Casual", "days_per_year": 12}).data["id"]
    # 2026-07-16 is a Thursday; 18-19 is the weekend. Make the 17th a holiday.
    client.post("/api/t/att/holidays/", {"date": "2026-07-17", "name": "Festival"})

    leave = client.post("/api/t/att/leave-requests/", {
        "leave_type": lt, "from_date": "2026-07-16", "to_date": "2026-07-20", "reason": "trip"}).data
    assert str(leave["days"]) == "2.0"     # Thu 16 + Mon 20 (17 holiday, 18-19 weekend)
    assert leave["status"] == "pending"

    # overlapping leave is refused
    assert client.post("/api/t/att/leave-requests/", {
        "leave_type": lt, "from_date": "2026-07-20", "to_date": "2026-07-21"}).status_code == 400

    approved = client.post(f"/api/t/att/leave-requests/{leave['id']}/approve/", {})
    assert approved.status_code == 200 and approved.data["status"] == "approved"
    # a decided request cannot be decided again
    assert client.post(f"/api/t/att/leave-requests/{leave['id']}/reject/",
                       {"note": "changed mind"}).status_code == 400


def test_leave_approval_needs_a_manager_and_staff_see_only_their_own(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant)["access"]
    lt = auth(api, owner).post("/api/t/att/leave-types/", {"name": "Sick"}).data["id"]
    staff = _staff(api, tenant, tenant_token, "sales_agent", "s1@att.test")

    mine = auth(api, staff).post("/api/t/att/leave-requests/", {
        "leave_type": lt, "from_date": "2026-08-03", "to_date": "2026-08-03"}).data
    # a non-manager cannot approve (not even their own)
    assert auth(api, staff).post(f"/api/t/att/leave-requests/{mine['id']}/approve/", {}).status_code == 403
    # ...and only sees their own rows, while the owner sees the team's
    assert auth(api, staff).get("/api/t/att/leave-requests/").data["count"] == 1
    auth(api, owner).post("/api/t/att/leave-requests/", {
        "leave_type": lt, "from_date": "2026-08-05", "to_date": "2026-08-05"})
    assert auth(api, owner).get("/api/t/att/leave-requests/").data["count"] == 2
    assert auth(api, staff).get("/api/t/att/leave-requests/").data["count"] == 1


def test_att_is_package_gated(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")  # FIELD only
    token = tenant_token(tenant)["access"]
    assert auth(api, token).get("/api/t/att/attendance/").status_code == 403
    assert auth(api, token).get("/api/t/att/leave-requests/").status_code == 403


# ============================================================== TA
def test_trip_distance_comes_from_track_gps(api, make_tenant, tenant_token):
    """THE HEADLINE: with TRACK installed, GPS distance is authoritative and a
    client-entered figure is ignored."""
    tenant, _ = make_tenant(package_code="P8")   # TRACK + TA both entitled
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    client.post("/api/t/ta/policies/", {"vehicle_type": "bike", "rate_per_km": "5"})

    with use_tenant(tenant):
        # stand in for TRACK's GPS provider for this test
        from apps.foundation.integration import capabilities
        capabilities.provide("tracking.distance_for", "TRACK", lambda uid, day: 42.5)
    try:
        trip = client.post("/api/t/ta/trips/", {"date": "2026-07-16", "distance_km": "999"}).data
        assert str(trip["distance_km"]) == "42.50"   # GPS wins, client's 999 ignored
        assert trip["source"] == "gps"
    finally:
        with use_tenant(tenant):
            from apps.tracking import capabilities as track_caps
            track_caps.register_all()                # restore the real provider


def test_claim_lifecycle_and_books_posting(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    client.post("/api/t/ta/policies/", {"vehicle_type": "bike", "rate_per_km": "5",
                                        "max_daily_limit": "200"})
    for day, km in (("2026-07-13", 20), ("2026-07-14", 30)):
        client.post("/api/t/ta/trips/", {"date": day, "distance_km": km})

    claim = client.post("/api/t/ta/claims/", {
        "period_start": "2026-07-13", "period_end": "2026-07-14"}).data
    assert str(claim["total_distance_km"]) == "50.00"
    assert str(claim["system_amount"]) == "250.00"      # 50 km x 5
    assert len(claim["trips"]) == 2

    cid = claim["id"]
    # the chain must be walked in order
    assert client.post(f"/api/t/ta/claims/{cid}/mark-paid/", {}).status_code == 400
    client.post(f"/api/t/ta/claims/{cid}/submit/", {})
    client.post(f"/api/t/ta/claims/{cid}/manager-approve/", {})
    # finance may trim the amount, but never above the system figure
    assert client.post(f"/api/t/ta/claims/{cid}/finance-approve/",
                       {"approved_amount": "9999"}).status_code == 400
    fin = client.post(f"/api/t/ta/claims/{cid}/finance-approve/", {"approved_amount": "200"}).data
    assert str(fin["approved_amount"]) == "200.00"
    paid = client.post(f"/api/t/ta/claims/{cid}/mark-paid/", {"payment_reference": "NEFT-1"}).data
    assert paid["status"] == "paid"

    # BOOKS recorded the reimbursement: Dr Operating Expenses / Cr Cash
    with use_tenant(tenant):
        from apps.books import services as books
        assert books.account_ledger(books.account_by_key("OPERATING_EXPENSES"))["closing_balance"] == 200.0
        assert books.account_ledger(books.account_by_key("CASH"))["closing_balance"] == -200.0
    assert client.get("/api/t/books/reports/balance-sheet/").data["balance_check"]["balanced"]


def test_claim_rejection_releases_trips(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    client.post("/api/t/ta/policies/", {"vehicle_type": "bike", "rate_per_km": "5"})
    client.post("/api/t/ta/trips/", {"date": "2026-07-13", "distance_km": 20})
    claim = client.post("/api/t/ta/claims/", {
        "period_start": "2026-07-13", "period_end": "2026-07-13"}).data
    client.post(f"/api/t/ta/claims/{claim['id']}/submit/", {})

    assert client.post(f"/api/t/ta/claims/{claim['id']}/reject/", {}).status_code == 400  # needs note
    rejected = client.post(f"/api/t/ta/claims/{claim['id']}/reject/", {"note": "duplicate"}).data
    assert rejected["status"] == "rejected" and str(rejected["approved_amount"]) == "0.00"
    # the trip is freed so a corrected claim can be raised
    assert client.get("/api/t/ta/trips/").data["results"][0]["is_claimed"] is False
    again = client.post("/api/t/ta/claims/", {
        "period_start": "2026-07-13", "period_end": "2026-07-13"})
    assert again.status_code == 201


def test_ta_amounts_are_server_side_and_capped(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P8")
    token = tenant_token(tenant)["access"]
    client = auth(api, token)
    client.post("/api/t/ta/policies/", {"vehicle_type": "bike", "rate_per_km": "5",
                                        "max_daily_limit": "50"})
    client.post("/api/t/ta/trips/", {"date": "2026-07-13", "distance_km": 100,
                                     "system_amount": "99999"})   # client figures ignored
    claim = client.post("/api/t/ta/claims/", {
        "period_start": "2026-07-13", "period_end": "2026-07-13"}).data
    assert str(claim["system_amount"]) == "50.00"    # 100 km x 5 = 500, capped at the daily 50
    # an absurd distance is rejected outright
    assert client.post("/api/t/ta/trips/", {"date": "2026-07-14",
                                            "distance_km": 99999}).status_code == 400


def test_ta_is_package_gated_and_agents_see_only_their_own(api, make_tenant, tenant_token):
    tenant, _ = make_tenant(package_code="P2")   # no TA
    assert auth(api, tenant_token(tenant)["access"]).get("/api/t/ta/claims/").status_code == 403

    tenant2, _ = make_tenant(package_code="P8")
    owner = tenant_token(tenant2)["access"]
    auth(api, owner).post("/api/t/ta/policies/", {"vehicle_type": "bike", "rate_per_km": "5"})
    agent = _staff(api, tenant2, tenant_token, "sales_agent", "a1@ta.test")
    auth(api, agent).post("/api/t/ta/trips/", {"date": "2026-07-13", "distance_km": 10})
    auth(api, owner).post("/api/t/ta/trips/", {"date": "2026-07-13", "distance_km": 20})

    assert auth(api, agent).get("/api/t/ta/trips/").data["count"] == 1     # only their own
    assert auth(api, owner).get("/api/t/ta/trips/").data["count"] == 2     # manager sees all

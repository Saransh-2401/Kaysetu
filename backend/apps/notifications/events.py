"""
The notification event catalog — the single list of things the platform can tell
someone about, and who hears about them by default.

Ported from the previous platform. This is deliberately DATA, not database rows:
the catalog ships with the code so a new event is a code change reviewed once,
while *who wants it on which channel* is per-tenant configuration layered on top
(role defaults, then per-user overrides).

Resolution order for any (user, event): user override -> role default -> the
catalog default below.
"""

CHANNELS = ["in_app", "push", "email", "sms"]

CHANNEL_LABELS = {
    "in_app": "In-app",
    "push": "Push",
    "email": "Email",
    "sms": "SMS",
}

CATEGORY_ORDER = [
    "Field & Visits",
    "Sales & Orders",
    "Inventory & Requests",
    "Purchase",
    "Finance",
    "Leads & CRM",
    "Travel Allowance",
    "System",
]


def _ch(in_app=False, push=False, email=False, sms=False):
    return {"in_app": in_app, "push": push, "email": email, "sms": sms}


EVENT_CATALOG = [
    # ── Field & Visits ──────────────────────────────────────────────────────
    {
        "key": "visit_scheduled",
        "label": "Visit Scheduled",
        "description": "A sales agent schedules / plans a visit to a client.",
        "category": "Field & Visits",
        "audience": ["sales_manager", "admin"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "visit_assigned",
        "label": "Visit Assigned to Me",
        "description": "A visit is assigned to you by your manager.",
        "category": "Field & Visits",
        "audience": ["sales_agent"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "visit_checkin",
        "label": "Agent Checked In",
        "description": "A sales agent checks in at a client location.",
        "category": "Field & Visits",
        "audience": ["sales_manager", "admin"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "visit_checkout",
        "label": "Agent Checked Out / Visit Completed",
        "description": "A sales agent checks out, completing a visit.",
        "category": "Field & Visits",
        "audience": ["sales_manager", "admin"],
        "defaults": _ch(in_app=True),
    },
    {
        "key": "agent_offline",
        "label": "Agent Went Offline",
        "description": "A punched-in field agent stopped sharing GPS location.",
        "category": "Field & Visits",
        "audience": ["sales_manager", "admin"],
        "defaults": _ch(in_app=True, push=True),
        "critical": True,
    },
    {
        "key": "agent_online",
        "label": "Agent Back Online",
        "description": "A field agent resumed sharing GPS location.",
        "category": "Field & Visits",
        "audience": ["sales_manager", "admin"],
        "defaults": _ch(in_app=True),
    },
    # ── Sales & Orders ──────────────────────────────────────────────────────
    {
        "key": "order_placed",
        "label": "Order Placed",
        "description": "A new sales order is booked.",
        "category": "Sales & Orders",
        "audience": ["sales_manager", "admin"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "order_status",
        "label": "Order Status Changed",
        "description": "An order is confirmed, dispatched, delivered or rejected.",
        "category": "Sales & Orders",
        "audience": ["sales_agent", "distributor", "sales_manager"],
        "defaults": _ch(in_app=True, push=True),
    },
    # ── Inventory & Requests ────────────────────────────────────────────────
    {
        "key": "stock_request_raised",
        "label": "Stock Request Raised",
        "description": "A distributor requests stock.",
        "category": "Inventory & Requests",
        "audience": ["sales_manager", "warehouse_manager", "admin"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "stock_request_status",
        "label": "Stock Request Status Changed",
        "description": "Your stock request is approved, dispatched or delivered.",
        "category": "Inventory & Requests",
        "audience": ["distributor"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "low_stock",
        "label": "Low Stock",
        "description": "An item fell to or below its reorder level.",
        "category": "Inventory & Requests",
        "audience": ["warehouse_manager", "admin", "purchase_manager"],
        "defaults": _ch(in_app=True, push=True),
    },
    # ── Purchase ────────────────────────────────────────────────────────────
    {
        "key": "material_request_raised",
        "label": "Material Request Raised",
        "description": "Someone raises a material request for procurement.",
        "category": "Purchase",
        "audience": ["purchase_manager", "admin"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "material_request_status",
        "label": "Material Request Status Changed",
        "description": "A material request is approved, rejected or ordered.",
        "category": "Purchase",
        "audience": ["purchase_manager", "warehouse_manager", "admin"],
        "defaults": _ch(in_app=True),
    },
    # ── Finance ─────────────────────────────────────────────────────────────
    {
        "key": "payment_received",
        "label": "Payment Received",
        "description": "A customer or distributor payment is recorded.",
        "category": "Finance",
        "audience": ["accounts_officer", "sales_manager", "admin"],
        "defaults": _ch(in_app=True, push=True),
    },
    # ── Leads & CRM ─────────────────────────────────────────────────────────
    {
        "key": "lead_assigned",
        "label": "Lead Assigned to Me",
        "description": "A lead is assigned to you.",
        "category": "Leads & CRM",
        "audience": ["sales_agent", "sales_manager"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "lead_added",
        "label": "Lead Added",
        "description": "A new lead enters the pipeline.",
        "category": "Leads & CRM",
        "audience": ["sales_agent", "sales_manager"],
        "defaults": _ch(in_app=True),
    },
    # ── Travel Allowance ────────────────────────────────────────────────────
    {
        "key": "travel_allowance_submitted",
        "label": "TA Claim Submitted",
        "description": "An agent submits a travel allowance claim for approval.",
        "category": "Travel Allowance",
        "audience": ["sales_manager", "accounts_officer", "admin"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "travel_allowance_status",
        "label": "TA Claim Status Changed",
        "description": "Your travel allowance claim is approved, rejected or paid.",
        "category": "Travel Allowance",
        "audience": ["sales_agent"],
        "defaults": _ch(in_app=True, push=True),
    },
    {
        "key": "travel_allowance_deadline",
        "label": "TA Submission Deadline",
        "description": "A reminder that unclaimed travel is approaching its cut-off.",
        "category": "Travel Allowance",
        "audience": ["sales_agent"],
        "defaults": _ch(in_app=True, push=True),
    },
    # ── System ──────────────────────────────────────────────────────────────
    {
        "key": "announcement",
        "label": "Announcement",
        "description": "A broadcast from your organisation's admin.",
        "category": "System",
        "audience": [
            "admin", "sales_manager", "sales_agent", "distributor", "warehouse_manager",
            "production_manager", "purchase_manager", "accounts_officer", "field_manager",
            "field_agent", "dispatcher",
        ],
        # Mandatory: an org-wide announcement cannot be switched off, only
        # its non-essential channels tuned.
        "defaults": _ch(in_app=True, push=True),
        "mandatory": True,
    },
]


def _normalise(event):
    return {
        "key": event["key"],
        "label": event["label"],
        "description": event.get("description", ""),
        "category": event.get("category", "System"),
        "audience": list(event.get("audience", [])),
        "defaults": {**_ch(), **event.get("defaults", {})},
        "critical": bool(event.get("critical", False)),
        "mandatory": bool(event.get("mandatory", False)),
    }


EVENTS = [_normalise(e) for e in EVENT_CATALOG]
EVENTS_BY_KEY = {e["key"]: e for e in EVENTS}
EVENT_KEYS = set(EVENTS_BY_KEY)


def event(key):
    return EVENTS_BY_KEY.get(key)


def events_for_role(role_slug):
    """The catalog entries a given role is an audience for."""
    return [e for e in EVENTS if not e["audience"] or role_slug in e["audience"]]


def categories():
    """Categories in display order, limited to those actually in use."""
    used = {e["category"] for e in EVENTS}
    ordered = [c for c in CATEGORY_ORDER if c in used]
    return ordered + sorted(used - set(ordered))

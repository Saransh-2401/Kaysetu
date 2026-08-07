"""The hardcoded email / SMS message catalog.

This ships WITH THE CODE, like the notification event catalog it mirrors: a new
message is a reviewed code change, not a row someone types in production. The
seed migration copies it into the control DB once, after which Ops edits the
wording through the SuperAdmin console. Re-seeding never overwrites an edit.

Tenants read these but cannot change them — KaySetu authors and pays for
delivery. What a tenant still controls is routing: role defaults, per-user
preferences and manual broadcasts.

`trigger_key` is the join to the sending code and is never editable; renaming
one would silently stop that message going out.

Variables use {curly} placeholders and are substituted at send time.
"""

# ── Shared email shell ────────────────────────────────────────────────────
# Inlined CSS only: Gmail/Outlook strip <style> blocks and external sheets, so
# every rule has to live on the element. Table-based for the same reason —
# flex/grid are unreliable across mail clients.
BRAND = "#2C3E50"
ACCENT = "#D4AF37"


def _email(title, intro, body_html, cta=None, cta_url=None, footnote=""):
    """Wrap content in the KaySetu shell. Returns a full HTML document."""
    cta_block = ""
    if cta and cta_url:
        cta_block = f"""
          <tr><td style="padding:8px 32px 24px 32px;">
            <a href="{cta_url}" style="display:inline-block;background:{BRAND};color:#ffffff;
               text-decoration:none;font-weight:600;font-size:15px;padding:12px 26px;
               border-radius:8px;font-family:Arial,Helvetica,sans-serif;">{cta}</a>
          </td></tr>"""
    foot = f"""
          <tr><td style="padding:0 32px 24px 32px;color:#6b7280;font-size:13px;
              line-height:20px;font-family:Arial,Helvetica,sans-serif;">{footnote}</td></tr>""" if footnote else ""

    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="width:600px;max-width:94%;background:#ffffff;border-radius:12px;
                    overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:{BRAND};padding:20px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;
                       font-family:Arial,Helvetica,sans-serif;">KaySetu</span>
          <span style="display:inline-block;width:28px;height:3px;background:{ACCENT};
                       vertical-align:middle;margin-left:10px;border-radius:2px;"></span>
        </td></tr>
        <tr><td style="padding:28px 32px 8px 32px;">
          <h1 style="margin:0 0 8px 0;font-size:20px;line-height:28px;color:#111827;
                     font-family:Arial,Helvetica,sans-serif;">{title}</h1>
          <p style="margin:0;color:#4b5563;font-size:15px;line-height:23px;
                    font-family:Arial,Helvetica,sans-serif;">{intro}</p>
        </td></tr>
        <tr><td style="padding:16px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;
                       color:#111827;font-size:15px;line-height:23px;">{body_html}</td></tr>
        {cta_block}
        {foot}
        <tr><td style="background:#f9fafb;padding:16px 32px;color:#9ca3af;font-size:12px;
                       line-height:18px;font-family:Arial,Helvetica,sans-serif;
                       border-top:1px solid #eef0f2;">
          Sent by KaySetu on behalf of {{org_name}}. You are receiving this because of your
          notification settings in the KaySetu portal.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _rows(pairs):
    """A clean label/value table — used for order, payment and stock details."""
    out = ['<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
           'style="border-collapse:collapse;margin:4px 0 8px 0;">']
    for label, value in pairs:
        out.append(
            f'<tr><td style="padding:7px 0;color:#6b7280;font-size:14px;width:42%;'
            f'border-bottom:1px solid #f1f2f4;font-family:Arial,Helvetica,sans-serif;">{label}</td>'
            f'<td style="padding:7px 0;color:#111827;font-size:14px;font-weight:600;'
            f'border-bottom:1px solid #f1f2f4;font-family:Arial,Helvetica,sans-serif;">{value}</td></tr>')
    out.append("</table>")
    return "".join(out)


def _callout(text, color=BRAND):
    return (f'<div style="margin:4px 0 10px 0;padding:14px 16px;background:#f8fafc;'
            f'border-left:4px solid {color};border-radius:6px;color:#111827;font-size:15px;'
            f'line-height:22px;font-family:Arial,Helvetica,sans-serif;">{text}</div>')


PORTAL = "https://app.kaysetu.in"

# ── Core messages (hand-written: these are not notification events) ───────
EMAIL_CORE = [
    {
        "trigger_key": "OTP_LOGIN",
        "name": "Sign-in code (OTP)",
        "description": "One-time code for phone/OTP sign-in.",
        "module_code": "", "category": "System",
        "subject": "Your KaySetu sign-in code",
        "variables": ["full_name", "otp", "org_name"],
        "body": _email(
            "Your sign-in code",
            "Hello {full_name}, use the code below to sign in.",
            _callout('<span style="font-size:30px;font-weight:700;letter-spacing:7px;'
                     f'color:{BRAND};">{{otp}}</span>', ACCENT),
            footnote="This code expires in 5 minutes. If you did not request it you can ignore "
                     "this email &mdash; nobody can sign in without it. Sent for {org_name}.",
        ),
    },
    {
        "trigger_key": "USER_CREDENTIALS",
        "name": "New user welcome + sign-in details",
        "description": "Sent when an admin creates a user and sets their password.",
        "module_code": "", "category": "System",
        "subject": "Your KaySetu account is ready",
        "variables": ["full_name", "org_name", "org_code", "email", "password"],
        "body": _email(
            "Welcome to KaySetu",
            "Hello {full_name}, an account has been created for you at <b>{org_name}</b>.",
            _rows([("Organization code", "{org_code}"),
                   ("Email", "{email}"),
                   ("Password", "{password}")]),
            cta="Sign in", cta_url=f"{PORTAL}/login",
            footnote="For your security, please change this password after your first sign-in.",
        ),
    },
    {
        # The safety net. Notification handlers supply only a subject + message,
        # so an event template whose placeholders cannot all be filled would put
        # a literal {order_number} in an inbox. Delivery falls back to this
        # instead: always well-formed, never wrong.
        "trigger_key": "NOTIFICATION",
        "name": "General notification",
        "description": "Used for any alert with no fully-fillable template of its own.",
        "module_code": "", "category": "System",
        "subject": "{title}",
        "variables": ["title", "message", "org_name"],
        "body": _email(
            "{title}", "{message}", "",
            cta="Open KaySetu", cta_url=PORTAL,
            footnote="You are receiving this because of your notification settings. "
                     "Sent for {org_name}.",
        ),
    },
]

SMS_CORE = [
    {"trigger_key": "OTP_LOGIN", "name": "Sign-in code (OTP)", "module_code": "",
     "category": "System", "variables": ["otp"],
     "description": "One-time code for phone/OTP sign-in.",
     "content": "{otp} is your KaySetu sign-in code. It expires in 5 minutes. Do not share it."},
    {"trigger_key": "USER_CREDENTIALS", "name": "New user sign-in details", "module_code": "",
     "category": "System", "variables": ["org_code", "email"],
     "description": "Sent when an admin creates a user.",
     "content": "Your KaySetu account is ready. Org code {org_code}, sign in as {email}. "
                "Your password has been emailed to you."},
    {"trigger_key": "NOTIFICATION", "name": "General notification", "module_code": "",
     "category": "System", "variables": ["title"],
     "description": "Used for any alert with no fully-fillable template of its own.",
     "content": "KaySetu: {title}. Open the app for details."},
]


# ── One spec per notification event ───────────────────────────────────────
# Email and SMS are generated from the SAME row, so the two channels can never
# drift apart or end up covering different events. The variable list is the
# contract with the sender: an event template is used only when every one of
# them can be supplied, otherwise delivery falls back to the general template.
#
# (trigger, name, module, category, description,
#  title, intro, rows, cta_label, cta_path, sms_text, variables)
EVENTS = [
    # ── Field & Visits — TRACK / FIELD ────────────────────────────────────
    ("visit_scheduled", "Visit scheduled", "FIELD", "Field & Visits",
     "A visit is planned for a client.",
     "A visit was scheduled", "{agent_name} scheduled a visit.",
     [("Client", "{customer_name}"), ("Scheduled for", "{visit_date}"), ("Agent", "{agent_name}")],
     "Open visits", "/visits",
     "Visit scheduled at {customer_name} on {visit_date}. Open KaySetu for details.",
     ["agent_name", "customer_name", "visit_date", "org_name"]),

    ("visit_assigned", "Visit assigned to you", "FIELD", "Field & Visits",
     "A manager assigns a visit to an agent.",
     "A visit was assigned to you", "Hello {full_name}, a new visit is on your beat plan.",
     [("Client", "{customer_name}"), ("Scheduled for", "{visit_date}"), ("Address", "{address}")],
     "Open my visits", "/visits",
     "New visit assigned: {customer_name} on {visit_date}. Open KaySetu for details.",
     ["full_name", "customer_name", "visit_date", "address", "org_name"]),

    ("visit_checkin", "Agent checked in", "TRACK", "Field & Visits",
     "An agent checked in at a client location.",
     "Agent checked in", "{agent_name} has arrived at a client location.",
     [("Agent", "{agent_name}"), ("Client", "{customer_name}"), ("Time", "{event_time}")],
     "Open tracking", "/admin/tracking-health",
     "{agent_name} checked in at {customer_name} at {event_time}.",
     ["agent_name", "customer_name", "event_time", "org_name"]),

    ("visit_checkout", "Visit completed", "TRACK", "Field & Visits",
     "An agent checked out / completed a visit.",
     "Visit completed", "{agent_name} has completed a visit.",
     [("Agent", "{agent_name}"), ("Client", "{customer_name}"), ("Time", "{event_time}")],
     "Open visits", "/visits",
     "{agent_name} completed the visit at {customer_name} at {event_time}.",
     ["agent_name", "customer_name", "event_time", "org_name"]),

    ("agent_offline", "Agent went offline", "TRACK", "Field & Visits",
     "A punched-in agent stopped sharing location.",
     "An agent stopped reporting",
     "{agent_name} has not sent a location update recently.",
     [("Agent", "{agent_name}"), ("Last seen", "{last_seen}")],
     "Open tracking health", "/admin/tracking-health",
     "{agent_name} stopped sharing location. Last seen {last_seen}.",
     ["agent_name", "last_seen", "org_name"]),

    ("agent_online", "Agent back online", "TRACK", "Field & Visits",
     "Location sharing resumed.",
     "Agent is back online", "{agent_name} is sharing location again.",
     [("Agent", "{agent_name}"), ("Resumed at", "{event_time}")],
     "Open tracking health", "/admin/tracking-health",
     "{agent_name} is back online at {event_time}.",
     ["agent_name", "event_time", "org_name"]),

    # ── Sales & Orders — ORDERS ───────────────────────────────────────────
    ("order_placed", "Order placed", "ORDERS", "Sales & Orders",
     "A new sales order is booked.",
     "A new order was placed", "Order <b>{order_number}</b> has been booked.",
     [("Customer", "{customer_name}"), ("Order value", "{order_total}"),
      ("Booked by", "{placed_by}")],
     "View order", "/sales-orders",
     "Order {order_number} booked for {customer_name}, value {order_total}.",
     ["order_number", "customer_name", "order_total", "placed_by", "org_name"]),

    ("order_status", "Order status changed", "ORDERS", "Sales & Orders",
     "An order was approved, dispatched, delivered or cancelled.",
     "Order status updated", "Order <b>{order_number}</b> is now <b>{status}</b>.",
     [("Order", "{order_number}"), ("Status", "{status}"), ("Updated by", "{actioned_by}")],
     "View order", "/sales-orders",
     "Order {order_number} is now {status}.",
     ["order_number", "status", "actioned_by", "org_name"]),

    # ── Inventory & Requests — INV / DIST ─────────────────────────────────
    ("stock_request_raised", "Stock request raised", "DIST", "Inventory & Requests",
     "A distributor raised a stock request.",
     "New stock request", "{distributor_name} has raised a stock request.",
     [("Request", "{request_number}"), ("Distributor", "{distributor_name}"),
      ("Value", "{amount}")],
     "Open stock requests", "/stock-requests",
     "Stock request {request_number} raised by {distributor_name}, value {amount}.",
     ["request_number", "distributor_name", "amount", "org_name"]),

    ("stock_request_status", "Stock request status changed", "DIST", "Inventory & Requests",
     "A stock request was approved, dispatched or rejected.",
     "Stock request updated", "Request <b>{request_number}</b> is now <b>{status}</b>.",
     [("Request", "{request_number}"), ("Status", "{status}"), ("Updated by", "{actioned_by}")],
     "Open stock requests", "/stock-requests",
     "Stock request {request_number} is now {status}.",
     ["request_number", "status", "actioned_by", "org_name"]),

    ("low_stock", "Low stock alert", "INV", "Inventory & Requests",
     "A product fell below its reorder threshold.",
     "Stock is running low", "<b>{product_name}</b> has fallen below its reorder level.",
     [("Product", "{product_name}"), ("In stock", "{current_stock}"),
      ("Reorder level", "{threshold}")],
     "Open inventory", "/stock-ledger",
     "Low stock: {product_name} is down to {current_stock}. Please reorder.",
     ["product_name", "current_stock", "threshold", "org_name"]),

    # ── Purchase — PURCH ──────────────────────────────────────────────────
    ("material_request_raised", "Material request raised", "PURCH", "Purchase",
     "Someone raised a material request.",
     "New material request", "{raised_by} has raised a material request.",
     [("Request", "{request_number}"), ("Raised by", "{raised_by}"),
      ("Needed by", "{required_date}")],
     "Open material requests", "/material-requests",
     "Material request {request_number} raised by {raised_by}, needed by {required_date}.",
     ["request_number", "raised_by", "required_date", "org_name"]),

    ("material_request_status", "Material request status changed", "PURCH", "Purchase",
     "A material request was approved, rejected or fulfilled.",
     "Material request updated", "Request <b>{request_number}</b> is now <b>{status}</b>.",
     [("Request", "{request_number}"), ("Status", "{status}"), ("Actioned by", "{actioned_by}")],
     "Open material requests", "/material-requests",
     "Material request {request_number} is now {status}.",
     ["request_number", "status", "actioned_by", "org_name"]),

    # ── Finance — BOOKS ───────────────────────────────────────────────────
    ("payment_received", "Payment received", "BOOKS", "Finance",
     "A customer payment was recorded.",
     "Payment received", "A payment has been recorded against {customer_name}.",
     [("Customer", "{customer_name}"), ("Amount", "{amount}"), ("Reference", "{reference}")],
     "Open ledgers", "/customer-ledgers",
     "Payment of {amount} received from {customer_name}. Ref {reference}.",
     ["customer_name", "amount", "reference", "org_name"]),

    # ── Leads & CRM — CRM ─────────────────────────────────────────────────
    ("lead_added", "Lead added", "CRM", "Leads & CRM",
     "A new lead was captured.",
     "A new lead was added", "{added_by} captured a new lead.",
     [("Lead", "{lead_name}"), ("Phone", "{lead_phone}"), ("Added by", "{added_by}")],
     "Open leads", "/leads",
     "New lead {lead_name} ({lead_phone}) added by {added_by}.",
     ["lead_name", "lead_phone", "added_by", "org_name"]),

    ("lead_assigned", "Lead assigned to you", "CRM", "Leads & CRM",
     "A lead is assigned to a user.",
     "A lead was assigned to you",
     "Hello {full_name}, a new lead is waiting for your follow-up.",
     [("Lead", "{lead_name}"), ("Phone", "{lead_phone}")],
     "Open leads", "/leads",
     "New lead assigned: {lead_name} ({lead_phone}). Follow up in KaySetu.",
     ["full_name", "lead_name", "lead_phone", "org_name"]),

    # ── Travel Allowance — TA ─────────────────────────────────────────────
    ("travel_allowance_submitted", "Travel claim submitted", "TA", "Travel Allowance",
     "An agent submitted a TA claim for approval.",
     "A travel claim was submitted", "{full_name} submitted a travel allowance claim.",
     [("Claim", "{claim_number}"), ("Submitted by", "{full_name}"), ("Amount", "{amount}")],
     "Open travel allowance", "/travel-allowance",
     "Travel claim {claim_number} submitted by {full_name} for {amount}.",
     ["claim_number", "full_name", "amount", "org_name"]),

    ("travel_allowance_status", "Travel claim status changed", "TA", "Travel Allowance",
     "A TA claim was approved, rejected or paid.",
     "Your travel claim was updated",
     "Hello {full_name}, your claim <b>{claim_number}</b> is now <b>{status}</b>.",
     [("Claim", "{claim_number}"), ("Status", "{status}"), ("Amount", "{amount}")],
     "Open travel allowance", "/travel-allowance",
     "Your travel claim {claim_number} is now {status}. Amount {amount}.",
     ["full_name", "claim_number", "status", "amount", "org_name"]),

    ("travel_allowance_deadline", "Travel claim deadline", "TA", "Travel Allowance",
     "A reminder that the TA submission window is closing.",
     "Travel claims close soon",
     "Hello {full_name}, please submit your travel claims before {due_date}.",
     [("Deadline", "{due_date}"), ("Pending claims", "{pending_count}")],
     "Open travel allowance", "/travel-allowance",
     "Reminder: submit your travel claims before {due_date}. {pending_count} pending.",
     ["full_name", "due_date", "pending_count", "org_name"]),

    # ── System ────────────────────────────────────────────────────────────
    ("announcement", "Announcement / broadcast", "", "System",
     "A manual announcement sent from the portal.",
     "{title}", "{message}", [],
     "Open KaySetu", "",
     "KaySetu: {title}. Open the app for details.",
     ["title", "message", "org_name"]),
]


def _build():
    """Expand EVENTS into full email + SMS template dicts."""
    emails, smses = list(EMAIL_CORE), list(SMS_CORE)
    for (trigger, name, module, category, description,
         title, intro, rows, cta, path, sms, variables) in EVENTS:
        blob = " ".join([title, intro] + [f"{k}{v}" for k, v in rows])
        emails.append({
            "trigger_key": trigger, "name": name, "description": description,
            "module_code": module, "category": category,
            "subject": "{title}" if trigger == "announcement" else f"{name} — {{org_name}}",
            # Only advertise what the rendered email actually references, so the
            # variable chips in the console never promise something unused.
            "variables": [v for v in variables
                          if ("{%s}" % v) in blob or v == "org_name"],
            "body": _email(title, intro, _rows(rows) if rows else "",
                           cta=cta, cta_url=f"{PORTAL}{path}" if path else PORTAL),
        })
        smses.append({
            "trigger_key": trigger, "name": name, "description": description,
            "module_code": module, "category": category,
            # SMS carries only what fits — org_name is dropped to keep segments low.
            "variables": [v for v in variables if ("{%s}" % v) in sms],
            "content": sms,
        })
    return emails, smses


EMAIL_TEMPLATES, SMS_TEMPLATES = _build()


def iter_catalog():
    """Yield (channel, defaults-dict) for every template that ships with the app."""
    for t in EMAIL_TEMPLATES:
        yield "email", {
            "trigger_key": t["trigger_key"], "name": t["name"],
            "description": t.get("description", ""), "module_code": t.get("module_code", ""),
            "category": t.get("category", ""), "subject": t.get("subject", ""),
            "body": t.get("body", ""), "content": "", "dlt_template_id": "",
            "available_variables": t.get("variables", []),
        }
    for t in SMS_TEMPLATES:
        yield "sms", {
            "trigger_key": t["trigger_key"], "name": t["name"],
            "description": t.get("description", ""), "module_code": t.get("module_code", ""),
            "category": t.get("category", ""), "subject": "", "body": "",
            "content": t.get("content", ""), "dlt_template_id": "",
            "available_variables": t.get("variables", []),
        }

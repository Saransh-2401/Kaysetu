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

# ── The catalog ───────────────────────────────────────────────────────────
# (channel, trigger_key, name, description, module_code, category,
#  subject, body/content, dlt_id, variables)
EMAIL_TEMPLATES = [
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
            footnote="This code expires in 5 minutes. If you did not request it, "
                     "you can safely ignore this email — nobody can sign in without it.",
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
    # ── Field & Visits (TRACK / FIELD)
    {
        "trigger_key": "visit_assigned",
        "name": "Visit assigned to you",
        "description": "A manager assigns a visit to an agent.",
        "module_code": "FIELD", "category": "Field & Visits",
        "subject": "New visit assigned — {customer_name}",
        "variables": ["full_name", "customer_name", "visit_date", "address", "org_name"],
        "body": _email(
            "A visit was assigned to you",
            "Hello {full_name}, a new visit is on your beat plan.",
            _rows([("Client", "{customer_name}"),
                   ("Scheduled for", "{visit_date}"),
                   ("Address", "{address}")]),
            cta="Open my visits", cta_url=f"{PORTAL}/visits",
        ),
    },
    {
        "trigger_key": "agent_offline",
        "name": "Agent went offline",
        "description": "An agent's device stopped reporting location during duty hours.",
        "module_code": "TRACK", "category": "Field & Visits",
        "subject": "{agent_name} is offline",
        "variables": ["agent_name", "last_seen", "org_name"],
        "body": _email(
            "An agent stopped reporting",
            "{agent_name}'s device has not sent a location update recently.",
            _rows([("Agent", "{agent_name}"), ("Last seen", "{last_seen}")]),
            cta="Open tracking health", cta_url=f"{PORTAL}/admin/tracking-health",
            footnote="This usually means the app was closed, the phone lost signal, "
                     "or battery optimisation stopped background tracking.",
        ),
    },
    # ── Sales & Orders (ORDERS)
    {
        "trigger_key": "order_placed",
        "name": "Order placed",
        "description": "A new sales order is booked.",
        "module_code": "ORDERS", "category": "Sales & Orders",
        "subject": "New order {order_number} — {customer_name}",
        "variables": ["order_number", "customer_name", "order_total", "placed_by", "org_name"],
        "body": _email(
            "A new order was placed",
            "Order <b>{order_number}</b> has been booked.",
            _rows([("Customer", "{customer_name}"),
                   ("Order value", "{order_total}"),
                   ("Booked by", "{placed_by}")]),
            cta="View order", cta_url=f"{PORTAL}/sales-orders",
        ),
    },
    # ── Inventory (INV)
    {
        "trigger_key": "low_stock",
        "name": "Low stock alert",
        "description": "A product fell below its reorder threshold.",
        "module_code": "INV", "category": "Inventory & Requests",
        "subject": "Low stock — {product_name}",
        "variables": ["product_name", "current_stock", "threshold", "org_name"],
        "body": _email(
            "Stock is running low",
            "<b>{product_name}</b> has fallen below its reorder level.",
            _rows([("Product", "{product_name}"),
                   ("In stock", "{current_stock}"),
                   ("Reorder level", "{threshold}")]),
            cta="Open inventory", cta_url=f"{PORTAL}/stock-ledger",
        ),
    },
    # ── Finance (BOOKS)
    {
        "trigger_key": "payment_received",
        "name": "Payment received",
        "description": "A customer payment was recorded.",
        "module_code": "BOOKS", "category": "Finance",
        "subject": "Payment received — {amount}",
        "variables": ["customer_name", "amount", "reference", "org_name"],
        "body": _email(
            "Payment received",
            "A payment has been recorded against {customer_name}.",
            _rows([("Customer", "{customer_name}"),
                   ("Amount", "{amount}"),
                   ("Reference", "{reference}")]),
            cta="Open ledgers", cta_url=f"{PORTAL}/customer-ledgers",
        ),
    },
    # ── Purchase (PURCH)
    {
        "trigger_key": "material_request_status",
        "name": "Material request status changed",
        "description": "A material request was approved, rejected or fulfilled.",
        "module_code": "PURCH", "category": "Purchase",
        "subject": "Material request {request_number} — {status}",
        "variables": ["request_number", "status", "actioned_by", "org_name"],
        "body": _email(
            "Material request updated",
            "Request <b>{request_number}</b> is now <b>{status}</b>.",
            _rows([("Request", "{request_number}"),
                   ("Status", "{status}"),
                   ("Actioned by", "{actioned_by}")]),
            cta="Open material requests", cta_url=f"{PORTAL}/material-requests",
        ),
    },
    # ── Leads & CRM (CRM)
    {
        "trigger_key": "lead_assigned",
        "name": "Lead assigned to you",
        "description": "A lead is assigned to a user.",
        "module_code": "CRM", "category": "Leads & CRM",
        "subject": "New lead assigned — {lead_name}",
        "variables": ["full_name", "lead_name", "lead_phone", "org_name"],
        "body": _email(
            "A lead was assigned to you",
            "Hello {full_name}, a new lead is waiting for your follow-up.",
            _rows([("Lead", "{lead_name}"), ("Phone", "{lead_phone}")]),
            cta="Open leads", cta_url=f"{PORTAL}/leads",
        ),
    },
    # ── Travel Allowance (TA)
    {
        "trigger_key": "travel_allowance_status",
        "name": "Travel allowance claim status",
        "description": "A TA claim was approved, rejected or paid.",
        "module_code": "TA", "category": "Travel Allowance",
        "subject": "Travel claim {claim_number} — {status}",
        "variables": ["full_name", "claim_number", "status", "amount", "org_name"],
        "body": _email(
            "Your travel claim was updated",
            "Hello {full_name}, your claim <b>{claim_number}</b> is now <b>{status}</b>.",
            _rows([("Claim", "{claim_number}"),
                   ("Status", "{status}"),
                   ("Amount", "{amount}")]),
            cta="Open travel allowance", cta_url=f"{PORTAL}/travel-allowance",
        ),
    },
    # ── Attendance (ATT)
    {
        "trigger_key": "announcement",
        "name": "Announcement / broadcast",
        "description": "A manual announcement sent from the portal.",
        "module_code": "", "category": "System",
        "subject": "{title}",
        "variables": ["title", "message", "org_name"],
        "body": _email("{title}", "{message}", "",
                       cta="Open KaySetu", cta_url=PORTAL),
    },
]

SMS_TEMPLATES = [
    {"trigger_key": "OTP_LOGIN", "name": "Sign-in code (OTP)", "module_code": "",
     "category": "System", "variables": ["otp"],
     "description": "One-time code for phone/OTP sign-in.",
     "content": "{otp} is your KaySetu sign-in code. It expires in 5 minutes. Do not share it."},

    {"trigger_key": "USER_CREDENTIALS", "name": "New user sign-in details", "module_code": "",
     "category": "System", "variables": ["org_code", "email"],
     "description": "Sent when an admin creates a user.",
     "content": "Your KaySetu account is ready. Org code {org_code}, sign in as {email}. "
                "Your password has been emailed to you."},

    {"trigger_key": "visit_assigned", "name": "Visit assigned", "module_code": "FIELD",
     "category": "Field & Visits", "variables": ["customer_name", "visit_date"],
     "description": "A manager assigns a visit to an agent.",
     "content": "New visit assigned: {customer_name} on {visit_date}. Open KaySetu for details."},

    {"trigger_key": "agent_offline", "name": "Agent offline", "module_code": "TRACK",
     "category": "Field & Visits", "variables": ["agent_name", "last_seen"],
     "description": "An agent's device stopped reporting location.",
     "content": "{agent_name} stopped reporting location. Last seen {last_seen}."},

    {"trigger_key": "order_placed", "name": "Order placed", "module_code": "ORDERS",
     "category": "Sales & Orders", "variables": ["order_number", "order_total"],
     "description": "A new sales order is booked.",
     "content": "Order {order_number} booked for {order_total}. Open KaySetu for details."},

    {"trigger_key": "low_stock", "name": "Low stock alert", "module_code": "INV",
     "category": "Inventory & Requests", "variables": ["product_name", "current_stock"],
     "description": "A product fell below its reorder threshold.",
     "content": "Low stock: {product_name} is down to {current_stock}. Please reorder."},

    {"trigger_key": "payment_received", "name": "Payment received", "module_code": "BOOKS",
     "category": "Finance", "variables": ["customer_name", "amount"],
     "description": "A customer payment was recorded.",
     "content": "Payment of {amount} received from {customer_name}."},

    {"trigger_key": "lead_assigned", "name": "Lead assigned", "module_code": "CRM",
     "category": "Leads & CRM", "variables": ["lead_name", "lead_phone"],
     "description": "A lead is assigned to a user.",
     "content": "New lead assigned: {lead_name} ({lead_phone}). Follow up in KaySetu."},

    {"trigger_key": "travel_allowance_status", "name": "Travel claim status", "module_code": "TA",
     "category": "Travel Allowance", "variables": ["claim_number", "status"],
     "description": "A TA claim was approved, rejected or paid.",
     "content": "Your travel claim {claim_number} is now {status}."},
]


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

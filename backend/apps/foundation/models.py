"""
Foundation models — live in EACH TENANT'S database, never in `default`.

Rules (blueprint §3/§6):
  * No FK to control-plane models (different database) — reference by ID only.
  * These are the shared entities every module may depend on. Future module
    apps FK these, never each other.
"""
from django.contrib.auth.hashers import check_password, is_password_usable, make_password
from django.db import models


class Role(models.Model):
    """Dynamic role. System roles come from module role-templates; tenants add custom ones."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=64, unique=True)
    description = models.CharField(max_length=255, blank=True)
    is_system = models.BooleanField(default=False)
    # A full-access role bypasses the matrix entirely; storing it as a flag keeps
    # "admin sees everything" from depending on the matrix being kept in sync.
    is_full_access = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    # {"<MODULE_CODE>|*": ["<action>|*", ...]} — full matrix arrives with the permission UI.
    permissions = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug


class TenantUser(models.Model):
    """A user inside one tenant. Deliberately NOT Django's AUTH_USER_MODEL.

    Field set ported in full from the previous platform's User model — KYC,
    address, geo and business fields included."""

    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    full_name = models.CharField(max_length=200)
    password = models.CharField(max_length=128)
    role = models.ForeignKey(Role, null=True, on_delete=models.SET_NULL, related_name="users")
    # Manager hierarchy — a field agent reports to a field/sales manager. Drives
    # team-scoped RBAC and manager alerts across modules (tracking, field, TA).
    reports_to = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="team_members"
    )
    is_owner = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # Profile & KYC
    profile_image = models.URLField(max_length=500, blank=True)
    aadhaar_card = models.URLField(max_length=500, blank=True)
    aadhaar_number = models.CharField(max_length=12, blank=True)
    pan_card = models.URLField(max_length=500, blank=True)
    pan_number = models.CharField(max_length=10, blank=True)

    # Address
    address_line1 = models.CharField(max_length=200, blank=True)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default="India")
    full_address = models.TextField(blank=True)

    # Business fields (distributor-style users)
    business_name = models.CharField(max_length=200, blank=True)
    gst_number = models.CharField(max_length=15, blank=True)
    shipping_address = models.TextField(blank=True)
    # Links a login to the Party it acts for (a distributor's own user account,
    # a customer portal login). Lets a module scope that user to their own rows.
    party = models.ForeignKey(
        "foundation.Party", null=True, blank=True, on_delete=models.SET_NULL, related_name="users"
    )

    # Geo — work + home (home feeds the Travel Allowance distance basis)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    home_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    home_longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)

    last_login = models.DateTimeField(null=True, blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # --- password + DRF compatibility -------------------------------------
    def set_password(self, raw_password):
        self.password = make_password(raw_password)

    def set_unusable_password(self):
        self.password = make_password(None)

    def check_password(self, raw_password) -> bool:
        return is_password_usable(self.password) and check_password(raw_password, self.password)

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def __str__(self):
        return self.email


class OrgSettings(models.Model):
    """Singleton (pk=1): the tenant's own company profile + terminology."""

    company_name = models.CharField(max_length=200)
    legal_name = models.CharField(max_length=200, blank=True)
    abbreviation = models.CharField(max_length=20, blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    registration_number = models.CharField(max_length=64, blank=True)
    industry = models.CharField(max_length=32, default="generic")
    logo_url = models.URLField(max_length=1000, blank=True)

    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(max_length=500, blank=True)
    address = models.JSONField(default=dict, blank=True)   # {line1,line2,city,state,postal_code}
    country = models.CharField(max_length=100, default="India")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)

    # Territory. A single default plus the list the tenant actually operates in —
    # analytics groups agents by their own `city`, this is the pick-list.
    operating_cities = models.JSONField(default=list, blank=True)
    default_operating_city = models.CharField(max_length=100, blank=True)

    default_currency = models.CharField(max_length=3, default="INR")
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    date_format = models.CharField(max_length=32, default="dd/MM/yyyy")
    fy_start_month = models.PositiveSmallIntegerField(default=4)
    fiscal_day_start = models.PositiveSmallIntegerField(default=1)
    office_start_time = models.TimeField(null=True, blank=True)
    office_end_time = models.TimeField(null=True, blank=True)
    active_font = models.CharField(max_length=64, default="roboto")
    is_active = models.BooleanField(default=True)
    # Terminology dictionary — how THIS tenant names things (Product/Service/...).
    labels = models.JSONField(default=dict, blank=True)
    numbering = models.JSONField(default=dict, blank=True)
    working_hours = models.JSONField(default=dict, blank=True)
    # Appearance: {"scheme": "<scheme-key>"} — the tenant-picked color scheme.
    appearance = models.JSONField(default=dict, blank=True)
    # Setup wizard progress: {"done": ["company", ...], "completed": bool}
    setup_state = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Org settings"


class EntitlementSnapshot(models.Model):
    """Singleton (pk=1): modules this tenant is entitled to, synced from the
    control plane so the tenant hot path never queries the control DB."""

    modules = models.JSONField(default=list, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)

    @classmethod
    def current_modules(cls) -> list[str]:
        snapshot = cls.objects.filter(pk=1).first()
        return list(snapshot.modules) if snapshot else []


class CatalogItem(models.Model):
    """Generic sellable item — product OR service (industry-agnostic)."""

    class Kind(models.TextChoices):
        PRODUCT = "product", "Product"
        SERVICE = "service", "Service"

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=64, blank=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.PRODUCT)
    unit = models.CharField(max_length=32, default="pcs")
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    hsn_sac = models.CharField(max_length=16, blank=True)
    is_active = models.BooleanField(default=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Party(models.Model):
    """Generic business party — customer, supplier, both, or a prospect (a lead
    that the CRM module manages until it converts to a customer)."""

    class Kind(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        SUPPLIER = "supplier", "Supplier"
        BOTH = "both", "Customer & Supplier"
        PROSPECT = "prospect", "Prospect"

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.CUSTOMER)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    address = models.JSONField(default=dict, blank=True)   # {line1,line2,city,state,postal_code,latitude,longitude}
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    # The agent who owns this party's relationship (field sales territory).
    assigned_agent = models.ForeignKey(
        "TenantUser", null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_parties"
    )
    is_active = models.BooleanField(default=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Parties"

    def __str__(self):
        return self.name


class EventDelivery(models.Model):
    """Durable record of ONE domain event delivered to ONE subscriber.

    The event bus is fire-and-forget by design (a failing subscriber must never
    break the emitter), which previously meant a failed auto-post — an invoice
    that never reached the ledger, a dispatch that never left stock — vanished
    into a log line. Every delivery is now written here BEFORE it is attempted,
    so a crash mid-handler leaves a `pending` row rather than nothing at all, and
    anything not `delivered` can be retried and reconciled.

    Retry is safe because handlers apply their whole effect in one transaction:
    a failed delivery changed nothing, so replaying it applies it exactly once.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        DELIVERED = "delivered", "Delivered"
        FAILED = "failed", "Failed (will retry)"
        ABANDONED = "abandoned", "Abandoned (max attempts)"
        # A replay whose handler no longer applies because the tenant's
        # entitlements changed between the emit and the retry. Distinct from
        # DELIVERED on purpose: nothing was posted, and calling that "delivered"
        # would hide a real gap in the ledger.
        SKIPPED_UNENTITLED = "skipped_unentitled", "Skipped (module no longer entitled)"

    event = models.CharField(max_length=100, db_index=True)
    subscriber = models.CharField(max_length=255, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    # Entitlements AS AT the emit. A retry compares against this so a tenant who
    # downgraded doesn't have their backlog silently marked done.
    modules_at_emit = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices,
                              default=Status.PENDING, db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["event", "status"]),
        ]
        verbose_name_plural = "Event deliveries"

    def __str__(self):
        return f"{self.event} -> {self.subscriber} ({self.status})"


class AuditLog(models.Model):
    """Tenant-side audit trail: who did what, when, old -> new."""

    actor_id = models.BigIntegerField(null=True, blank=True)
    actor_name = models.CharField(max_length=200, blank=True)
    action = models.CharField(max_length=100)
    entity = models.CharField(max_length=100, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at"]


# --------------------------------------------------------------- messaging config
class EmailConfiguration(models.Model):
    """Singleton (pk=1): the tenant's own SMTP credentials.

    Per-tenant rather than platform-wide on purpose — invoices and alerts should
    arrive from the tenant's own domain, not ours.
    """

    host = models.CharField(max_length=200, default="smtp.gmail.com")
    port = models.PositiveIntegerField(default=587)
    username = models.CharField(max_length=200, blank=True)
    # Stored as-is. Encrypting it would need a key the tenant DB doesn't hold;
    # the honest position is that this is a secret in the database, protected by
    # DB access control, and it is never returned by the API.
    password = models.CharField(max_length=500, blank=True)
    use_tls = models.BooleanField(default=True)
    use_ssl = models.BooleanField(default=False)
    default_from_email = models.EmailField(blank=True)
    from_name = models.CharField(max_length=200, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Email configuration"


class EmailTemplate(models.Model):
    """A message body keyed to an event. `trigger_key` matches the notification
    catalog's event key, so a template and its trigger can't drift apart."""

    name = models.CharField(max_length=200, unique=True)
    trigger_key = models.CharField(max_length=100, unique=True)
    subject = models.CharField(max_length=300)
    body = models.TextField(blank=True)
    available_variables = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SMSConfiguration(models.Model):
    """Singleton (pk=1). `entity_id` is the DLT entity — Indian SMS cannot be
    sent without one, so a blank value here means SMS is simply off."""

    api_key = models.CharField(max_length=500, blank=True)
    sender_id = models.CharField(max_length=20, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "SMS configuration"


class SMSTemplate(models.Model):
    name = models.CharField(max_length=200, unique=True)
    trigger_key = models.CharField(max_length=100, unique=True)
    content = models.TextField()
    # The DLT-registered template id. Without it the carrier rejects the send,
    # so a template with no id is stored but never dispatched.
    dlt_template_id = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class RoleQuickLink(models.Model):
    """A shortcut an admin pins for a whole role."""

    role_slug = models.CharField(max_length=64, db_index=True)
    label = models.CharField(max_length=60)
    path = models.CharField(max_length=200)
    module_key = models.CharField(max_length=50, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("role_slug", "path")
        ordering = ["role_slug", "order", "id"]


class UserQuickLink(models.Model):
    """A shortcut someone pinned for themselves."""

    user = models.ForeignKey(TenantUser, on_delete=models.CASCADE, related_name="quick_links")
    label = models.CharField(max_length=60)
    path = models.CharField(max_length=200)
    module_key = models.CharField(max_length=50, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ("user", "path")
        ordering = ["user", "order", "id"]


# ------------------------------------------------------------------- masters
class UOM(models.Model):
    """Unit of measure. Reference data shared by every module that counts
    something, which is why it lives in foundation and not in INV."""

    uom_name = models.CharField(max_length=50, unique=True)
    symbol = models.CharField(max_length=10, blank=True)
    is_base_unit = models.BooleanField(default=False)
    conversion_factor = models.DecimalField(max_digits=10, decimal_places=4, default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["uom_name"]
        verbose_name = "UOM"

    def __str__(self):
        return self.uom_name


class TaxSlab(models.Model):
    """A GST rate and the HSN codes it applies to. Invoice screens look a rate
    up by HSN from here rather than each screen hardcoding the rate table."""

    name = models.CharField(max_length=100, unique=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2)
    hsn_codes = models.JSONField(default=list, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-percentage"]

    def __str__(self):
        return f"{self.name} ({self.percentage}%)"


class LoginActivity(models.Model):
    """A login audit row — who signed in (or tried), from where, how.

    Lives in the tenant DB and is written on every tenant login attempt. A
    failed attempt keeps `user` null (the credentials didn't resolve to one) but
    still records what was tried, so a brute-force run is visible."""

    class Event(models.TextChoices):
        LOGIN = "login", "Login"
        FAILED = "failed_login", "Failed login"
        LOGOUT = "logout", "Logout"

    user = models.ForeignKey(
        TenantUser, null=True, blank=True, on_delete=models.SET_NULL, related_name="login_events"
    )
    user_name = models.CharField(max_length=200, blank=True)
    username_attempted = models.CharField(max_length=254, blank=True)
    user_role = models.CharField(max_length=64, blank=True)
    event = models.CharField(max_length=16, choices=Event.choices, default=Event.LOGIN, db_index=True)
    success = models.BooleanField(default=True, db_index=True)
    method = models.CharField(max_length=20, default="password")   # password | otp | refresh
    platform = models.CharField(max_length=20, default="web")      # web | mobile | unknown
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    # Geo city, resolved from the IP by a later job; left blank for now.
    location = models.CharField(max_length=120, blank=True)
    location_resolved = models.BooleanField(default=False)
    detail = models.CharField(max_length=100, blank=True)          # failure reason
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["event", "-created_at"])]
        verbose_name_plural = "Login activity"


class LoginOTP(models.Model):
    """A one-time code for phone-based sign-in, stored in the tenant's own DB.

    Deliberately NOT Django's cache: no CACHES backend is configured, so the
    default LocMemCache is per-process — a code issued by one worker would be
    invisible to the next, making OTP login fail intermittently behind gunicorn
    or across containers. A row survives that, and gives us attempt-limiting and
    an audit trail for free.

    The code itself is stored hashed, so a leaked DB snapshot cannot be replayed.
    """

    MAX_ATTEMPTS = 5

    phone = models.CharField(max_length=20, db_index=True)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField(db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["phone", "-created_at"])]

    def __str__(self):
        return f"OTP for {self.phone} (expires {self.expires_at:%H:%M})"

    def is_usable(self):
        from django.utils import timezone as _tz
        return (
            self.consumed_at is None
            and self.attempts < self.MAX_ATTEMPTS
            and self.expires_at > _tz.now()
        )

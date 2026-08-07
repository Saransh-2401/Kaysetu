"""Control-plane models — live in the `default` database only."""
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone


class AdminUserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("admin_role", AdminUser.Role.SUPER)
        extra_fields.setdefault("full_name", "Super Admin")
        return self.create_user(email, password, **extra_fields)


class AdminUser(AbstractBaseUser):
    """KaySetu staff (SuperAdmin dashboard). NOT a tenant user."""

    class Role(models.TextChoices):
        SUPER = "super", "Super Admin"
        GROWTH = "growth", "Growth"
        SUPPORT = "support", "Support"
        ACCOUNT_MANAGER = "account_manager", "Account Manager"

    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=200)
    admin_role = models.CharField(max_length=32, choices=Role.choices, default=Role.SUPPORT)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = AdminUserManager()

    def __str__(self):
        return f"{self.email} ({self.admin_role})"


class ModuleDef(models.Model):
    """Registry of sellable technical modules (blueprint §4)."""

    code = models.CharField(max_length=16, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "code"]

    def __str__(self):
        return self.code


class Package(models.Model):
    """A sellable bundle of modules with pricing (blueprint §5)."""

    class MobileLevel(models.TextChoices):
        NONE = "none", "No mobile app"
        TRACKING = "tracking", "Tracking"
        SALES = "sales", "Sales"

    code = models.CharField(max_length=16, unique=True)
    name = models.CharField(max_length=100)
    tagline = models.CharField(max_length=200, blank=True)
    modules = models.ManyToManyField(ModuleDef, related_name="packages", blank=True)
    is_addon = models.BooleanField(default=False)
    mobile_level = models.CharField(max_length=16, choices=MobileLevel.choices, default=MobileLevel.NONE)

    base_price_monthly = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    base_price_annual = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    included_users = models.PositiveIntegerField(default=1)
    per_user_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    is_published = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "code"]

    def module_codes(self):
        return sorted(self.modules.values_list("code", flat=True))

    def __str__(self):
        return f"{self.code} {self.name}"


class Tenant(models.Model):
    """A customer business. One row here = one dedicated tenant database."""

    class Status(models.TextChoices):
        PROVISIONING = "provisioning", "Provisioning"
        TRIAL = "trial", "Trial"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        CHURNED = "churned", "Churned"
        FAILED = "failed", "Provisioning failed"

    LOGIN_ALLOWED_STATUSES = {Status.TRIAL, Status.ACTIVE}

    class Industry(models.TextChoices):
        MANUFACTURING = "manufacturing", "Manufacturing"
        DISTRIBUTION = "distribution", "Distribution & FMCG"
        SERVICES = "services", "Services / Insurance"
        GENERIC = "generic", "Other"

    org_code = models.CharField(max_length=16, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True)
    db_name = models.CharField(max_length=100, unique=True)
    industry = models.CharField(max_length=32, choices=Industry.choices, default=Industry.GENERIC)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PROVISIONING)

    owner_name = models.CharField(max_length=200)
    owner_email = models.EmailField()
    owner_phone = models.CharField(max_length=20, blank=True)

    package = models.ForeignKey(Package, null=True, blank=True, on_delete=models.SET_NULL, related_name="tenants")
    trial_ends_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def entitled_modules(self) -> list[str]:
        return sorted(
            self.entitlements.filter(enabled=True).values_list("module_code", flat=True)
        )

    def can_login(self) -> bool:
        return self.status in self.LOGIN_ALLOWED_STATUSES

    def __str__(self):
        return f"{self.org_code} {self.name}"


class TenantModule(models.Model):
    """Entitlement source of truth: which modules a tenant has, and why."""

    class Source(models.TextChoices):
        PACKAGE = "package", "From package"
        ADDON = "addon", "From add-on"
        MANUAL = "manual", "Manual override"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="entitlements")
    module_code = models.CharField(max_length=16)
    enabled = models.BooleanField(default=True)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.PACKAGE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("tenant", "module_code")]

    def __str__(self):
        return f"{self.tenant.org_code}:{self.module_code}({'on' if self.enabled else 'off'})"


class Subscription(models.Model):
    class Cycle(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        ANNUAL = "annual", "Annual"

    class Status(models.TextChoices):
        TRIALING = "trialing", "Trialing"
        ACTIVE = "active", "Active"
        PAST_DUE = "past_due", "Past due"
        CANCELLED = "cancelled", "Cancelled"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="subscriptions")
    package = models.ForeignKey(Package, on_delete=models.PROTECT, related_name="subscriptions")
    seats = models.PositiveIntegerField(default=1)
    billing_cycle = models.CharField(max_length=16, choices=Cycle.choices, default=Cycle.MONTHLY)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.TRIALING)
    started_at = models.DateTimeField(auto_now_add=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.tenant.org_code} {self.package.code} ({self.status})"


class ProvisioningJob(models.Model):
    class Type(models.TextChoices):
        CREATE = "create", "Create tenant"
        SYNC = "sync", "Sync entitlements"
        MIGRATE = "migrate", "Run migrations"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="jobs")
    job_type = models.CharField(max_length=16, choices=Type.choices, default=Type.CREATE)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    log = models.TextField(blank=True)
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    # When the CURRENT attempt began. Staleness must be measured from this, not
    # from created_at — otherwise a retried job looks dead the moment it starts.
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def append_log(self, line: str):
        stamp = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
        self.log = f"{self.log}[{stamp}] {line}\n"

    def __str__(self):
        return f"{self.tenant.org_code} {self.job_type} {self.status}"


class ControlAuditLog(models.Model):
    """Audit of SuperAdmin actions (tenant-side audit lives in each tenant DB)."""

    actor = models.ForeignKey(AdminUser, null=True, on_delete=models.SET_NULL, related_name="audit_entries")
    action = models.CharField(max_length=100)
    entity = models.CharField(max_length=100, blank=True)
    entity_id = models.CharField(max_length=64, blank=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at"]


class AppVersion(models.Model):
    """A mobile app release. PLATFORM-owned: the KaySetu agent app is one app,
    published ONCE by the SuperAdmin — not per tenant. Lives in the control DB
    and is served globally, so a tenant admin can neither see nor set it.

    `version_code` is the ordering authority: version STRINGS sort wrongly
    ("1.10" < "1.9" as text), so the app compares codes."""

    version = models.CharField(max_length=32)
    version_code = models.PositiveIntegerField(unique=True)
    apk_url = models.URLField(max_length=1000, blank=True)
    release_notes = models.TextField(blank=True)
    force_update = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    uploaded_by = models.ForeignKey(
        AdminUser, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="app_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-version_code"]

    def __str__(self):
        return f"{self.version} ({self.version_code})"


class MessageTemplate(models.Model):
    """A platform-owned email/SMS message body.

    PLATFORM-owned, exactly like AppVersion: KaySetu authors and pays for these,
    so they live in the control DB as ONE row shared by every tenant. Ops edits
    a template once and all tenants see the change immediately — no per-tenant
    copies to drift apart or re-push.

    Tenants can READ these (so they know what their people receive) but never
    write them. What a tenant still controls is its own notification routing:
    role defaults, per-user preferences and manual broadcasts.

    `trigger_key` is the join to the code that sends: it is set by the seed and
    is NOT editable, because a renamed key silently stops the matching send.
    Ops may only edit the wording (subject/body/content) and is_active.
    """

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"

    channel = models.CharField(max_length=8, choices=Channel.choices, db_index=True)
    trigger_key = models.CharField(max_length=100, db_index=True)
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=300, blank=True)
    # Which sellable module this belongs to; blank = core (auth, account admin),
    # shown to every tenant regardless of what they bought.
    module_code = models.CharField(max_length=16, blank=True, db_index=True)
    category = models.CharField(max_length=64, blank=True)

    subject = models.CharField(max_length=300, blank=True)   # email only
    body = models.TextField(blank=True)                      # email HTML
    content = models.TextField(blank=True)                   # SMS text
    # DLT-registered id. Indian carriers reject an SMS without one, so a
    # template with no id is stored but never dispatched.
    dlt_template_id = models.CharField(max_length=64, blank=True)

    available_variables = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["channel", "category", "name"]
        unique_together = [("channel", "trigger_key")]
        indexes = [models.Index(fields=["channel", "module_code"])]

    def __str__(self):
        return f"[{self.channel}] {self.name}"


class PlatformMessagingConfig(models.Model):
    """Singleton (pk=1): the SMTP / SMS credentials KaySetu sends on.

    Deliberately platform-level. Tenants do not configure or pay for delivery,
    so there is no per-tenant SMTP to fall back to — one account sends for
    everyone and Ops owns it. Secrets are write-only over the API.
    """

    # ── Email (SMTP)
    smtp_host = models.CharField(max_length=200, blank=True)
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_username = models.CharField(max_length=200, blank=True)
    smtp_password = models.CharField(max_length=500, blank=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)
    from_email = models.CharField(max_length=200, blank=True)
    from_name = models.CharField(max_length=120, blank=True)

    # ── SMS
    class SmsProvider(models.TextChoices):
        NONE = "", "Not configured"
        # The gateway the previous platform used — same account, same DLT
        # registrations, so nothing has to be re-approved to move across.
        SMSGATEWAYHUB = "smsgatewayhub", "SMSGatewayHub"
        MSG91 = "msg91", "MSG91"
        TEXTLOCAL = "textlocal", "Textlocal"
        GENERIC = "generic", "Generic HTTP (custom URL)"

    sms_provider = models.CharField(max_length=20, choices=SmsProvider.choices, blank=True)
    sms_api_key = models.CharField(max_length=500, blank=True)
    sms_sender_id = models.CharField(max_length=20, blank=True)
    sms_entity_id = models.CharField(max_length=64, blank=True)
    # Only for the GENERIC provider. Supports {phone} {text} {sender} {api_key}
    # {dlt_template_id} {entity_id} placeholders in the URL.
    sms_endpoint = models.CharField(max_length=500, blank=True)

    # ── Push (FCM)
    # The Firebase SERVICE ACCOUNT JSON, pasted whole. Not the old "server key":
    # Google shut the legacy FCM HTTP API down in June 2024, so a server key can
    # no longer send anything. Platform-level like the rest — KaySetu owns the
    # Firebase project and tenants neither configure nor pay for it.
    fcm_service_account = models.TextField(blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Platform messaging configuration"

    def email_ready(self):
        return bool(self.smtp_host and self.smtp_username and self.smtp_password)

    def sms_ready(self):
        # A key without a provider selected can't send anywhere, so reporting
        # "ready" would be a lie the Ops screen then shows as a green chip.
        return bool(self.sms_provider and self.sms_api_key and self.sms_entity_id)

    def push_ready(self):
        return bool(self.fcm_service_account)

    def __str__(self):
        return "Platform messaging configuration"

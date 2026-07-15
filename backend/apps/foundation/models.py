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
    is_system = models.BooleanField(default=False)
    # {"<MODULE_CODE>|*": ["<action>|*", ...]} — full matrix arrives with the permission UI.
    permissions = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.slug


class TenantUser(models.Model):
    """A user inside one tenant. Deliberately NOT Django's AUTH_USER_MODEL."""

    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    full_name = models.CharField(max_length=200)
    password = models.CharField(max_length=128)
    role = models.ForeignKey(Role, null=True, on_delete=models.SET_NULL, related_name="users")
    is_owner = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    last_login = models.DateTimeField(null=True, blank=True)
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
    gstin = models.CharField(max_length=15, blank=True)
    industry = models.CharField(max_length=32, default="generic")
    logo_url = models.URLField(blank=True)
    fy_start_month = models.PositiveSmallIntegerField(default=4)
    # Terminology dictionary — how THIS tenant names things (Product/Service/...).
    labels = models.JSONField(default=dict, blank=True)
    numbering = models.JSONField(default=dict, blank=True)
    working_hours = models.JSONField(default=dict, blank=True)
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
    """Generic business party — customer, supplier, or both."""

    class Kind(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        SUPPLIER = "supplier", "Supplier"
        BOTH = "both", "Customer & Supplier"

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.CUSTOMER)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    address = models.JSONField(default=dict, blank=True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Parties"

    def __str__(self):
        return self.name


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

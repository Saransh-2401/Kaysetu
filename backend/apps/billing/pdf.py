"""GST invoice PDF for a paid PaymentOrder (reportlab, A4).

Renders exclusively from the quote frozen in ``order.meta`` at checkout time,
so later package price changes never alter an issued invoice.
"""
from decimal import Decimal
from io import BytesIO

from django.conf import settings
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas

from .models import PaymentOrder

NAVY = colors.HexColor("#2C3E50")
GOLD = colors.HexColor("#B3A173")
GREY = colors.HexColor("#666666")


def invoice_number(order: PaymentOrder) -> str:
    year = (order.paid_at or order.created_at).strftime("%Y")
    return f"KSI-{year}-{order.pk:05d}"


def _money(value) -> str:
    return f"Rs. {Decimal(str(value)):,.2f}"


def build_invoice_pdf(order: PaymentOrder) -> bytes:
    buffer = BytesIO()
    page_width, _ = A4
    pdf = Canvas(buffer, pagesize=A4)
    left = 20 * mm
    right = page_width - 20 * mm
    y = 275 * mm

    # ---------------------------------------------------------------- header
    pdf.setFillColor(GOLD)
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(left, y, "KAYSETU")
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawRightString(right, y, "TAX INVOICE")
    y -= 7 * mm

    pdf.setFillColor(GREY)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(left, y, settings.BILLING["SELLER_NAME"])
    y -= 4.5 * mm
    pdf.drawString(left, y, settings.BILLING["SELLER_ADDRESS"])
    if settings.BILLING["SELLER_GSTIN"]:
        y -= 4.5 * mm
        pdf.drawString(left, y, f"GSTIN: {settings.BILLING['SELLER_GSTIN']}")
    y -= 4 * mm
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(1.2)
    pdf.line(left, y, right, y)
    y -= 8 * mm

    # ------------------------------------------------------- invoice + buyer
    tenant = order.tenant
    paid_on = (order.paid_at or order.created_at).strftime("%d %b %Y")
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left, y, "Billed to")
    pdf.drawRightString(right, y, f"Invoice {invoice_number(order)}")
    y -= 5 * mm
    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(left, y, tenant.name)
    pdf.setFillColor(GREY)
    pdf.drawRightString(right, y, f"Date: {paid_on}")
    y -= 5 * mm
    pdf.drawString(left, y, f"Org code: {tenant.org_code}")
    pdf.drawRightString(right, y, f"Payment ref: {order.gateway_payment_id or order.gateway_order_id or '-'}")
    y -= 5 * mm
    pdf.drawString(left, y, f"Email: {tenant.owner_email}")
    pdf.drawRightString(right, y, f"Status: {order.status.upper()}")
    y -= 10 * mm

    # ----------------------------------------------------------- line items
    quote = order.meta.get("quote", {})
    cycle_label = "year" if order.billing_cycle == "annual" else "month"
    included = quote.get("included_users", "")
    base = quote.get("base", order.subtotal)
    extra_users = int(quote.get("extra_users", 0) or 0)
    per_user_unit = quote.get("per_user_unit", "0")
    extra_amount = quote.get("extra_amount", "0")

    def row(label, amount, *, bold=False, small=""):
        nonlocal y
        pdf.setFillColor(colors.black if not bold else NAVY)
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", 10)
        pdf.drawString(left + 2 * mm, y, label)
        pdf.drawRightString(right - 2 * mm, y, amount)
        if small:
            y -= 4 * mm
            pdf.setFillColor(GREY)
            pdf.setFont("Helvetica", 8)
            pdf.drawString(left + 2 * mm, y, small)
        y -= 7 * mm

    pdf.setFillColor(NAVY)
    pdf.rect(left, y - 2 * mm, right - left, 8 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(left + 2 * mm, y, "Description")
    pdf.drawRightString(right - 2 * mm, y, "Amount")
    y -= 10 * mm

    row(
        f"{order.package.name} ({order.package.code}) — subscription / {cycle_label}",
        _money(base),
        small=f"Includes {included} user seats · billed {order.billing_cycle}",
    )
    if extra_users:
        row(
            f"Additional user seats × {extra_users}",
            _money(extra_amount),
            small=f"{_money(per_user_unit)} per user / {cycle_label}",
        )

    pdf.setStrokeColor(colors.HexColor("#DDDDDD"))
    pdf.setLineWidth(0.8)
    pdf.line(left, y + 3 * mm, right, y + 3 * mm)
    row("Subtotal", _money(order.subtotal))
    row(f"GST @ {quote.get('tax_rate', settings.BILLING['GST_RATE'])}%", _money(order.tax))
    pdf.setStrokeColor(GOLD)
    pdf.setLineWidth(1.2)
    pdf.line(left, y + 3 * mm, right, y + 3 * mm)
    row("TOTAL PAID", _money(order.total), bold=True)

    # ---------------------------------------------------------------- footer
    y -= 8 * mm
    pdf.setFillColor(GREY)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(left, y, f"Subscription: {order.seats} user seats · {order.billing_cycle} cycle.")
    y -= 4.5 * mm
    pdf.drawString(left, y, "This is a computer-generated invoice and does not require a signature.")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()

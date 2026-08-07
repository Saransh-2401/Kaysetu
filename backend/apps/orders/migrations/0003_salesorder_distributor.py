from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """Carry the distributor onto the back-office copy of a field order.

    The portal lists SalesOrders, so without this the attribution a secondary
    order was booked with vanishes the moment ORDERS picks the event up.
    """

    dependencies = [
        ("orders", "0002_salesorder_uniq_sales_order_per_field_order"),
        ("foundation", "0015_party_distributor"),
    ]

    operations = [
        migrations.AddField(
            model_name="salesorder",
            name="distributor",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="distributed_sales_orders", to="foundation.party",
            ),
        ),
    ]

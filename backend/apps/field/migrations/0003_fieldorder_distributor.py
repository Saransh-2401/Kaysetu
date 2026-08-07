from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """The distributor a secondary order is booked for.

    PROTECT rather than SET_NULL: an order that quietly lost its distributor
    would silently drop out of that distributor's sales, so deleting a
    distributor with orders against it must fail loudly instead.
    """

    dependencies = [
        ("field", "0002_alter_collection_options_and_more"),
        ("foundation", "0015_party_distributor"),
    ]

    operations = [
        migrations.AddField(
            model_name="fieldorder",
            name="distributor",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="secondary_orders", to="foundation.party",
            ),
        ),
    ]

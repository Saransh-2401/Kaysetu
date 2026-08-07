from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """Which distributor serves a retailer.

    Restores the primary-vs-secondary link the previous platform had as
    `Customer.distributor`; without it a secondary order can be recorded but
    never attributed to whoever fulfils it.
    """

    dependencies = [
        ("foundation", "0014_seed_otp_templates"),
    ]

    operations = [
        migrations.AddField(
            model_name="party",
            name="distributor",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="retailers", to="foundation.party",
            ),
        ),
    ]

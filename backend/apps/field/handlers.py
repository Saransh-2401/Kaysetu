"""
Event subscriptions FIELD sets up. FIELD is mainly a producer/provider; it
subscribes to nothing today (ORDERS/BOOKS will subscribe to FIELD's events when
those modules land). Kept for symmetry and future consumers.
"""


def register_all():
    # from apps.foundation.integration import events
    # events.subscribe("...", handler)
    pass

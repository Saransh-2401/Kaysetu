"""
Capabilities BOOKS provides. Other modules read a party's finance position
WITHOUT importing BOOKS; the registry gates each call on the BOOKS entitlement.
"""


def _party_ledger(party_id, from_date=None, to_date=None):
    from .services import party_ledger

    return party_ledger(party_id, from_date, to_date)


def _party_balance(party_id):
    from .services import party_balance

    return party_balance(party_id)


def register_all():
    from apps.foundation.integration import capabilities

    capabilities.provide("books.party_ledger", "BOOKS", _party_ledger)
    capabilities.provide("books.party_balance", "BOOKS", _party_balance)

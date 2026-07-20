"""
SALES subscribes to nothing today — it is the document layer, so it emits
(`sales.invoice_issued`, `sales.payment_recorded`, `sales.adjustment_created`)
and lets BOOKS decide whether to post. Kept as an explicit, empty module so the
seam is visible: a future module wanting to react to an invoice being raised
subscribes here rather than importing SALES.
"""

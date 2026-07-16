"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Box, Typography,
    Stack, TextField, MenuItem, Button, Autocomplete, Grid, Divider, CircularProgress,
    Table, TableBody, TableCell, TableHead, TableRow, Tooltip, useTheme, alpha,
} from "@mui/material";
import { CloseIcon, AddIcon, DeleteOutlineIcon } from "@/components/icons";
import { purchaseService, Supplier } from "@/lib/purchase-service";
import { warehouseService, Item } from "@/lib/warehouse-service";

interface LineItem {
    item: number | null;
    item_name?: string;
    quantity: number;
    rate: number;
    gst: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onCreated: (poNumber: string) => void;
    prefill?: { supplier?: number; items?: LineItem[] } | null;
}

const emptyLine = (): LineItem => ({ item: null, quantity: 1, rate: 0, gst: 18 });

export default function PurchaseOrderFormModal({ open, onClose, onCreated, prefill }: Props) {
    const theme = useTheme();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [items, setItems] = useState<Item[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [supplierId, setSupplierId] = useState<number | null>(null);
    const [taxType, setTaxType] = useState<"cgst_sgst" | "igst">("cgst_sgst");
    const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
    const [deliveryDate, setDeliveryDate] = useState("");
    const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

    useEffect(() => {
        if (!open) return;
        setLoadingData(true);
        Promise.all([
            purchaseService.getSuppliers({ page_size: "1000" }),
            warehouseService.getItems({ page_size: "1000", is_active: "true", status: "active" }),
        ])
            .then(([sup, it]) => {
                setSuppliers(sup.results || []);
                setItems(it.results || []);
            })
            .catch((e) => console.error("Failed to load PO form data:", e))
            .finally(() => setLoadingData(false));
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setSupplierId(prefill?.supplier ?? null);
        setLines(prefill?.items && prefill.items.length ? prefill.items.map((l) => ({ ...l })) : [emptyLine()]);
        setTaxType("cgst_sgst");
        setOrderDate(new Date().toISOString().split("T")[0]);
        setDeliveryDate("");
    }, [open, prefill]);

    const updateLine = (idx: number, patch: Partial<LineItem>) =>
        setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

    const totals = useMemo(() => {
        let subtotal = 0, tax = 0;
        for (const l of lines) {
            const amount = (Number(l.quantity) || 0) * (Number(l.rate) || 0);
            subtotal += amount;
            tax += amount * ((Number(l.gst) || 0) / 100);
        }
        return { subtotal, tax, total: subtotal + tax };
    }, [lines]);

    const handleSave = async () => {
        setError(null);
        if (!supplierId) { setError("Please select a supplier."); return; }
        const validLines = lines.filter((l) => l.item && Number(l.quantity) > 0);
        if (!validLines.length) { setError("Add at least one line item with a product and quantity."); return; }
        try {
            setSaving(true);
            const payload = {
                supplier: supplierId,
                tax_type: taxType,
                order_date: orderDate,
                delivery_date: deliveryDate || undefined,
                items: validLines.map((l) => ({
                    item: l.item as number,
                    quantity: Number(l.quantity),
                    rate: Number(l.rate),
                    cgst_rate: taxType === "cgst_sgst" ? (Number(l.gst) || 0) / 2 : 0,
                    sgst_rate: taxType === "cgst_sgst" ? (Number(l.gst) || 0) / 2 : 0,
                    igst_rate: taxType === "igst" ? (Number(l.gst) || 0) : 0,
                })),
            };
            const po = await purchaseService.createDirectPurchaseOrder(payload);
            onCreated(po.po_number);
            onClose();
        } catch (e: any) {
            setError(e?.message || e?.details?.error || "Failed to create purchase order.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
            <DialogTitle sx={{ fontWeight: 800, pr: 6 }}>
                Create Purchase Order
                <IconButton onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers data-testid="po-create-form">
                {loadingData ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>
                ) : (
                    <Stack spacing={2.5}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Autocomplete
                                    options={suppliers}
                                    getOptionLabel={(o) => `${o.supplier_name}${o.supplier_code ? ` (${o.supplier_code})` : ""}`}
                                    value={suppliers.find((s) => s.id === supplierId) || null}
                                    onChange={(_, v) => setSupplierId(v ? v.id : null)}
                                    renderInput={(p) => <TextField {...p} label="Supplier *" data-testid="po-supplier-input" />}
                                />
                            </Grid>
                            <Grid size={{ xs: 6, md: 2 }}>
                                <TextField select fullWidth label="Tax Type" value={taxType} onChange={(e) => setTaxType(e.target.value as any)} data-testid="po-taxtype-select">
                                    <MenuItem value="cgst_sgst">CGST+SGST</MenuItem>
                                    <MenuItem value="igst">IGST</MenuItem>
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 6, md: 2 }}>
                                <TextField fullWidth type="date" label="Order Date" InputLabelProps={{ shrink: true }} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 6, md: 2 }}>
                                <TextField fullWidth type="date" label="Delivery Date" InputLabelProps={{ shrink: true }} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                            </Grid>
                        </Grid>

                        <Box>
                            <Typography variant="subtitle2" fontWeight={800} mb={1}>Line Items</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ width: "40%" }}>Product</TableCell>
                                        <TableCell align="right">Qty</TableCell>
                                        <TableCell align="right">Rate</TableCell>
                                        <TableCell align="right">GST %</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {lines.map((line, idx) => {
                                        const amount = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
                                        return (
                                            <TableRow key={idx} data-testid={`po-line-row-${idx}`}>
                                                <TableCell>
                                                    <Autocomplete
                                                        options={items}
                                                        size="small"
                                                        getOptionLabel={(o) => `${o.item_name} (${o.item_code})`}
                                                        value={items.find((it) => it.id === line.item) || null}
                                                        onChange={(_, v) => updateLine(idx, { item: v ? v.id : null, item_name: v?.item_name, rate: v?.standard_rate ?? line.rate })}
                                                        renderInput={(p) => <TextField {...p} placeholder="Select item" data-testid={`po-line-item-${idx}`} />}
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <TextField type="number" size="small" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })} sx={{ width: 70 }} inputProps={{ "data-testid": `po-line-qty-${idx}` }} />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <TextField type="number" size="small" value={line.rate} onChange={(e) => updateLine(idx, { rate: parseFloat(e.target.value) || 0 })} sx={{ width: 90 }} inputProps={{ "data-testid": `po-line-rate-${idx}` }} />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <TextField type="number" size="small" value={line.gst} onChange={(e) => updateLine(idx, { gst: parseFloat(e.target.value) || 0 })} sx={{ width: 70 }} />
                                                </TableCell>
                                                <TableCell align="right">₹{amount.toLocaleString("en-IN")}</TableCell>
                                                <TableCell>
                                                    <Tooltip title="Remove">
                                                        <span>
                                                            <IconButton size="small" disabled={lines.length === 1} onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                                                                <DeleteOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <Button startIcon={<AddIcon />} onClick={() => setLines((prev) => [...prev, emptyLine()])} sx={{ mt: 1, textTransform: "none" }} data-testid="po-add-line-btn">
                                Add Item
                            </Button>
                        </Box>

                        <Divider />
                        <Stack alignItems="flex-end" spacing={0.5}>
                            <Typography variant="body2">Subtotal: <b>₹{totals.subtotal.toLocaleString("en-IN")}</b></Typography>
                            <Typography variant="body2">Tax: <b>₹{totals.tax.toLocaleString("en-IN")}</b></Typography>
                            <Typography variant="h6" fontWeight={800}>Total: ₹{totals.total.toLocaleString("en-IN")}</Typography>
                        </Stack>

                        {error && <Typography color="error" variant="body2" data-testid="po-form-error">{error}</Typography>}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} color="inherit" sx={{ textTransform: "none" }}>Cancel</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving || loadingData} data-testid="po-create-submit-btn" sx={{ textTransform: "none", fontWeight: 700, bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" } }}>
                    {saving ? <CircularProgress size={22} color="inherit" /> : "Create Purchase Order"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

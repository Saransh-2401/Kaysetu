"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Box, Typography, Button, Stack, TextField, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, Grid, useTheme, alpha,
    CircularProgress, Divider, ToggleButtonGroup, ToggleButton, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    InputAdornment, Switch, FormControlLabel
} from "@mui/material";
import { CloseIcon, ReceiptIcon, PercentIcon, CurrencyRupeeIcon, AddIcon, RemoveIcon } from "@/components/icons";

import { salesService, SalesOrder } from "@/lib/sales-service";
import { mastersService, TaxSlab } from "@/lib/masters-service";
import { formatDRFError } from "@/lib/utils";

interface SalesInvoiceModalProps {
    open: boolean;
    onClose: () => void;
    order: SalesOrder | null;
    onSuccess: () => void;
}

interface InvoiceItem {
    product?: number;
    item?: number;
    product_name: string;
    hsn_code: string;
    quantity: number;
    unit_price: number;
    taxable_value: number;
    cgst_rate: number;
    sgst_rate: number;
    igst_rate: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    price_includes_tax: boolean;
    tax_rate: number;
    total: number;
}

export default function SalesInvoiceModal({ open, onClose, order, onSuccess }: SalesInvoiceModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);

    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [gstType, setGstType] = useState<'cgst-sgst' | 'igst'>('cgst-sgst');
    const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
    const [discountValue, setDiscountValue] = useState(0);
    const [invoiceNotes, setInvoiceNotes] = useState("");
    const [items, setItems] = useState<InvoiceItem[]>([]);

    const fetchTaxSlabs = async () => {
        try {
            // Only active tax slabs apply to new invoices; deactivated ones are excluded.
            const taxesData = await mastersService.getTaxSlabs({ is_active: "true" });
            setTaxSlabs(taxesData.results || []);
        } catch (error) {
            console.error("Error fetching tax slabs:", error);
        }
    };

    const findTaxRate = (hsn: string) => {
        if (!hsn) return 0;
        const slab = taxSlabs.find(s => s.hsn_codes.includes(hsn));
        return slab ? slab.percentage : 0;
    };

    const calculateItemTotals = (item: InvoiceItem): InvoiceItem => {
        const qty = Number(item.quantity) || 0;
        const unitPrice = Number(item.unit_price) || 0;

        let taxableValue = 0;
        let cgstAmt = 0, sgstAmt = 0, igstAmt = 0;
        let total = 0;

        const cgstRate = Number(item.cgst_rate) || 0;
        const sgstRate = Number(item.sgst_rate) || 0;
        const igstRate = Number(item.igst_rate) || 0;
        const totalTaxRate = cgstRate + sgstRate + igstRate;

        if (item.price_includes_tax) {
            total = Math.round(qty * unitPrice * 100) / 100;
            taxableValue = Math.round(total / (1 + totalTaxRate / 100) * 100) / 100;
            const totalTax = Math.round((total - taxableValue) * 100) / 100;

            if (totalTaxRate > 0) {
                // Determine split ratio
                const cgstRatio = cgstRate / totalTaxRate;
                const sgstRatio = sgstRate / totalTaxRate;
                const igstRatio = igstRate / totalTaxRate;

                // We need to ensure that the sum of parts exactly matches the Total Tax
                // to avoid the 0.01 discrepancy (e.g. 122.03 vs 122.04).
                const totalTaxRounded = parseFloat(totalTax.toFixed(2));

                if (igstRate > 0) {
                    igstAmt = totalTaxRounded;
                } else {
                    // Split between CGST and SGST
                    // We calculate one part first, round it, and the other is the remainder.
                    cgstAmt = parseFloat((totalTaxRounded * cgstRatio).toFixed(2));
                    sgstAmt = totalTaxRounded - cgstAmt;
                }
            }
        } else {
            taxableValue = Math.round(qty * unitPrice * 100) / 100;
            cgstAmt = Math.round(taxableValue * (cgstRate / 100) * 100) / 100;
            sgstAmt = Math.round(taxableValue * (sgstRate / 100) * 100) / 100;
            igstAmt = Math.round(taxableValue * (igstRate / 100) * 100) / 100;
            total = Math.round((taxableValue + cgstAmt + sgstAmt + igstAmt) * 100) / 100;
        }

        return {
            ...item,
            taxable_value: parseFloat(taxableValue.toFixed(2)),
            cgst_amount: parseFloat(cgstAmt.toFixed(2)),
            sgst_amount: parseFloat(sgstAmt.toFixed(2)),
            igst_amount: parseFloat(igstAmt.toFixed(2)),
            total: parseFloat(total.toFixed(2))
        };
    };

    const totals = useMemo(() => {
        const subtotal = items.reduce((acc, item) => acc + Number(item.taxable_value || 0), 0);
        const tax = items.reduce((acc, item) =>
            acc + Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) +
            Number(item.igst_amount || 0), 0
        );

        const totalBeforeDiscount = Math.round((subtotal + tax) * 100) / 100;
        let discountAmount = 0;
        if (discountType === 'percentage') {
            discountAmount = Math.round(totalBeforeDiscount * (Number(discountValue) / 100) * 100) / 100;
        } else {
            discountAmount = Number(discountValue);
        }

        // Rule: Discount should not exceed Grand Total
        // This means Discount <= TotalBefore - Discount => 2*Discount <= TotalBefore
        // However, user might just mean it shouldn't be more than what's available.
        // But the specific request says "should not exceed Grand Total".
        // Let's implement the logic: if 2*Discount > TotalBefore, we might have an issue.
        // Actually, let's just ensure grandTotal doesn't go below the discount amount if that's the literal rule.
        // But usually it's simpler: GrandTotal = TotalBefore - Discount.
        // If Discount > GrandTotal, then Discount > (TotalBefore - Discount) => 2*Discount > TotalBefore.

        const grandTotal = Math.max(0, totalBeforeDiscount - discountAmount);
        const payableAmount = grandTotal;

        const cgstAmount = items.reduce((acc, item) => acc + Number(item.cgst_amount || 0), 0);
        const sgstAmount = items.reduce((acc, item) => acc + Number(item.sgst_amount || 0), 0);
        const igstAmount = items.reduce((acc, item) => acc + Number(item.igst_amount || 0), 0);

        return {
            subtotal: parseFloat(subtotal.toFixed(2)),
            tax: parseFloat(tax.toFixed(2)),
            cgstAmount: parseFloat(cgstAmount.toFixed(2)),
            sgstAmount: parseFloat(sgstAmount.toFixed(2)),
            igstAmount: parseFloat(igstAmount.toFixed(2)),
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            totalBeforeDiscount: parseFloat(totalBeforeDiscount.toFixed(2)),
            grandTotal: parseFloat(grandTotal.toFixed(2)),
            payableAmount: parseFloat(payableAmount.toFixed(2))
        };
    }, [items, discountType, discountValue, order]);

    useEffect(() => {
        if (open && order) {
            setLoading(false);
            setInvoiceDate(new Date().toISOString().split('T')[0]);
            setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            setDiscountType('amount');
            setDiscountValue(0);
            setInvoiceNotes("");
            // Default GST Type based on state later if needed, for now standard
            fetchTaxSlabs();
        }
    }, [open, order]);

    useEffect(() => {
        if (open && order && taxSlabs.length > 0) {
            console.log("Order items for invoice:", order.items);
            const preparedItems = (order.items || []).map(item => {
                const hsn = (item as any).hsn_code || '';
                // Prioritize saved order rate, then current product tax rate from Product Form, finally HSN fallback
                const taxRate = item.tax_percentage !== undefined
                    ? Number(item.tax_percentage)
                    : (item.product_tax_rate !== undefined ? Number(item.product_tax_rate) : findTaxRate(hsn));
                const isInclusive = (item as any).price_includes_tax || false;
                const rawRate = Number(item.rate) || 0;
                // If tax is inclusive, base rate in DB is exclusive. We need to show the inclusive price in the UI.
                const initialUnitPrice = isInclusive
                    ? parseFloat((rawRate * (1 + taxRate / 100)).toFixed(2))
                    : rawRate;

                const isIGST = gstType === 'igst';

                const newItem: InvoiceItem = {
                    product: item.product,
                    item: item.item,
                    product_name: (item as any).item_name || (item as any).product_name || '',
                    hsn_code: hsn,
                    quantity: Math.floor(Number(item.quantity) || 0),
                    unit_price: initialUnitPrice,
                    taxable_value: 0,
                    cgst_rate: isIGST ? 0 : taxRate / 2,
                    sgst_rate: isIGST ? 0 : taxRate / 2,
                    igst_rate: isIGST ? taxRate : 0,
                    cgst_amount: 0,
                    sgst_amount: 0,
                    igst_amount: 0,
                    total: 0,
                    tax_rate: taxRate,
                    price_includes_tax: isInclusive
                };
                return calculateItemTotals(newItem);
            });
            setItems(preparedItems);
        }
    }, [open, order, taxSlabs, gstType]);

    const handleGstTypeChange = (newType: 'cgst-sgst' | 'igst') => {
        setGstType(newType);
        setItems(prev => prev.map(item => {
            // Use the preserved tax_rate instead of refetching from HSN tables
            const taxRate = item.tax_rate;
            const isIGST = newType === 'igst';
            return calculateItemTotals({
                ...item,
                cgst_rate: isIGST ? 0 : taxRate / 2,
                sgst_rate: isIGST ? 0 : taxRate / 2,
                igst_rate: isIGST ? taxRate : 0,
            });
        }));
    };


    const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        let val = value;
        if (field === 'quantity') {
            val = Math.floor(Number(value)) || 0;
        }
        let updatedItem = { ...newItems[index], [field]: val };

        // Sync CGST and SGST and update effective tax_rate
        if (field === 'cgst_rate') {
            updatedItem.sgst_rate = value;
            updatedItem.tax_rate = Number(value) * 2;
        } else if (field === 'sgst_rate') {
            updatedItem.cgst_rate = value;
            updatedItem.tax_rate = Number(value) * 2;
        } else if (field === 'igst_rate') {
            updatedItem.tax_rate = Number(value);
        }

        newItems[index] = calculateItemTotals(updatedItem);
        setItems(newItems);
    };

    const handleSubmit = async () => {
        if (!order) return;

        // Validation
        if (items.length === 0) {
            alert("No items found to generate invoice.");
            return;
        }

        for (const item of items) {
            if (Number(item.quantity) <= 0) {
                alert(`Quantity must be greater than 0 for item: ${item.product_name}`);
                return;
            }
            if (Number(item.unit_price) < 0) {
                alert(`Unit price cannot be negative for item: ${item.product_name}`);
                return;
            }
        }

        if (totals.discountAmount > totals.totalBeforeDiscount) {
            alert("Discount amount cannot exceed the total amount (Subtotal + Tax).");
            return;
        }

        setLoading(true);
        try {
            const data = {
                invoice_date: invoiceDate,
                due_date: dueDate,
                tax_input_mode: 'percentage',
                discount_type: discountType,
                discount_value: Number(discountValue) || 0,
                discount_amount: totals.discountAmount,
                subtotal: totals.subtotal,
                tax_amount: totals.tax,
                total: totals.grandTotal,
                notes: invoiceNotes,
                items: items.map(item => ({
                    product: item.product,
                    product_name: item.product_name,
                    item: item.item,
                    quantity: item.quantity,
                    rate: item.unit_price,
                    amount: item.taxable_value,
                    taxable_value: item.taxable_value,
                    hsn_code: item.hsn_code,
                    tax_amount: item.cgst_amount + item.sgst_amount + item.igst_amount,
                    total_price: item.total,
                    cgst_rate: item.cgst_rate,
                    sgst_rate: item.sgst_rate,
                    igst_rate: item.igst_rate,
                    cgst_amount: item.cgst_amount,
                    sgst_amount: item.sgst_amount,
                    igst_amount: item.igst_amount
                }))
            };

            await salesService.generateOrderInvoice(order.id, data);
            onSuccess();
            onClose();
        } catch (error: any) {
            alert(formatDRFError(error.response?.data || error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
            <DialogTitle sx={{ bgcolor: alpha(theme.palette.grey[100], 0.5), pb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                        <Typography variant="h6" fontWeight={700}>Generate Sales Invoice</Typography>
                        <Typography variant="caption" color="text.secondary">
                            Request: {order?.order_number} • Customer: {order?.customer_name}
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Grid container spacing={2.5}>
                    {/* Header Section */}
                    <Grid size={12}>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: alpha(theme.palette.grey[50], 0.5) }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                                    <TextField
                                        fullWidth
                                        label="Invoice Date"
                                        type="date"
                                        size="small"
                                        value={invoiceDate}
                                        onChange={(e) => setInvoiceDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                                    <TextField
                                        fullWidth
                                        label="Due Date"
                                        type="date"
                                        size="small"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        inputProps={{ min: invoiceDate }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <ToggleButtonGroup
                                        fullWidth
                                        size="small"
                                        value={gstType}
                                        exclusive
                                        onChange={(_, v) => v && handleGstTypeChange(v)}
                                        sx={{ height: 40 }}
                                    >
                                        <ToggleButton value="cgst-sgst">CGST/SGST</ToggleButton>
                                        <ToggleButton value="igst">IGST</ToggleButton>
                                    </ToggleButtonGroup>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    {/* Per-item tax inclusion from Product Master */}
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Items Table */}
                    <Grid size={12}>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                            <Table size="small">
                                <TableHead sx={{ bgcolor: alpha(theme.palette.grey[200], 0.6) }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Product</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Qty</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Unit Price</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Taxable</TableCell>
                                        {gstType === 'cgst-sgst' ? (
                                            <>
                                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>CGST %</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>SGST %</TableCell>
                                            </>
                                        ) : (
                                            <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>IGST %</TableCell>
                                        )}
                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Total</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {items.map((item, idx) => (
                                        <TableRow key={idx} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                                                    {item.product_name}
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block' }}>
                                                    HSN: {item.hsn_code || '-'} • {item.price_includes_tax ? 'Incl. Tax' : 'Excl. Tax'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Typography variant="body2" fontWeight={700} color="text.secondary">
                                                    {Math.floor(item.quantity)}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                                    {item.unit_price}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>₹{item.taxable_value}</Typography>
                                            </TableCell>
                                            {gstType === 'cgst-sgst' ? (
                                                <>
                                                    <TableCell align="center">
                                                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                                            {item.cgst_rate}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                                            {item.sgst_rate}
                                                        </Typography>
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <TableCell align="center">
                                                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                                        {item.igst_rate}
                                                    </Typography>
                                                </TableCell>
                                            )}
                                            <TableCell align="right">
                                                <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem' }}>
                                                    ₹{item.total}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>

                    {/* Notes and Totals */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Invoice Notes"
                            placeholder="Enter terms, conditions, payment instructions..."
                            value={invoiceNotes}
                            onChange={(e) => setInvoiceNotes(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, mb: 2 }}
                        />
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), border: `1px dashed ${theme.palette.primary.main}` }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography variant="caption" fontWeight={700} color="primary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Payable Amount
                                    </Typography>
                                    <Typography variant="h4" fontWeight={900} color="primary">
                                        ₹{totals.payableAmount.toLocaleString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        (Grand Total - Advance Paid)
                                    </Typography>
                                </Box>
                                <CurrencyRupeeIcon sx={{ fontSize: 40, opacity: 0.1, color: theme.palette.primary.main }} />
                            </Box>
                        </Paper>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: alpha(theme.palette.grey[50], 0.3) }}>
                            <Stack spacing={1.5}>
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                                    <Typography variant="body2" fontWeight={600}>₹{totals.subtotal}</Typography>
                                </Box>
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Tax</Typography>
                                    <Typography variant="body2" fontWeight={600}>₹{totals.tax}</Typography>
                                </Box>
                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2" color="text.secondary">Advance Paid</Typography>
                                    <Typography variant="body2" fontWeight={600} color="success.main">₹{order?.advance_amount || 0}</Typography>
                                </Box>
                                <Divider />
                                <Box>
                                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                                        <Typography variant="body2" color="text.secondary">Discount</Typography>
                                        <ToggleButtonGroup
                                            size="small"
                                            value={discountType}
                                            exclusive
                                            onChange={(_, v) => v && setDiscountType(v)}
                                            sx={{ height: 24 }}
                                        >
                                            <ToggleButton value="amount" sx={{ px: 1, py: 0.5 }}>
                                                <CurrencyRupeeIcon sx={{ fontSize: 14 }} />
                                            </ToggleButton>
                                            <ToggleButton value="percentage" sx={{ px: 1, py: 0.5 }}>
                                                <PercentIcon sx={{ fontSize: 14 }} />
                                            </ToggleButton>
                                        </ToggleButtonGroup>
                                    </Stack>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        type="number"
                                        value={discountValue}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setDiscountValue(val);
                                        }}
                                        error={totals.discountAmount > totals.totalBeforeDiscount}
                                        helperText={totals.discountAmount > totals.totalBeforeDiscount ? "Discount exceeds total amount" : ""}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    {discountType === 'amount' ? '₹' : '%'}
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                                    />
                                </Box>
                                <Divider />
                                <Box display="flex" justifyContent="space-between" alignItems="center" pt={1}>
                                    <Typography variant="subtitle1" fontWeight={800} color="primary">
                                        Grand Total
                                    </Typography>
                                    <Typography variant="h5" fontWeight={900} color="primary">
                                        ₹{totals.grandTotal}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2.5, bgcolor: alpha(theme.palette.grey[50], 0.3) }}>
                <Button onClick={onClose} color="inherit" sx={{ borderRadius: 2 }}>Cancel</Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={loading || totals.discountAmount > totals.totalBeforeDiscount || items.length === 0 || totals.payableAmount === 0}
                    startIcon={loading ? <CircularProgress size={20} /> : <ReceiptIcon />}
                    sx={{ borderRadius: 2, px: 3 }}
                >
                    Generate Invoice
                </Button>
            </DialogActions>
        </Dialog>
    );
}

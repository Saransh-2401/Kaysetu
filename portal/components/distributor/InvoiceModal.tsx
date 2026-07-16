"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Box, Typography, Button, Stack, TextField, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, Grid, useTheme, alpha,
    CircularProgress, Divider, FormControlLabel, Switch, ToggleButtonGroup,
    ToggleButton, Alert, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, InputAdornment, Snackbar
} from "@mui/material";
import { CloseIcon, ReceiptIcon, PercentIcon, CurrencyRupeeIcon, DeleteIcon } from "@/components/icons";

import { distributorService, StockRequest, StockRequestInvoiceItem, Product } from "@/lib/distributor-service";
import { mastersService, TaxSlab } from "@/lib/masters-service";
import { formatDRFError } from "@/lib/utils";

interface InvoiceModalProps {
    open: boolean;
    onClose: () => void;
    request: StockRequest | null;
    initialTrigger?: 'stock_request' | 'backorder';
    onSuccess: () => void;
    userRole: string;
}

export default function InvoiceModal({ open, onClose, request, initialTrigger = 'stock_request', onSuccess, userRole }: InvoiceModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);

    const [invoiceHeader, setInvoiceHeader] = useState({
        id: null as number | null,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isTaxInclusive: false,
        discountType: 'amount' as 'amount' | 'percentage',
        discountValue: 0,
        gstType: 'cgst-sgst' as 'cgst-sgst' | 'igst',
        taxInputMode: 'percentage' as 'percentage' | 'rupee',
        invoiceType: 'full' as 'partial' | 'full' | 'shortage_only',
        paymentStatus: 'unpaid' as string,
        paymentReference: '',
        forcedShortage: false,
        triggeredFrom: initialTrigger
    });

    const [invoiceItems, setInvoiceItems] = useState<StockRequestInvoiceItem[]>([]);
    const [invoiceNotes, setInvoiceNotes] = useState("");
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' as 'success' | 'warning' | 'error' | 'info' });

    const fetchData = async () => {
        try {
            const [taxesData, productsData] = await Promise.all([
                // Only active tax slabs apply to new invoices; deactivated ones are excluded.
                mastersService.getTaxSlabs({ is_active: "true" }),
                distributorService.getProductMaster()
            ]);
            setTaxSlabs(taxesData.results || []);
            setAllProducts(productsData);
        } catch (error) {
            console.error("Error fetching invoice data:", error);
        }
    };

    const findTaxRate = (hsn: string, slabs: TaxSlab[]) => {
        if (!hsn) return 0;
        const slab = slabs.find(s => s.hsn_codes.includes(hsn));
        return slab ? slab.percentage : 0;
    };

    const calculateRow = (item: StockRequestInvoiceItem, header: typeof invoiceHeader) => {
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.unit_price) || 0;
        const isTaxInclusive = header.isTaxInclusive;
        const taxInputMode = header.taxInputMode;

        let taxableValue = 0;
        let cgstAmount = Number(item.cgst_amount) || 0;
        let sgstAmount = Number(item.sgst_amount) || 0;
        let igstAmount = Number(item.igst_amount) || 0;
        let cessAmount = Number(item.cess_amount) || 0;
        let totalPrice = 0;

        const cgstRate = Number(item.cgst_rate) || 0;
        const sgstRate = Number(item.sgst_rate) || 0;
        const igstRate = Number(item.igst_rate) || 0;
        const cessRate = Number(item.cess_rate) || 0;
        const totalTaxRate = cgstRate + sgstRate + igstRate + cessRate;

        if (taxInputMode === 'percentage') {
            if (isTaxInclusive) {
                totalPrice = Math.round(qty * rate * 100) / 100;
                taxableValue = Math.round(totalPrice / (1 + totalTaxRate / 100) * 100) / 100;
                const totalTax = Math.round((totalPrice - taxableValue) * 100) / 100;

                if (totalTaxRate > 0) {
                    cgstAmount = Math.round(totalTax * (cgstRate / totalTaxRate) * 100) / 100;
                    sgstAmount = Math.round(totalTax * (sgstRate / totalTaxRate) * 100) / 100;
                    igstAmount = Math.round(totalTax * (igstRate / totalTaxRate) * 100) / 100;
                    cessAmount = Math.round(totalTax * (cessRate / totalTaxRate) * 100) / 100;
                }
            } else {
                taxableValue = Math.round(qty * rate * 100) / 100;
                cgstAmount = Math.round(taxableValue * (cgstRate / 100) * 100) / 100;
                sgstAmount = Math.round(taxableValue * (sgstRate / 100) * 100) / 100;
                igstAmount = Math.round(taxableValue * (igstRate / 100) * 100) / 100;
                cessAmount = Math.round(taxableValue * (cessRate / 100) * 100) / 100;
                totalPrice = Math.round((taxableValue + cgstAmount + sgstAmount + igstAmount + cessAmount) * 100) / 100;
            }
        } else {
            if (isTaxInclusive) {
                totalPrice = Math.round(qty * rate * 100) / 100;
                cgstAmount = Number(item.cgst_amount) || 0;
                sgstAmount = Number(item.sgst_amount) || 0;
                igstAmount = Number(item.igst_amount) || 0;
                cessAmount = Number(item.cess_amount) || 0;
                taxableValue = Math.round((totalPrice - (cgstAmount + sgstAmount + igstAmount + cessAmount)) * 100) / 100;
            } else {
                taxableValue = Math.round(qty * rate * 100) / 100;
                cgstAmount = Number(item.cgst_amount) || 0;
                sgstAmount = Number(item.sgst_amount) || 0;
                igstAmount = Number(item.igst_amount) || 0;
                cessAmount = Number(item.cess_amount) || 0;
                totalPrice = Math.round((taxableValue + cgstAmount + sgstAmount + igstAmount + cessAmount) * 100) / 100;
            }
        }

        return {
            ...item,
            taxable_value: parseFloat(taxableValue.toFixed(2)),
            cgst_amount: parseFloat(cgstAmount.toFixed(2)),
            sgst_amount: parseFloat(sgstAmount.toFixed(2)),
            igst_amount: parseFloat(igstAmount.toFixed(2)),
            cess_amount: parseFloat(cessAmount.toFixed(2)),
            total_price: parseFloat(totalPrice.toFixed(2))
        };
    };

    const prepareInvoiceItems = (req: StockRequest, header: any, slabs: TaxSlab[], products: Product[]) => {
        if (!req) return [];
        const items: any[] = [];
        const isIGST = header.gstType === 'igst';

        // Map to merge regular items and shortages if they are for the same product
        const productMap = new Map();

        // 1. Add regular approved items
        (req.items || []).forEach(item => {
            const taxRate = findTaxRate(item.hsn_code || '', slabs);
            const qty = Number(item.approved_quantity) || 0;
            if (qty <= 0) return;

            productMap.set(item.product, {
                product: item.product,
                product_name: item.product_name,
                quantity: qty,
                unit_price: Number(item.unit_price) || 0,
                hsn_code: item.hsn_code || '',
                product_tax_rate: item.product_tax_rate,
                cgst_rate: isIGST ? 0 : (item.product_tax_rate !== undefined ? Number(item.product_tax_rate) : taxRate) / 2,
                sgst_rate: isIGST ? 0 : (item.product_tax_rate !== undefined ? Number(item.product_tax_rate) : taxRate) / 2,
                igst_rate: isIGST ? (item.product_tax_rate !== undefined ? Number(item.product_tax_rate) : taxRate) : 0,
                cess_rate: 0,
                cgst_amount: 0, sgst_amount: 0, igst_amount: 0, cess_amount: 0,
                taxable_value: 0, total_price: 0
            });
        });

        // 2. Add shortages (backorders)
        const shortages = (req.shortages || []).filter(s => {
            if (s.status === 'cancelled') return false;
            // Include shortages that are either already on this invoice, OR not invoiced yet
            return (header.id && s.invoice === header.id) || !s.is_invoiced || header._isRefreshing;
        });

        shortages.forEach(s => {
            const prod = products.find(p => p.id === s.product);
            const taxRate = findTaxRate(s.product_hsn || prod?.hsn_code || '', slabs);
            const sQty = Number(s.shortage_quantity) || 0;
            if (sQty <= 0) return;

            if (productMap.has(s.product)) {
                const existing = productMap.get(s.product);
                existing.quantity += sQty;
                existing.shortage_id = s.id;
            } else {
                productMap.set(s.product, {
                    product: s.product,
                    product_name: s.product_name,
                    quantity: sQty,
                    unit_price: Number(prod?.selling_price) || 0,
                    hsn_code: s.product_hsn || prod?.hsn_code || '',
                    product_tax_rate: s.product_tax_rate,
                    shortage_id: s.id,
                    cgst_rate: isIGST ? 0 : (s.product_tax_rate !== undefined ? Number(s.product_tax_rate) : taxRate) / 2,
                    sgst_rate: isIGST ? 0 : (s.product_tax_rate !== undefined ? Number(s.product_tax_rate) : taxRate) / 2,
                    igst_rate: isIGST ? (s.product_tax_rate !== undefined ? Number(s.product_tax_rate) : taxRate) : 0,
                    cess_rate: 0,
                    cgst_amount: 0, sgst_amount: 0, igst_amount: 0, cess_amount: 0,
                    taxable_value: 0, total_price: 0
                });
            }
        });

        productMap.forEach(item => {
            items.push(calculateRow(item, header));
        });

        return items;
    };

    const invoiceTotals = useMemo(() => {
        const subtotal = invoiceItems.reduce((acc, item) => acc + Number(item.taxable_value || 0), 0);
        const cgst = invoiceItems.reduce((acc, item) => acc + Number(item.cgst_amount || 0), 0);
        const sgst = invoiceItems.reduce((acc, item) => acc + Number(item.sgst_amount || 0), 0);
        const igst = invoiceItems.reduce((acc, item) => acc + Number(item.igst_amount || 0), 0);
        const cess = invoiceItems.reduce((acc, item) => acc + Number(item.cess_amount || 0), 0);
        const totalTax = cgst + sgst + igst + cess;

        let discountAmount = 0;
        if (invoiceHeader.discountType === 'percentage') {
            discountAmount = (subtotal + totalTax) * (Number(invoiceHeader.discountValue) / 100);
        } else {
            discountAmount = Number(invoiceHeader.discountValue);
        }

        const grandTotal = Math.max(0, subtotal + totalTax - discountAmount);

        return {
            subtotal: parseFloat(subtotal.toFixed(2)),
            cgst: parseFloat(cgst.toFixed(2)),
            sgst: parseFloat(sgst.toFixed(2)),
            igst: parseFloat(igst.toFixed(2)),
            cess: parseFloat(cess.toFixed(2)),
            totalTax: parseFloat(totalTax.toFixed(2)),
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            grandTotal: parseFloat(grandTotal.toFixed(2))
        };
    }, [invoiceItems, invoiceHeader.discountType, invoiceHeader.discountValue]);

    // Ensure discount amount does not exceed total amount
    useEffect(() => {
        const totalAmount = invoiceTotals.subtotal + invoiceTotals.totalTax;
        if (invoiceTotals.discountAmount > totalAmount + 0.001 && invoiceHeader.discountValue > 0) {
            setInvoiceHeader(prev => ({ ...prev, discountValue: 0 }));
            setSnackbar({ open: true, message: "Discount cannot exceed the total invoice amount.", severity: "warning" });
        }
    }, [invoiceTotals.subtotal, invoiceTotals.totalTax, invoiceTotals.discountAmount, invoiceHeader.discountValue]);

    useEffect(() => {
        if (open && request) {
            fetchData();
        }
    }, [open, request]);

    useEffect(() => {
        if (open && request && taxSlabs.length > 0 && allProducts.length > 0) {
            // Find any existing invoice for this request (Since we now only use "Full" invoices)
            const existingInvoice = request.invoices?.[0];

            if (existingInvoice) {
                const hasIGST = (existingInvoice.igst_amount || 0) > 0;

                const h = {
                    ...invoiceHeader,
                    id: existingInvoice.id,
                    date: existingInvoice.invoice_date || new Date().toISOString().split('T')[0],
                    dueDate: existingInvoice.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    isTaxInclusive: existingInvoice.is_tax_inclusive || false,
                    discountType: (existingInvoice.discount_type || 'amount') as any,
                    discountValue: existingInvoice.discount_value || 0,
                    gstType: (hasIGST ? 'igst' : 'cgst-sgst') as any,
                    taxInputMode: (existingInvoice.tax_input_mode || 'percentage') as any,
                    invoiceType: 'full' as any,
                    paymentStatus: existingInvoice.payment_status || 'unpaid',
                    triggeredFrom: initialTrigger
                };
                setInvoiceHeader(h);
                // For editing, we load the saved items from the invoice
                setInvoiceItems(existingInvoice.items || []);
                setInvoiceNotes(existingInvoice.notes || '');
            } else {
                // CREATE MODE
                const defaultH = {
                    ...invoiceHeader,
                    id: null,
                    invoiceType: 'full' as any,
                    triggeredFrom: initialTrigger,
                    paymentStatus: 'unpaid'
                };
                setInvoiceHeader(defaultH);
                setInvoiceItems(prepareInvoiceItems(request, defaultH, taxSlabs, allProducts));
                setInvoiceNotes('');
            }
        }
    }, [open, request, taxSlabs, allProducts]);

    const handleHeaderChange = (field: string, value: any) => {
        const newHeader = { ...invoiceHeader, [field]: value };

        if (field === 'gstType') {
            setInvoiceItems(prev => prev.map(item => {
                let newItem = { ...item };
                const effectiveTaxRate = item.product_tax_rate !== undefined
                    ? Number(item.product_tax_rate)
                    : findTaxRate(item.hsn_code || '', taxSlabs);

                if (value === 'cgst-sgst') {
                    newItem.igst_rate = 0; newItem.igst_amount = 0;
                    newItem.cgst_rate = effectiveTaxRate / 2; newItem.sgst_rate = effectiveTaxRate / 2;
                } else {
                    newItem.igst_rate = effectiveTaxRate;
                    newItem.cgst_rate = 0; newItem.cgst_amount = 0;
                    newItem.sgst_rate = 0; newItem.sgst_amount = 0;
                }
                return calculateRow(newItem, newHeader);
            }));
        } else if (field === 'taxInputMode' || field === 'isTaxInclusive') {
            setInvoiceItems(prev => prev.map(item => calculateRow(item, newHeader)));
            if (field === 'isTaxInclusive') newHeader.discountValue = 0;
        }

        setInvoiceHeader(newHeader);
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...invoiceItems];
        newItems[index] = { ...newItems[index], [field]: value };
        newItems[index] = calculateRow(newItems[index], invoiceHeader);
        setInvoiceItems(newItems);
    };

    const handleSubmit = async () => {
        if (!request) return;

        // Validation for invalid number formats (e.g. typos like "0..2", "......0")
        const isInvalid = (val: any) => {
            if (val === '' || val === null || val === undefined) return false;
            const strVal = String(val);
            // Check for multiple dots or non-numeric chars (allowing one dot)
            if ((strVal.match(/\./g) || []).length > 1) return true;
            return isNaN(Number(val));
        };

        if (isInvalid(invoiceHeader.discountValue)) {
            setSnackbar({ open: true, message: "Invalid Discount Value. Please check for typos.", severity: "warning" });
            return;
        }

        for (const item of invoiceItems) {
            if (isInvalid(item.quantity) || isInvalid(item.unit_price)) {
                setSnackbar({ open: true, message: `Invalid Quantity or Unit Price for ${item.product_name}.`, severity: "warning" });
                return;
            }
            // Check tax fields
            if (isInvalid(item.cgst_rate) || isInvalid(item.cgst_amount) ||
                isInvalid(item.sgst_rate) || isInvalid(item.sgst_amount) ||
                isInvalid(item.igst_rate) || isInvalid(item.igst_amount) ||
                isInvalid(item.cess_rate) || isInvalid(item.cess_amount)) {
                setSnackbar({ open: true, message: `Invalid Tax values for ${item.product_name}.`, severity: "warning" });
                return;
            }
        }

        setLoading(true);
        try {
            const data = {
                id: invoiceHeader.id,
                invoice_date: invoiceHeader.date,
                due_date: invoiceHeader.dueDate,
                is_tax_inclusive: invoiceHeader.isTaxInclusive,
                tax_input_mode: invoiceHeader.taxInputMode,
                discount_type: invoiceHeader.discountType,
                discount_value: Number(invoiceHeader.discountValue) || 0,
                discount_amount: Number(invoiceTotals.discountAmount) || 0,
                total_amount: Number(invoiceTotals.grandTotal) || 0,
                invoice_type: invoiceHeader.invoiceType,
                notes: invoiceNotes,
                items: invoiceItems.map(item => ({
                    ...item,
                    quantity: Number(item.quantity) || 0,
                    unit_price: Number(item.unit_price) || 0,
                    cgst_rate: Number(item.cgst_rate) || 0,
                    sgst_rate: Number(item.sgst_rate) || 0,
                    igst_rate: Number(item.igst_rate) || 0,
                    cess_rate: Number(item.cess_rate) || 0,
                    cgst_amount: Number(item.cgst_amount) || 0,
                    sgst_amount: Number(item.sgst_amount) || 0,
                    igst_amount: Number(item.igst_amount) || 0,
                    cess_amount: Number(item.cess_amount) || 0,
                    product_id: item.product,
                    shortage_id: (item as any).shortage_id
                }))
            };

            if (data.items.length === 0) {
                alert("Please add items to invoice.");
                setLoading(false);
                return;
            }

            await distributorService.generateInvoice(request.id, data);
            onSuccess();
            onClose();
        } catch (error: any) {
            alert(formatDRFError(error.response?.data || error));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteInvoice = async () => {
        if (!request || !invoiceHeader.id) return;
        if (!window.confirm("Are you sure you want to remove this invoice? This will delete the data and let you change the scope.")) return;

        setLoading(true);
        try {
            await distributorService.deleteInvoice(request.id, invoiceHeader.id);
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
            <DialogTitle component="div" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02), display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight={800}>
                        {invoiceHeader.id ? `Edit Invoice` : 'Generate Stock Invoice'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">Request: {request?.request_number} • Distributor: {request?.distributor_name}</Typography>
                </Box>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 4, pt: 2 }}>
                {invoiceHeader.paymentStatus === 'paid' && (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                        This invoice is <strong>PAID</strong> and locked for editing.
                    </Alert>
                )}

                <Grid container spacing={3}>
                    <Grid size={12}>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <TextField fullWidth label="Invoice Date" type="date" size="small" value={invoiceHeader.date} onChange={(e) => handleHeaderChange('date', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} InputLabelProps={{ shrink: true }} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <TextField fullWidth label="Due Date" type="date" size="small" value={invoiceHeader.dueDate} onChange={(e) => handleHeaderChange('dueDate', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} InputLabelProps={{ shrink: true }} inputProps={{ min: invoiceHeader.date }} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <ToggleButtonGroup fullWidth size="small" value={invoiceHeader.gstType} exclusive onChange={(_, v) => v && handleHeaderChange('gstType', v)} disabled={invoiceHeader.paymentStatus === 'paid'}>
                                        <ToggleButton value="cgst-sgst" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>CGST/SGST</ToggleButton>
                                        <ToggleButton value="igst" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>IGST</ToggleButton>
                                    </ToggleButtonGroup>
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }} sx={{ textAlign: 'center' }}>
                                    <FormControlLabel control={<Switch checked={invoiceHeader.isTaxInclusive} onChange={(e) => handleHeaderChange('isTaxInclusive', e.target.checked)} color="primary" disabled={invoiceHeader.paymentStatus === 'paid'} />} label={<Typography variant="body2" fontWeight={700}>Tax Inclusive Price</Typography>} />
                                </Grid>
                            </Grid>

                        </Paper>
                    </Grid>

                    {/* Billing & Shipping Address */}
                    {request && (
                        <Grid size={12}>
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
                                <Grid container spacing={2}>
                                    {request.distributor_gst && (
                                        <Grid size={12}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={700}>GSTIN</Typography>
                                            <Typography variant="body2" fontWeight={600}>{request.distributor_gst}</Typography>
                                        </Grid>
                                    )}
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={700}>BILLING ADDRESS</Typography>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                                            {request.distributor_address || 'Not provided'}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Typography variant="caption" color="text.secondary" fontWeight={700}>SHIPPING ADDRESS</Typography>
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                                            {request.distributor_shipping_address || request.distributor_address || 'Same as billing'}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>
                    )}

                    <Grid size={12}>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                            <Table size="small">
                                <TableHead sx={{ bgcolor: alpha(theme.palette.divider, 0.05) }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Unit Price</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Taxable</TableCell>
                                        {invoiceHeader.taxInputMode === 'percentage' ? (
                                            <>
                                                {invoiceHeader.gstType === 'cgst-sgst' ? (
                                                    <>
                                                        <TableCell align="right" sx={{ fontWeight: 700 }}>CGST %</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700 }}>SGST %</TableCell>
                                                    </>
                                                ) : <TableCell align="right" sx={{ fontWeight: 700 }}>IGST %</TableCell>}
                                            </>
                                        ) : (
                                            <>
                                                {invoiceHeader.gstType === 'cgst-sgst' ? (
                                                    <>
                                                        <TableCell align="right" sx={{ fontWeight: 700 }}>CGST ₹</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 700 }}>SGST ₹</TableCell>
                                                    </>
                                                ) : <TableCell align="right" sx={{ fontWeight: 700 }}>IGST ₹</TableCell>}
                                            </>
                                        )}
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Cess {invoiceHeader.taxInputMode === 'percentage' ? '%' : '₹'}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {invoiceItems.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={600}>{item.product_name}</Typography>
                                                <Typography variant="caption" color="text.secondary">HSN: {item.hsn_code || '-'}</Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <TextField size="small" variant="standard" type="number" value={item.quantity} onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid' || invoiceHeader.invoiceType !== 'full'} sx={{ width: 60 }} />
                                            </TableCell>
                                            <TableCell align="right">
                                                <TextField size="small" variant="standard" type="number" value={item.unit_price} onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} sx={{ width: 80 }} />
                                            </TableCell>
                                            <TableCell align="right">₹{item.taxable_value}</TableCell>
                                            {invoiceHeader.taxInputMode === 'percentage' ? (
                                                <>
                                                    {invoiceHeader.gstType === 'cgst-sgst' ? (
                                                        <>
                                                            <TableCell align="right"><TextField size="small" variant="standard" type="number" value={item.cgst_rate} onChange={(e) => handleItemChange(idx, 'cgst_rate', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} sx={{ width: 50 }} /></TableCell>
                                                            <TableCell align="right"><TextField size="small" variant="standard" type="number" value={item.sgst_rate} onChange={(e) => handleItemChange(idx, 'sgst_rate', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} sx={{ width: 50 }} /></TableCell>
                                                        </>
                                                    ) : <TableCell align="right"><TextField size="small" variant="standard" type="number" value={item.igst_rate} onChange={(e) => handleItemChange(idx, 'igst_rate', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} sx={{ width: 50 }} /></TableCell>}
                                                </>
                                            ) : (
                                                <>
                                                    {invoiceHeader.gstType === 'cgst-sgst' ? (
                                                        <>
                                                            <TableCell align="right"><TextField size="small" variant="standard" type="number" value={item.cgst_amount} onChange={(e) => handleItemChange(idx, 'cgst_amount', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} sx={{ width: 70 }} /></TableCell>
                                                            <TableCell align="right"><TextField size="small" variant="standard" type="number" value={item.sgst_amount} onChange={(e) => handleItemChange(idx, 'sgst_amount', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} sx={{ width: 70 }} /></TableCell>
                                                        </>
                                                    ) : <TableCell align="right"><TextField size="small" variant="standard" type="number" value={item.igst_amount} onChange={(e) => handleItemChange(idx, 'igst_amount', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} sx={{ width: 70 }} /></TableCell>}
                                                </>
                                            )}
                                            <TableCell align="right">
                                                <TextField size="small" variant="standard" type="number" value={invoiceHeader.taxInputMode === 'percentage' ? item.cess_rate : item.cess_amount} onChange={(e) => handleItemChange(idx, invoiceHeader.taxInputMode === 'percentage' ? 'cess_rate' : 'cess_amount', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} sx={{ width: 60 }} />
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>₹{item.total_price}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>

                    <Grid size={{ xs: 12, md: 7 }}>
                        <TextField fullWidth multiline rows={4} label="Invoice Notes" placeholder="Enter terms, conditions, payment instructions..." value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} />
                    </Grid>

                    <Grid size={{ xs: 12, md: 5 }}>
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                            <Stack spacing={2}>
                                <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Subtotal</Typography><Typography variant="body2" fontWeight={700}>₹{invoiceTotals.subtotal}</Typography></Box>
                                <Box display="flex" justifyContent="space-between"><Typography variant="body2" color="text.secondary">Tax</Typography><Typography variant="body2" fontWeight={700}>₹{invoiceTotals.totalTax}</Typography></Box>

                                <Divider />

                                <Box>
                                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                                        <Typography variant="body2" color="text.secondary">Discount</Typography>
                                        <ToggleButtonGroup size="small" value={invoiceHeader.discountType} exclusive onChange={(_, v) => v && handleHeaderChange('discountType', v)} disabled={invoiceHeader.paymentStatus === 'paid'}>
                                            <ToggleButton value="amount" sx={{ px: 1 }}><CurrencyRupeeIcon sx={{ fontSize: 14 }} /></ToggleButton>
                                            <ToggleButton value="percentage" sx={{ px: 1 }}><PercentIcon sx={{ fontSize: 14 }} /></ToggleButton>
                                        </ToggleButtonGroup>
                                    </Stack>
                                    <TextField fullWidth size="small" type="number" value={invoiceHeader.discountValue} onChange={(e) => handleHeaderChange('discountValue', e.target.value)} disabled={invoiceHeader.paymentStatus === 'paid'} InputProps={{ startAdornment: <InputAdornment position="start">{invoiceHeader.discountType === 'amount' ? '₹' : '%'}</InputAdornment> }} />
                                </Box>

                                <Divider />

                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography variant="subtitle1" fontWeight={800} color="primary">Grand Total</Typography>
                                    <Typography variant="h5" fontWeight={900} color="primary">₹{invoiceTotals.grandTotal}</Typography>
                                </Box>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, bgcolor: alpha(theme.palette.divider, 0.02) }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                {invoiceHeader.paymentStatus !== 'paid' && (
                    <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
                        {invoiceHeader.id && (
                            <Button variant="outlined" color="error" onClick={handleDeleteInvoice} disabled={loading} startIcon={<DeleteIcon />}>
                                Remove Existing
                            </Button>
                        )}
                        <Button variant="contained" color="secondary" onClick={handleSubmit} disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : <ReceiptIcon />}>
                            {invoiceHeader.id ? 'Update Invoice' : 'Generate Invoice'}
                        </Button>
                    </Stack>
                )}
            </DialogActions>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: '100%', fontWeight: 600 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Dialog >
    );
}

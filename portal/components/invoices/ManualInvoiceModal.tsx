"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
    Box, Typography, Button, Stack, TextField, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, Grid, useTheme, alpha,
    CircularProgress, Divider, ToggleButtonGroup, ToggleButton, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    InputAdornment, Tooltip, Zoom, Fade, Snackbar, Alert
} from "@mui/material";
import { CloseIcon, ReceiptIcon, AddIcon, DeleteOutlineIcon, VisibilityIcon, SaveIcon, CurrencyRupeeIcon, PercentIcon } from "@/components/icons";

import { salesService, ManualInvoice, ManualInvoiceItem } from "@/lib/sales-service";
import { formatDRFError } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface ManualInvoiceModalProps {
    open: boolean;
    onClose: () => void;
    invoice?: ManualInvoice | null;
    onSuccess: () => void;
}

interface ItemRow extends ManualInvoiceItem {
    id_key: string;
}

export default function ManualInvoiceModal({ open, onClose, invoice, onSuccess }: ManualInvoiceModalProps) {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

    // Header State
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [customerGSTIN, setCustomerGSTIN] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [taxType, setTaxType] = useState<'cgst_sgst' | 'igst'>('cgst_sgst');
    const [isTaxInclusive, setIsTaxInclusive] = useState(true);

    // Bottom State
    const [discountAmount, setDiscountAmount] = useState(0);
    const [company, setCompany] = useState<any>(null);

    // Items State
    const [items, setItems] = useState<ItemRow[]>([]);

    // Toast State
    const [toast, setToast] = useState({ open: false, message: "", severity: "info" as "success" | "error" | "warning" | "info" });

    useEffect(() => {
        const fetchCompany = async () => {
            try {
                const data = await apiClient.get<any>('/core/companies/');
                if (data.results && data.results.length > 0) {
                    setCompany(data.results[0]);
                }
            } catch (error) {
                console.error("Failed to fetch company info", error);
            }
        };
        fetchCompany();
    }, []);



    useEffect(() => {
        if (open) {
            if (invoice) {
                // Edit mode
                setInvoiceNumber(invoice.invoice_number);
                setCustomerName(invoice.customer_name);
                setCustomerAddress(invoice.customer_address || "");
                setCustomerGSTIN(invoice.customer_gstin || "");
                setInvoiceDate(invoice.invoice_date);
                setDueDate(invoice.due_date);
                setTaxType(invoice.tax_type);
                setIsTaxInclusive(invoice.is_tax_inclusive);
                setDiscountAmount(Number(invoice.discount_amount) || 0);
                setItems((invoice.items || []).map(it => ({
                    ...it,
                    id_key: Math.random().toString(36).substr(2, 9),
                    quantity: Number(it.quantity) || 0,
                    unit_price: Number(it.unit_price) || 0,
                    tax_percentage: Number(it.tax_percentage) || 0,
                    taxable_amount: Number(it.taxable_amount) || 0,
                    tax_amount: Number(it.tax_amount) || 0,
                    cgst_amount: Number(it.cgst_amount) || 0,
                    sgst_amount: Number(it.sgst_amount) || 0,
                    igst_amount: Number(it.igst_amount) || 0,
                    total_amount: Number(it.total_amount) || 0
                })));
            } else {
                // Create mode
                resetForm();
            }
        }
    }, [open, invoice]);

    const resetForm = () => {
        setInvoiceNumber("");
        setCustomerName("");
        setCustomerAddress("");
        setCustomerGSTIN("");
        setInvoiceDate(new Date().toISOString().split('T')[0]);
        setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        setTaxType('cgst_sgst');
        setIsTaxInclusive(true);
        setDiscountAmount(0);
        setItems([{
            id_key: Math.random().toString(36).substr(2, 9),
            item_name: "",
            hsn_code: "",
            quantity: 1,
            unit_price: 0,
            tax_percentage: 18,
            taxable_amount: 0,
            tax_amount: 0,
            cgst_amount: 0,
            sgst_amount: 0,
            igst_amount: 0,
            total_amount: 0
        }]);
    };

    const calculateItem = (item: ItemRow, isInclusive: boolean, tType: 'cgst_sgst' | 'igst'): ItemRow => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        const taxRate = Number(item.tax_percentage) || 0;

        let taxable = 0;
        let tax = 0;
        let total = 0;

        if (isInclusive) {
            total = qty * price;
            taxable = total / (1 + taxRate / 100);
            tax = total - taxable;
        } else {
            taxable = qty * price;
            tax = taxable * (taxRate / 100);
            total = taxable + tax;
        }

        let cgst = 0, sgst = 0, igst = 0;
        if (tType === 'cgst_sgst') {
            cgst = tax / 2;
            sgst = tax / 2;
        } else {
            igst = tax;
        }

        return {
            ...item,
            taxable_amount: Number(Number(taxable || 0).toFixed(2)),
            tax_amount: Number(Number(tax || 0).toFixed(2)),
            cgst_amount: Number(Number(cgst || 0).toFixed(2)),
            sgst_amount: Number(Number(sgst || 0).toFixed(2)),
            igst_amount: Number(Number(igst || 0).toFixed(2)),
            total_amount: Number(Number(total || 0).toFixed(2))
        };
    };

    const addItem = () => {
        const newItem: ItemRow = {
            id_key: Math.random().toString(36).substr(2, 9),
            item_name: "",
            hsn_code: "",
            quantity: 1,
            unit_price: 0,
            tax_percentage: 18,
            taxable_amount: 0,
            tax_amount: 0,
            cgst_amount: 0,
            sgst_amount: 0,
            igst_amount: 0,
            total_amount: 0
        };
        setItems([...items, newItem]);
    };

    const removeItem = (id_key: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id_key !== id_key));
        }
    };

    const updateItem = (id_key: string, field: keyof ItemRow, value: any) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id_key === id_key) {
                const updated = { ...item, [field]: value };
                return calculateItem(updated, isTaxInclusive, taxType);
            }
            return item;
        }));
    };

    // Re-calculate all items if global settings change
    useEffect(() => {
        setItems(prev => prev.map(item => calculateItem(item, isTaxInclusive, taxType)));
    }, [isTaxInclusive, taxType]);

    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + (Number(item.taxable_amount) || 0), 0);
        const tax = items.reduce((sum, item) => sum + (Number(item.tax_amount) || 0), 0);
        const cgst = items.reduce((sum, item) => sum + (Number(item.cgst_amount) || 0), 0);
        const sgst = items.reduce((sum, item) => sum + (Number(item.sgst_amount) || 0), 0);
        const igst = items.reduce((sum, item) => sum + (Number(item.igst_amount) || 0), 0);

        const totalAmount = subtotal + tax;
        const grandTotal = totalAmount - discountAmount;

        return {
            subtotal: Number(Number(subtotal || 0).toFixed(2)),
            tax: Number(Number(tax || 0).toFixed(2)),
            cgst: Number(Number(cgst || 0).toFixed(2)),
            sgst: Number(Number(sgst || 0).toFixed(2)),
            igst: Number(Number(igst || 0).toFixed(2)),
            totalAmount: Number(Number(totalAmount || 0).toFixed(2)),
            grandTotal: Number(Number(grandTotal || 0).toFixed(2))
        };
    }, [items, discountAmount]);

    const handleSubmit = async () => {
        // --- VALIDATIONS ---

        // Header Validations
        if (!invoiceNumber.trim()) {
            setToast({ open: true, message: "Invoice Number is required", severity: "error" });
            return;
        }
        if (!customerName.trim()) {
            setToast({ open: true, message: "Customer Name is required", severity: "error" });
            return;
        }
        if (!customerAddress.trim()) {
            setToast({ open: true, message: "Customer Address is required", severity: "error" });
            return;
        }
        if (!invoiceDate) {
            setToast({ open: true, message: "Invoice Date is required", severity: "error" });
            return;
        }
        if (!dueDate) {
            setToast({ open: true, message: "Due Date is required", severity: "error" });
            return;
        }

        // Logical Date Validation
        if (new Date(dueDate) < new Date(invoiceDate)) {
            setToast({ open: true, message: "Due Date cannot be before Invoice Date", severity: "error" });
            return;
        }

        // Items Validations
        if (items.length === 0) {
            setToast({ open: true, message: "At least one item is required", severity: "error" });
            return;
        }

        const hsnRegex = /^\d{6}(\d{2})?$/;
        for (const item of items) {
            if (!item.item_name.trim()) {
                setToast({ open: true, message: "Item Name is mandatory for all rows", severity: "error" });
                return;
            }
            if (item.hsn_code && !hsnRegex.test(item.hsn_code)) {
                setToast({ open: true, message: `Invalid HSN Code for "${item.item_name}". It must be a 6 or 8 digit number.`, severity: "error" });
                return;
            }
            if (item.quantity <= 0) {
                setToast({ open: true, message: `Quantity must be greater than 0 for ${item.item_name || 'item'}`, severity: "error" });
                return;
            }
            if (item.unit_price <= 0) {
                setToast({ open: true, message: `Unit Price must be greater than 0 for ${item.item_name || 'item'}`, severity: "error" });
                return;
            }
        }

        // Discount Validation
        if (discountAmount > totals.totalAmount) {
            setToast({ open: true, message: `Discount amount (₹${discountAmount}) cannot be more than the Total Amount (₹${totals.totalAmount})`, severity: "error" });
            return;
        }

        setLoading(true);
        try {
            const data: Partial<ManualInvoice> = {
                invoice_number: invoiceNumber,
                customer_name: customerName,
                customer_address: customerAddress,
                customer_gstin: customerGSTIN,
                invoice_date: invoiceDate,
                due_date: dueDate,
                tax_type: taxType,
                is_tax_inclusive: isTaxInclusive,
                subtotal: totals.subtotal,
                tax_amount: totals.tax,
                cgst_amount: totals.cgst,
                sgst_amount: totals.sgst,
                igst_amount: totals.igst,
                discount_amount: discountAmount,
                grand_total: totals.grandTotal,
                items: items.map(item => ({
                    item_name: item.item_name,
                    hsn_code: item.hsn_code,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    tax_percentage: item.tax_percentage,
                    taxable_amount: item.taxable_amount,
                    tax_amount: item.tax_amount,
                    cgst_amount: item.cgst_amount,
                    sgst_amount: item.sgst_amount,
                    igst_amount: item.igst_amount,
                    total_amount: item.total_amount
                }))
            };

            if (invoice) {
                await salesService.updateManualInvoice(invoice.id, data);
                setToast({ open: true, message: "Invoice updated successfully!", severity: "success" });
            } else {
                await salesService.createManualInvoice(data);
                setToast({ open: true, message: "Invoice created successfully!", severity: "success" });
            }

            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);
        } catch (error: any) {
            setToast({ open: true, message: formatDRFError(error.response?.data || error), severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            TransitionComponent={Fade}
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    overflow: 'hidden',
                    maxHeight: '92vh'
                }
            }}
        >
            <DialogTitle sx={{
                p: 2.5,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.primary.main, 0.1)})`,
                borderBottom: `1px solid ${theme.palette.divider}`
            }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{
                            p: 1,
                            borderRadius: 1.5,
                            bgcolor: theme.palette.primary.main,
                            color: 'white',
                            display: 'flex',
                            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`
                        }}>
                            <ReceiptIcon />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: '-0.01em' }}>
                                {invoice ? "Edit Purchase Invoice" : "Create Purchase Invoice"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Generate standalone customizable invoices
                            </Typography>
                        </Box>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                        <ToggleButtonGroup
                            size="small"
                            value={viewMode}
                            exclusive
                            onChange={(_, v) => v && setViewMode(v)}
                            sx={{ bgcolor: 'white' }}
                        >
                            <ToggleButton value="edit" sx={{ px: 2 }}>Edit</ToggleButton>
                            <ToggleButton value="preview" sx={{ px: 2 }}>Preview</ToggleButton>
                        </ToggleButtonGroup>
                        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 0, bgcolor: alpha(theme.palette.grey[50], 0.3) }}>
                {viewMode === 'edit' ? (
                    <Box sx={{ p: 3 }}>
                        <Grid container spacing={3}>
                            {/* Header Info */}
                            <Grid size={12}>
                                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, bgcolor: 'white' }}>
                                    <Grid container spacing={2.5}>
                                        {/* Row 1: Invoice Number and Dates */}
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <TextField
                                                fullWidth label="Invoice Number*"
                                                value={invoiceNumber}
                                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                                variant="standard"
                                                placeholder="Enter invoice number"
                                                required
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <TextField
                                                fullWidth label="Invoice Date*" type="date"
                                                value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                                                variant="standard" InputLabelProps={{ shrink: true }}
                                                required
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <TextField
                                                fullWidth label="Due Date*" type="date"
                                                value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                                                variant="standard" InputLabelProps={{ shrink: true }}
                                                inputProps={{ min: invoiceDate }}
                                                required
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            {/* Empty space for alignment */}
                                        </Grid>

                                        {/* Row 2: Customer Details - Name, Address, GSTIN */}
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <TextField
                                                fullWidth label="Billed To (Customer Name)*"
                                                value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                                                variant="standard" placeholder="Enter customer name"
                                                required
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <TextField
                                                fullWidth label="Billed To Address*"
                                                value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)}
                                                variant="standard"
                                                placeholder="Enter customer address"
                                                required
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <TextField
                                                fullWidth label="Billed To GSTIN"
                                                value={customerGSTIN} onChange={(e) => setCustomerGSTIN(e.target.value)}
                                                variant="standard"
                                                placeholder="Enter GSTIN"
                                            />
                                        </Grid>

                                        {/* Row 3: Tax Type and Tax Mode */}
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                                                    Tax Type
                                                </Typography>
                                                <ToggleButtonGroup
                                                    fullWidth size="small" value={taxType} exclusive
                                                    onChange={(_, v) => v && setTaxType(v)}
                                                    sx={{ height: 40 }}
                                                >
                                                    <ToggleButton value="cgst_sgst">CGST/SGST</ToggleButton>
                                                    <ToggleButton value="igst">IGST</ToggleButton>
                                                </ToggleButtonGroup>
                                            </Box>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 3 }}>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                                                    Tax Mode
                                                </Typography>
                                                <ToggleButtonGroup
                                                    fullWidth size="small" value={isTaxInclusive} exclusive
                                                    onChange={(_, v) => setIsTaxInclusive(v)}
                                                    sx={{ height: 40 }}
                                                >
                                                    <ToggleButton value={false}>Exclusive</ToggleButton>
                                                    <ToggleButton value={true}>Inclusive</ToggleButton>
                                                </ToggleButtonGroup>
                                            </Box>
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
                                                <TableCell width="30%">Item Name</TableCell>
                                                <TableCell width="10%">HSN</TableCell>
                                                <TableCell align="center" width="10%">Qty</TableCell>
                                                <TableCell align="center" width="12%">Unit Price</TableCell>
                                                <TableCell align="center" width="10%">Tax %</TableCell>
                                                <TableCell align="right" width="12%">Amount</TableCell>
                                                <TableCell width="5%"></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {items.map((item, index) => (
                                                <TableRow key={item.id_key}>
                                                    <TableCell>
                                                        <TextField
                                                            fullWidth size="small" value={item.item_name}
                                                            onChange={(e) => updateItem(item.id_key, 'item_name', e.target.value)}
                                                            placeholder="Item name*"
                                                            variant="standard"
                                                            required
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip title="Must be a 6 or 8 digit numeric code">
                                                            <TextField
                                                                fullWidth size="small" value={item.hsn_code}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                                                                    updateItem(item.id_key, 'hsn_code', val);
                                                                }}
                                                                placeholder="HSN (6/8 digits)"
                                                                variant="standard"
                                                            />
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            fullWidth size="small" type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(item.id_key, 'quantity', e.target.value)}
                                                            variant="standard"
                                                            required
                                                            sx={{
                                                                '& input[type=number]': {
                                                                    MozAppearance: 'textfield'
                                                                },
                                                                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                                    WebkitAppearance: 'none',
                                                                    margin: 0
                                                                }
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            fullWidth size="small" type="number"
                                                            value={item.unit_price}
                                                            onChange={(e) => updateItem(item.id_key, 'unit_price', e.target.value)}
                                                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                                                            variant="standard"
                                                            required
                                                            sx={{
                                                                '& input[type=number]': {
                                                                    MozAppearance: 'textfield'
                                                                },
                                                                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                                    WebkitAppearance: 'none',
                                                                    margin: 0
                                                                }
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            fullWidth size="small" type="number"
                                                            value={item.tax_percentage}
                                                            onChange={(e) => updateItem(item.id_key, 'tax_percentage', e.target.value)}
                                                            InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                                                            variant="standard"
                                                            required
                                                            sx={{
                                                                '& input[type=number]': {
                                                                    MozAppearance: 'textfield'
                                                                },
                                                                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                                    WebkitAppearance: 'none',
                                                                    margin: 0
                                                                }
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" fontWeight={700}>₹{item.total_amount.toLocaleString()}</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <IconButton
                                                            color="error" size="small" disabled={items.length === 1}
                                                            onClick={() => removeItem(item.id_key)}
                                                        >
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow>
                                                <TableCell colSpan={7}>
                                                    <Button
                                                        startIcon={<AddIcon />} size="small"
                                                        onClick={addItem}
                                                        sx={{ color: theme.palette.primary.main, fontWeight: 600 }}
                                                    >
                                                        Add Item Row
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Grid>

                            {/* Summary & Totals */}
                            <Grid size={{ xs: 12, md: 7 }}>
                                {/* Placeholder or empty space */}
                            </Grid>
                            <Grid size={{ xs: 12, md: 5 }}>
                                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                                    <Stack spacing={1.5}>
                                        <Box display="flex" justifyContent="space-between">
                                            <Typography variant="body2" color="text.secondary">Subtotal (Taxable)</Typography>
                                            <Typography variant="body2" fontWeight={600}>₹{totals.subtotal.toLocaleString()}</Typography>
                                        </Box>
                                        {taxType === 'cgst_sgst' ? (
                                            <>
                                                <Box display="flex" justifyContent="space-between">
                                                    <Typography variant="body2" color="text.secondary">CGST Total</Typography>
                                                    <Typography variant="body2" fontWeight={600}>₹{totals.cgst.toLocaleString()}</Typography>
                                                </Box>
                                                <Box display="flex" justifyContent="space-between">
                                                    <Typography variant="body2" color="text.secondary">SGST Total</Typography>
                                                    <Typography variant="body2" fontWeight={600}>₹{totals.sgst.toLocaleString()}</Typography>
                                                </Box>
                                            </>
                                        ) : (
                                            <Box display="flex" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">IGST Total</Typography>
                                                <Typography variant="body2" fontWeight={600}>₹{totals.igst.toLocaleString()}</Typography>
                                            </Box>
                                        )}
                                        <Divider />
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body2" color="text.secondary">Discount</Typography>
                                            <TextField
                                                size="small" type="number" value={discountAmount}
                                                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                                                variant="standard" sx={{
                                                    width: 80,
                                                    '& input': { textAlign: 'right' },
                                                    '& input[type=number]': {
                                                        MozAppearance: 'textfield'
                                                    },
                                                    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                        WebkitAppearance: 'none',
                                                        margin: 0
                                                    }
                                                }}
                                                InputProps={{ startAdornment: '₹' }}
                                            />
                                        </Box>
                                        <Divider />
                                        <Box display="flex" justifyContent="space-between" pt={1}>
                                            <Typography variant="subtitle1" fontWeight={800} color="primary">Grand Total</Typography>
                                            <Typography variant="h5" fontWeight={900} color="primary">₹{totals.grandTotal.toLocaleString()}</Typography>
                                        </Box>
                                    </Stack>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                ) : (
                    <Box sx={{ p: 4, bgcolor: '#f5f5f5' }}>
                        {/* Professional Invoice Preview */}
                        <Paper elevation={3} sx={{ p: 5, minHeight: '70vh', borderRadius: 2, bgcolor: 'white' }}>
                            {/* Header Section */}
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={5} pb={3} borderBottom={`3px solid ${theme.palette.primary.main}`}>
                                <Box>
                                    <Typography variant="h3" fontWeight={900} color="primary" letterSpacing={-0.5}>INVOICE</Typography>
                                    <Typography variant="h6" fontWeight={600} color="text.secondary" mt={0.5}>
                                        #{invoiceNumber || 'INV-XXXX'}
                                    </Typography>
                                </Box>
                                <Box textAlign="right">
                                    <Stack spacing={1.5} alignItems="flex-end">
                                        <Box display="flex" gap={1} alignItems="center">
                                            <Typography variant="body2" color="text.secondary" fontWeight={600}>Invoice Date:</Typography>
                                            <Typography variant="body1" fontWeight={700}>{invoiceDate}</Typography>
                                        </Box>
                                        <Box display="flex" gap={1} alignItems="center">
                                            <Typography variant="body2" color="text.secondary" fontWeight={600}>Due Date:</Typography>
                                            <Typography variant="body1" fontWeight={700}>{dueDate}</Typography>
                                        </Box>
                                    </Stack>
                                </Box>
                            </Stack>

                            {/* Bill To & Company Details */}
                            <Grid container spacing={4} mb={5}>
                                <Grid size={6}>
                                    <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
                                        <Typography variant="overline" color="primary" fontWeight={800} letterSpacing={1}>Bill To</Typography>
                                        <Typography variant="h6" fontWeight={700} mt={1} mb={0.5}>{customerName || 'Customer Name'}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>{customerAddress || 'Customer Address'}</Typography>
                                        {customerGSTIN && <Typography variant="body2" fontWeight={600} mt={1}>GSTIN: {customerGSTIN}</Typography>}
                                    </Box>
                                </Grid>
                                <Grid size={6}>
                                    <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.grey[100], 0.5), borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                                        <Typography variant="overline" color="text.secondary" fontWeight={800} letterSpacing={1}>Billed From</Typography>
                                        <Typography variant="h6" fontWeight={700} mt={1} mb={0.5} color="primary.dark">{company?.name || 'KaySetu Corp'}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                                            {company?.full_address}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={600} mt={1}>GSTIN: {company?.tax_id || '09ABCDE1234F1Z5'}</Typography>
                                    </Box>
                                </Grid>
                            </Grid>

                            {/* Items Table with Tax Breakdown */}
                            <TableContainer sx={{ mb: 4, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                                            <TableCell sx={{ fontWeight: 800, fontSize: '0.875rem', py: 2 }}>Description</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>HSN</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>Qty</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>Unit Price</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>Taxable Amt</TableCell>
                                            {taxType === 'cgst_sgst' ? (
                                                <>
                                                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>CGST</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>SGST</TableCell>
                                                </>
                                            ) : (
                                                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>IGST</TableCell>
                                            )}
                                            <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.875rem' }}>Total</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {items.map((item, idx) => (
                                            <TableRow key={idx} sx={{ '&:nth-of-type(odd)': { bgcolor: alpha(theme.palette.grey[100], 0.3) } }}>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Typography variant="body2" fontWeight={600}>{item.item_name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">Tax: {item.tax_percentage}%</Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="body2">{item.hsn_code}</Typography>
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Typography variant="body2" fontWeight={600}>{item.quantity}</Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography variant="body2">₹{item.unit_price.toLocaleString()}</Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Typography variant="body2" fontWeight={600}>₹{item.taxable_amount.toLocaleString()}</Typography>
                                                </TableCell>
                                                {taxType === 'cgst_sgst' ? (
                                                    <>
                                                        <TableCell align="right">
                                                            <Typography variant="body2">₹{item.cgst_amount.toLocaleString()}</Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2">₹{item.sgst_amount.toLocaleString()}</Typography>
                                                        </TableCell>
                                                    </>
                                                ) : (
                                                    <TableCell align="right">
                                                        <Typography variant="body2">₹{item.igst_amount.toLocaleString()}</Typography>
                                                    </TableCell>
                                                )}
                                                <TableCell align="right">
                                                    <Typography variant="body2" fontWeight={700}>₹{item.total_amount.toLocaleString()}</Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Summary Section */}
                            <Stack direction="row" justifyContent="flex-end" mb={4}>
                                <Box sx={{ width: 350, border: `2px solid ${theme.palette.divider}`, borderRadius: 2, overflow: 'hidden' }}>
                                    <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08), p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                                        <Typography variant="subtitle2" fontWeight={800} color="primary">INVOICE SUMMARY</Typography>
                                    </Box>
                                    <Stack spacing={1.5} p={2.5}>
                                        <Box display="flex" justifyContent="space-between">
                                            <Typography variant="body2" fontWeight={600}>Subtotal (Taxable)</Typography>
                                            <Typography variant="body2" fontWeight={600}>₹{totals.subtotal.toLocaleString()}</Typography>
                                        </Box>
                                        {taxType === 'cgst_sgst' ? (
                                            <>
                                                <Box display="flex" justifyContent="space-between">
                                                    <Typography variant="body2" color="text.secondary">CGST Total</Typography>
                                                    <Typography variant="body2">₹{totals.cgst.toLocaleString()}</Typography>
                                                </Box>
                                                <Box display="flex" justifyContent="space-between">
                                                    <Typography variant="body2" color="text.secondary">SGST Total</Typography>
                                                    <Typography variant="body2">₹{totals.sgst.toLocaleString()}</Typography>
                                                </Box>
                                            </>
                                        ) : (
                                            <Box display="flex" justifyContent="space-between">
                                                <Typography variant="body2" color="text.secondary">IGST Total</Typography>
                                                <Typography variant="body2">₹{totals.igst.toLocaleString()}</Typography>
                                            </Box>
                                        )}
                                        {discountAmount > 0 && (
                                            <Box display="flex" justifyContent="space-between">
                                                <Typography variant="body2" color="error.main" fontWeight={600}>Discount</Typography>
                                                <Typography variant="body2" color="error.main" fontWeight={600}>-₹{discountAmount.toLocaleString()}</Typography>
                                            </Box>
                                        )}
                                        <Divider sx={{ my: 1 }} />
                                        <Box display="flex" justifyContent="space-between" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), p: 1.5, borderRadius: 1, mt: 1 }}>
                                            <Typography variant="h6" fontWeight={900} color="primary">Grand Total</Typography>
                                            <Typography variant="h6" fontWeight={900} color="primary">₹{totals.grandTotal.toLocaleString()}</Typography>
                                        </Box>
                                    </Stack>
                                </Box>
                            </Stack>



                            {/* Footer */}
                            <Box sx={{ mt: 6, pt: 3, borderTop: `1px solid ${theme.palette.divider}`, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                    This is a computer-generated invoice and does not require a signature.
                                </Typography>
                            </Box>
                        </Paper>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2.5, bgcolor: 'white', borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, px: 3 }}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading || items.length === 0}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                    sx={{
                        borderRadius: 2,
                        px: 4,
                        bgcolor: theme.palette.primary.main,
                        boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.2)}`,
                        '&:hover': {
                            bgcolor: theme.palette.primary.dark,
                            boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                        }
                    }}
                >
                    {invoice ? "Update Invoice" : "Generate Invoice"}
                </Button>
            </DialogActions>

            <Snackbar
                open={toast.open}
                autoHideDuration={6000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                TransitionComponent={Zoom}
            >
                <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>
                    {toast.message}
                </Alert>
            </Snackbar>
        </Dialog>
    );
}

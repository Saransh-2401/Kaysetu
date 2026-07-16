"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, IconButton, Button, TextField, InputAdornment,
    Stack, CircularProgress, Tooltip, TablePagination, Avatar, Card, CardContent,
    Grid, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
    Popover, MenuItem, FormControl, InputLabel, Select, TableSortLabel
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

// Icons
import { SearchIcon, FilterListIcon, VisibilityIcon, PictureAsPdfIcon, ShoppingCartIcon, LocalShippingIcon, CheckCircleIcon, ReceiptIcon, AssignmentIcon, PaymentsIcon, InventoryIcon, WarningAmberIcon, CloseIcon, FilterAltIcon, RestartAltIcon, FilterAltOffIcon, RefreshIcon, BlockIcon, AddIcon, AssessmentIcon, PublishedWithChangesIcon, ContentCopyIcon } from "@/components/icons";

import MaterialRequisitionModal from '@/components/shared/MaterialRequisitionModal';
import PurchaseOrderTimelineModal from '@/components/shared/PurchaseOrderTimelineModal';
import PurchaseOrderFormModal from '@/components/purchase/PurchaseOrderFormModal';
import ExpenseReportModal from '@/components/purchase/ExpenseReportModal';
import { purchaseService, PurchaseOrder } from '@/lib/purchase-service';
import { authService } from '@/lib/auth-service';

export default function PurchaseOrdersPage() {
    const theme = useTheme();
    const searchParams = useSearchParams();
    const [currentUser, setCurrentUser] = useState<any>(null);

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' | 'warning' });

    // Filter & Sort State
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState(searchParams.get('payment') || 'all');
    const [supplierFilter, setSupplierFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [orderBy, setOrderBy] = useState<keyof PurchaseOrder>('po_number');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');

    // Payment Dialog State
    const [payDialog, setPayDialog] = useState({ open: false, poId: null as number | null, reference: '' });
    const [saving, setSaving] = useState(false);

    // Receiving Dialog State
    const [receivingDialog, setReceivingDialog] = useState({
        open: false,
        poId: null as number | null,
        poNumber: '',
        items: [] as any[],
        mode: '' as 'stocked' | 'partial' | ''
    });

    // Missing Items Dialog State
    const [missingItemsDialog, setMissingItemsDialog] = useState({
        open: false,
        poId: 0,
        poNumber: '',
        items: [] as any[]
    });

    const [timelineDialog, setTimelineDialog] = useState({
        open: false,
        po: null as PurchaseOrder | null
    });
    const [poTimelineId, setPoTimelineId] = useState<number | null>(null);
    const [closeDialog, setCloseDialog] = useState<{ open: boolean, poId: number | null }>({ open: false, poId: null });

    // Create PO / Expense Report / Override (admin & accounts)
    const [createFormOpen, setCreateFormOpen] = useState(false);
    const [createPrefill, setCreatePrefill] = useState<any>(null);
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [overrideDialog, setOverrideDialog] = useState<{ open: boolean; po: PurchaseOrder | null; receipt_status: string; payment_status: string; notes: string }>(
        { open: false, po: null, receipt_status: '', payment_status: '', notes: '' }
    );

    const canCreatePO = currentUser && ['admin', 'accounts_officer'].includes(currentUser.role);

    const handleOpenCreate = (prefill: any = null) => { setCreatePrefill(prefill); setCreateFormOpen(true); };

    const handleReorder = (row: PurchaseOrder) => {
        const items = (row.items || []).map((it: any) => {
            const amount = Number(it.amount) || 0;
            const taxAmt = (Number(it.cgst_amount) || 0) + (Number(it.sgst_amount) || 0) + (Number(it.igst_amount) || 0);
            const gst = amount > 0 ? Math.round((taxAmt / amount) * 100) : 18;
            return { item: it.item, item_name: it.item_name, quantity: Number(it.quantity) || 1, rate: Number(it.rate) || 0, gst };
        });
        handleOpenCreate({ supplier: row.supplier, items });
    };

    const handleSubmitOverride = async () => {
        if (!overrideDialog.po) return;
        try {
            setSaving(true);
            await purchaseService.overridePurchaseOrderStatus(overrideDialog.po.id, {
                receipt_status: overrideDialog.receipt_status,
                payment_status: overrideDialog.payment_status,
                notes: overrideDialog.notes,
            });
            setSnackbar({ open: true, message: 'Status overridden successfully', severity: 'success' });
            setOverrideDialog({ open: false, po: null, receipt_status: '', payment_status: '', notes: '' });
            fetchData();
        } catch (e: any) {
            setSnackbar({ open: true, message: e?.message || 'Failed to override status', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Material Request View Modal state
    const [mrModal, setMrModal] = useState<{ open: boolean, request: any }>({ open: false, request: null });

    const handleOpenMRModal = async (mrId: number) => {
        try {
            const fullMr = await purchaseService.getMaterialRequest(mrId);
            setMrModal({ open: true, request: fullMr });
        } catch (error) {
            setSnackbar({ open: true, message: 'Failed to fetch Material Request details', severity: 'error' });
            console.error(error);
        }
    };

    const handleOpenTimeline = async (po: PurchaseOrder) => {
        setTimelineDialog({ open: true, po });
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [ordersResp, userResp] = await Promise.all([
                purchaseService.getPurchaseOrders({ page_size: "1000" }),
                authService.getCurrentUser()
            ]);
            setOrders(ordersResp.results || []);
            setCurrentUser(userResp);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setPage(0);
    }, [searchQuery, statusFilter, paymentStatusFilter, supplierFilter, startDate, endDate, order, orderBy]);

    useEffect(() => {
        const urlPayment = searchParams.get('payment');
        const urlStatus = searchParams.get('status');
        if (urlPayment) setPaymentStatusFilter(urlPayment);
        if (urlStatus) setStatusFilter(urlStatus);
    }, [searchParams]);

    // Deep-link params from the Supplier Master (filter to one supplier / highlight a PO)
    const supplierParam = searchParams.get('supplier');
    const highlightId = searchParams.get('highlight');
    // Deep-link from a Material Request: open a specific PO's timeline by po_number.
    const viewPoParam = searchParams.get('view_po');
    const viewPoHandledRef = useRef(false);

    useEffect(() => {
        if (viewPoHandledRef.current || !viewPoParam || orders.length === 0) return;
        const match = orders.find(o => o.po_number === viewPoParam);
        if (match) {
            viewPoHandledRef.current = true;
            handleOpenTimeline(match);
        }
    }, [viewPoParam, orders]);

    // Unique supplier options for the in-page Supplier filter, derived from the
    // loaded orders so no extra request is needed.
    const supplierOptions = useMemo(() => {
        const map = new Map<string, string>();
        orders.forEach((o) => {
            if (o.supplier != null) map.set(String(o.supplier), o.supplier_name || `Supplier #${o.supplier}`);
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [orders]);

    const filtered = useMemo(() => {
        let result = orders.filter(o => {
            const matchesSearch = o.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());

            const effectiveSupplier = supplierFilter !== 'all' ? supplierFilter : supplierParam;
            const matchesSupplier = !effectiveSupplier || String(o.supplier) === effectiveSupplier;

            let matchesStatus = true;
            if (statusFilter !== 'all') {
                if (statusFilter === 'active') {
                    matchesStatus = !['cancelled', 'short_closed'].includes(o.status) &&
                        !['received', 'short_closed', 'cancelled'].includes(o.receipt_status || '');
                } else if (['pending', 'shipment_arrived', 'partially_received', 'received', 'short_closed', 'cancelled'].includes(statusFilter)) {
                    matchesStatus = (o.receipt_status || 'pending') === statusFilter;
                } else {
                    matchesStatus = o.status === statusFilter || o.receipt_status === statusFilter;
                }
            }

            let matchesPayment = true;
            if (paymentStatusFilter !== 'all') {
                matchesPayment = (o.payment_status || 'unpaid') === paymentStatusFilter;
            }

            const matchesDateRange = (!startDate || new Date(o.order_date) >= new Date(startDate)) &&
                (!endDate || new Date(o.order_date) <= new Date(endDate));

            return matchesSearch && matchesStatus && matchesPayment && matchesDateRange && matchesSupplier;
        });

        // Sorting
        result.sort((a, b) => {
            let valA: any = a[orderBy] ?? '';
            let valB: any = b[orderBy] ?? '';

            if (orderBy === 'order_date') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return order === 'asc' ? cmp : -cmp; // Direct return for strings
            }

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [orders, searchQuery, statusFilter, paymentStatusFilter, supplierFilter, startDate, endDate, orderBy, order, supplierParam]);

    const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleFilterClose = () => {
        setAnchorEl(null);
    };

    const handleClearFilters = () => {
        setStatusFilter('all');
        setPaymentStatusFilter('all');
        setSupplierFilter('all');
        setStartDate('');
        setEndDate('');
        setOrderBy('order_date');
        setOrder('desc');
        setSearchQuery('');
    };

    const handleCopyRef = async (ref: string) => {
        try {
            await navigator.clipboard.writeText(ref);
            setSnackbar({ open: true, message: 'Payment reference copied', severity: 'success' });
        } catch {
            setSnackbar({ open: true, message: 'Could not copy reference', severity: 'error' });
        }
    };

    const handleRequestSort = (property: keyof PurchaseOrder) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'default';
            case 'pending_approval': return 'warning';
            case 'approved': return 'info';
            case 'sent_to_supplier': return 'primary';
            case 'completed': return 'success';
            case 'paid': return 'success';
            case 'cancelled': return 'error';
            default: return 'default';
        }
    };

    const getReceiptStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'default';
            case 'shipment_arrived': return 'info';
            case 'partially_received': return 'warning';
            case 'received': return 'success';
            case 'short_closed': return 'secondary';
            case 'cancelled': return 'error';
            default: return 'default';
        }
    };

    const handleCloseOrder = async () => {
        if (!closeDialog.poId) return;
        try {
            setSaving(true);
            const res: any = await purchaseService.closePurchaseOrder(closeDialog.poId);
            setSnackbar({ open: true, message: res.message || "Purchase Order closed", severity: "success" });
            fetchData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Failed to close order", severity: "error" });
        } finally {
            setSaving(false);
            setCloseDialog({ open: false, poId: null });
        }
    };

    const handleMarkPaid = async () => {
        if (!payDialog.poId) return;
        if (!payDialog.reference) {
            setSnackbar({ open: true, message: "Payment reference is required", severity: "warning" });
            return;
        }

        try {
            setSaving(true);
            await purchaseService.markPoPaid(payDialog.poId, payDialog.reference);
            setSnackbar({ open: true, message: "Purchase Order marked as paid", severity: "success" });
            setPayDialog({ ...payDialog, open: false, reference: '' });
            fetchData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Action failed", severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleShipmentArrived = async (poId: number) => {
        try {
            setLoading(true);
            await purchaseService.markShipmentArrived(poId);
            setSnackbar({ open: true, message: "Shipment marked as arrived", severity: "success" });
            fetchData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Failed to update status", severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenReceivingDialog = async (po: PurchaseOrder, mode: 'stocked' | 'partial') => {
        try {
            // Fetch full PO details with items
            const fullPO = await purchaseService.getPurchaseOrder(po.id);
            setReceivingDialog({
                open: true,
                poId: po.id,
                poNumber: po.po_number,
                items: (fullPO.items || []).map((item: any) => ({
                    ...item,
                    original_received: parseFloat(item.received_quantity) || 0,
                    newly_received: ''
                })),
                mode
            });
        } catch (error) {
            setSnackbar({ open: true, message: "Failed to load PO details", severity: "error" });
        }
    };

    const handleMarkStocked = async () => {
        if (!receivingDialog.poId) return;
        try {
            setSaving(true);
            await purchaseService.markPoStocked(receivingDialog.poId);
            setSnackbar({ open: true, message: "All items marked as stocked", severity: "success" });
            setReceivingDialog({ ...receivingDialog, open: false });
            fetchData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Failed to stock items", severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleMarkPartiallyReceived = async () => {
        // Calculate newly_received (delta) for each item
        const itemsWithDelta = receivingDialog.items.map(item => {
            const newlyReceived = parseFloat(item.newly_received) || 0;
            return { ...item, _newly_received: newlyReceived };
        });

        // Validation: at least one item must have newly_received > 0
        const allZero = itemsWithDelta.every(item => item._newly_received <= 0);
        if (allZero) {
            setSnackbar({ open: true, message: "At least one item must have a receiving quantity greater than 0", severity: "warning" });
            return;
        }

        // Validation: no received qty should exceed ordered qty
        const overReceived = itemsWithDelta.find(item => ((item.original_received || 0) + item._newly_received) > parseFloat(item.quantity));
        if (overReceived) {
            setSnackbar({ open: true, message: `Total received quantity for "${overReceived.item_name}" cannot exceed ordered quantity (${overReceived.quantity})`, severity: "warning" });
            return;
        }

        try {
            if (!receivingDialog.poId) return;
            setSaving(true);
            const items = itemsWithDelta.map(item => ({
                id: item.id,
                newly_received: item._newly_received > 0 ? item._newly_received : 0
            }));
            await purchaseService.markPartiallyReceived(receivingDialog.poId, items);
            setSnackbar({ open: true, message: "Items marked as partially received", severity: "success" });
            setReceivingDialog({ ...receivingDialog, open: false });
            fetchData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Failed to update quantities", severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    const updateReceivedQuantity = (itemId: number, quantity: string) => {
        setReceivingDialog({
            ...receivingDialog,
            items: receivingDialog.items.map(item => {
                if (item.id !== itemId) return item;
                if (quantity === '') return { ...item, newly_received: '' };
                let val = parseFloat(quantity);

                // Clamp: don't allow negative or exceed pending qty
                if (isNaN(val) || val < 0) val = 0;

                const maxAllowed = parseFloat(item.quantity) - (item.original_received || 0);
                if (val > maxAllowed) val = maxAllowed;

                return { ...item, newly_received: val };
            })
        });
    };

    const handleOpenMissingItemsDialog = async (po: PurchaseOrder) => {
        try {
            // Fetch full PO details with items
            const fullPO = await purchaseService.getPurchaseOrder(po.id);

            // Filter only items with missing quantities
            const missingItems = (fullPO.items || []).filter((item: any) =>
                item.missing_quantity && item.missing_quantity > 0
            );

            if (missingItems.length === 0) {
                setSnackbar({ open: true, message: "No missing items to receive", severity: "info" });
                return;
            }

            setMissingItemsDialog({
                open: true,
                poId: po.id,
                poNumber: po.po_number,
                items: missingItems
            });
        } catch (error) {
            setSnackbar({ open: true, message: "Failed to load PO details", severity: "error" });
        }
    };

    const handleConfirmMissingReceived = async () => {
        try {
            if (!missingItemsDialog.poId) return;
            setSaving(true);
            await purchaseService.markMissingReceived(missingItemsDialog.poId);
            setSnackbar({ open: true, message: "Missing items confirmed as received", severity: "success" });
            setMissingItemsDialog({ ...missingItemsDialog, open: false });
            fetchData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Failed to confirm receipt", severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadPDF = async (id: number, poNumber: string) => {
        try {
            setLoading(true);
            const blob = await purchaseService.downloadPOPDF(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PO_${poNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            setSnackbar({ open: true, message: "Failed to download PDF", severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600, mx: 'auto' }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    {/* Header */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                        <Box>
                            <Typography variant="h4" fontWeight={900} sx={{ color: 'text.primary', letterSpacing: '-0.02em', mb: 1 }}>
                                Purchase Orders
                            </Typography>
                            <Typography variant="body1" color="text.secondary" fontWeight={500}>
                                Manage external procurement and vendor relations
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1.5}>
                            <Button
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                                onClick={() => { setPage(0); setSearchQuery(''); setStatusFilter('all'); setStartDate(''); setEndDate(''); fetchData(); }}
                                sx={{ borderRadius: 1 }}
                                data-testid="po-refresh-btn"
                            >
                                Refresh
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<AssessmentIcon />}
                                onClick={() => setExpenseOpen(true)}
                                sx={{ borderRadius: 1 }}
                                data-testid="po-expense-report-btn"
                            >
                                Expense Report
                            </Button>
                            {canCreatePO && (
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={() => handleOpenCreate(null)}
                                    sx={{ borderRadius: 1, bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
                                    data-testid="po-create-btn"
                                >
                                    Create PO
                                </Button>
                            )}
                        </Stack>
                    </Stack>

                    {/* Stats Summary */}
                    <Grid container spacing={3} mb={4}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Paper elevation={0} onClick={() => { setStatusFilter('all'); setPaymentStatusFilter('all'); setSearchQuery(''); setStartDate(''); setEndDate(''); setPage(0); }} sx={{ p: 3, borderRadius: 3, border: '1px solid #F1F2F6', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } }}>
                                <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main, width: 56, height: 56, borderRadius: 1, flexShrink: 0 }}>
                                    <ShoppingCartIcon />
                                </Avatar>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Total Orders</Typography>
                                    <Typography variant="h5" fontWeight={900} sx={{ color: 'text.primary', wordBreak: 'break-word', lineHeight: 1.2 }}>{orders.length}</Typography>
                                </Box>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <Paper elevation={0} onClick={() => { setStatusFilter('active'); setPage(0); }} sx={{ p: 3, borderRadius: 3, border: '1px solid #F1F2F6', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } }}>
                                <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.main, width: 56, height: 56, borderRadius: 1, flexShrink: 0 }}>
                                    <LocalShippingIcon />
                                </Avatar>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Active POs</Typography>
                                    <Typography variant="h5" fontWeight={900} sx={{ color: 'text.primary', wordBreak: 'break-word', lineHeight: 1.2 }}>{orders.filter(o => !['cancelled', 'short_closed'].includes(o.status) && !['received', 'short_closed', 'cancelled'].includes(o.receipt_status || '')).length}</Typography>
                                </Box>
                            </Paper>
                        </Grid>
                        {/* Payment-value KPIs are financial: the Warehouse Manager has no
                            authority over payments, so they see receipt-focused cards instead. */}
                        {currentUser?.role === 'warehouse_manager' ? (
                            <>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Paper elevation={0} data-testid="po-kpi-awaiting-receipt" onClick={() => { setStatusFilter('all'); setPaymentStatusFilter('all'); setPage(0); }} sx={{ p: 3, borderRadius: 3, border: '1px solid #F1F2F6', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } }}>
                                        <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main, width: 56, height: 56, borderRadius: 1, flexShrink: 0 }}>
                                            <LocalShippingIcon />
                                        </Avatar>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Awaiting Receipt</Typography>
                                            <Typography variant="h5" fontWeight={900} sx={{ color: 'text.primary', lineHeight: 1.2 }}>{orders.filter(o => ['pending', 'shipment_arrived', 'partially_received'].includes(o.receipt_status || 'pending') && !['cancelled', 'short_closed'].includes(o.status)).length}</Typography>
                                        </Box>
                                    </Paper>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Paper elevation={0} data-testid="po-kpi-received" onClick={() => { setStatusFilter('all'); setPage(0); }} sx={{ p: 3, borderRadius: 3, border: '1px solid #F1F2F6', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } }}>
                                        <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main, width: 56, height: 56, borderRadius: 1, flexShrink: 0 }}>
                                            <CheckCircleIcon />
                                        </Avatar>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Received</Typography>
                                            <Typography variant="h5" fontWeight={900} sx={{ color: theme.palette.success.main, lineHeight: 1.2 }}>{orders.filter(o => o.receipt_status === 'received').length}</Typography>
                                        </Box>
                                    </Paper>
                                </Grid>
                            </>
                        ) : (
                            <>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Paper elevation={0} data-testid="po-kpi-paid" onClick={() => { setPaymentStatusFilter('paid'); setPage(0); }} sx={{ p: 3, borderRadius: 3, border: '1px solid #F1F2F6', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } }}>
                                        <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: theme.palette.success.main, width: 56, height: 56, borderRadius: 1, flexShrink: 0 }}>
                                            <CheckCircleIcon />
                                        </Avatar>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>TOTAL PAID</Typography>
                                            <Typography variant="h6" fontWeight={900} sx={{ color: theme.palette.success.main, wordBreak: 'break-word', lineHeight: 1.2 }}>₹{orders.filter(o => o.payment_status === 'paid').reduce((acc, curr) => acc + (Number(curr.total) || 0), 0).toLocaleString()}</Typography>
                                        </Box>
                                    </Paper>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <Paper elevation={0} data-testid="po-kpi-pending-payment" onClick={() => { setPaymentStatusFilter('unpaid'); setPage(0); }} sx={{ p: 3, borderRadius: 3, border: '1px solid #F1F2F6', display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } }}>
                                        <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: theme.palette.error.main, width: 56, height: 56, borderRadius: 1, flexShrink: 0 }}>
                                            <WarningAmberIcon />
                                        </Avatar>
                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>PENDING PAYMENT</Typography>
                                            <Typography variant="h6" fontWeight={900} sx={{ color: theme.palette.error.main, wordBreak: 'break-word', lineHeight: 1.2 }}>₹{orders.filter(o => o.payment_status !== 'paid').reduce((acc, curr) => acc + (Number(curr.total) || 0), 0).toLocaleString()}</Typography>
                                        </Box>
                                    </Paper>
                                </Grid>
                            </>
                        )}
                    </Grid>

                    <Button
                        onClick={() => fetchData()}
                        sx={{ mb: 2, display: 'none' }} // Hidden helper for refresh
                    />

                    {/* Table Control */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2.5,
                            mb: 3,
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            border: '1px solid #F1F2F6',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.02)'
                        }}
                    >
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, md: 3 }}>
                                <TextField
                                    fullWidth
                                    placeholder="Search by PO# or Supplier..."
                                    size="small"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover', borderRadius: 1.5, border: 'none' } }}
                                />
                            </Grid>

                            <Grid size={{ xs: 12, md: 2 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value={statusFilter}
                                        label="Status"
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        sx={{ borderRadius: 1.5, bgcolor: 'action.hover' }}
                                    >
                                        <MenuItem value="all">All Statuses</MenuItem>
                                        <MenuItem value="pending">Pending</MenuItem>
                                        <MenuItem value="shipment_arrived">Shipment Arrived</MenuItem>
                                        <MenuItem value="partially_received">Partially Received</MenuItem>
                                        <MenuItem value="received">Received</MenuItem>
                                        <MenuItem value="short_closed">Short Closed</MenuItem>
                                        <MenuItem value="cancelled">Cancelled</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid size={{ xs: 12, md: 2 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Payment</InputLabel>
                                    <Select
                                        value={paymentStatusFilter}
                                        label="Payment"
                                        onChange={(e) => setPaymentStatusFilter(e.target.value)}
                                        sx={{ borderRadius: 1.5, bgcolor: 'action.hover' }}
                                    >
                                        <MenuItem value="all">All Statuses</MenuItem>
                                        <MenuItem value="unpaid">Unpaid</MenuItem>
                                        <MenuItem value="paid">Paid</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid size={{ xs: 12, md: 2 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Supplier</InputLabel>
                                    <Select
                                        value={supplierFilter}
                                        label="Supplier"
                                        onChange={(e) => setSupplierFilter(e.target.value)}
                                        sx={{ borderRadius: 1.5, bgcolor: 'action.hover' }}
                                        data-testid="po-supplier-filter"
                                    >
                                        <MenuItem value="all">All Suppliers</MenuItem>
                                        {supplierOptions.map((s) => (
                                            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid size={{ xs: 12, md: 3 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <TextField
                                        type="date"
                                        size="small"
                                        label="From"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'action.hover' } }}
                                    />
                                    <TextField
                                        type="date"
                                        size="small"
                                        label="To"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'action.hover' } }}
                                    />
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                {(statusFilter !== 'all' || paymentStatusFilter !== 'all' || supplierFilter !== 'all' || startDate || endDate || searchQuery) && (
                                    <Tooltip title="Reset Filters">
                                        <IconButton
                                            onClick={handleClearFilters}
                                            sx={{
                                                bgcolor: alpha(theme.palette.error.main, 0.08),
                                                color: theme.palette.error.main,
                                                '&:hover': {
                                                    bgcolor: alpha(theme.palette.error.main, 0.15),
                                                    color: theme.palette.error.dark,
                                                    transform: 'scale(1.1) rotate(-10deg)',
                                                },
                                                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                width: 44,
                                                height: 44,
                                                border: `1.5px solid ${alpha(theme.palette.error.main, 0.15)}`,
                                                boxShadow: `0 2px 8px ${alpha(theme.palette.error.main, 0.1)}`
                                            }}
                                        >
                                            <FilterAltOffIcon sx={{ fontSize: 22 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Grid>
                        </Grid>
                    </Paper>

                    {supplierParam && (
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1.5}
                            sx={{
                                mb: 2,
                                px: 2,
                                py: 1.2,
                                borderRadius: 1.5,
                                bgcolor: alpha(theme.palette.primary.main, 0.06),
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            }}
                        >
                            <Typography variant="body2" fontWeight={700} color="primary">
                                Showing purchase orders for: {orders.find(o => String(o.supplier) === supplierParam)?.supplier_name || `Supplier #${supplierParam}`}
                            </Typography>
                            <Button
                                size="small"
                                onClick={() => window.location.assign('/purchase-orders')}
                                sx={{ textTransform: 'none', ml: 'auto' }}
                            >
                                Clear
                            </Button>
                        </Stack>
                    )}

                    {/* Table */}
                    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 1, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                        <Table>
                            <TableHead sx={{ bgcolor: 'action.hover' }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary', py: 2 }}>
                                        <TableSortLabel
                                            active={orderBy === 'po_number'}
                                            direction={orderBy === 'po_number' ? order : 'asc'}
                                            onClick={() => handleRequestSort('po_number')}
                                            sx={{ '&.Mui-active': { color: 'primary.main' }, '& .MuiTableSortLabel-icon': { color: 'primary.main !important' } }}
                                        >
                                            PO Number
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'supplier_name'}
                                            direction={orderBy === 'supplier_name' ? order : 'asc'}
                                            onClick={() => handleRequestSort('supplier_name')}
                                            sx={{ '&.Mui-active': { color: 'primary.main' }, '& .MuiTableSortLabel-icon': { color: 'primary.main !important' } }}
                                        >
                                            Supplier
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'order_date'}
                                            direction={orderBy === 'order_date' ? order : 'asc'}
                                            onClick={() => handleRequestSort('order_date')}
                                            sx={{ '&.Mui-active': { color: 'primary.main' }, '& .MuiTableSortLabel-icon': { color: 'primary.main !important' } }}
                                        >
                                            Order Date
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'material_request_number' as any}
                                            direction={orderBy === 'material_request_number' as any ? order : 'asc'}
                                            onClick={() => handleRequestSort('material_request_number' as any)}
                                            sx={{ '&.Mui-active': { color: 'primary.main' }, '& .MuiTableSortLabel-icon': { color: 'primary.main !important' } }}
                                        >
                                            Source MR
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'total'}
                                            direction={orderBy === 'total' ? order : 'asc'}
                                            onClick={() => handleRequestSort('total')}
                                            sx={{ '&.Mui-active': { color: 'primary.main' }, '& .MuiTableSortLabel-icon': { color: 'primary.main !important' } }}
                                        >
                                            Amount
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'payment_status'}
                                            direction={orderBy === 'payment_status' ? order : 'asc'}
                                            onClick={() => handleRequestSort('payment_status')}
                                            sx={{ '&.Mui-active': { color: 'primary.main' }, '& .MuiTableSortLabel-icon': { color: 'primary.main !important' } }}
                                        >
                                            Payment Status
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>Receipt</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}><CircularProgress /></TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} align="center" sx={{ py: 10 }}>No Purchase Orders found.</TableCell></TableRow>
                                ) : paginated.map((row) => (
                                    <TableRow key={row.id} hover sx={{ '& td': { py: 2.5 }, ...(highlightId && String(row.id) === highlightId ? { bgcolor: alpha(theme.palette.primary.main, 0.1) } : {}) }}>
                                        <TableCell>
                                            <Tooltip
                                                arrow
                                                disableHoverListener={!row.items || row.items.length === 0}
                                                title={
                                                    (row.items && row.items.length > 0) ? (
                                                        <Box sx={{ py: 0.5, maxWidth: 280 }}>
                                                            <Typography variant="caption" fontWeight={800} sx={{ display: 'block', mb: 0.5 }}>
                                                                {row.items.length} item{row.items.length > 1 ? 's' : ''}
                                                            </Typography>
                                                            {row.items.slice(0, 8).map((it: any, i: number) => (
                                                                <Typography key={i} variant="caption" component="div">
                                                                    • {it.item_name} — {Number(it.quantity)} × ₹{Number(it.rate).toLocaleString()}
                                                                </Typography>
                                                            ))}
                                                            {row.items.length > 8 && (
                                                                <Typography variant="caption" component="div" sx={{ fontStyle: 'italic' }}>
                                                                    +{row.items.length - 8} more…
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    ) : ''
                                                }
                                            >
                                                <Typography variant="subtitle2" fontWeight={800} sx={{ display: 'inline-block', cursor: (row.items && row.items.length > 0) ? 'help' : 'default' }} data-testid={`po-items-preview-${row.id}`}>
                                                    {row.po_number}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 180 }}>
                                            <Typography variant="body2" fontWeight={700} noWrap title={row.supplier_name}>
                                                {row.supplier_name && row.supplier_name.length > 25 ? `${row.supplier_name.slice(0, 25)}…` : row.supplier_name}
                                            </Typography>
                                            {row.supplier_business_name && (
                                                <Typography variant="caption" color="text.secondary" noWrap title={row.supplier_business_name}>
                                                    {row.supplier_business_name.length > 25 ? `${row.supplier_business_name.slice(0, 25)}…` : row.supplier_business_name}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell><Typography variant="body2">{new Date(row.order_date).toLocaleDateString()}</Typography></TableCell>
                                        <TableCell>
                                            {row.material_request_number && row.material_request ? (
                                                <Tooltip title={`${row.material_request_number} — view Material Request`}>
                                                    <Chip
                                                        label={row.material_request_number}
                                                        size="small"
                                                        variant="outlined"
                                                        color="primary"
                                                        data-testid={`po-mr-chip-${row.id}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenMRModal(row.material_request!);
                                                        }}
                                                        sx={{
                                                            fontWeight: 700,
                                                            borderRadius: 1,
                                                            cursor: 'pointer',
                                                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                                                        }}
                                                    />
                                                </Tooltip>
                                            ) : (
                                                <Typography variant="caption" color="text.secondary">—</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell><Typography variant="subtitle2" fontWeight={800} color="primary">Rs. {Number(row.total)?.toLocaleString()}</Typography></TableCell>
                                        <TableCell>
                                            <Stack spacing={0.5}>
                                                <Chip
                                                    label={(row.payment_status || 'unpaid').toUpperCase()}
                                                    size="small"
                                                    color={getStatusColor(row.payment_status || 'unpaid') as any}
                                                    sx={{ fontWeight: 800, borderRadius: 1.5, fontSize: '0.65rem' }}
                                                />
                                                {row.payment_reference && (
                                                    <Stack direction="row" alignItems="center" spacing={0.25} sx={{ maxWidth: 160 }}>
                                                        <Typography variant="caption" color="text.secondary" fontWeight={700} noWrap title={row.payment_reference}>
                                                            Ref: {row.payment_reference}
                                                        </Typography>
                                                        <Tooltip title="Copy reference">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => { e.stopPropagation(); handleCopyRef(row.payment_reference!); }}
                                                                data-testid={`po-copy-ref-${row.id}`}
                                                                sx={{ p: 0.2 }}
                                                            >
                                                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Stack>
                                                )}
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={(row.receipt_status || 'pending').replace(/_/g, ' ').toUpperCase()}
                                                variant="outlined"
                                                size="small"
                                                color={getReceiptStatusColor(row.receipt_status || 'pending') as any}
                                                sx={{ fontWeight: 800, borderRadius: 1.5, fontSize: '0.65rem' }}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="View Details">
                                                    <IconButton size="small" onClick={() => handleOpenTimeline(row)}><VisibilityIcon sx={{ fontSize: 20 }} /></IconButton>
                                                </Tooltip>

                                                {/* Admin/Accounts: Create a new PO from this one (reorder) */}
                                                {canCreatePO && (
                                                    <Tooltip title="Create PO from this (Reorder)">
                                                        <IconButton size="small" onClick={() => handleReorder(row)} sx={{ color: 'primary.main' }} data-testid={`po-reorder-${row.id}`}>
                                                            <ContentCopyIcon sx={{ fontSize: 19 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Admin: Override status */}
                                                {currentUser?.role === 'admin' && (
                                                    <Tooltip title="Override Status">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setOverrideDialog({ open: true, po: row, receipt_status: row.receipt_status || 'pending', payment_status: row.payment_status || 'unpaid', notes: '' })}
                                                            sx={{ color: 'secondary.main' }}
                                                            data-testid={`po-override-${row.id}`}
                                                        >
                                                            <PublishedWithChangesIcon sx={{ fontSize: 20 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Warehouse Manager: Shipment Arrived */}
                                                {currentUser?.role === 'warehouse_manager' && row.receipt_status === 'pending' && (
                                                    <Tooltip title="Mark Shipment Arrived">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleShipmentArrived(row.id)}
                                                            sx={{ color: 'info.main' }}
                                                        >
                                                            <LocalShippingIcon sx={{ fontSize: 20 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Warehouse Manager: Mark as Stocked (Full Receipt) */}
                                                {currentUser?.role === 'warehouse_manager' && row.receipt_status === 'shipment_arrived' && (
                                                    <Tooltip title="Mark as Stocked">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenReceivingDialog(row, 'stocked')}
                                                            sx={{ color: 'success.main' }}
                                                        >
                                                            <InventoryIcon sx={{ fontSize: 20 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Warehouse Manager: Partially Received */}
                                                {currentUser?.role === 'warehouse_manager' && (row.receipt_status === 'shipment_arrived' || row.receipt_status === 'partially_received') && (
                                                    <Tooltip title="Partially Received">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenReceivingDialog(row, 'partial')}
                                                            sx={{ color: 'warning.main' }}
                                                        >
                                                            <WarningAmberIcon sx={{ fontSize: 20 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Warehouse Manager: Confirm Missing Items Received */}
                                                {currentUser?.role === 'warehouse_manager' && row.receipt_status === 'partially_received' && (
                                                    <Tooltip title="Confirm Missing Items Received">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenMissingItemsDialog(row)}
                                                            sx={{ color: 'secondary.main' }}
                                                        >
                                                            <CheckCircleIcon sx={{ fontSize: 20 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Accounts/Admin: Mark as Paid */}
                                                {(currentUser?.role === 'accounts_officer' || currentUser?.role === 'admin') && row.payment_status !== 'paid' && row.receipt_status !== 'cancelled' && (
                                                    <Tooltip title="Mark as Paid">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setPayDialog({ open: true, poId: row.id, reference: '' })}
                                                            sx={{ color: 'success.main' }}
                                                        >
                                                            <PaymentsIcon sx={{ fontSize: 20 }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Admin / Accounts Officer: Short Close / Cancel */}
                                                {(currentUser?.role === 'admin' || currentUser?.role === 'accounts_officer') &&
                                                    !['received', 'short_closed', 'cancelled'].includes(row.receipt_status || '') && (
                                                        <Tooltip title="Short Close / Cancel Order">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setCloseDialog({ open: true, poId: row.id })}
                                                                sx={{ color: 'warning.main' }}
                                                            >
                                                                <BlockIcon sx={{ fontSize: 20 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                <Tooltip title="Download PDF">
                                                    <IconButton size="small" onClick={() => handleDownloadPDF(row.id, row.po_number)}>
                                                        <PictureAsPdfIcon sx={{ fontSize: 20, color: 'error.main' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filtered.length}
                        page={page}
                        onPageChange={(e, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                    />

                    {/* Close / Cancel Dialog */}
                    <Dialog open={closeDialog.open} onClose={() => setCloseDialog({ open: false, poId: null })} PaperProps={{ sx: { borderRadius: 3, p: 2, bgcolor: 'background.paper' } }}>
                        <DialogTitle sx={{ fontWeight: 900, color: 'error.main', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Close / Cancel Purchase Order
                            <IconButton onClick={() => setCloseDialog({ open: false, poId: null })} size="small"><CloseIcon /></IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <Typography variant="body2" color="text.secondary" mb={3} mt={1}>
                                Are you sure you want to close this Purchase Order?
                            </Typography>
                            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.04), borderRadius: 2, border: `1px solid ${alpha(theme.palette.error.main, 0.1)}` }}>
                                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                                    • If no items have been received, the order will be marked as <strong style={{ color: theme.palette.error.main }}>Cancelled</strong>.
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    • If some items were received, the order will be marked as <strong style={{ color: theme.palette.warning.dark }}>Short Closed</strong>.
                                </Typography>
                            </Box>
                        </DialogContent>
                        <DialogActions sx={{ p: 2 }}>
                            <Button onClick={() => setCloseDialog({ open: false, poId: null })} variant="text" sx={{ fontWeight: 800, color: 'text.primary' }}>Cancel</Button>
                            <Button onClick={handleCloseOrder} variant="contained" disabled={saving} sx={{ borderRadius: 2, px: 3, py: 1, fontWeight: 800, bgcolor: theme.palette.error.main, '&:hover': { bgcolor: theme.palette.error.dark } }}>Confirm</Button>
                        </DialogActions>
                    </Dialog>

                    {/* Payment Dialog */}
                    <Dialog open={payDialog.open} onClose={() => setPayDialog({ ...payDialog, open: false })} PaperProps={{ sx: { borderRadius: 3, p: 2, bgcolor: 'background.paper' } }}>
                        <DialogTitle sx={{ fontWeight: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            Confirm Payment
                            <IconButton onClick={() => setPayDialog({ ...payDialog, open: false })} size="small"><CloseIcon /></IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <Typography variant="body2" color="text.secondary" mb={3} mt={1}>
                                Enter the payment reference (UTR, Cheque No, Transaction ID) to mark this PO as paid.
                            </Typography>
                            <TextField
                                autoFocus
                                fullWidth
                                label="Payment Reference"
                                variant="outlined"
                                value={payDialog.reference}
                                onChange={(e) => setPayDialog({ ...payDialog, reference: e.target.value })}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'background.paper' } }}
                            />
                        </DialogContent>
                        <DialogActions sx={{ p: 2 }}>
                            <Button onClick={() => setPayDialog({ ...payDialog, open: false })} sx={{ fontWeight: 800, color: 'text.primary' }}>Cancel</Button>
                            <Button
                                variant="contained"
                                onClick={handleMarkPaid}
                                disabled={saving}
                                sx={{ borderRadius: 2, px: 3, py: 1, fontWeight: 800, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' }, color: '#FFF' }}
                            >
                                {saving ? <CircularProgress size={24} color="inherit" /> : "Mark Paid"}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Receiving Dialog (Stocked / Partially Received) */}
                    <Dialog
                        open={receivingDialog.open}
                        onClose={() => setReceivingDialog({ ...receivingDialog, open: false })}
                        maxWidth="md"
                        fullWidth
                        PaperProps={{ sx: { borderRadius: 3, p: 2, bgcolor: 'background.paper' } }}
                    >
                        <DialogTitle sx={{ fontWeight: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {receivingDialog.mode === 'stocked' ? <InventoryIcon sx={{ color: 'success.main' }} /> : <WarningAmberIcon sx={{ color: theme.palette.warning.main }} />}
                                {receivingDialog.mode === 'stocked' ? 'Mark as Stocked' : 'Partially Received'}
                            </Box>
                            <IconButton onClick={() => setReceivingDialog({ ...receivingDialog, open: false })} size="small"><CloseIcon /></IconButton>
                        </DialogTitle>
                        <DialogContent sx={{ borderTop: 'none', pt: 0 }}>
                            <Typography variant="body2" color="text.secondary" mb={3} mt={1}>
                                {receivingDialog.mode === 'stocked'
                                    ? `Confirm that all items from PO ${receivingDialog.poNumber} have been received and stocked.`
                                    : `Enter the actual quantities received for PO ${receivingDialog.poNumber}. Missing items will be tracked.`
                                }
                            </Typography>

                            <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, borderRadius: 2, bgcolor: 'background.paper' }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 800 }}>Item</TableCell>
                                            <TableCell sx={{ fontWeight: 800 }} align="right">Ordered</TableCell>
                                            {receivingDialog.mode === 'partial' && (
                                                <>
                                                    <TableCell sx={{ fontWeight: 800 }} align="right">Prev. Received</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }} align="right">Pending</TableCell>
                                                    <TableCell sx={{ fontWeight: 800 }} align="right">Receiving Now</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {receivingDialog.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <Typography fontWeight={700}>{item.item_name}</Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Chip
                                                        label={`${item.quantity}`}
                                                        size="small"
                                                        sx={{ fontWeight: 700 }}
                                                    />
                                                </TableCell>
                                                {receivingDialog.mode === 'partial' && (
                                                    <>
                                                        <TableCell align="right">
                                                            <Typography fontWeight={600} color="text.secondary">{item.original_received}</Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Chip
                                                                label={`${parseFloat(item.quantity) - item.original_received}`}
                                                                size="small"
                                                                color={(parseFloat(item.quantity) - item.original_received) > 0 ? "warning" : "default"}
                                                                sx={{ fontWeight: 700 }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <TextField
                                                                type="number"
                                                                size="small"
                                                                value={item.newly_received !== undefined ? item.newly_received : ''}
                                                                onChange={(e) => updateReceivedQuantity(item.id, e.target.value)}
                                                                inputProps={{ min: 0, max: parseFloat(item.quantity) - item.original_received, step: 0.1 }}
                                                                sx={{
                                                                    width: 120,
                                                                    '& .MuiOutlinedInput-root': { borderRadius: 2 }
                                                                }}
                                                            />
                                                        </TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </DialogContent>
                        <DialogActions sx={{ p: 2 }}>
                            <Button
                                onClick={() => setReceivingDialog({ ...receivingDialog, open: false })}
                                variant="text"
                                sx={{ fontWeight: 800, color: 'text.primary' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={receivingDialog.mode === 'stocked' ? handleMarkStocked : handleMarkPartiallyReceived}
                                disabled={saving}
                                sx={{
                                    borderRadius: 2,
                                    px: 3,
                                    py: 1,
                                    fontWeight: 800,
                                    bgcolor: receivingDialog.mode === 'stocked' ? theme.palette.success.main : theme.palette.primary.main,
                                    color: '#fff',
                                    '&:hover': {
                                        bgcolor: receivingDialog.mode === 'stocked' ? theme.palette.success.dark : theme.palette.primary.dark
                                    }
                                }}
                            >
                                {saving ? <CircularProgress size={24} color="inherit" /> : (
                                    receivingDialog.mode === 'stocked' ? 'Confirm & Stock All' : 'Save Partial Receipt'
                                )}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Missing Items Confirmation Dialog */}
                    <Dialog
                        open={missingItemsDialog.open}
                        onClose={() => setMissingItemsDialog({ ...missingItemsDialog, open: false })}
                        maxWidth="md"
                        fullWidth
                        PaperProps={{ sx: { borderRadius: 3, p: 2, bgcolor: 'background.paper' } }}
                    >
                        <DialogTitle sx={{ fontWeight: 900, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CheckCircleIcon sx={{ color: 'success.main' }} />
                                Confirm Missing Items Received
                            </Box>
                            <IconButton onClick={() => setMissingItemsDialog({ ...missingItemsDialog, open: false })} size="small"><CloseIcon /></IconButton>
                        </DialogTitle>
                        <DialogContent dividers sx={{ borderBottom: 'none' }}>
                            <Typography variant="body2" color="text.secondary" mb={3} mt={1}>
                                Confirm that the following missing items from PO {missingItemsDialog.poNumber} have now been received.
                            </Typography>

                            <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, borderRadius: 2, bgcolor: 'background.paper' }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 800 }}>Item</TableCell>
                                            <TableCell sx={{ fontWeight: 800 }} align="right">Missing Qty</TableCell>
                                            <TableCell sx={{ fontWeight: 800 }} align="right">Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {missingItemsDialog.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <Typography fontWeight={700}>{item.item_name}</Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Chip
                                                        label={`${item.missing_quantity}`}
                                                        size="small"
                                                        color="warning"
                                                        sx={{ fontWeight: 700 }}
                                                    />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Chip
                                                        label="Pending"
                                                        size="small"
                                                        color="error"
                                                        variant="outlined"
                                                        sx={{ fontWeight: 700 }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Box sx={{ mt: 3, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 2 }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <WarningAmberIcon sx={{ color: theme.palette.warning.dark }} />
                                    <Typography variant="body2" fontWeight={600}>
                                        This will mark all missing items as received and update inventory.
                                    </Typography>
                                </Stack>
                            </Box>
                        </DialogContent>
                        <DialogActions sx={{ p: 3 }}>
                            <Button
                                onClick={() => setMissingItemsDialog({ ...missingItemsDialog, open: false })}
                                variant="text"
                                sx={{ fontWeight: 800, color: 'text.primary' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleConfirmMissingReceived}
                                disabled={saving}
                                sx={{
                                    borderRadius: 2,
                                    px: 3,
                                    py: 1,
                                    fontWeight: 800,
                                    bgcolor: 'primary.main',
                                    color: '#FFF',
                                    '&:hover': {
                                        bgcolor: 'primary.dark'
                                    }
                                }}
                            >
                                {saving ? <CircularProgress size={24} color="inherit" /> : 'Confirm All Received'}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Material Request View Modal */}
                    <MaterialRequisitionModal
                        open={mrModal.open}
                        onClose={() => setMrModal({ open: false, request: null })}
                        onSave={async () => { }}
                        request={mrModal.request}
                        isViewOnly={true}
                        currentUser={currentUser}
                        rawMaterials={[]}
                        suppliers={[]}
                        saving={false}
                    />

                    {/* Timeline Dialog */}
                    <PurchaseOrderTimelineModal
                        open={timelineDialog.open || !!poTimelineId}
                        onClose={() => {
                            setTimelineDialog({ open: false, po: null });
                            setPoTimelineId(null);
                        }}
                        poId={poTimelineId}
                        poDetails={timelineDialog.po}
                        onOpenMRModal={handleOpenMRModal}
                    />

                    {/* Create / Reorder PO */}
                    <PurchaseOrderFormModal
                        open={createFormOpen}
                        onClose={() => setCreateFormOpen(false)}
                        prefill={createPrefill}
                        onCreated={(poNumber) => { setSnackbar({ open: true, message: `Purchase Order ${poNumber} created`, severity: 'success' }); fetchData(); }}
                    />

                    {/* Expense Report */}
                    <ExpenseReportModal open={expenseOpen} onClose={() => setExpenseOpen(false)} />

                    {/* Admin: Override Status */}
                    <Dialog open={overrideDialog.open} onClose={() => setOverrideDialog({ ...overrideDialog, open: false })} maxWidth="xs" fullWidth>
                        <DialogTitle sx={{ fontWeight: 800 }}>Override PO Status</DialogTitle>
                        <DialogContent dividers>
                            <Stack spacing={2.5} sx={{ mt: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">
                                    {overrideDialog.po?.po_number} — admin override (recorded in the timeline).
                                </Typography>
                                <TextField
                                    select fullWidth label="Receipt Status"
                                    value={overrideDialog.receipt_status}
                                    onChange={(e) => setOverrideDialog({ ...overrideDialog, receipt_status: e.target.value })}
                                    data-testid="po-override-receipt-select"
                                >
                                    {['pending', 'shipment_arrived', 'partially_received', 'received', 'short_closed', 'cancelled'].map((s) => (
                                        <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    select fullWidth label="Payment Status"
                                    value={overrideDialog.payment_status}
                                    onChange={(e) => setOverrideDialog({ ...overrideDialog, payment_status: e.target.value })}
                                    data-testid="po-override-payment-select"
                                >
                                    {['unpaid', 'partially_paid', 'paid'].map((s) => (
                                        <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>
                                    ))}
                                </TextField>
                                <TextField
                                    fullWidth label="Notes (optional)" multiline rows={2}
                                    value={overrideDialog.notes}
                                    onChange={(e) => setOverrideDialog({ ...overrideDialog, notes: e.target.value })}
                                />
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 2 }}>
                            <Button onClick={() => setOverrideDialog({ ...overrideDialog, open: false })} color="inherit">Cancel</Button>
                            <Button variant="contained" onClick={handleSubmitOverride} disabled={saving} data-testid="po-override-submit-btn" sx={{ bgcolor: 'secondary.main', '&:hover': { bgcolor: 'secondary.dark' } }}>
                                {saving ? <CircularProgress size={20} color="inherit" /> : 'Override'}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 1, fontWeight: 700 }}>{snackbar.message}</Alert>
                    </Snackbar>
                </motion.div>
            </Box>
        </>
    );
}

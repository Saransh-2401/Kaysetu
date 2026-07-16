"use client";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Box,
    Paper,
    Typography,
    Button,
    Stack,
    TextField,
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Tooltip,
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    useTheme,
    alpha,
    CircularProgress,
    Divider,
    Card,
    CardContent,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Switch,
    FormControlLabel,
    ToggleButtonGroup,
    ToggleButton,
    Snackbar,
    Alert,
    Stepper,
    Step,
    StepLabel,
    StepConnector,
    stepConnectorClasses,
    ListItem,
    ListItemIcon,
    ListItemText,
    Autocomplete,
    TableSortLabel,
    Tabs,
    Tab,
} from "@mui/material";
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { SearchIcon, FilterAltOffIcon, RefreshIcon, VisibilityIcon, CheckCircleIcon, LocalShippingIcon, InventoryIcon, ReceiptIcon, PaymentIcon, CloseIcon, BlockIcon, WarningAmberIcon, PictureAsPdfIcon, FactoryIcon, PercentIcon, CurrencyRupeeIcon, AddCircleOutlineIcon, WatchLaterIcon, InfoIcon, AssignmentIcon, CheckIcon, EditIcon, AddIcon, RemoveIcon, DeleteOutlineIcon, PostAddIcon, HistoryIcon, ShoppingBagIcon, OpenInNewIcon } from "@/components/icons";

import { distributorService, StockRequest, StockRequestInvoiceItem } from "@/lib/distributor-service";
import { authService } from "@/lib/auth-service";
import { formatDRFError } from "@/lib/utils";
import { mastersService, TaxSlab } from "@/lib/masters-service";
import InvoiceModal from "@/components/distributor/InvoiceModal";

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.root}`]: {
        marginLeft: 15, // Aligned with the smaller 32px icon
    },
    [`& .${stepConnectorClasses.line}`]: {
        borderLeftWidth: 2,
        minHeight: 24, // Minimal vertical space
        borderColor: theme.palette.divider,
    },
    [`&.${stepConnectorClasses.active}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            borderColor: theme.palette.success.main,
        },
    },
    [`&.${stepConnectorClasses.completed}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            borderColor: theme.palette.success.main,
        },
    },
}));

function TimelineStepIcon(props: any) {
    const theme = useTheme();
    const { active, completed, icon } = props;

    const icons: Record<string, React.ReactElement> = {
        '1': <AddCircleOutlineIcon sx={{ fontSize: 16 }} />,
        '2': <CheckCircleIcon sx={{ fontSize: 16 }} />,
        '3': <InventoryIcon sx={{ fontSize: 16 }} />,
        '4': <LocalShippingIcon sx={{ fontSize: 16 }} />,
        '5': <CheckIcon sx={{ fontSize: 16 }} />,
        '6': <ReceiptIcon sx={{ fontSize: 16 }} />,
        '7': <PaymentIcon sx={{ fontSize: 16 }} />,
    };

    return (
        <Box sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: (active || completed) ? alpha(theme.palette.success.main, 0.1) : theme.palette.background.paper,
            color: (active || completed) ? theme.palette.success.main : theme.palette.text.disabled,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            border: `1px solid ${(active || completed) ? alpha(theme.palette.success.main, 0.2) : theme.palette.divider}`,
        }}>
            {icons[String(icon)]}
        </Box>
    );
}

export default function StockRequestsPage() {
    return (
        <Suspense fallback={<CircularProgress />}>
            <StockRequestsContent />
        </Suspense>
    );
}

// Quantities without noisy trailing decimals (10.000 -> 10).
const fmtQty = (n: any) => {
    const v = Number(n) || 0;
    return Number.isInteger(v)
        ? v.toLocaleString("en-IN")
        : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

function StockRequestsContent() {
    const theme = useTheme();
    const searchParams = useSearchParams();
    const router = useRouter();

    // State
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [userRole, setUserRole] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
    const [paymentFilter, setPaymentFilter] = useState<string>("all");
    const [scopeFilter, setScopeFilter] = useState<string>("all");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [inventoryStatus, setInventoryStatus] = useState<any[]>([]);
    const [checkingInventory, setCheckingInventory] = useState(false);
    const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);

    // Sorting State
    const [orderBy, setOrderBy] = useState<string>("request_date");
    const [order, setOrder] = useState<"asc" | "desc">("desc");

    // Edit State
    const [backorderDetailOpen, setBackorderDetailOpen] = useState(false);
    const [logTab, setLogTab] = useState(0);
    const [editOpen, setEditOpen] = useState(false);
    const [editItems, setEditItems] = useState<any[]>([]);
    const [editDescription, setEditDescription] = useState("");
    const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelling, setCancelling] = useState(false);
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [savingEdit, setSavingEdit] = useState(false);

    const findTaxRate = (hsn: string) => {
        if (!hsn) return 0;
        const slab = taxSlabs.find(s => s.hsn_codes.includes(hsn));
        return slab ? slab.percentage : 0;
    };

    const getTimelineData = (req: StockRequest) => {
        const packLog = req.status_logs?.find(log => log.to_status === 'packed');
        const partialDeliveryLog = req.status_logs?.find(log => log.to_status === 'partially_delivered');

        const isProductionOnly = req.status === 'in_production' || req.status === 'backordered';
        const hasShortage = req.has_shortage || req.status === 'partial_fulfilled';

        const steps = [
            { label: 'Created', date: req.request_date },
            ...(isProductionOnly ? [
                { label: 'Sent for Production', date: req.approved_at || req.updated_at }
            ] : hasShortage ? [
                { label: 'Partial Approved', date: req.approved_at }
            ] : [
                { label: 'Approved', date: req.approved_at }
            ]),
            ...(isProductionOnly ? [] : [
                { label: 'Packed', date: req.packed_at || packLog?.changed_at || (['packed', 'in_transit', 'partially_delivered', 'delivered'].includes(req.status) ? (req.status === 'packed' ? req.updated_at : null) : null) },
                { label: 'In Transit', date: req.dispatched_at },
                ...(hasShortage ? [
                    { label: 'Partially Delivered', date: req.status === 'partially_delivered' ? req.updated_at : partialDeliveryLog?.changed_at },
                ] : []),
                { label: 'Delivered', date: req.delivered_at },
            ])
        ];

        let activeStep = 0;
        if (isProductionOnly) {
            activeStep = 2; // Created, Sent for Production (both done)
        } else {
            if (req.status === 'delivered') activeStep = hasShortage ? 5 : 4;
            else if (req.status === 'partially_delivered') activeStep = hasShortage ? 4 : 4;
            else if (req.status === 'in_transit') activeStep = 3;
            else if (req.status === 'packed') activeStep = 2;
            else if (req.status === 'partial_fulfilled' || req.status === 'approved') activeStep = 1;
            else if (req.status === 'pending') activeStep = 0;
        }

        return { steps, activeStep };
    };

    // Invoice Modal State
    const [invoiceOpen, setInvoiceOpen] = useState(false);
    const [initialTrigger, setInitialTrigger] = useState<'stock_request' | 'backorder'>('stock_request');
    const [invoiceNotes, setInvoiceNotes] = useState("");
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [paymentReference, setPaymentReference] = useState("");
    const [company, setCompany] = useState<any>(null);

    // Snackbar state
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const showMessage = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    useEffect(() => {
        const init = async () => {
            try {
                const [user, companyData, taxesData, productsData] = await Promise.all([
                    authService.getCurrentUser(),
                    distributorService.getCompanyDetails(),
                    // Only active tax slabs apply to new entries; deactivated ones are excluded.
                    mastersService.getTaxSlabs({ is_active: "true" }),
                    distributorService.getProductMaster()
                ]);
                setUserRole(user.role);
                setCompany(companyData);
                setTaxSlabs(taxesData.results || []);
                setAllProducts(productsData);
            } catch (error) {
                console.error("Initialization failed:", error);
            }
        };
        init();
    }, []);

    // Automatic Inventory Check for Sales Manager
    useEffect(() => {
        setLogTab(0);
    }, [selectedRequest?.id]);

    useEffect(() => {
        if (selectedRequest && (userRole === 'sales_manager' || userRole === 'admin') && selectedRequest.status === 'pending' && detailsOpen) {
            handleCheckInventory();
        }
    }, [selectedRequest?.id, detailsOpen, userRole]);

    const handleOpenInvoiceModal = (request: StockRequest, trigger: 'stock_request' | 'backorder' = 'stock_request') => {
        setSelectedRequest(request);
        setInitialTrigger(trigger);
        setInvoiceOpen(true);
    };

    useEffect(() => {
        const requestId = searchParams.get('requestId');
        const trigger = searchParams.get('trigger');
        if (requestId && !loading && requests.length > 0) {
            const req = requests.find(r => r.id === parseInt(requestId));
            if (req) {
                // When coming from backorder, don't force 'shortage_only' if no invoice exists,
                // so the user can choose between 'full' and 'shortage_only'.
                // If a standard invoice already exists, openInvoiceModal will handle the filtering/locking.
                handleOpenInvoiceModal(req, trigger as any || 'stock_request');
                // Clear params
                router.replace('/stock-requests', { scroll: false });
            }
        }
    }, [searchParams, loading, requests]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const data: any = await distributorService.getStockRequests({ page_size: '1000' });
            if (Array.isArray(data)) setRequests(data);
            else if (data?.results) setRequests(data.results);
            else setRequests([]);
        } catch (error) {
            console.error("Error fetching stock requests:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRequests(); }, []);

    useEffect(() => {
        setPage(0);
    }, [searchQuery, statusFilter, paymentFilter, scopeFilter, startDate, endDate]);


    const handleOpenEdit = () => {
        if (!selectedRequest) return;
        setEditItems(selectedRequest.items.map(item => {
            // Pick current recorded price, or fallback to live product price for UI clarity
            const prod = allProducts.find(p => p.id === item.product);
            return {
                ...item,
                requested_quantity: Math.floor(Number(item.requested_quantity || 0)),
                unit_price: Number(item.unit_price) > 0 ? item.unit_price : (prod?.selling_price || 0),
                product_id: item.product
            };
        }));
        setEditDescription(selectedRequest.description || "");
        setEditOpen(true);
        setDetailsOpen(false);
    };

    const handleAddProductToEdit = (product: any) => {
        if (editItems.find(i => i.product === product.id)) {
            showMessage("Product already in list", "info");
            return;
        }
        setEditItems([...editItems, {
            product: product.id,
            product_name: product.product_name,
            sku: product.sku,
            requested_quantity: 1,
            unit_price: product.selling_price
        }]);
    };

    const handleUpdateEditQuantity = (productId: number, qty: number) => {
        setEditItems(editItems.map(item =>
            item.product === productId ? { ...item, requested_quantity: Math.min(99999, Math.max(1, qty)) } : item
        ));
    };

    const handleRemoveProductFromEdit = (productId: number) => {
        setEditItems(editItems.filter(item => item.product !== productId));
    };

    const handleSaveEdit = async () => {
        if (!selectedRequest) return;
        if (editItems.length === 0) {
            showMessage("Please add at least one item", "warning");
            return;
        }

        try {
            setSavingEdit(true);
            const data = {
                description: editDescription,
                items: editItems.map(item => ({
                    product: item.product,
                    requested_quantity: item.requested_quantity
                }))
            };
            await distributorService.updateStockRequest(selectedRequest.id, data);
            showMessage("Stock request updated successfully", "success");
            setEditOpen(false);
            fetchRequests();
        } catch (error) {
            console.error("Failed to update stock request", error);
            showMessage(formatDRFError(error), "error");
        } finally {
            setSavingEdit(false);
        }
    };

    const handleMarkAsPaid = async () => {
        if (!selectedRequest) return;
        try {
            await distributorService.updatePaymentStatus(selectedRequest.id, 'paid', paymentReference);
            setPaymentDialogOpen(false);
            setPaymentReference("");
            fetchRequests();
            // Update selectedRequest locally to refresh UI if dialog is open
            const data: any = await distributorService.getStockRequests();
            const items = Array.isArray(data) ? data : (data?.results || []);
            const current = items.find((r: any) => r.id === selectedRequest?.id);
            if (current) setSelectedRequest(current);
            showMessage("Payment recorded successfully.");
        } catch (error) {
            console.error("Payment update failed:", error);
            showMessage("Failed to update payment status.", "error");
        }
    };

    const handleCheckInventory = async () => {
        if (!selectedRequest) return;
        setCheckingInventory(true);
        try {
            const results = await distributorService.checkStockInventory(selectedRequest.id);
            setInventoryStatus(results);
            if (results.some(i => i.is_shortage)) {
                showMessage("Shortages detected.", "warning");
            } else {
                showMessage("All items are available in stock.", "success");
            }
        } catch (error: any) {
            showMessage(formatDRFError(error.response?.data || error), "error");
        } finally {
            setCheckingInventory(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest) return;
        try {
            await distributorService.approveStockRequest(selectedRequest.id);
            showMessage("Stock request approved successfully.");
            fetchRequests();
            setDetailsOpen(false);
            setInventoryStatus([]);
        } catch (error: any) {
            showMessage(formatDRFError(error.response?.data || error), "error");
        }
    };

    const handleCancelRequest = async () => {
        if (!selectedRequest) return;
        try {
            setCancelling(true);
            await distributorService.cancelStockRequest(selectedRequest.id, cancelReason || "Request cancelled.");
            showMessage("Stock request cancelled successfully.");
            setCancelConfirmOpen(false);
            setCancelReason("");
            setDetailsOpen(false);
            setInventoryStatus([]);
            fetchRequests();
        } catch (error: any) {
            showMessage(formatDRFError(error.response?.data || error), "error");
        } finally {
            setCancelling(false);
        }
    };

    const handleDownloadPDF = async (request: StockRequest, invoiceId?: number) => {
        if (!request.invoices || request.invoices.length === 0) {
            showMessage("No invoice found for this request.", "warning");
            return;
        }

        const invoice = invoiceId ? request.invoices.find(inv => inv.id === invoiceId) : request.invoices[0];
        if (!invoice) {
            showMessage("Specific invoice not found.", "error");
            return;
        }

        try {
            showMessage(`Downloading invoice: ${invoice.invoice_number}...`, "info");
            await distributorService.downloadInvoicePDF(invoice.id, invoice.invoice_number);
            showMessage("Invoice downloaded successfully.");
        } catch (error) {
            console.error("Error downloading PDF:", error);
            showMessage("Failed to download invoice PDF. Please try again.", "error");
        }
    };



    // Standard Handlers
    const handleAction = async (method: string, id: number, ...args: any[]) => {
        try {
            await (distributorService as any)[method](id, ...args);
            showMessage("Action completed successfully.");
            fetchRequests();
            setDetailsOpen(false);
        } catch (error: any) {
            showMessage(formatDRFError(error.response?.data || error), "error");
        }
    };

    const getStatusChip = (status: string) => {
        const config: Record<string, { color: any; label: string; icon?: any }> = {
            pending: { color: "warning", label: "Pending", icon: <WarningAmberIcon fontSize="small" /> },
            approved: { color: "primary", label: "Approved", icon: <CheckCircleIcon fontSize="small" /> },
            partial_fulfilled: { color: "info", label: "Partial Approved", icon: <WarningAmberIcon fontSize="small" /> },
            backordered: { color: "secondary", label: "Sent for Production", icon: <FactoryIcon fontSize="small" /> },
            in_production: { color: "secondary", label: "In Production", icon: <FactoryIcon fontSize="small" /> },
            packed: { color: "primary", label: "Packed", icon: <InventoryIcon fontSize="small" /> },
            in_transit: { color: "info", label: "In Transit", icon: <LocalShippingIcon fontSize="small" /> },
            partially_delivered: { color: "success", label: "Partially Delivered", icon: <CheckCircleIcon fontSize="small" /> },
            delivered: { color: "success", label: "Delivered", icon: <CheckCircleIcon fontSize="small" /> },
            cancelled: { color: "error", label: "Cancelled", icon: <CloseIcon fontSize="small" /> },
        };
        const s = config[status] || { color: "default", label: status };
        return <Chip label={s.label} color={s.color} size="small" icon={s.icon} sx={{ fontWeight: 700, fontSize: "0.7rem" }} />;
    };

    const getPaymentStatusChip = (request: StockRequest) => {
        let status = request.payment_status;

        // Dynamic Overdue calculation
        if (status === 'invoiced' || status === 'unpaid') {
            const invoice = request.invoices?.[0];
            if (invoice?.due_date) {
                const dueDate = new Date(invoice.due_date);
                if (dueDate < new Date()) {
                    status = 'overdue';
                }
            }
        }

        const config: Record<string, { color: any; label: string; icon?: any }> = {
            unpaid: { color: "error", label: "Unpaid", icon: <CloseIcon sx={{ fontSize: '0.7rem' }} /> },
            invoiced: { color: "info", label: "Invoiced", icon: <ReceiptIcon sx={{ fontSize: '0.7rem' }} /> },
            partially_paid: { color: "warning", label: "Partially Paid" },
            paid: { color: "success", label: "Paid", icon: <CheckCircleIcon sx={{ fontSize: '0.7rem' }} /> },
            overdue: { color: "error", label: "Overdue", icon: <WarningAmberIcon sx={{ fontSize: '0.7rem' }} /> },
        };
        const s = config[status] || { color: "default", label: status };
        return <Chip label={s.label} color={s.color} size="small" variant="outlined" icon={s.icon} sx={{ fontWeight: 700, fontSize: "0.6rem", height: 20 }} />;
    };

    const filteredRequests = requests.filter((req) => {
        const searchTerm = searchQuery.toLowerCase();
        const matchesSearch = (req.request_number?.toLowerCase() || "").includes(searchTerm) || (req.distributor_name?.toLowerCase() || "").includes(searchTerm);
        if (!matchesSearch) return false;

        if (statusFilter !== "all") {
            const allowedStatuses = statusFilter.split(',');
            if (!allowedStatuses.includes(req.status)) return false;
        }

        if (paymentFilter !== "all") {
            let currentStatus = req.payment_status;
            if (currentStatus === 'invoiced' || currentStatus === 'unpaid') {
                const invoice = req.invoices?.[0];
                if (invoice?.due_date && new Date(invoice.due_date) < new Date()) {
                    currentStatus = 'overdue';
                }
            }
            if (currentStatus !== paymentFilter) return false;
        }

        if (scopeFilter !== "all") {
            const hasInvoices = (req.invoices || []).length > 0;
            if (scopeFilter === "invoiced" && !hasInvoices) return false;
            if (scopeFilter === "not_invoiced" && hasInvoices) return false;
        }

        if (startDate) {
            const reqDate = new Date(req.request_date);
            const sDate = new Date(startDate);
            sDate.setHours(0, 0, 0, 0);
            if (reqDate < sDate) return false;
        }

        if (endDate) {
            const reqDate = new Date(req.request_date);
            const eDate = new Date(endDate);
            eDate.setHours(23, 59, 59, 999);
            if (reqDate > eDate) return false;
        }

        return true;
    }).sort((a, b) => {
        if (orderBy === 'request_date') {
            const dateA = new Date(a.request_date).getTime();
            const dateB = new Date(b.request_date).getTime();
            return order === 'asc' ? dateA - dateB : dateB - dateA;
        }
        return 0;
    });

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleClearFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setPaymentFilter("all");
        setScopeFilter("all");
        setStartDate("");
        setEndDate("");
        setOrderBy("request_date");
        setOrder("desc");
    };

    const paginatedRequests = filteredRequests.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    // Repeated-cancellation pattern: count cancelled requests per distributor
    // across the full set, so we can flag distributors who cancel frequently.
    const cancelCountByDistributor = requests.reduce((acc: Record<string, number>, r: any) => {
        if (r.status === "cancelled") {
            const key = r.distributor_name || r.distributor || "—";
            acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {});

    return (
        <>
            <Box sx={{ p: { xs: 2, md: 4 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                    <Box>
                        <Typography variant="h4" fontWeight={800} sx={{ color: theme.palette.text.primary }}>Stock Requests</Typography>
                        <Typography variant="body2" color="text.secondary">Review and manage distributor stock requests</Typography>
                    </Box>
                    <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { setPage(0); setSearchQuery(''); setStatusFilter('all'); setPaymentFilter('all'); setScopeFilter('all'); setStartDate(''); setEndDate(''); fetchRequests(); }} sx={{ borderRadius: 1 }}>Refresh</Button>
                </Stack>

                <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 1, bgcolor: "background.paper", border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, md: 3 }}>
                            <TextField
                                fullWidth size="small" placeholder="Search by number or distributor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="primary" sx={{ opacity: 0.6 }} /></InputAdornment>,
                                    sx: { borderRadius: 2.5, bgcolor: alpha(theme.palette.background.default, 0.5) }
                                }}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                            <TextField
                                select fullWidth size="small" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                            >
                                <MenuItem value="all">All Status</MenuItem>
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="approved">Approved</MenuItem>
                                <MenuItem value="packed">Packed</MenuItem>
                                <MenuItem value="in_transit">In Transit</MenuItem>
                                <MenuItem value="partially_delivered">Partially Delivered</MenuItem>
                                <MenuItem value="delivered">Delivered</MenuItem>
                                <MenuItem value="cancelled">Cancelled</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                            <TextField
                                select fullWidth size="small" label="Payment" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                            >
                                <MenuItem value="all">All Payment</MenuItem>
                                <MenuItem value="unpaid">Unpaid</MenuItem>
                                <MenuItem value="invoiced">Invoiced</MenuItem>
                                <MenuItem value="paid">Paid</MenuItem>
                                <MenuItem value="overdue">Overdue</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                            <TextField
                                select fullWidth size="small" label="Scope" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                            >
                                <MenuItem value="all">All Scopes</MenuItem>
                                <MenuItem value="invoiced">Invoiced Only</MenuItem>
                                <MenuItem value="not_invoiced">Not Invoiced</MenuItem>
                            </TextField>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 1.8 }}>
                            <TextField
                                fullWidth size="small" type="date" label="From" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 1.8 }}>
                            <TextField
                                fullWidth size="small" type="date" label="To" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5 } }}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, md: 0.9 }}>
                            <Stack direction="row" justifyContent="center">
                                <Tooltip title="Clear Filters">
                                    <IconButton
                                        onClick={handleClearFilters}
                                        sx={{
                                            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                            borderRadius: 2.5,
                                            width: 40,
                                            height: 40,
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.error.main, 0.05),
                                                color: 'error.main',
                                                transform: 'rotate(-90deg)'
                                            },
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <FilterAltOffIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Grid>

                    </Grid>
                </Paper>

                <TableContainer component={Paper} sx={{ borderRadius: 1, overflow: "hidden" }}>
                    <Table>
                        <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Request #</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Distributor</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>
                                    <TableSortLabel
                                        active={orderBy === 'request_date'}
                                        direction={orderBy === 'request_date' ? order : 'asc'}
                                        onClick={() => handleRequestSort('request_date')}
                                        sx={{ fontWeight: 800 }}
                                    >
                                        Request Date
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Backorder</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Invoicing Scope</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                                        <CircularProgress />
                                    </TableCell>
                                </TableRow>
                            ) : paginatedRequests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                            <InventoryIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                                            <Typography variant="h6" color="text.secondary">
                                                No Stock Requests Found
                                            </Typography>
                                            <Typography variant="body2" color="text.disabled">
                                                {searchQuery ? 'Try adjusting your search criteria' : 'Stock requests will appear here once created'}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedRequests.map((request) => (
                                    <TableRow key={request.id} hover data-testid={`sr-row-${request.id}`} sx={{ cursor: 'pointer' }}>
                                        <TableCell onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }} sx={{ color: 'primary.main' }}>
                                            <Typography variant="body2" fontWeight={700} color="primary.main">{request.request_number}</Typography>
                                            {Array.isArray((request as any).items) && (request as any).items.length > 0 && (
                                                <Tooltip title={(request as any).items.map((it: any) => `${it.product_name} × ${fmtQty(it.requested_quantity)}`).join(', ')}>
                                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 220 }}>
                                                        {(request as any).items.length} item{(request as any).items.length > 1 ? 's' : ''}: {(request as any).items.slice(0, 2).map((it: any) => it.product_name).join(', ')}{(request as any).items.length > 2 ? '…' : ''}
                                                    </Typography>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                        <TableCell onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }} sx={{ maxWidth: 180 }}><Typography variant="body2" noWrap title={request.distributor_name}>{request.distributor_name}</Typography></TableCell>
                                        <TableCell onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }}>{new Date(request.request_date).toLocaleDateString()}</TableCell>
                                        <TableCell onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }}>
                                            <Stack direction="row" alignItems="center" spacing={0.5}>
                                                {getStatusChip(request.status)}
                                                {request.status === 'cancelled' && cancelCountByDistributor[(request as any).distributor_name || (request as any).distributor || '—'] >= 2 && (
                                                    <Tooltip title={`Pattern alert: this distributor has ${cancelCountByDistributor[(request as any).distributor_name || (request as any).distributor || '—']} cancelled requests`}>
                                                        <WarningAmberIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </TableCell>
                                        <TableCell onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }}>
                                            {(() => {
                                                const shortages = request.shortages || [];
                                                if (shortages.length === 0) {
                                                    return <Typography variant="body2" color="text.disabled" sx={{ px: 0.5 }}>—</Typography>;
                                                }
                                                const statuses = shortages.map((s: any) => s.status);
                                                let summary = 'pending';
                                                if (statuses.every((st: string) => st === 'delivered')) summary = 'delivered';
                                                else if (statuses.some((st: string) => st === 'in_transit')) summary = 'in_transit';
                                                else if (statuses.some((st: string) => st === 'packed')) summary = 'packed';
                                                else if (statuses.some((st: string) => st === 'completed')) summary = 'completed';
                                                else if (statuses.some((st: string) => st === 'in_production')) summary = 'in_production';
                                                const cfg: Record<string, { color: any; label: string }> = {
                                                    pending: { color: 'default', label: 'Pending' },
                                                    in_production: { color: 'warning', label: 'In Production' },
                                                    completed: { color: 'info', label: 'Prod. Complete' },
                                                    packed: { color: 'primary', label: 'Packed' },
                                                    in_transit: { color: 'secondary', label: 'In Transit' },
                                                    delivered: { color: 'success', label: 'Delivered' },
                                                };
                                                const { color, label } = cfg[summary] || { color: 'default', label: summary };
                                                return (
                                                    <Chip
                                                        label={label}
                                                        color={color}
                                                        size="small"
                                                        variant="outlined"
                                                        icon={<FactoryIcon sx={{ fontSize: '0.7rem !important' }} />}
                                                        sx={{ fontWeight: 700, fontSize: '0.6rem', borderStyle: 'dashed' }}
                                                    />
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }}>
                                            {(() => {
                                                const invoices = request.invoices || [];
                                                if (invoices.length === 0) return <Chip label="Not Invoiced" size="small" variant="outlined" sx={{ fontSize: '0.65rem', fontWeight: 700 }} />;
                                                return <Chip label="Full (All Items)" color="success" size="small" sx={{ fontSize: '0.65rem', fontWeight: 800, borderRadius: 1.5 }} />;
                                            })()}
                                        </TableCell>
                                        <TableCell onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }}>{getPaymentStatusChip(request)}</TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="View Details">
                                                    <IconButton size="small" onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }}><VisibilityIcon fontSize="small" /></IconButton>
                                                </Tooltip>

                                                {/* PDF Download Action */}
                                                {(['accounts_officer', 'distributor', 'sales_manager', 'admin', 'warehouse_manager'].includes(userRole)) && request.invoices && request.invoices.length > 0 && (
                                                    <Tooltip title="Download Invoice PDF">
                                                        <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleDownloadPDF(request); }}>
                                                            <PictureAsPdfIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Status-based Quick Actions */}
                                                {(userRole === 'warehouse_manager' || userRole === 'admin') && (request.status === 'approved' || request.status === 'partial_fulfilled') && (
                                                    <Tooltip title="Mark Packed">
                                                        <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleAction('markPacked', request.id); }}>
                                                            <InventoryIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {(userRole === 'warehouse_manager' || userRole === 'admin') && request.status === 'packed' && (
                                                    <Tooltip title="Mark In-Transit">
                                                        <IconButton size="small" color="info" onClick={(e) => { e.stopPropagation(); handleAction('markInTransit', request.id); }}>
                                                            <LocalShippingIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {(userRole === 'distributor' || userRole === 'warehouse_manager' || userRole === 'admin') && request.status === 'in_transit' && (
                                                    <Tooltip title="Mark Delivered">
                                                        <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); handleAction('markDelivered', request.id); }}>
                                                            <CheckCircleIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Cancel: distributor (own request), sales_manager, admin, mdo */}
                                                {request.status === 'pending' && (
                                                    userRole === 'distributor' ||
                                                    userRole === 'sales_manager' ||
                                                    userRole === 'admin' ||
                                                    userRole === 'mdo'
                                                ) && (
                                                    <Tooltip title="Cancel Request">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedRequest(request);
                                                                setCancelReason("");
                                                                setCancelConfirmOpen(true);
                                                            }}
                                                        >
                                                            <BlockIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {/* Invoice Action */}
                                                {(userRole === 'accounts_officer' || userRole === 'admin') && request.status !== 'pending' && request.status !== 'cancelled' && request.payment_status !== 'paid' && (
                                                    <Tooltip title={request.invoices && request.invoices.length > 0 ? "Edit Invoice" : "Generate Invoice"}>
                                                        <IconButton size="small" color="secondary" onClick={(e) => { e.stopPropagation(); handleOpenInvoiceModal(request); }}>
                                                            <ReceiptIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}


                                                {/* Mark as Paid Action */}
                                                {(userRole === 'accounts_officer' || userRole === 'admin' || userRole === 'sales_manager') && request.payment_status !== 'paid' && request.invoices && request.invoices.length > 0 && (
                                                    <Tooltip title="Mark as Paid">
                                                        <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); setSelectedRequest(request); setPaymentDialogOpen(true); }}>
                                                            <PaymentIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination component="div" count={filteredRequests.length} page={page} onPageChange={(_, n) => setPage(n)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} />
                </TableContainer>

                {/* Details Dialog */}
                <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
                    <DialogTitle component="div" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: 'wrap', gap: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                            <Typography variant="h6" fontWeight={800}>Request Details: {selectedRequest?.request_number}</Typography>
                            {selectedRequest?.shortages && selectedRequest.shortages.length > 0 && (
                                <Tooltip title="View Backorder Details" arrow>
                                    <Chip
                                        icon={<FactoryIcon sx={{ fontSize: '0.85rem !important' }} />}
                                        label={`Backorder: ${selectedRequest.shortages.length} item${selectedRequest.shortages.length > 1 ? 's' : ''}`}
                                        size="small"
                                        color="warning"
                                        variant="outlined"
                                        onClick={() => setBackorderDetailOpen(true)}
                                        deleteIcon={<OpenInNewIcon sx={{ fontSize: '0.8rem !important' }} />}
                                        onDelete={() => setBackorderDetailOpen(true)}
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: '0.7rem',
                                            cursor: 'pointer',
                                            borderStyle: 'dashed',
                                            '&:hover': { bgcolor: (t) => alpha(t.palette.warning.main, 0.1) },
                                            transition: 'background 0.2s'
                                        }}
                                    />
                                </Tooltip>
                            )}
                        </Stack>
                        <IconButton onClick={() => setDetailsOpen(false)} size="small"><CloseIcon /></IconButton>
                    </DialogTitle>
                    <Divider />
                    <DialogContent sx={{ p: 3 }}>
                        {selectedRequest && (
                            <Grid container spacing={3}>
                                {(selectedRequest.status === 'partial_fulfilled' || selectedRequest.status === 'in_production' || selectedRequest.status === 'backordered' || selectedRequest.has_shortage) && (
                                    <Grid size={{ xs: 12 }}>
                                        <Alert
                                            severity="warning"
                                            variant="outlined"
                                            icon={<InfoIcon />}
                                            sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.warning.main, 0.05), border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}` }}
                                        >
                                            <Typography variant="subtitle2" fontWeight={800} color="warning.main">
                                                {selectedRequest.status === 'in_production' || selectedRequest.status === 'backordered'
                                                    ? 'Production Order Note:'
                                                    : 'Backorder Note:'}
                                            </Typography>
                                            <Typography variant="body2">
                                                {(() => {
                                                    const shortages = selectedRequest.shortages || [];
                                                    const list = shortages
                                                        .map((s: any) => `${s.product_name} (${fmtQty(s.shortage_quantity)} units)`)
                                                        .join(', ');
                                                    const allOOS = selectedRequest.status === 'in_production' || selectedRequest.status === 'backordered';
                                                    if (allOOS) {
                                                        return list
                                                            ? `All requested items are out of stock and have been sent to production: ${list}. Track production status and delivery under the Backordered Orders section.`
                                                            : 'All requested items are currently out of stock and have been sent to production. Track status under the Backordered Orders section.';
                                                    }
                                                    return list
                                                        ? `Insufficient stock — sent to production: ${list}. The remaining approved items will be dispatched from existing stock. Track shortages under the Backordered Orders section.`
                                                        : 'Some items are insufficient in stock and have been sent to production while available items are dispatched. Check shortage items under the Backordered Orders section.';
                                                })()}
                                            </Typography>
                                        </Alert>
                                    </Grid>
                                )}
                                <Grid size={{ xs: 12 }}>
                                    <Stack spacing={3}>
                                        <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                            <CardContent>
                                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                                    <AssignmentIcon color="primary" fontSize="small" />
                                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Distributor Details</Typography>
                                                </Box>
                                                <Typography variant="h6" fontWeight={800} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedRequest.distributor_name}>{selectedRequest.distributor_name}</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }} title={(selectedRequest as any).distributor_address || ""}>
                                                    {(selectedRequest as any).distributor_address || "Address not specified"}
                                                </Typography>

                                                <Divider sx={{ my: 2 }} />

                                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary" display="block">Payment Status</Typography>
                                                        {getPaymentStatusChip(selectedRequest)}
                                                    </Box>
                                                    {selectedRequest.payment_reference && (
                                                        <Box textAlign="center">
                                                            <Typography variant="caption" color="text.secondary" display="block">Payment Reference</Typography>
                                                            <Typography variant="body2" fontWeight={700} color="primary.main">
                                                                {selectedRequest.payment_reference}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                    <Box textAlign="right">
                                                        <Typography variant="caption" color="text.secondary" display="block">Request Date</Typography>
                                                        <Typography variant="body2" fontWeight={700}>{new Date(selectedRequest.request_date).toLocaleDateString()}</Typography>
                                                    </Box>
                                                </Box>
                                            </CardContent>
                                        </Card>

                                        <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                            <CardContent sx={{ px: 3 }}>
                                                <Box display="flex" alignItems="center" gap={1} mb={3}>
                                                    <WatchLaterIcon color="primary" fontSize="small" />
                                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Order Timeline</Typography>
                                                    {selectedRequest.has_shortage && (
                                                        <Chip
                                                            label="Incl. Backorder"
                                                            size="small"
                                                            color="warning"
                                                            variant="outlined"
                                                            icon={<FactoryIcon sx={{ fontSize: '0.75rem !important' }} />}
                                                            sx={{ fontWeight: 700, fontSize: '0.6rem', ml: 'auto', borderStyle: 'dashed' }}
                                                        />
                                                    )}
                                                </Box>

                                                {/* ── Order Flow Steps ───────────────────────────── */}
                                                <Stepper
                                                    activeStep={getTimelineData(selectedRequest).activeStep}
                                                    orientation="vertical"
                                                    connector={<ColorlibConnector />}
                                                >
                                                    {getTimelineData(selectedRequest).steps.map((step, index) => {
                                                        const tl = getTimelineData(selectedRequest);
                                                        const isActive = index === tl.activeStep;
                                                        const isCompleted = index < tl.activeStep;

                                                        return (
                                                            <Step key={step.label} completed={isCompleted}>
                                                                <StepLabel
                                                                    StepIconComponent={TimelineStepIcon}
                                                                    StepIconProps={{ active: isActive, completed: isCompleted, icon: index + 1 }}
                                                                >
                                                                    <Box>
                                                                        <Typography variant="body2" fontWeight={700} color={(isActive || isCompleted) ? 'text.primary' : 'text.disabled'}>
                                                                            {step.label}
                                                                        </Typography>
                                                                        {step.date ? (
                                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                                {new Date(step.date).toLocaleString('en-IN', {
                                                                                    day: '2-digit',
                                                                                    month: 'short',
                                                                                    year: 'numeric',
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit',
                                                                                    hour12: true
                                                                                })}
                                                                            </Typography>
                                                                        ) : (
                                                                            <Typography variant="caption" color="text.disabled">Pending</Typography>
                                                                        )}
                                                                    </Box>
                                                                </StepLabel>
                                                            </Step>
                                                        );
                                                    })}
                                                </Stepper>

                                                {/* ── Backorder Production Steps (merged) ────────── */}
                                                {selectedRequest.shortages && selectedRequest.shortages.length > 0 && (() => {
                                                    const shortages = selectedRequest.shortages!;
                                                    const firstShortage = shortages[0];
                                                    const sLogs = (firstShortage.status_logs || []) as any[];
                                                    const findSLog = (st: string) => sLogs.find(l => l.to_status === st);

                                                    const statuses = shortages.map(s => s.status);
                                                    const hasProductionLog = !!findSLog('in_production') || !!findSLog('plan_created');
                                                    const isPostProduction = statuses.some(st => ['packed', 'in_transit', 'delivered'].includes(st));
                                                    const skippedProduction = !hasProductionLog && isPostProduction;

                                                    const prodCompletedLog = findSLog('completed') || findSLog('packed_prod_completed') || findSLog('in_transit_prod_completed') || findSLog('delivered_prod_completed') || findSLog('cancelled_prod_completed');

                                                    const allSteps = [
                                                        { id: 'in_production', label: 'In Production', date: findSLog('in_production')?.changed_at || findSLog('plan_created')?.changed_at },
                                                        { id: 'completed', label: 'Production Complete', date: prodCompletedLog?.changed_at },
                                                        { id: 'packed', label: 'Packed', date: findSLog('packed')?.changed_at },
                                                        { id: 'in_transit', label: 'In Transit', date: findSLog('in_transit')?.changed_at },
                                                        { id: 'delivered', label: 'Delivered', date: findSLog('delivered')?.changed_at },
                                                    ];

                                                    let prodSteps = skippedProduction
                                                        ? allSteps.filter(step => step.id !== 'in_production' && step.id !== 'completed')
                                                        : allSteps;

                                                    let prodActive = 0;
                                                    if (statuses.every(st => st === 'delivered')) prodActive = prodSteps.length;
                                                    else if (statuses.some(st => st === 'in_transit')) prodActive = prodSteps.findIndex(step => step.id === 'in_transit') + 1;
                                                    else if (statuses.some(st => st === 'packed')) prodActive = prodSteps.findIndex(step => step.id === 'packed') + 1;
                                                    else if (statuses.some(st => st === 'completed')) prodActive = prodSteps.findIndex(step => step.id === 'completed') + 1;
                                                    else if (statuses.some(st => st === 'in_production')) prodActive = prodSteps.findIndex(step => step.id === 'in_production') + 1;
                                                    else prodActive = 0;

                                                    return (
                                                        <>
                                                            {/* Visual bridge between order flow & production flow */}
                                                            <Box
                                                                sx={{
                                                                    ml: '15px',
                                                                    pl: 2,
                                                                    borderLeft: `2px dashed ${alpha(theme.palette.warning.main, 0.5)}`,
                                                                    py: 1,
                                                                    my: 0.5,
                                                                }}
                                                            >
                                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                                    <FactoryIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                                                                    <Typography variant="caption" fontWeight={800} color="warning.dark" sx={{ fontSize: '0.7rem', letterSpacing: 0.5 }}>
                                                                        BACKORDER PRODUCTION
                                                                    </Typography>
                                                                    <Chip
                                                                        label={`${shortages.length} item${shortages.length > 1 ? 's' : ''}`}
                                                                        size="small"
                                                                        color="warning"
                                                                        sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, '& .MuiChip-label': { px: 0.8 } }}
                                                                    />
                                                                </Stack>
                                                            </Box>

                                                            {/* Production stepper */}
                                                            <Stepper
                                                                activeStep={prodActive}
                                                                orientation="vertical"
                                                                connector={<ColorlibConnector />}
                                                            >
                                                                {prodSteps.map((step, index) => {
                                                                    const isActive = index === prodActive - 1;
                                                                    const isCompleted = index < prodActive - 1;
                                                                    return (
                                                                        <Step key={`prod-${step.label}`} completed={isCompleted}>
                                                                            <StepLabel
                                                                                StepIconComponent={TimelineStepIcon}
                                                                                StepIconProps={{ active: isActive, completed: isCompleted, icon: index + 1 }}
                                                                            >
                                                                                <Box>
                                                                                    <Typography variant="body2" fontWeight={700}
                                                                                        color={(isActive || isCompleted) ? 'warning.dark' : 'text.disabled'}
                                                                                    >
                                                                                        {step.label}
                                                                                    </Typography>
                                                                                    {step.date ? (
                                                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                                                            {new Date(step.date).toLocaleString('en-IN', {
                                                                                                day: '2-digit', month: 'short', year: 'numeric',
                                                                                                hour: '2-digit', minute: '2-digit', hour12: true
                                                                                            })}
                                                                                        </Typography>
                                                                                    ) : (
                                                                                        <Typography variant="caption" color="text.disabled">Pending</Typography>
                                                                                    )}
                                                                                </Box>
                                                                            </StepLabel>
                                                                        </Step>
                                                                    );
                                                                })}
                                                            </Stepper>
                                                        </>
                                                    );
                                                })()}
                                            </CardContent>
                                        </Card>

                                        <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                            {/* Tab header */}
                                            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1.5 }}>
                                                <Box display="flex" alignItems="center" gap={1} mb={1}>
                                                    <HistoryIcon color="primary" fontSize="small" />
                                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Activity &amp; Logs</Typography>
                                                </Box>
                                                <Tabs
                                                    value={logTab}
                                                    onChange={(_: React.SyntheticEvent, v: number) => setLogTab(v)}
                                                    textColor="primary"
                                                    indicatorColor="primary"
                                                    sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: '0.72rem', fontWeight: 700, py: 0.5 } }}
                                                >
                                                    <Tab
                                                        label={`Order Logs${selectedRequest.status_logs?.length ? ` (${selectedRequest.status_logs.length})` : ''}`}
                                                        icon={<AssignmentIcon sx={{ fontSize: 13 }} />}
                                                        iconPosition="start"
                                                    />
                                                    {selectedRequest.shortages && selectedRequest.shortages.length > 0 && (
                                                        <Tab
                                                            label={`Production Logs (${(selectedRequest.shortages || []).reduce((acc: number, s: any) => acc + (s.status_logs?.length || 0), 0)})`}
                                                            icon={<FactoryIcon sx={{ fontSize: 13 }} />}
                                                            iconPosition="start"
                                                            sx={{ color: logTab === 1 ? 'warning.dark' : undefined }}
                                                        />
                                                    )}
                                                </Tabs>
                                            </Box>

                                            <CardContent sx={{ pt: 1.5 }}>
                                                {/* ── Tab 0: Order Logs ── */}
                                                {logTab === 0 && (() => {
                                                    const logs = [...(selectedRequest.status_logs || [])].reverse();
                                                    if (logs.length === 0) {
                                                        return <Typography variant="caption" color="text.disabled">No order logs recorded yet.</Typography>;
                                                    }
                                                    return (
                                                        <Stack divider={<Divider flexItem />} spacing={0}>
                                                            {logs.map((log: any, idx: number) => (
                                                                <Box key={idx} sx={{ py: 1, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                                                    <Box sx={{
                                                                        mt: 0.3, flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                                    }}>
                                                                        <AssignmentIcon sx={{ fontSize: 11, color: 'primary.main' }} />
                                                                    </Box>
                                                                    <Box flex={1}>
                                                                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem' }}>
                                                                            {log.notes || (log.from_status === log.to_status ? 'Request Updated' : `Order → ${log.to_status.replace(/_/g, ' ').toUpperCase()}`)}
                                                                        </Typography>
                                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                                            By: {log.changed_by_name || 'System'}&nbsp;•&nbsp;
                                                                            {new Date(log.changed_at).toLocaleString('en-IN', {
                                                                                day: '2-digit', month: 'short', year: 'numeric',
                                                                                hour: '2-digit', minute: '2-digit', hour12: true
                                                                            })}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            ))}
                                                        </Stack>
                                                    );
                                                })()}

                                                {/* ── Tab 1: Production Logs ── */}
                                                {logTab === 1 && (() => {
                                                    const baseProdLogs = (selectedRequest.shortages || []).flatMap((s: any) =>
                                                        (s.status_logs || []).map((log: any) => ({
                                                            ...log,
                                                            _productName: s.product_name,
                                                            _sortKey: new Date(log.changed_at).getTime(),
                                                        }))
                                                    ).sort((a: any, b: any) => b._sortKey - a._sortKey);

                                                    const seen = new Set();
                                                    const prodLogs = baseProdLogs.filter((log: any) => {
                                                        const timeStr = log.changed_at ? log.changed_at.substring(0, 16) : '';
                                                        const key = log.to_status + '-' + (log.notes || '') + '-' + timeStr;
                                                        if (seen.has(key)) return false;
                                                        seen.add(key);
                                                        return true;
                                                    });

                                                    if (prodLogs.length === 0) {
                                                        return <Typography variant="caption" color="text.disabled">No production logs recorded yet.</Typography>;
                                                    }
                                                    return (
                                                        <Stack divider={<Divider flexItem />} spacing={0}>
                                                            {prodLogs.map((log: any, idx: number) => (
                                                                <Box key={idx} sx={{ py: 1, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                                                    <Box sx={{
                                                                        mt: 0.3, flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        bgcolor: alpha(theme.palette.warning.main, 0.12),
                                                                    }}>
                                                                        <FactoryIcon sx={{ fontSize: 11, color: 'warning.dark' }} />
                                                                    </Box>
                                                                    <Box flex={1}>
                                                                        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem', color: 'warning.dark' }}>
                                                                            {log.notes || `[${log._productName}] → ${log.to_status.replace(/_/g, ' ').toUpperCase()}`}
                                                                        </Typography>
                                                                        <Typography variant="caption" color="text.secondary" display="block">
                                                                            By: {log.changed_by_name || 'System'}&nbsp;•&nbsp;
                                                                            {new Date(log.changed_at).toLocaleString('en-IN', {
                                                                                day: '2-digit', month: 'short', year: 'numeric',
                                                                                hour: '2-digit', minute: '2-digit', hour12: true
                                                                            })}
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            ))}
                                                        </Stack>
                                                    );
                                                })()}
                                            </CardContent>
                                        </Card>
                                    </Stack>
                                </Grid>


                                {/* Inventory Check Results */}
                                {/* {inventoryStatus.length > 0 && (
                                    <Grid size={{ xs: 12 }}>
                                        <Card variant="outlined" sx={{ borderRadius: 1, border: `1px solid ${theme.palette.info.light}`, bgcolor: alpha(theme.palette.info.main, 0.02) }}>
                                            <CardContent>
                                                <Typography variant="subtitle2" color="info.main" gutterBottom fontWeight={700}>Inventory Check Results</Typography>
                                                <TableContainer>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow>
                                                                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                                                <TableCell align="right" sx={{ fontWeight: 700 }}>Requested</TableCell>
                                                                <TableCell align="right" sx={{ fontWeight: 700 }}>Available</TableCell>
                                                                <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {inventoryStatus.map((item: any, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell>{item.product_name}</TableCell>
                                                                    <TableCell align="right">{Number(item.requested).toFixed(0)}</TableCell>
                                                                    <TableCell align="right" sx={{ color: item.is_sufficient ? 'success.main' : 'error.main', fontWeight: 600 }}>{Number(item.available_qty).toFixed(0)}</TableCell>
                                                                    <TableCell align="center">
                                                                        <Chip
                                                                            label={item.is_sufficient ? "Available" : "Shortage"}
                                                                            color={item.is_sufficient ? "success" : "error"}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                                                        />
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                                {inventoryStatus.some(i => i.is_shortage) && (
                                                    <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.05), border: `1px solid ${alpha(theme.palette.error.main, 0.2)}` }}>
                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            <WarningAmberIcon color="error" fontSize="small" />
                                                            <Typography variant="body2" color="error.main" fontWeight={600}>
                                                                Shortages detected. Items with insufficient stock will be automatically sent for production upon approval.
                                                            </Typography>
                                                        </Stack>
                                                    </Box>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                )} */}

                                <Grid size={{ xs: 12 }}>
                                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: alpha(theme.palette.divider, 0.05) }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>HSN</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Requested</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Approved</TableCell>
                                                    {selectedRequest.has_shortage && (
                                                        <TableCell align="right" sx={{ fontWeight: 700, color: 'warning.dark' }}>Backordered</TableCell>
                                                    )}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {selectedRequest.items?.map((item) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell>{item.product_name}</TableCell>
                                                        <TableCell>{item.hsn_code || '-'}</TableCell>
                                                        <TableCell align="right">{Number(item.requested_quantity).toFixed(0)}</TableCell>
                                                        <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>{Number(item.approved_quantity || 0).toFixed(0)}</TableCell>
                                                        {selectedRequest.has_shortage && (
                                                            <TableCell align="right" sx={{
                                                                color: Number(item.shortage_quantity) > 0 ? 'warning.main' : 'text.disabled',
                                                                fontWeight: Number(item.shortage_quantity) > 0 ? 700 : 400
                                                            }}>
                                                                {Number(item.shortage_quantity) > 0 ? Number(item.shortage_quantity).toFixed(0) : '—'}
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Grid>

                                {/* Backordered Items Section */}
                                {selectedRequest.shortages && selectedRequest.shortages.length > 0 && (
                                    <Grid size={{ xs: 12 }}>
                                        <Card
                                            variant="outlined"
                                            sx={{
                                                borderRadius: 1,
                                                border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                                                bgcolor: alpha(theme.palette.warning.main, 0.03),
                                            }}
                                        >
                                            <CardContent>
                                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                                    <FactoryIcon sx={{ fontSize: 18, color: 'warning.dark' }} />
                                                    <Typography variant="subtitle2" fontWeight={800} color="warning.dark">
                                                        Backordered Items
                                                    </Typography>
                                                    <Chip
                                                        label={`${selectedRequest.shortages.length} item${selectedRequest.shortages.length > 1 ? 's' : ''} sent for production`}
                                                        size="small"
                                                        color="warning"
                                                        variant="outlined"
                                                        sx={{ fontWeight: 700, fontSize: '0.65rem', ml: 'auto' }}
                                                    />
                                                </Box>
                                                <TableContainer>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.06) }}>
                                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Product</TableCell>
                                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>SKU</TableCell>
                                                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Backordered Qty</TableCell>
                                                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Production Status</TableCell>
                                                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Plan ID</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {selectedRequest.shortages.map((shortage) => {
                                                                const shortageStatusConfig: Record<string, { color: any; label: string }> = {
                                                                    pending: { color: 'default', label: 'Pending' },
                                                                    plan_created: { color: 'info', label: 'Plan Created' },
                                                                    in_production: { color: 'secondary', label: 'In Production' },
                                                                    completed: { color: 'success', label: 'Completed' },
                                                                    packed: { color: 'primary', label: 'Packed' },
                                                                    in_transit: { color: 'info', label: 'In Transit' },
                                                                    delivered: { color: 'success', label: 'Delivered' },
                                                                    cancelled: { color: 'error', label: 'Cancelled' },
                                                                };
                                                                const sc = shortageStatusConfig[shortage.status] || { color: 'default', label: shortage.status };
                                                                return (
                                                                    <TableRow key={shortage.id}>
                                                                        <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{shortage.product_name}</TableCell>
                                                                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{shortage.sku || '—'}</TableCell>
                                                                        <TableCell align="right">
                                                                            <Typography variant="body2" fontWeight={700} color="warning.dark">
                                                                                {Number(shortage.shortage_quantity).toFixed(0)}
                                                                            </Typography>
                                                                        </TableCell>
                                                                        <TableCell align="center">
                                                                            <Chip
                                                                                label={sc.label}
                                                                                color={sc.color}
                                                                                size="small"
                                                                                variant="outlined"
                                                                                icon={<FactoryIcon sx={{ fontSize: '0.75rem !important' }} />}
                                                                                sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell align="center">
                                                                            {shortage.production_plan_id ? (
                                                                                <Chip
                                                                                    label={`#${shortage.production_plan_id}`}
                                                                                    size="small"
                                                                                    color="secondary"
                                                                                    variant="outlined"
                                                                                    sx={{ fontWeight: 700, fontSize: '0.65rem', cursor: 'default' }}
                                                                                />
                                                                            ) : (
                                                                                <Typography variant="caption" color="text.disabled">—</Typography>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                                {selectedRequest.production_notes && (
                                                    <Box mt={1.5} p={1} borderRadius={1} bgcolor={alpha(theme.palette.warning.main, 0.07)}>
                                                        <Typography variant="caption" color="warning.dark" fontWeight={600}>
                                                            Production Note: {selectedRequest.production_notes}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                )}
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions sx={{ p: 3, flexWrap: 'wrap', gap: 1.5, justifyContent: 'flex-end' }}>
                        <Button onClick={() => { setDetailsOpen(false); setInventoryStatus([]); }} variant="outlined">Close</Button>

                        {/* Edit Action */}
                        {selectedRequest?.id && selectedRequest.status === 'pending' && (userRole === 'distributor' || userRole === 'admin' || userRole === 'sales_manager') && (
                            <Button
                                onClick={handleOpenEdit}
                                variant="outlined"
                                color="primary"
                                startIcon={<EditIcon />}
                            >
                                Edit Request
                            </Button>
                        )}

                        {/* Cancel Action */}
                        {selectedRequest?.id && selectedRequest.status === 'pending' && (
                            userRole === 'distributor' ||
                            userRole === 'sales_manager' ||
                            userRole === 'admin' ||
                            userRole === 'mdo'
                        ) && (
                            <Button
                                onClick={() => { setCancelReason(""); setCancelConfirmOpen(true); }}
                                variant="outlined"
                                color="error"
                                startIcon={<BlockIcon />}
                            >
                                Cancel Request
                            </Button>
                        )}

                        {/* Approval Actions for Sales Manager */}
                        {selectedRequest?.id && selectedRequest.status === 'pending' && (userRole === 'sales_manager' || userRole === 'admin' || userRole === 'mdo') && (
                            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
                                {/* <Button
                                    onClick={handleCheckInventory}
                                    variant="outlined"
                                    color="info"
                                    disabled={checkingInventory}
                                    startIcon={checkingInventory ? <CircularProgress size={20} /> : <SearchIcon />}
                                >
                                    Check Company Stock
                                </Button> */}
                                <Button
                                    onClick={handleApprove}
                                    variant="contained"
                                    color="success"
                                    startIcon={<CheckCircleIcon />}
                                >
                                    {inventoryStatus.some(i => i.is_shortage) ? "Approve & Send Shortage to Production" : "Approve Request"}
                                </Button>
                            </Stack>
                        )}

                        {/* Warehouse Actions */}
                        {selectedRequest?.id && (userRole === 'warehouse_manager' || userRole === 'admin') && (
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                {['approved', 'partial_fulfilled'].includes(selectedRequest.status) && (
                                    <Button
                                        onClick={() => handleAction('markPacked', selectedRequest.id)}
                                        variant="contained"
                                        color="primary"
                                        startIcon={<InventoryIcon />}
                                    >
                                        Mark Packed
                                    </Button>
                                )}
                                {selectedRequest.status === 'packed' && (
                                    <Button
                                        onClick={() => handleAction('markInTransit', selectedRequest.id)}
                                        variant="contained"
                                        color="info"
                                        startIcon={<LocalShippingIcon />}
                                    >
                                        Mark In Transit
                                    </Button>
                                )}
                                {selectedRequest.status === 'in_transit' && (
                                    <Button
                                        onClick={() => handleAction('markDelivered', selectedRequest.id)}
                                        variant="contained"
                                        color="success"
                                        startIcon={<CheckCircleIcon />}
                                    >
                                        Mark Delivered
                                    </Button>
                                )}
                            </Stack>
                        )}

                        {/* Invoice Actions for Accounts Officer */}
                        {selectedRequest?.id && selectedRequest.status !== 'pending' && selectedRequest.status !== 'cancelled' && (userRole === 'accounts_officer' || userRole === 'admin') && (
                            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1.5, width: '100%', mt: 2, pt: 2, borderTop: `1px dashed ${theme.palette.divider}` }}>
                                <Box sx={{ width: '100%' }}>
                                    <Typography variant="subtitle2" fontWeight={800} mb={1}>Managed Invoices</Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                                        {(selectedRequest.invoices || []).map((inv: any) => (
                                            <Chip
                                                key={inv.id}
                                                label={`Full Invoice: ${inv.invoice_number}`}
                                                color={inv.payment_status === 'paid' ? 'success' : 'info'}
                                                onClick={() => handleOpenInvoiceModal(selectedRequest)}
                                                onDelete={() => handleDownloadPDF(selectedRequest, inv.id)}
                                                deleteIcon={<PictureAsPdfIcon sx={{ fontSize: '1rem !important' }} />}
                                                sx={{ fontWeight: 700, borderRadius: 2 }}
                                            />
                                        ))}

                                        {(!selectedRequest.invoices || selectedRequest.invoices.length === 0) && (
                                            <Button size="small" variant="contained" color="primary" onClick={() => handleOpenInvoiceModal(selectedRequest)}>Generate Full Invoice</Button>
                                        )}
                                    </Stack>
                                </Box>
                            </Stack>
                        )}

                        {selectedRequest?.id && selectedRequest.status !== 'pending' && selectedRequest.status !== 'cancelled' && (userRole === 'accounts_officer' || userRole === 'admin' || userRole === 'sales_manager') && selectedRequest.payment_status !== 'paid' && selectedRequest.invoices && selectedRequest.invoices.length > 0 && (
                            <Stack sx={{ width: '100%', mt: 2, pt: 2, borderTop: `1px dashed ${theme.palette.divider}` }}>
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<PaymentIcon />}
                                    onClick={() => setPaymentDialogOpen(true)}
                                >
                                    Mark Global Payment
                                </Button>
                            </Stack>
                        )}
                    </DialogActions>
                </Dialog>

                {/* ── Backorder Detail Dialog ─────────────────────────────── */}
                {
                    selectedRequest && selectedRequest.shortages && selectedRequest.shortages.length > 0 && (() => {
                        const shortages = selectedRequest.shortages!;

                        // Build production timeline from status_logs of first item
                        const firstShortage = shortages[0];
                        const logs = firstShortage.status_logs || [];
                        const findLog = (status: string) => (logs as any[]).find((l: any) => l.to_status === status);

                        const timelineSteps = [
                            { label: 'Sent for Production', date: firstShortage.created_at },
                            { label: 'In Production', date: findLog('in_production')?.changed_at },
                            { label: 'Production Complete', date: findLog('completed')?.changed_at },
                            { label: 'Packed', date: findLog('packed')?.changed_at },
                            { label: 'In Transit', date: findLog('in_transit')?.changed_at },
                            { label: 'Delivered', date: findLog('delivered')?.changed_at },
                        ];

                        const statuses = shortages.map(s => s.status);
                        let activeStep = 1;
                        if (statuses.every(st => st === 'delivered')) activeStep = 6;
                        else if (statuses.some(st => st === 'in_transit')) activeStep = 5;
                        else if (statuses.some(st => st === 'packed')) activeStep = 4;
                        else if (statuses.some(st => st === 'completed')) activeStep = 3;
                        else if (statuses.some(st => st === 'in_production')) activeStep = 2;

                        const shortageStatusConfig: Record<string, { color: any; label: string }> = {
                            pending: { color: 'default', label: 'Pending' },
                            plan_created: { color: 'info', label: 'Plan Created' },
                            in_production: { color: 'secondary', label: 'In Production' },
                            completed: { color: 'success', label: 'Completed' },
                            packed: { color: 'primary', label: 'Packed' },
                            in_transit: { color: 'info', label: 'In Transit' },
                            delivered: { color: 'success', label: 'Delivered' },
                            cancelled: { color: 'error', label: 'Cancelled' },
                        };

                        // Flatten all status logs across all shortage items for activity log
                        const baseAllLogs = shortages.flatMap(s =>
                            (s.status_logs || []).map((l: any) => ({ ...l, prod_name: s.product_name }))
                        ).sort((a: any, b: any) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

                        const seen = new Set();
                        const allLogs = baseAllLogs.filter((log: any) => {
                            const timeStr = log.changed_at ? log.changed_at.substring(0, 16) : '';
                            const key = log.to_status + '-' + (log.notes || '') + '-' + timeStr;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        });

                        return (
                            <Dialog
                                open={backorderDetailOpen}
                                onClose={() => setBackorderDetailOpen(false)}
                                maxWidth="md"
                                fullWidth
                                sx={{ zIndex: 1400 }}
                                PaperProps={{ sx: { borderRadius: 1 } }}
                            >
                                <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                                    <Stack direction="row" alignItems="center" spacing={1.5}>
                                        <FactoryIcon color="warning" fontSize="small" />
                                        <Box>
                                            <Typography variant="h6" fontWeight={800}>Backorder Details</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Linked to: <strong>{selectedRequest.request_number}</strong>
                                                &nbsp;•&nbsp;{shortages.length} item{shortages.length > 1 ? 's' : ''} in production
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <IconButton onClick={() => setBackorderDetailOpen(false)} size="small"><CloseIcon /></IconButton>
                                </DialogTitle>
                                <Divider />
                                <DialogContent sx={{ p: 3 }}>
                                    <Stack spacing={3}>

                                        {/* Production Timeline */}
                                        <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                            <CardContent sx={{ px: 3 }}>
                                                <Box display="flex" alignItems="center" gap={1} mb={3}>
                                                    <WatchLaterIcon color="primary" fontSize="small" />
                                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Production &amp; Delivery Timeline</Typography>
                                                </Box>
                                                <Stepper activeStep={activeStep} orientation="vertical" connector={<ColorlibConnector />}>
                                                    {timelineSteps.map((step, index) => {
                                                        const isActive = index === activeStep - 1;
                                                        const isCompleted = index < activeStep - 1;
                                                        return (
                                                            <Step key={step.label} completed={isCompleted}>
                                                                <StepLabel
                                                                    StepIconComponent={TimelineStepIcon}
                                                                    StepIconProps={{ active: isActive, completed: isCompleted, icon: index + 1 }}
                                                                >
                                                                    <Box>
                                                                        <Typography variant="body2" fontWeight={700} color={(isActive || isCompleted) ? 'text.primary' : 'text.disabled'}>
                                                                            {step.label}
                                                                        </Typography>
                                                                        {step.date ? (
                                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                                {new Date(step.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                                            </Typography>
                                                                        ) : (
                                                                            <Typography variant="caption" color="text.disabled">Pending</Typography>
                                                                        )}
                                                                    </Box>
                                                                </StepLabel>
                                                            </Step>
                                                        );
                                                    })}
                                                </Stepper>
                                            </CardContent>
                                        </Card>

                                        {/* Shortage Items Table */}
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight={800} color="warning.dark" mb={1.5}>
                                                Backordered Items ({shortages.length})
                                            </Typography>
                                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                                                <Table size="small">
                                                    <TableHead sx={{ bgcolor: alpha(theme.palette.warning.main, 0.07) }}>
                                                        <TableRow>
                                                            <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                                            <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 700 }}>Backordered Qty</TableCell>
                                                            <TableCell align="center" sx={{ fontWeight: 700 }}>Production Status</TableCell>
                                                            <TableCell align="center" sx={{ fontWeight: 700 }}>Plan ID</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {shortages.map(shortage => {
                                                            const sc = shortageStatusConfig[shortage.status] || { color: 'default', label: shortage.status };
                                                            return (
                                                                <TableRow key={shortage.id}>
                                                                    <TableCell sx={{ fontWeight: 600 }}>{shortage.product_name}</TableCell>
                                                                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{shortage.sku || '—'}</TableCell>
                                                                    <TableCell align="right">
                                                                        <Typography variant="body2" fontWeight={700} color="warning.dark">{Number(shortage.shortage_quantity).toFixed(0)}</Typography>
                                                                    </TableCell>
                                                                    <TableCell align="center">
                                                                        <Chip
                                                                            label={sc.label}
                                                                            color={sc.color}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            icon={<FactoryIcon sx={{ fontSize: '0.75rem !important' }} />}
                                                                            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell align="center">
                                                                        {shortage.production_plan_id ? (
                                                                            <Chip
                                                                                label={`#${shortage.production_plan_id}`}
                                                                                size="small"
                                                                                color="secondary"
                                                                                variant="outlined"
                                                                                sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                                                            />
                                                                        ) : (
                                                                            <Typography variant="caption" color="text.disabled">—</Typography>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </Box>

                                        {/* Production Activity Log */}
                                        <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                            <CardContent>
                                                <Box display="flex" alignItems="center" gap={1} mb={2}>
                                                    <HistoryIcon color="primary" fontSize="small" />
                                                    <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Production Activity Log</Typography>
                                                </Box>
                                                <Stack divider={<Divider flexItem />} spacing={0}>
                                                    {allLogs.length > 0 ? allLogs.map((log: any, idx: number) => (
                                                        <Box key={idx} sx={{ py: 1 }}>
                                                            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem' }}>
                                                                [{log.prod_name}]&nbsp;
                                                                {log.notes || `Status → ${log.to_status.replace(/_/g, ' ').toUpperCase()}`}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                By: {log.changed_by_name || 'System'}&nbsp;•&nbsp;
                                                                {new Date(log.changed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                            </Typography>
                                                        </Box>
                                                    )) : (
                                                        <Typography variant="caption" color="text.disabled">No production logs recorded yet.</Typography>
                                                    )}
                                                </Stack>
                                            </CardContent>
                                        </Card>

                                    </Stack>
                                </DialogContent>
                                <DialogActions sx={{ p: 2.5 }}>
                                    <Button onClick={() => setBackorderDetailOpen(false)} variant="outlined">Close</Button>
                                </DialogActions>
                            </Dialog>
                        );
                    })()
                }

                {/* Mark as Paid Dialog */}

                <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)}>
                    <DialogTitle sx={{ fontWeight: 800 }}>Mark as Paid</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" mb={3}>
                            Recording payment for <strong>{selectedRequest?.request_number}</strong>.
                            This will mark the request and all associated invoices as paid.
                        </Typography>
                        <TextField
                            fullWidth
                            label="Payment Reference"
                            placeholder="Bank Txn ID, Cheque No, etc."
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            sx={{ mt: 1 }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 3 }}>
                        <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="contained"
                            color="success"
                            onClick={handleMarkAsPaid}
                            disabled={!paymentReference}
                        >
                            Record Payment
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Enhanced Invoice Generation Modal */}
                <InvoiceModal
                    open={invoiceOpen}
                    onClose={() => setInvoiceOpen(false)}
                    request={selectedRequest}
                    initialTrigger={initialTrigger}
                    onSuccess={() => {
                        fetchRequests();
                        showMessage("Invoice updated successfully");
                    }}
                    userRole={userRole || ""}
                />

                {/* Cancel Confirmation Dialog */}
                <Dialog open={cancelConfirmOpen} onClose={() => setCancelConfirmOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BlockIcon color="error" fontSize="small" />
                        Cancel Stock Request
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            Are you sure you want to cancel request <strong>{selectedRequest?.request_number}</strong>? This action cannot be undone.
                        </Typography>
                        <TextField
                            fullWidth
                            size="small"
                            label="Reason (optional)"
                            placeholder="Enter reason for cancellation..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            multiline
                            rows={2}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setCancelConfirmOpen(false)} disabled={cancelling}>Keep Request</Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={handleCancelRequest}
                            disabled={cancelling}
                            startIcon={cancelling ? <CircularProgress size={16} /> : <BlockIcon />}
                        >
                            {cancelling ? "Cancelling..." : "Yes, Cancel"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Edit Request Dialog */}
                <Dialog
                    open={editOpen}
                    onClose={(e, reason) => {
                        if (reason === 'backdropClick') return;
                        setEditOpen(false);
                    }}
                    maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' } }}>
                    <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem', pb: 1 }}>Edit Stock Request: {selectedRequest?.request_number}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={4} sx={{ mt: 1 }}>
                            <Box sx={{ p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 1, border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}` }}>
                                <Typography variant="subtitle2" fontWeight={700} mb={1.5} color="primary.main">Add Products</Typography>
                                <Autocomplete
                                    options={allProducts}
                                    getOptionLabel={(option) => `${option.product_name} (${option.sku})`}
                                    onChange={(_, newValue) => {
                                        if (newValue) {
                                            handleAddProductToEdit(newValue);
                                        }
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Search by product name or SKU..."
                                            size="small"
                                            sx={{
                                                bgcolor: 'background.paper',
                                                '& .MuiOutlinedInput-root': { borderRadius: 1 }
                                            }}
                                            InputProps={{
                                                ...params.InputProps,
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon fontSize="small" color="primary" />
                                                    </InputAdornment>
                                                ),
                                            }}
                                        />
                                    )}
                                    renderOption={(props, option) => (
                                        <MenuItem {...props} key={option.id}>
                                            <Stack direction="row" justifyContent="space-between" width="100%" alignItems="center">
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>{option.product_name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{option.sku}</Typography>
                                                </Box>
                                                <Typography variant="caption" fontWeight={700} color="primary.main">₹{Number(option.selling_price).toFixed(2)}</Typography>
                                            </Stack>
                                        </MenuItem>
                                    )}
                                />
                            </Box>

                            <TextField
                                label="Request Description / Internal Notes"
                                multiline
                                rows={2}
                                fullWidth
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1 } }}
                            />

                            <Box>
                                <Typography variant="subtitle1" fontWeight={800} mb={2} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ShoppingBagIcon color="primary" fontSize="small" />
                                    Request Items
                                </Typography>
                                <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
                                    <Table size="medium">
                                        <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Product Details</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 800, color: 'text.secondary' }}>Quantity</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary' }}>Unit Price</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary' }}>Total Amount</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 800, color: 'text.secondary' }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {editItems.map((item) => (
                                                <TableRow key={item.product} hover>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={700}>{item.product_name}</Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{item.sku}</Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleUpdateEditQuantity(item.product, Math.floor(Number(item.requested_quantity || 0)) - 1)}
                                                                sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, p: 0.5 }}
                                                            >
                                                                <RemoveIcon fontSize="small" />
                                                            </IconButton>
                                                            <TextField
                                                                size="small"
                                                                value={item.requested_quantity}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
                                                                    handleUpdateEditQuantity(item.product, val === '' ? 0 : parseInt(val, 10));
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (['.', 'e', 'E', '+', '-'].includes(e.key)) {
                                                                        e.preventDefault();
                                                                    }
                                                                }}
                                                                variant="outlined"
                                                                inputProps={{
                                                                    inputMode: 'numeric',
                                                                    pattern: '[0-9]*',
                                                                    style: {
                                                                        textAlign: 'center',
                                                                        fontWeight: 800,
                                                                        width: 50,
                                                                        padding: '6px 0',
                                                                        color: theme.palette.primary.main
                                                                    }
                                                                }}
                                                                sx={{
                                                                    "& .MuiOutlinedInput-root": { borderRadius: 2 },
                                                                    "& .MuiOutlinedInput-notchedOutline": { border: 'none' },
                                                                    bgcolor: alpha(theme.palette.primary.main, 0.05)
                                                                }}
                                                            />
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleUpdateEditQuantity(item.product, Math.floor(Number(item.requested_quantity || 0)) + 1)}
                                                                sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.8)}`, p: 0.5 }}
                                                            >
                                                                <AddIcon fontSize="small" />
                                                            </IconButton>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" fontWeight={600}>₹{Number(item.unit_price || 0).toFixed(2)}</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" fontWeight={800} color="primary.main">
                                                            ₹{(Number(item.unit_price || 0) * (item.requested_quantity || 0)).toFixed(2)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Tooltip title="Remove Item">
                                                            <IconButton color="error" size="small" onClick={() => handleRemoveProductFromEdit(item.product)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.05) }}>
                                                                <DeleteOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {editItems.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                                        <Box sx={{ opacity: 0.5 }}>
                                                            <ShoppingBagIcon sx={{ fontSize: 48, mb: 1, color: 'text.disabled' }} />
                                                            <Typography variant="body1" color="text.disabled" fontWeight={600}>No items added to this request yet.</Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                        {editItems.length > 0 && (
                                            <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
                                                <TableRow>
                                                    <TableCell colSpan={3} align="right">
                                                        <Typography variant="subtitle2" fontWeight={700}>Grand Total:</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="h6" fontWeight={900} color="primary.main">
                                                            ₹{editItems.reduce((acc, item) => acc + (Number(item.unit_price || 0) * (item.requested_quantity || 0)), 0).toFixed(2)}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell />
                                                </TableRow>
                                            </TableHead>
                                        )}
                                    </Table>
                                </TableContainer>
                            </Box>
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 4, pt: 2, justifyContent: 'flex-end', gap: 2 }}>
                        <Button
                            onClick={() => setEditOpen(false)}
                            variant="outlined"
                            sx={{ borderRadius: 1, px: 4, fontWeight: 700 }}
                        >
                            Discard Changes
                        </Button>
                        <Button
                            onClick={handleSaveEdit}
                            variant="contained"
                            disabled={savingEdit || editItems.length === 0}
                            startIcon={savingEdit ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                            sx={{
                                borderRadius: 1,
                                px: 4,
                                fontWeight: 800,
                                boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                                backgroundImage: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                            }}
                        >
                            {savingEdit ? 'Saving...' : 'Confirm Edits'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Snackbar Notifications */}
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert
                        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                        severity={snackbar.severity}
                        variant="filled"
                        sx={{ width: '100%', borderRadius: 2, fontWeight: 600 }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            </Box >
        </>
    );
}

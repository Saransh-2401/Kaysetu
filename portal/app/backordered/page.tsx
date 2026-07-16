"use client";
import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Box, Paper, Typography, Button, Stack, TextField, InputAdornment,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
    DialogActions, Grid, useTheme, alpha, CircularProgress, Divider,
    Card, CardContent, Snackbar, Alert, Tab, Tabs, Stepper, Step, StepLabel,
    StepConnector, stepConnectorClasses, MenuItem, TableSortLabel, TablePagination
} from "@mui/material";
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from "framer-motion";
import { InfoIcon, VisibilityIcon, CloseIcon, AssignmentIcon, WatchLaterIcon, AddCircleOutlineIcon, CheckIcon, PaymentIcon, CheckCircleIcon, InventoryIcon, LocalShippingIcon, ReceiptIcon, WarningAmberIcon, RefreshIcon, SearchIcon, HistoryIcon, FactoryIcon, PostAddIcon, PictureAsPdfIcon, FilterAltOffIcon, OpenInNewIcon } from "@/components/icons";

import { distributorService, StockRequestShortage, StockRequestInvoiceItem, StockRequest } from "@/lib/distributor-service";
import { authService } from "@/lib/auth-service";
import { formatDRFError } from "@/lib/utils";
import InvoiceModal from "@/components/distributor/InvoiceModal";

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.root}`]: {
        marginLeft: 15,
    },
    [`& .${stepConnectorClasses.line}`]: {
        borderLeftWidth: 2,
        minHeight: 24,
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

// Quantities without noisy trailing decimals (167.000 -> 167).
const fmtQty = (n: any) => {
    const v = Number(n) || 0;
    return Number.isInteger(v)
        ? v.toLocaleString("en-IN")
        : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

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
    // Completed = green; the current in-progress step = amber (so a still-pending
    // "In Production" step no longer reads as a green "done" indicator); future = grey.
    const tone = completed ? theme.palette.success.main : active ? theme.palette.warning.main : null;
    return (
        <Box sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: tone ? alpha(tone, 0.1) : theme.palette.action.hover,
            color: tone || theme.palette.text.disabled,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            border: `1px solid ${tone ? alpha(tone, 0.25) : theme.palette.divider}`,
        }}>
            {icons[String(icon)]}
        </Box>
    );
}

function BackorderedContent() {
    const theme = useTheme();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [shortages, setShortages] = useState<StockRequestShortage[]>([]);
    const [stockRequests, setStockRequests] = useState<Map<number, StockRequest>>(new Map());
    const [search, setSearch] = useState("");
    const [userRole, setUserRole] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
    const [orderBy, setOrderBy] = useState("created_at");
    const [order, setOrder] = useState<"asc" | "desc">("desc");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Payment Dialog State
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [paymentReference, setPaymentReference] = useState("");
    const [selectedShortageId, setSelectedShortageId] = useState<number | null>(null);

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false, message: "", severity: "info"
    });

    // Invoice Modal State
    const [invoiceOpen, setInvoiceOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [initialTrigger, setInitialTrigger] = useState<'stock_request' | 'backorder'>('backorder');

    // Override confirmation dialog — shown when WM tries to pack while production is active
    const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
    const [pendingPackRequestId, setPendingPackRequestId] = useState<number | null>(null);
    const [overrideItems, setOverrideItems] = useState<{ product_name: string; plan_id: number | null }[]>([]);
    const [originalRequestModalOpen, setOriginalRequestModalOpen] = useState(false);
    const [logTab, setLogTab] = useState(0);

    const getDetailedTimelineData = (req: StockRequest) => {
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


    const showMessage = (msg: string, sev: any = "success") => setSnackbar({ open: true, message: msg, severity: sev });

    const fetchShortages = async () => {
        try {
            setLoading(true);
            const data: any = await distributorService.getShortages();
            const shortagesList = Array.isArray(data) ? data : (data?.results || []);
            setShortages(shortagesList);

            // Fetch stock request details for each unique stock_request
            const uniqueRequestIds = [...new Set(shortagesList.map((s: StockRequestShortage) => s.stock_request))] as number[];
            const requests = await Promise.all(
                uniqueRequestIds.map((id: number) => distributorService.getStockRequest(id))
            );

            const requestsMap = new Map<number, StockRequest>();
            requests.forEach(req => {
                if (req) requestsMap.set(req.id, req);
            });
            setStockRequests(requestsMap);
        } catch (error) {
            console.error("Error fetching shortages:", error);
            showMessage("Failed to load shortages", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const user = await authService.getCurrentUser();
            setUserRole(user?.role || null);
            fetchShortages();
        };
        init();
    }, []);

    useEffect(() => {
        setPage(0);
    }, [search, statusFilter, paymentFilter, startDate, endDate, order, orderBy]);

    const groupedShortages = useMemo(() => {
        let filtered = shortages.filter(s =>
            s.product_name.toLowerCase().includes(search.toLowerCase()) ||
            s.stock_request_number.toLowerCase().includes(search.toLowerCase())
        );


        // Additional Status Filter
        if (statusFilter !== "all") {
            const allowedStatuses = statusFilter.split(',');
            filtered = filtered.filter(s => allowedStatuses.includes(s.status));
        }

        // Payment Filter
        if (paymentFilter !== "all") {
            filtered = filtered.filter(s => {
                const req = stockRequests.get(s.stock_request);
                if (!req) return false;

                let currentStatus = req.payment_status;
                if (currentStatus === 'invoiced' || currentStatus === 'unpaid') {
                    const invoice = req.invoices?.[0];
                    if (invoice?.due_date && new Date(invoice.due_date) < new Date()) {
                        currentStatus = 'overdue';
                    }
                }
                return currentStatus === paymentFilter;
            });
        }

        // Date Range Filter
        if (startDate) {
            const sDate = new Date(startDate);
            sDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(s => new Date(s.created_at) >= sDate);
        }
        if (endDate) {
            const eDate = new Date(endDate);
            eDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(s => new Date(s.created_at) <= eDate);
        }

        const groupsMap = new Map<number, StockRequestShortage[]>();
        filtered.forEach(s => {
            if (!groupsMap.has(s.stock_request)) {
                groupsMap.set(s.stock_request, []);
            }
            groupsMap.get(s.stock_request)!.push(s);
        });

        return Array.from(groupsMap.values()).sort((a, b) => {
            const itemA = a[0];
            const itemB = b[0];
            if (orderBy === 'created_at') {
                const dateA = new Date(itemA.created_at).getTime();
                const dateB = new Date(itemB.created_at).getTime();
                return order === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return 0;
        });
    }, [shortages, search, statusFilter, paymentFilter, orderBy, order, stockRequests, startDate, endDate]);

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === "asc";
        setOrder(isAsc ? "desc" : "asc");
        setOrderBy(property);
    };

    const handleChangePage = (event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const paginatedShortages = useMemo(() => {
        const startIndex = page * rowsPerPage;
        return groupedShortages.slice(startIndex, startIndex + rowsPerPage);
    }, [groupedShortages, page, rowsPerPage]);

    const handleClearFilters = () => {
        setSearch("");
        setPaymentFilter("all");
        setStatusFilter("all");
        setOrderBy("created_at");
        setOrder("desc");
        setStartDate("");
        setEndDate("");
        setPage(0); // Reset pagination on filter clear
    };

    const handleMarkPaid = (id: number) => {
        setSelectedShortageId(id);
        setPaymentReference("");
        setPaymentDialogOpen(true);
    };

    const handleAction = async (method: string, id: number, extra?: any) => {
        if (method === 'generateShortageInvoice') {
            const shortage = shortages.find(s => s.id === id);
            const req = stockRequests.get(shortage?.stock_request || 0);
            if (req) {
                setSelectedRequest(req);
                setInitialTrigger('backorder');
                setInvoiceOpen(true);
            }
            return;
        }

        if (method === 'markShortagePaid') {
            handleMarkPaid(id);
            return;
        }

        try {
            await (distributorService as any)[method](id);
            showMessage("Action completed successfully");
            fetchShortages();
        } catch (error) {
            showMessage(formatDRFError(error), "error");
        }
    };

    // Batch handler — operates on all eligible items under a stock_request
    const handleBatchAction = async (
        batchMethod: 'batchPackShortages' | 'batchShipShortages' | 'batchDeliverShortages',
        stockRequestId: number
    ) => {
        try {
            const res: any = await (distributorService as any)[batchMethod](stockRequestId);
            const results: any[] = res?.results || [];
            const failed = results.filter((r: any) => !r.success);
            const succeeded = results.filter((r: any) => r.success);

            let actionText = 'updated';
            if (batchMethod === 'batchPackShortages') actionText = 'Marked as packed';
            else if (batchMethod === 'batchShipShortages') actionText = 'Marked as In-Transit';
            else if (batchMethod === 'batchDeliverShortages') actionText = 'Marked as Delivered';

            if (succeeded.length > 0 && failed.length === 0) {
                showMessage(`✓ ${actionText} successfully.`, 'success');
            } else if (succeeded.length > 0 && failed.length > 0) {
                const failList = failed.map((f: any) => `${f.product}: ${f.reason}`).join('; ');
                showMessage(`${succeeded.length} packed, ${failed.length} skipped (insufficient stock): ${failList}`, 'warning');
            } else if (failed.length > 0) {
                const failList = failed.map((f: any) => `${f.product}: ${f.reason}`).join('; ');
                showMessage(`Could not pack — Insufficient stock`, 'error');
            } else {
                showMessage('No eligible items found for this action.', 'info');
            }
            fetchShortages();
        } catch (error) {
            showMessage(formatDRFError(error), 'error');
        }
    };

    // Called when WM clicks Pack — checks if any item is in active production first
    const handlePackClick = (group: StockRequestShortage[], stockRequestId: number) => {
        const activeProductionItems = group.filter(
            item => item.status === 'in_production' && item.production_plan_id
        );

        if (activeProductionItems.length > 0) {
            // Show override warning before proceeding
            setOverrideItems(
                activeProductionItems.map(item => ({
                    product_name: item.product_name,
                    plan_id: item.production_plan_id ?? null,
                }))
            );
            setPendingPackRequestId(stockRequestId);
            setOverrideDialogOpen(true);
        } else {
            // No active production — safe to pack directly
            handleBatchAction('batchPackShortages', stockRequestId);
        }
    };

    const confirmPayment = async () => {
        if (!selectedShortageId) return;
        try {
            await distributorService.markShortagePaid(selectedShortageId, {
                payment_reference: paymentReference || "CASH"
            });
            showMessage("Payment recorded successfully");
            setPaymentDialogOpen(false);
            fetchShortages();
        } catch (error) {
            showMessage(formatDRFError(error), "error");
        }
    };

    // Helper function to determine invoice status for a shortage
    const getInvoiceStatus = (shortage: StockRequestShortage) => {
        const request = stockRequests.get(shortage.stock_request);
        if (!request) return { type: 'none', canGenerate: false };

        const invoice = request.invoices?.[0];
        if (invoice) {
            return { type: 'invoiced', canGenerate: false, invoice };
        }

        return { type: 'none', canGenerate: true };
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered':
            case 'partially_delivered':
            case 'completed': return 'success';
            case 'in_transit': return 'info';
            case 'packed':
            case 'in_production': return 'warning';
            case 'pending': return 'info';
            case 'cancelled': return 'error';
            default: return 'default';
        }
    };

    const getPaymentStatusChip = (request: StockRequest) => {
        let status = request.payment_status;
        if (status === 'invoiced' || status === 'unpaid') {
            const invoice = request.invoices?.[0];
            if (invoice?.due_date) {
                const dueDate = new Date(invoice.due_date);
                if (dueDate < new Date()) status = 'overdue';
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

        // Find payment reference from latest paid invoice
        const paidInvoice = request.invoices?.find(inv => inv.payment_status === 'paid');
        const ref = paidInvoice?.payment_reference || request.payment_reference;

        return (
            <Stack spacing={0.5}>
                <Chip label={s.label} color={s.color} size="small" variant="outlined" icon={s.icon} sx={{ fontWeight: 700, fontSize: "0.6rem", height: 20 }} />
                {ref && (
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, color: 'text.secondary' }}>
                        Ref: {ref}
                    </Typography>
                )}
            </Stack>
        );
    };

    const getShortageTimelineData = (group: StockRequestShortage[]) => {
        if (!group || group.length === 0) return { activeStep: 0, steps: [] };

        const s = group[0];
        const logs = s.status_logs || [];
        const findLog = (status: string) => logs.find((l: any) => l.to_status === status);

        const statuses = group.map(i => i.status);
        const hasProductionLog = !!findLog('in_production') || !!findLog('plan_created');
        const isPostProduction = statuses.some(st => ['packed', 'in_transit', 'delivered'].includes(st));
        const skippedProduction = !hasProductionLog && isPostProduction;

        const prodCompletedLog = findLog('completed') || findLog('packed_prod_completed') || findLog('in_transit_prod_completed') || findLog('delivered_prod_completed') || findLog('cancelled_prod_completed');

        const allSteps = [
            { id: 'requested', label: 'Request for Production', date: s.created_at },
            { id: 'in_production', label: 'In Production', date: findLog('in_production')?.changed_at || findLog('plan_created')?.changed_at },
            { id: 'completed', label: 'Production Complete', date: prodCompletedLog?.changed_at },
            { id: 'packed', label: 'Packed', date: findLog('packed')?.changed_at },
            { id: 'in_transit', label: 'In Transit', date: findLog('in_transit')?.changed_at },
            { id: 'delivered', label: 'Delivered', date: findLog('delivered')?.changed_at },
        ];

        let steps = skippedProduction
            ? allSteps.filter(step => step.id !== 'in_production' && step.id !== 'completed')
            : allSteps;

        let activeStep = 0;
        if (statuses.every(st => st === 'delivered')) activeStep = steps.length;
        else if (statuses.some(st => st === 'in_transit')) activeStep = steps.findIndex(step => step.id === 'in_transit') + 1;
        else if (statuses.some(st => st === 'packed')) activeStep = steps.findIndex(step => step.id === 'packed') + 1;
        else if (statuses.some(st => st === 'completed')) activeStep = steps.findIndex(step => step.id === 'completed') + 1;
        else if (statuses.some(st => st === 'in_production')) activeStep = steps.findIndex(step => step.id === 'in_production') + 1;
        else activeStep = 1;

        return { activeStep, steps };
    };

    const getTimelineData = (request: StockRequest | null) => {
        if (!request) return { activeStep: 0, steps: [] };
        const logs = request.status_logs || [];
        const findLog = (status: string) => logs.find((l: any) => l.to_status === status);
        const steps = [
            { label: 'Requested', date: request.request_date },
            { label: 'Approved', date: findLog('approved')?.changed_at || findLog('partial_fulfilled')?.changed_at },
            { label: 'Packed', date: findLog('packed')?.changed_at },
            { label: 'In Transit', date: findLog('in_transit')?.changed_at },
            { label: 'Partially Delivered', date: findLog('partially_delivered')?.changed_at },
            { label: 'Delivered', date: findLog('delivered')?.changed_at },
        ];
        let activeStep = 0;
        if (request.status === 'delivered') activeStep = 6;
        else if (request.status === 'partially_delivered') activeStep = 5;
        else if (request.status === 'in_transit') activeStep = 4;
        else if (request.status === 'packed') activeStep = 3;
        else if (['approved', 'partial_fulfilled', 'in_production'].includes(request.status)) activeStep = 2;
        else if (request.status === 'pending') activeStep = 1;
        return { activeStep, steps };
    };

    return (
        <>
            <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                    <Box>
                        <Typography variant="h4" fontWeight={900} color="primary" gutterBottom>
                            Backordered & Shortages
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Track and manage items sent to production due to insufficient stock.
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={() => { setPage(0); setSearch(''); setStatusFilter('all'); setPaymentFilter('all'); setStartDate(''); setEndDate(''); fetchShortages(); }}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                </Stack>

                <Card variant="outlined" sx={{ borderRadius: 1, mb: 4 }}>
                    <CardContent sx={{ p: 0 }}>

                        <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.background.default, 0.3) }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <TextField
                                        fullWidth
                                        placeholder="Search by Product or Request #..."
                                        size="small"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" color="primary" sx={{ opacity: 0.6 }} />
                                                </InputAdornment>
                                            ),
                                            sx: { borderRadius: 2.5, bgcolor: 'background.paper' }
                                        }}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, sm: 6, md: 1.8 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        label="Status"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                                    >
                                        <MenuItem value="all">All Items Status</MenuItem>
                                        <MenuItem value="pending">Pending</MenuItem>
                                        <MenuItem value="in_production">In Production</MenuItem>
                                        <MenuItem value="completed">Completed</MenuItem>
                                        <MenuItem value="packed">Packed</MenuItem>
                                        <MenuItem value="in_transit">In Transit</MenuItem>
                                        <MenuItem value="delivered">Delivered</MenuItem>
                                    </TextField>
                                </Grid>

                                <Grid size={{ xs: 12, sm: 6, md: 1.8 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        label="Payment"
                                        value={paymentFilter}
                                        onChange={(e) => setPaymentFilter(e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                                    >
                                        <MenuItem value="all">All Payment Status</MenuItem>
                                        <MenuItem value="unpaid">Unpaid</MenuItem>
                                        <MenuItem value="invoiced">Invoiced</MenuItem>
                                        <MenuItem value="paid">Paid</MenuItem>
                                        <MenuItem value="overdue">Overdue</MenuItem>
                                    </TextField>
                                </Grid>

                                <Grid size={{ xs: 12, sm: 6, md: 1.8 }}>
                                    <TextField
                                        fullWidth
                                        type="date"
                                        size="small"
                                        label="From"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, sm: 6, md: 1.8 }}>
                                    <TextField
                                        fullWidth
                                        type="date"
                                        size="small"
                                        label="To"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, md: 1.8 }}>
                                    <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
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
                        </Box>


                        <TableContainer sx={{ maxHeight: '60vh' }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 800 }}>Request #</TableCell>
                                        <TableCell sx={{ fontWeight: 800 }}>Product Details</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 800 }}>Production Status</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 800 }}>Payment Status</TableCell>
                                        <TableCell sx={{ fontWeight: 800 }}>
                                            <TableSortLabel
                                                active={orderBy === 'created_at'}
                                                direction={orderBy === 'created_at' ? order : 'asc'}
                                                onClick={() => handleRequestSort('created_at')}
                                            >
                                                Created At
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800 }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                                                <CircularProgress size={30} sx={{ mb: 2 }} />
                                                <Typography variant="body2" color="text.secondary">Loading backordered items...</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : groupedShortages.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                                                <InfoIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                                <Typography variant="h6" color="text.secondary">No backordered items found</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedShortages.map((group) => {
                                            const s = group[0];
                                            const request = stockRequests.get(s.stock_request);
                                            const invStatus = getInvoiceStatus(s);
                                            const otherProductsCount = group.length - 1;

                                            return (
                                                <TableRow key={s.stock_request} hover data-testid={`bo-row-${s.stock_request}`}>
                                                    <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                                                        {s.stock_request_number}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {s.product_name} {otherProductsCount > 0 && `(+${otherProductsCount})`}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {request?.distributor_name}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Stack direction="row" spacing={1} justifyContent="center">
                                                            {[...new Set(group.map(item => item.status))].map(status => (
                                                                <Chip
                                                                    key={status}
                                                                    label={status.toUpperCase()}
                                                                    color={getStatusColor(status) as any}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{ fontWeight: 800, fontSize: '0.65rem' }}
                                                                />
                                                            ))}
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                                                            <Chip
                                                                label={invStatus.invoice ? "INVOICED" : "UNINVOICED"}
                                                                color={invStatus.invoice ? "success" : "default"}
                                                                size="small"
                                                                sx={{ fontWeight: 700, fontSize: '0.6rem' }}
                                                            />
                                                            {invStatus.invoice && (
                                                                <Chip
                                                                    label={(invStatus.invoice.payment_status || 'unpaid').toUpperCase()}
                                                                    variant="outlined"
                                                                    color={invStatus.invoice.payment_status === 'paid' ? 'success' : 'warning'}
                                                                    size="small"
                                                                    sx={{ fontWeight: 700, fontSize: '0.6rem' }}
                                                                />
                                                            )}
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption">
                                                            {new Date(s.created_at).toLocaleDateString()}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                            <Tooltip title="Request Details">
                                                                <IconButton size="small" onClick={() => { setSelectedRequest(request || null); setDetailsOpen(true); }}>
                                                                    <VisibilityIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>

                                                            {invStatus.canGenerate && (userRole === 'admin' || userRole === 'accounts_officer') && !group.every(item => item.status === 'cancelled') && (
                                                                <Tooltip title="Generate Full Invoice">
                                                                    <IconButton size="small" color="warning" onClick={() => handleAction('generateShortageInvoice', s.id)}>
                                                                        <PostAddIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}
                                                            {(() => {
                                                                const isUnpaid = invStatus.invoice
                                                                    ? invStatus.invoice.payment_status !== 'paid'
                                                                    : (s.is_invoiced && s.payment_status !== 'paid');
                                                                if (!isUnpaid) return null;
                                                                if (userRole !== 'admin' && userRole !== 'accounts_officer') return null;
                                                                return (
                                                                    <Tooltip title="Mark as Paid">
                                                                        <IconButton size="small" color="success" onClick={() => handleMarkPaid(s.id)}>
                                                                            <CheckCircleIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                );
                                                            })()}
                                                            {invStatus.invoice && (
                                                                <Tooltip title="Download Invoice PDF">
                                                                    <IconButton
                                                                        size="small"
                                                                        color="primary"
                                                                        onClick={() => {
                                                                            distributorService.downloadInvoicePDF(invStatus.invoice.id, `Invoice_${invStatus.invoice.id}.pdf`);
                                                                        }}
                                                                    >
                                                                        <PictureAsPdfIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )}

                                                            {/* ── PACK button ──
                                                                Visible when ANY item in the group is NOT yet packed/in-transit/delivered/cancelled.
                                                                If production is active → shows override confirmation first.
                                                            */}
                                                            {(userRole === 'admin' || userRole === 'warehouse_manager') &&
                                                                group.some(item => !['packed', 'in_transit', 'delivered', 'cancelled'].includes(item.status)) && (() => {
                                                                    const hasActiveProd = group.some(
                                                                        item => item.status === 'in_production' && item.production_plan_id
                                                                    );
                                                                    return (
                                                                        <Tooltip
                                                                            title={hasActiveProd
                                                                                ? 'Production in progress — click to override with warehouse stock'
                                                                                : 'Pack all backorder items (checks warehouse stock)'}
                                                                            arrow
                                                                        >
                                                                            <IconButton
                                                                                size="small"
                                                                                color={hasActiveProd ? 'error' : 'warning'}
                                                                                onClick={() => handlePackClick(group, s.stock_request)}
                                                                            >
                                                                                <InventoryIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    );
                                                                })()}

                                                            {/* ── SHIP button ── visible when at least 1 item is packed */}
                                                            {(userRole === 'admin' || userRole === 'warehouse_manager') &&
                                                                group.some(item => item.status === 'packed') && (
                                                                    <Tooltip title="Dispatch all packed items" arrow>
                                                                        <IconButton
                                                                            size="small"
                                                                            color="info"
                                                                            onClick={() => handleBatchAction('batchShipShortages', s.stock_request)}
                                                                        >
                                                                            <LocalShippingIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}

                                                            {/* ── DELIVERED button ── visible when at least 1 item is in_transit */}
                                                            {(userRole === 'admin' || userRole === 'distributor' || userRole === 'warehouse_manager') &&
                                                                group.some(item => item.status === 'in_transit') && (
                                                                    <Tooltip title="Mark all in-transit items as delivered" arrow>
                                                                        <IconButton
                                                                            size="small"
                                                                            color="success"
                                                                            onClick={() => handleBatchAction('batchDeliverShortages', s.stock_request)}
                                                                        >
                                                                            <CheckIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                )}

                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25]}
                            component="div"
                            count={groupedShortages.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                    </CardContent>
                </Card>
            </Box>

            {/* ══ Production Override Confirmation Dialog ══ */}
            <Dialog
                open={overrideDialogOpen}
                onClose={() => setOverrideDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 1 } }}
            >
                <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
                    <Box sx={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        bgcolor: alpha(theme.palette.error.main, 0.1),
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <WarningAmberIcon color="error" fontSize="small" />
                    </Box>
                    <Box>
                        <Typography variant="h6" fontWeight={800} color="error.dark">Production Override Warning</Typography>
                        <Typography variant="caption" color="text.secondary">Proceeding will bypass active production plans</Typography>
                    </Box>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 2 }}>
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            The following items are currently <strong>in active production</strong>. Packing them now via
                            warehouse stock adjustment will <strong>bypass production</strong>. When production completes,
                            the produced quantity will be added back to warehouse stock — this is expected and correct
                            if you have spare stock to fulfill this order now.
                        </Typography>

                        <Box sx={{
                            border: `1px solid ${theme.palette.error.light}`,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.error.main, 0.04),
                            p: 1.5
                        }}>
                            <Typography variant="caption" fontWeight={700} color="error.dark" display="block" mb={1}>
                                ITEMS IN PRODUCTION:
                            </Typography>
                            <Stack spacing={0.5}>
                                {overrideItems.map((item, i) => (
                                    <Box key={i} display="flex" alignItems="center" gap={1}>
                                        <FactoryIcon sx={{ fontSize: 13, color: 'warning.main' }} />
                                        <Typography variant="body2" fontWeight={600}>{item.product_name}</Typography>
                                        {item.plan_id && (
                                            <Chip
                                                label={`Plan #${item.plan_id}`}
                                                size="small"
                                                variant="outlined"
                                                color="warning"
                                                sx={{ fontSize: '0.6rem', height: 18, fontWeight: 700 }}
                                            />
                                        )}
                                    </Box>
                                ))}
                            </Stack>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            💡 Tip: Notify the Production Manager to close or cancel the production plan after you confirm.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <Button
                        variant="outlined"
                        onClick={() => { setOverrideDialogOpen(false); setPendingPackRequestId(null); }}
                    >
                        Cancel — Keep Production Running
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<InventoryIcon />}
                        onClick={() => {
                            setOverrideDialogOpen(false);
                            if (pendingPackRequestId !== null) {
                                handleBatchAction('batchPackShortages', pendingPackRequestId);
                            }
                            setPendingPackRequestId(null);
                        }}
                    >
                        Override &amp; Pack from Warehouse Stock
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
                <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                        <Typography variant="h6" fontWeight={800}>Backorder Details: {selectedRequest?.request_number}</Typography>
                        {selectedRequest && (
                            <Tooltip title="View Original Stock Request details" arrow>
                                <Chip
                                    icon={<AssignmentIcon sx={{ fontSize: '0.85rem !important' }} />}
                                    label="View Stock Request"
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    onClick={() => setOriginalRequestModalOpen(true)}
                                    deleteIcon={<OpenInNewIcon sx={{ fontSize: '0.8rem !important' }} />}
                                    onDelete={() => setOriginalRequestModalOpen(true)}
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        borderStyle: 'dashed',
                                        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.1) },
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
                            <Grid size={{ xs: 12 }}>
                                <Stack spacing={3}>
                                    <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                        <CardContent>
                                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                                <AssignmentIcon color="primary" fontSize="small" />
                                                <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Distributor Details</Typography>
                                            </Box>
                                            <Typography variant="h6" fontWeight={800}>{selectedRequest.distributor_name}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
                                                {(selectedRequest as any).distributor_address || "Address not specified"}
                                            </Typography>
                                            <Divider sx={{ my: 2 }} />
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" display="block">Payment Status</Typography>
                                                    {getPaymentStatusChip(selectedRequest)}
                                                </Box>
                                                <Box textAlign="right">
                                                    <Typography variant="caption" color="text.secondary" display="block">Request Date</Typography>
                                                    <Typography variant="body2" fontWeight={700}>{new Date(selectedRequest.request_date).toLocaleDateString()}</Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>

                                    <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                        <CardContent sx={{ px: 3 }}>
                                            <Box display="flex" alignItems="center" gap={1} mb={4}>
                                                <FactoryIcon color="primary" fontSize="small" />
                                                <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Production & Backorder Timeline</Typography>
                                            </Box>
                                            <Stepper
                                                activeStep={getShortageTimelineData(shortages.filter(s => s.stock_request === selectedRequest.id)).activeStep}
                                                orientation="vertical"
                                                connector={<ColorlibConnector />}
                                            >
                                                {getShortageTimelineData(shortages.filter(s => s.stock_request === selectedRequest.id)).steps.map((step, index) => {
                                                    const isActive = index === getShortageTimelineData(shortages.filter(s => s.stock_request === selectedRequest.id)).activeStep;
                                                    const isCompleted = index < getShortageTimelineData(shortages.filter(s => s.stock_request === selectedRequest.id)).activeStep;
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
                                                                            {new Date(step.date).toLocaleString()}
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

                                    <Card variant="outlined" sx={{ borderRadius: 1, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                                        <CardContent>
                                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                                <HistoryIcon color="primary" fontSize="small" />
                                                <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>Backorder Production Logs</Typography>
                                            </Box>
                                            <Stack divider={<Divider flexItem />} spacing={0}>
                                                {(() => {
                                                    const group = shortages.filter(s => s.stock_request === selectedRequest.id);
                                                    const allLogs = group.flatMap(s => (s.status_logs || []).map((l: any) => ({ ...l, prod_name: s.product_name })));
                                                    const sortedLogs = allLogs.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

                                                    const seen = new Set();
                                                    const uniqueLogs = sortedLogs.filter((log: any) => {
                                                        const timeStr = log.changed_at ? log.changed_at.substring(0, 16) : '';
                                                        const key = log.to_status + '-' + (log.notes || '') + '-' + timeStr;
                                                        if (seen.has(key)) return false;
                                                        seen.add(key);
                                                        return true;
                                                    });

                                                    return uniqueLogs.length > 0 ? (
                                                        uniqueLogs.map((log: any, idx: number) => (
                                                            <Box key={idx} sx={{ py: 1 }}>
                                                                <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.8rem' }}>
                                                                    [{log.prod_name}] {log.notes || `Status changed to ${log.to_status.replace('_', ' ').toUpperCase()}`}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary" display="block">
                                                                    By: {log.changed_by_name || "System"} • {new Date(log.changed_at).toLocaleString()}
                                                                </Typography>
                                                            </Box>
                                                        ))
                                                    ) : (
                                                        <Typography variant="caption" color="text.disabled">No production logs recorded yet.</Typography>
                                                    );
                                                })()}
                                            </Stack>
                                        </CardContent>
                                    </Card>

                                    <Typography variant="subtitle1" fontWeight={800} mt={2}>Production Items (Shortages)</Typography>
                                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: alpha(theme.palette.divider, 0.05) }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Shortage Qty</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 700 }}>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {shortages.filter(s => s.stock_request === selectedRequest.id).map((item) => (
                                                    <TableRow key={item.id} data-testid={`bo-shortage-item-${item.id}`}>
                                                        <TableCell>{item.product_name}</TableCell>
                                                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: 700 }}>{fmtQty(item.shortage_quantity)}</TableCell>
                                                        <TableCell align="center">
                                                            <Chip label={item.status.toUpperCase()} color={getStatusColor(item.status) as any} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Stack>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setDetailsOpen(false)} variant="outlined">Close</Button>
                </DialogActions>
            </Dialog>

            {/* Original Stock Request Dialog */}
            <Dialog
                open={originalRequestModalOpen}
                onClose={() => setOriginalRequestModalOpen(false)}
                maxWidth="md"
                fullWidth
                sx={{ zIndex: 1400 }}
                PaperProps={{ sx: { borderRadius: 1 } }}
            >
                <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                        <AssignmentIcon color="primary" fontSize="small" />
                        <Box>
                            <Typography variant="h6" fontWeight={800}>Standard Stock Request Details</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Request: <strong>{selectedRequest?.request_number}</strong>
                            </Typography>
                        </Box>
                    </Stack>
                    <IconButton onClick={() => setOriginalRequestModalOpen(false)} size="small"><CloseIcon /></IconButton>
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
                                            {selectedRequest.status === 'in_production' || selectedRequest.status === 'backordered'
                                                ? 'All requested items are currently out of stock and have been sent to production. You can track the production status and delivery timeline under the Backordered Orders section.'
                                                : 'Few items are insufficient in stock. Those have been sent to production while available items will be processed. You can check the status of shortage items under the Backordered Orders section.'}
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
                                            <Typography variant="h6" fontWeight={800}>{selectedRequest.distributor_name}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
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
                                                activeStep={getDetailedTimelineData(selectedRequest).activeStep}
                                                orientation="vertical"
                                                connector={<ColorlibConnector />}
                                            >
                                                {getDetailedTimelineData(selectedRequest).steps.map((step, index) => {
                                                    const tl = getDetailedTimelineData(selectedRequest);
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
                                                    <TableCell align="right">{item.requested_quantity}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>{item.approved_quantity || 0}</TableCell>
                                                    {selectedRequest.has_shortage && (
                                                        <TableCell align="right" sx={{
                                                            color: Number(item.shortage_quantity) > 0 ? 'warning.main' : 'text.disabled',
                                                            fontWeight: Number(item.shortage_quantity) > 0 ? 700 : 400
                                                        }}>
                                                            {Number(item.shortage_quantity) > 0 ? item.shortage_quantity : '—'}
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
                                                                            {shortage.shortage_quantity}
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
                <DialogActions sx={{ p: 2.5 }}>
                    <Button onClick={() => setOriginalRequestModalOpen(false)} variant="outlined">Close</Button>
                </DialogActions>
            </Dialog>

            <InvoiceModal
                open={invoiceOpen}
                onClose={() => setInvoiceOpen(false)}
                request={selectedRequest}
                initialTrigger={initialTrigger}
                onSuccess={() => {
                    fetchShortages();
                    showMessage("Invoice generated successfully");
                }}
                userRole={userRole || ""}
            />

            <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 800 }}>Record Payment</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Please enter the payment reference/transaction ID to mark this invoice as paid.
                    </Typography>
                    <TextField
                        fullWidth
                        label="Payment Reference"
                        placeholder="e.g. TXN123456, GPay, Bank Transfer"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        autoFocus
                        size="small"
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setPaymentDialogOpen(false)} color="inherit" sx={{ fontWeight: 700 }}>Cancel</Button>
                    <Button
                        onClick={confirmPayment}
                        variant="contained"
                        color="success"
                        sx={{ fontWeight: 700 }}
                    >
                        Mark as Paid
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
}

export default function BackorderedPage() {
    return (
        <Suspense fallback={<CircularProgress />}>
            <BackorderedContent />
        </Suspense>
    );
}

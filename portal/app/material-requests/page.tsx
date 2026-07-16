"use client";
import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
    TablePagination,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useTheme,
    alpha,
    CircularProgress,
    Grid,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Tooltip,
    Snackbar,
    Alert,
    Card,
    CardContent,
    Autocomplete,
    Divider,
    Avatar,
    FormControlLabel,
    Switch,
    TableSortLabel,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

import { SearchIcon, AddIcon, CloseIcon, PendingActionsIcon, CheckCircleIcon, AssignmentIcon, FilterListIcon, MoreVertIcon, ShoppingBagIcon, DeleteOutlineIcon, Inventory2OutlinedIcon as Inventory2OutlineIcon, ReceiptIcon, MoveToInboxIcon, LocalShippingIcon, PictureAsPdfIcon, VisibilityIcon, SendIcon, EditIcon, CancelIcon, HistoryIcon, PublishedWithChangesIcon, WarningAmberIcon, FilterAltOffIcon, RefreshIcon } from "@/components/icons";

import { purchaseService, MaterialRequest, MaterialRequestItem, Supplier } from "@/lib/purchase-service";
import { warehouseService, Item, Warehouse } from "@/lib/warehouse-service";
import { authService, UserProfile } from "@/lib/auth-service";
import { mastersService, TaxSlab } from "@/lib/masters-service";
import MaterialRequisitionModal from "@/components/shared/MaterialRequisitionModal";
import PurchaseOrderTimelineModal from "@/components/shared/PurchaseOrderTimelineModal";

export default function MaterialRequestsPage() {
    const theme = useTheme();
    const searchParams = useSearchParams();
    const [requests, setRequests] = useState<MaterialRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || "all");
    const [requesterFilter, setRequesterFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [orderBy, setOrderBy] = useState<keyof MaterialRequest>("request_number");
    const [order, setOrder] = useState<"asc" | "desc">("desc");

    const [openDialog, setOpenDialog] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [currentRequest, setCurrentRequest] = useState<Partial<MaterialRequest>>({});
    const [requestItems, setRequestItems] = useState<Partial<MaterialRequestItem>[]>([]);
    const [saving, setSaving] = useState(false);

    // Data for dropdowns
    const [rawMaterials, setRawMaterials] = useState<Item[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [taxSlabs, setTaxSlabs] = useState<TaxSlab[]>([]);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

    const [poDialog, setPoDialog] = useState({
        open: false,
        requestId: 0,
        orderDate: new Date().toISOString().split('T')[0],
        deliveryDate: "",
        isTaxInclusive: false,
        items: [] as any[]
    });

    const [poTimeline, setPoTimeline] = useState<{ open: boolean, poId: number | null }>({ open: false, poId: null });

    // Activity log (status history) viewer
    const [activityLog, setActivityLog] = useState<{ open: boolean; row: MaterialRequest | null }>({ open: false, row: null });
    // Admin status override
    const [overrideDialog, setOverrideDialog] = useState<{ open: boolean; id: number; status: string }>({ open: false, id: 0, status: "" });
    // Reject with mandatory reason
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: number; reason: string }>({ open: false, id: 0, reason: "" });

    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error" | "info" | "warning";
    }>({
        open: false,
        message: "",
        severity: "success",
    });

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [materialResp, requestResp, supplierResp, userResp, taxResp] = await Promise.all([
                warehouseService.getItems({ 
                    page_size: "1000",
                    is_active: "true",
                    status: "active"
                }),
                purchaseService.getMaterialRequests({ page_size: "1000" }),
                purchaseService.getSuppliers({ page_size: "1000" }),
                authService.getCurrentUser(),
                // Only active tax slabs apply to new entries; deactivated ones are excluded.
                mastersService.getTaxSlabs({ is_active: "true" })
            ]);

            setRawMaterials(materialResp.results || []);
            setRequests(requestResp.results || []);
            setSuppliers(supplierResp.results || []);
            setTaxSlabs(taxResp.results || []);
            setCurrentUser(userResp);

        } catch (error) {
            console.error("Failed to fetch data:", error);
            setSnackbar({
                open: true,
                message: "Failed to load data",
                severity: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        setPage(0);
    }, [searchQuery, statusFilter, requesterFilter, priorityFilter, startDate, endDate]);

    useEffect(() => {
        const urlStatus = searchParams.get('status');
        if (urlStatus) setStatusFilter(urlStatus);
    }, [searchParams]);

    const isAuthorized = useMemo(() => {
        if (!currentUser) return false;
        return ["admin", "purchase_manager", "accounts_officer", "production_manager", "warehouse_manager"].includes(currentUser.role);
    }, [currentUser]);

    const canViewFullFields = useMemo(() => {
        if (!currentUser) return false;
        return ["admin", "purchase_manager", "accounts_officer", "warehouse_manager"].includes(currentUser.role);
    }, [currentUser]);

    const canManageStatus = useMemo(() => {
        if (!currentUser) return false;
        return ["admin", "accounts_officer", "purchase_manager"].includes(currentUser.role);
    }, [currentUser]);

    const stats = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return {
            total: requests.length,
            pending: requests.filter(r => r.request_status === 'pending_approval').length,
            approvedToday: requests.filter(r =>
                ['sent_to_accounts', 'po_generated', 'shipment_arrived', 'partially_received', 'stocked', 'completed'].includes(r.request_status) &&
                (rowMatchesDate(r.updated_at, today) || rowMatchesDate(r.created_at, today))
            ).length,
            processing: requests.filter(r => r.request_status === 'po_generated').length,
        };
    }, [requests]);

    // Helper to safely check date
    function rowMatchesDate(isoString: string | undefined, todayStr: string) {
        if (!isoString) return false;
        return isoString.startsWith(todayStr);
    }

    const filtered = useMemo(() => {
        let result = [...requests];

        // Role-based filtering
        if (currentUser?.role === 'accounts_officer') {
            result = result.filter(r =>
                !['draft', 'pending_approval', 'rejected'].includes(r.request_status)
            );
        }

        if (statusFilter === "approved_today") {
            const today = new Date().toISOString().split('T')[0];
            result = result.filter(r =>
                ['sent_to_accounts', 'po_generated', 'shipment_arrived', 'partially_received', 'stocked', 'completed'].includes(r.request_status) &&
                (rowMatchesDate(r.updated_at, today) || rowMatchesDate(r.created_at, today))
            );
        } else if (statusFilter !== "all") {
            result = result.filter((r) => r.request_status === statusFilter);
        }

        if (startDate) {
            result = result.filter((r) => new Date(r.created_at || '') >= new Date(startDate));
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            result = result.filter((r) => new Date(r.created_at || '') <= end);
        }

        if (searchQuery) {
            result = result.filter(
                (r) =>
                    r.request_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (r.created_by_name || '').toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (requesterFilter !== 'all') {
            result = result.filter((r) => (r.created_by_name || '') === requesterFilter);
        }

        if (priorityFilter !== 'all') {
            result = result.filter((r) => (r.priority || 'medium') === priorityFilter);
        }

        // Sorting
        result.sort((a, b) => {
            let valA: any = a[orderBy] ?? '';
            let valB: any = b[orderBy] ?? '';

            if (orderBy === 'created_at') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
                return order === 'asc' ? cmp : -cmp;
            }

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [requests, searchQuery, statusFilter, requesterFilter, priorityFilter, currentUser, startDate, endDate, orderBy, order]);

    const paginated = useMemo(() => {
        return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [filtered, page, rowsPerPage]);

    const totalCalculated = useMemo(() => {
        return requestItems.reduce((sum, item) => {
            const qty = typeof item.quantity === 'string' ? parseFloat(item.quantity) : (item.quantity || 0);
            const rate = typeof item.estimated_rate === 'string' ? parseFloat(item.estimated_rate) : (item.estimated_rate || 0);
            return sum + (qty * rate);
        }, 0);
    }, [requestItems]);

    const handleOpenAdd = () => {
        setCurrentRequest({
            request_status: "draft",
            total_amount: 0,
            department: currentUser?.role === 'purchase_manager' ? 'Procurement' :
                currentUser?.role === 'production_manager' ? 'Production' : 'Operations'
        });
        setRequestItems([]);
        setIsViewOnly(false);
        setOpenDialog(true);
    };

    const handleOpenEdit = (request: MaterialRequest) => {
        setCurrentRequest({ ...request });
        setRequestItems(request.items || []);
        setIsViewOnly(false);
        setOpenDialog(true);
    };

    const handleOpenView = (request: MaterialRequest) => {
        setCurrentRequest({ ...request });
        setRequestItems(request.items || []);
        setIsViewOnly(true);
        setOpenDialog(true);
    };

    const handleAddRawMaterial = (item: Item) => {
        const exists = requestItems.find(ri => ri.item === item.id);
        if (exists) {
            setSnackbar({ open: true, message: "Item already in list", severity: "info" });
            return;
        }

        setRequestItems([
            ...requestItems,
            {
                item: item.id,
                item_name: item.item_name,
                item_code: item.item_code,
                quantity: 1,
                uom: item.uom,
                estimated_rate: Number(item.standard_rate) || Number(item.valuation_rate) || 0,
                supplier: undefined,
                specification: ""
            }
        ]);
    };

    const handleRemoveItem = (index: number) => {
        setRequestItems(requestItems.filter((_, i) => i !== index));
    };

    const updateItemField = (index: number, field: keyof MaterialRequestItem, value: any) => {
        const updated = [...requestItems];
        updated[index] = { ...updated[index], [field]: value };
        setRequestItems(updated);
    };

    const updatePoItemField = (index: number, field: string, value: any) => {
        const updatedItems = [...poDialog.items];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setPoDialog({ ...poDialog, items: updatedItems });
    };

    // Full status set (mirrors backend MaterialRequest.request_status choices) — for admin override.
    const MR_STATUS_OPTIONS: { value: string; label: string }[] = [
        { value: 'draft', label: 'Draft' },
        { value: 'pending_approval', label: 'Pending Approval' },
        { value: 'approved', label: 'Approved' },
        { value: 'sent_to_accounts', label: 'Under Billing' },
        { value: 'po_generated', label: 'PO Generated' },
        { value: 'shipment_arrived', label: 'Shipment Arrived' },
        { value: 'partially_received', label: 'Partially Received' },
        { value: 'received', label: 'Received' },
        { value: 'stocked', label: 'Stocked in Warehouse' },
        { value: 'short_closed', label: 'Short Closed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'completed', label: 'Completed' },
        { value: 'rejected', label: 'Rejected' },
    ];

    const handleOverrideStatus = async () => {
        if (!overrideDialog.status) return;
        try {
            setLoading(true);
            await purchaseService.overrideMaterialRequestStatus(overrideDialog.id, overrideDialog.status);
            setSnackbar({ open: true, message: "Status overridden successfully", severity: "success" });
            setOverrideDialog({ open: false, id: 0, status: "" });
            await fetchAllData();
        } catch {
            setSnackbar({ open: true, message: "Failed to override status", severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReject = async () => {
        if (!rejectDialog.reason.trim()) {
            setSnackbar({ open: true, message: "A rejection reason is required", severity: "warning" });
            return;
        }
        try {
            setLoading(true);
            await purchaseService.rejectMaterialRequest(rejectDialog.id, rejectDialog.reason.trim());
            setSnackbar({ open: true, message: "Request Rejected", severity: "warning" });
            setRejectDialog({ open: false, id: 0, reason: "" });
            fetchAllData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Failed to reject", severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: string, id: number) => {
        try {
            setLoading(true);
            switch (action) {
                case 'send_to_accounts':
                    await purchaseService.sendToAccounts(id);
                    setSnackbar({ open: true, message: "Sent to Account Officer", severity: "success" });
                    break;
                case 'mark_received':
                    await purchaseService.markReceived(id);
                    setSnackbar({ open: true, message: "Marked as Received", severity: "success" });
                    break;
                case 'mark_stocked':
                    await purchaseService.markStocked(id);
                    setSnackbar({ open: true, message: "Marked as Stocked in Warehouse", severity: "success" });
                    break;
                case 'approve':
                    const reqToApprove = requests.find(r => r.id === id);
                    if (reqToApprove) {
                        const incompleteItem = reqToApprove.items?.find(i => !i.supplier || !i.estimated_rate);
                        if (incompleteItem) {
                            handleOpenEdit(reqToApprove);
                            setLoading(false);
                            return;
                        }
                    }
                    await purchaseService.approveMaterialRequest(id);
                    setSnackbar({ open: true, message: "Request Approved & Sent for Billing", severity: "success" });
                    break;
            }
            fetchAllData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Action failed", severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePO = async () => {
        if (!poDialog.requestId) return;

        try {
            setSaving(true);
            const resp = await purchaseService.generatePOs(poDialog.requestId, {
                order_date: poDialog.orderDate,
                delivery_date: poDialog.deliveryDate || undefined,
                is_tax_inclusive: poDialog.isTaxInclusive,
                items: poDialog.items
            });
            const hasSkipped = Array.isArray(resp.skipped_items) && resp.skipped_items.length > 0;
            setSnackbar({ open: true, message: resp.message, severity: hasSkipped ? "warning" : "success" });
            setPoDialog({ ...poDialog, open: false });
            fetchAllData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.message || "Failed to generate PO", severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadPDF = async (id: number, type: 'mr' | 'po') => {
        try {
            setLoading(true);
            const blob = await purchaseService.downloadMRPDF(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `MaterialRequest_${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            setSnackbar({ open: true, message: "Failed to download PDF", severity: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data: any) => {
        if (!data.items || data.items.length === 0) {
            setSnackbar({ open: true, message: "Add at least one material", severity: "warning" });
            return;
        }

        // --- Validation Logic ---
        const isPurchaseManager = currentUser?.role === 'purchase_manager' || currentUser?.role === 'admin';

        for (const item of data.items) {
            if (!item.item) {
                setSnackbar({ open: true, message: "Material selection is missing for an item", severity: "warning" });
                return;
            }
            if (!item.quantity || parseFloat(item.quantity.toString()) <= 0) {
                setSnackbar({ open: true, message: `Please enter quantity for ${item.item_name}`, severity: "warning" });
                return;
            }

            if (isPurchaseManager) {
                if (!item.estimated_rate || parseFloat(item.estimated_rate.toString()) <= 0) {
                    setSnackbar({ open: true, message: `Please enter estimated rate for ${item.item_name}`, severity: "warning" });
                    return;
                }
                if (!item.supplier) {
                    setSnackbar({ open: true, message: `Please select a preferred supplier for ${item.item_name}`, severity: "warning" });
                    return;
                }
            }
        }

        setSaving(true);
        try {
            if (data.id) {
                await purchaseService.updateMaterialRequest(data.id, data);
                setSnackbar({ open: true, message: "Request updated successfully!", severity: "success" });
            } else {
                await purchaseService.createMaterialRequest(data);
                const isProductionManager = currentUser?.role === 'production_manager';
                setSnackbar({
                    open: true,
                    message: isProductionManager ? "Request submitted for approval!" :
                        isPurchaseManager ? "Request created and sent for billing!" : "Request created!",
                    severity: "success"
                });
            }
            setOpenDialog(false);
            fetchAllData();
        } catch (error: any) {
            setSnackbar({ open: true, message: error.response?.data?.error || error.message || "Failed to save", severity: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleRequestSort = (property: keyof MaterialRequest) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const handleClearFilters = () => {
        setSearchQuery("");
        setStatusFilter("all");
        setRequesterFilter("all");
        setPriorityFilter("all");
        setStartDate("");
        setEndDate("");
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "draft": return "default";
            case "pending_approval": return "warning";
            case "approved": return "info";
            case "sent_to_accounts": return "secondary";
            case "po_generated": return "primary";
            case "received": return "success";
            case "stocked": return "success";
            case "completed": return "success";
            case "rejected": return "error";
            case "cancelled": return "error";
            case "short_closed": return "warning";
            default: return "default";
        }
    };

    const getStatusLabel = (status: string) => {
        if (status === 'pending_approval') return "REQUESTED";
        return status?.replace(/_/g, ' ').toUpperCase();
    };

    const PRIORITY_META: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'error' }> = {
        low: { label: 'Low', color: 'default' },
        medium: { label: 'Medium', color: 'info' },
        high: { label: 'High', color: 'warning' },
        critical: { label: 'Critical', color: 'error' },
    };

    // Unique requesters for the Requested-by filter, from the loaded data.
    const requesterOptions = useMemo(() => {
        const names = new Set<string>();
        requests.forEach((r) => { if (r.created_by_name) names.add(r.created_by_name); });
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [requests]);

    const getPaymentBadge = (request: MaterialRequest) => {
        if (!request.purchase_orders_details || request.purchase_orders_details.length === 0) {
            return <Chip label="No PO" size="small" variant="outlined" />;
        }

        const pos = request.purchase_orders_details;
        const allPaid = pos.every(po => po.payment_status === 'paid');
        const anyPaid = pos.some(po => po.payment_status === 'paid');

        if (allPaid) return <Chip label="Paid" size="small" color="success" sx={{ fontWeight: 800 }} />;
        if (anyPaid) return <Chip label="Partial" size="small" color="warning" sx={{ fontWeight: 800 }} />;
        return <Chip label="Unpaid" size="small" color="error" variant="outlined" sx={{ fontWeight: 800 }} />;
    };

    const canEdit = useMemo(() => {
        if (!currentRequest.id) return true; // New requests
        if (currentUser?.role === 'admin') return true;
        if (currentUser?.role === 'production_manager') return currentRequest.request_status === 'draft';
        if (currentUser?.role === 'purchase_manager') return ['draft', 'pending_approval'].includes(currentRequest.request_status || '');
        if (currentUser?.role === 'accounts_officer') return ['sent_to_accounts', 'approved'].includes(currentRequest.request_status || '');
        return false;
    }, [currentUser, currentRequest]);

    if (!isAuthorized && !loading) {
        return (
            <>
                <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h5" color="error">Access Denied</Typography>
                </Box>
            </>
        );
    }

    return (
        <>
            <Box sx={{ pb: 6 }}>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Header Section */}
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={6}>
                        <Box>
                            <Typography variant="h2" sx={{ fontFamily: 'Georgia, serif', fontWeight: 400, color: 'text.primary', mb: 1 }}>
                                MATERIAL REQUESTS
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                                Manage and approve internal purchase requisitions
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                                onClick={() => { setPage(0); setSearchQuery(''); setStatusFilter('all'); setRequesterFilter('all'); setPriorityFilter('all'); setStartDate(''); setEndDate(''); fetchAllData(); }}
                                sx={{ borderRadius: 1, textTransform: 'none', fontWeight: 700 }}
                            >
                                Refresh
                            </Button>
                            {currentUser?.role !== 'accounts_officer' && (
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleOpenAdd}
                                    sx={{
                                        px: 4,
                                        py: 1.5,
                                        borderRadius: 1,
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        bgcolor: 'text.primary',
                                        '&:hover': { bgcolor: '#000' }
                                    }}
                                >
                                    New Request
                                </Button>
                            )}
                        </Stack>
                    </Stack>

                    {/* Stats Dashboard */}
                    <Grid container spacing={4} mb={6}>
                        {[
                            { label: "Total Requests", value: stats.total, icon: <ShoppingBagIcon />, color: theme.palette.text.disabled, filter: 'all' },
                            { label: "Pending Approval", value: stats.pending, icon: <PendingActionsIcon />, color: theme.palette.warning.main, filter: 'pending_approval' },
                            { label: "Approved Today", value: stats.approvedToday, icon: <CheckCircleIcon />, color: theme.palette.success.main, filter: 'approved_today' },
                            { label: "Processing", value: stats.processing, icon: <AssignmentIcon />, color: theme.palette.info.main, filter: 'po_generated' },
                        ].map((stat, idx) => (
                            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
                                <Card
                                    onClick={() => { setStatusFilter(stat.filter); setPage(0); }}
                                    sx={{
                                        borderRadius: 1,
                                        borderLeft: `5px solid ${stat.color}`,
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
                                        height: '100%',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: '0 12px 40px rgba(0,0,0,0.1)'
                                        }
                                    }}
                                >
                                    <CardContent sx={{ p: 3, position: 'relative' }}>
                                        <Box sx={{
                                            position: 'absolute', top: 12, right: 12,
                                            bgcolor: alpha(stat.color, 0.1), color: stat.color,
                                            borderRadius: 2, px: 1, py: 0.5, fontSize: '0.75rem', fontWeight: 800
                                        }}>
                                        </Box>
                                        <Avatar sx={{ bgcolor: alpha(stat.color, 0.1), color: stat.color, mb: 2, width: 48, height: 48 }}>
                                            {stat.icon}
                                        </Avatar>
                                        <Typography variant="h3" fontWeight={800} sx={{ mb: 0.5 }}>{stat.value}</Typography>
                                        <Typography variant="body2" color="text.secondary" fontWeight={600}>{stat.label}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Table Control Bar */}
                    <Paper elevation={0} sx={{
                        p: 2.5, mb: 4, borderRadius: 2, bgcolor: 'background.paper',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                        border: '1px solid #f0f0f0'
                    }}>
                        <Grid container spacing={2.5} alignItems="center">
                            <Grid size={{ xs: 12, md: 4 }}>
                                <TextField
                                    fullWidth
                                    placeholder="Search by Request # or Requester..."
                                    size="small"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'action.hover' } }}
                                />
                            </Grid>

                            <Grid size={{ xs: 12, md: 2 }}>
                                <FormControl fullWidth size="small">
                                    <Select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        sx={{ borderRadius: 1.5, bgcolor: 'action.hover', fontWeight: 600 }}
                                        data-testid="mr-status-filter"
                                    >
                                        <MenuItem value="all">All Status</MenuItem>
                                        <MenuItem value="pending_approval">Requested</MenuItem>
                                        <MenuItem value="sent_to_accounts">Sent to Accounts</MenuItem>
                                        <MenuItem value="po_generated">PO Generated</MenuItem>
                                        <MenuItem value="shipment_arrived">Shipment Arrived</MenuItem>
                                        <MenuItem value="partially_received">Partially Received</MenuItem>
                                        <MenuItem value="stocked">Stocked</MenuItem>
                                        <MenuItem value="short_closed">Short Closed</MenuItem>
                                        <MenuItem value="cancelled">Cancelled</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid size={{ xs: 6, md: 2 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Priority</InputLabel>
                                    <Select
                                        value={priorityFilter}
                                        label="Priority"
                                        onChange={(e) => setPriorityFilter(e.target.value)}
                                        sx={{ borderRadius: 1.5, bgcolor: 'action.hover', fontWeight: 600 }}
                                        data-testid="mr-priority-filter"
                                    >
                                        <MenuItem value="all">All Priority</MenuItem>
                                        <MenuItem value="critical">Critical</MenuItem>
                                        <MenuItem value="high">High</MenuItem>
                                        <MenuItem value="medium">Medium</MenuItem>
                                        <MenuItem value="low">Low</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid size={{ xs: 6, md: 2 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Requester</InputLabel>
                                    <Select
                                        value={requesterFilter}
                                        label="Requester"
                                        onChange={(e) => setRequesterFilter(e.target.value)}
                                        sx={{ borderRadius: 1.5, bgcolor: 'action.hover', fontWeight: 600 }}
                                        data-testid="mr-requester-filter"
                                    >
                                        <MenuItem value="all">All Requesters</MenuItem>
                                        {requesterOptions.map((name) => (
                                            <MenuItem key={name} value={name}>{name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid size={{ xs: 12, md: 4 }}>
                                <Stack direction="row" spacing={1.5}>
                                    <TextField
                                        label="From"
                                        type="date"
                                        size="small"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'action.hover' } }}
                                    />
                                    <TextField
                                        label="To"
                                        type="date"
                                        size="small"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: 'action.hover' } }}
                                    />
                                </Stack>
                            </Grid>

                            <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5 }}>
                                {(statusFilter !== 'all' || requesterFilter !== 'all' || priorityFilter !== 'all' || startDate || endDate || searchQuery) && (
                                    <Tooltip title="Reset Filters">
                                        <IconButton
                                            onClick={handleClearFilters}
                                            sx={{
                                                bgcolor: alpha(theme.palette.error.main, 0.08),
                                                color: theme.palette.error.main,
                                                '&:hover': {
                                                    bgcolor: alpha(theme.palette.error.main, 0.15),
                                                    transform: 'scale(1.1) rotate(-10deg)',
                                                },
                                                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                width: 40,
                                                height: 40,
                                                border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`
                                            }}
                                        >
                                            <FilterAltOffIcon sx={{ fontSize: 20 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Main Table */}
                    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' }}>
                        <Table>
                            <TableHead sx={{ bgcolor: 'action.hover' }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'request_number'}
                                            direction={orderBy === 'request_number' ? order : 'asc'}
                                            onClick={() => handleRequestSort('request_number')}
                                        >
                                            Request ID
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>Item</TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'created_at'}
                                            direction={orderBy === 'created_at' ? order : 'asc'}
                                            onClick={() => handleRequestSort('created_at')}
                                        >
                                            Date
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'created_by_name'}
                                            direction={orderBy === 'created_by_name' ? order : 'asc'}
                                            onClick={() => handleRequestSort('created_by_name')}
                                        >
                                            Requested by
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }}>
                                        <TableSortLabel
                                            active={orderBy === 'request_status'}
                                            direction={orderBy === 'request_status' ? order : 'asc'}
                                            onClick={() => handleRequestSort('request_status')}
                                        >
                                            Status
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 800, color: 'text.primary' }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 10 }}><CircularProgress color="inherit" /></TableCell></TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 12 }}>
                                            <Box sx={{ opacity: 0.5 }}>
                                                <Inventory2OutlineIcon sx={{ fontSize: 64, mb: 2, color: 'text.disabled' }} />
                                                <Typography variant="h6" color="text.secondary" fontWeight={700}>No Material Requests Found</Typography>
                                                <Typography variant="body2" color="text.disabled">Try adjusting your filters or search terms</Typography>
                                                <Button
                                                    variant="outlined"
                                                    onClick={handleOpenAdd}
                                                    startIcon={<AddIcon />}
                                                    sx={{ mt: 3, borderRadius: 2 }}
                                                >
                                                    Create First Request
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ) : paginated.map((row) => (
                                    <TableRow key={row.id} hover sx={{ '& td': { py: 3 } }}>
                                        <TableCell>
                                            <Typography variant="subtitle2" fontWeight={800}>{row.request_number}</Typography>
                                            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                                <Chip
                                                    label={(PRIORITY_META[row.priority || 'medium']?.label || 'Medium')}
                                                    size="small"
                                                    color={PRIORITY_META[row.priority || 'medium']?.color || 'info'}
                                                    variant={(row.priority === 'high' || row.priority === 'critical') ? 'filled' : 'outlined'}
                                                    data-testid={`mr-priority-chip-${row.id}`}
                                                    sx={{ fontWeight: 800, fontSize: '0.6rem', height: 18 }}
                                                />
                                                {row.production_plan_number && (
                                                    <Tooltip title="Triggered by this production plan">
                                                        <Chip
                                                            label={row.production_plan_number}
                                                            size="small"
                                                            variant="outlined"
                                                            color="secondary"
                                                            data-testid={`mr-plan-chip-${row.id}`}
                                                            sx={{ fontWeight: 700, fontSize: '0.6rem', height: 18 }}
                                                        />
                                                    </Tooltip>
                                                )}
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip
                                                title={
                                                    (row.items && row.items.length > 0)
                                                        ? (
                                                            <Box sx={{ py: 0.5 }}>
                                                                {row.items.map((it, i) => (
                                                                    <Typography key={i} variant="caption" component="div">
                                                                        • {it.item_name} — {it.quantity}{it.uom ? ` ${it.uom}` : ''}
                                                                    </Typography>
                                                                ))}
                                                            </Box>
                                                        )
                                                        : 'No items'
                                                }
                                                arrow
                                                disableHoverListener={!row.items || row.items.length === 0}
                                            >
                                                <Box sx={{ display: 'inline-block', cursor: (row.items && row.items.length > 1) ? 'help' : 'default' }} data-testid={`mr-items-${row.id}`}>
                                                    <Typography variant="subtitle2" sx={{ maxWidth: 200, WebkitLineClamp: 1, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {row.items?.[0]?.item_name || 'No Items'}
                                                    </Typography>
                                                    {row.items && row.items.length > 1 && (
                                                        <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                                                            +{row.items.length - 1} more
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{new Date(row.created_at || '').toLocaleDateString()}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(row.created_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>{row.created_by_name || 'System'}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={getStatusLabel(row.request_status || '')}
                                                size="small"
                                                color={getStatusColor(row.request_status || '') as any}
                                                sx={{ fontWeight: 800, borderRadius: 1.5, fontSize: '0.65rem' }}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                <Tooltip title="View Details">
                                                    <IconButton size="small" onClick={() => handleOpenView(row)}>
                                                        <VisibilityIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                                                    </IconButton>
                                                </Tooltip>

                                                <Tooltip title="Activity Log">
                                                    <IconButton size="small" onClick={() => setActivityLog({ open: true, row })}>
                                                        <HistoryIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                                                    </IconButton>
                                                </Tooltip>

                                                {currentUser?.role === 'admin' && (
                                                    <Tooltip title="Override Status">
                                                        <IconButton size="small" onClick={() => setOverrideDialog({ open: true, id: row.id, status: row.request_status || '' })}>
                                                            <PublishedWithChangesIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {(currentUser?.role === 'admin' ||
                                                    (currentUser?.role === 'purchase_manager' && (row.request_status === 'pending_approval' || row.request_status === 'draft')) ||
                                                    (currentUser?.role === 'production_manager' && row.request_status === 'draft') ||
                                                    (currentUser?.role === 'accounts_officer' && (row.request_status === 'sent_to_accounts' || row.request_status === 'approved'))) && (
                                                        <Tooltip title="Edit">
                                                            <IconButton size="small" onClick={() => handleOpenEdit(row)}>
                                                                <EditIcon sx={{ fontSize: 18, color: 'info.main' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                {currentUser?.role === 'purchase_manager' && row.request_status === 'pending_approval' && (
                                                    <>
                                                        <Tooltip title="Approve Request">
                                                            <IconButton size="small" onClick={() => handleAction('approve', row.id)}>
                                                                <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Reject Request">
                                                            <IconButton size="small" onClick={() => setRejectDialog({ open: true, id: row.id, reason: "" })} data-testid={`mr-reject-btn-${row.id}`}>
                                                                <CancelIcon sx={{ fontSize: 18, color: 'error.main' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </>
                                                )}

                                                {currentUser?.role === 'purchase_manager' && row.request_status === 'approved' && (
                                                    <Tooltip title="Send for Billing">
                                                        <IconButton size="small" onClick={() => handleAction('send_to_accounts', row.id)}>
                                                            <SendIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {currentUser?.role === 'accounts_officer' && (row.request_status === 'sent_to_accounts' || row.request_status === 'approved') && (
                                                    <Tooltip title="Generate Purchase Order">
                                                        <IconButton size="small" onClick={() => {
                                                            const poItems = (row.items || []).map((item: any) => {
                                                                // Find matching tax slab by HSN code
                                                                const matchedSlab = taxSlabs.find(slab =>
                                                                    slab.hsn_codes && slab.hsn_codes.includes(item.hsn_code)
                                                                );
                                                                const taxPercentage = matchedSlab ? matchedSlab.percentage : 0;

                                                                return {
                                                                    ...item,
                                                                    tax_type_ui: 'intra',
                                                                    tax_rate_ui: taxPercentage.toString(),
                                                                    cgst_rate: taxPercentage / 2,
                                                                    sgst_rate: taxPercentage / 2,
                                                                    igst_rate: 0
                                                                };
                                                            });

                                                            setPoDialog({
                                                                ...poDialog,
                                                                open: true,
                                                                requestId: row.id,
                                                                items: poItems
                                                            });
                                                        }}>
                                                            <ReceiptIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {currentUser?.role === 'warehouse_manager' && row.request_status === 'po_generated' && (
                                                    <Tooltip title="Mark Received">
                                                        <IconButton size="small" onClick={() => handleAction('mark_received', row.id)}>
                                                            <LocalShippingIcon sx={{ fontSize: 18, color: 'success.main' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}

                                                {currentUser?.role === 'warehouse_manager' && row.request_status === 'received' && (
                                                    <Tooltip title="Store in Warehouse">
                                                        <IconButton size="small" onClick={() => handleAction('mark_stocked', row.id)}>
                                                            <MoveToInboxIcon sx={{ fontSize: 18, color: 'success.main' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}


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

                    {/* Dialog Implementation */}
                    <MaterialRequisitionModal
                        open={openDialog}
                        onClose={() => setOpenDialog(false)}
                        onSave={handleSave}
                        request={currentRequest}
                        isViewOnly={isViewOnly}
                        currentUser={currentUser}
                        rawMaterials={rawMaterials}
                        suppliers={suppliers}
                        saving={saving}
                    />

                    <PurchaseOrderTimelineModal
                        open={poTimeline.open}
                        poId={poTimeline.poId}
                        onClose={() => setPoTimeline({ open: false, poId: null })}
                    />

                    {/* Generate PO Dialog */}
                    <Dialog open={poDialog.open} onClose={() => setPoDialog({ ...poDialog, open: false })} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 6, p: 2 } }}>
                        <DialogTitle sx={{ fontWeight: 800 }}>Generate Purchase Orders</DialogTitle>
                        <DialogContent>
                            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Review pricing and tax details for each item. Individual POs will be created per supplier.
                                </Typography>

                                <Stack direction="row" spacing={3}>
                                    <TextField
                                        label="PO Date"
                                        type="date"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={poDialog.orderDate}
                                        onChange={(e) => setPoDialog({ ...poDialog, orderDate: e.target.value })}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                                    />

                                    <TextField
                                        label="Est. Delivery Date"
                                        type="date"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={poDialog.deliveryDate || ''}
                                        onChange={(e) => setPoDialog({ ...poDialog, deliveryDate: e.target.value })}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
                                    />

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={poDialog.isTaxInclusive}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPoDialog({ ...poDialog, isTaxInclusive: e.target.checked })}
                                            />
                                        }
                                        label="Tax Inclusive"
                                        sx={{ minWidth: 150 }}
                                    />
                                </Stack>

                                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee', borderRadius: 1 }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                <TableCell sx={{ fontWeight: 700 }}>Material</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Qty</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Rate (₹)</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>GST Type</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>GST %</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {poDialog.items.map((item, idx) => {
                                                const rate = parseFloat(item.estimated_rate || 0);
                                                const qty = item.quantity || 0;
                                                const baseAmount = rate * qty;
                                                const taxRate = parseFloat(item.tax_rate_ui || 0);
                                                const amount = poDialog.isTaxInclusive ? baseAmount : baseAmount * (1 + taxRate / 100);

                                                return (
                                                    <TableRow key={idx}>
                                                        <TableCell sx={{ maxWidth: 150 }}>
                                                            <Typography variant="body2" fontWeight={600} noWrap>{item.item_name}</Typography>
                                                            <Typography variant="caption" color="text.secondary">{item.supplier_name}</Typography>
                                                        </TableCell>
                                                        <TableCell>{qty} {item.uom}</TableCell>
                                                        <TableCell>
                                                            <TextField
                                                                size="small"
                                                                value={item.estimated_rate}
                                                                onChange={(e) => updatePoItemField(idx, 'estimated_rate', e.target.value)}
                                                                variant="standard"
                                                                sx={{ width: 80 }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Select
                                                                size="small"
                                                                value={item.tax_type_ui}
                                                                onChange={(e) => {
                                                                    const type = e.target.value as 'intra' | 'inter';
                                                                    const updatedItems = [...poDialog.items];
                                                                    const supplierId = item.supplier;

                                                                    updatedItems.forEach((itm, idx2) => {
                                                                        if (itm.supplier === supplierId) {
                                                                            const totalRate = parseFloat(itm.tax_rate_ui || '0');
                                                                            itm.tax_type_ui = type;
                                                                            if (type === 'intra') {
                                                                                itm.cgst_rate = totalRate / 2;
                                                                                itm.sgst_rate = totalRate / 2;
                                                                                itm.igst_rate = 0;
                                                                            } else {
                                                                                itm.cgst_rate = 0;
                                                                                itm.sgst_rate = 0;
                                                                                itm.igst_rate = totalRate;
                                                                            }
                                                                        }
                                                                    });
                                                                    setPoDialog({ ...poDialog, items: updatedItems });
                                                                }}
                                                                variant="standard"
                                                                sx={{ fontSize: '0.75rem' }}
                                                            >
                                                                <MenuItem value="intra">Intra (CGST+SGST)</MenuItem>
                                                                <MenuItem value="inter">Inter (IGST)</MenuItem>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell>
                                                            <TextField
                                                                size="small"
                                                                value={item.tax_rate_ui}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const floatRate = parseFloat(val || '0');
                                                                    const updatedItems = [...poDialog.items];
                                                                    const itm = updatedItems[idx];

                                                                    itm.tax_rate_ui = val;
                                                                    if (itm.tax_type_ui === 'intra') {
                                                                        itm.cgst_rate = floatRate / 2;
                                                                        itm.sgst_rate = floatRate / 2;
                                                                        itm.igst_rate = 0;
                                                                    } else {
                                                                        itm.cgst_rate = 0;
                                                                        itm.sgst_rate = 0;
                                                                        itm.igst_rate = floatRate;
                                                                    }

                                                                    setPoDialog({ ...poDialog, items: updatedItems });
                                                                }}
                                                                variant="standard"
                                                                sx={{ width: 60 }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2" fontWeight={800}>₹{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        </DialogContent>
                        <DialogActions sx={{ p: 3 }}>
                            <Button onClick={() => setPoDialog({ ...poDialog, open: false })} sx={{ fontWeight: 700 }}>Cancel</Button>
                            <Button
                                variant="contained"
                                onClick={handleGeneratePO}
                                disabled={saving}
                                startIcon={saving ? <CircularProgress size={20} /> : <ReceiptIcon />}
                                sx={{
                                    borderRadius: 1, px: 4, fontWeight: 800,
                                    background: `linear-gradient(135deg, ${theme.palette.error.light}, ${theme.palette.error.dark})`
                                }}
                            >
                                {saving ? "Generating..." : "Generate POs"}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Activity Log dialog (status history) */}
                    <Dialog open={activityLog.open} onClose={() => setActivityLog({ open: false, row: null })} maxWidth="sm" fullWidth>
                        <DialogTitle sx={{ fontWeight: 800 }}>
                            Activity Log {activityLog.row ? `— ${activityLog.row.request_number}` : ''}
                        </DialogTitle>
                        <DialogContent dividers>
                            {(activityLog.row?.status_history?.length ?? 0) === 0 ? (
                                <Typography variant="body2" color="text.secondary">No activity recorded yet.</Typography>
                            ) : (
                                <Stack spacing={1.5}>
                                    {[...(activityLog.row?.status_history ?? [])].reverse().map((h, i) => (
                                        <Box key={i} sx={{ pl: 1.5, borderLeft: '3px solid', borderColor: 'info.main' }}>
                                            <Typography variant="body2" fontWeight={700}>{h.status}</Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                {h.user || 'System'}{h.timestamp ? ` • ${new Date(h.timestamp).toLocaleString('en-IN')}` : ''}
                                            </Typography>
                                            {h.notes ? <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>{h.notes}</Typography> : null}
                                        </Box>
                                    ))}
                                </Stack>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setActivityLog({ open: false, row: null })}>Close</Button>
                        </DialogActions>
                    </Dialog>

                    {/* Admin: override status */}
                    <Dialog open={overrideDialog.open} onClose={() => setOverrideDialog({ open: false, id: 0, status: "" })} maxWidth="xs" fullWidth>
                        <DialogTitle sx={{ fontWeight: 800 }}>Override Status</DialogTitle>
                        <DialogContent dividers>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                                Set this material request to any status. The change is recorded in the activity log.
                            </Typography>
                            <FormControl fullWidth size="small">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    label="Status"
                                    value={overrideDialog.status}
                                    onChange={(e) => setOverrideDialog({ ...overrideDialog, status: e.target.value })}
                                >
                                    {MR_STATUS_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setOverrideDialog({ open: false, id: 0, status: "" })} color="inherit">Cancel</Button>
                            <Button onClick={handleOverrideStatus} variant="contained" disabled={!overrideDialog.status}>Apply</Button>
                        </DialogActions>
                    </Dialog>

                    {/* Reject with mandatory reason */}
                    <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, id: 0, reason: "" })} maxWidth="xs" fullWidth>
                        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Reject Material Request</DialogTitle>
                        <DialogContent dividers>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                                A reason is required and will be recorded in the activity log so the requester can see why it was rejected.
                            </Typography>
                            <TextField
                                autoFocus
                                fullWidth
                                multiline
                                rows={3}
                                label="Rejection reason"
                                placeholder="e.g. Duplicate of MR-202506-0003 / budget not approved"
                                value={rejectDialog.reason}
                                onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
                                slotProps={{ htmlInput: { maxLength: 500, "data-testid": "mr-reject-reason-input" } as any }}
                            />
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setRejectDialog({ open: false, id: 0, reason: "" })} color="inherit">Cancel</Button>
                            <Button onClick={handleConfirmReject} variant="contained" color="error" disabled={!rejectDialog.reason.trim()} data-testid="mr-reject-confirm-btn">
                                Reject Request
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


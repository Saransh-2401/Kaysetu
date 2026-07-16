"use client";
import React, { useState, useEffect } from "react";
import {
    Box,
    Grid,
    Paper,
    Typography,
    Stack,
    Chip,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    useTheme,
    alpha,
    TextField,
    InputAdornment,
    LinearProgress,
    Tooltip,
    Snackbar,
    Alert,
    MenuItem,
    TableSortLabel,
    TablePagination,
} from "@mui/material";
import { motion } from "framer-motion";

// Icons
import { SearchIcon, VisibilityIcon, LocalShippingIcon, PaidIcon, ReceiptIcon, PictureAsPdfIcon, FilterAltOffIcon, HistoryIcon } from "@/components/icons";

import { salesService, SalesOrder } from "@/lib/sales-service";
import { authService, UserProfile, SalesAgent } from "@/lib/auth-service";
import { distributorService } from "@/lib/distributor-service";
import OrderDetailModal from "@/components/sales/OrderDetailModal";

interface Distributor {
    id: number;
    full_name: string;
    username: string;
}

export default function OrderHistoryPage() {
    const theme = useTheme();
    const [search, setSearch] = useState("");
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });

    // Filter States
    const [deliveryFilter, setDeliveryFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all");
    const [distributorFilter, setDistributorFilter] = useState("all");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [orderBy, setOrderBy] = useState<"customer_name" | "total" | "order_date">("order_date");
    const [order, setOrder] = useState<"asc" | "desc">("desc");
    const [salesAgents, setSalesAgents] = useState<SalesAgent[]>([]);
    const [agentFilter, setAgentFilter] = useState("all");

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);

    const handleOpenDetails = async (order: SalesOrder) => {
        try {
            setLoading(true);
            const fullOrder = await salesService.getSalesOrder(order.id);
            setSelectedOrder(fullOrder);
            setDetailModalOpen(true);
        } catch (error) {
            console.error("Error fetching order details:", error);
            setSelectedOrder(order);
            setDetailModalOpen(true);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            const [ordersData, userData] = await Promise.all([
                salesService.getSalesOrders(),
                authService.getCurrentUser(),
            ]);

            setUser(userData);

            // Fetch distributors and agents if Admin, Sales Manager, or Distributor
            if (["admin", "sales_manager", "distributor"].includes(userData.role)) {
                try {
                    const [distData, agentsData] = await Promise.all([
                        authService.getAssignedDistributors(),
                        authService.getAssignedSalesAgents()
                    ]);
                    setDistributors(distData || []);
                    setSalesAgents(agentsData || []);
                } catch (e) {
                    console.error("Failed to fetch distributors or agents", e);
                }
            }

            // Filter ONLY Delivered or Rejected for history
            const historyOrders = (ordersData.results || []).filter((o: SalesOrder) =>
                ["delivered", "rejected"].includes(o.fulfillment_status.toLowerCase())
            );
            setOrders(historyOrders);
        } catch (error) {
            console.error("Failed to fetch order history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setPage(0);
    }, [search, deliveryFilter, paymentFilter, distributorFilter, agentFilter, startDate, endDate]);


    const sortedAndFilteredOrders = React.useMemo(() => {
        let filtered = orders.filter((o) => {
            const matchesSearch =
                o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
                o.order_number.toLowerCase().includes(search.toLowerCase());

            const matchesDelivery =
                deliveryFilter === "all" ||
                o.fulfillment_status.toLowerCase() === deliveryFilter.toLowerCase();

            const matchesPayment =
                paymentFilter === "all" ||
                o.payment_status.toLowerCase() === paymentFilter.toLowerCase();

            const matchesDistributor =
                distributorFilter === "all" ||
                o.distributor?.toString() === distributorFilter ||
                o.distributor_name?.toLowerCase().includes(distributorFilter.toLowerCase());

            const matchesAgent =
                agentFilter === "all" ||
                o.assigned_agent?.toString() === agentFilter ||
                o.assigned_agent_name?.toLowerCase().includes(agentFilter.toLowerCase());

            let matchesDate = true;
            if (startDate) {
                matchesDate = matchesDate && new Date(o.order_date) >= new Date(startDate);
            }
            if (endDate) {
                const eDate = new Date(endDate);
                eDate.setHours(23, 59, 59, 999);
                matchesDate = matchesDate && new Date(o.order_date) <= eDate;
            }

            return matchesSearch && matchesDelivery && matchesPayment && matchesDistributor && matchesAgent && matchesDate;
        });

        return filtered.sort((a, b) => {
            let comparison = 0;
            if (orderBy === "customer_name") {
                comparison = (a.customer_name || "").localeCompare(b.customer_name || "");
            } else if (orderBy === "total") {
                comparison = Number(a.total) - Number(b.total);
            } else if (orderBy === "order_date") {
                comparison = new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
            }

            return order === "asc" ? comparison : -comparison;
        });
    }, [orders, search, deliveryFilter, paymentFilter, distributorFilter, startDate, endDate, orderBy, order]);

    const paginatedOrders = React.useMemo(() => {
        return sortedAndFilteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [sortedAndFilteredOrders, page, rowsPerPage]);

    const handleRequestSort = (property: typeof orderBy) => {
        const isAsc = orderBy === property && order === "asc";
        setOrder(isAsc ? "desc" : "asc");
        setOrderBy(property);
    };

    const handleClearFilters = () => {
        setSearch("");
        setDeliveryFilter("all");
        setPaymentFilter("all");
        setDistributorFilter("all");
        setStartDate("");
        setEndDate("");
        setOrder("desc");
        setOrderBy("order_date");
    };

    const getDeliveryLabel = (status: string) => {
        const labels: Record<string, string> = {
            delivered: "Delivered",
            rejected: "Rejected",
        };
        return labels[status.toLowerCase()] || status;
    };

    const getDeliveryColor = (status: string) => {
        switch (status.toLowerCase()) {
            case "delivered":
                return "success";
            case "rejected":
                return "error";
            default:
                return "default";
        }
    };

    const getPaymentLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: "Pending",
            invoice: "Invoiced",
            unpaid: "Unpaid",
            partially_paid: "Partially Paid",
            paid: "Paid",
            overdue: "Overdue",
        };
        return labels[status.toLowerCase()] || status;
    };

    const getPaymentColor = (status: string) => {
        switch (status.toLowerCase()) {
            case "paid":
                return "success";
            case "unpaid":
            case "overdue":
                return "error";
            case "partially_paid":
            case "invoice":
                return "warning";
            default:
                return "default";
        }
    };

    const kpis = {
        totalDelivered: orders.filter(o => o.fulfillment_status === 'delivered').length,
        totalRejected: orders.filter(o => o.fulfillment_status === 'rejected').length,
        totalHistoryValue: orders.reduce((sum, o) => sum + Number(o.total), 0),
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                {/* HEADER */}
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    justifyContent="space-between"
                    alignItems="center"
                    mb={4}
                >
                    <Box>
                        <Typography
                            variant="h4"
                            fontWeight={800}
                            sx={{ letterSpacing: "-0.02em" }}
                        >
                            Order History
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            View your completed and reconciled orders.
                        </Typography>
                    </Box>
                </Stack>

                {/* KPI CARDS */}
                <Grid container spacing={3} mb={4}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: alpha(theme.palette.success.main, 0.05),
                                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                            }}
                        >
                            <Typography
                                variant="caption"
                                fontWeight={700}
                                color="success.main"
                            >
                                TOTAL DELIVERED
                            </Typography>
                            <Typography variant="h4" fontWeight={800} mt={1}>
                                {kpis.totalDelivered}
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={orders.length ? (kpis.totalDelivered / orders.length) * 100 : 0}
                                color="success"
                                sx={{ mt: 2, borderRadius: 2 }}
                            />
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: alpha(theme.palette.error.main, 0.05),
                                border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                            }}
                        >
                            <Typography variant="caption" fontWeight={700} color="error.main">
                                TOTAL REJECTED
                            </Typography>
                            <Typography variant="h4" fontWeight={800} mt={1}>
                                {kpis.totalRejected}
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={orders.length ? (kpis.totalRejected / orders.length) * 100 : 0}
                                color="error"
                                sx={{ mt: 2, borderRadius: 2 }}
                            />
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper
                            sx={{
                                p: 3,
                                bgcolor: alpha(theme.palette.primary.main, 0.05),
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            }}
                        >
                            <Typography
                                variant="caption"
                                fontWeight={700}
                                color="primary.main"
                            >
                                TOTAL HISTORY VALUE
                            </Typography>
                            <Typography variant="h4" fontWeight={800} mt={1}>
                                ₹{kpis.totalHistoryValue.toLocaleString()}
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={100}
                                color="primary"
                                sx={{ mt: 2, borderRadius: 2 }}
                            />
                        </Paper>
                    </Grid>
                </Grid>

                {/* ORDER LIST */}
                <Paper
                    elevation={0}
                    sx={{
                        overflow: "hidden",
                        boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                    }}
                >
                    <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.background.default, 0.3) }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, md: 2.5 }}>
                                <TextField
                                    fullWidth
                                    placeholder="Search History..."
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

                            {/* Role-based Distributor Filter */}
                            {["admin", "sales_manager"].includes(user?.role || "") && (
                                <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        label="Distributor"
                                        value={distributorFilter}
                                        onChange={(e) => setDistributorFilter(e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                                    >
                                        <MenuItem value="all">All</MenuItem>
                                        {distributors.map((d) => (
                                            <MenuItem key={d.id} value={d.full_name}>
                                                {d.full_name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                            )}

                            {/* Role-based Sales Agent Filter */}
                            {["admin", "sales_manager", "distributor"].includes(user?.role || "") && (
                                <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        label="Sales Agent"
                                        value={agentFilter}
                                        onChange={(e) => setAgentFilter(e.target.value)}
                                        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                                    >
                                        <MenuItem value="all">All Agents</MenuItem>
                                        {salesAgents.map((a) => (
                                            <MenuItem key={a.id} value={a.full_name}>
                                                {a.full_name}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                            )}

                            <Grid size={{ xs: 12, sm: 6, md: 1.2 }}>
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Delivery"
                                    value={deliveryFilter}
                                    onChange={(e) => setDeliveryFilter(e.target.value)}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="delivered">Delivered</MenuItem>
                                    <MenuItem value="rejected">Rejected</MenuItem>
                                </TextField>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 1.2 }}>
                                <TextField
                                    select
                                    fullWidth
                                    size="small"
                                    label="Payment"
                                    value={paymentFilter}
                                    onChange={(e) => setPaymentFilter(e.target.value)}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                                >
                                    <MenuItem value="all">All</MenuItem>
                                    <MenuItem value="unpaid">Unpaid</MenuItem>
                                    <MenuItem value="partially_paid">Partially Paid</MenuItem>
                                    <MenuItem value="paid">Paid</MenuItem>
                                    <MenuItem value="overdue">Overdue</MenuItem>
                                </TextField>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 1.4 }}>
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

                            <Grid size={{ xs: 12, sm: 6, md: 1.4 }}>
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

                            <Grid size="grow">
                                <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}>
                                    <Tooltip title="Clear Filters">
                                        <IconButton
                                            size="small"
                                            onClick={handleClearFilters}
                                            sx={{
                                                bgcolor: alpha(theme.palette.error.main, 0.05),
                                                color: theme.palette.error.main,
                                                '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
                                            }}
                                        >
                                            <FilterAltOffIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Box>

                    <TableContainer>
                        {loading ? (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography>Loading history...</Typography>
                                <LinearProgress sx={{ mt: 2 }} />
                            </Box>
                        ) : (
                            <>
                                <Table>
                                    <TableHead>
                                        <TableRow
                                            sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}
                                        >
                                            <TableCell sx={{ fontWeight: 700, pl: 4 }}>
                                                ORDER #
                                            </TableCell>
                                            {["admin", "sales_manager"].includes(user?.role || "") && (
                                                <TableCell sx={{ fontWeight: 700 }}>DISTRIBUTOR / AGENT</TableCell>
                                            )}
                                            <TableCell sx={{ fontWeight: 700 }}>
                                                <TableSortLabel
                                                    active={orderBy === "customer_name"}
                                                    direction={orderBy === "customer_name" ? order : "asc"}
                                                    onClick={() => handleRequestSort("customer_name")}
                                                >
                                                    CUSTOMER
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>
                                                <TableSortLabel
                                                    active={orderBy === "order_date"}
                                                    direction={orderBy === "order_date" ? order : "asc"}
                                                    onClick={() => handleRequestSort("order_date")}
                                                >
                                                    DATE
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>SUBTOTAL</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>TAX</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>DISCOUNT</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>ADVANCE</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>
                                                <TableSortLabel
                                                    active={orderBy === "total"}
                                                    direction={orderBy === "total" ? order : "asc"}
                                                    onClick={() => handleRequestSort("total")}
                                                >
                                                    TOTAL
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>DELIVERY</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>PAYMENT</TableCell>
                                            <TableCell
                                                sx={{ fontWeight: 700, textAlign: "right", pr: 4 }}
                                            >
                                                ACTIONS
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedOrders.map((order) => (
                                            <TableRow key={order.id} hover>
                                                <TableCell
                                                    sx={{ pl: 4, fontFamily: "monospace", fontWeight: 600 }}
                                                >
                                                    {order.order_number}
                                                </TableCell>
                                                {["admin", "sales_manager"].includes(user?.role || "") && (
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600} color="primary">
                                                            {order.distributor_name || "Unknown"}
                                                        </Typography>
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {order.customer_name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(order.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                </TableCell>
                                                <TableCell>₹{Number(order.subtotal).toLocaleString()}</TableCell>
                                                <TableCell>₹{Number(order.tax_amount).toLocaleString()}</TableCell>
                                                <TableCell sx={{ color: 'error.main' }}>
                                                    ₹{Number(order.discount_amount || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>
                                                    ₹{Number(order.advance_amount || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>
                                                    ₹{Number(order.total).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        icon={<LocalShippingIcon sx={{ fontSize: 14 }} />}
                                                        label={getDeliveryLabel(order.fulfillment_status)}
                                                        size="small"
                                                        color={getDeliveryColor(order.fulfillment_status) as any}
                                                        sx={{ fontWeight: 600 }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                                        <Chip
                                                            icon={<PaidIcon sx={{ fontSize: 14 }} />}
                                                            label={getPaymentLabel(order.payment_status)}
                                                            size="small"
                                                            variant="outlined"
                                                            color={getPaymentColor(order.payment_status) as any}
                                                            sx={{
                                                                fontWeight: 600,
                                                                border: "none",
                                                                bgcolor: alpha(
                                                                    theme.palette[
                                                                        getPaymentColor(order.payment_status) as
                                                                        | "success"
                                                                        | "error"
                                                                        | "warning"
                                                                    ]?.main || theme.palette.text.primary,
                                                                    0.1
                                                                ),
                                                            }}
                                                        />
                                                    </Stack>
                                                </TableCell>
                                                <TableCell align="right" sx={{ pr: 4 }}>
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        <Tooltip title="View Details">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleOpenDetails(order)}
                                                            >
                                                                <VisibilityIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {order.has_invoice && (
                                                            <Tooltip title="Download Invoice PDF">
                                                                <IconButton
                                                                    size="small"
                                                                    color="secondary"
                                                                    onClick={() => salesService.downloadInvoicePDF(order.invoice_id || 0)}
                                                                >
                                                                    <PictureAsPdfIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {sortedAndFilteredOrders.length === 0 && !loading && (
                                            <TableRow>
                                                <TableCell colSpan={["admin", "sales_manager"].includes(user?.role || "") ? 12 : 11} align="center" sx={{ py: 8 }}>
                                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                                        <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2, opacity: 0.5 }} />
                                                        <Typography variant="body1" color="text.secondary">
                                                            No order history found.
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                                <TablePagination
                                    rowsPerPageOptions={[5, 10, 25]}
                                    component="div"
                                    count={sortedAndFilteredOrders.length}
                                    rowsPerPage={rowsPerPage}
                                    page={page}
                                    onPageChange={(e, p) => setPage(p)}
                                    onRowsPerPageChange={(e) => {
                                        setRowsPerPage(parseInt(e.target.value, 10));
                                        setPage(0);
                                    }}
                                />
                            </>
                        )}
                    </TableContainer>
                </Paper>
            </motion.div>

            <OrderDetailModal
                open={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                order={selectedOrder}
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                <Alert
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: "100%" }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </>
    );
}

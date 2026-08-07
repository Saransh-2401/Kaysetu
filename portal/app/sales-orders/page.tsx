"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  TableSortLabel,
  TablePagination,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

// Icons
import { ShoppingCartIcon, SearchIcon, VisibilityIcon, LocalShippingIcon, PaidIcon, CheckCircleIcon, CancelIcon, CheckIcon, PostAddIcon, Inventory2Icon, ReceiptIcon, PictureAsPdfIcon, CurrencyExchangeIcon, FilterAltOffIcon, RefreshIcon, SwapHorizIcon, EditIcon } from "@/components/icons";

import { salesService, SalesOrder } from "@/lib/sales-service";
import { authService, UserProfile, SalesAgent, SalesManager } from "@/lib/auth-service";
import SalesInvoiceModal from "@/components/sales/SalesInvoiceModal";
import OrderApprovalModal from "@/components/sales/OrderApprovalModal";
import OrderDetailModal from "@/components/sales/OrderDetailModal";
import OrderEditModal from "@/components/sales/OrderEditModal";
import { formatDRFError } from "@/lib/utils";

interface Distributor {
  id: number;
  full_name: string;
  username: string;
  assigned_to?: number;
  assigned_agent?: number;
}

export default function SalesOrdersPage() {
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
  const [salesManagers, setSalesManagers] = useState<SalesManager[]>([]);
  const [agentFilter, setAgentFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersData, userData] = await Promise.all([
        salesService.getSalesOrders(),
        authService.getCurrentUser(),
      ]);
      setOrders(ordersData.results || []);
      setUser(userData);

      // Fetch distributors and agents if Admin, Sales Manager, or Distributor
      if (["admin", "sales_manager", "distributor"].includes(userData.role)) {
        try {
          const fetchPromises: Promise<any>[] = [
            authService.getAssignedDistributors(),
            authService.getAssignedSalesAgents()
          ];

          if (userData.role === 'admin') {
            fetchPromises.push(authService.getAssignedSalesManagers());
          }

          const [distData, agentsData, managersData] = await Promise.all(fetchPromises);

          setDistributors(distData || []);
          setSalesAgents(agentsData || []);
          if (managersData) {
            setSalesManagers(managersData);
          }
        } catch (e) {
          console.error("Failed to fetch distributors or agents", e);
        }
      }
    } catch (error) {
      console.error("Failed to fetch sales orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Deep-link: open an order's detail when arriving via ?order=<id>
  useEffect(() => {
    if (typeof window === "undefined") return;
    const oid = new URLSearchParams(window.location.search).get("order");
    if (!oid) return;
    let active = true;
    (async () => {
      try {
        const o = await salesService.getSalesOrder(Number(oid));
        if (active && o) { setSelectedOrder(o); setDetailModalOpen(true); }
      } catch { /* ignore — invalid or inaccessible id */ }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, deliveryFilter, paymentFilter, distributorFilter, agentFilter, managerFilter, startDate, endDate]);

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

      const matchesManager =
        managerFilter === "all" ||
        o.sales_manager_name === managerFilter ||
        o.sales_manager_name?.toLowerCase().includes(managerFilter.toLowerCase());

      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && new Date(o.order_date) >= new Date(startDate);
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(o.order_date) <= eDate;
      }

      return matchesSearch && matchesDelivery && matchesPayment && matchesDistributor && matchesAgent && matchesManager && matchesDate;
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
  }, [orders, search, deliveryFilter, paymentFilter, distributorFilter, agentFilter, managerFilter, startDate, endDate, orderBy, order]);

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
    setAgentFilter("all");
    setManagerFilter("all");
    setOrder("desc");
    setOrderBy("order_date");
  };

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Change Distributor state (Sales Manager only)
  const [changeDistOpen, setChangeDistOpen] = useState(false);
  const [changingDist, setChangingDist] = useState(false);
  const [distChangeOrder, setDistChangeOrder] = useState<SalesOrder | null>(null);
  const [selectedNewDistId, setSelectedNewDistId] = useState<string>("");

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

  const handleAction = async (id: number, action: string) => {
    try {
      setLoading(true);
      switch (action) {
        case "approve":
          const approveOrd = orders.find((o) => o.id === id);
          if (approveOrd) {
            setSelectedOrder(approveOrd);
            setApprovalModalOpen(true);
          }
          return;
        case "reject":
          await salesService.rejectSalesOrder(id);
          break;
        case "pack":
          await salesService.packSalesOrder(id);
          break;
        case "dispatch":
          await salesService.dispatchSalesOrder(id);
          break;
        case "deliver":
          await salesService.deliverSalesOrder(id);
          break;
        case "invoice":
          const ord = orders.find((o) => o.id === id);
          if (ord) {
            setSelectedOrder(ord);
            setInvoiceModalOpen(true);
          }
          return; // Modal handles the rest
        case "download_pdf":
          await salesService.downloadInvoicePDF(id);
          break;
        case "mark_paid":
          setSelectedOrder(orders.find((o) => o.id === id) || null);
          setPaymentRef("");
          setPaymentDialogOpen(true);
          return;
      }
      setSnackbar({
        open: true,
        message: `Order ${action}ed successfully`,
        severity: "success",
      });
      fetchData();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.message || `Failed to ${action} order`,
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedOrder || !paymentRef) return;
    try {
      setLoading(true);
      await salesService.markSalesOrderPaid(
        selectedOrder.id,
        paymentRef,
        selectedOrder.total
      );
      setSnackbar({
        open: true,
        message: "Payment marked successfully",
        severity: "success",
      });
      setPaymentDialogOpen(false);
      setPaymentRef("");
      fetchData();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: formatDRFError(error),
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeDistributor = async () => {
    if (!distChangeOrder || !selectedNewDistId) return;
    try {
      setChangingDist(true);
      await salesService.updateSalesOrder(distChangeOrder.id, { distributor: Number(selectedNewDistId) } as any);
      setSnackbar({ open: true, message: "Distributor updated successfully", severity: "success" });
      setChangeDistOpen(false);
      fetchData();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || "Failed to update distributor", severity: "error" });
    } finally {
      setChangingDist(false);
    }
  };

  const getDeliveryLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pending",
      processing: "Processing",
      order_confirmed: "Confirmed",
      packed: "Packed",
      shipped: "Shipped",
      in_transit: "In Transit",
      delivered: "Delivered",
      rejected: "Rejected",
    };
    return labels[status.toLowerCase()] || status;
  };

  const getDeliveryColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "success";
      case "shipped":
      case "in_transit":
        return "info";
      case "order_confirmed":
      case "packed":
      case "processing":
        return "warning";
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

  const getPaymentLabelWithOverdue = (row: any) => {
    let label = getPaymentLabel(row.payment_status);
    if (row.is_overdue) {
      label += " Overdue";
    }
    return label;
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
    pendingDelivery: orders.filter(o => o.fulfillment_status !== 'delivered' && o.fulfillment_status !== 'rejected').length,
    unpaidTotal: orders.reduce((sum, o) => o.payment_status !== 'paid' ? sum + Number(o.total) : sum, 0),
    completedToday: orders.filter(o => {
      const today = new Date().toISOString().split('T')[0];
      return o.fulfillment_status === 'delivered' && o.order_date === today;
    }).length,
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
              Sales Orders
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track orders from confirmation to delivery.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => { setPage(0); setSearch(''); setDeliveryFilter('all'); setPaymentFilter('all'); setDistributorFilter('all'); setAgentFilter('all'); setManagerFilter('all'); setStartDate(''); setEndDate(''); fetchData(); }}
              sx={{ borderRadius: '10px' }}
            >
              Refresh
            </Button>
          </Stack>
        </Stack>

        {/* KPI CARDS */}
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              sx={{
                p: 3,
                bgcolor: alpha(theme.palette.warning.main, 0.05),
                border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
              }}
            >
              <Typography
                variant="caption"
                fontWeight={700}
                color="warning.main"
              >
                PENDING DELIVERY
              </Typography>
              <Typography variant="h4" fontWeight={800} mt={1}>
                {kpis.pendingDelivery}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={orders.length ? (kpis.pendingDelivery / orders.length) * 100 : 0}
                color="warning"
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
                UNPAID ORDERS TOTAL
              </Typography>
              <Typography variant="h4" fontWeight={800} mt={1}>
                ₹{kpis.unpaidTotal.toLocaleString()}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={orders.length ? (orders.filter(o => o.payment_status !== 'paid').length / orders.length) * 100 : 0}
                color="error"
                sx={{ mt: 2, borderRadius: 2 }}
              />
            </Paper>
          </Grid>
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
                COMPLETED TODAY
              </Typography>
              <Typography variant="h4" fontWeight={800} mt={1}>
                {kpis.completedToday}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={100}
                color="success"
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
            <Grid container spacing={1.5} alignItems="center">
              <Grid size={{ xs: 12, md: 2.5 }}>
                <TextField
                  fullWidth
                  placeholder="Search Order..."
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
                <Grid size={{ xs: 12, sm: 6, md: 1.4 }}>
                  <TextField
                    data-testid="sales-orders-distributor-filter-select"
                    select
                    fullWidth
                    size="small"
                    label="Distributor"
                    value={distributorFilter}
                    onChange={(e) => setDistributorFilter(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: 'background.paper' } }}
                  >
                    <MenuItem value="all">All</MenuItem>
                    {distributors.length > 0 ? (
                      distributors.map((d) => (
                        <MenuItem key={d.id} value={d.full_name}>
                          {d.full_name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled value="">
                        No distributors found
                      </MenuItem>
                    )}
                  </TextField>
                </Grid>
              )}

              {/* Role-based Sales Agent/Manager Filter */}
              {["admin", "sales_manager", "distributor"].includes(user?.role || "") && (
                <Grid size={{ xs: 12, sm: 6, md: 1.4 }}>
                  {user?.role === "admin" ? (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Sales Manager"
                      value={managerFilter}
                      onChange={(e) => setManagerFilter(e.target.value)}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "background.paper" } }}
                    >
                      <MenuItem value="all">All Managers</MenuItem>
                      {salesManagers.map((m) => (
                        <MenuItem key={m.id} value={m.full_name}>
                          {m.full_name}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Sales Agent"
                      value={agentFilter}
                      onChange={(e) => setAgentFilter(e.target.value)}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "background.paper" } }}
                    >
                      <MenuItem value="all">All Agents</MenuItem>
                      {salesAgents.map((a) => (
                        <MenuItem key={a.id} value={a.full_name}>
                          {a.full_name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
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
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="order_confirmed">Confirmed</MenuItem>
                  <MenuItem value="packed">Packed</MenuItem>
                  <MenuItem value="in_transit">In Transit</MenuItem>
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
                      onClick={handleClearFilters}
                      sx={{
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 2.5,
                        width: 40,
                        height: 40,
                        bgcolor: 'background.paper',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.error.main, 0.05),
                          color: 'error.main',
                          borderColor: theme.palette.error.main,
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

          <TableContainer>
            {loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography>Loading orders...</Typography>
                <LinearProgress sx={{ mt: 2 }} />
              </Box>
            ) : (
              <>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}
                    >
                      <TableCell sx={{ pl: 4, fontWeight: 700 }}>
                        ORDER NO.
                      </TableCell>
                      {["admin", "sales_manager", "sales_agent"].includes(user?.role || "") && (
                        <>
                          <TableCell sx={{ fontWeight: 700 }}>DISTRIBUTOR</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>AGENT</TableCell>
                        </>
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
                        {["admin", "sales_manager", "sales_agent"].includes(user?.role || "") && (
                          <>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.distributor_name || '-'}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.assigned_agent_name || '-'}</Typography>
                            </TableCell>
                          </>
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
                            {order.is_overdue && (
                              <Chip
                                label="Overdue"
                                size="small"
                                variant="outlined"
                                color="error"
                                sx={{
                                  fontWeight: 600,
                                  border: "none",
                                  height: 20,
                                  bgcolor: alpha(theme.palette.error.main, 0.1),
                                }}
                              />
                            )}
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

                            {/* Edit Order: admin, sales_manager, distributor, sales_agent — only before confirmation */}
                            {["admin", "sales_manager", "distributor", "sales_agent"].includes(user?.role || "") &&
                              ["pending", "processing"].includes(order.fulfillment_status) && (
                                <Tooltip title="Edit Order">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => {
                                      setSelectedOrder(order);
                                      setEditModalOpen(true);
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                            {/* Change Distributor: Sales Manager/Admin only, before approval */}
                            {["sales_manager", "admin"].includes(user?.role || "") &&
                              order.fulfillment_status === "processing" && (
                                <Tooltip title="Change Distributor">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => {
                                      setDistChangeOrder(order);
                                      setSelectedNewDistId(order.distributor?.toString() || "");
                                      setChangeDistOpen(true);
                                    }}
                                  >
                                    <SwapHorizIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                            {/* Role-Based Actions */}
                            <>
                              {/* Approve/Reject: Manager, Admin, Distributor, Sales Agent */}
                              {["admin", "sales_manager", "distributor", "sales_agent"].includes(
                                user?.role || ""
                              ) &&
                                order.fulfillment_status === "processing" && (
                                  <>
                                    <Tooltip title="Approve Order">
                                      <IconButton
                                        size="small"
                                        color="success"
                                        onClick={() =>
                                          handleAction(order.id, "approve")
                                        }
                                      >
                                        <CheckCircleIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Reject Order">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() =>
                                          handleAction(order.id, "reject")
                                        }
                                      >
                                        <CancelIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}

                              {/* Generate Invoice (after approval) */}
                              {["admin", "sales_manager", "distributor", "sales_agent"].includes(
                                user?.role || ""
                              ) &&
                                !order.has_invoice &&
                                [
                                  "order_confirmed",
                                  "packed",
                                  "in_transit",
                                  "delivered",
                                ].includes(order.fulfillment_status) && (
                                  <Tooltip title="Generate Invoice">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() =>
                                        handleAction(order.id, "invoice")
                                      }
                                    >
                                      <ReceiptIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}

                              {order.has_invoice && (
                                <>
                                  <Tooltip title="Download Invoice PDF">
                                    <IconButton
                                      size="small"
                                      color="secondary"
                                      onClick={() =>
                                        handleAction(
                                          order.invoice_id || 0,
                                          "download_pdf"
                                        )
                                      }
                                    >
                                      <PictureAsPdfIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>

                                  {order.payment_status !== "paid" &&
                                    [
                                      "admin",
                                      "sales_manager",
                                      "distributor",
                                      "sales_agent",
                                    ].includes(user?.role || "") && (
                                      <Tooltip title="Mark as Paid">
                                        <IconButton
                                          size="small"
                                          color="warning"
                                          onClick={() =>
                                            handleAction(
                                              order.id,
                                              "mark_paid"
                                            )
                                          }
                                        >
                                          <CurrencyExchangeIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                </>
                              )}

                              {/* Pack: Admin, Warehouse, Distributor, Sales Agent */}
                              {["admin", "warehouse_manager", "distributor", "sales_agent"].includes(
                                user?.role || ""
                              ) &&
                                order.fulfillment_status === "order_confirmed" && (
                                  <Tooltip title="Pack Items">
                                    <IconButton
                                      size="small"
                                      color="warning"
                                      onClick={() =>
                                        handleAction(order.id, "pack")
                                      }
                                    >
                                      <Inventory2Icon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}

                              {/* Dispatch: Admin, Warehouse, Distributor, Sales Agent */}
                              {["admin", "warehouse_manager", "distributor", "sales_agent"].includes(
                                user?.role || ""
                              ) &&
                                order.fulfillment_status === "packed" && (
                                  <Tooltip title="Mark Dispatched">
                                    <IconButton
                                      size="small"
                                      color="info"
                                      onClick={() =>
                                        handleAction(order.id, "dispatch")
                                      }
                                    >
                                      <LocalShippingIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}

                              {/* Deliver: Admin, Warehouse, Distributor, Sales Agent */}
                              {["admin", "warehouse_manager", "distributor", "sales_agent"].includes(
                                user?.role || ""
                              ) &&
                                order.fulfillment_status === "in_transit" && (
                                  <Tooltip title="Mark Delivered">
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        handleAction(order.id, "deliver")
                                      }
                                      sx={{
                                        bgcolor: alpha(
                                          theme.palette.success.main,
                                          0.1
                                        ),
                                        color: "success.main",
                                        padding: "6px",
                                        borderRadius: "50%",
                                        "&:hover": {
                                          bgcolor: alpha(
                                            theme.palette.success.main,
                                            0.2
                                          ),
                                        },
                                      }}
                                    >
                                      <CheckIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                            </>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {paginatedOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={["admin", "sales_manager"].includes(user?.role || "") ? 13 : 11} align="center" sx={{ py: 8 }}>
                          <Box sx={{ textAlign: 'center', py: 4 }}>
                            <ShoppingCartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2, opacity: 0.5 }} />
                            <Typography variant="body1" color="text.secondary">
                              No orders found.
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
        </Paper >
      </motion.div >

      <SalesInvoiceModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        order={selectedOrder}
        onSuccess={fetchData}
      />

      <Dialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
      >
        <DialogTitle>Mark Order as Paid</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2} color="text.secondary">
            Please enter the payment reference/UTR number to mark order{" "}
            <strong>{selectedOrder?.order_number}</strong> as paid.
          </Typography>
          <TextField
            fullWidth
            label="Payment Reference"
            size="small"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePaymentSubmit}
            disabled={!paymentRef || loading}
          >
            Confirm Payment
          </Button>
        </DialogActions>
      </Dialog>

      <OrderApprovalModal
        open={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        order={selectedOrder}
        onSuccess={() => {
          setSnackbar({ open: true, message: "Order confirmed successfully", severity: "success" });
          fetchData();
        }}
      />

      <OrderDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        order={selectedOrder}
      />

      <OrderEditModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        order={selectedOrder}
        onSuccess={fetchData}
      />

      {/* Change Distributor Dialog */}
      <Dialog open={changeDistOpen} onClose={() => setChangeDistOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Distributor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Order <strong>{distChangeOrder?.order_number}</strong> — select a new distributor.
          </Typography>
          <TextField
            select
            fullWidth
            label="Distributor"
            size="small"
            value={selectedNewDistId}
            onChange={(e) => setSelectedNewDistId(e.target.value)}
          >
            {distributors.filter(d => 
              // Filter by the order's sales manager if available
              !distChangeOrder?.sales_manager_id || d.assigned_to === distChangeOrder.sales_manager_id
            ).length > 0 ? (
              distributors.filter(d => 
                !distChangeOrder?.sales_manager_id || d.assigned_to === distChangeOrder.sales_manager_id
              ).map((d) => (
                <MenuItem key={d.id} value={d.id.toString()}>
                  {d.full_name}
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled value="">
                No team distributors found
              </MenuItem>
            )}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setChangeDistOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleChangeDistributor}
            disabled={!selectedNewDistId || changingDist}
          >
            {changingDist ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

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

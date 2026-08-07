"use client";
import React, { useState, useEffect, Suspense } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Avatar,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Fab,
  useTheme,
  alpha,
  Divider,
  Grid,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  TableSortLabel,
  TablePagination,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { parseISO, format, isValid } from 'date-fns';
import { useRouter } from "next/navigation";
import { crmService, Customer } from "@/lib/crm-service";
import { authService, SalesAgent, Distributor } from "@/lib/auth-service";
import { apiClient } from "@/lib/api-client";
import { formatDate, formatDRFError } from "@/lib/utils";

// Icons
import { SearchIcon, AddIcon, FilterAltOffIcon, ViewListIcon, GridViewIcon, PhoneIcon, EmailIcon, LocationOnIcon, BusinessIcon, GroupIcon, AccountBalanceWalletIcon, VisibilityIcon, EditIcon, AssessmentIcon, AddPhotoAlternateIcon, HistoryIcon, StorefrontIcon, PersonAddIcon, EventNoteIcon } from "@/components/icons";


export default function CustomersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CustomersContent />
    </Suspense>
  );
}

interface CustomerDetailBundle {
  id: number;
  orders: { id: number; order_number: string; order_date: string | null; fulfillment_status: string; payment_status: string; total: number }[];
  order_count: number;
  total_order_amount: number;
  product_sales: { product: string; qty: number; amount: number }[];
  visits: { id: number; visit_date: string | null; status: string; is_baseline: boolean; images: { image_url: string; image_type: string }[] }[];
  distributor: { id: number; name: string } | null;
  distributor_stock_requests: { id: number; request_number: string; request_date: string | null; status: string; payment_status: string; total_amount: number }[];
}

function CustomersContent() {
  const theme = useTheme();
  const router = useRouter();
  const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

  // Export the loaded customer report (orders + product sales) as CSV.
  const downloadCustomerReport = () => {
    if (!selectedCustomer || !customerDetail) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const d = customerDetail;
    const rows: string[] = [
      `Customer Report,${esc(selectedCustomer.shop_name || selectedCustomer.customer_name)}`,
      `Code,${esc(selectedCustomer.customer_code)}`,
      `Phone,${esc(selectedCustomer.phone)}`,
      `Total Orders,${d.order_count ?? 0}`,
      `Total Order Value,${d.total_order_amount ?? 0}`,
      `Invoiced Revenue,${selectedCustomer.total_revenue ?? 0}`,
      '',
      'Orders', 'Order #,Date,Status,Total',
      ...(d.orders ?? []).map((o) => [esc(o.order_number), o.order_date, esc(o.fulfillment_status), o.total].join(',')),
      '',
      'Product-wise Sales', 'Product,Qty,Amount',
      ...(d.product_sales ?? []).map((p) => [esc(p.product), p.qty, p.amount].join(',')),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Customer_Report_${selectedCustomer.customer_code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Admin/SM: upload an additional venue image (appended to shop_images).
  const handleAddVenueImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedCustomer) return;
    setUploadingImage(true);
    try {
      const updated = await crmService.addCustomerShopImage(selectedCustomer.id, file, selectedCustomer.shop_images || []);
      setSelectedCustomer(updated);
      showToast("Venue image added", "success");
      fetchData();
    } catch {
      showToast("Failed to add image", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [distributorFilter, setDistributorFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderBy, setOrderBy] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [count, setCount] = useState(0);

  // Modals
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetailBundle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Customer>>({});

  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  const showToast = (message: string, severity: "success" | "error" | "info" | "warning" = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  // Handlers
  const handleViewOpen = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsViewOpen(true);
  };

  const handleEditOpen = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditFormData({ ...customer });
    setIsEditOpen(true);
  };

  const handleViewClose = () => {
    setIsViewOpen(false);
    setSelectedCustomer(null);
  };

  const handleEditClose = () => {
    setIsEditOpen(false);
    setSelectedCustomer(null);
    setEditFormData({});
  };

  // Load the rich detail bundle (orders, products, visits, stock requests) when the view modal opens
  useEffect(() => {
    if (!isViewOpen || !selectedCustomer) { setCustomerDetail(null); return; }
    let active = true;
    setDetailLoading(true);
    (async () => {
      try {
        const d = await crmService.getCustomerDetail(selectedCustomer.id);
        if (active) setCustomerDetail(d);
      } catch { if (active) setCustomerDetail(null); }
      finally { if (active) setDetailLoading(false); }
    })();
    return () => { active = false; };
  }, [isViewOpen, selectedCustomer]);

  // Deep-link: open a specific client when arriving via ?customer=<id>
  // (e.g. clicking a client under a distributor on the Distributors page).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cid = new URLSearchParams(window.location.search).get("customer");
    if (!cid) return;
    let active = true;
    (async () => {
      try {
        const c = await crmService.getCustomer(Number(cid));
        if (active && c) handleViewOpen(c as Customer);
      } catch { /* ignore — invalid or inaccessible id */ }
    })();
    return () => { active = false; };
  }, []);

  const handleSaveEdit = async () => {
    if (!selectedCustomer) return;

    // Validation
    const phoneRegex = /^[0-9]{10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const aadhaarRegex = /^[0-9]{12}$/;
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    const taxIdRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    if (!editFormData.customer_name) {
      showToast("Owner Name is required", "error");
      return;
    }
    if (!editFormData.phone) {
      showToast("Phone number is required", "error");
      return;
    }
    if (!phoneRegex.test(editFormData.phone)) {
      showToast("Invalid Phone Number format (10 digits required)", "error");
      return;
    }
    if (editFormData.email && !emailRegex.test(editFormData.email)) {
      showToast("Invalid Email format", "error");
      return;
    }
    if (editFormData.postal_code && !pincodeRegex.test(editFormData.postal_code)) {
      showToast("Invalid Pincode format (6 digits required)", "error");
      return;
    }
    if (editFormData.pan_number && !panRegex.test(editFormData.pan_number)) {
      showToast("Invalid PAN Number format", "error");
      return;
    }
    if (editFormData.tax_id && !taxIdRegex.test(editFormData.tax_id)) {
      showToast("Invalid Tax ID (GSTIN) format", "error");
      return;
    }
    if (editFormData.aadhaar_number && !aadhaarRegex.test(editFormData.aadhaar_number)) {
      showToast("Invalid Aadhaar Number format (12 digits required)", "error");
      return;
    }
    if ((isAdmin || isManager) && !editFormData.distributor) {
      showToast("Please select a Distributor", "error");
      return;
    }

    try {
      await crmService.updateCustomer(selectedCustomer.id, editFormData);
      showToast("Customer updated successfully", "success");
      handleEditClose();
      fetchData();
    } catch (error) {
      console.error("Failed to update customer", error);
      const errorMsg = formatDRFError(error);
      showToast(errorMsg, "error");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    // 1. Numeric Only Fields
    if (['phone', 'aadhaar_number', 'postal_code'].includes(name)) {
      newValue = value.replace(/[^0-9]/g, '');
    }

    // 2. Uppercase Fields
    if (['pan_number', 'tax_id'].includes(name)) {
      newValue = value.toUpperCase();
    }

    // 3. Max Length Enforcement
    const maxLengths: { [key: string]: number } = {
      phone: 10,
      aadhaar_number: 12,
      postal_code: 6,
      pan_number: 10,
      tax_id: 15,
    };

    if (maxLengths[name] && newValue.length > maxLengths[name]) {
      newValue = newValue.slice(0, maxLengths[name]);
    }

    setEditFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleSelectChange = (name: string, value: any) => {
    if (name === 'assigned_agent') {
      // Reset distributor when agent changes
      setEditFormData(prev => ({ ...prev, [name]: value, distributor: undefined }));
    } else {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== "all") params.status = statusFilter === "active" ? "Active" : "Archived";
      if (agentFilter !== "all") params.assigned_agent = agentFilter;
      if (distributorFilter !== "all") params.distributor = distributorFilter;
      if (managerFilter !== "all") params.manager = managerFilter;
      if (search) params.search = search;
      if (startDate) {
        params.created_at__gte = startDate;
        params.revenue_from = startDate;
      }
      if (endDate) {
        params.created_at__lte = endDate;
        params.revenue_to = endDate;
      }
      params.ordering = order === "desc" ? `-${orderBy}` : orderBy;
      params.page = page + 1;
      params.page_size = rowsPerPage;

      const response = await crmService.getCustomers(params);
      setCustomers(response.results || []);
      setCount(response.count || 0);
    } catch (error) {
      console.error("Failed to fetch customers", error);
      showToast("Failed to fetch customers", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const user = await authService.getCurrentUser();
      const adminRoles = ["admin", "superuser", "mdo"];
      setIsAdmin(adminRoles.includes(user.role));
      setIsManager(user.role === 'sales_manager');

      const agentResp = await authService.getAssignedSalesAgents();
      setAgents(Array.isArray(agentResp) ? agentResp : (agentResp as any).results || []);

      if (adminRoles.includes(user.role)) {
        try {
          const managerResp = await apiClient.get<any>('/auth/users/', { role: 'sales_manager' });
          setManagers((managerResp as any).results || []);
        } catch (err) {
          console.error("Error fetching managers", err);
        }
      }

      try {
        const distResp = await authService.getAssignedDistributors();
        setDistributors(distResp || []);
      } catch (err) {
        console.error("Error fetching distributors", err);
      }
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, agentFilter, distributorFilter, managerFilter, search, startDate, endDate]);


  useEffect(() => {
    fetchData();
  }, [statusFilter, agentFilter, distributorFilter, managerFilter, search, startDate, endDate, orderBy, order, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setAgentFilter("all");
    setDistributorFilter("all");
    setManagerFilter("all");
    setSearch("");
  };

  const hasActiveFilters =
    statusFilter !== "all" ||
    agentFilter !== "all" ||
    distributorFilter !== "all" ||
    managerFilter !== "all" ||
    search !== "" ||
    startDate !== "" ||
    endDate !== "";

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Customers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Managing client relationships and portfolio
            </Typography>
          </Box>

        </Stack>

        {/* Filters */}
        <Paper elevation={0} sx={{
          p: 2,
          mb: 3,
          borderRadius: 1,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(8px)'
        }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid size={{ xs: 12, md: 2.5 }}>
              <TextField
                fullWidth
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) } }}
              />
            </Grid>

            {/* Date Range Filters */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="From"
                  value={startDate ? parseISO(startDate) : null}
                  onChange={(date) => {
                    if (date && isValid(date)) setStartDate(format(date, 'yyyy-MM-dd'));
                    else setStartDate("");
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) } } } }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="To"
                  value={endDate ? parseISO(endDate) : null}
                  onChange={(date) => {
                    if (date && isValid(date)) setEndDate(format(date, 'yyyy-MM-dd'));
                    else setEndDate("");
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true, sx: { '& .MuiOutlinedInput-root': { borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) } } } }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {isManager && (
              <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Agent</InputLabel>
                  <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} label="Agent" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                    <MenuItem value="all">All Agents</MenuItem>
                    {agents.map(a => <MenuItem key={a.id} value={a.id}>{a.full_name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {isAdmin && (
              <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Manager</InputLabel>
                  <Select value={managerFilter} onChange={(e) => { setManagerFilter(e.target.value); setDistributorFilter("all"); }} label="Manager" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                    <MenuItem value="all">All Managers</MenuItem>
                    {managers.map(m => <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Distributor</InputLabel>
                <Select data-testid="customers-distributor-filter-select" value={distributorFilter} onChange={(e) => setDistributorFilter(e.target.value)} label="Distributor" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                  <MenuItem value="all">All Distributors</MenuItem>
                  {distributors
                    .filter(d => managerFilter === "all" || String(d.assigned_to) === String(managerFilter))
                    .map(d => <MenuItem key={d.id} value={d.id}>{d.full_name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, md: 'auto' }} sx={{ ml: 'auto' }}>
              <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                {hasActiveFilters && (
                  <IconButton onClick={clearFilters} size="small" sx={{ color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.1) }}>
                    <FilterAltOffIcon fontSize="small" />
                  </IconButton>
                )}
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, val) => val && setViewMode(val)}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.background.default, 0.4),
                    borderRadius: '30px',
                    p: 0.5,
                    '& .MuiToggleButton-root': { border: 'none', borderRadius: '25px !important', px: 2 }
                  }}
                >
                  <ToggleButton value="card"><GridViewIcon fontSize="small" /></ToggleButton>
                  <ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Stats Row */}
        <Grid container spacing={2} mb={3}>
          {[
            { label: "Total Customers", val: customers.length, icon: <GroupIcon />, color: theme.palette.primary.main },
            { label: "Active Customers", val: customers.filter(c => c.status === "Active").length, icon: <StorefrontIcon />, color: theme.palette.success.main },
            { label: "New Customers", val: customers.filter(c => new Date(c.created_at) > new Date(Date.now() - 7 * 86400000)).length, icon: <PersonAddIcon />, color: theme.palette.info.main },
          ].map((stat, i) => (
            <Grid size={{ xs: 12, sm: 4 }} key={i}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 1, border: `1px solid ${alpha(stat.color, 0.1)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>{stat.label.toUpperCase()}</Typography>
                  <Typography variant="h5" fontWeight={800} color={stat.color}>{stat.val}</Typography>
                </Box>
                <Avatar variant="rounded" sx={{ bgcolor: alpha(stat.color, 0.1), color: stat.color }}>{stat.icon}</Avatar>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Content */}
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}><CircularProgress /></Box>
        ) : customers.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 1, border: `1px dashed ${theme.palette.divider}` }}>
            <Typography variant="h6" color="text.secondary">No customers found matching your criteria</Typography>
          </Paper>
        ) : viewMode === "card" ? (
          <Grid container spacing={3}>
            {customers.map((customer) => (
              <Grid key={customer.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 1,
                    border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                    bgcolor: "background.paper",
                    position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                      boxShadow: `0 20px 40px -12px ${alpha(theme.palette.primary.main, 0.15)}`,
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                    },
                  }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main", fontWeight: 800, width: 44, height: 44 }}>
                        {customer.customer_name?.[0] || "C"}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="subtitle1" fontWeight={800} noWrap>{customer.shop_name || "Individual"}</Typography>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="caption" color="text.primary" fontWeight={600}>{customer.customer_name}</Typography>
                          <Typography variant="caption" color="text.disabled">|</Typography>
                          <Typography variant="caption" color="text.secondary">{customer.customer_code}</Typography>
                        </Stack>
                      </Box>
                      <Chip
                        label={customer.status === "Archived" ? "Archived" : "Active"}
                        size="small"
                        color={customer.status === "Active" ? "success" : "default"}
                        sx={{ fontWeight: 800, fontSize: '0.65rem' }}
                      />
                    </Stack>

                    <Divider sx={{ borderStyle: 'dashed' }} />

                    <Stack spacing={1.5}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">{customer.phone || "No phone"}</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary" noWrap>{customer.email || "No email"}</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <EventNoteIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">Joined: {formatDate(customer.created_at)}</Typography>
                      </Stack>
                    </Stack>

                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, overflowX: 'auto' }}>
            <Table sx={{ minWidth: 1200 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                  <TableCell sx={{ fontWeight: 800, minWidth: 150 }}>SHOP NAME</TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 120 }}>CLIENT NAME</TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 140 }}>CONTACT</TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 80 }}>ORDERS</TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 100 }}>REVENUE</TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 130 }}>ASSIGNED AGENT</TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 140 }}>DISTRIBUTOR</TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 110 }}>
                    <TableSortLabel
                      active={orderBy === "created_at"}
                      direction={orderBy === "created_at" ? order : "asc"}
                      onClick={() => handleRequestSort("created_at")}
                    >
                      CREATED
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 80 }}>STATUS</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, minWidth: 80 }}>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>{c.shop_name || "-"}</Typography>
                        <Typography variant="caption" color="text.disabled">{c.customer_code}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.customer_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{c.phone}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.email}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{c.total_orders || 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="success.main">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(c.total_revenue || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{c.assigned_agent_name || "Unassigned"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{c.distributor_name || "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{formatDate(c.created_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.status === "Active" ? "Active" : "Archived"}
                        size="small"
                        color={c.status === "Active" ? "success" : "default"}
                        sx={{ fontWeight: 800, fontSize: '0.65rem' }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', width: 80 }}>
                      <Stack direction="row" spacing={0} justifyContent="flex-end" flexWrap="nowrap">
                        <IconButton size="small" onClick={() => handleViewOpen(c)}><VisibilityIcon fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={() => handleEditOpen(c)}><EditIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <TablePagination
          component="div"
          count={count}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Box>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onClose={handleViewClose} maxWidth="md" fullWidth>
        {selectedCustomer && (
          <>
            <DialogTitle sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 48, height: 48 }}>
                    {selectedCustomer.shop_name ? selectedCustomer.shop_name.charAt(0).toUpperCase() : "C"}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{selectedCustomer.shop_name || "Unknown Shop"}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">{selectedCustomer.customer_code}</Typography>
                      <Chip label={selectedCustomer.status} size="small" color={selectedCustomer.status === 'Active' ? 'success' : 'default'} sx={{ height: 20, fontSize: '0.65rem' }} />
                    </Stack>
                  </Box>
                </Stack>
                <IconButton onClick={handleViewClose} size="small">×</IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 3 }}>
              <Grid container spacing={3}>

                {/* Contact & Basic Details */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessIcon fontSize="small" /> Basic Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Typography variant="caption" color="text.secondary">Shop Name</Typography>
                        <Typography variant="body2" fontWeight={600}>{selectedCustomer.shop_name || 'N/A'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Typography variant="caption" color="text.secondary">Owner Name</Typography>
                        <Typography variant="body2" fontWeight={600}>{selectedCustomer.customer_name}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Typography variant="caption" color="text.secondary">Phone/Mobile</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <PhoneIcon fontSize="inherit" color="action" />
                          <Typography variant="body2" fontWeight={600}>{selectedCustomer.phone}</Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Typography variant="caption" color="text.secondary">Email Address</Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <EmailIcon fontSize="inherit" color="action" />
                          <Typography variant="body2" fontWeight={600}>{selectedCustomer.email || 'N/A'}</Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Typography variant="caption" color="text.secondary">Tax ID / GSTIN</Typography>
                        <Typography variant="body2" fontWeight={600} fontFamily="monospace">{selectedCustomer.tax_id || 'N/A'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Typography variant="caption" color="text.secondary">PAN Number</Typography>
                        <Typography variant="body2" fontWeight={600} fontFamily="monospace">{selectedCustomer.pan_number || 'N/A'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                        <Typography variant="caption" color="text.secondary">Aadhaar Number</Typography>
                        <Typography variant="body2" fontWeight={600} fontFamily="monospace">{selectedCustomer.aadhaar_number || 'N/A'}</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* Location */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationOnIcon fontSize="small" /> Location
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary">Address</Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {[selectedCustomer.address_line1, selectedCustomer.address_line2].filter(Boolean).join(', ') || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="caption" color="text.secondary">City</Typography>
                        <Typography variant="body2" fontWeight={600}>{selectedCustomer.city || 'N/A'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="caption" color="text.secondary">State</Typography>
                        <Typography variant="body2" fontWeight={600}>{selectedCustomer.state || 'N/A'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="caption" color="text.secondary">Pincode</Typography>
                        <Typography variant="body2" fontWeight={600}>{selectedCustomer.postal_code || 'N/A'}</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* Assignments & Metrics */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonAddIcon fontSize="small" /> Assignments & Metrics
                    </Typography>
                    <Stack spacing={2}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary">Assigned Agent</Typography>
                          {selectedCustomer.assigned_agent ? (
                            <Typography variant="body2" fontWeight={600} onClick={() => router.push(`/users?user=${selectedCustomer.assigned_agent}`)}
                              sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}>
                              {selectedCustomer.assigned_agent_name || 'View agent'}
                            </Typography>
                          ) : (
                            <Typography variant="body2" fontWeight={600}>Unassigned</Typography>
                          )}
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary">Distributor</Typography>
                          {selectedCustomer.distributor ? (
                            <Typography variant="body2" fontWeight={600} onClick={() => router.push(`/distributors?distributor=${selectedCustomer.distributor}`)}
                              sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}>
                              {selectedCustomer.distributor_name || 'View distributor'}
                            </Typography>
                          ) : (
                            <Typography variant="body2" fontWeight={600}>Unassigned</Typography>
                          )}
                        </Grid>
                      </Grid>
                      <Divider />
                      <Stack direction="row" spacing={3} justifyContent="space-around">
                        <Box textAlign="center">
                          <Typography variant="h6" color="primary.main" fontWeight={700}>{selectedCustomer.total_orders || 0}</Typography>
                          <Typography variant="caption" color="text.secondary">Total Orders</Typography>
                        </Box>
                        <Box textAlign="center">
                          <Typography variant="h6" color="success.main" fontWeight={700}>
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(selectedCustomer.total_revenue || 0)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">Lifetime Revenue</Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>

                {/* Documents */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StorefrontIcon fontSize="small" /> Documents & Gallery
                      </Typography>
                      {(isAdmin || isManager) && (
                        <Button component="label" size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon fontSize="small" />}
                          disabled={uploadingImage} sx={{ textTransform: 'none' }}>
                          {uploadingImage ? 'Uploading…' : 'Add Venue Image'}
                          <input hidden type="file" accept="image/*" onChange={handleAddVenueImage} />
                        </Button>
                      )}
                    </Stack>
                    <Grid container spacing={2}>
                      {[
                        { label: "Shop Image", src: selectedCustomer.shop_image },
                        { label: "Owner Image", src: selectedCustomer.owner_image },
                        { label: "GST Certificate", src: selectedCustomer.gst_certificate },
                        { label: "PAN Card", src: selectedCustomer.pan_card },
                        { label: "Aadhaar Front", src: selectedCustomer.aadhaar_front },
                        { label: "Aadhaar Back", src: selectedCustomer.aadhaar_back },
                      ].filter(item => item.src).length > 0 ? (
                        [
                          { label: "Shop Image", src: selectedCustomer.shop_image },
                          { label: "Owner Image", src: selectedCustomer.owner_image },
                          { label: "GST Certificate", src: selectedCustomer.gst_certificate },
                          { label: "PAN Card", src: selectedCustomer.pan_card },
                          { label: "Aadhaar Front", src: selectedCustomer.aadhaar_front },
                          { label: "Aadhaar Back", src: selectedCustomer.aadhaar_back },
                        ].map((item, index) => item.src ? (
                          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={index}>
                            {/* Thumbnail Card */}
                            <Paper
                              elevation={0}
                              sx={{
                                p: 1,
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                borderRadius: 2,
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                                  borderColor: alpha(theme.palette.primary.main, 0.3)
                                }
                              }}
                              onClick={() => item.src && window.open(item.src, '_blank')}
                            >
                              <Box
                                component="img"
                                src={item.src}
                                alt={item.label}
                                sx={{
                                  width: '100%',
                                  height: 80,
                                  objectFit: 'cover',
                                  borderRadius: 1,
                                  bgcolor: alpha(theme.palette.action.hover, 0.05),
                                  mb: 1,
                                  border: `1px solid ${alpha(theme.palette.divider, 0.05)}`
                                }}
                              />
                              <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" noWrap sx={{ fontSize: '0.7rem' }}>{item.label}</Typography>
                            </Paper>
                          </Grid>
                        ) : null)
                      ) : (
                        <Grid size={{ xs: 12 }}><Typography variant="body2" color="text.secondary" fontStyle="italic" align="center" sx={{ py: 2 }}>No documents uploaded.</Typography></Grid>
                      )}
                    </Grid>

                    {/* Additional shop/business images (multi) */}
                    {(selectedCustomer.shop_images?.length ?? 0) > 0 && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Shop / Business Images ({selectedCustomer.shop_images!.length})
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                          {selectedCustomer.shop_images!.map((src, i) => (
                            <Grid size={{ xs: 6, sm: 4, md: 2 }} key={i}>
                              <Box component="img" src={src} alt={`Shop ${i + 1}`} onClick={() => window.open(src, '_blank')}
                                sx={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 1, cursor: 'pointer', border: `1px solid ${alpha(theme.palette.divider, 0.2)}` }} />
                            </Grid>
                          ))}
                        </Grid>
                      </>
                    )}
                  </Paper>
                </Grid>

                {/* Visit Image Validation */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StorefrontIcon fontSize="small" /> Visit Images — Validation
                    </Typography>
                    {detailLoading ? (
                      <Typography variant="body2" color="text.secondary">Loading visits…</Typography>
                    ) : !customerDetail || customerDetail.visits.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">No visit images captured yet.</Typography>
                    ) : (
                      <Stack spacing={1.5}>
                        {customerDetail.visits.map((v) => (
                          <Box key={v.id} sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.action.hover, 0.04), border: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
                            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                              <Typography variant="caption" fontWeight={700}>{formatDate(v.visit_date)}</Typography>
                              {v.is_baseline && <Chip label="Baseline (first visit)" size="small" color="primary" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />}
                              <Chip label={v.status} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                            </Stack>
                            {v.images.length === 0 ? (
                              <Typography variant="caption" color="text.disabled">No images for this visit.</Typography>
                            ) : (
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {v.images.map((img, j) => (
                                  <Box key={j} component="img" src={img.image_url} alt={img.image_type} onClick={() => window.open(img.image_url, '_blank')}
                                    sx={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 1, cursor: 'pointer', border: `2px solid ${v.is_baseline ? theme.palette.primary.main : alpha(theme.palette.divider, 0.2)}` }} />
                                ))}
                              </Stack>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Paper>
                </Grid>

                {/* Customer Report — Orders, Products, Stock Requests */}
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessIcon fontSize="small" /> Customer Report
                    </Typography>
                    {detailLoading ? (
                      <Typography variant="body2" color="text.secondary">Loading report…</Typography>
                    ) : (
                      <Grid container spacing={2}>
                        {/* KPI strip */}
                        <Grid size={{ xs: 12 }}>
                          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                            <Box textAlign="center" sx={{ minWidth: 110 }}>
                              <Typography variant="h6" fontWeight={800} color="primary.main">{customerDetail?.order_count ?? 0}</Typography>
                              <Typography variant="caption" color="text.secondary">Orders</Typography>
                            </Box>
                            <Box textAlign="center" sx={{ minWidth: 130 }}>
                              <Typography variant="h6" fontWeight={800} color="success.main">{inr(customerDetail?.total_order_amount ?? 0)}</Typography>
                              <Typography variant="caption" color="text.secondary">Total Order Value</Typography>
                            </Box>
                            <Box textAlign="center" sx={{ minWidth: 130 }}>
                              <Typography variant="h6" fontWeight={800}>{inr(selectedCustomer.total_revenue || 0)}</Typography>
                              <Typography variant="caption" color="text.secondary">Invoiced Revenue</Typography>
                            </Box>
                            <Box textAlign="center" sx={{ minWidth: 90 }}>
                              <Typography variant="h6" fontWeight={800}>{customerDetail?.visits?.length ?? 0}</Typography>
                              <Typography variant="caption" color="text.secondary">Visits</Typography>
                            </Box>
                          </Stack>
                        </Grid>

                        {/* Orders (clickable) */}
                        <Grid size={{ xs: 12, md: 7 }}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase' }}>Orders</Typography>
                          <TableContainer sx={{ maxHeight: 260, mt: 0.5, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, borderRadius: 1 }}>
                            <Table size="small" stickyHeader>
                              <TableHead><TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Order #</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                              </TableRow></TableHead>
                              <TableBody>
                                {!customerDetail || customerDetail.orders.length === 0 ? (
                                  <TableRow><TableCell colSpan={4} align="center" sx={{ py: 2 }}><Typography variant="caption" color="text.secondary">No orders</Typography></TableCell></TableRow>
                                ) : customerDetail.orders.map((o) => (
                                  <TableRow key={o.id} hover onClick={() => router.push(`/sales-orders?order=${o.id}`)} sx={{ cursor: 'pointer' }}>
                                    <TableCell><Typography variant="caption" fontWeight={700} color="primary.main">{o.order_number}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{formatDate(o.order_date)}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{o.fulfillment_status}</Typography></TableCell>
                                    <TableCell align="right"><Typography variant="caption" fontWeight={600}>{inr(o.total)}</Typography></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>

                        {/* Product-wise sales */}
                        <Grid size={{ xs: 12, md: 5 }}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase' }}>Product-wise Sales</Typography>
                          <TableContainer sx={{ maxHeight: 260, mt: 0.5, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, borderRadius: 1 }}>
                            <Table size="small" stickyHeader>
                              <TableHead><TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                              </TableRow></TableHead>
                              <TableBody>
                                {!customerDetail || customerDetail.product_sales.length === 0 ? (
                                  <TableRow><TableCell colSpan={3} align="center" sx={{ py: 2 }}><Typography variant="caption" color="text.secondary">No sales</Typography></TableCell></TableRow>
                                ) : customerDetail.product_sales.map((p, i) => (
                                  <TableRow key={i} hover>
                                    <TableCell><Typography variant="caption" fontWeight={600}>{p.product}</Typography></TableCell>
                                    <TableCell align="right"><Typography variant="caption">{p.qty}</Typography></TableCell>
                                    <TableCell align="right"><Typography variant="caption" fontWeight={600}>{inr(p.amount)}</Typography></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>

                        {/* Distributor Stock Requests */}
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                            Distributor Stock Requests {customerDetail?.distributor ? `— ${customerDetail.distributor.name}` : ''}
                          </Typography>
                          <TableContainer sx={{ maxHeight: 220, mt: 0.5, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, borderRadius: 1 }}>
                            <Table size="small" stickyHeader>
                              <TableHead><TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Request #</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                              </TableRow></TableHead>
                              <TableBody>
                                {!customerDetail || customerDetail.distributor_stock_requests.length === 0 ? (
                                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 2 }}><Typography variant="caption" color="text.secondary">No stock requests</Typography></TableCell></TableRow>
                                ) : customerDetail.distributor_stock_requests.map((sr) => (
                                  <TableRow key={sr.id} hover>
                                    <TableCell><Typography variant="caption" fontWeight={700}>{sr.request_number}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{formatDate(sr.request_date)}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{sr.status}</Typography></TableCell>
                                    <TableCell><Typography variant="caption">{sr.payment_status}</Typography></TableCell>
                                    <TableCell align="right"><Typography variant="caption" fontWeight={600}>{inr(sr.total_amount)}</Typography></TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Grid>
                      </Grid>
                    )}
                  </Paper>
                </Grid>

                {/* Footer Meta */}
                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Created by: <strong>{selectedCustomer.created_by}</strong> on {formatDate(selectedCustomer.created_at)}
                    </Typography>
                  </Stack>
                </Grid>

              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: alpha(theme.palette.background.default, 0.5) }}>
              <Button onClick={handleViewClose} color="inherit">Close</Button>
              <Button onClick={downloadCustomerReport} disabled={!customerDetail || detailLoading} startIcon={<AssessmentIcon />}>Report</Button>
              <Button variant="contained" startIcon={<EditIcon />} onClick={() => { handleViewClose(); handleEditOpen(selectedCustomer); }}>Edit Customer</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onClose={handleEditClose} maxWidth="md" fullWidth>
        <DialogTitle>Edit Customer</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Shop Name" name="shop_name" value={editFormData.shop_name || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Owner Name" name="customer_name" value={editFormData.customer_name || ''} onChange={handleInputChange} fullWidth size="small" required />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Phone" name="phone" value={editFormData.phone || ''} onChange={handleInputChange} fullWidth size="small" required />
              <TextField label="Email" name="email" value={editFormData.email || ''} onChange={handleInputChange} fullWidth size="small" />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Tax ID" name="tax_id" value={editFormData.tax_id || ''} onChange={handleInputChange} fullWidth size="small" />
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select name="status" value={editFormData.status || 'Active'} label="Status" onChange={(e) => handleSelectChange('status', e.target.value)}>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="PAN Number" name="pan_number" value={editFormData.pan_number || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Aadhaar Number" name="aadhaar_number" value={editFormData.aadhaar_number || ''} onChange={handleInputChange} fullWidth size="small" />
            </Stack>

            <Divider><Typography variant="caption" color="text.secondary">ADDRESS</Typography></Divider>
            <TextField label="Address Line 1" name="address_line1" value={editFormData.address_line1 || ''} onChange={handleInputChange} fullWidth size="small" />
            <TextField label="Address Line 2" name="address_line2" value={editFormData.address_line2 || ''} onChange={handleInputChange} fullWidth size="small" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="City" name="city" value={editFormData.city || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="State" name="state" value={editFormData.state || ''} onChange={handleInputChange} fullWidth size="small" />
              <TextField label="Pincode" name="postal_code" value={editFormData.postal_code || ''} onChange={handleInputChange} fullWidth size="small" />
            </Stack>

            <Divider><Typography variant="caption" color="text.secondary">ASSIGNMENTS</Typography></Divider>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Assigned Agent</InputLabel>
                <Select
                  name="assigned_agent"
                  value={editFormData.assigned_agent || ''}
                  label="Assigned Agent"
                  onChange={(e) => handleSelectChange('assigned_agent', e.target.value)}
                >
                  {agents.map(agent => (
                    <MenuItem key={agent.id} value={agent.id}>{agent.full_name || agent.username}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Distributor — filtered by selected agent */}
              {(isAdmin || isManager) && (
                <FormControl fullWidth size="small">
                  <InputLabel>Distributor</InputLabel>
                  <Select
                    data-testid="customer-edit-distributor-select"
                    name="distributor"
                    value={editFormData.distributor || ''}
                    label="Distributor"
                    onChange={(e) => handleSelectChange('distributor', e.target.value)}
                    disabled={!editFormData.assigned_agent}
                  >
                    {(() => {
                      const filtered = distributors.filter(d =>
                        !editFormData.assigned_agent || String(d.assigned_agent) === String(editFormData.assigned_agent)
                      );
                      if (filtered.length === 0) {
                        return (
                          <MenuItem disabled value="">
                            No distributors assigned to this agent
                          </MenuItem>
                        );
                      }
                      return filtered.map(d => (
                        <MenuItem key={d.id} value={d.id}>{d.full_name || d.username}</MenuItem>
                      ));
                    })()}
                  </Select>
                </FormControl>
              )}
            </Stack>

          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </>
  );
}

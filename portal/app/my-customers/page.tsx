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
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { parseISO, format, isValid } from 'date-fns';
import { useRouter } from "next/navigation";
import { crmService, Customer } from "@/lib/crm-service";
import { authService, SalesAgent } from "@/lib/auth-service";
import { apiClient } from "@/lib/api-client";
import { formatDate, formatDRFError } from "@/lib/utils";

// Icons
import { SearchIcon, AddIcon, FilterAltOffIcon, ViewListIcon, GridViewIcon, PhoneIcon, EmailIcon, LocationOnIcon, BusinessIcon, GroupIcon, AccountBalanceWalletIcon, VisibilityIcon, StorefrontIcon, PersonAddIcon, EventNoteIcon } from "@/components/icons";

export default function MyCustomersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CustomersContent />
    </Suspense>
  );
}

function CustomersContent() {
  const theme = useTheme();
  const router = useRouter();

  // State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderBy, setOrderBy] = useState("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

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
      if (search) params.search = search;
      if (startDate) params.created_at__gte = startDate;
      if (endDate) params.created_at__lte = endDate;
      params.ordering = order === "desc" ? `-${orderBy}` : orderBy;

      const response = await crmService.getCustomers(params);
      setCustomers(response.results || []);
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
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Deep-link: open a specific client when arriving via ?customer=<id>
  // (e.g. an agent clicking a client under a distributor on the Distributors page).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cid = new URLSearchParams(window.location.search).get("customer");
    if (!cid) return;
    let active = true;
    (async () => {
      try {
        const c = await crmService.getCustomer(Number(cid));
        if (active && c) setDetailCustomer(c as Customer);
      } catch { /* ignore — invalid or inaccessible id */ }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    fetchData();
  }, [statusFilter, search, startDate, endDate, orderBy, order]);

  const clearFilters = () => {
    setStatusFilter("all");
    setSearch("");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters =
    statusFilter !== "all" ||
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
              My Customers
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Managing your assigned client portfolio
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{
              borderRadius: 1,
              textTransform: 'none',
              fontWeight: 700,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.2)}`
            }}
          >
            Add New Client
          </Button>
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

            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Archived</MenuItem>
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
            { label: "My Portfolio", val: customers.length, icon: <GroupIcon />, color: theme.palette.primary.main },
            { label: "Active Connections", val: customers.filter(c => c.status === "Active").length, icon: <StorefrontIcon />, color: theme.palette.success.main },
            { label: "High Credit Limit", val: customers.filter(c => c.credit_limit > 50000).length, icon: <AccountBalanceWalletIcon />, color: theme.palette.warning.main },
          ].map((stat, i) => (
            <Grid size={{ xs: 12, sm: 4 }} key={i}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 1, border: `1px solid ${alpha(stat.color, 0.1)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <Typography variant="h6" color="text.secondary">You haven't added or been assigned any customers yet.</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 2, borderRadius: 2 }}>Add Your First Client</Button>
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
                      <Stack direction="row" spacing={1} alignItems="center">
                        <IconButton size="small" color="primary" title="View Profile" onClick={() => setDetailCustomer(customer)} data-testid={`my-customer-view-btn-${customer.id}`}><VisibilityIcon sx={{ fontSize: 18 }} /></IconButton>
                        <Chip
                          label={customer.status === "Archived" ? "Archived" : "Active"}
                          size="small"
                          color={customer.status === "Active" ? "success" : "default"}
                          sx={{ fontWeight: 800, fontSize: '0.65rem' }}
                        />
                      </Stack>
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
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                  <TableCell sx={{ fontWeight: 800 }}>SHOP NAME</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>CLIENT NAME</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>CONTACT</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>TOTAL ORDERS</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>TOTAL REVENUE</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>
                    <TableSortLabel
                      active={orderBy === "created_at"}
                      direction={orderBy === "created_at" ? order : "asc"}
                      onClick={() => handleRequestSort("created_at")}
                    >
                      JOINED
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>STATUS</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>ACTIONS</TableCell>
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
                    <TableCell align="right">
                      <IconButton size="small" title="View" onClick={() => setDetailCustomer(c)} data-testid={`my-customer-row-view-btn-${c.id}`}><VisibilityIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Client profile (read-only) */}
      <Dialog open={!!detailCustomer} onClose={() => setDetailCustomer(null)} maxWidth="sm" fullWidth>
        {detailCustomer && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main", fontWeight: 800 }}>
                  {(detailCustomer.shop_name || detailCustomer.customer_name)?.[0]?.toUpperCase() || "C"}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={800}>{detailCustomer.shop_name || detailCustomer.customer_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{detailCustomer.customer_code}</Typography>
                </Box>
                <Box flex={1} />
                <Chip label={detailCustomer.status} size="small" color={detailCustomer.status === "Active" ? "success" : "default"} sx={{ fontWeight: 700 }} />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1.5}>
                {[
                  ["Owner", detailCustomer.customer_name],
                  ["Phone", detailCustomer.phone],
                  ["Email", detailCustomer.email || "—"],
                  ["Address", [detailCustomer.address_line1, detailCustomer.address_line2, detailCustomer.city, detailCustomer.state, detailCustomer.postal_code].filter(Boolean).join(", ") || "—"],
                  ["Distributor", detailCustomer.distributor_name || "—"],
                  ["Assigned Agent", detailCustomer.assigned_agent_name || "—"],
                  ["Total Orders", String(detailCustomer.total_orders ?? 0)],
                ].map(([label, value]) => (
                  <Stack key={label} direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ textAlign: "right" }}>{value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailCustomer(null)}>Close</Button>
            </DialogActions>
          </>
        )}
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

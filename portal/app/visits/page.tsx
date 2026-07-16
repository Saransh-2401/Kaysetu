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
  useMediaQuery,
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
  TableSortLabel,
  TablePagination,
} from "@mui/material";
import { keyframes } from "@emotion/react";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { parseISO, format, isValid, isAfter, startOfDay } from 'date-fns';
import { useRouter } from "next/navigation";
import { fieldSalesService, Visit } from "@/lib/field-sales-service";
import { authService, SalesAgent } from "@/lib/auth-service";
import { crmService, Customer, Lead } from "@/lib/crm-service";
import { formatDate, formatDateTime, formatDRFError } from "@/lib/utils";

// Icons
import { SearchIcon, AddIcon, FilterListIcon, PersonIcon, CloseIcon, LocationOnIcon, ViewListIcon, GridViewIcon, FilterAltOffIcon, EventNoteIcon, TimerIcon, StorefrontIcon, CheckCircleIcon, PendingIcon, CancelIcon, VisibilityIcon, PlayArrowIcon, GraphicEqIcon, MicIcon, AssignmentIcon, NotesIcon, AccessTimeIcon, KeyboardArrowRightIcon } from "@/components/icons";

const STATUS_OPTIONS = ["scheduled", "delayed", "missed", "in_progress", "completed", "skipped", "rescheduled"];
const VISIT_PURPOSES = [
  "Order Collection",
  "Payment Collection",
  "General Visit",
  "Complaint Resolution",
  "Product Demo",
  "New Product Launch",
  "Stock Check",
  "Relationship Building",
];

const pulse = keyframes`
  0% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
  100% { opacity: 0.3; transform: scale(1); }
`;

export default function VisitsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VisitsContent />
    </Suspense>
  );
}

function VisitsContent() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const router = useRouter();

  // State
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  useEffect(() => { if (isMobile) setViewMode('card'); }, [isMobile]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderBy, setOrderBy] = useState("visit_date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [count, setCount] = useState(0);

  const [newVisit, setNewVisit] = useState({
    entityType: "client",
    customerId: "",
    leadId: "",
    agentId: "",
    visitDate: new Date().toISOString().split("T")[0],
    scheduledTime: "",
    purpose: "",
    notes: "",
  });
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const showToast = (message: string, severity: "success" | "error" | "info" | "warning" = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const getVisitDisplayStatus = (visit: Visit) => {
    if (visit.status.toLowerCase() !== 'scheduled') return visit.status;

    const now = new Date();
    const visitDate = parseISO(visit.visit_date);
    const today = startOfDay(now);
    const scheduledDay = startOfDay(visitDate);

    // Missed: Day has passed and no check-in
    if (isAfter(today, scheduledDay)) {
      return 'missed';
    }

    // Delayed: Same day, scheduled time has passed, no check-in
    if (visit.scheduled_time && format(now, 'yyyy-MM-dd') === visit.visit_date) {
      const [hours, minutes] = visit.scheduled_time.split(':').map(Number);
      const scheduledDateTime = new Date(now);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      if (isAfter(now, scheduledDateTime)) {
        return 'delayed';
      }
    }

    return 'scheduled';
  };

  // Fetch visits
  const fetchVisits = async () => {
    try {
      setLoading(true);
      const params: any = {};

      // Handle virtual statuses that don't exist in the backend
      const virtualStatuses = ['delayed', 'missed'];
      const isVirtualFilter = virtualStatuses.includes(statusFilter);

      if (statusFilter !== "all") {
        params.status = isVirtualFilter ? 'scheduled' : statusFilter;
      }

      if (agentFilter !== "all") params.agent = agentFilter;
      if (managerFilter !== "all") params.manager = managerFilter;
      if (entityTypeFilter !== "all") params.entity_type = entityTypeFilter;
      if (search) params.search = search;


      // Custom date range
      if (startDate) params.visit_date__gte = startDate;
      if (endDate) params.visit_date__lte = endDate;

      // Sorting
      params.ordering = order === "desc" ? `-${orderBy}` : orderBy;
      params.page = page + 1;
      params.page_size = rowsPerPage;

      const response = await fieldSalesService.getVisits(params);
      let data = (response as any).results || (Array.isArray(response) ? response : []);
      setCount((response as any).count || 0);

      // Client-side filter for virtual statuses
      if (isVirtualFilter) {
        data = data.filter((v: Visit) => getVisitDisplayStatus(v) === statusFilter);
      }

      setVisits(data);
    } catch (error) {
      console.error("Failed to fetch visits", error);
      showToast("Failed to fetch visits", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, [statusFilter, agentFilter, managerFilter, entityTypeFilter, search, startDate, endDate, orderBy, order, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Fetch agents, managers and check role
  const fetchInitialData = async () => {
    try {
      const user = await authService.getCurrentUser();
      const adminRoles = ["admin", "superuser", "mdo"];
      const isUserAdmin = adminRoles.includes(user.role);
      const isUserManager = user.role === 'sales_manager';
      setIsAdmin(isUserAdmin);
      setIsManager(isUserManager);

      // Set default agent for direct agents
      if (!isUserAdmin && !isUserManager) {
        setNewVisit(prev => ({ ...prev, agentId: user.id.toString() }));
      }

      // Fetch agents
      const agentResp = await authService.getAssignedSalesAgents();
      setAgents((agentResp as any).results || (Array.isArray(agentResp) ? agentResp : []));

      // If admin, fetch managers
      if (isUserAdmin) {
        try {
          // Import dynamic? No, authService doesn't have it, use direct API call
          const { apiClient } = await import('@/lib/api-client');
          const managerResp = await apiClient.get<any>('/auth/users/', { role: 'sales_manager' });
          setManagers((managerResp as any).results || (Array.isArray(managerResp) ? managerResp : []));
        } catch (err) {
          console.error("Error fetching managers", err);
        }
      }

      // Fetch customers and leads for scheduling
      try {
        const [custResp, leadResp] = await Promise.all([
          crmService.getCustomers({ page_size: '1000' }), // Status filter applied client side to be safe
          crmService.getLeads({ page_size: '1000' })
        ]);

        // Filter: Only Active Customers
        const allCustomers = custResp.results || [];
        setCustomers(allCustomers.filter(c => c.status === 'Active'));

        // Filter: Only Non-Converted Leads
        const allLeads = leadResp.results || [];
        setLeads(allLeads.filter(l => l.status !== 'converted'));
      } catch (err) {
        console.error("Error fetching CRM data", err);
      }
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);


  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "success";
      case "in_progress":
        return "info";
      case "scheduled":
        return "warning";
      case "delayed":
        return "warning"; // Usually orange/warning
      case "missed":
      case "skipped":
      case "rescheduled":
        return "error";
      default:
        return "default";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <CheckCircleIcon sx={{ fontSize: 18 }} />;
      case "in_progress":
        return <PendingIcon sx={{ fontSize: 18 }} />;
      case "scheduled":
        return <EventNoteIcon sx={{ fontSize: 18 }} />;
      case "delayed":
        return <TimerIcon sx={{ fontSize: 18 }} />;
      case "missed":
        return <CancelIcon sx={{ fontSize: 18 }} />;
      default:
        return <CancelIcon sx={{ fontSize: 18 }} />;
    }
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setAgentFilter("all");
    setManagerFilter("all");
    setEntityTypeFilter("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
  };

  const hasActiveFilters =
    statusFilter !== "all" ||
    agentFilter !== "all" ||
    managerFilter !== "all" ||
    entityTypeFilter !== "all" ||
    startDate !== "" ||
    endDate !== "" ||
    search !== "";

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              All Visits
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and track all field visits
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowScheduleDialog(true)}
              sx={{ borderRadius: 1, textTransform: "none", fontWeight: 700 }}
            >
              Schedule Visit
            </Button>
          </Stack>
        </Stack>

        {/* Search & Filters */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)' }}>
          <Grid container spacing={1.5} alignItems="center">
            {/* Row 1/Main Row: Consolidated */}
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

            <Grid size={{ xs: 12, sm: 6, md: 1.4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                  <MenuItem value="all">All</MenuItem>
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 1.2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)} label="Type" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                  <MenuItem value="all">Any</MenuItem>
                  <MenuItem value="client">Client</MenuItem>
                  <MenuItem value="lead">Lead</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {isManager && (
              <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Agent</InputLabel>
                  <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} label="Agent" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                    <MenuItem value="all">All Agents</MenuItem>
                    {agents.map((agent) => (
                      <MenuItem key={agent.id} value={agent.id}>
                        {agent.full_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {isAdmin && (
              <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Manager</InputLabel>
                  <Select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} label="Manager" sx={{ borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) }}>
                    <MenuItem value="all">All</MenuItem>
                    {managers.map((manager) => (
                      <MenuItem key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid size={{ xs: 6, md: 1.4 }}>
              <TextField
                fullWidth
                label="From"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) } }}
              />
            </Grid>

            <Grid size={{ xs: 6, md: 1.4 }}>
              <TextField
                fullWidth
                label="To"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '30px', bgcolor: alpha(theme.palette.background.default, 0.4) } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: (isAdmin || isManager) ? 1.1 : 1.5 }} sx={{ ml: 'auto' }}>
              <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                {hasActiveFilters && (
                  <IconButton
                    size="small"
                    onClick={clearFilters}
                    sx={{
                      bgcolor: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                      border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                      borderRadius: '50%',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.error.main, 0.2),
                      }
                    }}
                    title="Clear Filters"
                  >
                    <FilterAltOffIcon fontSize="small" />
                  </IconButton>
                )}

                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(e, newMode) => newMode && setViewMode(newMode)}
                  size="small"
                  sx={{
                    bgcolor: alpha(theme.palette.background.default, 0.4),
                    borderRadius: '30px',
                    p: 0.5,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    '& .MuiToggleButton-root': {
                      border: 'none',
                      borderRadius: '25px !important',
                      px: 1.5,
                      '&.Mui-selected': {
                        bgcolor: 'background.paper',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        color: 'primary.main',
                        '&:hover': { bgcolor: 'background.paper' }
                      }
                    }
                  }}
                >
                  <ToggleButton value="card">
                    <GridViewIcon sx={{ fontSize: 18 }} />
                  </ToggleButton>
                  <ToggleButton value="list">
                    <ViewListIcon sx={{ fontSize: 18 }} />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <CircularProgress />
          </Box>
        ) : visits.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 8,
              textAlign: "center",
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <EventNoteIcon sx={{ fontSize: 64, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
            <Typography variant="h6" fontWeight={700} gutterBottom>
              No Visits Found
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              {hasActiveFilters ? "Try adjusting your filters" : "Schedule your first visit to get started"}
            </Typography>
            {hasActiveFilters && (
              <Button variant="outlined" startIcon={<FilterAltOffIcon />} onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </Paper>
        ) : viewMode === "card" ? (
          <Grid container spacing={3}>
            {visits.map((visit) => (
              <Grid key={visit.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 1,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    bgcolor: 'background.paper',
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    cursor: 'pointer',
                    position: 'relative',
                    "&:hover": {
                      transform: "translateY(-6px)",
                      boxShadow: `0 20px 40px -12px ${alpha(theme.palette.primary.main, 0.15)}`,
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                    },
                  }}
                >
                  <Stack spacing={2.5}>
                    {/* Header: Customer and Main Status */}
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={800} sx={{ fontSize: "1.15rem", color: 'text.primary', mb: 0.5, letterSpacing: '-0.01em' }}>
                          {visit.customer_name || visit.lead_name || "Unknown"}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar
                            sx={{
                              width: 22,
                              height: 22,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: "primary.main",
                              fontSize: "0.65rem",
                              fontWeight: 800,
                            }}
                          >
                            {visit.agent_name?.charAt(0) || "A"}
                          </Avatar>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {visit.agent_name || "Unknown Agent"}
                          </Typography>
                        </Stack>
                      </Box>
                      <Stack alignItems="flex-end" spacing={1}>
                        <Chip
                          label={getVisitDisplayStatus(visit)}
                          size="small"
                          color={getStatusColor(getVisitDisplayStatus(visit)) as any}
                          sx={{
                            fontWeight: 800,
                            textTransform: "uppercase",
                            fontSize: "0.6rem",
                            height: 22,
                            px: 0.5,
                            borderRadius: '6px'
                          }}
                        />
                        <Chip
                          label={visit.customer ? "Client" : "Lead"}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: "0.55rem",
                            height: 18,
                            fontWeight: 700,
                            borderColor: visit.customer ? 'primary.light' : 'warning.light',
                            color: visit.customer ? 'primary.main' : 'warning.main',
                            textTransform: "uppercase",
                            borderRadius: '4px'
                          }}
                        />
                      </Stack>
                    </Stack>

                    {/* Outcome / Result Section */}
                    {visit.outcome && (
                      <Box
                        sx={{
                          bgcolor: alpha(theme.palette.success.main, 0.04),
                          border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
                          borderRadius: 1,
                          px: 2,
                          py: 1,
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                          <Typography variant="caption" color="success.dark" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {visit.outcome}
                          </Typography>
                        </Stack>
                      </Box>
                    )}

                    {/* Precise Timing Row */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.05)}`,
                      }}
                    >
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ display: 'block', mb: 0.25, fontSize: '0.6rem' }}>SCHEDULED</Typography>
                        <Typography variant="body2" fontWeight={800} color="primary.main" sx={{ lineHeight: 1.2 }}>
                          {visit.scheduled_time?.substring(0, 5) || "--:--"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", fontWeight: 700, display: 'block' }}>
                          {formatDate(visit.visit_date)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ display: 'block', mb: 0.25, fontSize: '0.6rem' }}>CHECK-IN</Typography>
                        <Typography variant="body2" fontWeight={800} color={visit.actual_checkin_time ? "success.main" : "text.disabled"} sx={{ lineHeight: 1.2 }}>
                          {visit.actual_checkin_time ? formatDateTime(visit.actual_checkin_time).split(',')[1]?.trim() : "--:--"}
                        </Typography>
                        {visit.actual_checkin_time && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", fontWeight: 700, display: 'block' }}>
                            {formatDateTime(visit.actual_checkin_time).split(',')[0]?.trim()}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ display: 'block', mb: 0.25, fontSize: '0.6rem' }}>CHECK-OUT</Typography>
                        <Typography variant="body2" fontWeight={800} color={visit.actual_checkout_time ? "secondary.main" : "text.disabled"} sx={{ lineHeight: 1.2 }}>
                          {visit.actual_checkout_time ? formatDateTime(visit.actual_checkout_time).split(',')[1]?.trim() : "--:--"}
                        </Typography>
                        {visit.actual_checkout_time && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", fontWeight: 700, display: 'block' }}>
                            {formatDateTime(visit.actual_checkout_time).split(',')[0]?.trim()}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper elevation={0} sx={{ borderRadius: 1, overflow: "hidden", border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 800 }}>
                {/* Header */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 0.8fr 1.2fr 1fr 1fr 1.2fr 0.8fr 0.8fr 0.6fr",
                    gap: 2,
                    p: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  }}
                >
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    <TableSortLabel
                      active={orderBy === "customer__customer_name"}
                      direction={orderBy === "customer__customer_name" ? order : "asc"}
                      onClick={() => handleRequestSort("customer__customer_name")}
                      sx={{ '& .MuiTableSortLabel-icon': { fontSize: 14 } }}
                    >
                      CUSTOMER/LEAD
                    </TableSortLabel>
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    TYPE
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    <TableSortLabel
                      active={orderBy === "visit_date"}
                      direction={orderBy === "visit_date" ? order : "asc"}
                      onClick={() => handleRequestSort("visit_date")}
                      sx={{ '& .MuiTableSortLabel-icon': { fontSize: 14 } }}
                    >
                      DATE & TIME
                    </TableSortLabel>
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    <TableSortLabel
                      active={orderBy === "status"}
                      direction={orderBy === "status" ? order : "asc"}
                      onClick={() => handleRequestSort("status")}
                      sx={{ '& .MuiTableSortLabel-icon': { fontSize: 14 } }}
                    >
                      STATUS
                    </TableSortLabel>
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    OUTCOME
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    <TableSortLabel
                      active={orderBy === "agent__full_name"}
                      direction={orderBy === "agent__full_name" ? order : "asc"}
                      onClick={() => handleRequestSort("agent__full_name")}
                      sx={{ '& .MuiTableSortLabel-icon': { fontSize: 14 } }}
                    >
                      AGENT
                    </TableSortLabel>
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    CHECK-IN
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="text.secondary">
                    CHECK-OUT
                  </Typography>
                  <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ textAlign: 'center' }}>
                    ACTIONS
                  </Typography>
                </Box>

                {/* Rows */}
                {visits.map((visit, index) => (
                  <Box
                    key={visit.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 0.8fr 1.2fr 1fr 1fr 1.2fr 0.8fr 0.8fr 0.6fr",
                      gap: 2,
                      p: 2,
                      borderBottom: index < visits.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.1)}` : "none",
                      transition: "all 0.2s",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, 0.02),
                      },
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        {visit.customer_name || visit.lead_name || "Unknown"}
                      </Typography>
                    </Box>
                    <Box>
                      <Chip
                        label={visit.customer ? "Client" : "Lead"}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: "0.6rem",
                          height: 20,
                          fontWeight: 700,
                          borderColor: visit.customer ? 'primary.light' : 'warning.light',
                          color: visit.customer ? 'primary.main' : 'warning.main',
                          textTransform: "uppercase",
                          borderRadius: '4px'
                        }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {formatDate(visit.visit_date)}
                      </Typography>
                      <Typography variant="caption" color="info.main" fontWeight={600}>
                        {visit.scheduled_time?.substring(0, 5) || "N/A"}
                      </Typography>
                    </Box>
                    <Box>
                      <Chip
                        icon={getStatusIcon(getVisitDisplayStatus(visit))}
                        label={getVisitDisplayStatus(visit)}
                        size="small"
                        color={getStatusColor(getVisitDisplayStatus(visit)) as any}
                        sx={{ fontWeight: 700, textTransform: "capitalize", height: 22, fontSize: "0.65rem" }}
                      />
                    </Box>
                    <Box>
                      {visit.outcome ? (
                        <Chip
                          label={visit.outcome}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontWeight: 600,
                            height: 22,
                            fontSize: "0.65rem",
                            borderColor: "success.main",
                            color: "success.main",
                          }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar
                          sx={{
                            width: 24,
                            height: 24,
                            bgcolor: alpha(theme.palette.secondary.main, 0.1),
                            color: "secondary.main",
                            fontSize: "0.7rem",
                            fontWeight: 800,
                          }}
                        >
                          {visit.agent_name?.charAt(0) || "A"}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.85rem" }}>
                          {visit.agent_name || "Unknown"}
                        </Typography>
                      </Stack>
                    </Box>
                    <Box>
                      {visit.actual_checkin_time ? (
                        <>
                          <Typography variant="body2" fontWeight={600} color="success.main" sx={{ fontSize: "0.85rem", lineHeight: 1.2 }}>
                            {formatDateTime(visit.actual_checkin_time).split(',')[1]?.trim() || formatDateTime(visit.actual_checkin_time)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", fontWeight: 700, display: 'block' }}>
                            {formatDateTime(visit.actual_checkin_time).split(',')[0]?.trim()}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      {visit.actual_checkout_time ? (
                        <>
                          <Typography variant="body2" fontWeight={600} color="error.main" sx={{ fontSize: "0.85rem", lineHeight: 1.2 }}>
                            {formatDateTime(visit.actual_checkout_time).split(',')[1]?.trim() || formatDateTime(visit.actual_checkout_time)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", fontWeight: 700, display: 'block' }}>
                            {formatDateTime(visit.actual_checkout_time).split(',')[0]?.trim()}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          -
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedVisit(visit);
                          setShowDetailDialog(true);
                        }}
                        sx={{
                          width: 32,
                          height: 32,
                          color: 'primary.main',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                        }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Schedule Visit Dialog */}
      <Dialog
        open={showScheduleDialog}
        onClose={() => !submitting && setShowScheduleDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 1, p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.5rem' }}>Schedule New Visit</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Entity Type</InputLabel>
              <Select
                value={newVisit.entityType}
                label="Entity Type"
                onChange={(e) => setNewVisit({ ...newVisit, entityType: e.target.value, customerId: "", leadId: "" })}
              >
                <MenuItem value="client">Client (Existing Customer)</MenuItem>
                <MenuItem value="lead">Lead (Prospect)</MenuItem>
              </Select>
            </FormControl>

            {(isAdmin || isManager) && (
              <FormControl fullWidth>
                <InputLabel>Assign To Agent</InputLabel>
                <Select
                  value={newVisit.agentId}
                  label="Assign To Agent"
                  onChange={(e) => setNewVisit({ ...newVisit, agentId: e.target.value as string, customerId: "", leadId: "" })}
                >
                  {agents.map((a) => (
                    <MenuItem key={a.id} value={a.id}>{a.full_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {newVisit.entityType === "client" ? (
              <FormControl fullWidth disabled={!newVisit.agentId && (isAdmin || isManager)}>
                <InputLabel>Select Client</InputLabel>
                <Select
                  value={newVisit.customerId}
                  label="Select Client"
                  onChange={(e) => setNewVisit({ ...newVisit, customerId: e.target.value as string })}
                >
                  {customers
                    .filter(c => !newVisit.agentId || c.assigned_agent === Number(newVisit.agentId))
                    .map((c) => (
                      <MenuItem key={c.id} value={c.id}>{c.customer_name} ({c.customer_code})</MenuItem>
                    ))}
                  {customers.filter(c => !newVisit.agentId || c.assigned_agent === Number(newVisit.agentId)).length === 0 && (
                    <MenuItem disabled>No clients assigned to this agent</MenuItem>
                  )}
                </Select>
              </FormControl>
            ) : (
              <FormControl fullWidth disabled={!newVisit.agentId && (isAdmin || isManager)}>
                <InputLabel>Select Lead</InputLabel>
                <Select
                  value={newVisit.leadId}
                  label="Select Lead"
                  onChange={(e) => setNewVisit({ ...newVisit, leadId: e.target.value as string })}
                >
                  {leads
                    .filter(l => !newVisit.agentId || l.assigned_to === Number(newVisit.agentId))
                    .map((l) => (
                      <MenuItem key={l.id} value={l.id}>{l.name} - {l.company_name}</MenuItem>
                    ))}
                  {leads.filter(l => !newVisit.agentId || l.assigned_to === Number(newVisit.agentId)).length === 0 && (
                    <MenuItem disabled>No leads assigned to this agent</MenuItem>
                  )}
                </Select>
              </FormControl>
            )}

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Stack direction="row" spacing={2}>
                <DatePicker
                  label="Visit Date"
                  value={newVisit.visitDate ? parseISO(newVisit.visitDate) : null}
                  onChange={(date) => {
                    if (date && isValid(date)) {
                      setNewVisit({ ...newVisit, visitDate: format(date, 'yyyy-MM-dd') });
                    }
                  }}
                  minDate={new Date()}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: 1 } }
                    }
                  }}
                />
                <TimePicker
                  label="Scheduled Time"
                  value={newVisit.scheduledTime ? parseISO(`${newVisit.visitDate}T${newVisit.scheduledTime}`) : null}
                  onChange={(time) => {
                    if (time && isValid(time)) {
                      setNewVisit({ ...newVisit, scheduledTime: format(time, 'HH:mm') });
                    }
                  }}
                  minTime={
                    newVisit.visitDate === format(new Date(), 'yyyy-MM-dd')
                      ? new Date()
                      : undefined
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      sx: { '& .MuiOutlinedInput-root': { borderRadius: 1 } }
                    }
                  }}
                />
              </Stack>
            </LocalizationProvider>

            <FormControl fullWidth>
              <InputLabel>Visit Purpose</InputLabel>
              <Select
                value={newVisit.purpose}
                label="Visit Purpose"
                onChange={(e) => setNewVisit({ ...newVisit, purpose: e.target.value })}
                sx={{ borderRadius: 1 }}
              >
                {VISIT_PURPOSES.map((purpose) => (
                  <MenuItem key={purpose} value={purpose}>
                    {purpose}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              placeholder="Any specific instructions for the agent..."
              value={newVisit.notes}
              onChange={(e) => setNewVisit({ ...newVisit, notes: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            disabled={submitting}
            onClick={() => setShowScheduleDialog(false)}
            sx={{ fontWeight: 700, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={async () => {
              // Validation
              if (newVisit.entityType === 'client' && !newVisit.customerId) {
                showToast("Please select a client", "warning");
                return;
              }
              if (newVisit.entityType === 'lead' && !newVisit.leadId) {
                showToast("Please select a lead", "warning");
                return;
              }
              if (!newVisit.visitDate || !newVisit.scheduledTime) {
                showToast("Please select date and time", "warning");
                return;
              }
              if ((isAdmin || isManager) && !newVisit.agentId) {
                showToast("Please assign an agent", "warning");
                return;
              }

              // Date/Time validation (cannot be in past)
              const selectedDateTime = new Date(`${newVisit.visitDate}T${newVisit.scheduledTime}`);
              if (selectedDateTime < new Date()) {
                showToast("Cannot schedule a visit in the past", "error");
                return;
              }

              try {
                setSubmitting(true);
                const payload: any = {
                  visit_date: newVisit.visitDate,
                  scheduled_time: newVisit.scheduledTime,
                  purpose: newVisit.purpose,
                  notes: newVisit.notes,
                  status: 'scheduled'
                };

                if (newVisit.agentId) payload.agent = newVisit.agentId;
                if (newVisit.entityType === 'client') payload.customer = newVisit.customerId;
                else payload.lead = newVisit.leadId;

                await fieldSalesService.createVisit(payload);
                showToast("Visit scheduled successfully", "success");
                setShowScheduleDialog(false);
                fetchVisits();
                // Reset form
                setNewVisit({
                  ...newVisit,
                  customerId: "",
                  leadId: "",
                  purpose: "",
                  notes: "",
                  scheduledTime: ""
                });
              } catch (err: any) {
                console.error("Failed to schedule visit", err);
                const errorMessage = formatDRFError(err);
                showToast(errorMessage, "error");
              } finally {
                setSubmitting(false);
              }
            }}
            sx={{ borderRadius: 2, px: 4, fontWeight: 700 }}
          >
            {submitting ? <CircularProgress size={24} color="inherit" /> : "Schedule"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Visit Detail Dialog */}
      <Dialog
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: theme.shadows[10],
            bgcolor: 'background.paper'
          }
        }}
      >
        {selectedVisit && (
          <>
            <DialogTitle sx={{ p: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Chip
                      label={selectedVisit.status}
                      size="small"
                      color={getStatusColor(selectedVisit.status) as any}
                      sx={{ fontWeight: 800, textTransform: 'uppercase', borderRadius: '2px', fontSize: '0.6rem', height: 20 }}
                    />
                    <KeyboardArrowRightIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                      ID: FS-{selectedVisit.id.toString().padStart(5, '0')}
                    </Typography>
                  </Stack>
                  <Typography variant="h6" fontWeight={900} color="text.primary" sx={{ letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                    {selectedVisit.customer_name || selectedVisit.lead_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Scheduled: {formatDate(selectedVisit.visit_date)}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setShowDetailDialog(false)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) } }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 2.5 }}>
              <Grid container spacing={2.5}>
                {/* 1. OPERATIONAL TIMELINE */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ p: 0.25, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 1, mt: 1.5, mb: 0.5 }}>
                    <Grid container spacing={0.5}>
                      {[
                        {
                          label: 'SCHEDULED',
                          time: selectedVisit.scheduled_time?.substring(0, 5) || 'N/A',
                          date: formatDate(selectedVisit.visit_date),
                          isDifferentDate: false,
                          icon: <AccessTimeIcon />,
                          color: 'primary.main',
                          active: true
                        },
                        {
                          label: 'CHECK-IN',
                          time: selectedVisit.actual_checkin_time ? formatDateTime(selectedVisit.actual_checkin_time).split(',')[1].trim() : '--:--',
                          date: selectedVisit.actual_checkin_time ? formatDateTime(selectedVisit.actual_checkin_time).split(',')[0].trim() : '',
                          isDifferentDate: selectedVisit.actual_checkin_time && formatDateTime(selectedVisit.actual_checkin_time).split(',')[0].trim() !== formatDate(selectedVisit.visit_date),
                          icon: <LocationOnIcon />,
                          color: 'success.main',
                          active: !!selectedVisit.actual_checkin_time
                        },
                        {
                          label: 'CHECK-OUT',
                          time: selectedVisit.actual_checkout_time ? formatDateTime(selectedVisit.actual_checkout_time).split(',')[1].trim() : '--:--',
                          date: selectedVisit.actual_checkout_time ? formatDateTime(selectedVisit.actual_checkout_time).split(',')[0].trim() : '',
                          isDifferentDate: selectedVisit.actual_checkout_time && formatDateTime(selectedVisit.actual_checkout_time).split(',')[0].trim() !== formatDate(selectedVisit.visit_date),
                          icon: <TimerIcon />,
                          color: 'error.main',
                          active: !!selectedVisit.actual_checkout_time
                        }
                      ].map((slot, idx) => (
                        <Grid key={idx} size={{ xs: 4 }}>
                          <Paper elevation={0} sx={{
                            p: 1,
                            textAlign: 'center',
                            borderRadius: 1,
                            bgcolor: slot.active ? 'background.paper' : alpha(theme.palette.divider, 0.03),
                            border: `1px solid ${slot.active ? alpha(theme.palette.divider, 0.08) : 'transparent'}`,
                            minHeight: 60,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
                          }}>
                            <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ mb: 0.2 }}>
                              {React.cloneElement(slot.icon as React.ReactElement, { sx: { fontSize: 13, color: slot.active ? slot.color : 'text.disabled' } } as any)}
                              <Typography variant="caption" sx={{ fontSize: '0.55rem', fontWeight: 800, color: slot.active ? 'text.secondary' : 'text.disabled', letterSpacing: '0.05em' }}>
                                {slot.label}
                              </Typography>
                            </Stack>
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="subtitle2" fontWeight={900} color={slot.active ? slot.color : 'text.disabled'} sx={{ lineHeight: 1 }}>
                                {slot.time}
                              </Typography>
                              {slot.isDifferentDate && slot.date && (
                                <Typography variant="caption" sx={{ fontSize: '0.5rem', fontWeight: 700, color: 'text.secondary', display: 'block', mt: 0.2 }}>
                                  {slot.date}
                                </Typography>
                              )}
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                </Grid>

                {/* 2. LOCATIONS & MAP CONTEXT */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                        <LocationOnIcon sx={{ fontSize: 16 }} color="primary" /> LOCATION TRACKING
                      </Typography>
                      <Stack spacing={1}>
                        <Paper elevation={0} sx={{ p: 1, borderRadius: 1, border: `1px solid ${alpha(theme.palette.success.main, 0.08)}`, bgcolor: alpha(theme.palette.success.main, 0.01) }}>
                          <Typography variant="caption" fontWeight={800} color="success.main" sx={{ display: 'block', fontSize: '0.6rem', mb: 0.25 }}>CHECK-IN POINT</Typography>
                          <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ display: 'block', lineHeight: 1.3 }}>
                            {selectedVisit.checkin_location?.address || "Location data unavailable"}
                          </Typography>
                        </Paper>
                        {selectedVisit.actual_checkout_time && (
                          <Paper elevation={0} sx={{ p: 1.2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.error.main, 0.08)}`, bgcolor: alpha(theme.palette.error.main, 0.01) }}>
                            <Typography variant="caption" fontWeight={800} color="error.main" sx={{ display: 'block', fontSize: '0.6rem', mb: 0.25 }}>CHECK-OUT POINT</Typography>
                            <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ display: 'block', lineHeight: 1.3 }}>
                              {selectedVisit.checkout_location?.address || "Location data unavailable"}
                            </Typography>
                          </Paper>
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </Grid>

                {/* 3. VISUAL EVIDENCE (GALLERY) */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Box>
                    <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                      <StorefrontIcon sx={{ fontSize: 16 }} color="primary" /> VISUAL EVIDENCE
                    </Typography>
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 1.5,
                      maxHeight: 280,
                      overflowY: 'auto',
                      pr: 0.5
                    }}>
                      {/* Agent Selfie */}
                      {selectedVisit.checkin_selfie && (
                        <Box sx={{ position: 'relative' }}>
                          <Box component="img" src={selectedVisit.checkin_selfie} sx={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 1.5, border: `1.5px solid ${alpha(theme.palette.primary.main, 0.08)}` }} />
                          <Chip label="SELFIE" size="small" sx={{ position: 'absolute', bottom: 8, left: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', fontWeight: 800, backdropFilter: 'blur(4px)', fontSize: '0.55rem', height: 16, borderRadius: '2px' }} />
                        </Box>
                      )}

                      {/* Visit Images */}
                      {selectedVisit.images && selectedVisit.images.length > 0 ? (
                        selectedVisit.images.map((img, idx) => (
                          <Box key={idx} sx={{ position: 'relative' }}>
                            <Box component="img" src={img.image_url} sx={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 1.5, border: `1.5px solid ${alpha(theme.palette.divider, 0.08)}` }} />
                            <Chip label={img.image_type.replace('_', ' ').toUpperCase()} size="small" sx={{ position: 'absolute', bottom: 8, left: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', fontWeight: 800, backdropFilter: 'blur(4px)', fontSize: '0.55rem', height: 16, borderRadius: '2px' }} />
                          </Box>
                        ))
                      ) : (
                        selectedVisit.customer?.shop_image && (
                          <Box sx={{ position: 'relative' }}>
                            <Box component="img" src={selectedVisit.customer.shop_image} sx={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 1.5, border: `1.5px solid ${alpha(theme.palette.divider, 0.08)}`, opacity: 0.8 }} />
                            <Chip label="MASTER" size="small" sx={{ position: 'absolute', bottom: 8, left: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', fontWeight: 800, backdropFilter: 'blur(4px)', fontSize: '0.55rem', height: 16, borderRadius: '2px' }} />
                          </Box>
                        )
                      )}
                    </Box>
                  </Box>
                </Grid>

                {/* 4. ENGAGEMENT NOTES (FULL WIDTH ROW) */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                      <AssignmentIcon sx={{ fontSize: 16 }} color="primary" /> ENGAGEMENT NOTES
                    </Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                      {selectedVisit.voice_note_url && (
                        <Paper elevation={0} sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: 1.2,
                          borderLeft: `3px solid ${theme.palette.secondary.main}`,
                          bgcolor: alpha(theme.palette.secondary.main, 0.01)
                        }}>
                          <Typography variant="caption" fontWeight={800} color="secondary.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, fontSize: '0.65rem' }}>
                            <MicIcon sx={{ fontSize: 12 }} /> ACOUSTIC VERIFICATION
                          </Typography>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Box sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '10px',
                              bgcolor: 'secondary.main',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: `0 4px 12px ${alpha(theme.palette.secondary.main, 0.2)}`
                            }}>
                              <PlayArrowIcon sx={{ color: 'white', fontSize: 18 }} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="caption" fontWeight={800} color="secondary.darker" sx={{ display: 'block', fontSize: '0.6rem' }}>Audio Feedback</Typography>
                              <GraphicEqIcon sx={{ animation: `${pulse} 2s infinite ease-in-out`, color: 'secondary.main', fontSize: 16 }} />
                            </Box>
                          </Stack>
                          <Box sx={{ mt: 1 }}>
                            <audio controls src={selectedVisit.voice_note_url} style={{ width: '100%', height: '26px' }} />
                          </Box>
                        </Paper>
                      )}

                      <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 1.2, borderLeft: `3px solid ${theme.palette.primary.main}`, bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
                        <Typography variant="caption" fontWeight={800} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, fontSize: '0.65rem' }}>
                          <NotesIcon sx={{ fontSize: 12 }} /> PRE-VISIT PURPOSE
                        </Typography>
                        <Typography variant="caption" fontWeight={700} color="text.primary" sx={{ display: 'block', lineHeight: 1.3 }}>
                          {selectedVisit.purpose || "No specific purpose stated"}
                        </Typography>
                        {selectedVisit.notes && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', fontSize: '0.65rem' }}>
                            "{selectedVisit.notes}"
                          </Typography>
                        )}
                      </Paper>

                      {selectedVisit.checkout_notes && (
                        <Paper elevation={0} sx={{ flex: 1, p: 1.5, borderRadius: 2, borderLeft: `3px solid ${theme.palette.success.main}`, bgcolor: alpha(theme.palette.success.main, 0.01) }}>
                          <Typography variant="caption" fontWeight={800} color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, fontSize: '0.65rem' }}>
                            <CheckCircleIcon sx={{ fontSize: 12 }} /> VISIT OUTCOME
                          </Typography>
                          <Typography variant="caption" fontWeight={800} sx={{ mb: 0.5, color: 'success.dark', display: 'block' }}>
                            {selectedVisit.outcome || "Visit Completed"}
                          </Typography>
                          <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary', fontSize: '0.65rem', display: 'block' }}>
                            "{selectedVisit.checkout_notes}"
                          </Typography>
                        </Paper>
                      )}
                    </Stack>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2, bgcolor: alpha(theme.palette.action.hover, 0.2), borderTop: `1px solid ${alpha(theme.palette.divider, 0.03)}` }}>
              <Button
                onClick={() => setShowDetailDialog(false)}
                variant="contained"
                size="medium"
                fullWidth
                sx={{
                  borderRadius: 2.5,
                  py: 1,
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  letterSpacing: '0.05em',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                DISMISS DETAILS
              </Button>
            </DialogActions>
          </>
        )
        }
      </Dialog >
      <TablePagination
        component="div"
        count={count}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />
    </>
  );
}

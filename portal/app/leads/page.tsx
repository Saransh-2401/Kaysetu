"use client";
import React, { useState, useMemo, Suspense, useEffect } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  useTheme,
  useMediaQuery,
  alpha,
  Drawer,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  FormControl,
  InputLabel,
  Select,
  TablePagination,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { crmService, Lead as CRMLead } from "@/lib/crm-service";
import { authService, SalesAgent } from "@/lib/auth-service";
import { apiClient } from "@/lib/api-client";
import { formatDRFError, formatDate, formatDateTime } from "@/lib/utils";
import MapLocationPicker from "@/components/shared/MapLocationPicker";

// Icons
import { SearchIcon, AddIcon, FilterListIcon, PhoneIcon, EmailIcon, WhatsAppIcon, PersonIcon, BusinessIcon, CloseIcon, LocationOnIcon, TimelineIcon, MapIcon, MyLocationIcon, ViewListIcon, GridViewIcon, FilterAltOffIcon, VisibilityIcon, HistoryIcon, EventNoteIcon, CheckCircleOutlineIcon, TimerIcon, AssignmentIcon, StorefrontIcon } from "@/components/icons";
import { fieldSalesService, Visit as FieldVisit } from "@/lib/field-sales-service";

const SOURCE_OPTIONS = [
  "Cold Calling",
  "Exhibition",
  "Campaign",
  "Website",
  "Referral",
  "Existing Customer",
  "Field Visit",
  "Other",
];

export default function LeadsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LeadsContent />
    </Suspense>
  );
}

function LeadsContent() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const searchParams = useSearchParams();
  const router = useRouter();

  // State
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openVisitHistory, setOpenVisitHistory] = useState(false);
  const [currentLeadForVisits, setCurrentLeadForVisits] = useState<CRMLead | null>(null);
  const [visitHistory, setVisitHistory] = useState<FieldVisit[]>([]);
  const [fetchingVisits, setFetchingVisits] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [managers, setManagers] = useState<any[]>([]);

  // Sorting State
  const [orderBy, setOrderBy] = useState<string>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [count, setCount] = useState(0);

  // Add Lead Form State
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadCompany, setNewLeadCompany] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadSource, setNewLeadSource] = useState("");

  // Address Fields
  const [shopNo, setShopNo] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [salesAgents, setSalesAgents] = useState<SalesAgent[]>([]);
  const [isManagerOrAdmin, setIsManagerOrAdmin] = useState(false);
  const [openMapModal, setOpenMapModal] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  useEffect(() => { if (isMobile) setViewMode('card'); }, [isMobile]);
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

  const fetchVisitHistory = async (lead: CRMLead) => {
    try {
      setFetchingVisits(true);
      setCurrentLeadForVisits(lead);
      setOpenVisitHistory(true);

      // Only fetch visits directly linked to this lead
      const response = await fieldSalesService.getVisits({ lead: lead.id.toString() });
      const data = (response as any).results || response || [];
      setVisitHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch visit history", error);
      showToast("Failed to fetch visit history", "error");
    } finally {
      setFetchingVisits(false);
    }
  };

  // Fetch Leads
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const user = await authService.getCurrentUser();
      if (user) {
        const params: any = {
          ordering: order === 'asc' ? orderBy : `-${orderBy}`,
        };

        if (statusFilter !== "all") params.status = statusFilter;
        if (agentFilter !== "all") params.assigned_to = agentFilter;
        if (managerFilter !== "all") params.sales_manager = managerFilter;
        if (search) params.search = search;
        params.page = page + 1;
        params.page_size = rowsPerPage;

        const response = await crmService.getLeads(params);
        const data = (response as any).results || (Array.isArray(response) ? response : []);
        setLeads(data);
        setCount((response as any).count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch leads", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter, agentFilter, managerFilter, orderBy, order, search, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    // Fetch Agents and check Role
    const checkRoleAndFetchAgents = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (
          user.role === "admin" ||
          user.role === "admin_staff" ||
          user.role === "sales_manager" ||
          user.role === "superuser" ||
          (user.role as string) === "mdo"
        ) {
          setIsManagerOrAdmin(true);
          setIsAdmin(user.role === "admin" || user.role === "superuser" || (user.role as string) === "mdo");
          const agents = await authService.getAssignedSalesAgents();
          setSalesAgents(agents);

          // If admin, fetch managers
          if (user.role === "admin" || (user.role as string) === "mdo" || user.role === "superuser") {
            try {
              const response = await apiClient.get<any>('/auth/users/', { role: 'sales_manager' });
              const managerList = (response as any).results || response;
              setManagers(Array.isArray(managerList) ? managerList : []);
            } catch (err) {
              console.error("Error fetching managers", err);
            }
          }
        } else {
          setIsManagerOrAdmin(false);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error checking role/fetching agents", err);
      }
    };
    checkRoleAndFetchAgents();
  }, []);

  const handleCloseDialog = () => {
    setOpenAddDialog(false);
    // Reset form
    setNewLeadName("");
    setNewLeadCompany("");
    setNewLeadPhone("");
    setNewLeadEmail("");
    setNewLeadSource("");
    setShopNo("");
    setStreet("");
    setCity("");
    setState("");
    setPincode("");
    setLatitude(null);
    setLongitude(null);
    setAssignedAgentId("");
  };

  const handleSaveLead = async () => {
    try {
      // Validations
      if (
        !newLeadName ||
        !newLeadCompany ||
        newLeadPhone.length !== 10 ||
        !newLeadSource ||
        !shopNo ||
        !street ||
        !city ||
        !state ||
        pincode.length !== 6 ||
        (isManagerOrAdmin && !assignedAgentId)
      ) {
        setSavingLead(true);
        showToast("Please fill all mandatory fields correctly.", "warning");
        return;
      }

      // Check optional email format
      if (newLeadEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLeadEmail)) {
        setSavingLead(true);
        showToast("Please enter a valid email address.", "warning");
        return;
      }

      setSavingLead(true);

      const payload: any = {
        name: newLeadName,
        company_name: newLeadCompany,
        phone: newLeadPhone,
        email: newLeadEmail,
        status: 'open',
        source: newLeadSource ? newLeadSource.toLowerCase().replace(/ /g, "_") : null,
        address_line1: shopNo,
        address_line2: street,
        city: city,
        state: state,
        postal_code: pincode,
        latitude: latitude,
        longitude: longitude,
      };

      if (isManagerOrAdmin && assignedAgentId) {
        payload.assigned_to = parseInt(assignedAgentId);
      }

      await crmService.createLead(payload);
      fetchLeads();
      handleCloseDialog();
    } catch (e: any) {
      console.error("Failed to save lead", e);
      const errorMsg = formatDRFError(e);
      showToast(errorMsg, "error");
    } finally {
      setSavingLead(false);
    }
  };

  const getUserLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(function (position) {
        // In a real app, we would reverse geocode here
        // For now, we simulate success or just let user know
        alert("Location detected! (Reverse geocoding not wired up)");
        // e.g. setCity("Detected City");
      });
    } else {
      alert("Geolocation is not available");
    }
  }

  const filteredLeads = leads;

  const handleLeadClick = (lead: CRMLead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "new":
      case "open": return "info";
      case "qualified":
      case "interested": return "success";
      case "contacted":
      case "replied": return "warning";
      case "lost": return "error";
      case "converted": return "secondary";
      default: return "default";
    }
  };

  const getInitials = (name: string) => {
    return name?.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "NA";
  };

  return (
    <>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {/* HEADER */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={3}
        >
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ fontSize: { xs: '1.4rem', md: '2rem' } }}>Leads</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              Manage and track your leads pipeline
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAddDialog(true)}
            sx={{
              borderRadius: "10px",
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Add Lead
          </Button>
        </Stack>

        {/* FILTERS BAR */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 1.5 },
            px: { xs: 2, sm: 3 },
            mb: 3,
            borderRadius: { xs: '16px', sm: '50px' },
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            flexWrap: { sm: 'wrap' },
            gap: { xs: 1.5, sm: 2 },
            alignItems: { sm: 'center' },
            bgcolor: 'background.paper',
            boxShadow: `0 4px 15px ${alpha(theme.palette.common.black, 0.04)}`
          }}
        >
          <TextField
            size="small"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { xs: '100%', sm: 240 }, flex: 1 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '30px',
                  bgcolor: alpha(theme.palette.background.default, 0.4),
                  '& fieldset': { borderColor: alpha(theme.palette.divider, 0.1) }
                }
              }
            }}
          />

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
            <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{
                  borderRadius: '30px',
                  bgcolor: alpha(theme.palette.background.default, 0.4),
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.1) }
                }}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="replied">Replied</MenuItem>
                <MenuItem value="interested">Interested</MenuItem>
                <MenuItem value="qualified">Qualified</MenuItem>
                <MenuItem value="converted">Converted</MenuItem>
                <MenuItem value="lost">Lost</MenuItem>
              </Select>
            </FormControl>

            {isManagerOrAdmin && !isAdmin && (
              <FormControl size="small" sx={{ flex: 1, minWidth: 140 }}>
                <InputLabel id="agent-filter-label">Sales Agent</InputLabel>
                <Select
                  labelId="agent-filter-label"
                  value={agentFilter}
                  label="Sales Agent"
                  onChange={(e) => setAgentFilter(e.target.value)}
                  sx={{
                    borderRadius: '30px',
                    bgcolor: alpha(theme.palette.background.default, 0.4),
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.1) }
                  }}
                >
                  <MenuItem value="all">All Agents</MenuItem>
                  {salesAgents.map(agent => (
                    <MenuItem key={agent.id} value={agent.id.toString()}>{agent.full_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {isAdmin && (
              <FormControl size="small" sx={{ flex: 1, minWidth: 140 }}>
                <InputLabel id="manager-filter-label">Sales Manager</InputLabel>
                <Select
                  labelId="manager-filter-label"
                  value={managerFilter}
                  label="Sales Manager"
                  onChange={(e) => setManagerFilter(e.target.value)}
                  sx={{
                    borderRadius: '30px',
                    bgcolor: alpha(theme.palette.background.default, 0.4),
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.1) }
                  }}
                >
                  <MenuItem value="all">All Managers</MenuItem>
                  {managers.map(mgr => (
                    <MenuItem key={mgr.id} value={mgr.id.toString()}>{mgr.full_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: { sm: 'auto' } }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => val && setViewMode(val)}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.background.default, 0.4),
              borderRadius: '30px',
              p: 0.5,
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '25px !important',
                px: 2,
                '&.Mui-selected': {
                  bgcolor: 'background.paper',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'background.paper' }
                }
              }
            }}
          >
            <ToggleButton value="list">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="card">
              <GridViewIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          {(search !== "" || statusFilter !== "all" || agentFilter !== "all" || managerFilter !== "all") && (
            <IconButton
              size="small"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setAgentFilter("all");
                setManagerFilter("all");
                setOrderBy("created_at");
                setOrder("desc");
              }}
              sx={{
                bgcolor: alpha(theme.palette.error.main, 0.1),
                color: theme.palette.error.main,
                '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) }
              }}
            >
              <FilterAltOffIcon fontSize="small" />
            </IconButton>
          )}
          </Box>
        </Paper>

        {/* LIST */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredLeads.length === 0 ? (
          <Box
            component={motion.div}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            sx={{
              textAlign: "center",
              py: { xs: 8, md: 15 },
              px: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.02),
              borderRadius: 6,
              border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
              mt: 2
            }}
          >
            <Box sx={{ position: 'relative', mb: 4 }}>
              <Box
                component={motion.div}
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: '40px',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PersonIcon sx={{ fontSize: 60, color: theme.palette.primary.main, opacity: 0.9 }} />
              </Box>
              <Box
                component={motion.div}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                sx={{
                  position: 'absolute',
                  bottom: -10,
                  right: -10,
                  bgcolor: theme.palette.primary.main,
                  borderRadius: '16px',
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                  border: `4px solid ${theme.palette.background.default}`
                }}
              >
                <AddIcon sx={{ fontSize: 24, color: '#fff' }} />
              </Box>
            </Box>

            <Typography variant="h4" fontWeight={900} sx={{ mb: 1.5, color: theme.palette.text.primary }}>
              {search ? "No matches found" : "Build your pipeline"}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480, mb: 5, mx: 'auto', lineHeight: 1.6, fontSize: '1.1rem' }}>
              {search
                ? `We couldn't find any leads matching "${search}". Try adjusting your search query or filters.`
                : "Your lead management system is ready. Add your first lead today to start tracking sales opportunities and growing your business."
              }
            </Typography>

            {search ? (
              <Button
                variant="outlined"
                size="large"
                onClick={() => setSearch("")}
                sx={{
                  borderRadius: 1,
                  px: 5,
                  py: 1.5,
                  fontWeight: 700,
                  borderWidth: 2,
                  '&:hover': { borderWidth: 2 }
                }}
              >
                Clear Search Filter
              </Button>
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenAddDialog(true)}
                  sx={{
                    borderRadius: 1,
                    px: 6,
                    py: 1.8,
                    fontWeight: 800,
                    fontSize: '1rem',
                    boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    '&:hover': {
                      boxShadow: `0 15px 30px ${alpha(theme.palette.primary.main, 0.4)}`,
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  Create Your First Lead
                </Button>
              </Stack>
            )}
          </Box>
        ) : viewMode === 'card' ? (
          <Grid container spacing={3}>
            <AnimatePresence>
              {filteredLeads.map((lead) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={lead.id}>
                  <Paper
                    elevation={0}
                    onClick={() => handleLeadClick(lead)}
                    component={motion.div}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.98 }}
                    sx={{
                      p: 2.5,
                      borderRadius: 1,
                      border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                      bgcolor: "background.paper",
                      cursor: "pointer",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      position: 'relative',
                      overflow: 'hidden',
                      "&:hover": {
                        boxShadow: "0px 12px 32px rgba(0,0,0,0.08)",
                        borderColor: alpha(theme.palette.primary.main, 0.3),
                        transform: 'translateY(-4px)',
                        "& .lead-arrow": { opacity: 1, transform: 'translateX(0)' }
                      },
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                      <Avatar sx={{
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: "primary.main",
                        fontWeight: 800,
                        width: 48,
                        height: 48,
                        fontSize: '1rem',
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                      }}>
                        {getInitials(lead.name)}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ color: theme.palette.text.primary, lineHeight: 1.2 }}>
                          {lead.name}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          {lead.company_name}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchVisitHistory(lead);
                          }}
                          sx={{
                            width: 28,
                            height: 28,
                            bgcolor: alpha(theme.palette.secondary.main, 0.08),
                            color: theme.palette.secondary.main,
                            border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                            '&:hover': {
                              bgcolor: alpha(theme.palette.secondary.main, 0.15),
                              transform: 'scale(1.1)'
                            },
                            transition: 'all 0.2s'
                          }}
                          title="Visit Logs"
                        >
                          <HistoryIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <Chip
                          label={lead.status}
                          size="small"
                          color={getStatusColor(lead.status) as any}
                          sx={{
                            borderRadius: '8px',
                            fontWeight: 800,
                            textTransform: "uppercase",
                            height: 24,
                            fontSize: '0.65rem',
                            letterSpacing: '0.05em'
                          }}
                        />
                      </Stack>
                    </Stack>

                    <Divider sx={{ mb: 2, opacity: 0.5 }} />

                    <Stack spacing={1.5}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: alpha(theme.palette.info.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: 'info.main' }} />
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ textTransform: "capitalize" }}>
                          {lead.source?.replace(/_/g, " ") || "Direct"}
                        </Typography>
                      </Stack>

                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: alpha(theme.palette.error.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LocationOnIcon sx={{ fontSize: 16, color: 'error.main' }} />
                        </Box>
                        <Typography variant="body2" fontWeight={600} color="text.secondary" noWrap title={lead.address}>
                          {lead.address || "Location not set"}
                        </Typography>
                      </Stack>
                    </Stack>

                  </Paper>
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, overflowX: 'auto' }}>
            <Table sx={{ minWidth: 900 }}>
              <TableHead sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', py: 2.5, width: 200, minWidth: 180 }}>
                    <TableSortLabel
                      active={orderBy === 'name'}
                      direction={orderBy === 'name' ? order : 'asc'}
                      onClick={() => {
                        const isAsc = orderBy === 'name' && order === 'asc';
                        setOrder(isAsc ? 'desc' : 'asc');
                        setOrderBy('name');
                      }}
                    >
                      Lead Info
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', width: 150, minWidth: 120 }}>
                    <TableSortLabel
                      active={orderBy === 'company_name'}
                      direction={orderBy === 'company_name' ? order : 'asc'}
                      onClick={() => {
                        const isAsc = orderBy === 'company_name' && order === 'asc';
                        setOrder(isAsc ? 'desc' : 'asc');
                        setOrderBy('company_name');
                      }}
                    >
                      Shop Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
                    <TableSortLabel
                      active={orderBy === 'status'}
                      direction={orderBy === 'status' ? order : 'asc'}
                      onClick={() => {
                        const isAsc = orderBy === 'status' && order === 'asc';
                        setOrder(isAsc ? 'desc' : 'asc');
                        setOrderBy('status');
                      }}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  {isManagerOrAdmin && (
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
                      <TableSortLabel
                        active={orderBy === 'assigned_to__full_name'}
                        direction={orderBy === 'assigned_to__full_name' ? order : 'asc'}
                        onClick={() => {
                          const isAsc = orderBy === 'assigned_to__full_name' && order === 'asc';
                          setOrder(isAsc ? 'desc' : 'asc');
                          setOrderBy('assigned_to__full_name');
                        }}
                      >
                        Sales Agent
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {isAdmin && (
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase' }}>
                      <TableSortLabel
                        active={orderBy === 'assigned_to__assigned_to__full_name'}
                        direction={orderBy === 'assigned_to__assigned_to__full_name' ? order : 'asc'}
                        onClick={() => {
                          const isAsc = orderBy === 'assigned_to__assigned_to__full_name' && order === 'asc';
                          setOrder(isAsc ? 'desc' : 'asc');
                          setOrderBy('assigned_to__assigned_to__full_name');
                        }}
                      >
                        Sales Manager
                      </TableSortLabel>
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', width: 120, minWidth: 100 }}>Source</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', width: 200, minWidth: 160 }}>Full Address</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', textAlign: 'center' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    hover
                    onClick={() => handleLeadClick(lead)}
                    sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main", fontWeight: 800, width: 36, height: 36, fontSize: '0.85rem' }}>
                          {getInitials(lead.name)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={800} noWrap sx={{ maxWidth: 140 }}>{lead.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 140, display: 'block' }}>{lead.email || lead.phone}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 150 }}>
                      <Typography variant="body2" fontWeight={600} color="text.secondary" noWrap title={lead.company_name}>{lead.company_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={lead.status}
                        size="small"
                        color={getStatusColor(lead.status) as any}
                        sx={{ borderRadius: '6px', fontWeight: 800, textTransform: "capitalize", height: 24, fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    {isManagerOrAdmin && (
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="text.secondary">{lead.assigned_to_name || "Unassigned"}</Typography>
                      </TableCell>
                    )}
                    {isAdmin && (
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="text.secondary">{(lead as any).sales_manager_name || "N/A"}</Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ textTransform: "capitalize" }}>
                        {lead.source?.replace(/_/g, " ") || "Direct"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                        <LocationOnIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                        <Typography
                          variant="caption"
                          fontWeight={500}
                          noWrap
                          title={lead.address}
                          sx={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {lead.address || "N/A"}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        title="View Visits"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchVisitHistory(lead);
                        }}
                        sx={{
                          bgcolor: alpha(theme.palette.secondary.main, 0.1),
                          color: theme.palette.secondary.main,
                          '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.2) }
                        }}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* ADD LEAD DIALOG */}
      <Dialog
        open={openAddDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 1 }
        }}
      >
        <DialogTitle sx={{
          pb: 1,
          pt: 3,
          px: 4,
          fontWeight: 800,
          fontSize: '1.5rem',
          color: theme.palette.primary.dark
        }}>
          Add New Lead
        </DialogTitle>
        <DialogContent sx={{ px: 4, py: 2 }}>
          <Stack spacing={4}>
            <Grid container spacing={4}>
              {/* LEFT COLUMN: Basic Info */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack spacing={2.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PersonIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Basic Information
                    </Typography>
                  </Box>
                  <TextField
                    label="Lead Owner Name"
                    fullWidth
                    required
                    placeholder="Enter owner name"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                    error={!newLeadName && savingLead}
                    helperText={!newLeadName && savingLead ? "Owner name is required" : ""}
                    inputProps={{ maxLength: 50 }}
                  />
                  <TextField
                    label="Shop / Company Name"
                    fullWidth
                    required
                    placeholder="Enter shop or company name"
                    value={newLeadCompany}
                    onChange={(e) => setNewLeadCompany(e.target.value)}
                    error={!newLeadCompany && savingLead}
                    helperText={!newLeadCompany && savingLead ? "Shop name is required" : ""}
                    inputProps={{ maxLength: 100 }}
                  />
                  <TextField
                    label="Mobile Number"
                    fullWidth
                    required
                    placeholder="10-digit mobile number"
                    value={newLeadPhone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').substring(0, 10);
                      setNewLeadPhone(val);
                    }}
                    error={savingLead && (newLeadPhone.length !== 10)}
                    helperText={savingLead && (newLeadPhone.length !== 10) ? "Enter a valid 10-digit number" : ""}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">+91</InputAdornment>,
                    }}
                  />
                  <TextField
                    label="Email Address"
                    fullWidth
                    type="email"
                    placeholder="name@example.com"
                    value={newLeadEmail}
                    onChange={(e) => setNewLeadEmail(e.target.value)}
                    error={savingLead && newLeadEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLeadEmail)}
                    helperText={savingLead && newLeadEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLeadEmail) ? "Enter a valid email" : ""}
                  />
                  <TextField
                    select
                    label="Lead Source"
                    fullWidth
                    required
                    value={newLeadSource}
                    onChange={(e) => setNewLeadSource(e.target.value)}
                    error={!newLeadSource && savingLead}
                    helperText={!newLeadSource && savingLead ? "Lead source is required" : ""}
                  >
                    {SOURCE_OPTIONS.map((opt) => (
                      <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                  </TextField>

                  {isManagerOrAdmin && (
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <PersonIcon color="secondary" fontSize="small" />
                        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Assignment
                        </Typography>
                      </Box>
                      <TextField
                        select
                        label="Assign To Sales Agent"
                        fullWidth
                        required={isManagerOrAdmin}
                        value={assignedAgentId}
                        onChange={(e) => setAssignedAgentId(e.target.value)}
                        error={isManagerOrAdmin && !assignedAgentId && savingLead}
                        helperText={isManagerOrAdmin && !assignedAgentId && savingLead ? "Assignment is required" : ""}
                      >
                        {salesAgents.map((agent) => (
                          <MenuItem key={agent.id} value={agent.id.toString()}>{agent.full_name}</MenuItem>
                        ))}
                      </TextField>
                    </Box>
                  )}
                </Stack>
              </Grid>

              {/* RIGHT COLUMN: Location Info */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Stack spacing={2.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationOnIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Location Details
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<MapIcon />}
                      onClick={() => setOpenMapModal(true)}
                    >
                      Select on Map
                    </Button>
                  </Box>

                  <TextField
                    label="Shop / Flat / Build No"
                    fullWidth
                    required
                    placeholder="Building or plot number"
                    value={shopNo}
                    onChange={(e) => setShopNo(e.target.value)}
                    error={!shopNo && savingLead}
                    helperText={!shopNo && savingLead ? "Required" : ""}
                  />
                  <TextField
                    label="Street / Area / Landmark"
                    fullWidth
                    required
                    placeholder="Locality name"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    error={!street && savingLead}
                    helperText={!street && savingLead ? "Required" : ""}
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        label="City"
                        fullWidth
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        error={!city && savingLead}
                        helperText={!city && savingLead ? "Required" : ""}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField
                        label="State"
                        fullWidth
                        required
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        error={!state && savingLead}
                        helperText={!state && savingLead ? "Required" : ""}
                      />
                    </Grid>
                  </Grid>

                  <TextField
                    label="Pincode"
                    fullWidth
                    required
                    placeholder="6-digit PIN"
                    value={pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').substring(0, 6);
                      setPincode(val);
                    }}
                    error={savingLead && pincode.length !== 6}
                    helperText={savingLead && pincode.length !== 6 ? "Enter a valid 6-digit PIN" : ""}
                  />

                  {/* Map Visual Indicator */}
                  <Box
                    sx={{
                      height: 120,
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      borderRadius: 2,
                      border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      cursor: 'pointer'
                    }}
                    onClick={() => setOpenMapModal(true)}
                  >
                    <MyLocationIcon color="primary" />
                    <Typography variant="caption" fontWeight={600} color="primary">
                      {city ? `${city}, ${state}` : "No coordinates selected"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Click to pick location on map
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 4, pb: 4, pt: 2, gap: 2 }}>
          <Button
            onClick={handleCloseDialog}
            sx={{
              borderRadius: 2,
              px: 3,
              color: 'text.secondary',
              '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.05), color: 'error.main' }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveLead}
            disabled={savingLead}
            sx={{
              borderRadius: 2.5,
              px: 5,
              py: 1.2,
              fontWeight: 800,
              boxShadow: theme.shadows[4],
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              '&:hover': {
                boxShadow: theme.shadows[6],
                transform: 'translateY(-1px)'
              }
            }}
          >
            {savingLead ? "Saving..." : "Save Lead"}
          </Button>
        </DialogActions>
      </Dialog>

      <MapLocationPicker
        open={openMapModal}
        onClose={() => setOpenMapModal(false)}
        initialLat={latitude || 28.6139}
        initialLng={longitude || 77.2090}
        onConfirm={(loc) => {
          setLatitude(loc.lat);
          setLongitude(loc.lng);
          if (loc.address) setStreet(loc.address);
          if (loc.city) setCity(loc.city);
          if (loc.state) setState(loc.state);
          if (loc.pincode) setPincode(loc.pincode);
          setOpenMapModal(false);
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%", borderRadius: 2, fontWeight: 600 }}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* VISIT HISTORY MODAL */}
      <Dialog
        open={openVisitHistory}
        onClose={() => setOpenVisitHistory(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 1, bgcolor: 'background.paper' }
        }}
      >
        <DialogTitle sx={{ p: 3, pb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main' }}>
                <HistoryIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={800}>Visit History</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Logs for {currentLeadForVisits?.name} ({currentLeadForVisits?.company_name})
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={() => setOpenVisitHistory(false)} size="small" sx={{ bgcolor: alpha(theme.palette.error.main, 0.05), color: theme.palette.error.main }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ p: 0, minHeight: 400 }}>
          {fetchingVisits ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
              <CircularProgress size={40} thickness={4} />
              <Typography variant="body2" color="text.secondary" fontWeight={600}>Fetching visit activities...</Typography>
            </Box>
          ) : visitHistory.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, px: 3, textAlign: 'center' }}>
              <Box sx={{ width: 64, height: 64, borderRadius: '20px', bgcolor: alpha(theme.palette.primary.main, 0.05), display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <EventNoteIcon sx={{ fontSize: 32, color: alpha(theme.palette.primary.main, 0.4) }} />
              </Box>
              <Typography variant="h6" fontWeight={800} color="text.primary">No Visits Found</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, mt: 1 }}>
                There are no scheduled or completed visits logged for this lead yet.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2} sx={{ p: 3 }}>
              {visitHistory.map((visit) => (
                <Paper
                  key={visit.id}
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    bgcolor: alpha(theme.palette.background.default, 0.3),
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.02),
                      borderColor: alpha(theme.palette.primary.main, 0.2)
                    }
                  }}
                >
                  {/* Header: Date & Agent */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="body2" fontWeight={800} sx={{ fontSize: '1rem', mb: 0.3 }}>
                        {visit.created_at ? formatDateTime(visit.created_at) : formatDate(visit.visit_date)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        Visit Created
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: alpha(theme.palette.secondary.main, 0.15),
                          color: 'secondary.main',
                          fontSize: '0.75rem',
                          fontWeight: 800
                        }}
                      >
                        {visit.agent_name?.charAt(0) || 'A'}
                      </Avatar>
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                        {visit.agent_name || "Unknown"}
                      </Typography>
                    </Stack>
                  </Stack>

                  {/* Purpose & Notes */}
                  {(visit.purpose || visit.notes || visit.checkout_notes) && (
                    <Grid container spacing={1.5} mb={2}>
                      {(visit.purpose || visit.notes) && (
                        <Grid size={{ xs: visit.checkout_notes ? 6 : 12 }}>
                          <Paper elevation={0} sx={{ p: 1.5, height: '100%', bgcolor: alpha(theme.palette.info.main, 0.04), borderRadius: 1.5, borderLeft: `3px solid ${theme.palette.info.main}` }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem' }}>
                              VISIT PURPOSE
                            </Typography>
                            {visit.purpose && (
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem', mb: visit.notes ? 0.5 : 0 }}>
                                {visit.purpose}
                              </Typography>
                            )}
                            {visit.notes && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                                {visit.notes}
                              </Typography>
                            )}
                          </Paper>
                        </Grid>
                      )}
                      {visit.checkout_notes && (
                        <Grid size={{ xs: (visit.purpose || visit.notes) ? 6 : 12 }}>
                          <Paper elevation={0} sx={{ p: 1.5, height: '100%', bgcolor: alpha(theme.palette.warning.main, 0.04), borderRadius: 1.5, borderLeft: `3px solid ${theme.palette.warning.main}` }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem' }}>
                              CHECKOUT NOTES
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', fontStyle: 'italic', lineHeight: 1.5 }}>
                              "{visit.checkout_notes}"
                            </Typography>
                          </Paper>
                        </Grid>
                      )}
                    </Grid>
                  )}

                  {/* Check-in & Check-out Grid */}
                  <Grid container spacing={1.5} mb={2}>
                    <Grid size={{ xs: 6 }}>
                      <Paper elevation={0} sx={{ p: 1.5, bgcolor: alpha(theme.palette.success.main, 0.06), borderRadius: 1.5, border: `1px solid ${alpha(theme.palette.success.main, 0.15)}` }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
                          <Typography variant="caption" color="success.main" fontWeight={800} sx={{ fontSize: '0.65rem' }}>
                            CHECK-IN
                          </Typography>
                        </Stack>
                        {visit.actual_checkin_time ? (
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                            {formatDateTime(visit.actual_checkin_time)}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.75rem' }}>
                            Not checked in
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper elevation={0} sx={{ p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.06), borderRadius: 1.5, border: `1px solid ${alpha(theme.palette.error.main, 0.15)}` }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" mb={0.5}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main' }} />
                          <Typography variant="caption" color="error.main" fontWeight={800} sx={{ fontSize: '0.65rem' }}>
                            CHECK-OUT
                          </Typography>
                        </Stack>
                        {visit.actual_checkout_time ? (
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                            {formatDateTime(visit.actual_checkout_time)}
                          </Typography>
                        ) : (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.75rem' }}>
                            Not checked out
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Outcome & Lead Status */}
                  {(visit.outcome || visit.lead_status_at_checkout) && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
                      {visit.outcome && (
                        <Chip
                          label={visit.outcome}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            height: 24,
                            bgcolor: alpha(theme.palette.success.main, 0.1),
                            color: 'success.main',
                          }}
                        />
                      )}
                      {visit.lead_status_at_checkout && (
                        <Chip
                          label={`Lead: ${visit.lead_status_at_checkout}`}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            height: 24,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                            textTransform: 'capitalize'
                          }}
                        />
                      )}
                    </Stack>
                  )}

                  {/* Voice Note */}
                  {visit.voice_note_url && (
                    <Paper elevation={0} sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 1.5, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              width: 0,
                              height: 0,
                              borderLeft: '5px solid white',
                              borderTop: '4px solid transparent',
                              borderBottom: '4px solid transparent',
                              ml: 0.3
                            }}
                          />
                        </Box>
                        <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
                          Voice Note
                        </Typography>
                      </Stack>
                      <Box
                        component="audio"
                        controls
                        src={visit.voice_note_url}
                        sx={{
                          width: '100%',
                          height: 32,
                          borderRadius: 1,
                        }}
                      />
                    </Paper>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setOpenVisitHistory(false)}
            variant="contained"
            disableElevation
            sx={{ borderRadius: 2, px: 4, fontWeight: 800 }}
          >
            Close Logs
          </Button>
        </DialogActions>
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

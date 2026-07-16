"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  Avatar,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  LinearProgress,
  useTheme,
  useMediaQuery,
  alpha,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  Tooltip,
  TableSortLabel,
  Alert,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";

import AgentLocationModal from "@/components/sales/AgentLocationModal";
import AgentDayRouteModal from "@/components/sales/AgentDayRouteModal";
import SetTargetModal from "@/components/sales/SetTargetModal";
import UserFormDialog from "@/components/users/UserFormDialog";
import AgentDetailModal from "@/components/sales/AgentDetailModal";
import { apiClient } from "@/lib/api-client";


// Icons
import { SearchIcon, AddIcon, MyLocationIcon, RouteIcon, GridViewIcon, ViewListIcon, CalendarMonthIcon, FilterAltOffIcon, EditIcon, VisibilityIcon } from "@/components/icons";
import MenuItem from "@mui/material/MenuItem";

import { authService, SalesAgent } from "@/lib/auth-service";



export default function TeamPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [search, setSearch] = useState("");
  const [viewType, setViewType] = useState<"card" | "list">("list");
  const [agents, setAgents] = useState<any[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationAgentId, setLocationAgentId] = useState<number | null>(null);
  const [locationAgentName, setLocationAgentName] = useState("");
  const [dayRouteModalOpen, setDayRouteModalOpen] = useState(false);
  const [dayRouteAgentId, setDayRouteAgentId] = useState<number | null>(null);
  const [dayRouteAgentName, setDayRouteAgentName] = useState("");
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);
  const [editAgentModalOpen, setEditAgentModalOpen] = useState(false);
  const [editAgentData, setEditAgentData] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailAgent, setDetailAgent] = useState<any>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState<number | null>(null);
  const [targetAgentName, setTargetAgentName] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [salesManagers, setSalesManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper function to get full image URL
  const getImageUrl = (imagePath: string | null | undefined) => {
    if (!imagePath) return "";
    if (imagePath.startsWith("http")) return imagePath;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api/v1", "") || "http://localhost:8000";
    return `${baseUrl}${imagePath}`;
  };

  // New Filters State
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRangeType, setDateRangeType] = useState("all"); // all, today, last7, thisMonth, custom
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name, status, visits, orders, leads, revenue, attendance, joined
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        let params: any = { include_stats: "true" };

        const today = new Date();
        let apiStart = "";
        let apiEnd = today.toISOString().split('T')[0];

        if (dateRangeType === "today") {
          apiStart = apiEnd;
        } else if (dateRangeType === "last7") {
          const d = new Date();
          d.setDate(today.getDate() - 6);
          apiStart = d.toISOString().split('T')[0];
        } else if (dateRangeType === "thisMonth") {
          apiStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        } else if (dateRangeType === "custom") {
          if (startDate) apiStart = startDate;
          if (endDate) apiEnd = endDate;
        }

        if (apiStart) params.start_date = apiStart;
        if (apiEnd) params.end_date = apiEnd;

        const data = await authService.getAssignedSalesAgents(params);
        setAgents(data);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, [dateRangeType, startDate, endDate]);

  // Load current user and sales managers (for admin)
  useEffect(() => {
    const loadUser = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      // If admin, fetch all sales managers for assignment dropdown
      if (user?.role === "admin") {
        try {
          const res: any = await apiClient.get("/auth/users/", { role: "sales_manager", status: "Active" });
          const list = Array.isArray(res) ? res : res.results || [];
          setSalesManagers(list);
        } catch (err) {
          console.error("Failed to fetch sales managers:", err);
        }
      }
    };
    loadUser();
  }, []);

  const filteredAgents = React.useMemo(() => {
    let result = agents.filter((a) => {
      const name = (a.full_name || a.username).toLowerCase();
      const matchesSearch = name.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return result.sort((a, b) => {
      let comparison = 0;

      if (sortBy === "status") {
        comparison = (a.status || "").localeCompare(b.status || "");
      } else if (sortBy === "name") {
        comparison = (a.full_name || a.username).localeCompare(b.full_name || b.username);
      } else if (sortBy === "visits") {
        comparison = (a.total_visits || 0) - (b.total_visits || 0);
      } else if (sortBy === "orders") {
        comparison = (a.total_orders || 0) - (b.total_orders || 0);
      } else if (sortBy === "leads") {
        comparison = (a.total_leads || 0) - (b.total_leads || 0);
      } else if (sortBy === "revenue") {
        comparison = (a.total_revenue || 0) - (b.total_revenue || 0);
      } else if (sortBy === "attendance") {
        comparison = (a.average_attendance || 0) - (b.average_attendance || 0);
      } else if (sortBy === "joined") {
        comparison = new Date(a.date_joined).getTime() - new Date(b.date_joined).getTime();
      }

      return order === "asc" ? comparison : -comparison;
    });
  }, [agents, search, statusFilter, startDate, endDate, sortBy, order]);

  const handleRequestSort = (property: string) => {
    const isAsc = sortBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setSortBy(property);
  };

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateRangeType("all");
    setStartDate("");
    setEndDate("");
    setSortBy("name");
    setOrder("asc");
  };



  const handleLocationClick = (agent: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setLocationAgentId(agent.id);
    setLocationAgentName(agent.full_name || agent.username);
    setLocationModalOpen(true);
  };

  const handleDayRouteClick = (agent: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setDayRouteAgentId(agent.id);
    setDayRouteAgentName(agent.full_name || agent.username);
    setDayRouteModalOpen(true);
  };

  const handleSetTargetClick = (agent: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setTargetAgentId(agent.id);
    setTargetAgentName(agent.full_name || agent.username);
    setTargetModalOpen(true);
  };



  const handleDetailClick = (agent: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setDetailAgent(agent);
    setDetailModalOpen(true);
  };

  const handleEditClick = (agent: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditAgentData({
      id: agent.id,
      name: agent.full_name || agent.username,
      email: agent.email,
      phone: agent.phone || "",
      aadhaar_number: agent.aadhaar_number || "",
      pan_number: agent.pan_number || "",
      role: "Sales Agent",
      status: agent.status || "Active",
      operating_cities: (() => { try { const p = JSON.parse(agent.operating_city || "[]"); return Array.isArray(p) ? p : [agent.operating_city || ""]; } catch { return agent.operating_city ? [agent.operating_city] : []; } })(),
      tags: agent.tags || [],
      assignedTo: agent.assigned_to ? String(agent.assigned_to) : (currentUser ? String(currentUser.id) : ""),
      profile_image: agent.profile_image || null,
      aadhaar_card: agent.aadhaar_card || null,
      pan_card: agent.pan_card || null,
    });
    setEditAgentModalOpen(true);
  };

  const canEdit = currentUser && (currentUser.role === "admin" || currentUser.role === "sales_manager");

  // For admin: show all sales managers in the assignment dropdown
  // For sales manager: show only themselves
  const managersForForm = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "admin") {
      return salesManagers.filter((m: any) => m.status === "Active").map((m: any) => ({
        id: m.id,
        name: m.full_name || m.username,
        operating_city: m.operating_city || "",
      }));
    }
    return [{
      id: currentUser.id,
      name: currentUser.full_name || currentUser.username,
      operating_city: currentUser.operating_city || "",
    }];
  }, [currentUser, salesManagers]);

  const handleAgentCreated = async () => {
    // Refetch agents list
    try {
      setLoading(true);
      let params: any = { include_stats: "true" };

      const today = new Date();
      let apiStart = "";
      let apiEnd = today.toISOString().split('T')[0];

      if (dateRangeType === "today") {
        apiStart = apiEnd;
      } else if (dateRangeType === "last7") {
        const d = new Date();
        d.setDate(today.getDate() - 6);
        apiStart = d.toISOString().split('T')[0];
      } else if (dateRangeType === "thisMonth") {
        apiStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      } else if (dateRangeType === "custom") {
        if (startDate) apiStart = startDate;
        if (endDate) apiEnd = endDate;
      }

      if (apiStart) params.start_date = apiStart;
      if (apiEnd) params.end_date = apiEnd;

      const data = await authService.getAssignedSalesAgents(params);
      setAgents(data);
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewChange = (event: React.MouseEvent<HTMLElement>, nextView: string) => {
    if (nextView !== null) {
      setViewType(nextView as "card" | "list");
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* HEADER & FILTERS */}
        <Box sx={{ mb: 4 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={3}
          >
            <Box>
              <Typography
                variant="h4"
                fontWeight={800}
                sx={{ letterSpacing: "-0.02em", fontSize: { xs: '1.4rem', md: '2rem' } }}
              >
                Sales Team
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                Monitor agent performance, track field activities and manage roles.
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddAgentModalOpen(true)}
              sx={{
                borderRadius: "10px",
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.3)}`,
                px: 3,
                height: 40,
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Add Agent
            </Button>
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
              bgcolor: 'background.paper',
              boxShadow: '0 2px 12px rgba(0,0,0,0.03)'
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  placeholder="Search agents..."
                  size="small"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="primary" sx={{ opacity: 0.6 }} />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: 1.5 }
                  }}
                />
              </Grid>

              <Grid size={{ xs: 6, md: 1.5 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </TextField>
              </Grid>


              <Grid size={{ xs: 6, md: 2.2 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Date Range"
                  value={dateRangeType}
                  onChange={(e) => setDateRangeType(e.target.value)}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="last7">Last 7 Days</MenuItem>
                  <MenuItem value="thisMonth">This Month</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </TextField>
              </Grid>

              {dateRangeType === "custom" && (
                <>
                  <Grid size={{ xs: 6, md: 1.5 }}>
                    <TextField
                      fullWidth
                      type="date"
                      size="small"
                      label="From"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
                    />
                  </Grid>

                  <Grid size={{ xs: 6, md: 1.5 }}>
                    <TextField
                      fullWidth
                      type="date"
                      size="small"
                      label="To"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
                    />
                  </Grid>
                </>
              )}

              <Grid size="grow">
                <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                  {!isMobile && (
                    <ToggleButtonGroup
                      value={viewType}
                      exclusive
                      onChange={handleViewChange}
                      size="small"
                      sx={{ bgcolor: alpha(theme.palette.divider, 0.05), borderRadius: 1.5, height: 40 }}
                    >
                      <ToggleButton value="card" sx={{ px: 2, border: 'none', borderRadius: '8px !important' }}>
                        <GridViewIcon fontSize="small" />
                      </ToggleButton>
                      <ToggleButton value="list" sx={{ px: 2, border: 'none', borderRadius: '8px !important' }}>
                        <ViewListIcon fontSize="small" />
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}

                  <Tooltip title="Clear Filters">
                    <IconButton
                      onClick={handleClearFilters}
                      sx={{
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        borderRadius: 1.5,
                        width: 40,
                        height: 40,
                        bgcolor: 'background.paper',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.error.main, 0.05),
                          color: 'error.main',
                          borderColor: theme.palette.error.main,
                        },
                      }}
                    >
                      <FilterAltOffIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Box>

        {/* CONTENT */}
        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3].map((i) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={i}>
                <Skeleton variant="rectangular" height={380} sx={{ borderRadius: 1 }} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <AnimatePresence mode="wait">
            {(isMobile || viewType === "card") ? (
              <motion.div
                key="card-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <Grid container spacing={3}>
                  {filteredAgents.map((agent) => (
                    <Grid size={{ xs: 12, sm: 6, md: 6, lg: 4 }} key={agent.id}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          boxShadow: "0px 2px 12px rgba(0,0,0,0.03)",
                          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          position: "relative",
                          overflow: "hidden",
                          "&:hover": {
                            transform: "translateY(-2px)",
                            borderColor: alpha(theme.palette.primary.main, 0.2),
                            boxShadow: `0px 8px 20px ${alpha(theme.palette.primary.main, 0.05)}`,
                          },
                        }}
                      >
                        {/* Status */}
                        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                          <Chip
                            label={agent.status || "Active"}
                            size="small"
                            color={agent.status === "Active" ? "success" : "default"}
                            sx={{ fontWeight: 700, borderRadius: 1, height: 20, fontSize: '0.6rem' }}
                          />
                        </Box>

                        {/* Profile Section */}
                        <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                          <Avatar
                            src={getImageUrl(agent.profile_image)}
                            sx={{
                              width: 48,
                              height: 48,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              color: "primary.main",
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
                            }}
                          >
                            {agent.avatar}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
                              {agent.full_name || agent.username}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontWeight={500} display="block" noWrap sx={{ fontSize: '0.7rem' }}>
                              {agent.email}
                            </Typography>
                          </Box>
                        </Stack>

                        <Divider sx={{ mb: 1.5, opacity: 0.4 }} />

                        {/* Stats Grid */}
                        <Grid container spacing={1} mb={2}>
                          <Grid size={{ xs: 3 }}>
                            <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02), p: 1, borderRadius: 1.5 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ fontSize: '0.6rem' }}>Visits</Typography>
                              <Typography variant="subtitle2" fontWeight={800}>{agent.total_visits || 0}</Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 3 }}>
                            <Box sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.02), p: 1, borderRadius: 1.5 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ fontSize: '0.6rem' }}>Orders</Typography>
                              <Typography variant="subtitle2" fontWeight={800}>{agent.total_orders || 0}</Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 3 }}>
                            <Box sx={{ bgcolor: alpha(theme.palette.info.main, 0.02), p: 1, borderRadius: 1.5 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ fontSize: '0.6rem' }}>Leads</Typography>
                              <Typography variant="subtitle2" fontWeight={800}>{agent.total_leads || 0}</Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 3 }}>
                            <Box sx={{ bgcolor: alpha(theme.palette.success.main, 0.02), p: 1, borderRadius: 1.5 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ fontSize: '0.6rem' }}>Attend.</Typography>
                              <Typography variant="subtitle2" fontWeight={800}>{agent.average_attendance || 0}%</Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Revenue & Joining Info */}
                        <Box sx={{ mb: 1.5 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL REVENUE</Typography>
                            <Typography variant="subtitle2" fontWeight={800} color="primary.main">
                              ₹{(agent.total_revenue || 0).toLocaleString()}
                            </Typography>
                          </Stack>
                        </Box>

                        <Stack direction="row" spacing={1} alignItems="center" mt={2} color="text.disabled">
                          <CalendarMonthIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" fontWeight={600}>
                            Joined: {new Date(agent.date_joined).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} mt={2}>
                          <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            startIcon={<VisibilityIcon sx={{ fontSize: '1rem !important' }} />}
                            onClick={(e) => handleDetailClick(agent, e)}
                            sx={{
                              borderRadius: 1.5,
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              borderColor: alpha(theme.palette.success.main, 0.3),
                              color: 'success.main',
                              '&:hover': {
                                borderColor: theme.palette.success.main,
                                bgcolor: alpha(theme.palette.success.main, 0.05)
                              }
                            }}
                          >
                            Details
                          </Button>
                          {canEdit && (
                            <Button
                              fullWidth
                              variant="outlined"
                              size="small"
                              startIcon={<EditIcon sx={{ fontSize: '1rem !important' }} />}
                              onClick={(e) => handleEditClick(agent, e)}
                              sx={{
                                borderRadius: 1.5,
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                borderColor: alpha(theme.palette.warning.main, 0.3),
                                color: 'warning.main',
                                '&:hover': {
                                  borderColor: theme.palette.warning.main,
                                  bgcolor: alpha(theme.palette.warning.main, 0.05)
                                }
                              }}
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            startIcon={<MyLocationIcon sx={{ fontSize: '1rem !important' }} />}
                            onClick={(e) => handleLocationClick(agent, e)}
                            sx={{
                              borderRadius: 1.5,
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              borderColor: alpha(theme.palette.primary.main, 0.3),
                              '&:hover': {
                                borderColor: theme.palette.primary.main,
                                bgcolor: alpha(theme.palette.primary.main, 0.05)
                              }
                            }}
                          >
                            Location
                          </Button>
                          <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            startIcon={<RouteIcon sx={{ fontSize: '1rem !important' }} />}
                            onClick={(e) => handleDayRouteClick(agent, e)}
                            sx={{
                              borderRadius: 1.5,
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              borderColor: alpha(theme.palette.info.main, 0.3),
                              color: 'info.main',
                              '&:hover': {
                                borderColor: theme.palette.info.main,
                                bgcolor: alpha(theme.palette.info.main, 0.05)
                              }
                            }}
                          >
                            View Day Route
                          </Button>
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </motion.div>
            ) : (
              <motion.div
                key="list-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 1, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.5) }}>
                        <TableCell sx={{ fontWeight: 800, pl: 4 }}>
                          <TableSortLabel
                            active={sortBy === 'name'}
                            direction={sortBy === 'name' ? order : 'asc'}
                            onClick={() => handleRequestSort('name')}
                          >
                            AGENT
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>
                          <TableSortLabel
                            active={sortBy === 'visits'}
                            direction={sortBy === 'visits' ? order : 'asc'}
                            onClick={() => handleRequestSort('visits')}
                          >
                            VISITS
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>
                          <TableSortLabel
                            active={sortBy === 'orders'}
                            direction={sortBy === 'orders' ? order : 'asc'}
                            onClick={() => handleRequestSort('orders')}
                          >
                            ORDERS
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>
                          <TableSortLabel
                            active={sortBy === 'leads'}
                            direction={sortBy === 'leads' ? order : 'asc'}
                            onClick={() => handleRequestSort('leads')}
                          >
                            LEADS
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>
                          <TableSortLabel
                            active={sortBy === 'revenue'}
                            direction={sortBy === 'revenue' ? order : 'asc'}
                            onClick={() => handleRequestSort('revenue')}
                          >
                            REVENUE
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>
                          <TableSortLabel
                            active={sortBy === 'attendance'}
                            direction={sortBy === 'attendance' ? order : 'asc'}
                            onClick={() => handleRequestSort('attendance')}
                          >
                            ATTENDANCE
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>
                          <TableSortLabel
                            active={sortBy === 'joined'}
                            direction={sortBy === 'joined' ? order : 'asc'}
                            onClick={() => handleRequestSort('joined')}
                          >
                            JOINED
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 4, fontWeight: 800 }}>
                          <TableSortLabel
                            active={sortBy === 'status'}
                            direction={sortBy === 'status' ? order : 'asc'}
                            onClick={() => handleRequestSort('status')}
                          >
                            STATUS
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>ACTIONS</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredAgents.map((agent) => (
                        <TableRow key={agent.id} hover>
                          <TableCell sx={{ pl: 4 }}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar src={getImageUrl(agent.profile_image)} sx={{ width: 36, height: 36, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontWeight: 700, fontSize: '0.875rem' }}>
                                {agent.avatar}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700}>{agent.full_name || agent.username}</Typography>
                                <Typography variant="caption" color="text.secondary">{agent.email}</Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{agent.total_visits || 0}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{agent.total_orders || 0}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{agent.total_leads || 0}</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: 'primary.main' }}>
                            ₹{(agent.total_revenue || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight={700}>{agent.average_attendance || 0}%</Typography>
                              <LinearProgress variant="determinate" value={agent.average_attendance || 0} sx={{ width: 40, height: 4, borderRadius: 2 }} />
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
                            {new Date(agent.date_joined).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell align="right" sx={{ pr: 4 }}>
                            <Chip
                              label={agent.status || "Active"}
                              size="small"
                              variant="outlined"
                              color={agent.status === "Active" ? "success" : "default"}
                              sx={{ fontWeight: 700, borderRadius: 1.5 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={(e) => handleDetailClick(agent, e)}
                                  sx={{
                                    '&:hover': {
                                      bgcolor: alpha(theme.palette.success.main, 0.1)
                                    }
                                  }}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {canEdit && (
                                <Tooltip title="Edit Agent">
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    onClick={(e) => handleEditClick(agent, e)}
                                    sx={{
                                      '&:hover': {
                                        bgcolor: alpha(theme.palette.warning.main, 0.1)
                                      }
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="View Current Location">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => handleLocationClick(agent, e)}
                                  sx={{
                                    '&:hover': {
                                      bgcolor: alpha(theme.palette.primary.main, 0.1)
                                    }
                                  }}
                                >
                                  <MyLocationIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="View Day Route">
                                <IconButton
                                  size="small"
                                  color="secondary"
                                  onClick={(e) => handleDayRouteClick(agent, e)}
                                  sx={{
                                    '&:hover': {
                                      bgcolor: alpha(theme.palette.secondary.main, 0.1)
                                    }
                                  }}
                                >
                                  <RouteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </motion.div>
            )}
          </AnimatePresence>
        )
        }



        {/* Agent Location Modal */}
        {
          locationAgentId && (
            <AgentLocationModal
              open={locationModalOpen}
              onClose={() => setLocationModalOpen(false)}
              agentId={locationAgentId}
              agentName={locationAgentName}
            />
          )
        }

        {/* Agent Day Route Modal */}
        {
          dayRouteAgentId && (
            <AgentDayRouteModal
              open={dayRouteModalOpen}
              onClose={() => setDayRouteModalOpen(false)}
              agentId={dayRouteAgentId}
              agentName={dayRouteAgentName}
            />
          )
        }

        {/* Add Agent Modal */}
        {
          currentUser && (
            <UserFormDialog
              open={addAgentModalOpen}
              onClose={() => setAddAgentModalOpen(false)}
              onSubmit={async (userData, files) => {
                const formData = new FormData();
                formData.append("username", userData.email.split("@")[0]);
                formData.append("email", userData.email);
                formData.append("phone", userData.phone);
                formData.append("first_name", userData.name.split(" ")[0]);
                formData.append("last_name", userData.name.split(" ").slice(1).join(" ") || userData.name.split(" ")[0]);
                formData.append("full_name", userData.name);
                formData.append("role", "sales_agent");
                formData.append("status", userData.status);
                const agentCities: string[] = userData.operating_cities?.length > 0
                  ? userData.operating_cities
                  : (() => { try { const p = JSON.parse(currentUser.operating_city || "[]"); return Array.isArray(p) ? p : [currentUser.operating_city || ""]; } catch { return currentUser.operating_city ? [currentUser.operating_city] : []; } })();
                if (agentCities.length > 0) formData.append("operating_city", JSON.stringify(agentCities));
                formData.append("assigned_to", userData.assignedTo || String(currentUser.id || ""));
                if (userData.aadhaar_number) formData.append("aadhaar_number", userData.aadhaar_number);
                if (userData.pan_number) formData.append("pan_number", userData.pan_number);
                if (userData.tags && userData.tags.length > 0) formData.append("tags", JSON.stringify(userData.tags));
                if (files.profile) formData.append("profile_image", files.profile);
                if (files.aadhaar) formData.append("aadhaar_card", files.aadhaar);
                if (files.pan) formData.append("pan_card", files.pan);
                await apiClient.post("/auth/users/", formData);
                await handleAgentCreated();
              }}
              mode="ADD"
              restrictedMode={currentUser.role === "admin" ? undefined : "sales_agent_only"}
              currentUserRole={currentUser.role}
              currentUserCities={(() => { try { const p = JSON.parse(currentUser.operating_city || "[]"); return Array.isArray(p) ? p : [currentUser.operating_city || ""]; } catch { return currentUser.operating_city ? [currentUser.operating_city] : []; } })()}
              currentUserId={currentUser.id}
              availableManagers={managersForForm}
              roles={["Sales Agent"]}
            />
          )
        }

        {/* Edit Agent Modal */}
        {currentUser && editAgentData && (
          <UserFormDialog
            open={editAgentModalOpen}
            onClose={() => { setEditAgentModalOpen(false); setEditAgentData(null); }}
            onSubmit={async (userData, files) => {
              const formData = new FormData();
              formData.append("first_name", userData.name.split(" ")[0]);
              formData.append("last_name", userData.name.split(" ").slice(1).join(" ") || userData.name.split(" ")[0]);
              formData.append("full_name", userData.name);
              formData.append("email", userData.email);
              formData.append("phone", userData.phone);
              formData.append("status", userData.status);
              if (userData.assignedTo) formData.append("assigned_to", userData.assignedTo);
              if (userData.operating_cities?.length > 0) {
                formData.append("operating_city", JSON.stringify(userData.operating_cities));
              }
              if (userData.aadhaar_number) formData.append("aadhaar_number", userData.aadhaar_number);
              if (userData.pan_number) formData.append("pan_number", userData.pan_number);
              if (userData.tags && userData.tags.length > 0) formData.append("tags", JSON.stringify(userData.tags));
              if (files.profile) formData.append("profile_image", files.profile);
              if (files.aadhaar) formData.append("aadhaar_card", files.aadhaar);
              if (files.pan) formData.append("pan_card", files.pan);
              await apiClient.patch(`/auth/users/${editAgentData.id}/`, formData);
              setEditAgentModalOpen(false);
              setEditAgentData(null);
              await handleAgentCreated();
            }}
            mode="EDIT"
            initialData={editAgentData}
            restrictedMode={currentUser.role === "admin" ? undefined : "sales_agent_only"}
            currentUserRole={currentUser.role}
            currentUserCities={(() => { try { const p = JSON.parse(currentUser.operating_city || "[]"); return Array.isArray(p) ? p : [currentUser.operating_city || ""]; } catch { return currentUser.operating_city ? [currentUser.operating_city] : []; } })()}
            currentUserId={currentUser.id}
            availableManagers={managersForForm}
            roles={["Sales Agent"]}
          />
        )}

        {/* Agent Detail Modal */}
        <AgentDetailModal
          open={detailModalOpen}
          onClose={() => { setDetailModalOpen(false); setDetailAgent(null); }}
          agent={detailAgent}
          onEdit={canEdit && detailAgent ? () => {
            setDetailModalOpen(false);
            handleEditClick(detailAgent, { stopPropagation: () => {} } as React.MouseEvent);
          } : undefined}
        />

        {/* Set Target Modal */}
        <SetTargetModal
          open={targetModalOpen}
          onClose={() => setTargetModalOpen(false)}
          agentId={targetAgentId}
          agentName={targetAgentName}
        />
      </motion.div >
    </>
  );
}

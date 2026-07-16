"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Avatar,
  Chip,
  LinearProgress,
  IconButton,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TableHead,
  useTheme,
  alpha,
  CircularProgress,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  useMediaQuery,
  Tooltip,
} from "@mui/material";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, BarChart, Bar, Cell,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { analyticsService } from "@/lib/analytics-service";
import { salesService } from "@/lib/sales-service";
import { distributorService } from "@/lib/distributor-service";
import { exportDashboardReport } from "@/lib/export-service";
import { getFYDates, getLastFYDates } from "@/lib/accounts-api";
import { isAgentOnline } from "@/lib/agentStatus";
import { useChartPalette } from "@/components/admin/analytics/kit";

// Icons
import { TrendingUpIcon, TrendingDownIcon, DownloadIcon, CalendarTodayIcon, MonetizationOnIcon, PeopleAltIcon, AssignmentTurnedInIcon, ArrowForwardIcon, EmojiEventsIcon, DirectionsRunIcon, InventoryIcon, RefreshIcon, LocationOnIcon, ExitToAppIcon, CheckCircleOutlineIcon, CancelOutlinedIcon, WifiIcon } from "@/components/icons";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { formatTime, formatWorkingHours } from "@/lib/office-attendance-api";

// --- MOBILE VIEW TYPES & HELPERS ---

interface AgentRecord {
  agent_id: number;
  agent_name: string;
  record_id: number | null;
  punch_in_time: string | null;
  punch_out_time: string | null;
  working_hours: number;
  punch_out_type: "manual" | "auto" | null;
  checked_out_by_name: string | null;
  last_seen: string | null;
}

function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

// --- MOBILE SUB-COMPONENTS ---

function MobileStatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number | string; color: string; bg: string }) {
  return (
    <Box data-animate-group sx={{ flex: 1, borderRadius: "16px", p: 2, background: bg, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <Box sx={{ color, fontSize: 22 }}>{icon}</Box>
      <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color, opacity: 0.75, fontWeight: 600, textAlign: "center", fontSize: "0.68rem" }}>{label}</Typography>
    </Box>
  );
}

function MobileAgentCard({ agent, onCheckOut, onTrackLocation, checkingOut }: {
  agent: AgentRecord;
  onCheckOut: (id: number) => void;
  onTrackLocation: (id: number) => void;
  checkingOut: number | null;
}) {
  const theme = useTheme();
  const online = isAgentOnline(agent.last_seen);
  const present = Boolean(agent.punch_in_time);
  const done = Boolean(agent.punch_out_time);
  const color = avatarColor(agent.agent_id);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Box sx={{ borderRadius: "20px", background: theme.palette.background.paper, boxShadow: "0 2px 16px rgba(0,0,0,0.07)", border: `1px solid ${alpha(theme.palette.divider, 0.08)}`, overflow: "hidden" }}>
        <Box sx={{ height: 4, background: present ? (done ? alpha(theme.palette.text.disabled, 0.3) : `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`) : alpha(theme.palette.error.main, 0.3) }} />
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={1.5}>
            <Avatar sx={{ width: 44, height: 44, bgcolor: alpha(color, 0.15), color, fontWeight: 800, fontSize: "1rem" }}>
              {getInitials(agent.agent_name)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ lineHeight: 1.2 }}>{agent.agent_name}</Typography>
              <Stack direction="row" spacing={0.5} mt={0.4} flexWrap="wrap">
                <Chip label={!present ? "Absent" : done ? "Checked Out" : "Present"} size="small"
                  sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700,
                    bgcolor: !present ? alpha(theme.palette.error.main, 0.1) : done ? alpha(theme.palette.text.disabled, 0.1) : alpha(theme.palette.success.main, 0.12),
                    color: !present ? "error.main" : done ? "text.disabled" : "success.dark" }} />
                <Chip label={online ? "Online" : "Offline"} size="small"
                  sx={{ height: 18, fontSize: "0.6rem", fontWeight: 700,
                    bgcolor: online ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.text.disabled, 0.08),
                    color: online ? "success.dark" : "text.disabled" }} />
              </Stack>
            </Box>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Track Last Location">
                <IconButton size="small" onClick={() => onTrackLocation(agent.agent_id)}
                  sx={{ width: 34, height: 34, bgcolor: alpha(theme.palette.info.main, 0.1), color: "info.main", borderRadius: "10px", "&:hover": { bgcolor: alpha(theme.palette.info.main, 0.2) } }}>
                  <LocationOnIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              {present && !done ? (
                <Tooltip title="Force Check Out">
                  <span>
                    <IconButton size="small" disabled={checkingOut !== null}
                      onClick={() => agent.record_id && onCheckOut(agent.record_id)}
                      sx={{ width: 34, height: 34, bgcolor: alpha(theme.palette.warning.main, 0.1), color: "warning.dark", borderRadius: "10px", "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.2) } }}>
                      {checkingOut === agent.record_id ? <CircularProgress size={14} color="inherit" /> : <ExitToAppIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <Box sx={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography variant="caption" color="text.disabled">—</Typography>
                </Box>
              )}
            </Stack>
          </Stack>
          <Divider sx={{ mb: 1.5, opacity: 0.5 }} />
          <Stack direction="row" spacing={2}>
            {[
              { label: "Punch In", value: formatTime(agent.punch_in_time) || "—", color: present ? "success.dark" : "text.disabled" },
              { label: "Punch Out", value: formatTime(agent.punch_out_time) || "—", color: done ? "error.main" : "text.disabled" },
              { label: "Hours", value: agent.working_hours ? formatWorkingHours(agent.working_hours) : "—", color: "text.primary" },
            ].map(({ label, value, color }) => (
              <Box key={label} sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color, mt: 0.2 }}>{value}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </motion.div>
  );
}

// --- COMPONENTS ---

const KPI_CARD = ({ title, value, subtext, trend, color, icon }: any) => {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        bgcolor: "background.paper",
        boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.2s",
        "&:hover": { transform: "translateY(-4px)" },
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        mb={2}
      >
        <Avatar
          variant="rounded"
          sx={{
            bgcolor: alpha(color, 0.1),
            color: color,
            width: 48,
            height: 48,
            borderRadius: 1,
          }}
        >
          {icon}
        </Avatar>
        {trend !== undefined && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{
              bgcolor: alpha(
                trend > 0 ? theme.palette.success.main : theme.palette.error.main,
                0.1
              ),
              px: 1,
              py: 0.5,
              borderRadius: 2,
            }}
          >
            {trend > 0 ? (
              <TrendingUpIcon fontSize="small" color="success" />
            ) : (
              <TrendingDownIcon fontSize="small" color="error" />
            )}
            <Typography
              variant="caption"
              fontWeight={700}
              color={trend > 0 ? "success.main" : "error.main"}
            >
              {Math.abs(trend)}%
            </Typography>
          </Stack>
        )}
      </Stack>
      <Typography
        variant="h5"
        fontWeight={800}
        sx={{ color: "text.primary", mb: 0.5 }}
      >
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.disabled">
        {subtext}
      </Typography>
    </Paper>
  );
};

export default function SalesManagerDashboard() {
  const theme = useTheme();
  const cp = useChartPalette();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // --- Mobile view state ---
  const today = toDateString(new Date());
  const [mobileAgents, setMobileAgents] = useState<AgentRecord[]>([]);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [mobileRefreshing, setMobileRefreshing] = useState(false);
  const [checkingOut, setCheckingOut] = useState<number | null>(null);

  const fetchMobileAgents = useCallback(async (silent = false) => {
    if (!silent) setMobileLoading(true);
    else setMobileRefreshing(true);
    try {
      const data = await apiClient.get<AgentRecord[]>(`/field-sales/admin-attendance/?date=${today}`);
      setMobileAgents(Array.isArray(data) ? data : []);
    } catch { setMobileAgents([]); }
    finally { setMobileLoading(false); setMobileRefreshing(false); }
  }, [today]);

  useEffect(() => { if (isMobile) fetchMobileAgents(); }, [isMobile, fetchMobileAgents]);
  useEffect(() => {
    if (!isMobile) return;
    const id = setInterval(() => fetchMobileAgents(true), 30000);
    return () => clearInterval(id);
  }, [isMobile, fetchMobileAgents]);

  const handleMobileCheckOut = async (recordId: number) => {
    setCheckingOut(recordId);
    try { await apiClient.post(`/field-sales/admin-checkout/${recordId}/`, {}); await fetchMobileAgents(true); }
    finally { setCheckingOut(null); }
  };

  const handleTrackLocation = async (agentId: number) => {
    try {
      const data = await apiClient.get<{ latitude: number; longitude: number }>(`/field-sales/daily-reports/current-location/?agent_id=${agentId}`);
      if (data?.latitude && data?.longitude) window.open(`https://maps.google.com/?q=${data.latitude},${data.longitude}`, "_blank");
      else toast.error("No live location available for this agent.");
    } catch {
      toast.error("Couldn't fetch the agent's location.");
    }
  };

  const mobilePresent = mobileAgents.filter((a) => a.punch_in_time).length;
  const mobileAbsent = mobileAgents.length - mobilePresent;
  const mobileOnline = mobileAgents.filter((a) => isAgentOnline(a.last_seen)).length;
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  // --- Desktop view state ---
  const [range, setRange] = useState("This Month");
  const [loading, setLoading] = useState(true);

  // Data States
  const [salesOverview, setSalesOverview] = useState<any>(null);
  const [crmAnalytics, setCrmAnalytics] = useState<any>(null);
  const [fieldSalesAnalytics, setFieldSalesAnalytics] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [backorders, setBackorders] = useState<any[]>([]);
  const [stockRequests, setStockRequests] = useState<any[]>([]);
  const [leaderboardAgents, setLeaderboardAgents] = useState<any[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Leaderboard independent month filter (defaults to current month)
  const currentMonthStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();
  const [leaderboardMonth, setLeaderboardMonth] = useState(currentMonthStr);

  // Generate last 12 months options
  const monthOptions = (() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      opts.push({ value, label });
    }
    return opts;
  })();

  // Pagination States
  const [leaderboardPage, setLeaderboardPage] = useState(0);
  const [leaderboardRowsPerPage, setLeaderboardRowsPerPage] = useState(10);

  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);

  const [requestsPage, setRequestsPage] = useState(0);
  const [requestsRowsPerPage, setRequestsRowsPerPage] = useState(10);
  const [totalRequests, setTotalRequests] = useState(0);

  // Export Dialog State
  const todayStr = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStart, setExportStart] = useState(firstOfMonth);
  const [exportEnd, setExportEnd] = useState(todayStr);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = { order_date__gte: exportStart, order_date__lte: exportEnd, page_size: '1000' };
      const reqParams = { request_date__gte: exportStart, request_date__lte: exportEnd, page_size: '1000' };

      const [exportOrders, exportRequests, exportField] = await Promise.all([
        salesService.getSalesOrders(params) as any,
        distributorService.getStockRequests(reqParams) as any,
        analyticsService.getFieldSalesAnalytics({}) as any,
      ]);

      exportDashboardReport(
        salesOverview,
        crmAnalytics,
        exportField,
        exportOrders?.results || exportOrders || [],
        exportRequests?.results || exportRequests || [],
        { startDate: exportStart, endDate: exportEnd }
      );
      setExportOpen(false);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // For FY-based ranges pass explicit dates so backend uses fiscal boundaries
      let params: Record<string, string> = { range };
      if (range === 'This Year (FY)') {
        const fy = getFYDates();
        params = { from_date: fy.from_date, to_date: fy.to_date };
      } else if (range === 'Last Year (FY)') {
        const fy = getLastFYDates();
        params = { from_date: fy.from_date, to_date: fy.to_date };
      }

      const [salesData, crmData, backordersData] = await Promise.all([
        analyticsService.getSalesOverview(params),
        analyticsService.getCRMAnalytics(params),
        salesService.getBackorderedOrders(),
      ]);

      setSalesOverview(salesData);
      setCrmAnalytics(crmData);
      // @ts-ignore
      setBackorders(backordersData || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboardData = async () => {
    try {
      setLeaderboardLoading(true);
      const fieldData = await analyticsService.getFieldSalesAnalytics({ month: leaderboardMonth });
      // @ts-ignore
      setLeaderboardAgents(fieldData?.overview?.agent_performance || []);
      // Also keep fieldSalesAnalytics for visit stats if needed
      setFieldSalesAnalytics(fieldData);
    } catch (error) {
      console.error("Failed to fetch leaderboard data:", error);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const getDateRangeParams = () => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const todayStr = fmt(today);

    if (range === 'Today') {
      return { gte: todayStr, lte: todayStr };
    } else if (range === 'This Week') {
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      return { gte: fmt(monday), lte: todayStr };
    } else if (range === 'This Quarter') {
      const quarter = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), quarter * 3, 1);
      return { gte: fmt(start), lte: todayStr };
    } else if (range === 'This Year (FY)') {
      const fy = getFYDates();
      return { gte: fy.from_date, lte: fy.to_date };
    } else if (range === 'Last Year (FY)') {
      const fy = getLastFYDates();
      return { gte: fy.from_date, lte: fy.to_date };
    } else {
      // Default: This Month
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { gte: fmt(start), lte: todayStr };
    }
  };

  const fetchOrders = async () => {
    try {
      const { gte, lte } = getDateRangeParams();
      const ordersData = await salesService.getSalesOrders({
        page: (ordersPage + 1).toString(),
        page_size: ordersRowsPerPage.toString(),
        order_date__gte: gte,
        order_date__lte: lte,
      });
      // @ts-ignore
      setRecentOrders(ordersData.results || []);
      // @ts-ignore
      setTotalOrders(ordersData.count || 0);
    } catch (error) {
      console.error("Failed to fetch recent orders:", error);
    }
  };

  const fetchRequests = async () => {
    try {
      const { gte, lte } = getDateRangeParams();
      const requestsData = await distributorService.getStockRequests({
        request_date__gte: gte,
        request_date__lte: lte,
        page: (requestsPage + 1).toString(),
        page_size: requestsRowsPerPage.toString()
      });
      // @ts-ignore
      setStockRequests(requestsData.results || []);
      // @ts-ignore
      setTotalRequests(requestsData.count || 0);
    } catch (error) {
      console.error("Failed to fetch stock requests:", error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [range]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [leaderboardMonth]);

  useEffect(() => {
    setLeaderboardPage(0);
  }, [leaderboardMonth]);

  useEffect(() => {
    fetchOrders();
    setLoading(false);
  }, [ordersPage, ordersRowsPerPage, range]);

  useEffect(() => {
    fetchRequests();
    setLoading(false);
  }, [requestsPage, requestsRowsPerPage, range]);

  // Reset table pages when range changes
  useEffect(() => {
    setOrdersPage(0);
    setRequestsPage(0);
  }, [range]);

  // ── Mobile view ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <Box sx={{ maxWidth: 520, mx: "auto", px: { xs: 1.5, sm: 2 }, pb: 6, pt: 1 }}>
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2.5}>
            <Box>
              <Typography variant="h5" fontWeight={800} lineHeight={1.1}>My Team</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>{dateLabel}</Typography>
            </Box>
            <IconButton onClick={() => fetchMobileAgents(true)} disabled={mobileRefreshing || mobileLoading}
              sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08), borderRadius: "12px", "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.15) } }}>
              <RefreshIcon fontSize="small" sx={{ color: "primary.main", transition: "transform 0.4s", transform: mobileRefreshing ? "rotate(360deg)" : "none" }} />
            </IconButton>
          </Stack>

          {/* Stats */}
          <Stack direction="row" spacing={1.5} mb={3}>
            <MobileStatCard icon={<CheckCircleOutlineIcon fontSize="inherit" />} label="Present" value={mobileLoading ? "—" : mobilePresent} color={theme.palette.success.main} bg="linear-gradient(135deg, #f0fdf4, #dcfce7)" />
            <MobileStatCard icon={<CancelOutlinedIcon fontSize="inherit" />} label="Absent" value={mobileLoading ? "—" : mobileAbsent} color={theme.palette.error.main} bg="linear-gradient(135deg, #fff7f7, #fee2e2)" />
            <MobileStatCard icon={<WifiIcon fontSize="inherit" />} label="Online" value={mobileLoading ? "—" : mobileOnline} color={theme.palette.info.main} bg="linear-gradient(135deg, #eff6ff, #dbeafe)" />
          </Stack>

          {/* Agent count */}
          {!mobileLoading && (
            <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
              <PeopleAltIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {mobileAgents.length} agent{mobileAgents.length !== 1 ? "s" : ""}
              </Typography>
            </Stack>
          )}

          {/* Agent cards */}
          {mobileLoading ? (
            <Stack alignItems="center" py={8}><CircularProgress size={36} /><Typography variant="body2" color="text.secondary" mt={2}>Loading team…</Typography></Stack>
          ) : mobileAgents.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8, borderRadius: "20px", bgcolor: alpha(theme.palette.text.primary, 0.03), border: `1px dashed ${alpha(theme.palette.divider, 0.3)}` }}>
              <PeopleAltIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography color="text.disabled" fontWeight={600}>No agents assigned to you</Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              <AnimatePresence>
                {mobileAgents.map((agent) => (
                  <MobileAgentCard key={agent.agent_id} agent={agent} onCheckOut={handleMobileCheckOut} onTrackLocation={handleTrackLocation} checkingOut={checkingOut} />
                ))}
              </AnimatePresence>
            </Stack>
          )}
        </Box>
      </>
    );
  }

  // ── Desktop loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  // Process Pipeline Data
  const pipelineStages = [
    { name: "Total Leads", value: crmAnalytics?.leads_funnel?.total || 0, color: theme.palette.text.disabled },
    { name: "Qualified", value: crmAnalytics?.leads_funnel?.qualified || 0, color: cp.info },
    { name: "Converted", value: crmAnalytics?.leads_funnel?.converted || 0, color: cp.success },
  ];

  return (
    <React.Fragment>
      
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* 1. WELCOME & CONTROLS */}
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems="center"
            mb={4}
            spacing={2}
          >
            <Box>
              <Typography
                variant="h4"
                fontWeight={800}
                sx={{ letterSpacing: "-0.02em" }}
              >
                Sales Overview
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Track team performance and pipeline health.
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                sx={{
                  minWidth: 150,
                  '& .MuiOutlinedInput-root': {
                    height: 40,
                    borderRadius: '10px',
                  },
                  '& .MuiSelect-select': {
                    py: '0 !important',
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiInputBase-input': {
                    py: '0 !important',
                    height: '40px !important',
                    display: 'flex',
                    alignItems: 'center',
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <CalendarTodayIcon
                      fontSize="small"
                      color="action"
                      sx={{ mr: 1 }}
                    />
                  ),
                }}
              >
                <MenuItem value="Today">Today</MenuItem>
                <MenuItem value="This Week">This Week</MenuItem>
                <MenuItem value="This Month">This Month</MenuItem>
                <MenuItem value="This Quarter">This Quarter</MenuItem>
                <MenuItem value="This Year (FY)">This Year (FY)</MenuItem>
                <MenuItem value="Last Year (FY)">Last Year (FY)</MenuItem>
              </TextField>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => setExportOpen(true)}
                sx={{
                  borderRadius: "10px",
                  height: 40,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                }}
              >
                Export Report
              </Button>
            </Stack>
          </Stack>

          {/* 2. KPI CARDS */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(1, 1fr)",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
                lg: "repeat(6, 1fr)",
              },
              gap: 3,
              mb: 4,
            }}
          >
            <KPI_CARD
              title="Total Revenue"
              value={`₹${(salesOverview?.overview?.total_sales_value || 0).toLocaleString()}`}
              // trend={12.5} 
              subtext={`₹${(salesOverview?.overview?.month_sales_value || 0).toLocaleString()} this period`}
              color={theme.palette.primary.main}
              icon={<MonetizationOnIcon />}
            />
            <KPI_CARD
              title="New Leads"
              value={crmAnalytics?.leads_funnel?.open || 0}
              // trend={5.2}
              subtext={`Total: ${crmAnalytics?.leads_funnel?.total || 0}`}
              color={theme.palette.info.main}
              icon={<PeopleAltIcon />}
            />
            <KPI_CARD
              title="Converted Deals"
              value={crmAnalytics?.leads_funnel?.converted || 0}
              // trend={-2.4}
              subtext={`Win Rate: ${crmAnalytics?.leads_funnel?.conversion_rate || 0}%`}
              color={theme.palette.success.main}
              icon={<EmojiEventsIcon />}
            />
            <KPI_CARD
              title="New Orders"
              value={salesOverview?.overview?.pending_orders_count || 0}
              // trend={8.1}
              subtext={`Value: ₹${(salesOverview?.overview?.pending_orders_value || 0).toLocaleString()}`}
              color={theme.palette.secondary.main}
              icon={<AssignmentTurnedInIcon />}
            />
            <KPI_CARD
              title="Visits"
              value={fieldSalesAnalytics?.overview?.completed_visits || 0}
              subtext={`Total: ${fieldSalesAnalytics?.overview?.total_visits || 0}`}
              color={theme.palette.warning.main}
              icon={<DirectionsRunIcon />}
            />
            <KPI_CARD
              title="Backordered"
              value={backorders.length || 0}
              subtext="Items to fulfill"
              color={theme.palette.error.main}
              icon={<InventoryIcon />}
            />
          </Box>

          {/* 3. CHARTS SECTION */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
              gap: 3,
              mb: 4,
            }}
          >
            {/* Revenue Chart */}
            <Paper
              sx={{
                p: 3,
                height: 420,
                boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={3}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Revenue Forecast
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Actual Performance Trend
                  </Typography>
                </Box>
              </Stack>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={salesOverview?.overview?.sales_trend || []}>
                  <defs>
                    <linearGradient
                      id="colorActual"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={theme.palette.primary.main}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={theme.palette.primary.main}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={alpha(theme.palette.divider, 0.1)}
                  />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={theme.palette.primary.main}
                    fillOpacity={1}
                    fill="url(#colorActual)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>

            {/* Pipeline Funnel */}
            <Paper
              sx={{
                p: 3,
                height: 420,
                boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
              }}
            >
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Lead Funnel
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={4}>
                Leads by Stage
              </Typography>

              <ResponsiveContainer width="100%" height="60%">
                <BarChart
                  layout="vertical"
                  data={pipelineStages}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip cursor={{ fill: "transparent" }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                    {pipelineStages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Box>

          {/* 4. TEAM & ORDERS */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 3,
            }}
          >
            {/* Team Leaderboard */}
            <Paper
              sx={{
                boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <Box
                sx={{
                  p: 3,
                  borderBottom: `1px solid ${alpha(
                    theme.palette.divider,
                    0.1
                  )}`,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Team Leaderboard
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Progress towards quota
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.8,
                      px: 1.5,
                      py: 0.6,
                      borderRadius: '10px',
                      border: `1.5px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        borderColor: alpha(theme.palette.primary.main, 0.4),
                      },
                    }}
                  >
                    <CalendarTodayIcon sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />
                    <TextField
                      select
                      value={leaderboardMonth}
                      onChange={(e) => setLeaderboardMonth(e.target.value)}
                      variant="standard"
                      InputProps={{ disableUnderline: true }}
                      SelectProps={{
                        MenuProps: {
                          PaperProps: {
                            sx: {
                              borderRadius: 2,
                              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                              mt: 1,
                            }
                          }
                        }
                      }}
                      sx={{
                        minWidth: 140,
                        '& .MuiInputBase-root': {
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'primary.main',
                          cursor: 'pointer',
                        },
                        '& .MuiSelect-select': { py: 0 },
                        '& .MuiSvgIcon-root': { color: 'primary.main' },
                      }}
                    >
                      {monthOptions.map((opt) => (
                        <MenuItem
                          key={opt.value}
                          value={opt.value}
                          sx={{
                            fontSize: '0.85rem',
                            fontWeight: opt.value === leaderboardMonth ? 700 : 400,
                            color: opt.value === leaderboardMonth ? 'primary.main' : 'text.primary',
                            bgcolor: opt.value === leaderboardMonth ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.06),
                            },
                            borderRadius: 1,
                            mx: 0.5,
                            my: 0.2,
                          }}
                        >
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Button
                    component={Link}
                    href="/sales-targets"
                    endIcon={<ArrowForwardIcon />}
                    size="small"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      borderRadius: '8px',
                      px: 1.5,
                      color: 'text.secondary',
                      '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.06) },
                    }}
                  >
                    View All
                  </Button>
                </Stack>
              </Box>
              <TableContainer sx={{ flexGrow: 1 }}>
                <Table>
                  <TableBody>
                    {leaderboardLoading ? (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 5 }}>
                          <CircularProgress size={28} />
                        </TableCell>
                      </TableRow>
                    ) : !leaderboardAgents.length ? (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 5 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">
                              No team performance data available for this period.
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaderboardAgents
                        .slice(leaderboardPage * leaderboardRowsPerPage, leaderboardPage * leaderboardRowsPerPage + leaderboardRowsPerPage)
                        .map((agent: any, index: number) => (
                          <TableRow key={agent.id} hover>
                            <TableCell>
                              <Stack
                                direction="row"
                                spacing={2}
                                alignItems="center"
                              >
                                <Box sx={{ position: "relative" }}>
                                  <Avatar
                                    sx={{
                                      width: 40,
                                      height: 40,
                                      bgcolor:
                                        index === 0
                                          ? "secondary.main"
                                          : alpha(theme.palette.primary.main, 0.1),
                                      color: index === 0 ? "white" : "primary.main",
                                    }}
                                  >
                                    {agent.avatar || agent.name.charAt(0)}
                                  </Avatar>
                                  {index === 0 && (
                                    <Box
                                      sx={{
                                        position: "absolute",
                                        top: -5,
                                        right: -5,
                                        bgcolor: "gold",
                                        borderRadius: "50%",
                                        p: 0.2,
                                      }}
                                    >
                                      <EmojiEventsIcon sx={{ fontSize: 14 }} />
                                    </Box>
                                  )}
                                </Box>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={700}>
                                    {agent.name}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {agent.role}
                                  </Typography>
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ width: "40%" }}>
                              <Stack spacing={0.5}>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="caption" fontWeight={600}>
                                    ₹{agent.sales.toLocaleString()}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {agent.progress}%
                                  </Typography>
                                </Stack>
                                <LinearProgress
                                  variant="determinate"
                                  value={agent.progress}
                                  color={
                                    agent.progress >= 100
                                      ? "success"
                                      : agent.progress > 50
                                        ? "primary"
                                        : "warning"
                                  }
                                  sx={{ borderRadius: 2, height: 6 }}
                                />
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={leaderboardAgents.length}
                page={leaderboardPage}
                onPageChange={(e, newPage) => setLeaderboardPage(newPage)}
                rowsPerPage={leaderboardRowsPerPage}
                rowsPerPageOptions={[10, 25, 50]}
                onRowsPerPageChange={(e) => {
                  setLeaderboardRowsPerPage(parseInt(e.target.value, 10));
                  setLeaderboardPage(0);
                }}
              />
            </Paper>

            {/* Pending Stock Requests */}
            <Paper
              sx={{
                boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <Box
                sx={{
                  p: 3,
                  borderBottom: `1px solid ${alpha(
                    theme.palette.divider,
                    0.1
                  )}`,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Distributor Stock Requests
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending requests needing approval
                  </Typography>
                </Box>
                <Button component={Link} href="/stock-requests" endIcon={<ArrowForwardIcon />} size="small">
                  View All
                </Button>
              </Box>
              <TableContainer sx={{ flexGrow: 1 }}>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>REQUEST</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>DISTRIBUTOR</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>ITEMS</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stockRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <InventoryIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">
                              No pending stock requests found.
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockRequests.slice(0, requestsRowsPerPage).map((request) => (
                        <TableRow key={request.id} hover>
                          <TableCell
                            sx={{ fontFamily: "monospace", fontWeight: 600 }}
                          >
                            {request.request_number}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {request.distributor_name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(request.request_date).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {request.items?.length || 0}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={request.status || "Pending"}
                              size="small"
                              color={
                                request.status === "approved" ? "success"
                                  : request.status === "pending" ? "warning"
                                    : "default"
                              }
                              sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: "0.7rem", textTransform: 'capitalize' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalRequests}
                page={requestsPage}
                onPageChange={(e, newPage) => setRequestsPage(newPage)}
                rowsPerPage={requestsRowsPerPage}
                rowsPerPageOptions={[10, 25, 50]}
                onRowsPerPageChange={(e) => {
                  setRequestsRowsPerPage(parseInt(e.target.value, 10));
                  setRequestsPage(0);
                }}
              />
            </Paper>
          </Box>

          {/* 5. RECENT SALES ORDERS FULL WIDTH */}
          <Box sx={{ mt: 3 }}>
            <Paper
              sx={{
                boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <Box
                sx={{
                  p: 3,
                  borderBottom: `1px solid ${alpha(
                    theme.palette.divider,
                    0.1
                  )}`,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    Recent Sales Orders
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Transactions needing attention
                  </Typography>
                </Box>
                <Button component={Link} href="/sales-orders" endIcon={<ArrowForwardIcon />} size="small">
                  View All
                </Button>
              </Box>
              <TableContainer sx={{ flexGrow: 1 }}>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}
                    >
                      <TableCell sx={{ pl: 4, fontWeight: 700 }}>ORDER NO.</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>DISTRIBUTOR / AGENT</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>CUSTOMER</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>SUBTOTAL</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>TAX</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>DISCOUNT</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>ADVANCE</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>DELIVERY</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>PAYMENT</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <AssignmentTurnedInIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">
                              No recent sales orders found.
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentOrders.slice(0, ordersRowsPerPage).map((order) => (
                        <TableRow key={order.id} hover>
                          <TableCell
                            sx={{ pl: 4, fontFamily: "monospace", fontWeight: 600 }}
                          >
                            {order.order_number}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.distributor_name || '-'}</Typography>
                            <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 500, display: 'block' }}>
                              {order.assigned_agent_name ? `Agent: ${order.assigned_agent_name}` : 'No Agent'}
                            </Typography>
                          </TableCell>
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
                          <TableCell>
                            <Typography variant="body2" fontWeight={800} color="primary.main">
                              ₹{Number(order.total).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={order.fulfillment_status}
                              size="small"
                              color={
                                order.fulfillment_status === "delivered" ? "success"
                                  : order.fulfillment_status === "rejected" ? "error"
                                    : "warning"
                              }
                              sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: "0.7rem", textTransform: 'capitalize' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={order.payment_status}
                              size="small"
                              color={
                                order.payment_status === "paid" ? "success"
                                  : order.payment_status === "unpaid" ? "error"
                                    : "warning"
                              }
                              sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: "0.7rem", textTransform: 'capitalize' }}
                            />
                          </TableCell>
                        </TableRow>
                      )))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalOrders}
                page={ordersPage}
                onPageChange={(e, newPage) => setOrdersPage(newPage)}
                rowsPerPage={ordersRowsPerPage}
                rowsPerPageOptions={[10, 25, 50]}
                onRowsPerPageChange={(e) => {
                  setOrdersRowsPerPage(parseInt(e.target.value, 10));
                  setOrdersPage(0);
                }}
              />
            </Paper>
          </Box>
        </motion.div>
      

      {/* ─── Export Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={exportOpen}
        onClose={() => !exporting && setExportOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
          }
        }}
      >
        {/* Header */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            px: 3, py: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <DownloadIcon sx={{ color: '#fff', fontSize: 22 }} />
          <Box>
            <Typography variant="h6" fontWeight={700} color="#fff">
              Export Dashboard Report
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
              Select a date range to generate the Excel report
            </Typography>
          </Box>
        </Box>

        <DialogContent sx={{ pt: 3, pb: 1 }}>
          {/* Date Range Pickers */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
            <TextField
              label="From Date"
              type="date"
              value={exportStart}
              onChange={(e) => setExportStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              inputProps={{ max: exportEnd }}
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              label="To Date"
              type="date"
              value={exportEnd}
              onChange={(e) => setExportEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              inputProps={{ min: exportStart, max: todayStr }}
              size="small"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {/* Sheet Preview */}
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Sheets included in this report
          </Typography>
          <Stack spacing={1} mt={1.5}>
            {[
              { icon: '📊', label: 'KPI Summary', desc: 'Revenue, orders, leads, visits, win rate' },
              { icon: '📦', label: 'Sales Orders', desc: `Orders from ${exportStart} to ${exportEnd}` },
              { icon: '🏭', label: 'Stock Requests', desc: `Distributor requests for the selected period` },
              { icon: '🏆', label: 'Team Leaderboard', desc: 'Agent-wise sales, visits, progress %' },
            ].map((sheet) => (
              <Box
                key={sheet.label}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  p: 1.5, borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <Typography fontSize={18}>{sheet.icon}</Typography>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{sheet.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{sheet.desc}</Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 1 }}>
          <Button
            onClick={() => setExportOpen(false)}
            disabled={exporting}
            variant="outlined"
            sx={{ borderRadius: 2, px: 3, fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || !exportStart || !exportEnd}
            variant="contained"
            startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            sx={{
              borderRadius: 2, px: 3, fontWeight: 700,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              '&:hover': {
                background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
              }
            }}
          >
            {exporting ? 'Generating...' : 'Download Excel'}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment >
  );
}

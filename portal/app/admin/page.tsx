"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Grid, Typography, Paper, Stack, Avatar, Divider, Chip, useTheme, alpha,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Tooltip, IconButton, MenuItem, TextField, CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, BarChart, Bar, PieChart, Pie, Cell, Legend, ComposedChart, Line,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { toast } from "sonner";

import { CurrencyRupeeIcon, PeopleAltIcon, ShoppingBagIcon, InventoryIcon, PlaceIcon, CheckCircleIcon, PersonAddIcon, WarningAmberIcon, LocalShippingIcon, FactoryIcon, AssessmentIcon, StorefrontIcon, GroupsIcon, RefreshIcon } from "@/components/icons";


import { analyticsService } from "@/lib/analytics-service";
import {
  fmt, fmtFull, useChartPalette,
  StatCard, SectionHeader, StatPills, ParetoChart, HeatCell,
  ChartTooltipContent, EmptyRow,
} from "@/components/admin/analytics/kit";

// ── Types ─────────────────────────────────────────────────────────────
interface KpiMetric {
  value: number; change?: number; fy_total?: number; completed?: number;
  today?: number; today_done?: number; rate?: number; present?: number;
  total?: number; field?: number; office?: number;
}
interface DashboardData {
  kpis: {
    total_revenue: KpiMetric; primary_revenue: KpiMetric; secondary_revenue: KpiMetric;
    orders: KpiMetric; stock_requests: KpiMetric; new_clients: KpiMetric;
    visits: KpiMetric; leads: KpiMetric; attendance: KpiMetric; outstanding: number;
  };
  revenue_trend: { month: string; primary: number; secondary: number; total: number }[];
  revenue_split: { primary: number; secondary: number };
  sales_by_area: { area: string; primary: number; secondary: number }[];
  sales_by_distributor: { name: string; city: string; total: number }[];
  sales_by_product: { name: string; primary: number; secondary: number }[];
  agent_performance: {
    id: number; name: string; city: string;
    secondary_sales: number; primary_sales: number; total_sales: number;
    visits: number; orders: number; new_clients: number;
  }[];
  distributor_performance: {
    id: number; name: string; city: string;
    requests: number; primary_revenue: number; secondary_sales: number; total_clients: number;
  }[];
  visits_by_area: { area: string; total: number; completed: number }[];
  leads_by_status: { status: string; count: number }[];
  leads_by_area: { area: string; count: number }[];
  product_by_area: { area: string; products: { product: string; total: number; qty: number }[] }[];
  attendance_trend: { day: string; date: string; field: number; office: number; total: number }[];
  production: { work_orders_total: number; work_orders_in_progress: number; work_orders_completed: number; active_plans: number };
  purchase: { pending_pos: number; approved_value: number; approved_count: number; pending_mrs: number };
  warehouse: {
    total_products: number; low_stock: number; inventory_value: number;
    product_inventory: { name: string; stock: number; threshold: number; value: number; status: string }[];
    low_stock_alerts: { name: string; sku: string; stock: number; threshold: number }[];
  };
  available_cities: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────
/** Check if a comma-separated city string includes the filter city */
const cityMatch = (cityStr: string, filter: string) => {
  if (!filter) return true;
  return cityStr.split(",").map(c => c.trim().toLowerCase()).includes(filter.toLowerCase());
};

/** Filter area-based array by area name */
const areaMatch = (area: string, filter: string) => {
  if (!filter) return true;
  return area.trim().toLowerCase() === filter.toLowerCase();
};

// ── Reusable Components ──────────────────────────────────────────────
/** Backward-compatible section header — supports optional pills/actions/icon. */
const SectionTitle = ({ title, subtitle, pills, actions, icon, color }: {
  title: string; subtitle?: string;
  pills?: React.ComponentProps<typeof StatPills>["items"];
  actions?: React.ReactNode; icon?: React.ReactNode; color?: string;
}) => <SectionHeader title={title} subtitle={subtitle} pills={pills} actions={actions} icon={icon} color={color} />;

const MiniStat = ({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) => (
  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5 }}>
    <Avatar variant="rounded" sx={{ bgcolor: alpha(color, 0.1), color, width: 36, height: 36, borderRadius: 2 }}>{icon}</Avatar>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
      <Typography variant="subtitle2" fontWeight={700} noWrap>{value}</Typography>
    </Box>
  </Stack>
);

/** Polished chart shell — left accent bar + hover lift. Header is supplied as a child <SectionTitle>. */
const ChartPaper = ({ children, height = 380, color }: { children: React.ReactNode; height?: number; color?: string }) => {
  const theme = useTheme();
  const accent = color || theme.palette.primary.main;
  return (
    <Paper elevation={0} sx={{
      p: 3, height, borderRadius: 3, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
      border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      transition: "box-shadow 0.25s",
      "&:hover": { boxShadow: `0 6px 28px ${alpha(theme.palette.common.black, 0.07)}` },
      "&::before": {
        content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(180deg, ${accent}, ${alpha(accent, 0.35)})`,
      },
    }}>
      {children}
    </Paper>
  );
};

/** City filter dropdown — reused across tabs */
const ALL = "__all__";
const CityFilter = ({ value, cities, onChange }: {
  value: string; cities: string[]; onChange: (v: string) => void;
}) => (
  <TextField select size="small" label="City" value={value || ALL} onChange={e => onChange(e.target.value === ALL ? "" : e.target.value)}
    sx={{ minWidth: 180, "& .MuiInputBase-root": { fontSize: "0.85rem" } }}
    InputProps={{ startAdornment: <PlaceIcon fontSize="small" sx={{ mr: 0.5, color: "text.secondary", fontSize: 18 }} /> }}>
    <MenuItem value={ALL}>All Cities</MenuItem>
    {cities.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
  </TextField>
);

const DashboardSkeleton = () => (
  <Box>
    <Grid container spacing={2} mb={3}>
      {[...Array(4)].map((_, i) => <Grid key={i} size={{ xs: 6, md: 3 }}><Skeleton variant="rounded" height={100} /></Grid>)}
    </Grid>
    <Grid container spacing={2} mb={3}>
      {[...Array(4)].map((_, i) => <Grid key={i} size={{ xs: 6, md: 3 }}><Skeleton variant="rounded" height={100} /></Grid>)}
    </Grid>
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 8 }}><Skeleton variant="rounded" height={380} /></Grid>
      <Grid size={{ xs: 12, md: 4 }}><Skeleton variant="rounded" height={380} /></Grid>
    </Grid>
  </Box>
);

// ════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const theme = useTheme();
  // Scheme-aware chart/status colors (follow the admin-selected color scheme).
  const { chart: CHART_COLORS, lead: LEAD_COLORS, stock: STOCK_COLORS } = useChartPalette();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [cityFilter, setCityFilter] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Area is scoped server-side: a selected city returns per-agent /
      // per-distributor numbers for THAT territory only (not all-area totals).
      const params: Record<string, string> = {};
      if (cityFilter) params.city = cityFilter;
      setData(await analyticsService.getAdminDashboard(params));
    }
    catch { toast.error("Failed to load dashboard data"); }
    finally { setLoading(false); }
  }, [cityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filtered data (memoized) ────────────────────────────────────────
  const f = useMemo(() => {
    if (!data) return null;
    const c = cityFilter;
    return {
      agents: c ? data.agent_performance.filter(a => cityMatch(a.city, c)) : data.agent_performance,
      distributors: c ? data.distributor_performance.filter(d => cityMatch(d.city, c)) : data.distributor_performance,
      salesByArea: c ? data.sales_by_area.filter(a => areaMatch(a.area, c)) : data.sales_by_area,
      visitsByArea: c ? data.visits_by_area.filter(a => areaMatch(a.area, c)) : data.visits_by_area,
      leadsByArea: c ? data.leads_by_area.filter(a => areaMatch(a.area, c)) : data.leads_by_area,
      productByArea: c ? data.product_by_area.filter(a => areaMatch(a.area, c)) : data.product_by_area,
      salesByDistributor: c ? data.sales_by_distributor.filter(d => cityMatch(d.city, c)) : data.sales_by_distributor,
    };
  }, [data, cityFilter]);

  // Only blank to the skeleton on the FIRST load; keep showing existing data
  // while re-fetching after an area change so the page doesn't flash.
  if (!data || !f) {
    return <Box sx={{ p: 1 }}>{loading ? <DashboardSkeleton /> : (
      <Typography color="text.secondary" textAlign="center" py={10}>No data available.</Typography>
    )}</Box>;
  }

  const { kpis } = data;
  const bdr = `1px solid ${alpha(theme.palette.divider, 0.1)}`;
  const cities = data.available_cities || [];
  const maxAgentTotal = Math.max(0, ...f.agents.map(a => a.total_sales));
  const maxDistRev = Math.max(0, ...f.distributors.map(d => d.primary_revenue));

  return (
    <Box>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5} flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>Admin Dashboard</Typography>
            <Typography variant="body2" color="text.secondary">
              Complete business overview &bull; This Month
              {cityFilter ? ` • Area: ${cityFilter} (agent & distributor figures scoped to this territory)` : ""}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {loading && <CircularProgress size={18} thickness={5} />}
            <CityFilter value={cityFilter} cities={cities} onChange={setCityFilter} />
            <Tooltip title="Refresh"><IconButton onClick={fetchData} disabled={loading}><RefreshIcon /></IconButton></Tooltip>
          </Stack>
        </Stack>

        {/* ── KPI Row 1 ──────────────────────────────────────── */}
        <Grid container spacing={2} mb={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard title="Total Revenue" value={fmtFull(kpis.total_revenue.value)}
              change={kpis.total_revenue.change} icon={<CurrencyRupeeIcon />}
              color={theme.palette.success.main} subtitle="vs last month" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard title="Primary Sales" value={fmtFull(kpis.primary_revenue.value)}
              change={kpis.primary_revenue.change} icon={<LocalShippingIcon />}
              color="#1976d2" subtitle="Distributor orders" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard title="Secondary Sales" value={fmtFull(kpis.secondary_revenue.value)}
              change={kpis.secondary_revenue.change} icon={<StorefrontIcon />}
              color="#7b1fa2" subtitle="Customer orders" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard title="Orders" value={String(kpis.orders.value)}
              change={kpis.orders.change} icon={<ShoppingBagIcon />}
              color={theme.palette.secondary.main} subtitle={`${kpis.stock_requests.value} stock req.`} />
          </Grid>
        </Grid>
        <Grid container spacing={2} mb={3}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard title="New Clients" value={String(kpis.new_clients.value)}
              change={kpis.new_clients.change} icon={<PersonAddIcon />} color="#ed6c02" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard title="Visits" value={`${kpis.visits.completed}/${kpis.visits.value}`}
              icon={<PlaceIcon />} color="#0288d1" subtitle={`Today: ${kpis.visits.today_done}/${kpis.visits.today}`} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard title="Leads" value={String(kpis.leads.value)}
              change={kpis.leads.change} icon={<PeopleAltIcon />} color="#9c27b0" />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard title="Attendance" value={`${kpis.attendance.rate}%`}
              icon={<CheckCircleIcon />} color={kpis.attendance.rate! >= 80 ? "#2e7d32" : "#ed6c02"}
              subtitle={`${kpis.attendance.present}/${kpis.attendance.total} present`} />
          </Grid>
        </Grid>

        {/* ── Tabs ────────────────────────────────────────────── */}
        <Paper elevation={0} sx={{ mb: 3, overflow: "hidden" }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
            sx={{ px: 1, "& .MuiTab-root": { py: 1.5, fontWeight: 700, fontSize: "0.82rem", minHeight: 46 } }}>
            <Tab icon={<AssessmentIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Overview" />
            <Tab icon={<CurrencyRupeeIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Sales" />
            <Tab icon={<GroupsIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Field Ops" />
            <Tab icon={<InventoryIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Inventory" />
            <Tab icon={<PlaceIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Area" />
            <Tab icon={<FactoryIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Operations" />
          </Tabs>
        </Paper>

        {/* ═══════════════════════════════════════════════════════
            TAB 0 — OVERVIEW
        ═══════════════════════════════════════════════════════ */}
        {tab === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 8 }}>
                <ChartPaper height={390}>
                  <SectionTitle title="Revenue Trend" subtitle="Primary vs Secondary — Last 6 months" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.revenue_trend}>
                        <defs>
                          <linearGradient id="gPri" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1976d2" stopOpacity={0.2} /><stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gSec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7b1fa2" stopOpacity={0.2} /><stop offset="95%" stopColor="#7b1fa2" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} tickFormatter={fmt} />
                        <RTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="primary" name="Primary" stroke="#1976d2" strokeWidth={2.5} fillOpacity={1} fill="url(#gPri)" />
                        <Area type="monotone" dataKey="secondary" name="Secondary" stroke="#7b1fa2" strokeWidth={2.5} fillOpacity={1} fill="url(#gSec)" />
                        <Legend />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }}>
                <ChartPaper height={390}>
                  <SectionTitle title="Revenue Split" subtitle="This month" />
                  <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie data={[{ name: "Primary", value: data.revenue_split.primary }, { name: "Secondary", value: data.revenue_split.secondary }]}
                          innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value" cy="42%">
                          <Cell fill="#1976d2" /><Cell fill="#7b1fa2" />
                        </Pie>
                        <RTooltip formatter={(val) => fmtFull(Number(val ?? 0))} />
                        <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Divider sx={{ my: 1 }} />
                    <Stack direction="row" spacing={2}>
                      <Box sx={{ flex: 1 }}><MiniStat label="Outstanding" value={fmtFull(kpis.outstanding)} icon={<WarningAmberIcon />} color="#d32f2f" /></Box>
                      <Box sx={{ flex: 1 }}><MiniStat label="FY Revenue" value={fmtFull(kpis.total_revenue.fy_total || 0)} icon={<CurrencyRupeeIcon />} color="#2e7d32" /></Box>
                    </Stack>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={320}>
                  <SectionTitle title="Attendance — Last 7 Days" subtitle="Field vs Office" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.attendance_trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <RTooltip /><Legend />
                        <Bar dataKey="field" name="Field" fill="#1976d2" radius={[4, 4, 0, 0]} barSize={14} />
                        <Bar dataKey="office" name="Office" fill="#ed6c02" radius={[4, 4, 0, 0]} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={320} color="#9c27b0">
                  <SectionTitle title="Leads Pipeline" subtitle="This month by status" color="#9c27b0"
                    pills={data.leads_by_status.slice(0, 4).map(l => ({
                      label: l.status.charAt(0).toUpperCase() + l.status.slice(1),
                      value: l.count, color: LEAD_COLORS[l.status] || "#9c27b0",
                    }))} />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.leads_by_status} layout="vertical">
                        <XAxis type="number" hide /><YAxis dataKey="status" type="category" width={80} tick={{ fontSize: 12 }} />
                        <RTooltip />
                        <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]} barSize={18}>
                          {data.leads_by_status.map((e, i) => <Cell key={i} fill={LEAD_COLORS[e.status] || CHART_COLORS[i % 10]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
            </Grid>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 1 — SALES (with city filter)
        ═══════════════════════════════════════════════════════ */}
        {tab === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <Grid container spacing={3}>
              {/* Sales by Area */}
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={400}>
                  <SectionTitle title="Sales by Area" subtitle="Primary vs Secondary by city" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={f.salesByArea} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmt} />
                        <YAxis dataKey="area" type="category" width={80} tick={{ fontSize: 11 }} />
                        <RTooltip content={<ChartTooltipContent />} /><Legend />
                        <Bar dataKey="primary" name="Primary" fill="#1976d2" stackId="a" barSize={16} />
                        <Bar dataKey="secondary" name="Secondary" fill="#7b1fa2" stackId="a" radius={[0, 4, 4, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              {/* Sales by Distributor — Pareto (80/20) */}
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={400}>
                  <SectionTitle title="Primary Sales by Distributor" subtitle={cityFilter ? `Filtered: ${cityFilter}` : "Pareto — vital few drive 80% of revenue"} />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ParetoChart data={f.salesByDistributor} nameKey="name" valueKey="total" barName="Revenue" valueFormat={fmtFull} />
                  </Box>
                </ChartPaper>
              </Grid>
              {/* Product-wise Sales */}
              <Grid size={{ xs: 12 }}>
                <ChartPaper height={400}>
                  <SectionTitle title="Product-wise Sales" subtitle="Primary vs Secondary revenue per product" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.sales_by_product}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={65} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={fmt} />
                        <RTooltip content={<ChartTooltipContent />} /><Legend />
                        <Bar dataKey="primary" name="Primary" fill="#1976d2" radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="secondary" name="Secondary" fill="#7b1fa2" radius={[4, 4, 0, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              {/* Agent Leaderboard */}
              <Grid size={{ xs: 12 }}>
                <Paper elevation={0} sx={{ overflow: "hidden", border: bdr }}>
                  <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                      <SectionTitle title="Sales Agent Leaderboard" subtitle={cityFilter ? `Showing: ${cityFilter}` : "Ranked by total sales this month"} />
                    </Stack>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                          {["#", "Agent", "City", "Primary", "Secondary", "Total", "Visits", "Orders", "Clients"].map((h, i) => (
                            <TableCell key={h} align={i >= 3 ? (i >= 6 ? "center" : "right") : "left"} sx={{ fontWeight: 700, fontSize: "0.75rem" }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {f.agents.length === 0 ? <EmptyRow cols={9} /> : f.agents.map((a, i) => (
                          <TableRow key={a.id} hover>
                            <TableCell>
                              <Chip label={i + 1} size="small" sx={{
                                fontWeight: 700, width: 26, height: 22, fontSize: "0.7rem",
                                bgcolor: i < 3 ? alpha(["#ffd700", "#c0c0c0", "#cd7f32"][i], 0.15) : alpha(theme.palette.divider, 0.08),
                              }} />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Avatar sx={{ width: 28, height: 28, bgcolor: alpha(CHART_COLORS[i % 10], 0.12), color: CHART_COLORS[i % 10], fontSize: 12 }}>{a.name.charAt(0)}</Avatar>
                                <Typography variant="body2" fontWeight={600} noWrap>{a.name}</Typography>
                              </Stack>
                            </TableCell>
                            <TableCell><Typography variant="caption" color="text.secondary">{a.city || "—"}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600} color="primary.main">{fmtFull(a.primary_sales)}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600} sx={{ color: "#7b1fa2" }}>{fmtFull(a.secondary_sales)}</Typography></TableCell>
                            <HeatCell value={a.total_sales} min={0} max={maxAgentTotal} direction="highGood" format={fmtFull} align="right" />
                            <TableCell align="center">{a.visits}</TableCell>
                            <TableCell align="center">{a.orders}</TableCell>
                            <TableCell align="center">
                              <Chip label={a.new_clients} size="small" color={a.new_clients > 0 ? "success" : "default"} sx={{ fontWeight: 700, height: 20, fontSize: "0.7rem" }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 2 — FIELD OPS (with city filter)
        ═══════════════════════════════════════════════════════ */}
        {tab === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <Grid container spacing={2} mb={3}>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Total Visits" value={String(kpis.visits.value)} icon={<PlaceIcon />} color="#1976d2" subtitle="This month" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Completed" value={String(kpis.visits.completed)} icon={<CheckCircleIcon />} color="#2e7d32"
                  subtitle={`${kpis.visits.value ? Math.round((kpis.visits.completed! / kpis.visits.value) * 100) : 0}% rate`} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Today" value={`${kpis.visits.today_done}/${kpis.visits.today}`} icon={<PlaceIcon />} color="#ed6c02" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="New Leads" value={String(kpis.leads.value)} change={kpis.leads.change} icon={<PeopleAltIcon />} color="#9c27b0" />
              </Grid>
            </Grid>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={380}>
                  <SectionTitle title="Visits by Area" subtitle={cityFilter ? `Filtered: ${cityFilter}` : "Total vs Completed per city"} />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={f.visitsByArea}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis dataKey="area" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <RTooltip /><Legend />
                        <Bar dataKey="total" name="Planned" fill={alpha("#1976d2", 0.25)} radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="completed" name="Done" fill="#1976d2" radius={[4, 4, 0, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={380}>
                  <SectionTitle title="Lead Status" subtitle="This month" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.leads_by_status.map(l => ({ ...l, label: l.status.charAt(0).toUpperCase() + l.status.slice(1) }))}
                          dataKey="count" nameKey="label" cx="50%" cy="45%" innerRadius={55} outerRadius={95} paddingAngle={3}>
                          {data.leads_by_status.map((e, i) => <Cell key={i} fill={LEAD_COLORS[e.status] || CHART_COLORS[i % 10]} />)}
                        </Pie>
                        <RTooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <ChartPaper height={310}>
                  <SectionTitle title="Attendance Trend — 7 Days"
                    subtitle={`Today: ${kpis.attendance.present}/${kpis.attendance.total} (Field ${kpis.attendance.field}, Office ${kpis.attendance.office})`} />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.attendance_trend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <RTooltip /><Legend />
                        <Bar dataKey="field" name="Field" fill="#1976d2" barSize={18} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="office" name="Office" fill="#ed6c02" barSize={18} radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="total" name="Total" stroke="#2e7d32" strokeWidth={2.5} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
            </Grid>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 3 — INVENTORY (with city filter on distributors)
        ═══════════════════════════════════════════════════════ */}
        {tab === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <Grid container spacing={2} mb={3}>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Active Products" value={String(data.warehouse.total_products)} icon={<InventoryIcon />} color="#1976d2" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Low Stock Alerts" value={String(data.warehouse.low_stock)} icon={<WarningAmberIcon />} color={data.warehouse.low_stock > 0 ? "#d32f2f" : "#2e7d32"} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Inventory Value" value={fmtFull(data.warehouse.inventory_value)} icon={<CurrencyRupeeIcon />} color="#2e7d32" subtitle="At selling price" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Stock Requests" value={String(kpis.stock_requests.value)} change={kpis.stock_requests.change} icon={<LocalShippingIcon />} color="#ed6c02" subtitle="This month" /></Grid>
            </Grid>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 8 }}>
                <ChartPaper height={420}>
                  <SectionTitle title="Product Stock Levels" subtitle="Current stock vs Low-stock threshold" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.warehouse.product_inventory} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                        <RTooltip /><Legend />
                        <Bar dataKey="stock" name="Current Stock" barSize={14} radius={[0, 4, 4, 0]}>
                          {data.warehouse.product_inventory.map((p, i) => <Cell key={i} fill={STOCK_COLORS[p.status] || "#1976d2"} />)}
                        </Bar>
                        <Line type="stepAfter" dataKey="threshold" name="Threshold" stroke="#d32f2f" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Paper elevation={0} sx={{ border: bdr, height: 420, display: "flex", flexDirection: "column" }}>
                  <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                    <SectionTitle title="Low Stock Alerts" subtitle="Products below threshold" />
                  </Box>
                  <TableContainer sx={{ flex: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead><TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Product</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Stock</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Threshold</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {data.warehouse.low_stock_alerts.length === 0 ? <EmptyRow cols={3} msg="All stocked up!" /> :
                          data.warehouse.low_stock_alerts.map((p, i) => (
                            <TableRow key={i} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 140 }}>{p.name}</Typography>
                                {p.sku && <Typography variant="caption" color="text.secondary" display="block">{p.sku}</Typography>}
                              </TableCell>
                              <TableCell align="right"><Typography variant="body2" fontWeight={700} color="error.main">{p.stock}</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body2" color="text.secondary">{p.threshold}</Typography></TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <ChartPaper height={400}>
                  <SectionTitle title="Product Revenue — Primary vs Secondary" subtitle="Sales revenue per product this month" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.sales_by_product}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={65} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={fmt} />
                        <RTooltip content={<ChartTooltipContent />} /><Legend />
                        <Bar dataKey="primary" name="Primary" fill="#1976d2" radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="secondary" name="Secondary" fill="#7b1fa2" radius={[4, 4, 0, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              {/* Distributor table filtered by city */}
              <Grid size={{ xs: 12 }}>
                <Paper elevation={0} sx={{ overflow: "hidden", border: bdr }}>
                  <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                    <SectionTitle title="Distributor Revenue" subtitle={cityFilter ? `Filtered: ${cityFilter}` : "Primary revenue, secondary sales, and client count"} />
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                          {["#", "Distributor", "City", "Primary Rev.", "Secondary", "Requests", "Clients"].map((h, i) => (
                            <TableCell key={h} align={i >= 3 ? (i >= 5 ? "center" : "right") : "left"} sx={{ fontWeight: 700, fontSize: "0.75rem" }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {f.distributors.length === 0 ? <EmptyRow cols={7} msg="No distributor data" /> :
                          f.distributors.map((d, i) => (
                            <TableRow key={d.id} hover>
                              <TableCell>{i + 1}</TableCell>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  <Avatar sx={{ width: 26, height: 26, bgcolor: alpha("#1976d2", 0.1), color: "#1976d2", fontSize: 11 }}>{d.name.charAt(0)}</Avatar>
                                  <Typography variant="body2" fontWeight={600} noWrap>{d.name}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell><Typography variant="caption" color="text.secondary">{d.city || "—"}</Typography></TableCell>
                              <HeatCell value={d.primary_revenue} min={0} max={maxDistRev} direction="highGood" format={fmtFull} align="right" />
                              <TableCell align="right"><Typography variant="body2" fontWeight={600} sx={{ color: "#7b1fa2" }}>{fmtFull(d.secondary_sales)}</Typography></TableCell>
                              <TableCell align="center">{d.requests}</TableCell>
                              <TableCell align="center">{d.total_clients}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 4 — AREA (all filtered by city)
        ═══════════════════════════════════════════════════════ */}
        {tab === 4 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={400}>
                  <SectionTitle title="Revenue by Area" subtitle={cityFilter ? `Showing: ${cityFilter}` : "Primary + Secondary stacked"} />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={f.salesByArea}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis dataKey="area" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={55} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={fmt} />
                        <RTooltip content={<ChartTooltipContent />} /><Legend />
                        <Bar dataKey="primary" name="Primary" fill="#1976d2" stackId="r" barSize={24} />
                        <Bar dataKey="secondary" name="Secondary" fill="#7b1fa2" stackId="r" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={400}>
                  <SectionTitle title="Visits by Area" subtitle={cityFilter ? `Showing: ${cityFilter}` : "Planned vs Completed"} />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={f.visitsByArea}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis dataKey="area" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={55} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <RTooltip /><Legend />
                        <Bar dataKey="total" name="Planned" fill={alpha("#0288d1", 0.25)} radius={[4, 4, 0, 0]} barSize={18} />
                        <Bar dataKey="completed" name="Done" fill="#0288d1" radius={[4, 4, 0, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <ChartPaper height={360}>
                  <SectionTitle title="Leads by Area" subtitle={cityFilter ? `Showing: ${cityFilter}` : "New leads per city"} />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={f.leadsByArea} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="area" type="category" width={85} tick={{ fontSize: 11 }} />
                        <RTooltip />
                        <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]} barSize={16}>
                          {f.leadsByArea.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % 10]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={0} sx={{ border: bdr, height: 360, display: "flex", flexDirection: "column" }}>
                  <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                    <SectionTitle title="Top Products by Area" subtitle={cityFilter ? `Showing: ${cityFilter}` : "Best sellers per city"} />
                  </Box>
                  <TableContainer sx={{ flex: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead><TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: "0.73rem" }}>City</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Product</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Revenue</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Qty</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {f.productByArea.length === 0 ? <EmptyRow cols={4} /> :
                          f.productByArea.flatMap(ad => ad.products.slice(0, 2).map((p, pi) => (
                            <TableRow key={`${ad.area}-${pi}`} hover>
                              {pi === 0 && <TableCell rowSpan={Math.min(ad.products.length, 2)} sx={{ verticalAlign: "top", borderRight: `2px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                                <Typography variant="body2" fontWeight={700}>{ad.area}</Typography>
                              </TableCell>}
                              <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 130 }}>{p.product}</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body2" fontWeight={600} color="primary.main">{fmtFull(p.total)}</Typography></TableCell>
                              <TableCell align="right"><Typography variant="caption" color="text.secondary">{p.qty}</Typography></TableCell>
                            </TableRow>
                          )))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              {/* Agent & Distributor tables */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={0} sx={{ overflow: "hidden", border: bdr }}>
                  <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                    <SectionTitle title="Sales per Agent" subtitle={cityFilter ? `Showing: ${cityFilter}` : "By operating city"} />
                  </Box>
                  <TableContainer sx={{ maxHeight: 380 }}>
                    <Table size="small" stickyHeader>
                      <TableHead><TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Agent</TableCell><TableCell sx={{ fontWeight: 700 }}>City</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Sales</TableCell><TableCell align="center" sx={{ fontWeight: 700 }}>Visits</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {f.agents.map(a => (
                          <TableRow key={a.id} hover>
                            <TableCell><Typography variant="body2" fontWeight={600} noWrap>{a.name}</Typography></TableCell>
                            <TableCell><Typography variant="body2" color="text.secondary">{a.city || "—"}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={700}>{fmtFull(a.total_sales)}</Typography></TableCell>
                            <TableCell align="center">{a.visits}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper elevation={0} sx={{ overflow: "hidden", border: bdr }}>
                  <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                    <SectionTitle title="Sales per Distributor" subtitle={cityFilter ? `Showing: ${cityFilter}` : "By operating city"} />
                  </Box>
                  <TableContainer sx={{ maxHeight: 380 }}>
                    <Table size="small" stickyHeader>
                      <TableHead><TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Distributor</TableCell><TableCell sx={{ fontWeight: 700 }}>City</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Primary</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>Secondary</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {f.distributors.map(d => (
                          <TableRow key={d.id} hover>
                            <TableCell><Typography variant="body2" fontWeight={600} noWrap>{d.name}</Typography></TableCell>
                            <TableCell><Typography variant="body2" color="text.secondary">{d.city || "—"}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={700} color="primary.main">{fmtFull(d.primary_revenue)}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="body2" fontWeight={600} sx={{ color: "#7b1fa2" }}>{fmtFull(d.secondary_sales)}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TAB 5 — OPERATIONS
        ═══════════════════════════════════════════════════════ */}
        {tab === 5 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}><Typography variant="overline" fontWeight={800} color="text.secondary" sx={{ letterSpacing: 1.5 }}>Production</Typography></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Work Orders" value={String(data.production.work_orders_total)} icon={<FactoryIcon />} color="#1976d2" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="In Progress" value={String(data.production.work_orders_in_progress)} icon={<FactoryIcon />} color="#ed6c02" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Completed" value={String(data.production.work_orders_completed)} icon={<CheckCircleIcon />} color="#2e7d32" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Active Plans" value={String(data.production.active_plans)} icon={<AssessmentIcon />} color="#9c27b0" /></Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <ChartPaper height={310}>
                  <SectionTitle title="Work Order Status" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[
                          { name: "Completed", value: data.production.work_orders_completed },
                          { name: "In Progress", value: data.production.work_orders_in_progress },
                          { name: "Pending", value: Math.max(0, data.production.work_orders_total - data.production.work_orders_completed - data.production.work_orders_in_progress) },
                        ]} innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          <Cell fill="#2e7d32" /><Cell fill="#ed6c02" /><Cell fill={alpha(theme.palette.divider, 0.3)} />
                        </Pie>
                        <RTooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <ChartPaper height={310}>
                  <SectionTitle title="Purchase Overview" subtitle="This month" />
                  <Grid container spacing={2} sx={{ flex: 1 }}>
                    <Grid size={{ xs: 6 }}>
                      <MiniStat label="Pending POs" value={data.purchase.pending_pos} icon={<ShoppingBagIcon />} color="#ed6c02" />
                      <Divider /><MiniStat label="Pending MRs" value={data.purchase.pending_mrs} icon={<InventoryIcon />} color="#9c27b0" />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <MiniStat label="Approved PO Value" value={fmtFull(data.purchase.approved_value)} icon={<CurrencyRupeeIcon />} color="#2e7d32" />
                      <Divider /><MiniStat label="Approved Count" value={data.purchase.approved_count} icon={<AssessmentIcon />} color="#1976d2" />
                    </Grid>
                  </Grid>
                </ChartPaper>
              </Grid>
              <Grid size={{ xs: 12 }}><Typography variant="overline" fontWeight={800} color="text.secondary" sx={{ letterSpacing: 1.5, mt: 1 }}>Warehouse & Inventory</Typography></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Active Products" value={String(data.warehouse.total_products)} icon={<InventoryIcon />} color="#1976d2" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Low Stock" value={String(data.warehouse.low_stock)} icon={<WarningAmberIcon />} color={data.warehouse.low_stock > 0 ? "#d32f2f" : "#2e7d32"} /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Inventory Value" value={fmtFull(data.warehouse.inventory_value)} icon={<CurrencyRupeeIcon />} color="#2e7d32" /></Grid>
              <Grid size={{ xs: 6, md: 3 }}><StatCard title="Outstanding" value={fmtFull(kpis.outstanding)} icon={<WarningAmberIcon />} color="#d32f2f" subtitle="Receivables" /></Grid>
              <Grid size={{ xs: 12 }}>
                <ChartPaper height={380}>
                  <SectionTitle title="Product Stock Levels" subtitle="Current stock with threshold line" />
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.warehouse.product_inventory} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={alpha(theme.palette.divider, 0.1)} />
                        <XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                        <RTooltip /><Legend />
                        <Bar dataKey="stock" name="Stock" barSize={14} radius={[0, 4, 4, 0]}>
                          {data.warehouse.product_inventory.map((p, i) => <Cell key={i} fill={STOCK_COLORS[p.status] || "#1976d2"} />)}
                        </Bar>
                        <Line type="stepAfter" dataKey="threshold" name="Threshold" stroke="#d32f2f" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                </ChartPaper>
              </Grid>
            </Grid>
          </motion.div>
        )}

      </motion.div>
    </Box>
  );
}

"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Grid, Typography, Paper, Stack, Avatar, Divider, Chip, useTheme, alpha,
  Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Skeleton, Tooltip, IconButton, MenuItem, TextField, Button, CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, BarChart, Bar, PieChart, Pie, Cell, Legend, ComposedChart, Line,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { toast } from "sonner";

import { CurrencyRupeeIcon, PeopleAltIcon, ShoppingBagIcon, InventoryIcon, PlaceIcon, CheckCircleIcon, PersonAddIcon, WarningAmberIcon, LocalShippingIcon, FactoryIcon, AssessmentIcon, StorefrontIcon, GroupsIcon, DownloadIcon, CalendarMonthIcon } from "@/components/icons";

import { analyticsService } from "@/lib/analytics-service";
import EntityDetailDialog, { DrillEntity } from "@/components/admin/EntityDetailDialog";
import {
  fmt, fmtFull, fmtNum, useChartPalette,
  StatCard, SectionHeader, StatPills, ParetoChart, HeatCell,
  ChartTooltipContent, EmptyRow,
} from "@/components/admin/analytics/kit";

// @ts-ignore
import XLSXStyle from "xlsx-js-style";

// ── Types (same as dashboard) ─────────────────────────────────────────
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
  sales_by_product: { name: string; primary: number; secondary: number; primary_qty: number; secondary_qty: number }[];
  product_by_distributor: { entity: string; products: { product: string; total: number; qty: number }[] }[];
  product_by_agent: { entity: string; products: { product: string; total: number; qty: number }[] }[];
  agent_performance: {
    id: number; name: string; city: string;
    secondary_sales: number; primary_sales: number; total_sales: number;
    attendance_days: number; visits: number; orders: number; new_clients: number;
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
  period?: { from: string; to: string };
}

// ── Helpers ───────────────────────────────────────────────────────────
const ALL = "__all__";
const cityMatch = (cityStr: string, filter: string) => {
  if (!filter) return true;
  return cityStr.split(",").map(c => c.trim().toLowerCase()).includes(filter.toLowerCase());
};
const areaMatch = (area: string, filter: string) => {
  if (!filter) return true;
  return area.trim().toLowerCase() === filter.toLowerCase();
};

// ── Date helpers ──────────────────────────────────────────────────────
const getMonthStart = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const getMonthEnd = (y: number, m: number) => {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${last}`;
};
const formatPeriodLabel = (from: string, to: string) => {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const f = new Date(from); const t = new Date(to);
  return `${f.toLocaleDateString("en-IN", opts)} — ${t.toLocaleDateString("en-IN", opts)}`;
};

// ── Reusable Components ──────────────────────────────────────────────
/** Backward-compatible section header — supports optional pills/actions/icon. */
const SectionTitle = ({ title, subtitle, pills, actions, icon, color }: {
  title: string; subtitle?: string;
  pills?: React.ComponentProps<typeof StatPills>["items"];
  actions?: React.ReactNode; icon?: React.ReactNode; color?: string;
}) => <SectionHeader title={title} subtitle={subtitle} pills={pills} actions={actions} icon={icon} color={color} />;

/** Polished chart shell — left accent bar + hover lift. Header supplied as a child <SectionTitle>. */
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

// ── Excel Export ──────────────────────────────────────────────────────
const border = {
  top: { style: "thin", color: { rgb: "CFD8DC" } }, bottom: { style: "thin", color: { rgb: "CFD8DC" } },
  left: { style: "thin", color: { rgb: "CFD8DC" } }, right: { style: "thin", color: { rgb: "CFD8DC" } },
};
const hdr = (t: string) => ({ v: t, t: "s", s: { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 }, fill: { fgColor: { rgb: "1565C0" } }, alignment: { horizontal: "center", vertical: "center" }, border } });
const subHdr = (t: string) => ({ v: t, t: "s", s: { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 }, fill: { fgColor: { rgb: "FF8F00" } }, alignment: { horizontal: "left" }, border } });
const xlTitle = (t: string) => ({ v: t, t: "s", s: { font: { bold: true, sz: 14, color: { rgb: "1A237E" } } } });
const xlEmpty = () => ({ v: "", t: "s", s: { fill: { fgColor: { rgb: "FFFFFF" } } } });
const xlCell = (v: any, r: number, opts?: { bold?: boolean; align?: string }) => ({
  v: v ?? "-", t: typeof v === "number" ? "n" : "s",
  s: { font: { sz: 10, bold: opts?.bold }, fill: { fgColor: { rgb: r % 2 === 0 ? "F5F5F5" : "FFFFFF" } }, alignment: { horizontal: opts?.align || "left" }, border },
});
const xlNum = (v: number, r: number) => ({
  v: v || 0, t: "n",
  s: { font: { sz: 10 }, fill: { fgColor: { rgb: r % 2 === 0 ? "F5F5F5" : "FFFFFF" } }, alignment: { horizontal: "right" }, numFmt: "#,##0", border },
});

function exportReport(data: DashboardData, periodLabel: string, cityFilter: string) {
  const wb = XLSXStyle.utils.book_new();
  const cityNote = cityFilter ? ` | City: ${cityFilter}` : "";

  // ── Sheet 1: KPI Summary ──
  const kRows: any[][] = [
    [xlTitle(`Admin Report — ${periodLabel}${cityNote}`), xlEmpty(), xlEmpty()],
    [xlEmpty(), xlEmpty(), xlEmpty()],
    [subHdr("REVENUE"), subHdr(""), subHdr("")],
    [hdr("Metric"), hdr("Value"), hdr("Change %")],
    [xlCell("Total Revenue", 0), xlNum(data.kpis.total_revenue.value, 0), xlCell(`${data.kpis.total_revenue.change ?? 0}%`, 0, { align: "center" })],
    [xlCell("Primary Sales", 1), xlNum(data.kpis.primary_revenue.value, 1), xlCell(`${data.kpis.primary_revenue.change ?? 0}%`, 1, { align: "center" })],
    [xlCell("Secondary Sales", 0), xlNum(data.kpis.secondary_revenue.value, 0), xlCell(`${data.kpis.secondary_revenue.change ?? 0}%`, 0, { align: "center" })],
    [xlCell("Outstanding", 1), xlNum(data.kpis.outstanding, 1), xlEmpty()],
    [xlEmpty(), xlEmpty(), xlEmpty()],
    [subHdr("OPERATIONS"), subHdr(""), subHdr("")],
    [hdr("Metric"), hdr("Value"), hdr("Change %")],
    [xlCell("Orders", 0), xlCell(data.kpis.orders.value, 0, { align: "right" }), xlCell(`${data.kpis.orders.change ?? 0}%`, 0, { align: "center" })],
    [xlCell("Stock Requests", 1), xlCell(data.kpis.stock_requests.value, 1, { align: "right" }), xlCell(`${data.kpis.stock_requests.change ?? 0}%`, 1, { align: "center" })],
    [xlCell("New Clients", 0), xlCell(data.kpis.new_clients.value, 0, { align: "right" }), xlCell(`${data.kpis.new_clients.change ?? 0}%`, 0, { align: "center" })],
    [xlCell("Visits (completed/total)", 1), xlCell(`${data.kpis.visits.completed}/${data.kpis.visits.value}`, 1, { align: "right" }), xlEmpty()],
    [xlCell("Leads", 0), xlCell(data.kpis.leads.value, 0, { align: "right" }), xlCell(`${data.kpis.leads.change ?? 0}%`, 0, { align: "center" })],
    [xlCell("Attendance Rate", 1), xlCell(`${data.kpis.attendance.rate}%`, 1, { align: "right" }), xlEmpty()],
  ];
  const ws1: any = {};
  kRows.forEach((row, r) => row.forEach((c, col) => { ws1[XLSXStyle.utils.encode_cell({ r, c: col })] = c; }));
  ws1["!ref"] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: kRows.length - 1, c: 2 } });
  ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }, { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } }];
  ws1["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }];
  XLSXStyle.utils.book_append_sheet(wb, ws1, "KPI Summary");

  // ── Sheet 2: Sales by Area ──
  const aHeaders = ["City", "Primary (₹)", "Secondary (₹)", "Total (₹)"];
  const aData = data.sales_by_area;
  const ws2: any = {};
  ws2[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = xlTitle("Sales by Area");
  aHeaders.forEach((h, c) => { ws2[XLSXStyle.utils.encode_cell({ r: 1, c })] = hdr(h); });
  aData.forEach((a, i) => {
    const r = i + 2;
    [xlCell(a.area, i), xlNum(a.primary, i), xlNum(a.secondary, i), xlNum(a.primary + a.secondary, i)]
      .forEach((c, col) => { ws2[XLSXStyle.utils.encode_cell({ r, c: col })] = c; });
  });
  ws2["!ref"] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aData.length + 1, c: 3 } });
  ws2["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSXStyle.utils.book_append_sheet(wb, ws2, "Sales by Area");

  // ── Sheet 3: Agent Performance ──
  const agHeaders = ["#", "Agent", "City", "Primary (₹)", "Secondary (₹)", "Total (₹)", "Days", "Visits", "Orders", "New Clients"];
  const ws3: any = {};
  ws3[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = xlTitle("Agent Performance");
  agHeaders.forEach((h, c) => { ws3[XLSXStyle.utils.encode_cell({ r: 1, c })] = hdr(h); });
  data.agent_performance.forEach((a, i) => {
    const r = i + 2;
    [xlCell(i + 1, i, { align: "center" }), xlCell(a.name, i, { bold: true }), xlCell(a.city || "-", i),
      xlNum(a.primary_sales, i), xlNum(a.secondary_sales, i), xlNum(a.total_sales, i),
      xlCell(a.attendance_days, i, { align: "center" }), xlCell(a.visits, i, { align: "center" }), xlCell(a.orders, i, { align: "center" }), xlCell(a.new_clients, i, { align: "center" })]
      .forEach((c, col) => { ws3[XLSXStyle.utils.encode_cell({ r, c: col })] = c; });
  });
  ws3["!ref"] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.agent_performance.length + 1, c: agHeaders.length - 1 } });
  ws3["!cols"] = [{ wch: 5 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 7 }, { wch: 8 }, { wch: 8 }, { wch: 11 }];
  XLSXStyle.utils.book_append_sheet(wb, ws3, "Agents");

  // ── Sheet 4: Distributor Performance ──
  const dHeaders = ["#", "Distributor", "City", "Primary (₹)", "Secondary (₹)", "Requests", "Clients"];
  const ws4: any = {};
  ws4[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = xlTitle("Distributor Performance");
  dHeaders.forEach((h, c) => { ws4[XLSXStyle.utils.encode_cell({ r: 1, c })] = hdr(h); });
  data.distributor_performance.forEach((d, i) => {
    const r = i + 2;
    [xlCell(i + 1, i, { align: "center" }), xlCell(d.name, i, { bold: true }), xlCell(d.city || "-", i),
      xlNum(d.primary_revenue, i), xlNum(d.secondary_sales, i),
      xlCell(d.requests, i, { align: "center" }), xlCell(d.total_clients, i, { align: "center" })]
      .forEach((c, col) => { ws4[XLSXStyle.utils.encode_cell({ r, c: col })] = c; });
  });
  ws4["!ref"] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.distributor_performance.length + 1, c: dHeaders.length - 1 } });
  ws4["!cols"] = [{ wch: 5 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
  XLSXStyle.utils.book_append_sheet(wb, ws4, "Distributors");

  // ── Sheet 5: Product Sales ──
  const pHeaders = ["Product", "Primary (₹)", "Secondary (₹)", "Total (₹)", "Primary Qty", "Secondary Qty"];
  const ws5: any = {};
  ws5[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = xlTitle("Product-wise Sales");
  pHeaders.forEach((h, c) => { ws5[XLSXStyle.utils.encode_cell({ r: 1, c })] = hdr(h); });
  data.sales_by_product.forEach((p, i) => {
    const r = i + 2;
    [xlCell(p.name, i), xlNum(p.primary, i), xlNum(p.secondary, i), xlNum(p.primary + p.secondary, i), xlNum(p.primary_qty, i), xlNum(p.secondary_qty, i)]
      .forEach((c, col) => { ws5[XLSXStyle.utils.encode_cell({ r, c: col })] = c; });
  });
  ws5["!ref"] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.sales_by_product.length + 1, c: pHeaders.length - 1 } });
  ws5["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 13 }];
  XLSXStyle.utils.book_append_sheet(wb, ws5, "Products");

  // ── Sheet 6: Inventory ──
  const iHeaders = ["Product", "Stock", "Threshold", "Status", "Value (₹)"];
  const ws6: any = {};
  ws6[XLSXStyle.utils.encode_cell({ r: 0, c: 0 })] = xlTitle("Inventory Status");
  iHeaders.forEach((h, c) => { ws6[XLSXStyle.utils.encode_cell({ r: 1, c })] = hdr(h); });
  data.warehouse.product_inventory.forEach((p, i) => {
    const r = i + 2;
    [xlCell(p.name, i), xlNum(p.stock, i), xlNum(p.threshold, i), xlCell(p.status, i, { align: "center" }), xlNum(p.value, i)]
      .forEach((c, col) => { ws6[XLSXStyle.utils.encode_cell({ r, c: col })] = c; });
  });
  ws6["!ref"] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.warehouse.product_inventory.length + 1, c: 4 } });
  ws6["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
  XLSXStyle.utils.book_append_sheet(wb, ws6, "Inventory");

  const fileName = `Admin_Report_${data.period?.from || "all"}_to_${data.period?.to || "all"}.xlsx`;
  XLSXStyle.writeFile(wb, fileName);
  toast.success("Report exported successfully");
}

// ════════════════════════════════════════════════════════════════════════
//  MAIN REPORTS PAGE
// ════════════════════════════════════════════════════════════════════════
export default function ReportsPage() {
  const theme = useTheme();
  // Scheme-aware chart/status colors (follow the admin-selected color scheme).
  const { chart: CHART_COLORS, lead: LEAD_COLORS, stock: STOCK_COLORS } = useChartPalette();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState(0);
  const [cityFilter, setCityFilter] = useState("");
  const [productMetric, setProductMetric] = useState<"revenue" | "units">("revenue");

  // Date range state (day precision)
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [fromDate, setFromDate] = useState(() => getMonthStart(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
  const [toDate, setToDate] = useState(todayISO);
  const [drill, setDrill] = useState<DrillEntity | null>(null);

  const fetchData = useCallback(async () => {
    if (fromDate > toDate) return;   // guard inverted range
    try {
      setLoading(true);
      // Area is scoped server-side: when a city is chosen the backend returns
      // per-agent / per-distributor numbers for THAT territory only.
      const params: Record<string, string> = { from_date: fromDate, to_date: toDate };
      if (cityFilter) params.city = cityFilter;
      const res = await analyticsService.getAdminDashboard(params);
      setData(res);
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, cityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    if (!data) return;
    setExporting(true);
    try {
      exportReport(data, formatPeriodLabel(fromDate, toDate), cityFilter);
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };

  // Filtered data
  const f = useMemo(() => {
    if (!data) return null;
    const c = cityFilter;
    return {
      agents: c ? data.agent_performance.filter(a => cityMatch(a.city, c)) : data.agent_performance,
      distributors: c ? data.distributor_performance.filter(d => cityMatch(d.city, c)) : data.distributor_performance,
      salesByArea: c ? data.sales_by_area.filter(a => areaMatch(a.area, c)) : data.sales_by_area,
      visitsByArea: c ? data.visits_by_area.filter(a => areaMatch(a.area, c)) : data.visits_by_area,
      salesByDistributor: c ? data.sales_by_distributor.filter(d => cityMatch(d.city, c)) : data.sales_by_distributor,
      leadsByArea: c ? data.leads_by_area.filter(a => areaMatch(a.area, c)) : data.leads_by_area,
      productByArea: c ? data.product_by_area.filter(a => areaMatch(a.area, c)) : data.product_by_area,
    };
  }, [data, cityFilter]);

  const bdr = `1px solid ${alpha(theme.palette.divider, 0.1)}`;
  const cities = data?.available_cities || [];
  const periodLabel = formatPeriodLabel(fromDate, toDate);
  const maxAgentTotal = Math.max(0, ...(f?.agents.map(a => a.total_sales) || []));
  const maxDistRev = Math.max(0, ...(f?.distributors.map(d => d.primary_revenue) || []));

  return (
    <Box>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ md: "center" }} mb={3} spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>Reports & Analytics</Typography>
            <Typography variant="body2" color="text.secondary">
              {data
                ? `Period: ${periodLabel}${cityFilter ? ` • Area: ${cityFilter} (figures scoped to this territory)` : ""}`
                : "Select a date range to generate reports"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            {/* From Date (day precision) */}
            <TextField type="date" size="small" label="From" value={fromDate}
              onChange={e => { const v = e.target.value; if (!v) return; setFromDate(v); if (v > toDate) setToDate(v); }}
              InputLabelProps={{ shrink: true }} inputProps={{ max: toDate }}
              sx={{ minWidth: 150, "& .MuiInputBase-root": { fontSize: "0.85rem" } }}
              InputProps={{ startAdornment: <CalendarMonthIcon fontSize="small" sx={{ mr: 0.5, color: "text.secondary", fontSize: 18 }} /> }} />

            {/* To Date (day precision) */}
            <TextField type="date" size="small" label="To" value={toDate}
              onChange={e => { const v = e.target.value; if (!v) return; setToDate(v); if (v < fromDate) setFromDate(v); }}
              InputLabelProps={{ shrink: true }} inputProps={{ min: fromDate, max: todayISO }}
              sx={{ minWidth: 150, "& .MuiInputBase-root": { fontSize: "0.85rem" } }}
              InputProps={{ startAdornment: <CalendarMonthIcon fontSize="small" sx={{ mr: 0.5, color: "text.secondary", fontSize: 18 }} /> }} />

            {/* City Filter */}
            <TextField select size="small" label="City" value={cityFilter || ALL}
              onChange={e => setCityFilter(e.target.value === ALL ? "" : e.target.value)}
              sx={{ minWidth: 160, "& .MuiInputBase-root": { fontSize: "0.85rem" } }}
              InputProps={{ startAdornment: <PlaceIcon fontSize="small" sx={{ mr: 0.5, color: "text.secondary", fontSize: 18 }} /> }}>
              <MenuItem value={ALL}>All Cities</MenuItem>
              {cities.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>

            {/* Export */}
            <Button variant="contained" size="small" startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
              onClick={handleExport} disabled={!data || loading || exporting}
              sx={{ textTransform: "none", fontWeight: 600, px: 1.5, py: 0.8, fontSize: "0.8rem" }}>
              Export
            </Button>
          </Stack>
        </Stack>

        {/* Loading state */}
        {loading && (
          <Box>
            <Grid container spacing={2} mb={3}>
              {[...Array(4)].map((_, i) => <Grid key={i} size={{ xs: 6, md: 3 }}><Skeleton variant="rounded" height={100} /></Grid>)}
            </Grid>
            <Skeleton variant="rounded" height={400} />
          </Box>
        )}

        {!loading && data && f && (
          <>
            {/* ── KPI Cards ─────────────────────────────────────── */}
            <Grid container spacing={2} mb={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Total Revenue" value={fmtFull(data.kpis.total_revenue.value)}
                  change={data.kpis.total_revenue.change} icon={<CurrencyRupeeIcon />}
                  color={theme.palette.success.main} subtitle="vs previous period" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Primary Sales" value={fmtFull(data.kpis.primary_revenue.value)}
                  change={data.kpis.primary_revenue.change} icon={<LocalShippingIcon />} color="#1976d2" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Secondary Sales" value={fmtFull(data.kpis.secondary_revenue.value)}
                  change={data.kpis.secondary_revenue.change} icon={<StorefrontIcon />} color="#7b1fa2" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Outstanding" value={fmtFull(data.kpis.outstanding)}
                  icon={<WarningAmberIcon />} color="#d32f2f" subtitle="Receivables" />
              </Grid>
            </Grid>
            <Grid container spacing={2} mb={3}>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Orders" value={fmtNum(data.kpis.orders.value)}
                  change={data.kpis.orders.change} icon={<ShoppingBagIcon />} color={theme.palette.secondary.main}
                  subtitle={`${data.kpis.stock_requests.value} stock req.`} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="New Clients" value={fmtNum(data.kpis.new_clients.value)}
                  change={data.kpis.new_clients.change} icon={<PersonAddIcon />} color="#ed6c02" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Visits" value={`${data.kpis.visits.completed}/${data.kpis.visits.value}`}
                  icon={<PlaceIcon />} color="#0288d1" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <StatCard title="Leads" value={fmtNum(data.kpis.leads.value)}
                  change={data.kpis.leads.change} icon={<PeopleAltIcon />} color="#9c27b0" />
              </Grid>
            </Grid>

            {/* ── Tabs ─────────────────────────────────────────── */}
            <Paper elevation={0} sx={{ mb: 3, overflow: "hidden" }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                sx={{ px: 1, "& .MuiTab-root": { py: 1.5, fontWeight: 700, fontSize: "0.82rem", minHeight: 46 } }}>
                <Tab icon={<CurrencyRupeeIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Sales" />
                <Tab icon={<GroupsIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Agents & Distributors" />
                <Tab icon={<InventoryIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Products & Inventory" />
                <Tab icon={<PlaceIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Area" />
                <Tab icon={<FactoryIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Operations" />
              </Tabs>
            </Paper>

            {/* ═══ TAB 0: SALES ═══ */}
            {tab === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, lg: 8 }}>
                    <ChartPaper height={390}>
                      <SectionTitle title="Revenue Trend" subtitle={`Primary vs Secondary — ${periodLabel}`} />
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.revenue_trend}>
                            <defs>
                              <linearGradient id="rpPri" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1976d2" stopOpacity={0.2} /><stop offset="95%" stopColor="#1976d2" stopOpacity={0} /></linearGradient>
                              <linearGradient id="rpSec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7b1fa2" stopOpacity={0.2} /><stop offset="95%" stopColor="#7b1fa2" stopOpacity={0} /></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={fmt} />
                            <RTooltip content={<ChartTooltipContent />} />
                            <Area type="monotone" dataKey="primary" name="Primary" stroke="#1976d2" strokeWidth={2.5} fillOpacity={1} fill="url(#rpPri)" />
                            <Area type="monotone" dataKey="secondary" name="Secondary" stroke="#7b1fa2" strokeWidth={2.5} fillOpacity={1} fill="url(#rpSec)" />
                            <Legend />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Box>
                    </ChartPaper>
                  </Grid>
                  <Grid size={{ xs: 12, lg: 4 }}>
                    <ChartPaper height={390}>
                      <SectionTitle title="Revenue Split" subtitle={periodLabel} />
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
                        <Stack direction="row" spacing={3} justifyContent="center" mt={1}>
                          <Box textAlign="center"><Typography variant="caption" color="text.secondary">Primary</Typography><Typography variant="subtitle2" fontWeight={700} color="#1976d2">{fmtFull(data.revenue_split.primary)}</Typography></Box>
                          <Box textAlign="center"><Typography variant="caption" color="text.secondary">Secondary</Typography><Typography variant="subtitle2" fontWeight={700} sx={{ color: "#7b1fa2" }}>{fmtFull(data.revenue_split.secondary)}</Typography></Box>
                        </Stack>
                      </Box>
                    </ChartPaper>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ChartPaper height={400}>
                      <SectionTitle title="Sales by Area" subtitle={cityFilter ? `Filtered: ${cityFilter}` : "Primary vs Secondary"} />
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
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ChartPaper height={400}>
                      <SectionTitle title="Primary Sales by Distributor" subtitle={cityFilter ? `Filtered: ${cityFilter}` : "Pareto — vital few drive 80% of revenue"} />
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ParetoChart data={f.salesByDistributor} nameKey="name" valueKey="total" barName="Revenue" valueFormat={fmtFull} />
                      </Box>
                    </ChartPaper>
                  </Grid>

                  {/* Leads Pipeline (status breakdown) */}
                  <Grid size={{ xs: 12 }}>
                    <ChartPaper height={340} color="#9c27b0">
                      <SectionTitle title="Leads Pipeline" subtitle="Open leads by status" color="#9c27b0"
                        pills={data.leads_by_status.map(l => ({
                          label: l.status.charAt(0).toUpperCase() + l.status.slice(1),
                          value: l.count, color: LEAD_COLORS[l.status] || "#9c27b0",
                        }))} />
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.leads_by_status} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={alpha(theme.palette.divider, 0.1)} />
                            <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                            <YAxis dataKey="status" type="category" width={100} tick={{ fontSize: 11 }} />
                            <RTooltip content={<ChartTooltipContent />} />
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

            {/* ═══ TAB 1: AGENTS & DISTRIBUTORS ═══ */}
            {tab === 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12 }}>
                    <Paper elevation={0} sx={{ overflow: "hidden", border: bdr }}>
                      <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                        <SectionTitle title="Sales Agent Performance" subtitle={`${periodLabel}${cityFilter ? ` — ${cityFilter}` : ""}`} />
                      </Box>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                              {["#", "Agent", "City", "Primary", "Secondary", "Total", "Days", "Visits", "Orders", "Clients"].map((h, i) => (
                                <TableCell key={h} align={i >= 3 ? (i >= 6 ? "center" : "right") : "left"} sx={{ fontWeight: 700, fontSize: "0.75rem" }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {f.agents.length === 0 ? <EmptyRow cols={10} /> : f.agents.map((a, i) => (
                              <TableRow key={a.id} hover>
                                <TableCell><Chip label={i + 1} size="small" sx={{ fontWeight: 700, width: 26, height: 22, fontSize: "0.7rem", bgcolor: i < 3 ? alpha(["#ffd700", "#c0c0c0", "#cd7f32"][i], 0.15) : alpha(theme.palette.divider, 0.08) }} /></TableCell>
                                <TableCell><Stack direction="row" alignItems="center" spacing={1}><Avatar sx={{ width: 28, height: 28, bgcolor: alpha(CHART_COLORS[i % 10], 0.12), color: CHART_COLORS[i % 10], fontSize: 12 }}>{a.name.charAt(0)}</Avatar><Typography variant="body2" fontWeight={600} noWrap onClick={() => setDrill({ type: "agent", id: a.id, name: a.name })} sx={{ cursor: "pointer", "&:hover": { color: "primary.main", textDecoration: "underline" } }}>{a.name}</Typography></Stack></TableCell>
                                <TableCell><Typography variant="caption" color="text.secondary">{a.city || "—"}</Typography></TableCell>
                                <TableCell align="right"><Typography variant="body2" fontWeight={600} color="primary.main">{fmtFull(a.primary_sales)}</Typography></TableCell>
                                <TableCell align="right"><Typography variant="body2" fontWeight={600} sx={{ color: "#7b1fa2" }}>{fmtFull(a.secondary_sales)}</Typography></TableCell>
                                <HeatCell value={a.total_sales} min={0} max={maxAgentTotal} direction="highGood" format={fmtFull} align="right" />
                                <TableCell align="center"><Tooltip title="Attendance: distinct field-report days in period"><span>{a.attendance_days}</span></Tooltip></TableCell>
                                <TableCell align="center">{a.visits}</TableCell>
                                <TableCell align="center">{a.orders}</TableCell>
                                <TableCell align="center"><Chip label={a.new_clients} size="small" color={a.new_clients > 0 ? "success" : "default"} sx={{ fontWeight: 700, height: 20, fontSize: "0.7rem" }} /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Paper elevation={0} sx={{ overflow: "hidden", border: bdr }}>
                      <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                        <SectionTitle title="Distributor Performance" subtitle={`${periodLabel}${cityFilter ? ` — ${cityFilter}` : ""}`} />
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
                            {f.distributors.length === 0 ? <EmptyRow cols={7} /> : f.distributors.map((d, i) => (
                              <TableRow key={d.id} hover>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell><Stack direction="row" alignItems="center" spacing={1}><Avatar sx={{ width: 26, height: 26, bgcolor: alpha("#1976d2", 0.1), color: "#1976d2", fontSize: 11 }}>{d.name.charAt(0)}</Avatar><Typography variant="body2" fontWeight={600} noWrap onClick={() => setDrill({ type: "distributor", id: d.id, name: d.name })} sx={{ cursor: "pointer", "&:hover": { color: "primary.main", textDecoration: "underline" } }}>{d.name}</Typography></Stack></TableCell>
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

                  {/* Attendance Trend (field vs office) */}
                  <Grid size={{ xs: 12 }}>
                    <ChartPaper height={320}>
                      <SectionTitle title="Attendance Trend" subtitle="Field vs office staff present — last 7 days" />
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.attendance_trend}>
                            <defs>
                              <linearGradient id="attField" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0288d1" stopOpacity={0.25} /><stop offset="95%" stopColor="#0288d1" stopOpacity={0} /></linearGradient>
                              <linearGradient id="attOffice" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2e7d32" stopOpacity={0.25} /><stop offset="95%" stopColor="#2e7d32" stopOpacity={0} /></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                            <RTooltip content={<ChartTooltipContent />} />
                            <Area type="monotone" dataKey="field" name="Field" stroke="#0288d1" strokeWidth={2.5} fillOpacity={1} fill="url(#attField)" />
                            <Area type="monotone" dataKey="office" name="Office" stroke="#2e7d32" strokeWidth={2.5} fillOpacity={1} fill="url(#attOffice)" />
                            <Legend />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Box>
                    </ChartPaper>
                  </Grid>
                </Grid>
              </motion.div>
            )}

            {/* ═══ TAB 2: PRODUCTS & INVENTORY ═══ */}
            {tab === 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 6, md: 3 }}><StatCard title="Active Products" value={fmtNum(data.warehouse.total_products)} icon={<InventoryIcon />} color="#1976d2" /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><StatCard title="Low Stock" value={fmtNum(data.warehouse.low_stock)} icon={<WarningAmberIcon />} color={data.warehouse.low_stock > 0 ? "#d32f2f" : "#2e7d32"} /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><StatCard title="Inventory Value" value={fmtFull(data.warehouse.inventory_value)} icon={<CurrencyRupeeIcon />} color="#2e7d32" /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><StatCard title="Stock Requests" value={fmtNum(data.kpis.stock_requests.value)} change={data.kpis.stock_requests.change} icon={<LocalShippingIcon />} color="#ed6c02" /></Grid>
                  <Grid size={{ xs: 12 }}>
                    <ChartPaper height={400}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                        <SectionTitle title={productMetric === "revenue" ? "Product Revenue" : "Product Units Sold"} subtitle={`Primary vs Secondary — ${periodLabel}`} />
                        <Stack direction="row" spacing={0.5}>
                          {(["revenue", "units"] as const).map(m => (
                            <Button key={m} size="small" variant={productMetric === m ? "contained" : "outlined"}
                              onClick={() => setProductMetric(m)}
                              sx={{ textTransform: "none", py: 0.2, px: 1.2, minWidth: 0, fontSize: "0.72rem" }}>
                              {m === "revenue" ? "₹ Revenue" : "Units"}
                            </Button>
                          ))}
                        </Stack>
                      </Stack>
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.sales_by_product}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={65} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={productMetric === "revenue" ? fmt : fmtNum} />
                            <RTooltip formatter={(v) => productMetric === "revenue" ? fmtFull(Number(v ?? 0)) : `${fmtNum(Number(v ?? 0))} units`} /><Legend />
                            <Bar dataKey={productMetric === "revenue" ? "primary" : "primary_qty"} name="Primary" fill="#1976d2" radius={[4, 4, 0, 0]} barSize={18} />
                            <Bar dataKey={productMetric === "revenue" ? "secondary" : "secondary_qty"} name="Secondary" fill="#7b1fa2" radius={[4, 4, 0, 0]} barSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </ChartPaper>
                  </Grid>
                  <Grid size={{ xs: 12, lg: 8 }}>
                    <ChartPaper height={420}>
                      <SectionTitle title="Stock Levels" subtitle="Current stock vs Threshold" />
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
                  <Grid size={{ xs: 12, lg: 4 }}>
                    <Paper elevation={0} sx={{ border: bdr, height: 420, display: "flex", flexDirection: "column" }}>
                      <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                        <SectionTitle title="Low Stock Alerts" />
                      </Box>
                      <TableContainer sx={{ flex: 1 }}>
                        <Table size="small" stickyHeader>
                          <TableHead><TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Product</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Stock</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.73rem" }}>Min</TableCell>
                          </TableRow></TableHead>
                          <TableBody>
                            {data.warehouse.low_stock_alerts.length === 0 ? <EmptyRow cols={3} msg="All stocked up!" /> :
                              data.warehouse.low_stock_alerts.map((p, i) => (
                                <TableRow key={i} hover>
                                  <TableCell><Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 140 }}>{p.name}</Typography></TableCell>
                                  <TableCell align="right"><Typography variant="body2" fontWeight={700} color="error.main">{p.stock}</Typography></TableCell>
                                  <TableCell align="right"><Typography variant="body2" color="text.secondary">{p.threshold}</Typography></TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>

                  {/* Top Products by Distributor (primary) */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ overflow: "hidden", border: bdr, height: 420, display: "flex", flexDirection: "column" }}>
                      <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                        <SectionTitle title="Top Products by Distributor" subtitle="Primary — top 5 products each distributor moves" />
                      </Box>
                      <TableContainer sx={{ flex: 1 }}>
                        <Table size="small" stickyHeader>
                          <TableHead><TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Distributor</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Sales</TableCell>
                          </TableRow></TableHead>
                          <TableBody>
                            {data.product_by_distributor.length === 0 ? <EmptyRow cols={4} /> : data.product_by_distributor.flatMap(e =>
                              e.products.map((p, j) => (
                                <TableRow key={`${e.entity}-${p.product}-${j}`} hover>
                                  <TableCell><Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120, display: "block" }}>{j === 0 ? e.entity : ""}</Typography></TableCell>
                                  <TableCell><Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 140 }}>{p.product}</Typography></TableCell>
                                  <TableCell align="right">{fmtNum(p.qty)}</TableCell>
                                  <TableCell align="right"><Typography variant="body2" fontWeight={700} color="primary.main">{fmtFull(p.total)}</Typography></TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>

                  {/* Top Products by Agent (secondary) */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ overflow: "hidden", border: bdr, height: 420, display: "flex", flexDirection: "column" }}>
                      <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                        <SectionTitle title="Top Products by Agent" subtitle="Secondary — top 5 products each agent sells" />
                      </Box>
                      <TableContainer sx={{ flex: 1 }}>
                        <Table size="small" stickyHeader>
                          <TableHead><TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Agent</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Sales</TableCell>
                          </TableRow></TableHead>
                          <TableBody>
                            {data.product_by_agent.length === 0 ? <EmptyRow cols={4} /> : data.product_by_agent.flatMap(e =>
                              e.products.map((p, j) => (
                                <TableRow key={`${e.entity}-${p.product}-${j}`} hover>
                                  <TableCell><Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120, display: "block" }}>{j === 0 ? e.entity : ""}</Typography></TableCell>
                                  <TableCell><Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 140 }}>{p.product}</Typography></TableCell>
                                  <TableCell align="right">{fmtNum(p.qty)}</TableCell>
                                  <TableCell align="right"><Typography variant="body2" fontWeight={700} sx={{ color: "#7b1fa2" }}>{fmtFull(p.total)}</Typography></TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </motion.div>
            )}

            {/* ═══ TAB 3: AREA ═══ */}
            {tab === 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ChartPaper height={400}>
                      <SectionTitle title="Revenue by Area" subtitle={cityFilter ? `Showing: ${cityFilter}` : periodLabel} />
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
                                <TableCell><Typography variant="body2" fontWeight={600} noWrap onClick={() => setDrill({ type: "agent", id: a.id, name: a.name })} sx={{ cursor: "pointer", "&:hover": { color: "primary.main", textDecoration: "underline" } }}>{a.name}</Typography></TableCell>
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
                                <TableCell><Typography variant="body2" fontWeight={600} noWrap onClick={() => setDrill({ type: "distributor", id: d.id, name: d.name })} sx={{ cursor: "pointer", "&:hover": { color: "primary.main", textDecoration: "underline" } }}>{d.name}</Typography></TableCell>
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

                  {/* Leads by Area */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ChartPaper height={400}>
                      <SectionTitle title="Leads by Area" subtitle={cityFilter ? `Showing: ${cityFilter}` : "New leads in period"} />
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={f.leadsByArea}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                            <XAxis dataKey="area" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={55} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                            <RTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]} barSize={26}>
                              {f.leadsByArea.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % 10]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </ChartPaper>
                  </Grid>

                  {/* Top Products by Area */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ overflow: "hidden", border: bdr, height: 400, display: "flex", flexDirection: "column" }}>
                      <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                        <SectionTitle title="Top Products by Area" subtitle={cityFilter ? `Showing: ${cityFilter}` : "Secondary sales — top 5 per area"} />
                      </Box>
                      <TableContainer sx={{ flex: 1 }}>
                        <Table size="small" stickyHeader>
                          <TableHead><TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Area</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Sales</TableCell>
                          </TableRow></TableHead>
                          <TableBody>
                            {f.productByArea.length === 0 ? <EmptyRow cols={4} /> : f.productByArea.flatMap(a =>
                              a.products.map((p, j) => (
                                <TableRow key={`${a.area}-${p.product}-${j}`} hover>
                                  <TableCell><Typography variant="caption" color="text.secondary">{j === 0 ? a.area : ""}</Typography></TableCell>
                                  <TableCell><Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 150 }}>{p.product}</Typography></TableCell>
                                  <TableCell align="right">{fmtNum(p.qty)}</TableCell>
                                  <TableCell align="right"><Typography variant="body2" fontWeight={700}>{fmtFull(p.total)}</Typography></TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  </Grid>
                </Grid>
              </motion.div>
            )}

            {/* ═══ TAB 4: OPERATIONS ═══ */}
            {tab === 4 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12 }}><Typography variant="overline" fontWeight={800} color="text.secondary" sx={{ letterSpacing: 1.5 }}>Production</Typography></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><StatCard title="Work Orders" value={fmtNum(data.production.work_orders_total)} icon={<FactoryIcon />} color="#1976d2" /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><StatCard title="In Progress" value={fmtNum(data.production.work_orders_in_progress)} icon={<FactoryIcon />} color="#ed6c02" /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><StatCard title="Completed" value={fmtNum(data.production.work_orders_completed)} icon={<CheckCircleIcon />} color="#2e7d32" /></Grid>
                  <Grid size={{ xs: 6, md: 3 }}><StatCard title="Active Plans" value={fmtNum(data.production.active_plans)} icon={<AssessmentIcon />} color="#9c27b0" /></Grid>
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
                      <SectionTitle title="Purchase Overview" subtitle={periodLabel} />
                      <Grid container spacing={2} sx={{ flex: 1 }}>
                        <Grid size={{ xs: 6 }}>
                          <Stack direction="row" alignItems="center" spacing={1.5} py={1.5}><Avatar variant="rounded" sx={{ bgcolor: alpha("#ed6c02", 0.1), color: "#ed6c02", width: 36, height: 36 }}><ShoppingBagIcon /></Avatar><Box><Typography variant="caption" color="text.secondary">Pending POs</Typography><Typography variant="subtitle2" fontWeight={700}>{data.purchase.pending_pos}</Typography></Box></Stack>
                          <Divider />
                          <Stack direction="row" alignItems="center" spacing={1.5} py={1.5}><Avatar variant="rounded" sx={{ bgcolor: alpha("#9c27b0", 0.1), color: "#9c27b0", width: 36, height: 36 }}><InventoryIcon /></Avatar><Box><Typography variant="caption" color="text.secondary">Pending MRs</Typography><Typography variant="subtitle2" fontWeight={700}>{data.purchase.pending_mrs}</Typography></Box></Stack>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Stack direction="row" alignItems="center" spacing={1.5} py={1.5}><Avatar variant="rounded" sx={{ bgcolor: alpha("#2e7d32", 0.1), color: "#2e7d32", width: 36, height: 36 }}><CurrencyRupeeIcon /></Avatar><Box><Typography variant="caption" color="text.secondary">Approved PO Value</Typography><Typography variant="subtitle2" fontWeight={700}>{fmtFull(data.purchase.approved_value)}</Typography></Box></Stack>
                          <Divider />
                          <Stack direction="row" alignItems="center" spacing={1.5} py={1.5}><Avatar variant="rounded" sx={{ bgcolor: alpha("#1976d2", 0.1), color: "#1976d2", width: 36, height: 36 }}><AssessmentIcon /></Avatar><Box><Typography variant="caption" color="text.secondary">Approved Count</Typography><Typography variant="subtitle2" fontWeight={700}>{data.purchase.approved_count}</Typography></Box></Stack>
                        </Grid>
                      </Grid>
                    </ChartPaper>
                  </Grid>
                </Grid>
              </motion.div>
            )}
          </>
        )}

      </motion.div>

      {/* Drill-down: single agent / distributor */}
      <EntityDetailDialog entity={drill} fromDate={fromDate} toDate={toDate} onClose={() => setDrill(null)} />
    </Box>
  );
}

"use client";
import { toast } from "sonner";

import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Grid, Paper, Typography, Button, Stack, Avatar, Chip, Table,
  TableBody, TableCell, TableContainer, TableRow, useTheme, alpha,
  CircularProgress, Tooltip, ToggleButton, ToggleButtonGroup, TextField,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert
} from "@mui/material";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";

// Icons
import { ShoppingCartIcon, AssignmentIcon, LocalShippingIcon, ArrowForwardIcon, ArrowUpwardIcon, ArrowDownwardIcon, CheckCircleIcon, CancelIcon, WarningAmberIcon, Inventory2Icon, ShowChartIcon } from "@/components/icons";

import { purchaseService, MaterialRequest, PurchaseOrder } from "@/lib/purchase-service";
import { authService, UserProfile } from "@/lib/auth-service";
import { warehouseService, LowStockItem } from "@/lib/warehouse-service";

// Compact Indian-currency formatting (₹1.2 Cr / ₹3.4 L / ₹5.6 K) for KPI tiles.
// The full value is always available on hover via a tooltip.
const formatINRShort = (n: number) => {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  if (abs >= 1e7) return `₹${(num / 1e7).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (abs >= 1e5) return `₹${(num / 1e5).toFixed(2).replace(/\.?0+$/, "")} L`;
  if (abs >= 1e3) return `₹${(num / 1e3).toFixed(1).replace(/\.?0+$/, "")} K`;
  return `₹${num.toLocaleString("en-IN")}`;
};
const formatINRFull = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

type RangeKey = "all" | "today" | "week" | "month" | "custom";

// Resolve a range key (and optional custom dates) to the current window and the
// equivalent previous window, used for trend comparison.
function resolveRange(range: RangeKey, customStart: string, customEnd: string) {
  if (range === "all") return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === "today") {
    const prevStart = new Date(startOfToday); prevStart.setDate(prevStart.getDate() - 1);
    return { start: startOfToday, end: now, prevStart, prevEnd: startOfToday };
  }
  if (range === "week") {
    const day = (startOfToday.getDay() + 6) % 7; // Monday = 0
    const start = new Date(startOfToday); start.setDate(start.getDate() - day);
    const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
    return { start, end: now, prevStart, prevEnd: start };
  }
  if (range === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { start, end: now, prevStart, prevEnd: start };
  }
  // custom
  if (!customStart || !customEnd) return null;
  const start = new Date(customStart);
  const end = new Date(customEnd); end.setHours(23, 59, 59, 999);
  const lenMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start);
  const prevStart = new Date(start.getTime() - lenMs);
  return { start, end, prevStart, prevEnd };
}

const inWindow = (dateStr: string | undefined, start: Date, end: Date) => {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  return d >= start.getTime() && d < end.getTime();
};

const KpiCard = ({ title, value, fullValue, icon, color, trend, trendGoodWhenUp = true, href }: any) => {
  const theme = useTheme();
  const hasTrend = trend && Number.isFinite(trend.pct);
  const up = hasTrend && trend.pct >= 0;
  const good = hasTrend && (up === trendGoodWhenUp);
  const trendColor = !hasTrend ? undefined : (trend.pct === 0 ? theme.palette.text.disabled : (good ? theme.palette.success.main : theme.palette.error.main));

  const content = (
    <Paper
      data-animate-group
      elevation={0}
      sx={{
        p: 3,
        height: "100%",
        bgcolor: "background.paper",
        boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
        border: `1px solid ${alpha(color, 0.1)}`,
        position: "relative",
        overflow: "hidden",
        cursor: href ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': href ? {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 24px ${alpha(color, 0.15)}`,
          borderColor: alpha(color, 0.3),
        } : {},
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            fontWeight={600}
            gutterBottom
          >
            {title}
          </Typography>
          {fullValue ? (
            <Tooltip title={fullValue} arrow>
              <Typography variant="h5" fontWeight={800} color="text.primary" sx={{ wordBreak: 'break-word', lineHeight: 1.2, display: 'inline-block', cursor: 'help' }}>
                {value}
              </Typography>
            </Tooltip>
          ) : (
            <Typography variant="h5" fontWeight={800} color="text.primary" sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
              {value}
            </Typography>
          )}
          {hasTrend && (
            <Stack direction="row" alignItems="center" spacing={0.3} sx={{ mt: 0.5 }}>
              {trend.pct === 0 ? null : up ? <ArrowUpwardIcon sx={{ fontSize: 14, color: trendColor }} /> : <ArrowDownwardIcon sx={{ fontSize: 14, color: trendColor }} />}
              <Typography variant="caption" sx={{ color: trendColor, fontWeight: 800 }}>
                {trend.pct === 0 ? "No change" : `${Math.abs(trend.pct).toFixed(0)}% vs prev`}
              </Typography>
            </Stack>
          )}
        </Box>
        <Avatar
          variant="rounded"
          sx={{
            bgcolor: alpha(color, 0.1),
            color: color,
            width: 48,
            height: 48,
            borderRadius: 1,
            flexShrink: 0,
          }}
        >
          {icon}
        </Avatar>
      </Stack>
    </Paper>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
        {content}
      </Link>
    );
  }
  return content;
};

// Sum / count metrics over a (possibly unbounded) window of POs + MRs.
function computeStats(orders: PurchaseOrder[], requests: MaterialRequest[], win: { start: Date; end: Date } | null) {
  const poIn = win ? orders.filter(o => inWindow(o.order_date, win.start, win.end)) : orders;
  const mrIn = win ? requests.filter(r => inWindow(r.created_at, win.start, win.end)) : requests;
  return {
    totalPaid: poIn.filter(o => o.payment_status === 'paid').reduce((a, c) => a + (Number(c.total) || 0), 0),
    outstanding: poIn.filter(o => o.payment_status !== 'paid').reduce((a, c) => a + (Number(c.total) || 0), 0),
    pendingReqs: mrIn.filter(r => r.request_status === 'pending_approval').length,
    activePOs: poIn.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length,
  };
}

const pctChange = (cur: number, prev: number) => {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
};

const PRIORITY_META: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'error' }> = {
  low: { label: 'Low', color: 'default' },
  medium: { label: 'Medium', color: 'info' },
  high: { label: 'High', color: 'warning' },
  critical: { label: 'Critical', color: 'error' },
};

export default function PurchaseOverview() {
  const theme = useTheme();
  const [data, setData] = useState({
    requests: [] as MaterialRequest[],
    orders: [] as PurchaseOrder[],
    suppliersCount: 0,
    loading: true
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);

  const [range, setRange] = useState<RangeKey>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [spendGranularity, setSpendGranularity] = useState<"month" | "week">("month");

  const [acting, setActing] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: number; reason: string }>({ open: false, id: 0, reason: "" });
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: "", severity: "success" });

  const fetchDashboard = async () => {
    try {
      setData(prev => ({ ...prev, loading: true }));
      const [reqs, orders, suppliers, user] = await Promise.all([
        purchaseService.getMaterialRequests({ page_size: "1000" }),
        purchaseService.getPurchaseOrders({ page_size: "1000" }),
        purchaseService.getSuppliers({ page_size: "1000" }),
        authService.getCurrentUser().catch(() => null),
      ]);
      const suppliersList = suppliers.results || [];
      const activeSuppliers = suppliersList.filter((s: any) => s.is_active);
      setData({
        requests: reqs.results || [],
        orders: orders.results || [],
        suppliersCount: activeSuppliers.length,
        loading: false
      });
      setCurrentUser(user);
    } catch (error) {
      console.error("Dashboard error:", error);
      toast.error("Failed to load purchase dashboard.");
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchDashboard();
    // Low-stock alerts are non-critical; load independently so a failure here
    // never blocks the dashboard.
    warehouseService.getLowStockItems()
      .then(res => setLowStock(res.results || []))
      .catch(() => setLowStock([]));
  }, []);

  const isPurchaseManager = currentUser?.role === 'purchase_manager' || currentUser?.role === 'admin';

  const win = useMemo(() => resolveRange(range, customStart, customEnd), [range, customStart, customEnd]);

  const stats = useMemo(() => {
    const cur = computeStats(data.orders, data.requests, win ? { start: win.start, end: win.end } : null);
    if (!win) return { ...cur, trends: null as any };
    const prev = computeStats(data.orders, data.requests, { start: win.prevStart, end: win.prevEnd });
    return {
      ...cur,
      trends: {
        totalPaid: { pct: pctChange(cur.totalPaid, prev.totalPaid) },
        outstanding: { pct: pctChange(cur.outstanding, prev.outstanding) },
        pendingReqs: { pct: pctChange(cur.pendingReqs, prev.pendingReqs) },
        activePOs: { pct: pctChange(cur.activePOs, prev.activePOs) },
      }
    };
  }, [data.orders, data.requests, win]);

  // Monthly spend trend (last 6 calendar months) — independent of the KPI window.
  const monthlySpend = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString('en-IN', { month: 'short' }),
        total: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    data.orders.forEach(o => {
      if (!o.order_date) return;
      const d = new Date(o.order_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const i = idx.get(key);
      if (i != null) buckets[i].total += Number(o.total) || 0;
    });
    return buckets;
  }, [data.orders]);

  // Weekly spend trend (last 8 weeks, Monday-anchored).
  const weeklySpend = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const buckets: { start: number; label: string; total: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(monday); ws.setDate(ws.getDate() - i * 7);
      buckets.push({ start: ws.getTime(), label: ws.toLocaleString('en-IN', { day: '2-digit', month: 'short' }), total: 0 });
    }
    data.orders.forEach(o => {
      if (!o.order_date) return;
      const d = new Date(o.order_date).getTime();
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (d >= buckets[i].start && d < buckets[i].start + 7 * 86400000) {
          buckets[i].total += Number(o.total) || 0;
          break;
        }
      }
    });
    return buckets.map(b => ({ label: b.label, total: b.total }));
  }, [data.orders]);

  const spendData = spendGranularity === 'week' ? weeklySpend : monthlySpend;

  const daysSince = (dateStr?: string) => {
    if (!dateStr) return null;
    const ms = Date.now() - new Date(dateStr).getTime();
    return Math.max(0, Math.floor(ms / 86400000));
  };

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const isPoOverdue = (po: PurchaseOrder) => {
    if (!po.delivery_date) return false;
    const settled = ['received', 'short_closed', 'cancelled'].includes(po.receipt_status || '');
    return !settled && new Date(po.delivery_date) < todayMidnight;
  };
  const poStatus = (po: PurchaseOrder): { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' } => {
    if (po.receipt_status === 'cancelled') return { label: 'Cancelled', color: 'default' };
    if (po.receipt_status === 'short_closed') return { label: 'Short Closed', color: 'warning' };
    if (po.receipt_status === 'received') return { label: 'Delivered', color: 'success' };
    if (isPoOverdue(po)) return { label: 'Overdue', color: 'error' };
    return { label: 'Active', color: 'info' };
  };

  const handleApprove = async (id: number) => {
    try {
      setActing(true);
      await purchaseService.approveMaterialRequest(id);
      setSnackbar({ open: true, message: "Request approved", severity: "success" });
      await fetchDashboard();
    } catch (e: any) {
      // Approval requires every item to have a supplier + rate; surface that.
      setSnackbar({ open: true, message: e?.message || "Could not approve — open the request to complete supplier/rate.", severity: "error" });
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.reason.trim()) {
      setSnackbar({ open: true, message: "A rejection reason is required", severity: "warning" });
      return;
    }
    try {
      setActing(true);
      await purchaseService.rejectMaterialRequest(rejectDialog.id, rejectDialog.reason.trim());
      setSnackbar({ open: true, message: "Request rejected", severity: "warning" });
      setRejectDialog({ open: false, id: 0, reason: "" });
      await fetchDashboard();
    } catch (e: any) {
      setSnackbar({ open: true, message: e?.message || "Failed to reject", severity: "error" });
    } finally {
      setActing(false);
    }
  };

  if (data.loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // Sort by newest first
  const recentRequests = [...data.requests].sort((a, b) => b.id - a.id).slice(0, 5);
  const recentOrders = [...data.orders].sort((a, b) => b.id - a.id).slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* HEADER & ACTIONS */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        mb={4}
      >
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
            Procurement Overview
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time monitoring of spending and procurement pipeline.
          </Typography>
        </Box>
        <Link href="/material-requests" style={{ textDecoration: 'none' }}>
          <Button
            variant="contained"
            startIcon={<AssignmentIcon />}
            sx={{
              px: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
            }}
          >
            Manage Requests
          </Button>
        </Link>
      </Stack>

      {/* DATE RANGE FILTER */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} mb={3}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={range}
          onChange={(_, v) => { if (v) setRange(v); }}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, px: 2 } }}
          data-testid="overview-range-toggle"
        >
          <ToggleButton value="all" data-testid="overview-range-all">All Time</ToggleButton>
          <ToggleButton value="today" data-testid="overview-range-today">Today</ToggleButton>
          <ToggleButton value="week" data-testid="overview-range-week">This Week</ToggleButton>
          <ToggleButton value="month" data-testid="overview-range-month">This Month</ToggleButton>
          <ToggleButton value="custom" data-testid="overview-range-custom">Custom</ToggleButton>
        </ToggleButtonGroup>
        {range === 'custom' && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} data-testid="overview-custom-from" />
            <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} data-testid="overview-custom-to" />
          </Stack>
        )}
        {range !== 'all' && (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            KPIs reflect POs/requests raised in the selected window; trend compares the previous window.
          </Typography>
        )}
      </Stack>

      {/* KPI CARDS */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard
            title="TOTAL PAID"
            value={formatINRShort(stats.totalPaid)}
            fullValue={formatINRFull(stats.totalPaid)}
            icon={<CheckCircleIcon />}
            color={theme.palette.success.main}
            trend={stats.trends?.totalPaid}
            trendGoodWhenUp
            href="/purchase-orders?payment=paid"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard
            title="OUTSTANDING"
            value={formatINRShort(stats.outstanding)}
            fullValue={formatINRFull(stats.outstanding)}
            icon={<WarningAmberIcon />}
            color={theme.palette.error.main}
            trend={stats.trends?.outstanding}
            trendGoodWhenUp={false}
            href="/purchase-orders?payment=unpaid"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard
            title="PENDING MR"
            value={stats.pendingReqs}
            icon={<AssignmentIcon />}
            color={theme.palette.warning.main}
            trend={stats.trends?.pendingReqs}
            trendGoodWhenUp={false}
            href="/material-requests?status=pending_approval"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard
            title="ACTIVE POs"
            value={stats.activePOs}
            icon={<ShoppingCartIcon />}
            color={theme.palette.info.main}
            trend={stats.trends?.activePOs}
            trendGoodWhenUp
            href="/purchase-orders?status=active"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <KpiCard
            title="ACTIVE SUPPLIERS"
            value={data.suppliersCount}
            icon={<LocalShippingIcon />}
            color={theme.palette.success.main}
            href="/suppliers?status=active"
          />
        </Grid>
      </Grid>

      {/* SPEND TREND + LOW STOCK */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 3, height: '100%', boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShowChartIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Spend Trend ({spendGranularity === 'week' ? 'last 8 weeks' : 'last 6 months'})
                </Typography>
              </Box>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={spendGranularity}
                onChange={(_, v) => { if (v) setSpendGranularity(v); }}
                sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 700, py: 0.2, px: 1.5 } }}
                data-testid="overview-spend-granularity"
              >
                <ToggleButton value="week" data-testid="overview-spend-weekly">Weekly</ToggleButton>
                <ToggleButton value="month" data-testid="overview-spend-monthly">Monthly</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {spendData.every(m => m.total === 0) ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No purchase-order spend recorded yet.</Typography>
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.text.primary, 0.08)} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatINRShort(v).replace('₹', '')} width={48} />
                    <RechartsTooltip
                      formatter={(v: any) => [formatINRFull(Number(v)), 'Spend']}
                      cursor={{ fill: alpha(theme.palette.primary.main, 0.05) }}
                      contentStyle={{ borderRadius: 8, border: `1px solid ${theme.palette.divider}`, fontSize: 13 }}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {spendData.map((m, i) => (
                        <Cell key={i} fill={i === spendData.length - 1 ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.45)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, height: '100%', boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Inventory2Icon sx={{ color: theme.palette.error.main }} />
                <Typography variant="h6" fontWeight={700}>Low Stock Alerts</Typography>
              </Box>
              {lowStock.length > 0 && (
                <Chip label={lowStock.length} size="small" color="error" sx={{ fontWeight: 800 }} />
              )}
            </Box>
            {lowStock.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: theme.palette.success.main, opacity: 0.7 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>All raw materials are above their reorder level.</Typography>
              </Box>
            ) : (
              <Stack spacing={1} sx={{ maxHeight: 280, overflowY: 'auto' }}>
                {lowStock.slice(0, 8).map((it) => (
                  <Stack
                    key={it.id}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    data-testid={`overview-lowstock-${it.id}`}
                    sx={{ p: 1.2, borderRadius: 1, border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`, bgcolor: alpha(theme.palette.error.main, it.is_out_of_stock ? 0.06 : 0.02) }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap title={it.item_name}>{it.item_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        On hand: <b>{it.current_stock}</b> {it.uom} · Reorder at {it.reorder_level}
                      </Typography>
                    </Box>
                    <Chip
                      label={it.is_out_of_stock ? 'OUT' : `−${it.shortfall}`}
                      size="small"
                      color="error"
                      variant={it.is_out_of_stock ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 800, flexShrink: 0, ml: 1 }}
                    />
                  </Stack>
                ))}
                {lowStock.length > 8 && (
                  <Link href="/warehouse/raw-materials" style={{ textDecoration: 'none' }}>
                    <Button size="small" fullWidth sx={{ textTransform: 'none' }}>View all {lowStock.length} low-stock items →</Button>
                  </Link>
                )}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* RECENT DATA */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, minHeight: 400, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
            <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={700}>Recent Material Requests</Typography>
              <Link href="/material-requests">
                <Button size="small" endIcon={<ArrowForwardIcon />}>View All</Button>
              </Link>
            </Box>
            <TableContainer>
              <Table>
                <TableBody>
                  {recentRequests.map((row) => {
                    const pr = PRIORITY_META[row.priority || 'medium'] || PRIORITY_META.medium;
                    const isPending = row.request_status === 'pending_approval';
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="subtitle2" fontWeight={700}>{row.request_number}</Typography>
                            <Chip
                              label={pr.label}
                              size="small"
                              color={pr.color}
                              variant={(row.priority === 'high' || row.priority === 'critical') ? 'filled' : 'outlined'}
                              sx={{ fontWeight: 800, fontSize: '0.6rem', height: 18 }}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {row.department}{row.created_at ? ` • ${new Date(row.created_at).toLocaleDateString('en-IN')}` : ''}
                          </Typography>
                          {isPending && (() => {
                            const d = daysSince(row.created_at);
                            if (d == null) return null;
                            const stale = d >= 3;
                            return (
                              <Typography variant="caption" sx={{ fontWeight: 700, color: stale ? 'error.main' : 'text.secondary' }}>
                                Pending {d === 0 ? 'today' : `${d}d`}{stale ? ' — stale' : ''}
                              </Typography>
                            );
                          })()}
                        </TableCell>
                        <TableCell align="right">
                          {isPending && isPurchaseManager ? (
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="Approve">
                                <span>
                                  <IconButton size="small" disabled={acting} onClick={() => handleApprove(row.id)} data-testid={`overview-approve-${row.id}`} sx={{ color: theme.palette.success.main }}>
                                    <CheckCircleIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <span>
                                  <IconButton size="small" disabled={acting} onClick={() => setRejectDialog({ open: true, id: row.id, reason: "" })} data-testid={`overview-reject-${row.id}`} sx={{ color: theme.palette.error.main }}>
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          ) : (
                            <Chip
                              label={isPending ? 'REQUESTED' : row.request_status?.replace(/_/g, ' ').toUpperCase()}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 800, fontSize: '0.65rem' }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {recentRequests.length === 0 && (
                    <TableRow><TableCell><Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No material requests yet.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, minHeight: 400, boxShadow: "0px 4px 20px rgba(0,0,0,0.02)" }}>
            <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={700}>Recent Purchase Orders</Typography>
              <Link href="/purchase-orders">
                <Button size="small" endIcon={<ArrowForwardIcon />}>View All</Button>
              </Link>
            </Box>
            <TableContainer>
              <Table>
                <TableBody>
                  {recentOrders.map((row) => {
                    const st = poStatus(row);
                    const overdue = st.label === 'Overdue';
                    return (
                      <TableRow key={row.id} hover sx={overdue ? { bgcolor: alpha(theme.palette.error.main, 0.06) } : undefined}>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="subtitle2" fontWeight={700}>{row.po_number}</Typography>
                            <Chip label={st.label} size="small" color={st.color} variant={overdue ? 'filled' : 'outlined'} sx={{ fontWeight: 800, fontSize: '0.6rem', height: 18 }} />
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{row.supplier_name}</Typography>
                          {row.delivery_date && (
                            <Typography variant="caption" color={overdue ? 'error.main' : 'text.secondary'} sx={{ display: 'block', fontWeight: overdue ? 700 : 400 }}>
                              Due {new Date(row.delivery_date).toLocaleDateString('en-IN')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="subtitle2" fontWeight={800} color="primary">{formatINRFull(row.total)}</Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {recentOrders.length === 0 && (
                    <TableRow><TableCell><Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No purchase orders yet.</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Reject reason dialog (overview quick action) */}
      <Dialog open={rejectDialog.open} onClose={() => setRejectDialog({ open: false, id: 0, reason: "" })} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Reject Material Request</DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
            A reason is required and is recorded in the request's activity log.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Rejection reason"
            value={rejectDialog.reason}
            onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 500, "data-testid": "overview-reject-reason-input" } as any }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog({ open: false, id: 0, reason: "" })} color="inherit">Cancel</Button>
          <Button onClick={handleReject} variant="contained" color="error" disabled={acting || !rejectDialog.reason.trim()} data-testid="overview-reject-confirm-btn">
            Reject Request
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 1, fontWeight: 700 }}>{snackbar.message}</Alert>
      </Snackbar>
    </motion.div>
  );
}

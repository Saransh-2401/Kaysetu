"use client";
import { toast } from "sonner";
import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { analyticsService } from "@/lib/analytics-service";

// Icons
import { DownloadIcon, AssessmentIcon, HistoryIcon, TrendingUpIcon, WarningAmberIcon, RefreshIcon, CallMadeIcon, CategoryIcon } from "@/components/icons";

interface TopMover {
  name: string;
  category: string;
  value: number;
}

interface AgingData {
  name: string;
  value: number;
  color: string;
}

interface SlowMovingItem {
  id: string;
  name: string;
  warehouse: string;
  days: number;
  value: number;
}

interface MovementTrend {
  day: string;
  inbound: number;
  outbound: number;
}

interface WarehouseData {
  kpis?: {
    inventory_turnover?: string;
    inventory_turnover_target?: string;
    dead_stock_value?: string;
    fill_rate?: string;
    accuracy?: string;
    accuracy_status?: "no_audit" | "audited";
  };
  movement_days?: number;
  movement_trend?: MovementTrend[];
  top_movers?: TopMover[];
  aging_data?: AgingData[];
  slow_moving_items?: SlowMovingItem[];
}

// Parse the numeric part out of a formatted KPI string ("28.6%", "1.2x", "₹0.00").
const parseMetric = (s?: string): number | null => {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
};

export default function WarehouseReportsPage() {
  const theme = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WarehouseData | null>(null);
  const [movementDays, setMovementDays] = useState(7);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await analyticsService.getWarehouseAnalytics({ movement_days: String(movementDays) });
      setData(res);
    } catch (err) {
      console.error("Failed to fetch warehouse analytics", err);
      toast.error("Failed to load warehouse analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementDays]);

  if (loading) {
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
          <CircularProgress size={60} thickness={4} color="primary" />
        </Box>
      </>
    );
  }

  const k = data?.kpis || {};
  const grey = theme.palette.text.disabled;

  // Performance-threshold colour coding (red = poor, amber = below target, green = healthy).
  const fillRate = parseMetric(k.fill_rate);
  const fillColor = fillRate == null ? grey
    : fillRate < 50 ? theme.palette.error.main
      : fillRate < 85 ? theme.palette.warning.main
        : theme.palette.success.main;

  const turnover = parseMetric(k.inventory_turnover);
  const turnoverColor = turnover == null ? grey
    : turnover < 2 ? theme.palette.error.main
      : turnover < 4 ? theme.palette.warning.main
        : theme.palette.success.main;

  const deadStock = parseMetric(k.dead_stock_value);
  const deadColor = deadStock && deadStock > 0 ? theme.palette.error.main : theme.palette.success.main;

  const noAudit = k.accuracy_status === "no_audit";
  const accuracyNum = parseMetric(k.accuracy);
  const accuracyColor = noAudit || accuracyNum == null ? grey
    : accuracyNum < 80 ? theme.palette.error.main
      : accuracyNum < 95 ? theme.palette.warning.main
        : theme.palette.success.main;

  const kpis = [
    {
      label: "Inventory Turnover",
      val: k.inventory_turnover || "N/A",
      sub: `Annualized · Target ≥ ${k.inventory_turnover_target || "4.0x"}`,
      color: turnoverColor,
      icon: <RefreshIcon fontSize="large" sx={{ opacity: 0.7 }} />,
      testId: "wh-rep-kpi-turnover",
      onClick: () => setTab(0),
    },
    {
      label: "Dead Stock Value",
      val: k.dead_stock_value || "₹0",
      sub: deadStock && deadStock > 0 ? "Capital idle > 90 days" : "No idle stock > 90 days",
      color: deadColor,
      icon: <WarningAmberIcon fontSize="large" sx={{ opacity: 0.7 }} />,
      testId: "wh-rep-kpi-deadstock",
      onClick: () => setTab(1),
    },
    {
      label: "Order Fill Rate",
      val: k.fill_rate || "0%",
      sub: fillRate == null ? "No orders yet"
        : fillRate < 50 ? "Critically low — review failed orders"
          : fillRate < 85 ? "Below target" : "Healthy",
      color: fillColor,
      icon: <CallMadeIcon fontSize="large" sx={{ opacity: 0.7 }} />,
      testId: "wh-rep-kpi-fillrate",
      onClick: () => router.push("/stock-requests"),
    },
    {
      label: "Stock Accuracy",
      val: noAudit ? "—" : (k.accuracy || "0%"),
      sub: noAudit ? "No audit conducted — run a reconciliation" : "Last reconciliation precision",
      color: accuracyColor,
      icon: <AssessmentIcon fontSize="large" sx={{ opacity: 0.7 }} />,
      testId: "wh-rep-kpi-accuracy",
      onClick: () => router.push("/stock-adjustments"),
    },
  ];

  // Throughput totals (used to flag a flat / zero line in the window).
  const trend = data?.movement_trend || [];
  const totalOutbound = trend.reduce((a, d) => a + (Number(d.outbound) || 0), 0);

  const exportCSV = () => {
    const lines: string[] = [];
    lines.push("Warehouse Operations Report");
    lines.push("");
    lines.push("KPI,Value");
    lines.push(`Inventory Turnover,${k.inventory_turnover || "N/A"}`);
    lines.push(`Dead Stock Value,${(k.dead_stock_value || "").replace(/,/g, "")}`);
    lines.push(`Order Fill Rate,${k.fill_rate || ""}`);
    lines.push(`Stock Accuracy,${noAudit ? "No audit conducted" : (k.accuracy || "")}`);
    lines.push("");
    lines.push(`Top Movers (last 30 days)`);
    lines.push("Rank,Item,Category,Units Out");
    (data?.top_movers || []).forEach((m, i) => lines.push(`${i + 1},"${m.name}","${m.category}",${m.value}`));
    lines.push("");
    lines.push("Dead Stock Audit (>90 days)");
    lines.push("SKU,Item,Warehouse,Days Idle,Capital Tied");
    (data?.slow_moving_items || []).forEach((r) => lines.push(`"${r.id}","${r.name}","${r.warehouse}",${r.days},${r.value}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `warehouse-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* HEADER */}
        <Box
          sx={{
            p: 4,
            mb: 4,
            borderRadius: 3,
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
            color: "white",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          {/* Decorative Background Elements */}
          <Box sx={{ position: "absolute", top: -50, right: -50, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
          <Box sx={{ position: "absolute", bottom: -20, right: 100, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={2}
            sx={{ position: "relative", zIndex: 1 }}
          >
            <Box>
              <Typography
                variant="h4"
                fontWeight={800}
                sx={{ letterSpacing: "-0.5px", textShadow: "0 2px 10px rgba(0,0,0,0.1)" }}
              >
                Warehouse Operations Report
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mt: 1, maxWidth: 600 }}>
                Comprehensive analytics covering inventory health, movement velocity, and capital utilization for the logistics management team.
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} sx={{ mt: { xs: 2, md: 0 } }}>
              <Button
                variant="outlined"
                data-testid="wh-rep-export-btn"
                startIcon={<DownloadIcon />}
                onClick={exportCSV}
                sx={{
                  borderRadius: 2,
                  color: "white",
                  borderColor: "rgba(255,255,255,0.3)",
                  "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" }
                }}
              >
                Export CSV
              </Button>
              <Button
                variant="outlined"
                data-testid="wh-rep-refresh-btn"
                startIcon={<RefreshIcon />}
                onClick={fetchAnalytics}
                sx={{
                  borderRadius: 2,
                  color: "white",
                  borderColor: "rgba(255,255,255,0.3)",
                  "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" }
                }}
              >
                Refresh Data
              </Button>

            </Stack>
          </Stack>
        </Box>

        {/* KPI METRICS ROW */}
        <Grid container spacing={3} mb={5}>
          {kpis.map((kpi, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Paper
                  elevation={0}
                  onClick={kpi.onClick}
                  data-testid={kpi.testId}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    border: `1px solid ${alpha(kpi.color, 0.2)}`,
                    background: `linear-gradient(180deg, white 0%, ${alpha(kpi.color, 0.03)} 100%)`,
                    position: "relative",
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: `0 10px 20px ${alpha(kpi.color, 0.1)}`
                    }
                  }}
                >
                  <Box sx={{ position: "absolute", top: 15, right: 15, color: kpi.color }}>
                    {kpi.icon}
                  </Box>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                    sx={{ textTransform: "uppercase", letterSpacing: 1 }}
                  >
                    {kpi.label}
                  </Typography>
                  <Typography variant="h3" fontWeight={800} mt={1} color={kpi.color}>
                    {kpi.val}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
                    {kpi.sub}
                  </Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* TABS FOR DEEP DIVES */}
        <Paper elevation={0} sx={{ borderRadius: 3, overflow: "hidden", border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider", bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
            <Tabs
              value={tab}
              onChange={(e, v) => setTab(v)}
              sx={{
                "& .MuiTab-root": { fontWeight: 700, py: 2, fontSize: "0.95rem" },
                "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" }
              }}
            >
              <Tab icon={<TrendingUpIcon sx={{ mr: 1 }} />} iconPosition="start" label="Movement & Velocity" />
              <Tab icon={<HistoryIcon sx={{ mr: 1 }} />} iconPosition="start" label="Aging & Dead Stock" />
            </Tabs>
          </Box>

          <Box sx={{ p: { xs: 2, md: 4 } }}>
            {/* TAB CONTENT 1: MOVEMENT */}
            {tab === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Box sx={{ height: 450 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={1} mb={2}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main }}>
                            <TrendingUpIcon />
                          </Box>
                          <Box>
                            <Typography variant="h6" fontWeight={800}>{movementDays}-Day Throughput Analysis</Typography>
                            <Typography variant="body2" color="text.secondary">Inbound vs Outbound daily transaction count</Typography>
                          </Box>
                        </Stack>
                        <ToggleButtonGroup
                          size="small"
                          exclusive
                          value={movementDays}
                          onChange={(_, v) => { if (v) setMovementDays(v); }}
                          data-testid="wh-rep-window-toggle"
                        >
                          <ToggleButton value={7} data-testid="wh-rep-window-7">7D</ToggleButton>
                          <ToggleButton value={14} data-testid="wh-rep-window-14">14D</ToggleButton>
                          <ToggleButton value={30} data-testid="wh-rep-window-30">30D</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                      {!loading && totalOutbound === 0 && (
                        <Chip
                          size="small"
                          color="warning"
                          icon={<WarningAmberIcon sx={{ fontSize: "1rem !important" }} />}
                          label={`No outbound activity in the last ${movementDays} days`}
                          data-testid="wh-rep-flat-outbound-flag"
                          sx={{ mb: 1, fontWeight: 700 }}
                        />
                      )}
                      <ResponsiveContainer width="100%" height="80%">
                        <AreaChart data={data?.movement_trend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.5)} />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontWeight: 600, fill: theme.palette.text.secondary }} dy={10} />
                          <YAxis allowDecimals={false} domain={[0, "auto"]} axisLine={false} tickLine={false} tick={{ fontWeight: 600, fill: theme.palette.text.secondary }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                            itemStyle={{ fontWeight: 700 }}
                          />
                          <Legend wrapperStyle={{ paddingTop: 20 }} />
                          <Area
                            type="monotone"
                            name="Inbound (Receipts)"
                            dataKey="inbound"
                            stroke={theme.palette.success.main}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorInbound)"
                          />
                          <Area
                            type="monotone"
                            name="Outbound (Issues & Dispatch)"
                            dataKey="outbound"
                            stroke={theme.palette.primary.main}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorOutbound)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box sx={{ height: 450, display: "flex", flexDirection: "column" }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.main }}>
                          <CategoryIcon />
                        </Box>
                        <Box>
                          <Typography variant="h6" fontWeight={800}>Top Movers (30 Days)</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Top {(data?.top_movers || []).length} by outbound volume
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack spacing={2} sx={{ flexGrow: 1, overflowY: "auto", pr: 1 }}>
                        {(data?.top_movers || []).map((item: TopMover, i: number) => (
                          <Paper
                            key={i}
                            elevation={0}
                            data-testid={`wh-rep-topmover-${i}`}
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                              "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.5) }
                            }}
                          >
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Box
                                  sx={{
                                    width: 32, height: 32, borderRadius: "50%",
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    color: theme.palette.primary.main, fontWeight: 800, fontSize: "0.8rem"
                                  }}
                                >
                                  #{i + 1}
                                </Box>
                                <Box>
                                  <Typography variant="subtitle2" fontWeight={700}>{item.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">{item.category}</Typography>
                                </Box>
                              </Box>
                              <Typography variant="h6" fontWeight={800} color="text.primary">
                                {item.value} <Typography component="span" variant="caption" fontWeight={600} color="text.secondary">UNITS</Typography>
                              </Typography>
                            </Box>
                            <Box sx={{ mt: 1.5, width: "100%", height: 4, bgcolor: alpha(theme.palette.divider, 0.5), borderRadius: 2, overflow: "hidden" }}>
                              <Box sx={{ width: `${Math.max(10, 100 - (i * 15))}%`, height: "100%", bgcolor: theme.palette.primary.main }} />
                            </Box>
                          </Paper>
                        ))}
                        {(!data?.top_movers || data.top_movers.length === 0) && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 1 }}>
                            <CategoryIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                            <Typography variant="body2" color="text.secondary">No movement data available</Typography>
                          </Box>
                        )}
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </motion.div>
            )}

            {/* TAB CONTENT 2: AGING */}
            {tab === 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box sx={{ height: 450 }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main }}>
                          <HistoryIcon />
                        </Box>
                        <Box>
                          <Typography variant="h6" fontWeight={800}>Inventory Age Profile</Typography>
                          <Typography variant="body2" color="text.secondary">Breakdown by days since last movement</Typography>
                        </Box>
                      </Stack>
                      <ResponsiveContainer width="100%" height="80%">
                        <PieChart>
                          <Pie
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            data={(data?.aging_data as any) || []}
                            cx="50%"
                            cy="45%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {(data?.aging_data || []).map((entry: AgingData, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}
                            itemStyle={{ fontWeight: 700 }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontWeight: 600 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Box>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.error.main, 0.1), color: theme.palette.error.main }}>
                            <WarningAmberIcon />
                          </Box>
                          <Box>
                            <Typography variant="h6" fontWeight={800}>Dead Stock Audit</Typography>
                            <Typography variant="body2" color="text.secondary">Items without ledger activity for &gt;90 Days</Typography>
                          </Box>
                        </Stack>
                        <Chip label="High Priority Review" color="error" size="small" sx={{ fontWeight: 700, borderRadius: 1 }} />
                      </Stack>

                      <TableContainer component={Paper} elevation={0} sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.1)}`, borderRadius: 2 }}>
                        <Table sx={{ minWidth: 500 }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: alpha(theme.palette.error.main, 0.03) }}>
                              <TableCell sx={{ fontWeight: 800, color: "text.secondary" }}>SKU / ITEM NAME</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: "text.secondary" }}>LOCATION</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: "text.secondary", textAlign: "center" }}>AGE DETECTED</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: "text.secondary", textAlign: "right" }}>CAPITAL TIED (₹)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(data?.slow_moving_items || []).map((row: SlowMovingItem) => (
                              <TableRow key={row.id} hover data-testid={`wh-rep-deadstock-${row.id}`} sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                                <TableCell>
                                  <Typography variant="subtitle2" fontWeight={700}>{row.name}</Typography>
                                  <Typography variant="caption" sx={{ fontFamily: "monospace", bgcolor: alpha(theme.palette.divider, 0.1), px: 1, py: 0.5, borderRadius: 1 }}>
                                    {row.id}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Chip label={row.warehouse} size="small" variant="outlined" sx={{ borderRadius: 1, fontWeight: 600 }} />
                                </TableCell>
                                <TableCell align="center">
                                  <Typography variant="body2" fontWeight={800} color={row.days > 180 ? "error.main" : "warning.main"}>
                                    {row.days} Days
                                  </Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="body1" fontWeight={800}>
                                    ₹{row.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ))}
                            {(!data?.slow_moving_items || data.slow_moving_items.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                                    <AssessmentIcon sx={{ fontSize: 48, mb: 1 }} />
                                    <Typography variant="h6" fontWeight={700}>Warehouse Optimized</Typography>
                                    <Typography variant="body2">No dead stock detected in the current audit.</Typography>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Grid>
                </Grid>
              </motion.div>
            )}
          </Box>
        </Paper>
      </motion.div>
    </>
  );
}

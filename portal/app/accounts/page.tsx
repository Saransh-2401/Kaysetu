"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  Avatar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha,
  TextField,
  MenuItem,
  Skeleton,
  Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, TooltipProps,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import Link from "next/link";

import { DownloadIcon, CalendarTodayIcon, TrendingUpIcon, TrendingDownIcon, ArrowForwardIcon, AccountBalanceWalletIcon, ReceiptIcon, DescriptionIcon, ErrorOutlineIcon } from "@/components/icons";

import {
  accountsApi,
  getFYDates,
  getQuarterDates,
  getEntityName,
  mapStatus,
  todayStr,
  type StockRequestInvoiceResult,
} from "@/lib/accounts-api";
import { authService } from "@/lib/auth-service";

// ---

const formatINR = (v: number) =>
  `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

type ChartPoint = { month: string; income: number };

interface Transaction {
  id: string;
  entity: string;
  type: string;
  date: string;
  amount: number;
  status: string;
}

// --- Custom Tooltip ---
function CustomTooltip({ active, payload, label }: any) {
  const theme = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>
        {label}
      </Typography>
      {payload.map((e: any) => (
        <Typography key={e.dataKey} variant="body2" fontWeight={600} sx={{ color: e.color }}>
          {e.name}: {formatINR(e.value as number)}
        </Typography>
      ))}
    </Paper>
  );
}

// --- Stat Card ---
function StatCard({
  title, value, icon, color, trend, trendValue, subtext, loading,
}: {
  title: string; value: string; icon: React.ReactNode; color: string;
  trend: "up" | "down"; trendValue: string; subtext: string; loading?: boolean;
}) {
  return (
    <Paper
      data-animate-group
      elevation={0}
      sx={{
        p: 3, height: "100%", bgcolor: "background.paper",
        boxShadow: "0px 4px 20px rgba(0,0,0,0.03)",
        border: `1px solid ${alpha(color, 0.12)}`,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
            {title}
          </Typography>
          {loading ? (
            <Skeleton variant="text" width={120} height={48} />
          ) : (
            <Typography variant="h4" fontWeight={800} color="text.primary">{value}</Typography>
          )}
        </Box>
        <Avatar variant="rounded" sx={{ bgcolor: alpha(color, 0.1), color, width: 48, height: 48, borderRadius: 1 }}>
          {icon}
        </Avatar>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Chip
          label={trendValue}
          size="small"
          icon={trend === "up" ? <TrendingUpIcon /> : <TrendingDownIcon />}
          color={trend === "up" ? "success" : "error"}
          sx={{ borderRadius: 1, fontWeight: 700, height: 24, "& .MuiChip-icon": { fontSize: 16 } }}
        />
        <Typography variant="caption" color="text.secondary">{subtext}</Typography>
      </Stack>
    </Paper>
  );
}

// ---

export default function AccountsOverview() {
  const theme = useTheme();
  const [range, setRange] = useState("This Month");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [receivables, setReceivables] = useState(0);
  const [payables, setPayables] = useState(0);
  const [cashFlow, setCashFlow] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fy = range === "Last Quarter" ? getQuarterDates() : getFYDates();

      // The three invoice sources belong to separate modules (sales=ORDERS,
      // purchases=PURCH, stock=DIST). BOOKS aggregates whatever the tenant
      // actually runs; for a source it didn't buy, substitute an empty result
      // rather than firing a request that 403s.
      const EMPTY = Promise.resolve({ results: [] as never[] });
      const hasOrders = authService.hasModule("ORDERS");
      const hasPurch = authService.hasModule("PURCH");
      const hasDist = authService.hasModule("DIST");

      // Parallel fetch — KPIs + recent transactions
      const [salesData, purchaseData, cashFlowData, recentSales, recentPurchases, recentStock, overdueInvoices, overdueStock] =
        await Promise.all([
          accountsApi.getSalesOverview(range === "YTD" ? "This Month" : range),
          accountsApi.getPurchaseOverview(),
          accountsApi.getCashFlow(fy),
          hasOrders ? accountsApi.getSalesInvoices({ ordering: "-invoice_date", page_size: "5" }) : EMPTY,
          hasPurch ? accountsApi.getPurchaseInvoices({ ordering: "-invoice_date", page_size: "3" }) : EMPTY,
          hasDist ? accountsApi.getStockRequestInvoices({ ordering: "-invoice_date", page_size: "3" }) : EMPTY,
          hasOrders ? accountsApi.getSalesInvoices({ payment_status: "unpaid", page_size: "500" }) : EMPTY,
          hasDist ? accountsApi.getStockRequestInvoices({ payment_status: "unpaid,invoiced,overdue", page_size: "500" }) : EMPTY,
        ]);

      // KPIs
      setReceivables(salesData.overview.outstanding_amount);
      setPayables(purchaseData.overview.pending_pos_value);
      setCashFlow(cashFlowData.operating_activities.net_cash_from_operations);

      // Overdue = unpaid invoices where due_date < today (sales + stock request invoices)
      const today = todayStr();
      let overdueTotal = 0;
      overdueInvoices.results.forEach((inv) => {
        if (inv.due_date && inv.due_date < today) {
          overdueTotal += parseFloat(inv.outstanding_amount || inv.total || "0");
        }
      });
      overdueStock.results.forEach((inv: StockRequestInvoiceResult) => {
        if (inv.due_date && inv.due_date < today) {
          overdueTotal += parseFloat(inv.total_amount || "0");
        }
      });
      setOverdue(overdueTotal);

      // Chart — use sales_trend from analytics (monthly revenue last 6 months)
      const trend = salesData.overview.sales_trend || [];
      setChartData(trend.map((t) => ({ month: t.name, income: t.value })));

      // Transactions — merge all three types & sort
      const salesTxns: Transaction[] = recentSales.results.map((inv) => ({
        id: inv.invoice_number,
        entity: getEntityName(inv.customer as never, inv.customer_name, "Customer"),
        type: "Sales Invoice",
        date: inv.invoice_date,
        amount: parseFloat(inv.total),
        status: mapStatus(inv.payment_status),
      }));

      const purchaseTxns: Transaction[] = recentPurchases.results.map((inv) => ({
        id: inv.invoice_number,
        entity: getEntityName(inv.supplier as never, inv.supplier_name, "Supplier"),
        type: "Purchase Invoice",
        date: inv.invoice_date,
        amount: parseFloat(inv.total),
        status: mapStatus(inv.payment_status),
      }));

      const stockTxns: Transaction[] = recentStock.results
        .filter((inv: StockRequestInvoiceResult) => inv.invoice_date)
        .map((inv: StockRequestInvoiceResult) => ({
          id: inv.invoice_number,
          entity: inv.distributor_name || inv.request_number || "Distributor",
          type: "Stock Invoice",
          date: inv.invoice_date as string,
          amount: parseFloat(inv.total_amount),
          status: mapStatus(inv.payment_status),
        }));

      const merged = [...salesTxns, ...purchaseTxns, ...stockTxns].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      setTransactions(merged.slice(0, 6));
    } catch (err) {
      console.error("Accounts dashboard error:", err);
      setError("Failed to load financial data. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Trend chips — derived from data availability
  const recTrend = receivables > payables ? "up" : "down";
  const cfTrend = cashFlow >= 0 ? "up" : "down";

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* HEADER */}
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
              Financial Overview
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Cash flow, receivables &amp; payables at a glance.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              select value={range} onChange={(e) => setRange(e.target.value)}
              size="small"
              sx={{
                minWidth: 160,
                "& .MuiOutlinedInput-root": {
                  height: 40,
                  borderRadius: "10px",
                  bgcolor: "background.paper",
                },
              }}
              InputProps={{ startAdornment: <CalendarTodayIcon fontSize="small" color="action" sx={{ mr: 1 }} /> }}
            >
              <MenuItem value="This Month">This Month</MenuItem>
              <MenuItem value="Last Quarter">Last Quarter</MenuItem>
              <MenuItem value="YTD">Year to Date</MenuItem>
            </TextField>
            <Button
              component={Link} href="/accounts/reports" variant="outlined" startIcon={<DownloadIcon />}
              sx={{
                height: 40,
                borderRadius: "10px",
                borderColor: alpha(theme.palette.divider, 0.3),
                color: "text.primary",
                whiteSpace: "nowrap",
              }}
            >
              Reports
            </Button>
          </Stack>
        </Stack>

        {/* ERROR */}
        {error && (
          <Alert severity="error" icon={<ErrorOutlineIcon />} sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* KPI CARDS */}
        <Grid container spacing={3} mb={4}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="TOTAL RECEIVABLES" value={formatINR(receivables)}
              icon={<ReceiptIcon />} color={theme.palette.primary.main}
              trend={recTrend} trendValue={recTrend === "up" ? "Healthy" : "Review"}
              subtext="Outstanding invoices" loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="TOTAL PAYABLES" value={formatINR(payables)}
              icon={<DescriptionIcon />} color={theme.palette.warning.main}
              trend="down" trendValue="Pending POs"
              subtext="Purchase orders due" loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="NET CASH FLOW" value={formatINR(cashFlow)}
              icon={<AccountBalanceWalletIcon />} color={theme.palette.success.main}
              trend={cfTrend} trendValue={cfTrend === "up" ? "Positive" : "Negative"}
              subtext="Cash in – Cash out" loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="OVERDUE INVOICES" value={formatINR(overdue)}
              icon={<TrendingDownIcon />} color={theme.palette.error.main}
              trend="down" trendValue="Action needed"
              subtext="Past due date" loading={loading}
            />
          </Grid>
        </Grid>

        {/* REVENUE TREND CHART */}
        <Paper
          sx={{
            p: 3, mb: 4, height: 380,
            boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
          elevation={0}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Monthly Revenue Trend</Typography>
              <Typography variant="body2" color="text.secondary">
                Sales invoice totals — last 6 months
              </Typography>
            </Box>
            <Stack direction="row" alignItems="center" spacing={0.8}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "success.main" }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Revenue</Typography>
            </Stack>
          </Stack>

          {loading ? (
            <Skeleton variant="rectangular" width="100%" height="75%" sx={{ borderRadius: 2 }} />
          ) : chartData.length === 0 ? (
            <Stack height="75%" alignItems="center" justifyContent="center">
              <Typography color="text.secondary">No chart data available</Typography>
            </Stack>
          ) : (
            <ResponsiveContainer width="100%" height="82%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.1)} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="income" name="Revenue"
                  stroke={theme.palette.success.main} fill="url(#colorRevenue)" strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Paper>

        {/* RECENT TRANSACTIONS */}
        <Paper
          elevation={0}
          sx={{
            overflow: "hidden",
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            boxShadow: "0px 4px 20px rgba(0,0,0,0.02)",
          }}
        >
          <Box
            sx={{
              p: 3,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <Typography variant="h6" fontWeight={700}>Recent Transactions</Typography>
            <Button component={Link} href="/general-ledgers" endIcon={<ArrowForwardIcon />} size="small">
              View Ledger
            </Button>
          </Box>

          {loading ? (
            <Box p={3}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />
              ))}
            </Box>
          ) : transactions.length === 0 ? (
            <Box p={4} textAlign="center">
              <Typography color="text.secondary">No recent transactions found.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <TableCell sx={{ fontWeight: 700, pl: 4 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>ENTITY</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>TYPE</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>AMOUNT</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                    <TableCell sx={{ fontWeight: 700, textAlign: "right", pr: 4 }}>ACTION</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ pl: 4, fontFamily: "monospace", fontWeight: 600 }}>{row.id}</TableCell>
                      <TableCell>{row.entity}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color={row.type === "Purchase Invoice" ? "error.main" : "success.main"}>
                          {row.type}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: row.type === "Purchase Invoice" ? "error.main" : "success.main" }}>
                        {row.type === "Purchase Invoice" ? "-" : "+"}{formatINR(row.amount)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={row.status}
                          size="small"
                          color={
                            row.status === "Paid" ? "success"
                              : row.status === "Overdue" ? "error"
                              : "warning"
                          }
                          sx={{ borderRadius: 1, fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 4 }}>
                        <Button size="small" variant="text">Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </motion.div>
    </>
  );
}

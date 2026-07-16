"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  MenuItem,
  TextField,
  useTheme,
  alpha,
  Skeleton,
  Alert,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Line, ComposedChart, TooltipProps,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";

import { DownloadIcon, CalendarTodayIcon } from "@/components/icons";

// @ts-ignore
import XLSX from "xlsx-js-style";

import {
  accountsApi,
  getFYDates,
  getLastFYDates,
  getQuarterDates,
  getMonthRanges,
  type ProfitLossData,
} from "@/lib/accounts-api";

// ---

const formatINR = (v: number) =>
  `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

type MonthPL = { month: string; revenue: number; expense: number; profit: number };

function CustomTooltip({ active, payload, label }: any) {
  const theme = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={0} sx={{ p: 1.5, border: `1px solid ${alpha(theme.palette.divider, 0.15)}`, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
      <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={0.5}>{label}</Typography>
      {payload.map((e: any) => (
        <Typography key={e.dataKey} variant="body2" fontWeight={600} sx={{ color: e.color }}>
          {e.name}: {formatINR(e.value as number)}
        </Typography>
      ))}
    </Paper>
  );
}

function downloadXLSX(wb: any, filename: string) {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Cell style helpers
const BLUE   = "1E4DB7";
const DARK   = "1A1A2E";
const LIGHT  = "EEF2FF";
const WHITE  = "FFFFFF";
const GREEN  = "166534";
const RED    = "991B1B";
const GREY   = "F8F9FA";

function titleCell(v: string) {
  return {
    v, t: "s",
    s: { font: { bold: true, sz: 14, color: { rgb: WHITE } }, fill: { fgColor: { rgb: BLUE } }, alignment: { horizontal: "left", vertical: "center" } },
  };
}
function headCell(v: string) {
  return {
    v, t: "s",
    s: { font: { bold: true, sz: 10, color: { rgb: WHITE } }, fill: { fgColor: { rgb: DARK } }, alignment: { horizontal: "center", vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: BLUE } } } },
  };
}
function labelCell(v: string, indent = 0) {
  return {
    v, t: "s",
    s: { font: { sz: 10, color: { rgb: "374151" } }, alignment: { horizontal: "left", indent }, fill: { fgColor: { rgb: WHITE } } },
  };
}
function numCell(v: number, color = DARK) {
  return {
    v, t: "n",
    s: { font: { sz: 10, color: { rgb: color } }, alignment: { horizontal: "right" }, numFmt: '₹#,##0', fill: { fgColor: { rgb: WHITE } } },
  };
}
function pctCell(v: number) {
  return {
    v: v / 100, t: "n",
    s: { font: { sz: 10, color: { rgb: BLUE } }, alignment: { horizontal: "right" }, numFmt: "0.00%", fill: { fgColor: { rgb: WHITE } } },
  };
}
function totalLabelCell(v: string) {
  return {
    v, t: "s",
    s: { font: { bold: true, sz: 10, color: { rgb: DARK } }, fill: { fgColor: { rgb: LIGHT } }, alignment: { horizontal: "left" }, border: { top: { style: "thin", color: { rgb: BLUE } }, bottom: { style: "medium", color: { rgb: BLUE } } } },
  };
}
function totalNumCell(v: number, color = DARK) {
  return {
    v, t: "n",
    s: { font: { bold: true, sz: 10, color: { rgb: color } }, fill: { fgColor: { rgb: LIGHT } }, alignment: { horizontal: "right" }, numFmt: '₹#,##0', border: { top: { style: "thin", color: { rgb: BLUE } }, bottom: { style: "medium", color: { rgb: BLUE } } } },
  };
}
function metaCell(v: string) {
  return {
    v, t: "s",
    s: { font: { italic: true, sz: 9, color: { rgb: "9CA3AF" } }, alignment: { horizontal: "left" }, fill: { fgColor: { rgb: WHITE } } },
  };
}
function blankCell(bg = WHITE) {
  return { v: "", t: "s", s: { fill: { fgColor: { rgb: bg } } } };
}
function totalBlankCell() {
  return {
    v: "", t: "s",
    s: {
      fill: { fgColor: { rgb: LIGHT } },
      border: {
        top: { style: "thin", color: { rgb: BLUE } },
        bottom: { style: "medium", color: { rgb: BLUE } },
      },
    },
  };
}
function emptyRow(cols: number): unknown[] {
  return Array(cols).fill(blankCell());
}

// ---

export default function FinancialReportsPage() {
  const theme = useTheme();
  const [range, setRange] = useState("This Year");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [plSummary, setPlSummary] = useState<ProfitLossData | null>(null);
  const [plMonthly, setPlMonthly] = useState<MonthPL[]>([]);

  const getDateParams = useCallback(() => {
    if (range === "This Quarter") return getQuarterDates();
    if (range === "Last Year") return getLastFYDates();
    return getFYDates();
  }, [range]);

  const loadPL = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dates = getDateParams();
      const monthRanges = getMonthRanges(6);

      const [summary, ...monthly] = await Promise.all([
        accountsApi.getProfitLoss(dates),
        ...monthRanges.map((r) => accountsApi.getProfitLoss({ from_date: r.from_date, to_date: r.to_date })),
      ]);

      setPlSummary(summary);
      setPlMonthly(
        monthRanges.map((r, i) => ({
          month: r.label,
          revenue: monthly[i].income.total_income,
          expense: monthly[i].expenses.total_expenses,
          profit: monthly[i].profit.net_profit,
        }))
      );
    } catch (err) {
      console.error("P&L load error:", err);
      setError("Failed to load P&L data.");
    } finally {
      setLoading(false);
    }
  }, [getDateParams]);

  useEffect(() => {
    loadPL();
  }, [loadPL]);

  const handleExport = () => {
    if (!plSummary || !plMonthly.length) return;
    const rangeLabel = range.replace(/\s+/g, "_");
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

    // ── Sheet 1: Summary ──────────────────────────────────────────────────────
    const sectionCell = (label: string, color: string, bg: string) => ({
      v: label, t: "s",
      s: { font: { bold: true, sz: 9, color: { rgb: color } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: "left" } },
    });

    const summaryRows: unknown[][] = [
      // Row 0 — Title (merged A–D)
      [titleCell("Profit & Loss Statement"), blankCell(BLUE), blankCell(BLUE), blankCell(BLUE)],
      // Row 1 — Meta (A–B | C–D)
      [metaCell(`Period: ${plSummary.period.from_date}  →  ${plSummary.period.to_date}`), blankCell(), metaCell(`Generated: ${today}`), blankCell()],
      emptyRow(4),
      // Row 3 — INCOME header (merged A–D)
      [sectionCell("INCOME", BLUE, LIGHT), blankCell(LIGHT), blankCell(LIGHT), blankCell(LIGHT)],
      // Row 4–5 — Income items (label A–C, value D)
      [labelCell("Sales Revenue"),   blankCell(), blankCell(), numCell(plSummary.income.sales_revenue, GREEN)],
      [labelCell("Other Income"),    blankCell(), blankCell(), numCell(plSummary.income.other_income)],
      // Row 6 — Total Income (bordered, A–C | D)
      [totalLabelCell("Total Income"), totalBlankCell(), totalBlankCell(), totalNumCell(plSummary.income.total_income, GREEN)],
      emptyRow(4),
      // Row 8 — EXPENSES header (merged A–D)
      [sectionCell("EXPENSES", RED, "FEF2F2"), blankCell("FEF2F2"), blankCell("FEF2F2"), blankCell("FEF2F2")],
      // Row 9–10 — Expense items
      [labelCell("Cost of Goods Sold"),  blankCell(), blankCell(), numCell(plSummary.expenses.cost_of_goods_sold, RED)],
      [labelCell("Operating Expenses"),  blankCell(), blankCell(), numCell(plSummary.expenses.operating_expenses, RED)],
      // Row 11 — Total Expenses (bordered)
      [totalLabelCell("Total Expenses"), totalBlankCell(), totalBlankCell(), totalNumCell(plSummary.expenses.total_expenses, RED)],
      emptyRow(4),
      // Row 13 — PROFIT header (merged A–D)
      [sectionCell("PROFIT", GREEN, "F0FDF4"), blankCell("F0FDF4"), blankCell("F0FDF4"), blankCell("F0FDF4")],
      // Row 14 — Gross Profit
      [labelCell("Gross Profit"), blankCell(), blankCell(), numCell(plSummary.profit.gross_profit, plSummary.profit.gross_profit >= 0 ? GREEN : RED)],
      // Row 15 — Net Profit (bordered)
      [totalLabelCell("Net Profit"), totalBlankCell(), totalBlankCell(), totalNumCell(plSummary.profit.net_profit, plSummary.profit.net_profit >= 0 ? GREEN : RED)],
      // Row 16 — Margin
      [labelCell("Net Profit Margin"), blankCell(), blankCell(), pctCell(plSummary.profit.net_profit_margin)],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 18 }];
    wsSummary["!rows"] = [{ hpt: 28 }, { hpt: 16 }];
    wsSummary["!merges"] = [
      // Row 0: Title A–D
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      // Row 1: Period meta A–B, Generated meta C–D
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
      { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } },
      // Row 3: INCOME header A–D
      { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
      // Income label rows — merge A–C
      { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 2 } },
      // Row 8: EXPENSES header A–D
      { s: { r: 8, c: 0 }, e: { r: 8, c: 3 } },
      // Expense label rows — merge A–C
      { s: { r: 9,  c: 0 }, e: { r: 9,  c: 2 } },
      { s: { r: 10, c: 0 }, e: { r: 10, c: 2 } },
      { s: { r: 11, c: 0 }, e: { r: 11, c: 2 } },
      // Row 13: PROFIT header A–D
      { s: { r: 13, c: 0 }, e: { r: 13, c: 3 } },
      // Profit label rows — merge A–C
      { s: { r: 14, c: 0 }, e: { r: 14, c: 2 } },
      { s: { r: 15, c: 0 }, e: { r: 15, c: 2 } },
      { s: { r: 16, c: 0 }, e: { r: 16, c: 2 } },
    ];

    // ── Sheet 2: Monthly Trend ────────────────────────────────────────────────
    const trendHeaders = [
      headCell("Month"),
      headCell("Revenue (₹)"),
      headCell("Expenses (₹)"),
      headCell("Net Profit (₹)"),
      headCell("Margin %"),
    ];

    const trendRows: unknown[][] = [
      [titleCell("Monthly Trend — Last 6 Months"), "", "", "", ""],
      [metaCell(`Period: ${plSummary.period.from_date}  →  ${plSummary.period.to_date}`), "", "", "", ""],
      emptyRow(5),
      trendHeaders,
      ...plMonthly.map((r, idx) => {
        const bg = idx % 2 === 0 ? WHITE : GREY;
        const margin = r.revenue > 0 ? r.profit / r.revenue : 0;
        return [
          { v: r.month, t: "s", s: { font: { sz: 10 }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: "center" } } },
          { v: r.revenue, t: "n", s: { font: { sz: 10, color: { rgb: GREEN } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: "right" }, numFmt: '₹#,##0' } },
          { v: r.expense, t: "n", s: { font: { sz: 10, color: { rgb: RED } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: "right" }, numFmt: '₹#,##0' } },
          { v: r.profit, t: "n", s: { font: { sz: 10, color: { rgb: r.profit >= 0 ? GREEN : RED }, bold: true }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: "right" }, numFmt: '₹#,##0' } },
          { v: margin, t: "n", s: { font: { sz: 10, color: { rgb: BLUE } }, fill: { fgColor: { rgb: bg } }, alignment: { horizontal: "right" }, numFmt: "0.00%" } },
        ];
      }),
      // Totals row
      [
        totalLabelCell("Total"),
        totalNumCell(plMonthly.reduce((s, r) => s + r.revenue, 0), GREEN),
        totalNumCell(plMonthly.reduce((s, r) => s + r.expense, 0), RED),
        totalNumCell(plMonthly.reduce((s, r) => s + r.profit, 0), plSummary.profit.net_profit >= 0 ? GREEN : RED),
        { v: "", t: "s", s: { fill: { fgColor: { rgb: LIGHT } } } },
      ],
    ];

    const wsTrend = XLSX.utils.aoa_to_sheet(trendRows);
    wsTrend["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }];
    wsTrend["!rows"] = [{ hpt: 28 }, { hpt: 16 }];
    wsTrend["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];

    // ── Workbook ──────────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "P&L Summary");
    XLSX.utils.book_append_sheet(wb, wsTrend, "Monthly Trend");

    downloadXLSX(wb, `PL_Statement_${rangeLabel}.xlsx`);
  };

  const kpiCards = plSummary
    ? [
        { label: "Net Profit (Period)", val: formatINR(plSummary.profit.net_profit), color: theme.palette.success.main },
        { label: "Total Revenue", val: formatINR(plSummary.income.total_income), color: theme.palette.primary.main },
        { label: "Total Expenses", val: formatINR(plSummary.expenses.total_expenses), color: theme.palette.error.main },
        { label: "Net Profit Margin", val: `${plSummary.profit.net_profit_margin}%`, color: theme.palette.warning.main },
      ]
    : null;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* HEADER */}
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
              Financial Reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Profit &amp; Loss Statement
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              select value={range} onChange={(e) => setRange(e.target.value)}
              size="small"
              sx={{
                minWidth: 160,
                "& .MuiOutlinedInput-root": { height: 40, borderRadius: "10px", bgcolor: "background.paper" },
              }}
              InputProps={{ startAdornment: <CalendarTodayIcon fontSize="small" color="action" sx={{ mr: 1 }} /> }}
            >
              <MenuItem value="This Quarter">This Quarter</MenuItem>
              <MenuItem value="This Year">This Year (FY)</MenuItem>
              <MenuItem value="Last Year">Last Year (FY)</MenuItem>
            </TextField>
            <Button
              variant="contained" startIcon={<DownloadIcon />} onClick={handleExport}
              disabled={loading || !plSummary}
              sx={{
                height: 40,
                borderRadius: "10px",
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                whiteSpace: "nowrap",
              }}
            >
              Export Excel
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* KPI CARDS */}
        <Grid container spacing={3} mb={4}>
          {(kpiCards ?? [
            { label: "Net Profit (Period)", val: "—", color: theme.palette.success.main },
            { label: "Total Revenue", val: "—", color: theme.palette.primary.main },
            { label: "Total Expenses", val: "—", color: theme.palette.error.main },
            { label: "Net Profit Margin", val: "—", color: theme.palette.warning.main },
          ]).map((item, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Paper
                elevation={0}
                sx={{
                  p: 3, borderRadius: 0,
                  border: `1px solid ${alpha(item.color, 0.2)}`,
                  borderLeft: `4px solid ${item.color}`,
                  bgcolor: "background.paper",
                }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase" }}>
                  {item.label}
                </Typography>
                {loading ? (
                  <Skeleton variant="text" width={120} height={48} />
                ) : (
                  <Typography variant="h4" fontWeight={800} mt={1} color={item.color}>
                    {item.val}
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* P&L CHART */}
        <Paper sx={{ p: 3, height: 450, border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }} elevation={0}>
          <Typography variant="h6" fontWeight={700} gutterBottom>Income vs Expense Trend</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Monthly revenue, expenses and net profit (last 6 months)
          </Typography>
          {loading ? (
            <Skeleton variant="rectangular" width="100%" height="75%" sx={{ borderRadius: 2 }} />
          ) : plMonthly.length === 0 ? (
            <Stack height="75%" alignItems="center" justifyContent="center">
              <Typography color="text.secondary">No P&amp;L data for this period.</Typography>
            </Stack>
          ) : (
            <ResponsiveContainer width="100%" height="82%">
              <ComposedChart data={plMonthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.15)} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill={theme.palette.primary.main} barSize={20} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill={theme.palette.error.main} barSize={20} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="profit" name="Net Profit" stroke={theme.palette.success.main} strokeWidth={3} dot={{ r: 4, fill: theme.palette.success.main }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Paper>
      </motion.div>
    </>
  );
}

"use client";
/**
 * Admin Analytics design-system kit.
 *
 * Shared chrome + chart primitives used by both the Admin Dashboard
 * (app/admin/page.tsx) and Reports & Analytics (app/admin/reports/page.tsx).
 *
 * Visual language (matches the QHSE reference): pill stat-counters in section
 * headers, heatmap-graded data cells, Pareto combo charts, donut status
 * indicators, and polished card chrome. Fully theme-aware (light + dark).
 */
import React from "react";
import {
  Box, Paper, Stack, Typography, Avatar, Chip, useTheme, alpha, Tooltip,
  TableRow, TableCell,
} from "@mui/material";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell, LabelList,
} from "recharts";
import { ResponsiveChart as ResponsiveContainer } from "@/components/shared/ResponsiveChart";
import { TrendingUpIcon, TrendingDownIcon } from "@/components/icons";
import { useAppTheme } from "@/components/ClientThemeWrapper";
import { readableOn } from "@/theme/colorMath";

// ── Formatters ────────────────────────────────────────────────────────
export const fmt = (n: number) => {
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return n.toLocaleString("en-IN");
};
export const fmtFull = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const fmtNum = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

// ── Palette ───────────────────────────────────────────────────────────
// NOTE: these are STATIC fallbacks (the navy-gold defaults). Prefer the
// useChartPalette() hook below so charts/donuts/pills follow the admin-selected
// color scheme (including a custom palette).
export const CHART_COLORS = ["#2C3E50", "#2e7d32", "#ed6c02", "#9c27b0", "#d32f2f", "#0288d1", "#388e3c", "#f57c00", "#7b1fa2", "#c62828"];
export const LEAD_COLORS: Record<string, string> = { open: "#0288d1", replied: "#1976d2", interested: "#ed6c02", qualified: "#2e7d32", converted: "#388e3c", lost: "#d32f2f" };
export const STOCK_COLORS: Record<string, string> = { healthy: "#2e7d32", low: "#ed6c02", critical: "#d32f2f" };

// Brand accents (static fallbacks)
export const PRIMARY = "#2C3E50";
export const SECONDARY = "#7b1fa2";

/**
 * Scheme-aware chart + status palette. recharts takes resolved color strings
 * (CSS vars don't work in SVG presentation attributes), so charts read colors
 * from here at render time to follow the active color scheme.
 */
export function useChartPalette() {
  const { scheme } = useAppTheme();
  const chart = [
    ...scheme.chart,
    scheme.success, scheme.info, scheme.warning, scheme.error, scheme.primaryLight,
  ];
  const lead: Record<string, string> = {
    open: scheme.info, replied: scheme.primary, interested: scheme.warning,
    qualified: scheme.success, converted: scheme.secondary, lost: scheme.error,
  };
  const stock: Record<string, string> = {
    healthy: scheme.success, low: scheme.warning, critical: scheme.error,
  };
  return {
    chart, lead, stock,
    primary: scheme.primary, secondary: scheme.secondary,
    success: scheme.success, warning: scheme.warning, error: scheme.error, info: scheme.info,
  };
}

// ════════════════════════════════════════════════════════════════════
//  CARD CHROME
// ════════════════════════════════════════════════════════════════════

/** Section header with optional pill counters and a right-aligned actions slot. */
export const SectionHeader = ({
  title, subtitle, icon, color, pills, actions, dense,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  pills?: StatPillItem[];
  actions?: React.ReactNode;
  dense?: boolean;
}) => {
  const theme = useTheme();
  const accent = color || theme.palette.primary.main;
  return (
    <Stack
      direction="row" justifyContent="space-between" alignItems="flex-start"
      spacing={1.5} mb={dense ? 1 : 1.5} flexWrap="wrap"
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
        {icon && (
          <Avatar variant="rounded" sx={{
            bgcolor: alpha(accent, 0.12), color: accent, width: 34, height: 34,
            borderRadius: 2, flexShrink: 0,
          }}>{icon}</Avatar>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ letterSpacing: "-0.01em", lineHeight: 1.3 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ rowGap: 1 }}>
        {pills && <StatPills items={pills} compact />}
        {actions}
      </Stack>
    </Stack>
  );
};

/** Polished chart container: left accent bar, header (title/pills/actions), flexible body. */
export const ChartCard = ({
  title, subtitle, icon, color, pills, actions, height = 380, children, bodySx,
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  pills?: StatPillItem[];
  actions?: React.ReactNode;
  height?: number | string;
  children: React.ReactNode;
  bodySx?: object;
}) => {
  const theme = useTheme();
  const accent = color || theme.palette.primary.main;
  return (
    <Paper elevation={0} sx={{
      p: 0, height, display: "flex", flexDirection: "column", overflow: "hidden",
      position: "relative", borderRadius: 3,
      border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      transition: "box-shadow 0.25s, transform 0.25s",
      "&:hover": { boxShadow: `0 6px 28px ${alpha(theme.palette.common.black, 0.07)}` },
      "&::before": {
        content: '""', position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        background: `linear-gradient(180deg, ${accent}, ${alpha(accent, 0.35)})`,
      },
    }}>
      {(title || actions || pills) && (
        <Box sx={{ px: 2.5, pt: 2.25, pb: 1.25 }}>
          <SectionHeader title={title || ""} subtitle={subtitle} icon={icon} color={accent} pills={pills} actions={actions} />
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0, px: 2.5, pb: 2.25, display: "flex", flexDirection: "column", ...bodySx }}>
        {children}
      </Box>
    </Paper>
  );
};

// ════════════════════════════════════════════════════════════════════
//  STAT CARDS
// ════════════════════════════════════════════════════════════════════

/** KPI stat card — gradient icon tile, optional delta chip + subtitle. */
export const StatCard = ({
  title, value, change, icon, color, subtitle,
}: {
  title: string; value: string; change?: number; icon: React.ReactNode; color: string; subtitle?: string;
}) => {
  const theme = useTheme();
  return (
    <Paper data-animate-group elevation={0} sx={{
      p: 2.25, height: "100%", borderRadius: 3, position: "relative", overflow: "hidden",
      border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      transition: "transform 0.2s, box-shadow 0.2s",
      "&:hover": { transform: "translateY(-3px)", boxShadow: `0 8px 26px ${alpha(color, 0.18)}` },
      "&::after": {
        content: '""', position: "absolute", right: -28, top: -28, width: 90, height: 90,
        borderRadius: "50%", background: alpha(color, 0.06),
      },
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}
            sx={{ textTransform: "uppercase", letterSpacing: 0.5, display: "block", mb: 0.5, fontSize: "0.66rem" }}>{title}</Typography>
          <Typography variant="h5" fontWeight={800} noWrap sx={{ lineHeight: 1.25, letterSpacing: "-0.02em" }}>{value}</Typography>
          {(change !== undefined || subtitle) && (
            <Stack direction="row" alignItems="center" spacing={0.5} mt={0.75}>
              {change !== undefined && (
                <Chip size="small"
                  icon={change >= 0 ? <TrendingUpIcon sx={{ fontSize: 13 }} /> : <TrendingDownIcon sx={{ fontSize: 13 }} />}
                  label={`${change >= 0 ? "+" : ""}${change}%`} color={change >= 0 ? "success" : "error"}
                  sx={{ height: 20, fontSize: "0.65rem", fontWeight: 700, "& .MuiChip-icon": { ml: "3px" } }} />
              )}
              {subtitle && <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.68rem" }}>{subtitle}</Typography>}
            </Stack>
          )}
        </Box>
        <Avatar variant="rounded" sx={{
          width: 42, height: 42, flexShrink: 0, borderRadius: 2.5, color: "#fff",
          background: `linear-gradient(135deg, ${color}, ${alpha(color, 0.7)})`,
          boxShadow: `0 4px 12px ${alpha(color, 0.35)}`,
        }}>{icon}</Avatar>
      </Stack>
    </Paper>
  );
};

// ════════════════════════════════════════════════════════════════════
//  PILL STAT-COUNTERS  (reference: "Action Created 05 / Planned 08")
// ════════════════════════════════════════════════════════════════════
export interface StatPillItem {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
}

export const StatPills = ({ items, compact }: { items: StatPillItem[]; compact?: boolean }) => {
  const theme = useTheme();
  const { chart } = useChartPalette();
  return (
    <Stack direction="row" spacing={compact ? 0.75 : 1} flexWrap="wrap" sx={{ rowGap: compact ? 0.75 : 1 }}>
      {items.map((p, i) => {
        const c = p.color || chart[i % chart.length];
        return (
          <Stack key={`${p.label}-${i}`} direction="row" alignItems="center" spacing={0.75}
            sx={{
              pl: 0.5, pr: 1, py: 0.4, borderRadius: 999,
              bgcolor: alpha(c, 0.08), border: `1px solid ${alpha(c, 0.22)}`,
            }}>
            <Box sx={{
              minWidth: compact ? 24 : 28, height: compact ? 24 : 28, px: 0.5, borderRadius: 999,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: c, color: readableOn(c), fontWeight: 800, fontSize: compact ? "0.72rem" : "0.8rem",
            }}>
              {p.icon ? React.cloneElement(p.icon as React.ReactElement, { sx: { fontSize: 15 } } as any) : p.value}
            </Box>
            <Box sx={{ pr: 0.25, lineHeight: 1 }}>
              <Typography sx={{ fontSize: compact ? "0.68rem" : "0.72rem", fontWeight: 700, color: theme.palette.text.primary, lineHeight: 1.15 }} noWrap>
                {p.label}
              </Typography>
              {p.icon && (
                <Typography sx={{ fontSize: "0.78rem", fontWeight: 800, color: c, lineHeight: 1 }}>{p.value}</Typography>
              )}
            </Box>
          </Stack>
        );
      })}
    </Stack>
  );
};

// ════════════════════════════════════════════════════════════════════
//  HEATMAP CELLS
// ════════════════════════════════════════════════════════════════════
/**
 * Returns {bg, fg} for a value graded across [min,max].
 * direction "highGood": low→amber, high→green. "highBad": low→green, high→red.
 */
export const heatStyle = (
  value: number, min: number, max: number,
  direction: "highGood" | "highBad" = "highGood",
  isDark = false,
) => {
  if (max <= min || !isFinite(value)) return { bg: "transparent", fg: "inherit" as const };
  let t = (value - min) / (max - min);       // 0..1
  t = Math.max(0, Math.min(1, t));
  // hue: green(140) ↔ red(2), amber(38) midpoint feel
  const hue = direction === "highBad"
    ? 140 - t * 138            // low value = green, high value = red
    : 38 + t * 102;            // low value = amber, high value = green
  const sat = 70;
  const light = isDark ? 26 + t * 6 : 92 - t * 30;     // stronger fill as value grows
  const bg = `hsl(${hue}, ${sat}%, ${light}%)`;
  const fg = isDark ? "#F1F5F9" : (light < 62 ? "#fff" : "#2C3E50");
  return { bg, fg };
};

/** A numeric table cell shaded by its value relative to the row/column domain. */
export const HeatCell = ({
  value, min, max, direction = "highGood", format = fmtNum, align = "center",
}: {
  value: number; min: number; max: number;
  direction?: "highGood" | "highBad"; format?: (n: number) => string; align?: "left" | "right" | "center";
}) => {
  const theme = useTheme();
  const { bg, fg } = heatStyle(value, min, max, direction, theme.palette.mode === "dark");
  return (
    <TableCell align={align} sx={{ p: 0.5 }}>
      <Box sx={{
        bgcolor: value === 0 ? alpha(theme.palette.divider, 0.06) : bg,
        color: value === 0 ? theme.palette.text.disabled : fg,
        borderRadius: 1.5, py: 0.6, px: 1, fontWeight: 700, fontSize: "0.76rem",
        textAlign: align, minWidth: 38,
      }}>
        {format(value)}
      </Box>
    </TableCell>
  );
};

// ════════════════════════════════════════════════════════════════════
//  PARETO / COMBO CHART  (bar + cumulative %)
// ════════════════════════════════════════════════════════════════════
/**
 * Pareto: sorts data desc by valueKey, draws bars (left axis) + a cumulative-%
 * line (right axis, 0–100). Highlights the bars that make up the 80% threshold.
 */
export const ParetoChart = ({
  data, nameKey, valueKey, barName = "Value", color, valueFormat = fmt, height = "100%",
}: {
  data: any[];
  nameKey: string;
  valueKey: string;
  barName?: string;
  color?: string;
  valueFormat?: (n: number) => string;
  height?: number | string;
}) => {
  const theme = useTheme();
  const accent = color || theme.palette.primary.main;
  const lineColor = theme.palette.secondary.main;

  const sorted = [...data].sort((a, b) => (b[valueKey] ?? 0) - (a[valueKey] ?? 0));
  const total = sorted.reduce((s, d) => s + (d[valueKey] ?? 0), 0) || 1;
  // Accumulate cumulative % via reduce (no outer-variable mutation in render).
  const rows = sorted.reduce<Array<Record<string, unknown>>>((acc, d) => {
    const prevRun = acc.length ? (acc[acc.length - 1].__run as number) : 0;
    const runVal = prevRun + (d[valueKey] ?? 0);
    const cum = (runVal / total) * 100;
    acc.push({ ...d, __run: runVal, __cum: Math.round(cum * 10) / 10, __vital: cum <= 80 });
    return acc;
  }, []);

  return (
    <ResponsiveContainer width="100%" height={height as number}>
      <ComposedChart data={rows} margin={{ top: 12, right: 8, left: -8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.divider, 0.12)} />
        <XAxis dataKey={nameKey} tick={{ fontSize: 9, fill: theme.palette.text.secondary }} angle={-28} textAnchor="end" height={62} interval={0} />
        <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: theme.palette.text.secondary }} tickFormatter={fmt} />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false}
          tick={{ fontSize: 10, fill: lineColor }} tickFormatter={(v) => `${v}%`} />
        <RTooltip
          contentStyle={{ borderRadius: 10, border: `1px solid ${theme.palette.divider}`, fontSize: 12, background: theme.palette.background.paper }}
          formatter={(val: any, name: any) => name === "Cumulative %" ? `${val}%` : valueFormat(Number(val ?? 0))}
        />
        <Bar yAxisId="l" dataKey={valueKey} name={barName} radius={[5, 5, 0, 0]} barSize={26} maxBarSize={42}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.__vital ? accent : alpha(accent, 0.32)} />
          ))}
        </Bar>
        <Line yAxisId="r" type="monotone" dataKey="__cum" name="Cumulative %" stroke={lineColor}
          strokeWidth={2.5} dot={{ r: 3, fill: lineColor }} activeDot={{ r: 5 }}>
          <LabelList dataKey="__cum" position="top" formatter={(v: any) => `${v}%`}
            style={{ fontSize: 9, fill: lineColor, fontWeight: 700 }} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// ════════════════════════════════════════════════════════════════════
//  DONUT STATUS INDICATOR  (small radial completion gauge for table rows)
// ════════════════════════════════════════════════════════════════════
export const DonutStat = ({ value, max, color, size = 30 }: {
  value: number; max: number; color?: string; size?: number;
}) => {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const deg = pct * 360;
  return (
    <Tooltip title={`${value} / ${max} (${Math.round(pct * 100)}%)`}>
      <Box sx={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: `conic-gradient(${c} ${deg}deg, ${alpha(c, 0.14)} ${deg}deg)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Box sx={{
          width: size - 8, height: size - 8, borderRadius: "50%",
          bgcolor: theme.palette.background.paper,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size > 34 ? "0.62rem" : "0.55rem", fontWeight: 800, color: c,
        }}>{Math.round(pct * 100)}</Box>
      </Box>
    </Tooltip>
  );
};

// ── Recharts tooltip (currency-aware) ─────────────────────────────────
export const ChartTooltipContent = ({ active, payload, label }: any) => {
  const theme = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <Paper sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
      <Typography variant="caption" fontWeight={800} gutterBottom display="block">{label}</Typography>
      {payload.map((e: any, i: number) => (
        <Stack key={i} direction="row" alignItems="center" spacing={0.75}>
          <Box sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: e.color }} />
          <Typography variant="caption">
            {e.name}: <b>{typeof e.value === "number" && e.value > 100 ? fmtFull(e.value) : e.value}</b>
          </Typography>
        </Stack>
      ))}
    </Paper>
  );
};

export const EmptyRow = ({ cols, msg = "No data available" }: { cols: number; msg?: string }) => (
  <TableRow><TableCell colSpan={cols} align="center" sx={{ py: 4 }}>
    <Typography variant="body2" color="text.secondary">{msg}</Typography>
  </TableCell></TableRow>
);

/** Compact section label used between grouped stat blocks. */
export const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="overline" fontWeight={800} color="text.secondary" sx={{ letterSpacing: 1.5 }}>
    {children}
  </Typography>
);

"use client";
/**
 * Ops console design-system kit.
 *
 * Every ops screen is assembled from these primitives so the console has one
 * visual voice instead of per-page MUI defaults. The language matches the tenant
 * portal (navy + gold, hairline cards, gradient icon tiles) at the tighter
 * density an operations console needs.
 *
 * Charts here are hand-rolled SVG/CSS on purpose. The portal uses recharts, but
 * this app ships no chart dependency and adding one would mean reinstalling
 * node_modules; the three shapes an ops console actually needs (trend, split,
 * ranked list) are a few lines of SVG each and stay theme-aware for free.
 * Each one renders its numbers as text too, so the data never lives in colour
 * alone — see the a11y notes on the individual components.
 */
import React from "react";
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
  type Theme,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { ELEVATION, RADIUS } from "@/theme";

// ════════════════════════════════════════════════════════════════════
//  MOTION
// ════════════════════════════════════════════════════════════════════

/**
 * Page/section entrance. Replaces the portal's framer-motion `initial/animate`
 * with a CSS keyframe so the console needs no animation dependency.
 * `index` staggers siblings by 40ms (Material's recommended list cadence).
 * Globally disabled under prefers-reduced-motion by the CssBaseline override.
 */
export const enterSx = (index = 0) => ({
  opacity: 0,
  animation: "opsEnter 0.36s cubic-bezier(0.4, 0, 0.2, 1) forwards",
  animationDelay: `${index * 0.04}s`,
  "@keyframes opsEnter": {
    from: { opacity: 0, transform: "translateY(10px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
});

// ════════════════════════════════════════════════════════════════════
//  FORMATTERS
// ════════════════════════════════════════════════════════════════════

/** Indian-notation compact number: 1.2 K / 3.40 L / 1.05 Cr. */
export const fmt = (n: number): string => {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return n.toLocaleString("en-IN");
};

export const fmtNum = (n: number): string =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const fmtMoney = (n: number): string => `₹${fmtNum(n)}`;

/**
 * Uppercase the first character only. Used instead of CSS `text-transform:
 * capitalize`, which mangles multi-word labels ("2 need attention" → "2 Need
 * Attention") while we only ever want to tidy single lowercase enum values.
 */
export const sentenceCase = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/** "12 Aug, 14:30" — the console's one date format. */
export const fmtDateTime = (value: string | null | undefined): string =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const fmtDate = (value: string | null | undefined): string =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/** "3d ago" / "just now" — relative age for freshness columns. */
export const fmtAgo = (value: string | null | undefined): string => {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(value);
};

// ════════════════════════════════════════════════════════════════════
//  SEMANTIC TONES
// ════════════════════════════════════════════════════════════════════

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "gold";

/** Resolve a semantic tone to a concrete colour from the theme. */
export function toneColor(theme: Theme, tone: Tone): string {
  switch (tone) {
    case "info":
      return theme.palette.info.main;
    case "success":
      return theme.palette.success.main;
    case "warning":
      return theme.palette.warning.main;
    case "danger":
      return theme.palette.error.main;
    case "gold":
      return theme.palette.secondary.main;
    default:
      return theme.palette.text.secondary;
  }
}

/** Chart series colours, in the order a multi-series chart should consume them. */
export function useChartPalette(): string[] {
  const theme = useTheme();
  return [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.primary.light,
    theme.palette.secondary.dark,
  ];
}

// ════════════════════════════════════════════════════════════════════
//  SURFACES
// ════════════════════════════════════════════════════════════════════

/** The console's one card: flat, hairline border, optional hover lift. */
export const Surface = ({
  children,
  padded = true,
  interactive = false,
  accent,
  sx,
  testId,
}: {
  children: React.ReactNode;
  padded?: boolean;
  interactive?: boolean;
  /** Draws a 3px accent rail down the left edge. */
  accent?: string;
  sx?: object;
  testId?: string;
}) => {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      data-testid={testId}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: RADIUS.md,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        boxShadow: ELEVATION.card,
        ...(padded && { p: 2.5 }),
        ...(interactive && {
          transition: "box-shadow 0.2s, transform 0.2s",
          "&:hover": { boxShadow: ELEVATION.hover, transform: "translateY(-2px)" },
        }),
        ...(accent && {
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: `linear-gradient(180deg, ${accent}, ${alpha(accent, 0.3)})`,
          },
        }),
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
};

// ════════════════════════════════════════════════════════════════════
//  HEADERS
// ════════════════════════════════════════════════════════════════════

/** Top-of-page header: gradient icon tile, title, one-line purpose, actions. */
export const PageHeader = ({
  title,
  subtitle,
  icon,
  actions,
  testId,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  testId?: string;
}) => {
  const theme = useTheme();
  const gold = theme.palette.secondary.main;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 2.5, ...enterSx(0) }}
      data-testid={testId}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
        <Avatar
          variant="rounded"
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: RADIUS.sm,
            color: theme.palette.primary.main,
            background: `linear-gradient(135deg, ${alpha(gold, 0.28)}, ${alpha(gold, 0.1)})`,
            border: `1px solid ${alpha(gold, 0.3)}`,
            "& .MuiSvgIcon-root": { fontSize: 21 },
          }}
        >
          {icon}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontSize: "1.2rem", lineHeight: 1.25 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 1 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
};

/** Header for a card/section, with an optional right-aligned actions slot. */
export const SectionHeader = ({
  title,
  subtitle,
  icon,
  color,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  actions?: React.ReactNode;
}) => {
  const theme = useTheme();
  const accent = color || theme.palette.primary.main;
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="flex-start"
      spacing={1.5}
      sx={{ mb: 1.5 }}
      flexWrap="wrap"
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
        {icon && (
          <Avatar
            variant="rounded"
            sx={{
              bgcolor: alpha(accent, 0.12),
              color: accent,
              width: 30,
              height: 30,
              borderRadius: "7px",
              flexShrink: 0,
              "& .MuiSvgIcon-root": { fontSize: 17 },
            }}
          >
            {icon}
          </Avatar>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap sx={{ fontSize: "0.925rem", lineHeight: 1.3 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions && (
        <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" sx={{ rowGap: 0.75 }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
};

/** Card wrapper for a chart or any titled block. */
export const ChartCard = ({
  title,
  subtitle,
  icon,
  color,
  actions,
  height,
  children,
  testId,
  index = 0,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  actions?: React.ReactNode;
  /** Accepts a responsive object, e.g. `{ xs: "auto", lg: 296 }`. */
  height?: number | string | Record<string, number | string>;
  children: React.ReactNode;
  testId?: string;
  index?: number;
}) => {
  const theme = useTheme();
  const accent = color || theme.palette.primary.main;
  return (
    <Surface accent={accent} padded={false} testId={testId} sx={{ height, ...enterSx(index) }}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", pl: 0.5 }}>
        <Box sx={{ px: 2.25, pt: 2, pb: 0.5 }}>
          <SectionHeader title={title} subtitle={subtitle} icon={icon} color={accent} actions={actions} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, px: 2.25, pb: 2, display: "flex", flexDirection: "column" }}>
          {children}
        </Box>
      </Box>
    </Surface>
  );
};

// ════════════════════════════════════════════════════════════════════
//  STAT CARDS
// ════════════════════════════════════════════════════════════════════

/** KPI tile: label, big value, gradient icon, optional delta + footnote. */
export const StatCard = ({
  label,
  value,
  icon,
  color,
  delta,
  hint,
  testId,
  index = 0,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  /** Percentage change vs the previous period. */
  delta?: number;
  hint?: string;
  testId?: string;
  index?: number;
}) => {
  const theme = useTheme();
  const up = (delta ?? 0) >= 0;
  return (
    <Surface interactive padded={false} sx={{ height: "100%", ...enterSx(index) }}>
      <Box sx={{ p: 2, position: "relative" }}>
        {/* Decorative wash — purely visual, hidden from assistive tech. */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            right: -26,
            top: -26,
            width: 84,
            height: 84,
            borderRadius: "50%",
            bgcolor: alpha(color, 0.06),
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {/* Two lines are reserved whether or not the label wraps, so every
                value in a KPI row sits on the same baseline. */}
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{
                display: "block",
                fontSize: "0.64rem",
                lineHeight: 1.35,
                minHeight: "2.7em",
              }}
            >
              {label}
            </Typography>
            <Typography
              variant="h5"
              noWrap
              data-testid={testId}
              sx={{
                // Shrinks on narrow cards so long values (₹2,84,500) stay whole
                // instead of being clipped to an ellipsis.
                fontSize: { xs: "1.15rem", sm: "1.35rem", lg: "1.5rem" },
                lineHeight: 1.2,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </Typography>
            {(delta !== undefined || hint) && (
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.75 }}>
                {delta !== undefined && (
                  <Chip
                    size="small"
                    icon={
                      up ? (
                        <TrendingUpIcon sx={{ fontSize: 13 }} />
                      ) : (
                        <TrendingDownIcon sx={{ fontSize: 13 }} />
                      )
                    }
                    label={`${up ? "+" : ""}${delta}%`}
                    sx={{
                      height: 20,
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      bgcolor: alpha(
                        up ? theme.palette.success.main : theme.palette.error.main,
                        0.12
                      ),
                      color: up ? "success.dark" : "error.dark",
                      "& .MuiChip-icon": { ml: "4px", color: "inherit" },
                    }}
                  />
                )}
                {hint && (
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.68rem" }}>
                    {hint}
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
          <Avatar
            variant="rounded"
            aria-hidden
            sx={{
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: RADIUS.sm,
              color: "#fff",
              background: `linear-gradient(135deg, ${color}, ${alpha(color, 0.68)})`,
              boxShadow: `0 4px 12px ${alpha(color, 0.3)}`,
              "& .MuiSvgIcon-root": { fontSize: 19 },
            }}
          >
            {icon}
          </Avatar>
        </Stack>
      </Box>
    </Surface>
  );
};

/** Compact count pill, for section headers and toolbars. */
export const StatPill = ({
  label,
  value,
  tone = "neutral",
  testId,
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  testId?: string;
}) => {
  const theme = useTheme();
  const c = toneColor(theme, tone);
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      data-testid={testId}
      sx={{
        pl: 0.4,
        pr: 1,
        py: 0.3,
        borderRadius: 999,
        bgcolor: alpha(c, 0.08),
        border: `1px solid ${alpha(c, 0.22)}`,
      }}
    >
      <Box
        sx={{
          minWidth: 22,
          height: 22,
          px: 0.6,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: c,
          color: theme.palette.getContrastText(c),
          fontWeight: 800,
          fontSize: "0.7rem",
        }}
      >
        {value}
      </Box>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700 }} noWrap>
        {label}
      </Typography>
    </Stack>
  );
};

/** Status chip with a semantic tone — never colour alone, the label carries it. */
export const StatusChip = ({
  label,
  tone = "neutral",
  variant = "soft",
  testId,
}: {
  label: string;
  tone?: Tone;
  variant?: "soft" | "outline";
  testId?: string;
}) => {
  const theme = useTheme();
  const c = toneColor(theme, tone);
  return (
    <Chip
      size="small"
      label={sentenceCase(label)}
      data-testid={testId}
      sx={{
        height: 22,
        fontSize: "0.7rem",
        fontWeight: 600,
        ...(variant === "soft"
          ? { bgcolor: alpha(c, 0.13), color: tone === "neutral" ? "text.secondary" : c, border: "none" }
          : { bgcolor: "transparent", color: c, border: `1px solid ${alpha(c, 0.35)}` }),
      }}
    />
  );
};

/** Monospaced reference code (ticket no, org code, lead ref). */
export const CodeText = ({ children }: { children: React.ReactNode }) => (
  <Typography
    component="span"
    sx={{
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "-0.01em",
    }}
  >
    {children}
  </Typography>
);

// ════════════════════════════════════════════════════════════════════
//  TABLE CHROME
// ════════════════════════════════════════════════════════════════════

export interface Column {
  key: string;
  align?: "left" | "center" | "right";
  width?: number | string;
}

/** Card-wrapped, horizontally scrollable table (never breaks the page width). */
export const TableShell = ({
  children,
  minWidth = 720,
  testId,
  toolbar,
}: {
  children: React.ReactNode;
  minWidth?: number;
  testId?: string;
  toolbar?: React.ReactNode;
}) => (
  <Surface padded={false} sx={enterSx(1)}>
    {toolbar}
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table size="small" data-testid={testId} sx={{ minWidth }}>
        {children}
      </Table>
    </TableContainer>
  </Surface>
);

export const HeadRow = ({ cols }: { cols: Column[] }) => (
  <TableHead>
    <TableRow>
      {cols.map((c) => (
        <TableCell key={c.key} align={c.align ?? "left"} sx={{ width: c.width }}>
          {c.key}
        </TableCell>
      ))}
    </TableRow>
  </TableHead>
);

/** Shimmer rows sized to the real table — prevents the layout shift a spinner causes. */
export const TableSkeleton = ({ cols, rows = 6 }: { cols: number; rows?: number }) => (
  <TableBody>
    {Array.from({ length: rows }).map((_, r) => (
      <TableRow key={r}>
        {Array.from({ length: cols }).map((__, c) => (
          <TableCell key={c}>
            <Skeleton variant="text" width={c === 0 ? "60%" : "80%"} height={18} />
          </TableCell>
        ))}
      </TableRow>
    ))}
  </TableBody>
);

/** Empty table body — says what's missing and, where possible, what to do. */
export const EmptyRow = ({
  cols,
  message,
  hint,
  icon,
  action,
  testId,
}: {
  cols: number;
  message: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  testId?: string;
}) => {
  const theme = useTheme();
  return (
    <TableBody>
      <TableRow sx={{ "&:hover": { bgcolor: "transparent !important" } }}>
        <TableCell colSpan={cols} sx={{ borderBottom: 0 }}>
          <Stack alignItems="center" spacing={1} sx={{ py: 6 }} data-testid={testId}>
            {icon && (
              <Avatar
                variant="rounded"
                aria-hidden
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: RADIUS.md,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  color: alpha(theme.palette.primary.main, 0.45),
                }}
              >
                {icon}
              </Avatar>
            )}
            <Typography variant="body2" fontWeight={600}>
              {message}
            </Typography>
            {hint && (
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 380, textAlign: "center" }}>
                {hint}
              </Typography>
            )}
            {action && <Box sx={{ pt: 0.5 }}>{action}</Box>}
          </Stack>
        </TableCell>
      </TableRow>
    </TableBody>
  );
};

/** Standalone (non-table) empty state. */
export const EmptyState = ({
  message,
  hint,
  icon,
  action,
  testId,
}: {
  message: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  testId?: string;
}) => {
  const theme = useTheme();
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 7, px: 2 }} data-testid={testId}>
      {icon && (
        <Avatar
          variant="rounded"
          aria-hidden
          sx={{
            width: 46,
            height: 46,
            borderRadius: RADIUS.md,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            color: alpha(theme.palette.primary.main, 0.45),
          }}
        >
          {icon}
        </Avatar>
      )}
      <Typography variant="body2" fontWeight={600}>
        {message}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 400, textAlign: "center" }}>
          {hint}
        </Typography>
      )}
      {action && <Box sx={{ pt: 0.5 }}>{action}</Box>}
    </Stack>
  );
};

/** Search box with a clear affordance — the console's standard filter control. */
export const SearchField = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Search…",
  width = 260,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  width?: number | string;
  testId?: string;
}) => (
  <TextField
    size="small"
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") onSubmit?.();
      if (e.key === "Escape") onChange("");
    }}
    slotProps={{
      htmlInput: { "data-testid": testId, "aria-label": placeholder },
      input: {
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ fontSize: 17, color: "text.disabled" }} />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              aria-label="Clear search"
              onClick={() => onChange("")}
              sx={{ p: 0.25 }}
            >
              <ClearIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </InputAdornment>
        ) : undefined,
      },
    }}
    sx={{ width, "& .MuiOutlinedInput-root": { height: 36 } }}
  />
);

/** Filter/actions strip that sits above a table, inside its card. */
export const TableToolbar = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme();
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      flexWrap="wrap"
      sx={{
        px: 2,
        py: 1.5,
        rowGap: 1,
        borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
      }}
    >
      {children}
    </Stack>
  );
};

// ════════════════════════════════════════════════════════════════════
//  CHARTS  (dependency-free)
// ════════════════════════════════════════════════════════════════════

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * Filled area + line trend.
 *
 * a11y: the SVG is `aria-hidden` and the same series is exposed as a visually
 * hidden table, so screen readers get exact values instead of a shape. Hovering
 * a point shows its value; the peak is always labelled in the header area.
 */
export const TrendChart = ({
  data,
  color,
  height = 190,
  valueFormat = fmtNum,
  label,
}: {
  data: TrendPoint[];
  color?: string;
  height?: number;
  valueFormat?: (n: number) => string;
  /** Describes the series for assistive tech, e.g. "New tenants per week". */
  label: string;
}) => {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  const gridId = React.useId();

  if (data.length < 2) {
    return (
      <EmptyState
        message="Not enough history yet"
        hint="The trend appears once there are at least two periods of data."
      />
    );
  }

  // Fixed viewBox; `preserveAspectRatio="none"` stretches it to the container and
  // `vectorEffect` keeps strokes a true 2px at any width, so no JS measurement.
  const W = 600;
  const H = 200;
  const PAD = 8;
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = (W - PAD * 2) / (data.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const pts = data.map((d, i) => ({ x: PAD + i * stepX, y: y(d.value), ...d }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ position: "relative", height, width: "100%" }}>
        <Box
          component="svg"
          aria-hidden
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          sx={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={gridId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={0.28} />
              <stop offset="100%" stopColor={c} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {/* Baseline + midline: low-contrast so they never compete with the data. */}
          {[0.5, 1].map((f) => (
            <line
              key={f}
              x1={PAD}
              x2={W - PAD}
              y1={H - PAD - f * (H - PAD * 2)}
              y2={H - PAD - f * (H - PAD * 2)}
              stroke={alpha(theme.palette.primary.main, 0.1)}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill={`url(#${gridId})`} />
          <path
            d={line}
            fill="none"
            stroke={c}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </Box>

        {/* Hover targets sit in HTML so tooltips aren't distorted by the viewBox. */}
        <Box sx={{ position: "absolute", inset: 0, display: "flex" }}>
          {data.map((d, i) => (
            <Tooltip key={`${d.label}-${i}`} title={`${d.label}: ${valueFormat(d.value)}`} arrow>
              <Box
                sx={{
                  flex: 1,
                  cursor: "default",
                  borderRadius: "4px",
                  transition: "background-color 0.15s",
                  "&:hover": { bgcolor: alpha(c, 0.06) },
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* X labels: first, peak and last only — a dense axis is unreadable here. */}
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75, px: 0.5 }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.68rem" }}>
          {data[0].label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.68rem", fontWeight: 700 }}>
          peak {valueFormat(peak.value)} · {peak.label}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.68rem" }}>
          {data[data.length - 1].label}
        </Typography>
      </Stack>

      <VisuallyHiddenTable
        caption={label}
        head={["Period", "Value"]}
        rows={data.map((d) => [d.label, valueFormat(d.value)])}
      />
    </Box>
  );
};

export interface Segment {
  label: string;
  value: number;
  color?: string;
}

/**
 * Donut split with a legend that carries label + count + share as text.
 *
 * a11y: the ring is decorative (`aria-hidden`); the legend beside it is the real
 * content, so nothing depends on distinguishing colours.
 */
export const DonutChart = ({
  segments,
  size = 148,
  centerLabel,
  centerValue,
  testId,
}: {
  segments: Segment[];
  size?: number;
  centerLabel?: string;
  centerValue?: React.ReactNode;
  testId?: string;
}) => {
  const theme = useTheme();
  const palette = useChartPalette();
  const total = segments.reduce((s, x) => s + x.value, 0);

  if (total === 0) {
    return <EmptyState message="Nothing to show yet" hint="This split fills in as data arrives." />;
  }

  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2.5}
      alignItems="center"
      data-testid={testId}
      sx={{ width: "100%" }}
    >
      <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <Box component="svg" aria-hidden viewBox="0 0 100 100" sx={{ width: "100%", height: "100%" }}>
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={alpha(theme.palette.primary.main, 0.07)}
            strokeWidth={13}
          />
          {segments.map((s, i) => {
            const len = (s.value / total) * C;
            const el = (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={s.color || palette[i % palette.length]}
                strokeWidth={13}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform="rotate(-90 50 50)"
              />
            );
            offset += len;
            return el;
          })}
        </Box>
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <Typography variant="h6" sx={{ lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {centerValue ?? total}
          </Typography>
          {centerLabel && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.66rem" }}>
              {centerLabel}
            </Typography>
          )}
        </Stack>
      </Box>

      <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0, width: "100%" }}>
        {segments.map((s, i) => (
          <Stack key={s.label} direction="row" alignItems="center" spacing={1}>
            <Box
              aria-hidden
              sx={{
                width: 9,
                height: 9,
                borderRadius: "3px",
                flexShrink: 0,
                bgcolor: s.color || palette[i % palette.length],
              }}
            />
            <Typography variant="caption" sx={{ flex: 1, minWidth: 0, fontWeight: 600 }} noWrap>
              {s.label}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}
            >
              {s.value}
            </Typography>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round((s.value / total) * 100)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};

/**
 * Ranked horizontal bars — the right shape for "distribution across N categories"
 * (the skill's guidance: bars over pie beyond ~5 categories).
 *
 * a11y: pure HTML with the value printed on every row; the bar is decoration.
 */
export const BarList = ({
  items,
  color,
  valueFormat = fmtNum,
  max: maxOverride,
  testId,
}: {
  items: Segment[];
  color?: string;
  valueFormat?: (n: number) => string;
  max?: number;
  testId?: string;
}) => {
  const theme = useTheme();
  const c = color || theme.palette.primary.main;
  const max = maxOverride ?? Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return <EmptyState message="No data yet" hint="Rows appear here as soon as there is something to rank." />;
  }

  return (
    <Stack spacing={1.5} data-testid={testId} sx={{ width: "100%" }}>
      {items.map((item) => (
        <Box key={item.label}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="caption" fontWeight={600} noWrap sx={{ minWidth: 0 }}>
              {item.label}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
            >
              {valueFormat(item.value)}
            </Typography>
          </Stack>
          <Box
            aria-hidden
            sx={{
              height: 7,
              borderRadius: 999,
              bgcolor: alpha(theme.palette.primary.main, 0.07),
              overflow: "hidden",
            }}
          >
            {/* One base hue per bar, fading to a lighter tint of ITSELF. Mixing
                two unrelated palette entries here turned every bar muddy. */}
            <Box
              sx={{
                height: "100%",
                borderRadius: 999,
                width: `${Math.max((item.value / max) * 100, 2)}%`,
                background: `linear-gradient(90deg, ${item.color || c}, ${alpha(
                  item.color || c,
                  0.5
                )})`,
                transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  );
};

/**
 * Screen-reader-only data table. Charts render this alongside the visual so the
 * underlying numbers are always reachable (WCAG: charts alone aren't readable).
 */
export const VisuallyHiddenTable = ({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) => (
  <Box
    component="table"
    sx={{
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
      border: 0,
    }}
  >
    <caption>{caption}</caption>
    <thead>
      <tr>
        {head.map((h) => (
          <th key={h} scope="col">
            {h}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          {r.map((cell, j) => (
            <td key={j}>{cell}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </Box>
);

/** Card-grid skeleton for first paint of a dashboard. */
export const StatGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <Box
    sx={{
      display: "grid",
      gap: 2,
      gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: `repeat(${count}, 1fr)` },
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} variant="rounded" height={104} />
    ))}
  </Box>
);

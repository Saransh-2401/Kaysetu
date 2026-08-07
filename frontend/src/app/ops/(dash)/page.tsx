"use client";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BusinessIcon from "@mui/icons-material/Business";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PersonAddIcon from "@mui/icons-material/PersonAddAlt1";
import RefreshIcon from "@mui/icons-material/Refresh";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  BarList,
  ChartCard,
  DonutChart,
  EmptyState,
  PageHeader,
  StatCard,
  StatGridSkeleton,
  Surface,
  TrendChart,
  type Segment,
  type Tone,
  type TrendPoint,
  enterSx,
  fmtNum,
  toneColor,
} from "@/components/ui/kit";
import { api } from "@/lib/api";

interface Stats {
  tenants: { total: number; by_status: Record<string, number> };
  signups_this_week: number;
  active_trials: number;
  trials_ending_7d: number;
  provisioning: { failed: number; running: number };
  mrr: string;
  package_distribution: { package__code: string; package__name: string; count: number }[];
  /** Added by StatsView; older backends omit it and the trend card degrades. */
  signup_trend?: TrendPoint[];
}

const STATUS_TONE: Record<string, Tone> = {
  trial: "info",
  active: "success",
  suspended: "warning",
  failed: "danger",
  provisioning: "gold",
  churned: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  failed: "Failed",
  provisioning: "Provisioning",
  churned: "Churned",
};

/** One row of the operations queue panel — a count that links to its worklist. */
function QueueRow({
  icon,
  label,
  hint,
  count,
  tone,
  href,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  count: number;
  tone: Tone;
  href: string;
  testId: string;
}) {
  const theme = useTheme();
  const c = toneColor(theme, count > 0 ? tone : "neutral");
  return (
    <Stack
      component={Link}
      href={href}
      direction="row"
      alignItems="center"
      spacing={1.5}
      data-testid={testId}
      sx={{
        p: 1.5,
        borderRadius: "10px",
        textDecoration: "none",
        color: "inherit",
        border: `1px solid ${alpha(c, count > 0 ? 0.25 : 0.12)}`,
        bgcolor: alpha(c, count > 0 ? 0.05 : 0.02),
        transition: "all 0.2s",
        "&:hover": { bgcolor: alpha(c, 0.1), transform: "translateX(2px)" },
        "&:hover .go": { opacity: 1, transform: "translateX(0)" },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: "9px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: alpha(c, 0.14),
          color: c,
          "& .MuiSvgIcon-root": { fontSize: 18 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} noWrap>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {hint}
        </Typography>
      </Box>
      <Typography
        variant="h6"
        sx={{ color: c, fontVariantNumeric: "tabular-nums", lineHeight: 1, flexShrink: 0 }}
      >
        {count}
      </Typography>
      <ArrowForwardIcon
        className="go"
        sx={{
          fontSize: 16,
          flexShrink: 0,
          color: c,
          opacity: 0,
          transform: "translateX(-4px)",
          transition: "all 0.2s",
        }}
      />
    </Stack>
  );
}

export default function CommandCenterPage() {
  const theme = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<number | null>(null);
  const [leads, setLeads] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Stats>("ops", "/sa/stats");
      setStats(data);
      setError(null);
      setRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the command center.");
    } finally {
      setLoading(false);
    }
    // Queue counts are supporting detail — never let them fail the whole page.
    api<Record<string, number>>("ops", "/sa/support/summary")
      .then((s) => setTickets(s.needs_attention ?? 0))
      .catch(() => setTickets(null));
    api<Record<string, number>>("ops", "/sa/leads/summary")
      .then((s) => setLeads(s.needs_attention ?? 0))
      .catch(() => setLeads(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusSegments: Segment[] = stats
    ? Object.entries(stats.tenants.by_status)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({
          label: STATUS_LABEL[status] ?? status,
          value: count,
          color: toneColor(theme, STATUS_TONE[status] ?? "neutral"),
        }))
    : [];

  const packageSegments: Segment[] = stats
    ? stats.package_distribution.map((row) => ({
        label: `${row.package__code} · ${row.package__name}`,
        value: row.count,
      }))
    : [];

  const header = (
    <PageHeader
      title="Command Center"
      subtitle="Platform health across every tenant, at a glance"
      icon={<SpaceDashboardIcon />}
      testId="ops-commandcenter-header"
      actions={
        <>
          {refreshedAt && (
            <Typography variant="caption" color="text.disabled" sx={{ display: { xs: "none", md: "block" } }}>
              Updated {refreshedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </Typography>
          )}
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={load}
                disabled={loading}
                aria-label="Refresh command center"
                data-testid="ops-commandcenter-refresh-btn"
                sx={{ border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}
              >
                <RefreshIcon
                  sx={{
                    fontSize: 18,
                    animation: loading ? "spin 0.9s linear infinite" : "none",
                    "@keyframes spin": { to: { transform: "rotate(360deg)" } },
                  }}
                />
              </IconButton>
            </span>
          </Tooltip>
        </>
      }
    />
  );

  if (error && !stats) {
    return (
      <Box data-testid="ops-commandcenter-container">
        {header}
        <Surface>
          <EmptyState
            icon={<ErrorOutlineIcon />}
            message="Could not load the command center"
            hint={error}
            testId="ops-stats-error-alert"
            action={
              <Button variant="contained" size="small" startIcon={<RefreshIcon />} onClick={load}>
                Try again
              </Button>
            }
          />
        </Surface>
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box data-testid="ops-commandcenter-container">
        {header}
        <StatGridSkeleton count={6} />
        <Box
          sx={{
            display: "grid",
            gap: 2,
            mt: 2,
            gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" },
          }}
        >
          <Skeleton variant="rounded" height={296} />
          <Skeleton variant="rounded" height={296} />
        </Box>
      </Box>
    );
  }

  return (
    <Box data-testid="ops-commandcenter-container">
      {header}

      {/* Non-fatal refresh failure: keep the last good numbers on screen. */}
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          Showing the last loaded figures — refresh failed: {error}
        </Alert>
      )}

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            xl: "repeat(6, 1fr)",
          },
        }}
      >
        <StatCard
          index={0}
          label="Total tenants"
          value={fmtNum(stats.tenants.total)}
          icon={<BusinessIcon />}
          color={theme.palette.primary.main}
          hint={`${stats.tenants.by_status.active ?? 0} active`}
          testId="ops-stat-tenants-total"
        />
        <StatCard
          index={1}
          label="MRR"
          value={`₹${Number(stats.mrr).toLocaleString("en-IN")}`}
          icon={<CurrencyRupeeIcon />}
          color={theme.palette.secondary.main}
          hint="from active subscriptions"
          testId="ops-stat-mrr"
        />
        <StatCard
          index={2}
          label="Signups this week"
          value={fmtNum(stats.signups_this_week)}
          icon={<PersonAddIcon />}
          color={theme.palette.info.main}
          hint="last 7 days"
          testId="ops-stat-signups-week"
        />
        <StatCard
          index={3}
          label="Active trials"
          value={fmtNum(stats.active_trials)}
          icon={<TimerOutlinedIcon />}
          color={theme.palette.primary.light}
          testId="ops-stat-trials-active"
        />
        <StatCard
          index={4}
          label="Trials ending 7d"
          value={fmtNum(stats.trials_ending_7d)}
          icon={<HourglassBottomIcon />}
          color={theme.palette.warning.main}
          hint={stats.trials_ending_7d > 0 ? "needs outreach" : "nothing expiring"}
          testId="ops-stat-trials-ending"
        />
        <StatCard
          index={5}
          label="Failed provisions"
          value={fmtNum(stats.provisioning.failed)}
          icon={<ErrorOutlineIcon />}
          color={
            stats.provisioning.failed > 0 ? theme.palette.error.main : theme.palette.success.main
          }
          hint={stats.provisioning.failed > 0 ? "action required" : "all clear"}
          testId="ops-stat-provision-failed"
        />
      </Box>

      {/* ── Trend + status split ────────────────────────────────── */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          mt: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" },
        }}
      >
        <ChartCard
          index={6}
          title="Signup trend"
          subtitle="New tenants per week"
          icon={<ShowChartIcon />}
          testId="ops-signup-trend-card"
          // Fixed height only once the two cards sit side by side; stacked on
          // mobile the donut's legend needs to grow or it gets clipped.
          height={{ xs: "auto", lg: 296 }}
        >
          {stats.signup_trend && stats.signup_trend.length > 0 ? (
            <TrendChart
              data={stats.signup_trend}
              label="New tenants per week, last 8 weeks"
              color={theme.palette.primary.main}
              height={196}
            />
          ) : (
            <EmptyState
              icon={<ShowChartIcon />}
              message="Trend data unavailable"
              hint="The API did not return a signup history for this period."
            />
          )}
        </ChartCard>

        <ChartCard
          index={7}
          title="Tenants by status"
          subtitle="Lifecycle split"
          icon={<DonutLargeIcon />}
          color={theme.palette.secondary.main}
          testId="ops-status-split-row"
          // Fixed height only once the two cards sit side by side; stacked on
          // mobile the donut's legend needs to grow or it gets clipped.
          height={{ xs: "auto", lg: 296 }}
        >
          <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
            <DonutChart
              segments={statusSegments}
              centerLabel="tenants"
              centerValue={stats.tenants.total}
              testId="ops-status-donut"
            />
          </Box>
        </ChartCard>
      </Box>

      {/* ── Packages + operations queue ─────────────────────────── */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          mt: 2,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
        }}
      >
        <ChartCard
          index={8}
          title="Package distribution"
          subtitle="Tenants on each plan"
          icon={<Inventory2Icon />}
          color={theme.palette.info.main}
          testId="ops-package-distribution-list"
          actions={
            <Button
              component={Link}
              href="/ops/packages"
              size="small"
              endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
              sx={{ fontSize: "0.75rem" }}
            >
              Manage
            </Button>
          }
        >
          {packageSegments.length > 0 ? (
            <BarList items={packageSegments} color={theme.palette.info.main} />
          ) : (
            <EmptyState
              icon={<Inventory2Icon />}
              message="No tenants on a package yet"
              hint="Package adoption shows up here once the first subscription is active."
            />
          )}
        </ChartCard>

        <Surface sx={enterSx(9)} padded={false}>
          <Box sx={{ p: 2.25 }}>
            <Typography variant="subtitle1" sx={{ fontSize: "0.925rem", mb: 0.25 }}>
              Needs your attention
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.75 }}>
              Open work across the platform queues
            </Typography>

            <Stack spacing={1}>
              <QueueRow
                icon={<SupportAgentIcon />}
                label="Support tickets"
                hint="Awaiting a reply from us"
                count={tickets ?? 0}
                tone="warning"
                href="/ops/tickets"
                testId="ops-queue-tickets"
              />
              <QueueRow
                icon={<TrendingUpIcon />}
                label="Leads to follow up"
                hint="New or uncontacted enquiries"
                count={leads ?? 0}
                tone="info"
                href="/ops/leads"
                testId="ops-queue-leads"
              />
              <QueueRow
                icon={<ErrorOutlineIcon />}
                label="Failed provisions"
                hint="Tenants stuck without a database"
                count={stats.provisioning.failed}
                tone="danger"
                href="/ops/provisioning"
                testId="ops-queue-provisioning-failed"
              />
              <QueueRow
                icon={<RocketLaunchIcon />}
                label="Provisioning now"
                hint="Jobs currently running"
                count={stats.provisioning.running}
                tone="gold"
                href="/ops/provisioning"
                testId="ops-queue-provisioning-running"
              />
            </Stack>
          </Box>
        </Surface>
      </Box>
    </Box>
  );
}
